import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { parseMembersCsv, previewCsv, parseAllRows, computeFileHash, type ColumnMapping } from "./csv-parser";
import { recomputeAllMetrics, generateMetricReports, generateForecast, generateTrendIntelligence } from "./metrics";
import { generatePredictiveIntelligence } from "./predictive";
import { insertGymSchema } from "@shared/schema";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get("/api/gyms", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const gyms = await storage.getGymsByOwner(userId);
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
      if (gym.ownerId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });
      res.json(gym);
    } catch (error) {
      console.error("Error fetching gym:", error);
      res.status(500).json({ message: "Failed to fetch gym" });
    }
  });

  app.post("/api/gyms", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = insertGymSchema.parse({ ...req.body, ownerId: userId });
      const gym = await storage.createGym(parsed);
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
      if (gym.ownerId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });
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
      if (gym.ownerId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });

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

          if (daysSinceContact !== null && daysSinceContact > 14) {
            if (risk === "low") risk = "medium";
            riskReasons.push("No recent contact");
          }

          if (daysSinceContact === null && tenureDays <= 60) {
            if (risk !== "high") risk = "high";
            riskReasons.push("Never contacted");
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
      if (gym.ownerId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });
      const contacts = await storage.getContactsForMember(req.params.memberId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching member contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.post("/api/gyms/:id/import/preview", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (gym.ownerId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });

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

  app.post("/api/gyms/:id/import/commit", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (gym.ownerId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });

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

  app.post("/api/gyms/:id/import/members", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (gym.ownerId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });

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
      if (gym.ownerId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });

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
      if (gym.ownerId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });

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
      if (gym.ownerId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });

      const month = req.query.month as string;
      if (!month) return res.status(400).json({ message: "month query parameter required (YYYY-MM-DD)" });

      const metrics = await storage.getMonthlyMetrics(req.params.id, month);
      if (!metrics) return res.status(404).json({ message: "No metrics for this month" });

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
      if (gym.ownerId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });

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
      if (gym.ownerId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });

      const month = req.query.month as string;
      if (!month) return res.status(400).json({ message: "month query parameter required (YYYY-MM-DD)" });

      const metrics = await storage.getMonthlyMetrics(req.params.id, month);
      if (!metrics) return res.status(404).json({ message: "No metrics for this month" });

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

      const reports = generateMetricReports({
        activeMembers: metrics.activeMembers,
        churnRate: Number(metrics.churnRate),
        mrr: Number(metrics.mrr),
        arm: Number(metrics.arm),
        ltv: Number(metrics.ltv),
        rsi: metrics.rsi,
        res: Number(metrics.res),
        ltveImpact: Number(metrics.ltveImpact),
        memberRiskCount: metrics.memberRiskCount,
        rollingChurn3m: metrics.rollingChurn3m ? Number(metrics.rollingChurn3m) : null,
        newMembers: metrics.newMembers,
        cancels: metrics.cancels,
      }, {
        prev1: toTrend(prev1),
        prev2: toTrend(prev2),
        prev3: toTrend(prev3),
      });

      const monthDate = new Date(month + "T00:00:00");
      const nextMonth = new Date(monthDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const monthEnd = new Date(nextMonth);
      monthEnd.setDate(monthEnd.getDate() - 1);
      const lastDayOfMonth = monthEnd.toISOString().slice(0, 10);

      const activeMembers = await storage.getActiveMembers(req.params.id, lastDayOfMonth);
      const contacts = await storage.getLatestContacts(req.params.id);
      const contactMap = new Map<string, Date>();
      for (const c of contacts) {
        if (c.contactedAt && !contactMap.has(c.memberId)) {
          contactMap.set(c.memberId, c.contactedAt);
        }
      }

      const asOfDate = monthEnd;
      const atRiskMembers = activeMembers
        .filter((m) => {
          const joinDate = new Date(m.joinDate + "T00:00:00");
          const tenureMonths = (asOfDate.getFullYear() - joinDate.getFullYear()) * 12 +
            (asOfDate.getMonth() - joinDate.getMonth());
          return tenureMonths <= 2;
        })
        .map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          joinDate: m.joinDate,
          monthlyRate: m.monthlyRate,
          tenureDays: Math.max(0, Math.floor((asOfDate.getTime() - new Date(m.joinDate + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24))),
          lastContacted: contactMap.get(m.id)?.toISOString() || null,
        }));

      const prevMetrics = [
        metrics,
        ...(prev1 ? [prev1] : []),
        ...(prev2 ? [prev2] : []),
        ...(prev3 ? [prev3] : []),
      ];

      const forecast = generateForecast(prevMetrics);

      res.json({ metrics, reports, atRiskMembers, forecast });
    } catch (error) {
      console.error("Error fetching report:", error);
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  app.post("/api/gyms/:id/members/:memberId/contact", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (gym.ownerId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });

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

  app.get("/api/gyms/:id/trends/intelligence", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (gym.ownerId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });

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
      if (gym.ownerId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });

      const intelligence = await generatePredictiveIntelligence(req.params.id);
      res.json(intelligence);
    } catch (error) {
      console.error("Error generating predictive intelligence:", error);
      res.status(500).json({ message: "Failed to generate predictive intelligence" });
    }
  });

  app.post("/api/gyms/:id/recompute", isAuthenticated, async (req: any, res) => {
    try {
      const gym = await storage.getGym(req.params.id);
      if (!gym) return res.status(404).json({ message: "Gym not found" });
      if (gym.ownerId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });

      await recomputeAllMetrics(req.params.id);
      res.json({ message: "Metrics recomputed" });
    } catch (error) {
      console.error("Error recomputing metrics:", error);
      res.status(500).json({ message: "Failed to recompute metrics" });
    }
  });

  return httpServer;
}
