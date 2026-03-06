import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated, isDemoUser, DEMO_USER_ID } from "./replitAuth";

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      if (isDemoUser(req)) {
        return res.json({
          id: DEMO_USER_ID,
          email: "demo@ironmetrics.app",
          firstName: "Demo",
          lastName: "User",
          profileImageUrl: null,
        });
      }
      const userId = req.user.id;
      const user = await authStorage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/auth/update-profile", isAuthenticated, async (req: any, res) => {
    try {
      if (isDemoUser(req)) {
        return res.status(403).json({ message: "Demo mode is read-only" });
      }
      const { firstName, lastName } = req.body;
      const user = await authStorage.upsertUser({
        id: req.user.id,
        email: req.user.email,
        firstName: firstName || req.user.firstName,
        lastName: lastName || req.user.lastName,
        profileImageUrl: req.user.profileImageUrl,
      });
      res.json(user);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });
}
