import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated, isDemoUser, demoReadOnlyGuard, DEMO_USER_ID, DEMO_GYM_ID } from "./replit_integrations/auth";
import { parseMembersCsv, previewCsv, parseAllRows, computeFileHash, type ColumnMapping } from "./csv-parser";
import { recomputeAllMetrics, computeMonthlyMetrics, generateMetricReports, generateForecast, generateTrendIntelligence } from "./metrics";
import { generatePredictiveIntelligence } from "./predictive";
import { ensureRecommendationCards, getOwnerActions, getPeriodStart, getRecommendationExecutionState, logOwnerAction, runLearningUpdate, toggleChecklistItem } from "./recommendation-learning";
import { insertGymSchema, insertKnowledgeSourceSchema, insertLeadSchema, insertConsultSchema, insertSalesMembershipSchema, insertPaymentSchema } from "@shared/schema";
import multer from "multer";
import { encryptApiKey, generateFingerprint, testWodifyConnection } from "./wodify-connector";
import { runWodifySync } from "./wodify-sync";
import { ingestSource, reprocessDocument, TAXONOMY_TAGS } from "./knowledge-ingestion";
import { searchKnowledge } from "./knowledge-retrieval";
import { seedKnowledgeBase } from "./seed-knowledge";
import { computeSalesSummary, computeTrends, computeBySource, computeByCoach, computeLeadAging } from "./sales-intelligence";
import { getCachedSummary, setCachedSummary, invalidateGymCache, getRecalcStatus, initSalesCache } from "./sales-cache";
import { ensureDemoData } from "./demo-seed";
import { previewLeadCsv, parseAllLeadRows, computeFileHash as computeLeadFileHash, type LeadColumnMapping } from "./lead-csv-parser";
import { buildInputSummary } from "./ai-operator-stub";
import { generateOperatorOutput } from "./operator-generator";
import { buildTieredContext } from "./operator-context";
import { checkRateLimit, recordGeneration } from "./operator-rate-limiter";
import { OPERATOR_PILLS, OPERATOR_TASK_TYPES, OPERATOR_TASK_STATUSES, type OperatorPill, type OperatorTaskType, type OperatorRole, type GymStaffRole } from "@shared/schema";
import { pool } from "./db";
import { createCheckoutSession, createCustomerPortalSession, getSubscriptionStatus, ensureTrialSubscription, isStripeConfigured, PLANS } from "./stripe";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function checkGymAccess(req: any, gym: { ownerId: string; id: string }): Promise<boolean> {
  if (isDemoUser(req) && gym.id === DEMO_GYM_ID) return true;
  if (gym.ownerId === req.user.claims.sub) return true;
  const role = await storage.getGymStaffRole(gym.id, req.user.claims.sub);
  return role !== null;
}

async function getUserGymRole(req: any, gym: { ownerId: string; id: string }): Promise<GymStaffRole | null> {
  if (isDemoUser(req) && gym.id === DEMO_GYM_ID) return "owner";
  const role = await storage.getGymStaffRole(gym.id, req.user.claims.sub);
  if (role) return role;
  if (gym.ownerId === req.user.claims.sub) return "owner";
  return null;
}

function getOperatorRole(staffRole: GymStaffRole): OperatorRole {
  if (staffRole === "owner") return "gym_owner";
  if (staffRole === "admin") return "analyst";
  return "coach_view";
}

function canGenerate(role: OperatorRole): boolean {
  return role === "gym_owner" || role === "analyst";
}

