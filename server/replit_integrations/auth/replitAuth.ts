import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { verifySupabaseToken } from "../../supabaseAuth";
import { authStorage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
}

export const DEMO_USER_ID = "demo-user";
export const DEMO_GYM_ID = "f2d3ff6b-ced8-4735-847e-4f65b4cad721";

export function isDemoUser(req: any): boolean {
  return req.user?.id === DEMO_USER_ID;
}

export const demoReadOnlyGuard: RequestHandler = (req: any, res, next) => {
  if (isDemoUser(req)) {
    return res.status(403).json({ message: "Demo mode is read-only" });
  }
  next();
};

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  if (req.user) {
    return next();
  }

  const demoSession = (req.session as any)?.demoUser;
  if (demoSession) {
    req.user = demoSession;
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.slice(7);
  try {
    const supabaseUser = await verifySupabaseToken(token);
    if (!supabaseUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const appUser = await authStorage.upsertUser({
      id: supabaseUser.id,
      email: supabaseUser.email || null,
      firstName: supabaseUser.user_metadata?.firstName || supabaseUser.user_metadata?.first_name || null,
      lastName: supabaseUser.user_metadata?.lastName || supabaseUser.user_metadata?.last_name || null,
      profileImageUrl: supabaseUser.user_metadata?.avatar_url || null,
    });

    req.user = appUser;
    return next();
  } catch (error) {
    console.error("Auth verification error:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};
