import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { parseMembersCsv } from "./csv-parser";
import { recomputeAllMetrics, generateMetricReports } from "./metrics";
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

      res.json({ metrics, reports });
    } catch (error) {
      console.error("Error fetching report:", error);
      res.status(500).json({ message: "Failed to fetch report" });
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