function canViewHistory(role: OperatorRole): boolean {
  return role === "gym_owner" || role === "analyst";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get("/api/health", async (_req, res) => {
    try {
      const result = await pool.query("SELECT 1");
      res.json({ status: "healthy", db: "connected", timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(503).json({ status: "unhealthy", db: "disconnected", timestamp: new Date().toISOString() });
    }
  });

  app.get("/api/plans", (_req, res) => {
    res.json({
      plans: PLANS,
      stripeConfigured: isStripeConfigured(),
    });
  });

  app.get("/api/gyms/:id/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });
      const status = await getSubscriptionStatus(req.params.id);
      res.json(status);
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ message: "Failed to fetch subscription status" });
    }
  });

  app.post("/api/gyms/:id/subscription/checkout", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const { plan } = req.body;
      if (!plan || !["starter", "pro"].includes(plan)) {
        return res.status(400).json({ message: "Invalid plan" });
      }

      const userEmail = req.user?.claims?.email || "";
      const returnUrl = `${req.protocol}://${req.get("host")}/gyms/${req.params.id}/settings`;
      const session = await createCheckoutSession(req.params.id, plan, userEmail, returnUrl);
      res.json(session);
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: error.message || "Failed to create checkout session" });
    }
  });

  app.post("/api/gyms/:id/subscription/portal", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const returnUrl = `${req.protocol}://${req.get("host")}/gyms/${req.params.id}/settings`;
      const session = await createCustomerPortalSession(req.params.id, returnUrl);
      res.json(session);
    } catch (error: any) {
      console.error("Error creating portal session:", error);
      res.status(500).json({ message: error.message || "Failed to create portal session" });
    }
  });

  app.post("/api/demo", async (req: any, res, next) => {
    try {
      await ensureDemoData();
    } catch (e) {
      console.error("[DEMO] Seed error:", e);
    }
    const demoUser = {
      claims: { sub: DEMO_USER_ID, email: "demo@ironmetrics.app", first_name: "Demo", last_name: "User" },
      expires_at: Math.floor(Date.now() / 1000) + 86400 * 365,
    };
    req.login(demoUser, (err: any) => {
      if (err) return next(err);
      res.json({ ok: true });
    });
  });

  app.get("/api/gyms", isAuthenticated, async (req: any, res) => {
    try {
      if (isDemoUser(req)) {
        const demoGym = await storage.getGym(DEMO_GYM_ID);
        return res.json(demoGym ? [demoGym] : []);
      }
      const userId = req.user.claims.sub;
      const gyms = await storage.getGymsForUser(userId);
      res.json(gyms);
    } catch (error) {
      console.error("Error fetching gyms:", error);
      res.status(500).json({ message: "Failed to fetch gyms" });
    }
  });

  app.get("/api/gyms/:id", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });
      res.json(gym);
    } catch (error) {
      console.error("Error fetching gym:", error);
      res.status(500).json({ message: "Failed to fetch gym" });
    }
  });

  app.post("/api/gyms", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = insertGymSchema.parse({ ...req.body, ownerId: userId });
      const gym = await storage.createGym(parsed);
      await storage.addGymStaff({ gymId: gym.id, userId, role: "owner" });
      try {
        await ensureTrialSubscription(gym.id);
      } catch (e) {
        console.error("Error creating trial subscription:", e);
      }
      res.status(201).json(gym);
    } catch (error: any) {
      console.error("Error creating gym:", error);
      res.status(400).json({ message: error.message || "Invalid data" });
    }
  });

  app.get("/api/gyms/:id/members", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });
      const members = await storage.getMembersByGym(req.params.id);
      res.json(members);
    } catch (error) {
      console.error("Error fetching members:", error);
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  app.get("/api/gyms/:id/members/enriched", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const members = await storage.getMembersByGym(req.params.id);
      const contacts = await storage.getLatestContacts(req.params.id);

      const contactMap = new Map<string, Date>();
      for (const c of contacts) {
        if (c.contactedAt && !contactMap.has(c.memberId)) {
          contactMap.set(c.memberId, c.contactedAt);
        }
      }

      const now = new Date();
      const rates = members
        .filter((m) => m.status === "active")
        .map((m) => Number(m.monthlyRate))
        .sort((a, b) => b - a);
      const top20Threshold = rates.length > 0 ? rates[Math.floor(rates.length * 0.2)] : 0;

      const hasAttendanceData = members.some(m => m.status === "active" && m.lastAttendedDate != null);

      const enriched = members.map((m) => {
        const joinDate = new Date(m.joinDate + "T00:00:00");
        const tenureDays = Math.max(0, Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24)));
        const tenureMonths = Math.floor(tenureDays / 30.44);
        const lastContacted = contactMap.get(m.id) || null;
        const daysSinceContact = lastContacted
          ? Math.floor((now.getTime() - lastContacted.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        const rate = Number(m.monthlyRate);
        const isHighValue = rate >= top20Threshold && top20Threshold > 0;

        const daysSinceAttendance = m.lastAttendedDate
          ? Math.floor((now.getTime() - new Date(m.lastAttendedDate + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24))
          : null;

        let risk: "low" | "medium" | "high" = "low";
        let riskReasons: string[] = [];

        if (m.status === "cancelled") {
          risk = "low";
          riskReasons = ["Cancelled"];
        } else {
          if (tenureDays <= 14) {
            risk = "high";
            riskReasons.push("New member (< 2 weeks)");
          } else if (tenureDays <= 30) {
            risk = "high";
            riskReasons.push("First month");
          } else if (tenureDays <= 60) {
            risk = "medium";
            riskReasons.push("Pre-habit window (< 60 days)");
          }

          if (tenureDays > 60) {
            if (hasAttendanceData) {
              if (daysSinceAttendance !== null && daysSinceAttendance >= 30) {
                risk = "high";
                riskReasons.push("No class 30+ days — disengaging");
              } else if (daysSinceAttendance !== null && daysSinceAttendance >= 14) {
                risk = "medium";
                riskReasons.push("No class 14+ days — disengaging");
              } else if (daysSinceAttendance === null) {
                risk = "high";
                riskReasons.push("No attendance recorded — disengaging");
              }
            } else {
              if (daysSinceContact === null && tenureDays > 90) {
                risk = "high";
                riskReasons.push("Never contacted — disengaging");
              } else if (daysSinceContact !== null && daysSinceContact > 60) {
                risk = "high";
                riskReasons.push("Silent 60+ days — disengaging");
              } else if (daysSinceContact !== null && daysSinceContact > 30) {
                risk = "medium";
                riskReasons.push("Drifting 30+ days");
              }
            }
          } else {
            if (daysSinceContact !== null && daysSinceContact > 14) {
              if (risk === "low") risk = "medium";
              riskReasons.push("No recent contact");
            }

            if (daysSinceContact === null) {
              if (risk !== "high") risk = "high";
              riskReasons.push("Never contacted");
            }
          }
        }

        return {
          id: m.id,
          name: m.name,
          email: m.email,
          status: m.status,
          joinDate: m.joinDate,
          cancelDate: m.cancelDate,
          monthlyRate: m.monthlyRate,
          tenureDays,
          tenureMonths,
          risk,
          riskReasons,
          lastContacted: lastContacted?.toISOString() || null,
          daysSinceContact,
          isHighValue,
          totalRevenue: tenureMonths * rate,
        };
      });

      res.json(enriched);
    } catch (error) {
      console.error("Error fetching enriched members:", error);
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  app.get("/api/gyms/:id/members/:memberId/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });
      const member = await storage.getMemberById(req.params.memberId);
      if (!member || member.gymId !== req.params.id) return res.status(404).json({ message: "Member not found" });
      const contacts = await storage.getContactsForMember(req.params.memberId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching member contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.post("/api/gyms/:id/import/preview", isAuthenticated, demoReadOnlyGuard, upload.single("file"), async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const csvText = req.file.buffer.toString("utf-8");
      const fileHash = computeFileHash(csvText);

      const existingImport = await storage.findImportByHash(req.params.id, fileHash);
      const isDuplicate = existingImport && existingImport.status === "completed";

      const customMapping = req.body.mapping ? JSON.parse(req.body.mapping) as Partial<ColumnMapping> : undefined;
      const preview = previewCsv(csvText, customMapping);

      res.json({
        ...preview,
        fileHash,
        isDuplicate,
        duplicateJobId: isDuplicate ? existingImport.id : null,
        duplicateDate: isDuplicate ? existingImport.createdAt : null,
      });
    } catch (error: any) {
      console.error("Error previewing import:", error);
      res.status(400).json({ message: error.message || "Failed to preview file" });
    }
  });

  app.post("/api/gyms/:id/import/commit", isAuthenticated, demoReadOnlyGuard, upload.single("file"), async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const csvText = req.file.buffer.toString("utf-8");
      const fileHash = computeFileHash(csvText);

      let mapping: ColumnMapping;
      try {
        mapping = req.body.mapping ? JSON.parse(req.body.mapping) : null;
      } catch {
        return res.status(400).json({ message: "Invalid column mapping format" });
      }

      if (!mapping || typeof mapping !== "object") {
        return res.status(400).json({ message: "Column mapping is required" });
      }
      if (typeof mapping.name !== "number" || mapping.name < 0) {
        return res.status(400).json({ message: "Name column mapping is required" });
      }
      if (typeof mapping.joinDate !== "number" || mapping.joinDate < 0) {
        return res.status(400).json({ message: "Join Date column mapping is required" });
      }

      const result = parseAllRows(csvText, mapping);

      if (result.validRows === 0) {
        const job = await storage.createImportJob({
          gymId: req.params.id,
          uploadedBy: req.user.claims.sub,
          filename: req.file.originalname || "import.csv",
          fileHash,
          rawCsv: csvText,
          columnMapping: JSON.stringify(mapping),
          status: "failed",
          totalRows: result.totalRows,
          importedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          errorCount: result.errorRows,
          errors: result.errors.length > 0 ? JSON.stringify(result.errors.slice(0, 200)) : null,
        });

        return res.status(400).json({
          jobId: job.id,
          message: "No valid rows to import. All rows had validation errors.",
          errorCount: result.errorRows,
          errors: result.errors.slice(0, 50),
        });
      }

      const job = await storage.createImportJob({
        gymId: req.params.id,
        uploadedBy: req.user.claims.sub,
        filename: req.file.originalname || "import.csv",
        fileHash,
        rawCsv: csvText,
        columnMapping: JSON.stringify(mapping),
        status: "processing",
        totalRows: result.totalRows,
        importedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: null,
      });

      let imported = 0;
      let updated = 0;
      let skipped = 0;

      for (const member of result.members) {
        try {
          const r = await storage.upsertMember({
            gymId: req.params.id,
            name: member.name,
            email: member.email,
            status: member.status,
            joinDate: member.joinDate,
            cancelDate: member.cancelDate,
            lastAttendedDate: member.lastAttendedDate,
            monthlyRate: member.monthlyRate,
          });
          if (r.action === "inserted") imported++;
          else updated++;
        } catch {
          skipped++;
        }
      }

      const updatedJob = await storage.updateImportJob(job.id, {
        status: "completed",
        totalRows: result.totalRows,
        importedCount: imported,
        updatedCount: updated,
        skippedCount: skipped,
        errorCount: result.errorRows,
        errors: result.errors.length > 0 ? JSON.stringify(result.errors.slice(0, 200)) : null,
        completedAt: new Date(),
      });

      recomputeAllMetrics(req.params.id).catch((err) =>
        console.error("Background metrics recompute failed:", err)
      );

      res.json({
        jobId: updatedJob.id,
        imported,
        updated,
        skipped,
        errorCount: result.errorRows,
        errors: result.errors.slice(0, 50),
        totalRows: result.totalRows,
        validRows: result.validRows,
      });
    } catch (error: any) {
      console.error("Error committing import:", error);
      res.status(400).json({ message: error.message || "Import failed" });
    }
  });

  app.post("/api/gyms/:id/import/members", isAuthenticated, demoReadOnlyGuard, upload.single("file"), async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const csvText = req.file.buffer.toString("utf-8");
      const parsed = parseMembersCsv(csvText);

      let imported = 0;
      let updated = 0;
      let skipped = 0;

      for (const member of parsed) {
        try {
          const result = await storage.upsertMember({
            gymId: req.params.id,
            name: member.name,
            email: member.email,
            status: member.status,
            joinDate: member.joinDate,
            cancelDate: member.cancelDate,
            monthlyRate: member.monthlyRate,
          });
          if (result.action === "inserted") imported++;
          else updated++;
        } catch {
          skipped++;
        }
      }

      recomputeAllMetrics(req.params.id).catch((err) =>
        console.error("Background metrics recompute failed:", err)
      );

      res.json({ imported, updated, skipped });
    } catch (error: any) {
      console.error("Error importing members:", error);
      res.status(400).json({ message: error.message || "Import failed" });
    }
  });

  app.get("/api/gyms/:id/imports", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const jobs = await storage.getImportJobsByGym(req.params.id);
      const sanitized = jobs.map(j => ({
        id: j.id,
        filename: j.filename,
        status: j.status,
        totalRows: j.totalRows,
        importedCount: j.importedCount,
        updatedCount: j.updatedCount,
        skippedCount: j.skippedCount,
        errorCount: j.errorCount,
        createdAt: j.createdAt,
        completedAt: j.completedAt,
      }));
      res.json(sanitized);
    } catch (error) {
      console.error("Error fetching import history:", error);
      res.status(500).json({ message: "Failed to fetch import history" });
    }
  });

  app.get("/api/gyms/:id/imports/:jobId", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const job = await storage.getImportJob(req.params.jobId);
      if (!job || job.gymId !== req.params.id) return res.status(404).json({ message: "Import job not found" });

      res.json({
        id: job.id,
        filename: job.filename,
        status: job.status,
        totalRows: job.totalRows,
        importedCount: job.importedCount,
        updatedCount: job.updatedCount,
        skippedCount: job.skippedCount,
        errorCount: job.errorCount,
        errors: job.errors ? JSON.parse(job.errors) : [],
        columnMapping: job.columnMapping ? JSON.parse(job.columnMapping) : null,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      });
    } catch (error) {
      console.error("Error fetching import job:", error);
      res.status(500).json({ message: "Failed to fetch import job" });
    }
  });

  app.get("/api/gyms/:id/heartbeat", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const month = req.query.month as string;
      if (!month) return res.status(400).json({ message: "month query parameter required (YYYY-MM-DD)" });

      let metrics = await storage.getMonthlyMetrics(req.params.id, month);
      if (!metrics) {
        const members = await storage.getMembersByGym(req.params.id);
        if (members.length === 0) {
          return res.status(404).json({ message: "No members found. Import members first." });
        }
        metrics = await computeMonthlyMetrics(req.params.id, month);
      }

      res.json(metrics);
    } catch (error) {
      console.error("Error fetching heartbeat:", error);
      res.status(500).json({ message: "Failed to fetch heartbeat" });
    }
  });

  app.get("/api/gyms/:id/metrics", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const metrics = await storage.getAllMonthlyMetrics(req.params.id);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  app.get("/api/gyms/:id/report", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const month = req.query.month as string;
      if (!month) return res.status(400).json({ message: "month query parameter required (YYYY-MM-DD)" });

      let metrics = await storage.getMonthlyMetrics(req.params.id, month);
      if (!metrics) {
        const members = await storage.getMembersByGym(req.params.id);
        if (members.length === 0) {
          return res.status(404).json({ message: "No members found. Import members first." });
        }
        metrics = await computeMonthlyMetrics(req.params.id, month);
      }

      const getPrevMonth = (m: string, back: number) => {
        const d = new Date(m + "T00:00:00");
        d.setMonth(d.getMonth() - back);
        return d.toISOString().slice(0, 10);
      };

      const [prev1, prev2, prev3] = await Promise.all([
        storage.getMonthlyMetrics(req.params.id, getPrevMonth(month, 1)),
        storage.getMonthlyMetrics(req.params.id, getPrevMonth(month, 2)),
        storage.getMonthlyMetrics(req.params.id, getPrevMonth(month, 3)),
      ]);

      const toTrend = (m: typeof prev1) => m ? {
        rsi: m.rsi,
        churnRate: Number(m.churnRate),
        mrr: Number(m.mrr),
        arm: Number(m.arm),
        ltv: Number(m.ltv),
        memberRiskCount: m.memberRiskCount,
        activeMembers: m.activeMembers,
      } : undefined;

      const monthDate = new Date(month + "T00:00:00");
      const nextMonth = new Date(monthDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const monthEnd = new Date(nextMonth);
      monthEnd.setDate(monthEnd.getDate() - 1);
      const lastDayOfMonth = monthEnd.toISOString().slice(0, 10);

      let predictiveData: Awaited<ReturnType<typeof generatePredictiveIntelligence>> | null = null;
      try {
        predictiveData = await generatePredictiveIntelligence(req.params.id);
      } catch (e) {
        console.error("Predictive engine unavailable for report, falling back:", e);
      }

      const predictiveRisk = predictiveData ? (() => {
        const cb = predictiveData.memberPredictions.summary.classBreakdown;
        return {
          atRiskCount: cb["at-risk"] || 0,
          ghostCount: cb["ghost"] || 0,
          drifterCount: cb["drifter"] || 0,
          totalFlagged: (cb["at-risk"] || 0) + (cb["ghost"] || 0),
          revenueAtRisk: predictiveData.memberPredictions.summary.totalRevenueAtRisk,
        };
      })() : undefined;

      const reports = generateMetricReports({
        activeMembers: metrics.activeMembers,
        churnRate: Number(metrics.churnRate),
        mrr: Number(metrics.mrr),
        arm: Number(metrics.arm),
        ltv: Number(metrics.ltv),
        rsi: metrics.rsi,
        res: Number(metrics.res),
        ltveImpact: Number(metrics.ltveImpact),
        memberRiskCount: predictiveRisk ? predictiveRisk.totalFlagged : metrics.memberRiskCount,
        rollingChurn3m: metrics.rollingChurn3m ? Number(metrics.rollingChurn3m) : null,
        newMembers: metrics.newMembers,
        cancels: metrics.cancels,
        predictiveRisk,
      }, {
        prev1: toTrend(prev1),
        prev2: toTrend(prev2),
        prev3: toTrend(prev3),
      });

      const atRiskMembers: Array<{
        id: string;
        name: string;
        email: string | null;
        joinDate: string;
        monthlyRate: string;
        tenureDays: number;
        lastContacted: string | null;
        lastAttended: string | null;
        riskCategory: "ghost" | "at-risk" | "drifter";
        riskLabel: string;
        churnProbability: number;
      }> = [];

      if (predictiveData) {
        const activeMembers = await storage.getActiveMembers(req.params.id, lastDayOfMonth);
        const memberMap = new Map(activeMembers.map(m => [m.id, m]));
        const contacts = await storage.getLatestContacts(req.params.id);
        const contactMap = new Map<string, Date>();
        for (const c of contacts) {
          if (c.contactedAt && !contactMap.has(c.memberId)) {
            contactMap.set(c.memberId, c.contactedAt);
          }
        }

        for (const pred of predictiveData.memberPredictions.members) {
          if (pred.engagementClass === "ghost" || pred.engagementClass === "at-risk" || pred.engagementClass === "drifter") {
            const member = memberMap.get(pred.memberId);
            const lastContact = contactMap.get(pred.memberId);
            atRiskMembers.push({
              id: pred.memberId,
              name: pred.name,
              email: pred.email,
              joinDate: member?.joinDate || "",
              monthlyRate: String(pred.monthlyRate),
              tenureDays: pred.tenureDays,
              lastContacted: lastContact?.toISOString() || null,
              lastAttended: member?.lastAttendedDate || null,
              riskCategory: pred.engagementClass as "ghost" | "at-risk" | "drifter",
              riskLabel: pred.riskDrivers[0] || pred.engagementClass,
              churnProbability: pred.churnProbability,
            });
          }
        }

        const classPriority: Record<string, number> = { ghost: 0, "at-risk": 1, drifter: 2 };
        atRiskMembers.sort((a, b) => {
          const pa = classPriority[a.riskCategory] ?? 3;
          const pb = classPriority[b.riskCategory] ?? 3;
          if (pa !== pb) return pa - pb;
          return b.churnProbability - a.churnProbability;
        });
      }

      const prevMetrics = [
        metrics,
        ...(prev1 ? [prev1] : []),
        ...(prev2 ? [prev2] : []),
        ...(prev3 ? [prev3] : []),
      ];

      const forecast = generateForecast(prevMetrics);

      const allMembers = await storage.getMembersByGym(req.params.id);
      const activeMembersList = allMembers.filter(m => m.status === "active");
      const now = new Date();
      let recencySum = 0;
      let recentCount = 0;
      let hasDataCount = 0;

      for (const m of activeMembersList) {
        if (m.lastAttendedDate) {
          hasDataCount++;
          const daysSince = (now.getTime() - new Date(m.lastAttendedDate).getTime()) / 86400000;
          if (daysSince <= 3) recencySum += 100;
          else if (daysSince <= 7) recencySum += 85;
          else if (daysSince <= 14) recencySum += 65;
          else if (daysSince <= 30) recencySum += 35;
          else recencySum += 10;
          if (daysSince <= 14) recentCount++;
        }
      }

      const activePercent = activeMembersList.length > 0 ? Math.round((recentCount / activeMembersList.length) * 100) : 0;
      const avgRecency = hasDataCount > 0 ? recencySum / hasDataCount : 50;
      const coverage = activeMembersList.length > 0 ? (hasDataCount / activeMembersList.length) * 100 : 0;
      const ceiScore = Math.min(Math.round((avgRecency * 0.50) + (activePercent * 0.30) + (coverage * 0.20)), 100);

      const communityEngagement = { score: ceiScore, activePercent };

      res.json({ metrics, reports, atRiskMembers, forecast, communityEngagement });
    } catch (error) {
      console.error("Error fetching report:", error);
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  app.post("/api/gyms/:id/members/:memberId/contact", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });
      const member = await storage.getMemberById(req.params.memberId);
      if (!member || member.gymId !== req.params.id) return res.status(404).json({ message: "Member not found" });

      const contact = await storage.logContact({
        memberId: req.params.memberId,
        gymId: req.params.id,
        note: req.body.note || null,
      });
      res.json(contact);
    } catch (error) {
      console.error("Error logging contact:", error);
      res.status(500).json({ message: "Failed to log contact" });
    }
  });

  app.get("/api/gyms/:id/members/:memberId/detail", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const member = await storage.getMemberById(req.params.memberId);
      if (!member || member.gymId !== req.params.id) return res.status(404).json({ message: "Member not found" });

      const contacts = await storage.getContactsForMember(req.params.memberId);
      const latestContact = contacts.length > 0 ? contacts[0].contactedAt : null;
      const daysSinceContact = latestContact ? Math.floor((Date.now() - new Date(latestContact).getTime()) / (1000 * 60 * 60 * 24)) : null;

      const tenureDays = Math.floor((Date.now() - new Date(member.joinDate + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24));
      const tenureMonths = Math.floor(tenureDays / 30);
      const rate = Number(member.monthlyRate);
      const totalRevenue = Math.round(rate * tenureMonths);

      let churnProbability: number | null = null;
      let engagementClass: string | null = null;
      try {
        const predictive = await generatePredictiveIntelligence(req.params.id);
        const pred = predictive.memberPredictions.members.find((m: any) => m.memberId === req.params.memberId);
        if (pred) {
          churnProbability = pred.churnProbability;
          engagementClass = pred.engagementClass;
        }
      } catch {}

      const riskReasons: string[] = [];
      if (tenureDays <= 60) riskReasons.push("New member (< 60 days)");
      if (daysSinceContact === null) riskReasons.push("Never contacted");
      else if (daysSinceContact > 14) riskReasons.push(`No contact in ${daysSinceContact} days`);
      if (member.lastAttendedDate) {
        const daysSinceAttendance = Math.floor((Date.now() - new Date(member.lastAttendedDate + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceAttendance > 14) riskReasons.push(`Last attended ${daysSinceAttendance} days ago`);
      }

      const risk = churnProbability !== null
        ? (churnProbability >= 0.6 ? "high" : churnProbability >= 0.3 ? "medium" : "low")
        : (tenureDays <= 60 || (daysSinceContact !== null && daysSinceContact > 14) ? "high" : tenureDays <= 120 ? "medium" : "low");

      const isHighValue = rate >= 200;

      res.json({
        ...member,
        tenureDays,
        tenureMonths,
        totalRevenue,
        risk,
        riskReasons,
        daysSinceContact,
        lastContacted: latestContact,
        isHighValue,
        churnProbability,
        engagementClass,
        contacts: contacts.slice(0, 50),
      });
    } catch (error) {
      console.error("Error fetching member detail:", error);
      res.status(500).json({ message: "Failed to fetch member detail" });
    }
  });

  app.put("/api/gyms/:id", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const { name, location } = req.body;
      const updates: any = {};
      if (name && typeof name === "string") updates.name = name.trim();
      if (location !== undefined) updates.location = location?.trim() || null;

      const updated = await storage.updateGym(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      console.error("Error updating gym:", error);
      res.status(500).json({ message: "Failed to update gym" });
    }
  });

  app.get("/api/gyms/:id/staff", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });
      const staffList = await storage.getGymStaff(req.params.id);
      res.json(staffList);
    } catch (error) {
      console.error("Error fetching staff:", error);
      res.status(500).json({ message: "Failed to fetch staff" });
    }
  });

  app.post("/api/gyms/:id/staff", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      const userRole = await getUserGymRole(req, gym);
      if (userRole !== "owner") return res.status(403).json({ message: "Only owners can manage staff" });

      const { userId, role } = z.object({
        userId: z.string().min(1),
        role: z.enum(["owner", "admin", "coach"]),
      }).parse(req.body);

      const existing = await storage.getGymStaffRole(req.params.id, userId);
      if (existing) return res.status(409).json({ message: "User already has access to this gym" });

      const staff = await storage.addGymStaff({ gymId: req.params.id, userId, role });
      res.status(201).json(staff);
    } catch (error: any) {
      console.error("Error adding staff:", error);
      res.status(400).json({ message: error.message || "Failed to add staff" });
    }
  });

  app.patch("/api/gyms/:id/staff/:userId", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      const userRole = await getUserGymRole(req, gym);
      if (userRole !== "owner") return res.status(403).json({ message: "Only owners can manage staff" });

      const { role } = z.object({ role: z.enum(["owner", "admin", "coach"]) }).parse(req.body);

      if (role !== "owner") {
        const currentRole = await storage.getGymStaffRole(req.params.id, req.params.userId);
        if (currentRole === "owner") {
          const allStaff = await storage.getGymStaff(req.params.id);
          const owners = allStaff.filter(s => s.role === "owner");
          if (owners.length <= 1) return res.status(400).json({ message: "Cannot demote the last owner" });
        }
      }

      const updated = await storage.updateGymStaffRole(req.params.id, req.params.userId, role);
      if (!updated) return res.status(404).json({ message: "Staff member not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating staff role:", error);
      res.status(400).json({ message: error.message || "Failed to update staff role" });
    }
  });

  app.delete("/api/gyms/:id/staff/:userId", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      const userRole = await getUserGymRole(req, gym);
      if (userRole !== "owner") return res.status(403).json({ message: "Only owners can manage staff" });

      if (req.params.userId === req.user.claims.sub) {
        const allStaff = await storage.getGymStaff(req.params.id);
        const owners = allStaff.filter(s => s.role === "owner");
        if (owners.length <= 1) return res.status(400).json({ message: "Cannot remove the last owner" });
      }

      await storage.removeGymStaff(req.params.id, req.params.userId);
      res.json({ message: "Staff member removed" });
    } catch (error) {
      console.error("Error removing staff:", error);
      res.status(500).json({ message: "Failed to remove staff" });
    }
  });

  app.get("/api/gyms/:id/export/members", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const membersList = await storage.getMembersByGym(req.params.id);
      const contacts = await storage.getLatestContacts(req.params.id);
      const contactMap = new Map<string, Date>();
      for (const c of contacts) {
        if (c.contactedAt && !contactMap.has(c.memberId)) {
          contactMap.set(c.memberId, c.contactedAt);
        }
      }

      const header = "Name,Email,Status,Join Date,Cancel Date,Monthly Rate,Last Contacted,Last Attended\n";
      const rows = membersList.map(m => {
        const lastContact = contactMap.get(m.id);
        return [
          `"${(m.name || "").replace(/"/g, '""')}"`,
          `"${(m.email || "").replace(/"/g, '""')}"`,
          m.status,
          m.joinDate,
          m.cancelDate || "",
          m.monthlyRate,
          lastContact ? new Date(lastContact).toISOString().slice(0, 10) : "",
          m.lastAttendedDate || "",
        ].join(",");
      }).join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${gym.name.replace(/[^a-zA-Z0-9]/g, '_')}_members_${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(header + rows);
    } catch (error) {
      console.error("Error exporting members:", error);
      res.status(500).json({ message: "Failed to export members" });
    }
  });

  app.get("/api/gyms/:id/export/report", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const monthDate = (req.query.month as string) || new Date().toISOString().slice(0, 7) + "-01";
      const metrics = await storage.getMonthlyMetrics(req.params.id, monthDate);
      if (!metrics) {
        return res.status(404).json({ message: "No metrics for this month" });
      }

      const reports = generateMetricReports(metrics);
      const header = "Metric,Current Value,Target,Trend,What This Means,Why It Matters,What To Do Next\n";
      const rows = reports.map(r => [
        `"${r.metric}"`,
        `"${r.current}"`,
        `"${r.target}"`,
        `"${r.trendDirection} ${r.trendValue}"`,
        `"${(r.meaning || "").replace(/"/g, '""')}"`,
        `"${(r.whyItMatters || "").replace(/"/g, '""')}"`,
        `"${(r.action || "").replace(/"/g, '""')}"`,
      ].join(",")).join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${gym.name.replace(/[^a-zA-Z0-9]/g, '_')}_report_${monthDate.slice(0, 7)}.csv"`);
      res.send(header + rows);
    } catch (error) {
      console.error("Error exporting report:", error);
      res.status(500).json({ message: "Failed to export report" });
    }
  });

  app.get("/api/gyms/:id/alerts", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const alerts: { id: string; type: string; severity: "info" | "warning" | "critical"; title: string; detail: string; timestamp: string }[] = [];
      const now = new Date();

      try {
        const predictive = await generatePredictiveIntelligence(req.params.id);
        const { summary } = predictive.memberPredictions;

        if (summary.classBreakdown["ghost"] > 0) {
          alerts.push({
            id: `ghost-${now.toISOString().slice(0, 10)}`,
            type: "member_risk",
            severity: "critical",
            title: `${summary.classBreakdown["ghost"]} member${summary.classBreakdown["ghost"] > 1 ? "s" : ""} classified as Ghost`,
            detail: "These members show no recent engagement. Immediate outreach is recommended before they cancel.",
            timestamp: now.toISOString(),
          });
        }

        if (summary.classBreakdown["at-risk"] > 0) {
          alerts.push({
            id: `at-risk-${now.toISOString().slice(0, 10)}`,
            type: "member_risk",
            severity: "warning",
            title: `${summary.classBreakdown["at-risk"]} member${summary.classBreakdown["at-risk"] > 1 ? "s" : ""} at risk of churning`,
            detail: `$${summary.totalRevenueAtRisk.toLocaleString()}/mo in revenue at risk. Personal outreach can reverse this trajectory.`,
            timestamp: now.toISOString(),
          });
        }

        if (summary.classBreakdown["drifter"] > 0) {
          alerts.push({
            id: `drifter-${now.toISOString().slice(0, 10)}`,
            type: "member_risk",
            severity: "info",
            title: `${summary.classBreakdown["drifter"]} member${summary.classBreakdown["drifter"] > 1 ? "s" : ""} drifting`,
            detail: "Engagement declining but still recoverable. A check-in or class invitation can re-engage them.",
            timestamp: now.toISOString(),
          });
        }
      } catch {}

      try {
        const allMetrics = await storage.getAllMonthlyMetrics(req.params.id);
        if (allMetrics.length >= 2) {
          const latest = allMetrics[allMetrics.length - 1];
          const prev = allMetrics[allMetrics.length - 2];
          const churnRate = Number(latest.churnRate);
          const prevChurnRate = Number(prev.churnRate);

          if (churnRate > 7) {
            alerts.push({
              id: `churn-high-${now.toISOString().slice(0, 10)}`,
              type: "metric",
              severity: "critical",
              title: `Churn rate at ${churnRate.toFixed(1)}% — above 7% threshold`,
              detail: "Monthly churn is in the danger zone. Every percentage point above 5% compounds into significant annual revenue loss.",
              timestamp: now.toISOString(),
            });
          } else if (churnRate > prevChurnRate + 1) {
            alerts.push({
              id: `churn-spike-${now.toISOString().slice(0, 10)}`,
              type: "metric",
              severity: "warning",
              title: `Churn rate jumped from ${prevChurnRate.toFixed(1)}% to ${churnRate.toFixed(1)}%`,
              detail: "A sudden increase in cancellations. Investigate whether a specific event, pricing change, or seasonal pattern caused this.",
              timestamp: now.toISOString(),
            });
          }

          const rsi = Number(latest.rsi);
          if (rsi < 50) {
            alerts.push({
              id: `rsi-low-${now.toISOString().slice(0, 10)}`,
              type: "metric",
              severity: "warning",
              title: `Retention Stability Index at ${rsi} — below healthy threshold`,
              detail: "Your RSI indicates instability in your member base. Focus on reducing churn and strengthening new member onboarding.",
              timestamp: now.toISOString(),
            });
          }
        }
      } catch {}

      alerts.sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  app.get("/api/gyms/:id/trends/intelligence", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const metrics = await storage.getAllMonthlyMetrics(req.params.id);
      const intelligence = generateTrendIntelligence(metrics);
      res.json(intelligence);
    } catch (error) {
      console.error("Error generating trend intelligence:", error);
      res.status(500).json({ message: "Failed to generate trend intelligence" });
    }
  });

  app.get("/api/gyms/:id/predictive", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const intelligence = await generatePredictiveIntelligence(req.params.id);
      const periodStart = getPeriodStart();
      const baselineForecast = {
        baselineMembers: intelligence.memberPredictions.members.length,
        baselineMrr: intelligence.strategicBrief.revenueComparison.currentMrr,
        baselineChurn: intelligence.memberPredictions.summary.avgChurnProbability,
      };

      await ensureRecommendationCards(
        req.params.id,
        periodStart,
        intelligence.strategicBrief.recommendations.map((recommendation) => ({
          interventionType: recommendation.interventionType,
          headline: recommendation.headline,
          executionChecklist: recommendation.executionChecklist,
        })),
        baselineForecast,
      );

      await runLearningUpdate(req.params.id);
      const recommendationExecution = await getRecommendationExecutionState(req.params.id, periodStart);
      res.json({ ...intelligence, recommendationExecution, periodStart });
    } catch (error) {
      console.error("Error generating predictive intelligence:", error);
      res.status(500).json({ message: "Failed to generate predictive intelligence" });
    }
  });


  app.get("/api/gyms/:id/recommendations/execution", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const periodStart = typeof req.query.periodStart === "string" ? req.query.periodStart : getPeriodStart();
      const cards = await getRecommendationExecutionState(req.params.id, periodStart);
      res.json({ cards, periodStart });
    } catch (error) {
      console.error("Error fetching recommendation execution state:", error);
      res.status(500).json({ message: "Failed to fetch recommendation execution state" });
    }
  });

  app.post("/api/gyms/:id/recommendations/:recommendationId/checklist/:itemId", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      await toggleChecklistItem(req.params.id, req.params.recommendationId, req.params.itemId, Boolean(req.body.checked), req.body.note);
      const cards = await getRecommendationExecutionState(req.params.id, typeof req.body.periodStart === "string" ? req.body.periodStart : getPeriodStart());
      res.json({ cards });
    } catch (error: any) {
      console.error("Error updating checklist item:", error);
      res.status(400).json({ message: error.message || "Failed to update checklist item" });
    }
  });

  app.post("/api/gyms/:id/recommendations/actions", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const text = String(req.body.text || "").trim();
      if (!text) return res.status(400).json({ message: "Action text is required" });

      const periodStart = typeof req.body.periodStart === "string" ? req.body.periodStart : getPeriodStart();
      const action = await logOwnerAction(req.params.id, periodStart, text);
      res.status(201).json(action);
    } catch (error) {
      console.error("Error logging owner action:", error);
      res.status(500).json({ message: "Failed to log action" });
    }
  });

  app.get("/api/gyms/:id/recommendations/actions", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const actions = await getOwnerActions(req.params.id, limit, offset);
      res.json(actions);
    } catch (error) {
      console.error("Error fetching owner actions:", error);
      res.status(500).json({ message: "Failed to fetch actions" });
    }
  });

  app.post("/api/gyms/:id/recompute", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      await recomputeAllMetrics(req.params.id);
      res.json({ message: "Metrics recomputed" });
    } catch (error) {
      console.error("Error recomputing metrics:", error);
      res.status(500).json({ message: "Failed to recompute metrics" });
    }
  });

  app.post("/api/gyms/:id/wodify/test", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const { apiKey } = req.body;
      if (!apiKey || typeof apiKey !== "string") {
        return res.status(400).json({ message: "API key is required" });
      }

      const result = await testWodifyConnection(apiKey);
      res.json(result);
    } catch (error: any) {
      console.error("Error testing Wodify connection:", error);
      res.status(500).json({ message: "Failed to test connection" });
    }
  });

  app.post("/api/gyms/:id/wodify/connect", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const { apiKey, locationName, programName } = req.body;
      if (!apiKey || typeof apiKey !== "string") {
        return res.status(400).json({ message: "API key is required" });
      }

      const testResult = await testWodifyConnection(apiKey);
      if (!testResult.success) {
        return res.status(400).json({ message: `Connection failed: ${testResult.message}` });
      }

      const encrypted = encryptApiKey(apiKey);
      const fingerprint = generateFingerprint(apiKey);

      const connection = await storage.upsertWodifyConnection({
        gymId: req.params.id,
        status: "connected",
        apiKeyEncrypted: encrypted,
        apiKeyFingerprint: fingerprint,
        wodifyLocationName: locationName || null,
        wodifyProgramName: programName || null,
        syncWindowDays: 90,
      });

      res.json({
        id: connection.id,
        status: connection.status,
        apiKeyFingerprint: connection.apiKeyFingerprint,
        wodifyLocationName: connection.wodifyLocationName,
        connectedAt: connection.connectedAt,
        message: testResult.message,
      });
    } catch (error: any) {
      console.error("Error connecting Wodify:", error);
      res.status(500).json({ message: "Failed to connect Wodify" });
    }
  });

  app.delete("/api/gyms/:id/wodify/disconnect", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      await storage.deleteWodifyConnection(req.params.id);
      res.json({ message: "Wodify disconnected successfully" });
    } catch (error: any) {
      console.error("Error disconnecting Wodify:", error);
      res.status(500).json({ message: "Failed to disconnect Wodify" });
    }
  });

  app.get("/api/gyms/:id/wodify/status", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const connection = await storage.getWodifyConnection(req.params.id);
      if (!connection) {
        return res.json({ connected: false, status: "disconnected" });
      }

      const recentSyncRuns = await storage.getWodifySyncRuns(req.params.id, 5);

      res.json({
        connected: connection.status === "connected",
        status: connection.status,
        apiKeyFingerprint: connection.apiKeyFingerprint,
        wodifyLocationName: connection.wodifyLocationName,
        wodifyProgramName: connection.wodifyProgramName,
        connectedAt: connection.connectedAt,
        lastSuccessAt: connection.lastSuccessAt,
        lastErrorAt: connection.lastErrorAt,
        lastErrorMessage: connection.lastErrorMessage,
        lastCursorAt: connection.lastCursorAt,
        recentSyncRuns,
      });
    } catch (error: any) {
      console.error("Error fetching Wodify status:", error);
      res.status(500).json({ message: "Failed to fetch Wodify status" });
    }
  });

  app.post("/api/gyms/:id/wodify/sync", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const runType = req.body?.runType === "backfill" ? "backfill" : "incremental";

      res.json({ message: "Sync started", status: "running" });

      runWodifySync(req.params.id, runType).catch((err) =>
        console.error(`[Wodify] Background sync error for gym ${req.params.id}:`, err)
      );
    } catch (error: any) {
      console.error("Error triggering Wodify sync:", error);
      res.status(500).json({ message: "Failed to trigger sync" });
    }
  });

  app.get("/api/gyms/:id/wodify/sync-history", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const syncRuns = await storage.getWodifySyncRuns(req.params.id, limit);
      res.json(syncRuns);
    } catch (error: any) {
      console.error("Error fetching sync history:", error);
      res.status(500).json({ message: "Failed to fetch sync history" });
    }
  });

  app.get("/api/knowledge/sources", isAuthenticated, async (req: any, res) => {
    try {
      const userId = isDemoUser(req) ? DEMO_USER_ID : req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const gyms = isDemoUser(req) ? [await storage.getGym(DEMO_GYM_ID)] : await storage.getGymsForUser(userId);
      if (!gyms || gyms.length === 0) return res.json([]);
      const sources = await storage.getKnowledgeSources();
      res.json(sources);
    } catch (error) {
      console.error("Error fetching knowledge sources:", error);
      res.status(500).json({ message: "Failed to fetch sources" });
    }
  });

  app.post("/api/knowledge/sources", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const gyms = await storage.getGymsForUser(userId);
      if (!gyms || gyms.length === 0) return res.status(403).json({ message: "Forbidden" });
      const parsed = insertKnowledgeSourceSchema.parse(req.body);
      const source = await storage.createKnowledgeSource(parsed);
      res.status(201).json(source);
    } catch (error: any) {
      console.error("Error creating knowledge source:", error);
      res.status(400).json({ message: error.message || "Invalid data" });
    }
  });

  app.delete("/api/knowledge/sources/:id", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const gyms = await storage.getGymsForUser(userId);
      if (!gyms || gyms.length === 0) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteKnowledgeSource(req.params.id);
      res.json({ message: "Source deleted" });
    } catch (error) {
      console.error("Error deleting knowledge source:", error);
      res.status(500).json({ message: "Failed to delete source" });
    }
  });

  app.post("/api/knowledge/sources/:id/ingest", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const gyms = await storage.getGymsForUser(userId);
      if (!gyms || gyms.length === 0) return res.status(403).json({ message: "Forbidden" });
      const source = await storage.getKnowledgeSource(req.params.id);
      if (!source) return res.status(404).json({ message: "Source not found" });

      res.json({ message: "Ingestion started", sourceId: req.params.id });

      ingestSource(req.params.id).catch(err =>
        console.error("Background ingestion failed:", err)
      );
    } catch (error) {
      console.error("Error starting ingestion:", error);
      res.status(500).json({ message: "Failed to start ingestion" });
    }
  });

  app.get("/api/knowledge/sources/:id/documents", isAuthenticated, async (req: any, res) => {
    try {
      const docs = await storage.getKnowledgeDocuments(req.params.id);
      res.json(docs.map(d => ({
        id: d.id,
        title: d.title,
        url: d.url,
        status: d.status,
        chunkCount: d.chunkCount,
        channelName: d.channelName,
        durationSeconds: d.durationSeconds,
        ingestedAt: d.ingestedAt,
      })));
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get("/api/knowledge/documents/:id/chunks", isAuthenticated, async (req: any, res) => {
    try {
      const chunks = await storage.getKnowledgeChunks(req.params.id);
      res.json(chunks.map(c => ({
        id: c.id,
        chunkIndex: c.chunkIndex,
        content: c.content,
        taxonomy: c.taxonomy,
        tokenCount: c.tokenCount,
        hasEmbedding: c.embedding !== null,
      })));
    } catch (error) {
      console.error("Error fetching chunks:", error);
      res.status(500).json({ message: "Failed to fetch chunks" });
    }
  });

  app.get("/api/knowledge/stats", isAuthenticated, async (_req: any, res) => {
    try {
      const stats = await storage.getKnowledgeStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching knowledge stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.post("/api/knowledge/search", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const { query, tags, limit } = req.body;
      if (!query || typeof query !== "string") {
        return res.status(400).json({ message: "Query is required" });
      }
      const results = await searchKnowledge(query, tags || [], limit || 10);
      res.json(results);
    } catch (error) {
      console.error("Error searching knowledge:", error);
      res.status(500).json({ message: "Failed to search knowledge" });
    }
  });

  app.get("/api/knowledge/taxonomy", isAuthenticated, async (_req: any, res) => {
    res.json(TAXONOMY_TAGS);
  });

  app.post("/api/knowledge/seed", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const gyms = await storage.getGymsForUser(userId);
      if (!gyms || gyms.length === 0) return res.status(403).json({ message: "Forbidden" });
      res.json({ message: "Seeding started" });
      seedKnowledgeBase().then(result => {
        console.log("[SEED] Result:", JSON.stringify(result));
      }).catch(err => {
        console.error("[SEED] Failed:", err);
      });
    } catch (error) {
      console.error("Error starting seed:", error);
      res.status(500).json({ message: "Failed to start seed" });
    }
  });

  app.get("/api/knowledge/ingest-jobs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = isDemoUser(req) ? DEMO_USER_ID : req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const gyms = isDemoUser(req) ? [await storage.getGym(DEMO_GYM_ID)] : await storage.getGymsForUser(userId);
      if (!gyms || gyms.length === 0) return res.json([]);
      const sourceId = typeof req.query.sourceId === "string" ? req.query.sourceId : undefined;
      const jobs = await storage.getIngestJobs(sourceId);
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching ingest jobs:", error);
      res.status(500).json({ message: "Failed to fetch ingest jobs" });
    }
  });

  app.get("/api/gyms/:id/knowledge/audits", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const periodStart = typeof req.query.periodStart === "string" ? req.query.periodStart : getPeriodStart();
      const audits = await storage.getRecommendationAudits(req.params.id, periodStart);
      res.json(audits);
    } catch (error) {
      console.error("Error fetching recommendation audits:", error);
      res.status(500).json({ message: "Failed to fetch audits" });
    }
  });

  function parseDateRange(req: any): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
    const now = new Date();
    let start: Date;
    let end = new Date(req.query.end || now.toISOString());
    if (req.query.start) {
      start = new Date(req.query.start);
    } else {
      start = new Date(end);
      start.setDate(start.getDate() - 30);
    }
    const duration = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - duration);
    return { start, end, prevStart, prevEnd };
  }

  initSalesCache(storage);

  app.get("/api/gyms/:id/sales-intelligence/recalc-status", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });
      res.json(getRecalcStatus());
    } catch (error) {
      res.status(500).json({ message: "Failed to get recalc status" });
    }
  });

  app.get("/api/gyms/:id/sales-intelligence/summary", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const { start, end, prevStart, prevEnd } = parseDateRange(req);

      const cached = getCachedSummary(req.params.id, start.toISOString(), end.toISOString());
      if (cached) {
        return res.json(cached);
      }

      const [leadsArr, consultsArr, membershipsArr, paymentsArr, prevLeads, prevConsults, prevMemberships, prevPayments] = await Promise.all([
        storage.getLeadsByGym(req.params.id, start, end),
        storage.getConsultsByGym(req.params.id, start, end),
        storage.getSalesMembershipsByGym(req.params.id, start, end),
        storage.getPaymentsByGym(req.params.id, start, end),
        storage.getLeadsByGym(req.params.id, prevStart, prevEnd),
        storage.getConsultsByGym(req.params.id, prevStart, prevEnd),
        storage.getSalesMembershipsByGym(req.params.id, prevStart, prevEnd),
        storage.getPaymentsByGym(req.params.id, prevStart, prevEnd),
      ]);

      const summary = computeSalesSummary(leadsArr, consultsArr, membershipsArr, paymentsArr, prevLeads, prevConsults, prevMemberships, prevPayments);
      setCachedSummary(req.params.id, start.toISOString(), end.toISOString(), summary);
      res.json(summary);
    } catch (error) {
      console.error("Error computing sales summary:", error);
      res.status(500).json({ message: "Failed to compute sales summary" });
    }
  });

  app.get("/api/gyms/:id/sales-intelligence/trends", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const { start, end } = parseDateRange(req);
      const bucket = req.query.bucket === "weekly" ? "weekly" : "daily" as const;
      const [leadsArr, membershipsArr] = await Promise.all([
        storage.getLeadsByGym(req.params.id, start, end),
        storage.getSalesMembershipsByGym(req.params.id, start, end),
      ]);

      const trends = computeTrends(leadsArr, membershipsArr, bucket);
      res.json(trends);
    } catch (error) {
      console.error("Error computing sales trends:", error);
      res.status(500).json({ message: "Failed to compute sales trends" });
    }
  });

  app.get("/api/gyms/:id/sales-intelligence/by-source", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const { start, end } = parseDateRange(req);
      const [leadsArr, membershipsArr] = await Promise.all([
        storage.getLeadsByGym(req.params.id, start, end),
        storage.getSalesMembershipsByGym(req.params.id, start, end),
      ]);

      const bySource = computeBySource(leadsArr, membershipsArr);
      res.json(bySource);
    } catch (error) {
      console.error("Error computing source breakdown:", error);
      res.status(500).json({ message: "Failed to compute source breakdown" });
    }
  });

  app.get("/api/gyms/:id/sales-intelligence/by-coach", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const { start, end } = parseDateRange(req);
      const [consultsArr, membershipsArr] = await Promise.all([
        storage.getConsultsByGym(req.params.id, start, end),
        storage.getSalesMembershipsByGym(req.params.id, start, end),
      ]);

      const byCoach = computeByCoach(consultsArr, membershipsArr);
      res.json(byCoach);
    } catch (error) {
      console.error("Error computing coach breakdown:", error);
      res.status(500).json({ message: "Failed to compute coach breakdown" });
    }
  });

  app.get("/api/gyms/:id/sales-intelligence/stale-leads", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const threshold = parseInt(req.query.threshold as string) || 7;
      const allLeads = await storage.getLeadsByGymAllTime(req.params.id);
      const allConsults = await storage.getConsultsByGymAllTime(req.params.id);

      const aging = computeLeadAging(allLeads, allConsults, threshold);
      res.json(aging);
    } catch (error) {
      console.error("Error computing stale leads:", error);
      res.status(500).json({ message: "Failed to compute stale leads" });
    }
  });

  app.patch("/api/gyms/:id/leads/:leadId/follow-up", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const lead = await storage.getLeadById(req.params.leadId);
      if (!lead || lead.gymId !== req.params.id) return res.status(404).json({ message: "Lead not found" });

      const { lastContactAt, nextActionDate, followUpNotes } = req.body;
      if (lastContactAt !== undefined && lastContactAt !== null && isNaN(new Date(lastContactAt).getTime())) {
        return res.status(400).json({ message: "Invalid lastContactAt date" });
      }
      if (nextActionDate !== undefined && nextActionDate !== null && isNaN(new Date(nextActionDate).getTime())) {
        return res.status(400).json({ message: "Invalid nextActionDate date" });
      }
      if (followUpNotes !== undefined && followUpNotes !== null && typeof followUpNotes !== "string") {
        return res.status(400).json({ message: "followUpNotes must be a string" });
      }
      if (typeof followUpNotes === "string" && followUpNotes.length > 1000) {
        return res.status(400).json({ message: "followUpNotes must be 1000 characters or less" });
      }

      const updates: Record<string, any> = {};
      if (lastContactAt !== undefined) updates.lastContactAt = lastContactAt ? new Date(lastContactAt) : null;
      if (nextActionDate !== undefined) updates.nextActionDate = nextActionDate ? new Date(nextActionDate) : null;
      if (followUpNotes !== undefined) updates.followUpNotes = followUpNotes;

      const updatedLead = await storage.updateLead(req.params.leadId, updates);
      invalidateGymCache(req.params.id);
      res.json(updatedLead);
    } catch (error) {
      console.error("Error updating follow-up:", error);
      res.status(500).json({ message: "Failed to update follow-up" });
    }
  });

  app.post("/api/gyms/:id/leads", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const data = insertLeadSchema.parse({ ...req.body, gymId: req.params.id });
      const lead = await storage.createLead(data);
      invalidateGymCache(req.params.id);
      res.json(lead);
    } catch (error) {
      console.error("Error creating lead:", error);
      res.status(500).json({ message: "Failed to create lead" });
    }
  });

  app.post("/api/gyms/:id/consults", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const data = insertConsultSchema.parse({ ...req.body, gymId: req.params.id });
      const consult = await storage.createConsult(data);
      res.json(consult);
    } catch (error) {
      console.error("Error creating consult:", error);
      res.status(500).json({ message: "Failed to create consult" });
    }
  });

  app.post("/api/gyms/:id/sales-memberships", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const data = insertSalesMembershipSchema.parse({ ...req.body, gymId: req.params.id });
      const membership = await storage.createSalesMembership(data);
      res.json(membership);
    } catch (error) {
      console.error("Error creating sales membership:", error);
      res.status(500).json({ message: "Failed to create sales membership" });
    }
  });

  app.get("/api/gyms/:id/leads", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const leads = await storage.getLeadsByGymAllTime(req.params.id);
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.get("/api/gyms/:id/leads/:leadId", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const lead = await storage.getLeadById(req.params.leadId);
      if (!lead || lead.gymId !== req.params.id) return res.status(404).json({ message: "Lead not found" });
      res.json(lead);
    } catch (error) {
      console.error("Error fetching lead:", error);
      res.status(500).json({ message: "Failed to fetch lead" });
    }
  });

  app.put("/api/gyms/:id/leads/:leadId", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const lead = await storage.getLeadById(req.params.leadId);
      if (!lead || lead.gymId !== req.params.id) return res.status(404).json({ message: "Lead not found" });

      const allowedFields = ["name", "email", "phone", "coachId", "notes", "source"];
      const updates: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }

      const updated = await storage.updateLead(req.params.leadId, updates);
      res.json(updated);
    } catch (error) {
      console.error("Error updating lead:", error);
      res.status(500).json({ message: "Failed to update lead" });
    }
  });

  app.put("/api/gyms/:id/leads/:leadId/stage", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const lead = await storage.getLeadById(req.params.leadId);
      if (!lead || lead.gymId !== req.params.id) return res.status(404).json({ message: "Lead not found" });

      const { stage } = req.body;
      const validStages = ["new", "booked", "showed", "won", "lost"];
      if (!validStages.includes(stage)) {
        return res.status(400).json({ message: `Invalid stage. Must be one of: ${validStages.join(", ")}` });
      }

      if (lead.status === "won" || lead.status === "lost") {
        return res.status(400).json({ message: `Cannot transition from terminal stage "${lead.status}"` });
      }

      const validTransitions: Record<string, string[]> = {
        new: ["booked", "lost"],
        booked: ["showed", "lost"],
        showed: ["won", "lost"],
      };

      const allowed = validTransitions[lead.status] || [];
      if (!allowed.includes(stage)) {
        return res.status(400).json({ message: `Cannot transition from "${lead.status}" to "${stage}". Valid transitions: ${allowed.join(", ")}` });
      }

      const updates: Record<string, any> = { status: stage };

      if (stage === "booked") {
        const { consultDate } = req.body;
        if (!consultDate) {
          return res.status(400).json({ message: "consultDate is required when booking" });
        }
        updates.bookedAt = new Date();
        updates.consultDate = new Date(consultDate);

        await storage.createConsult({
          gymId: req.params.id,
          leadId: lead.id,
          bookedAt: new Date(),
          scheduledFor: new Date(consultDate),
          coachId: lead.coachId || undefined,
        });
      }

      if (stage === "showed") {
        updates.showedAt = new Date();

        const allConsults = await storage.getConsultsByGym(req.params.id, new Date(0), new Date());
        const leadConsult = allConsults.find(c => c.leadId === lead.id && !c.showedAt);
        if (leadConsult) {
          await storage.updateConsult(leadConsult.id, { showedAt: new Date() });
        }
      }

      if (stage === "won") {
        const { salePrice } = req.body;
        if (!salePrice || Number(salePrice) <= 0) {
          return res.status(400).json({ message: "salePrice must be a positive number" });
        }
        updates.wonAt = new Date();
        updates.salePrice = String(salePrice);

        const membership = await storage.createSalesMembership({
          gymId: req.params.id,
          leadId: lead.id,
          startedAt: new Date(),
          priceMonthly: String(salePrice),
          status: "active",
        });

        await storage.createPayment({
          gymId: req.params.id,
          membershipId: membership.id,
          amount: String(salePrice),
          paidAt: new Date(),
        });
      }

      if (stage === "lost") {
        const { lostReason } = req.body;
        const validReasons = ["price", "not_ready", "no_show", "chose_competitor", "other"];
        if (!lostReason || !validReasons.includes(lostReason)) {
          return res.status(400).json({ message: `lostReason is required and must be one of: ${validReasons.join(", ")}` });
        }
        updates.lostAt = new Date();
        updates.lostReason = lostReason;
      }

      const updated = await storage.updateLead(req.params.leadId, updates);
      invalidateGymCache(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error transitioning lead stage:", error);
      res.status(500).json({ message: "Failed to transition lead stage" });
    }
  });

  app.post("/api/gyms/:id/leads/import/preview", isAuthenticated, demoReadOnlyGuard, upload.single("file"), async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const csvText = req.file.buffer.toString("utf-8");
      const fileHash = computeLeadFileHash(csvText);

      let customMapping: Partial<LeadColumnMapping> | undefined;
      if (req.body.mapping) {
        try { customMapping = JSON.parse(req.body.mapping); } catch {}
      }

      let stageMapping: Record<string, string> | undefined;
      if (req.body.stageMapping) {
        try { stageMapping = JSON.parse(req.body.stageMapping); } catch {}
      }

      const preview = previewLeadCsv(csvText, customMapping, stageMapping);

      const existingJobs = await storage.getImportJobsByGym(req.params.id);
      const duplicateJob = existingJobs.find(j => j.fileHash === fileHash && j.status === "completed");

      res.json({
        ...preview,
        fileHash,
        isDuplicate: !!duplicateJob,
        duplicateJobId: duplicateJob?.id || null,
        duplicateDate: duplicateJob?.completedAt || null,
      });
    } catch (error: any) {
      console.error("Error previewing lead CSV:", error);
      res.status(500).json({ message: error.message || "Failed to preview CSV" });
    }
  });

  app.post("/api/gyms/:id/leads/import/commit", isAuthenticated, demoReadOnlyGuard, upload.single("file"), async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const csvText = req.file.buffer.toString("utf-8");
      const fileHash = computeLeadFileHash(csvText);

      let mapping: LeadColumnMapping;
      try { mapping = JSON.parse(req.body.mapping); } catch {
        return res.status(400).json({ message: "Invalid column mapping" });
      }

      let stageMapping: Record<string, string> | undefined;
      if (req.body.stageMapping) {
        try { stageMapping = JSON.parse(req.body.stageMapping); } catch {}
      }

      const duplicateMode = req.body.duplicateMode || "skip";

      const job = await storage.createImportJob({
        gymId: req.params.id,
        uploadedBy: req.user?.claims?.sub || "unknown",
        filename: req.file.originalname || "leads.csv",
        fileHash,
        rawCsv: csvText.slice(0, 50000),
        columnMapping: JSON.stringify(mapping),
        status: "processing",
        type: "leads",
        stageMapping: stageMapping || null,
      });

      const { leads: parsedLeads, errors, totalRows, validRows, errorRows } = parseAllLeadRows(csvText, mapping, stageMapping);

      const existingLeads = await storage.getLeadsByGymAllTime(req.params.id);

      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      const importErrors: any[] = [];
      const BATCH_SIZE = 100;
      const seenInFile = new Set<string>();

      function matchesLead(parsed: any, existing: { email: string | null; name: string | null; createdAt: Date | string; consultDate?: Date | string | null }) {
        const existingDate = new Date(existing.createdAt).toISOString().slice(0, 10);
        const existingConsultDate = existing.consultDate ? new Date(existing.consultDate).toISOString().slice(0, 10) : null;

        if (parsed.email && existing.email && parsed.email === existing.email) {
          if (existingDate === parsed.createdDate) return true;
          if (parsed.consultDate && existingConsultDate && parsed.consultDate === existingConsultDate) return true;
        }
        if (parsed.name && existing.name && parsed.name.toLowerCase() === existing.name.toLowerCase()) {
          if (existingDate === parsed.createdDate) return true;
          if (parsed.consultDate && existingConsultDate && parsed.consultDate === existingConsultDate) return true;
        }
        return false;
      }

      for (let batch = 0; batch < parsedLeads.length; batch += BATCH_SIZE) {
        const chunk = parsedLeads.slice(batch, batch + BATCH_SIZE);

        for (const parsed of chunk) {
          try {
            const fileKey = `${(parsed.email || "").toLowerCase()}|${(parsed.name || "").toLowerCase()}|${parsed.createdDate}`;
            if (seenInFile.has(fileKey)) {
              skippedCount++;
              continue;
            }
            seenInFile.add(fileKey);

            const existingMatch = existingLeads.find(existing => matchesLead(parsed, existing));
            const isDuplicate = !!existingMatch;

            if (isDuplicate && duplicateMode === "skip") {
              skippedCount++;
              continue;
            }

            if (isDuplicate && duplicateMode === "update" && existingMatch) {
              const updates: Record<string, any> = { status: parsed.stage, source: parsed.source };
              if (parsed.name) updates.name = parsed.name;
              if (parsed.email) updates.email = parsed.email;
              if (parsed.phone) updates.phone = parsed.phone;
              if (parsed.coachId) updates.coachId = parsed.coachId;
              if (parsed.notes) updates.notes = parsed.notes;
              if (parsed.salePrice) updates.salePrice = parsed.salePrice;
              if (parsed.lostReason) updates.lostReason = parsed.lostReason;
              if (parsed.consultDate) {
                updates.consultDate = new Date(parsed.consultDate);
                updates.bookedAt = new Date(parsed.consultDate);
              }
              if (parsed.stage === "showed" || parsed.stage === "won") {
                updates.showedAt = parsed.consultDate ? new Date(parsed.consultDate) : new Date(parsed.createdDate);
              }
              if (parsed.stage === "won") {
                updates.wonAt = parsed.saleDate ? new Date(parsed.saleDate) : new Date();
                updates.salePrice = parsed.salePrice || "0";
              }
              if (parsed.stage === "lost") {
                updates.lostAt = new Date();
                updates.lostReason = parsed.lostReason || "other";
              }
              await storage.updateLead(existingMatch.id, updates);
              updatedCount++;
              continue;
            }

            const createdAt = new Date(parsed.createdDate);
            const leadData: any = {
              gymId: req.params.id,
              name: parsed.name,
              email: parsed.email,
              phone: parsed.phone,
              source: parsed.source,
              status: parsed.stage,
              coachId: parsed.coachId,
              notes: parsed.notes,
              createdAt,
            };

            if (["booked", "showed", "won"].includes(parsed.stage)) {
              leadData.bookedAt = parsed.consultDate ? new Date(parsed.consultDate) : new Date(createdAt.getTime() + 86400000);
              leadData.consultDate = parsed.consultDate ? new Date(parsed.consultDate) : new Date(createdAt.getTime() + 3 * 86400000);
            }
            if (["showed", "won"].includes(parsed.stage)) {
              leadData.showedAt = parsed.consultDate ? new Date(parsed.consultDate) : new Date(createdAt.getTime() + 3 * 86400000);
            }
            if (parsed.stage === "won") {
              leadData.wonAt = parsed.saleDate ? new Date(parsed.saleDate) : new Date(createdAt.getTime() + 4 * 86400000);
              leadData.salePrice = parsed.salePrice || "0";
            }
            if (parsed.stage === "lost") {
              leadData.lostAt = new Date(createdAt.getTime() + 5 * 86400000);
              leadData.lostReason = parsed.lostReason || "other";
            }

            const lead = await storage.createLead(leadData);

            if (["booked", "showed", "won"].includes(parsed.stage)) {
              const consultData: any = {
                gymId: req.params.id,
                leadId: lead.id,
                bookedAt: leadData.bookedAt,
                scheduledFor: leadData.consultDate,
                coachId: parsed.coachId || undefined,
              };
              if (["showed", "won"].includes(parsed.stage)) {
                consultData.showedAt = leadData.showedAt;
              }
              await storage.createConsult(consultData);
            }

            if (parsed.stage === "won" && parsed.salePrice) {
              const membership = await storage.createSalesMembership({
                gymId: req.params.id,
                leadId: lead.id,
                startedAt: leadData.wonAt,
                priceMonthly: parsed.salePrice,
                status: "active",
              });
              await storage.createPayment({
                gymId: req.params.id,
                membershipId: membership.id,
                amount: parsed.salePrice,
                paidAt: leadData.wonAt,
              });
            }

            importedCount++;
          } catch (rowErr: any) {
            importErrors.push({ message: rowErr.message, lead: parsed.name || parsed.email || "unknown" });
          }
        }
      }

      await storage.updateImportJob(job.id, {
        status: "completed",
        totalRows,
        importedCount,
        updatedCount,
        skippedCount,
        errorCount: errorRows + importErrors.length,
        errors: JSON.stringify([...errors.slice(0, 100), ...importErrors.slice(0, 100)]),
        completedAt: new Date(),
      });

      invalidateGymCache(req.params.id);

      res.json({
        jobId: job.id,
        imported: importedCount,
        updated: updatedCount,
        skipped: skippedCount,
        errorCount: errorRows + importErrors.length,
        errors: [...errors.slice(0, 50), ...importErrors.slice(0, 50)],
        totalRows,
        validRows,
      });
    } catch (error: any) {
      console.error("Error committing lead import:", error);
      res.status(500).json({ message: error.message || "Failed to import leads" });
    }
  });

  app.get("/api/gyms/:id/leads/imports", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const allJobs = await storage.getImportJobsByGym(req.params.id);
      const leadJobs = allJobs.filter(j => j.type === "leads");
      res.json(leadJobs.map(j => ({
        id: j.id,
        filename: j.filename,
        status: j.status,
        totalRows: j.totalRows,
        importedCount: j.importedCount,
        updatedCount: j.updatedCount,
        skippedCount: j.skippedCount,
        errorCount: j.errorCount,
        createdAt: j.createdAt,
        completedAt: j.completedAt,
        uploadedBy: j.uploadedBy,
      })));
    } catch (error) {
      console.error("Error fetching lead import history:", error);
      res.status(500).json({ message: "Failed to fetch import history" });
    }
  });

  app.get("/api/gyms/:id/leads/imports/:jobId", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const allJobs = await storage.getImportJobsByGym(req.params.id);
      const job = allJobs.find(j => j.id === req.params.jobId);
      if (!job) return res.status(404).json({ message: "Import job not found" });

      res.json({
        ...job,
        errors: job.errors ? JSON.parse(job.errors) : [],
      });
    } catch (error) {
      console.error("Error fetching import job:", error);
      res.status(500).json({ message: "Failed to fetch import job" });
    }
  });

  app.get("/api/gyms/:id/operator/context", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const staffRole = await getUserGymRole(req, gym);
      const role = getOperatorRole(staffRole || "coach");
      const pill = (req.query.pill as string) || "owner";
      const validPill = OPERATOR_PILLS.includes(pill as any) ? pill as OperatorPill : "owner" as OperatorPill;

      const ctx = await buildTieredContext(gym.id, validPill);

      res.json({
        role,
        canGenerate: canGenerate(role),
        canViewHistory: canViewHistory(role),
        metrics: {
          activeMembers: ctx.gymProfile.activeMembers,
          churnRate: ctx.financialSignals.churnRate ?? null,
          mrr: ctx.financialSignals.mrr ?? null,
          rsi: ctx.retentionSignals.rsi ?? null,
          avgLtv: ctx.financialSignals.ltv ?? null,
          newLeads: ctx.salesSignals.newLeads ?? 0,
          conversionRate: ctx.salesSignals.conversionRate !== undefined ? Math.round(ctx.salesSignals.conversionRate * 100) : 0,
        },
        gymArchetype: ctx.gymArchetype,
        dataCompletenessScore: ctx.dataCompletenessScore,
      });
    } catch (error) {
      console.error("Error fetching operator context:", error);
      res.status(500).json({ message: "Failed to fetch operator context" });
    }
  });

  app.post("/api/gyms/:id/operator/generate", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const staffRole = await getUserGymRole(req, gym);
      const role = getOperatorRole(staffRole || "coach");
      if (!canGenerate(role)) {
        return res.status(403).json({ message: "Your role does not allow generation" });
      }

      const userId = req.user.claims.sub;

      const rateLimitResult = checkRateLimit(userId, gym.id);
      if (!rateLimitResult.allowed) {
        const retryAfterSec = rateLimitResult.retryAfterMs ? Math.ceil(rateLimitResult.retryAfterMs / 1000) : 60;
        return res.status(429).json({
          message: rateLimitResult.reason || "Rate limit exceeded",
          retryAfterSeconds: retryAfterSec,
        });
      }

      const { pill, taskType } = req.body;
      if (!pill || !OPERATOR_PILLS.includes(pill)) {
        return res.status(400).json({ message: "Invalid pill. Must be one of: " + OPERATOR_PILLS.join(", ") });
      }
      if (!taskType || !OPERATOR_TASK_TYPES.includes(taskType)) {
        return res.status(400).json({ message: "Invalid task type. Must be one of: " + OPERATOR_TASK_TYPES.join(", ") });
      }

      const result = await generateOperatorOutput(gym.id, pill as OperatorPill, taskType as OperatorTaskType);

      recordGeneration(userId, gym.id);

      console.log(`[operator] Generation complete: gym=${gym.id}, user=${userId}, pill=${pill}, task=${taskType}, model=${result.model}, confidence=${result.confidenceScore}, stub=${result.usedStub}`);

      const legacyMetrics = {
        activeMembers: result.context.gymProfile.activeMembers,
        churnRate: result.context.financialSignals.churnRate,
        mrr: result.context.financialSignals.mrr,
        rsi: result.context.retentionSignals.rsi,
        avgLtv: result.context.financialSignals.ltv,
        newLeads: result.context.salesSignals.newLeads,
        conversionRate: result.context.salesSignals.conversionRate !== undefined ? Math.round(result.context.salesSignals.conversionRate * 100) : undefined,
      };

      const run = await storage.createAiOperatorRun({
        gymId: gym.id,
        createdByUserId: userId,
        pill,
        taskType,
        inputSummaryJson: buildInputSummary(pill as OperatorPill, taskType as OperatorTaskType, legacyMetrics),
        outputJson: result.outputs,
        status: "draft",
        error: null,
        llmModel: result.model,
        contextSnapshotJson: result.context,
        retryCount: result.retryCount,
        validationPassed: result.validationPassed,
        promptVersion: result.promptVersion,
        doctrineVersion: result.doctrineVersion,
        reasoningSummary: result.reasoningSummary,
        riskFilterTriggered: result.riskFilterTriggered,
        confidenceScore: result.confidenceScore,
        dataCompletenessScore: result.dataCompletenessScore,
      });

      res.json({
        run,
        outputs: result.outputs,
        reasoningSummary: result.reasoningSummary,
        confidenceScore: result.confidenceScore,
        dataCompletenessScore: result.dataCompletenessScore,
      });
    } catch (error) {
      console.error("Error generating operator output:", error);
      res.status(500).json({ message: "Failed to generate output" });
    }
  });

  app.get("/api/gyms/:id/operator/history", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const staffRole = await getUserGymRole(req, gym);
      const role = getOperatorRole(staffRole || "coach");
      if (!canViewHistory(role)) {
        return res.status(403).json({ message: "Your role does not allow viewing history" });
      }

      const runs = await storage.getAiOperatorRunsByGym(gym.id);
      res.json(runs);
    } catch (error) {
      console.error("Error fetching operator history:", error);
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  app.patch("/api/gyms/:id/operator/runs/:runId", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const staffRole = await getUserGymRole(req, gym);
      const role = getOperatorRole(staffRole || "coach");
      if (!canGenerate(role)) {
        return res.status(403).json({ message: "Your role does not allow this action" });
      }

      const run = await storage.getAiOperatorRun(req.params.runId);
      if (!run || run.gymId !== gym.id) {
        return res.status(404).json({ message: "Run not found" });
      }

      const { status } = req.body;
      if (!status || !["draft", "reviewed", "archived"].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be one of: draft, reviewed, archived" });
      }

      const updated = await storage.updateAiOperatorRun(run.id, { status });
      res.json(updated);
    } catch (error) {
      console.error("Error updating operator run:", error);
      res.status(500).json({ message: "Failed to update run" });
    }
  });

  app.post("/api/gyms/:id/operator/tasks", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const { runId, tasks } = req.body;
      if (!runId || !Array.isArray(tasks) || tasks.length === 0) {
        return res.status(400).json({ message: "runId and tasks array are required" });
      }

      const run = await storage.getAiOperatorRun(runId);
      if (!run || run.gymId !== gym.id) {
        return res.status(404).json({ message: "Operator run not found" });
      }

      const created = [];
      for (const t of tasks) {
        if (!t.title || typeof t.title !== "string") continue;
        const task = await storage.createOperatorTask({
          gymId: gym.id,
          operatorRunId: runId,
          title: t.title,
          assignedToUserId: t.assignedToUserId || null,
          dueDate: t.dueDate ? new Date(t.dueDate) : null,
          impactValueEstimate: t.impactValueEstimate != null ? String(t.impactValueEstimate) : null,
          status: "pending",
          completedAt: null,
          completionNotes: null,
          executionResult: null,
          observedImpact: null,
          pill: t.pill || run.pill,
        });
        created.push(task);
      }

      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating operator tasks:", error);
      res.status(500).json({ message: "Failed to create tasks" });
    }
  });

  app.get("/api/gyms/:id/operator/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const filters: { status?: string; pill?: string } = {};
      if (typeof req.query.status === "string" && OPERATOR_TASK_STATUSES.includes(req.query.status as any)) {
        filters.status = req.query.status;
      }
      if (typeof req.query.pill === "string" && OPERATOR_PILLS.includes(req.query.pill as any)) {
        filters.pill = req.query.pill;
      }

      const tasks = await storage.getOperatorTasksByGym(gym.id, filters);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching operator tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.patch("/api/gyms/:id/operator/tasks/:taskId", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const existingTasks = await storage.getOperatorTasksByGym(gym.id);
      const task = existingTasks.find(t => t.id === req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });

      const updates: Record<string, any> = {};

      if (req.body.status && OPERATOR_TASK_STATUSES.includes(req.body.status)) {
        updates.status = req.body.status;
        if (req.body.status === "complete" && !task.completedAt) {
          updates.completedAt = new Date();
        }
      }
      if (req.body.completionNotes !== undefined) {
        updates.completionNotes = req.body.completionNotes;
      }
      if (req.body.executionResult !== undefined) {
        updates.executionResult = req.body.executionResult;
      }
      if (req.body.observedImpact !== undefined) {
        updates.observedImpact = req.body.observedImpact;
      }
      if (req.body.assignedToUserId !== undefined) {
        updates.assignedToUserId = req.body.assignedToUserId;
      }
      if (req.body.dueDate !== undefined) {
        updates.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
      }

      const updated = await storage.updateOperatorTask(task.id, updates);

      if (req.body.status === "complete" && req.body.createOutcome) {
        const run = await storage.getAiOperatorRun(task.operatorRunId);
        const outputJson = run?.outputJson as any;
        const projectedImpact = outputJson?.projected_impact;

        await storage.createInterventionOutcome({
          gymId: gym.id,
          interventionType: task.pill,
          gymArchetype: run?.contextSnapshotJson ? (run.contextSnapshotJson as any).gymArchetype || "unknown" : "unknown",
          membersAffected: projectedImpact?.members_affected || null,
          projectedImpact: task.impactValueEstimate || null,
          observedResult: req.body.observedImpact || null,
          outcomeNotes: req.body.completionNotes || null,
          operatorRunId: task.operatorRunId,
          pill: task.pill,
        });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating operator task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.get("/api/gyms/:id/operator/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const stats = await storage.getOperatorTaskStats(gym.id);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching operator dashboard:", error);
      res.status(500).json({ message: "Failed to fetch dashboard" });
    }
  });

  app.delete("/api/gyms/:id/operator/tasks", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const deletedCount = await storage.deleteOperatorTasksByGym(gym.id);
      res.json({ deleted: deletedCount });
    } catch (error) {
      console.error("Error clearing operator tasks:", error);
      res.status(500).json({ message: "Failed to clear tasks" });
    }
  });

  app.get("/api/gyms/:id/operator/weekly-plan", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const ctx = await buildTieredContext(gym.id, "retention");

      const pills: OperatorPill[] = ["retention", "sales", "coaching", "community", "owner"];
      const impactByPill: Record<string, any> = {};
      for (const pill of pills) {
        const pillCtx = await buildTieredContext(gym.id, pill);
        const { computeProjectedImpact } = await import("./operator-impact");
        impactByPill[pill] = computeProjectedImpact(pillCtx, pill);
      }

      const ranked = pills
        .map(pill => ({ pill, impact: impactByPill[pill] }))
        .sort((a, b) => b.impact.expected_revenue_impact - a.impact.expected_revenue_impact);

      const top3 = ranked.slice(0, 3);
      const totalProjectedImpact = top3.reduce((sum: number, r: any) => sum + r.impact.expected_revenue_impact, 0);

      const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const plan = dayLabels.map((day, i) => {
        if (i < 2) {
          const item = top3[0];
          return { day, pill: item.pill, focus: getWeeklyFocus(item.pill, i === 0 ? "plan" : "execute"), impact: item.impact };
        }
        if (i < 4) {
          const item = top3[1] || top3[0];
          return { day, pill: item.pill, focus: getWeeklyFocus(item.pill, i === 2 ? "plan" : "execute"), impact: item.impact };
        }
        if (i === 4) {
          const item = top3[2] || top3[0];
          return { day, pill: item.pill, focus: getWeeklyFocus(item.pill, "execute"), impact: item.impact };
        }
        if (i === 5) {
          return { day, pill: "community", focus: "Community engagement and member touchpoints", impact: impactByPill["community"] };
        }
        return { day, pill: "owner", focus: "Review metrics, assess progress, plan next week", impact: impactByPill["owner"] };
      });

      res.json({
        totalProjectedImpact,
        topInterventions: top3.map(r => ({ pill: r.pill, ...r.impact })),
        plan,
        archetype: ctx.gymArchetype,
      });
    } catch (error) {
      console.error("Error generating weekly plan:", error);
      res.status(500).json({ message: "Failed to generate weekly plan" });
    }
  });

  app.get("/api/gyms/:id/billing", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const now = new Date();
      const yearParsed = parseInt(req.query.year as string);
      const monthParsed = parseInt(req.query.month as string);
      const year = Number.isNaN(yearParsed) ? now.getFullYear() : yearParsed;
      const month = Number.isNaN(monthParsed) ? now.getMonth() : monthParsed;

      const { generateBillingData } = await import("./billing-engine");
      const data = await generateBillingData(gym.id, year, month);
      res.json(data);
    } catch (error) {
      console.error("Error fetching billing data:", error);
      res.status(500).json({ message: "Failed to fetch billing data" });
    }
  });

  const billingUpdateSchema = z.object({
    memberId: z.string().optional(),
    billingMonth: z.string().optional(),
    status: z.enum(["paid", "pending", "overdue"]),
    amountPaid: z.number().min(0).optional(),
    notes: z.string().optional(),
  });

  app.patch("/api/gyms/:id/billing/:memberId", isAuthenticated, demoReadOnlyGuard, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const parsed = billingUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid request", errors: parsed.error.errors });

      const { memberId, billingMonth, status, amountPaid, notes } = parsed.data;
      const memberIdToUse = memberId || req.params.memberId;

      const member = await storage.getMemberById(memberIdToUse);
      if (!member || member.gymId !== req.params.id) return res.status(404).json({ message: "Member not found" });

      const monthStr = billingMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
      const rate = Number(member.monthlyRate) || 0;
      const joinDay = Math.min(new Date(member.joinDate + "T12:00:00Z").getUTCDate(), 28);
      const [y, m] = monthStr.split("-").map(Number);
      const dueDate = `${y}-${String(m).padStart(2, "0")}-${String(joinDay).padStart(2, "0")}`;

      const record = await storage.upsertMemberBilling({
        gymId: gym.id,
        memberId: memberIdToUse,
        billingMonth: monthStr,
        amountDue: rate.toString(),
        amountPaid: (amountPaid !== undefined ? amountPaid : (status === "paid" ? rate : 0)).toString(),
        status: status || "paid",
        dueDate,
        paidAt: status === "paid" ? new Date() : null,
        notes: notes || null,
      });

      res.json(record);
    } catch (error) {
      console.error("Error updating billing record:", error);
      res.status(500).json({ message: "Failed to update billing record" });
    }
  });

  app.get("/api/gyms/:id/export/members", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const rows = await storage.getMembersByGym(req.params.id);
      const header = "Name,Email,Status,Join Date,Cancel Date,Last Attended Date,Monthly Rate";
      const csvRows = rows.map(r => [
        escapeCsvField(r.name),
        escapeCsvField(r.email || ""),
        escapeCsvField(r.status),
        escapeCsvField(r.joinDate),
        escapeCsvField(r.cancelDate || ""),
        escapeCsvField(r.lastAttendedDate || ""),
        escapeCsvField(r.monthlyRate),
      ].join(","));
      const csv = [header, ...csvRows].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="members-${req.params.id}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("Error exporting members:", error);
      res.status(500).json({ message: "Failed to export members" });
    }
  });

  app.get("/api/gyms/:id/export/leads", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const rows = await storage.getLeadsByGymAllTime(req.params.id);
      const header = "Name,Email,Phone,Source,Status,Created At,Sale Price,Won At,Lost At,Lost Reason,Notes";
      const csvRows = rows.map(r => [
        escapeCsvField(r.name || ""),
        escapeCsvField(r.email || ""),
        escapeCsvField(r.phone || ""),
        escapeCsvField(r.source),
        escapeCsvField(r.status),
        escapeCsvField(r.createdAt ? new Date(r.createdAt).toISOString() : ""),
        escapeCsvField(r.salePrice || ""),
        escapeCsvField(r.wonAt ? new Date(r.wonAt).toISOString() : ""),
        escapeCsvField(r.lostAt ? new Date(r.lostAt).toISOString() : ""),
        escapeCsvField(r.lostReason || ""),
        escapeCsvField(r.notes || ""),
      ].join(","));
      const csv = [header, ...csvRows].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="leads-${req.params.id}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("Error exporting leads:", error);
      res.status(500).json({ message: "Failed to export leads" });
    }
  });

  app.get("/api/gyms/:id/export/metrics", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const rows = await storage.getAllMonthlyMetrics(req.params.id);
      const header = "Month,Active Members,New Members,Cancels,Churn Rate,Rolling Churn 3m,MRR,ARM,LTV,RSI,RES";
      const csvRows = rows.map(r => [
        escapeCsvField(r.monthStart),
        r.activeMembers,
        r.newMembers,
        r.cancels,
        escapeCsvField(r.churnRate),
        escapeCsvField(r.rollingChurn3m || ""),
        escapeCsvField(r.mrr),
        escapeCsvField(r.arm),
        escapeCsvField(r.ltv),
        r.rsi,
        escapeCsvField(r.res),
      ].join(","));
      const csv = [header, ...csvRows].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="metrics-${req.params.id}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("Error exporting metrics:", error);
      res.status(500).json({ message: "Failed to export metrics" });
    }
  });

  app.get("/api/gyms/:id/export/billing", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (!await checkGymAccess(req, gym)) return res.status(403).json({ message: "Forbidden" });

      const rows = await storage.getAllMemberBillingByGym(req.params.id);
      const header = "Member ID,Billing Month,Amount Due,Amount Paid,Status,Due Date,Paid At,Notes";
      const csvRows = rows.map(r => [
        escapeCsvField(r.memberId),
        escapeCsvField(r.billingMonth),
        escapeCsvField(r.amountDue),
        escapeCsvField(r.amountPaid),
        escapeCsvField(r.status),
        escapeCsvField(r.dueDate),
        escapeCsvField(r.paidAt ? new Date(r.paidAt).toISOString() : ""),
        escapeCsvField(r.notes || ""),
      ].join(","));
      const csv = [header, ...csvRows].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="billing-${req.params.id}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("Error exporting billing:", error);
      res.status(500).json({ message: "Failed to export billing" });
    }
  });

  return httpServer;
}

function escapeCsvField(value: any): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function getWeeklyFocus(pill: string, phase: "plan" | "execute"): string {
  const focuses: Record<string, { plan: string; execute: string }> = {
    retention: {
      plan: "Identify at-risk members. Review attendance patterns and draft re-engagement messages.",
      execute: "Send outreach to at-risk members. Schedule check-in calls or texts.",
    },
    sales: {
      plan: "Review pipeline. Prioritize stale leads and identify follow-up targets.",
      execute: "Execute follow-ups. Confirm booked consults and send reminders.",
    },
    coaching: {
      plan: "Review coaching feedback and class attendance trends.",
      execute: "Deliver coaching touchpoints. Run skill assessment or feedback session.",
    },
    community: {
      plan: "Plan community event or member spotlight.",
      execute: "Community engagement and member touchpoints.",
    },
    owner: {
      plan: "Review weekly metrics. Identify top concerns.",
      execute: "Review metrics, assess progress, plan next week.",
    },
  };
  return focuses[pill]?.[phase] || "Focus on execution.";
}
