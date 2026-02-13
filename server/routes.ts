import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { parseMembersCsv } from "./csv-parser";
import { recomputeAllMetrics } from "./metrics";
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
