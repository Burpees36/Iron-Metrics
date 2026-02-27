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
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
