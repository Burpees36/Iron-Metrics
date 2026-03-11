import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { WebhookHandlers } from "./webhookHandlers";
import { initStripeCheck } from "./stripe";
import { processWebhookEvent, decryptApiKey } from "./stripe-billing-sync";
import { storage } from "./storage";
import Stripe from "stripe";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/api/stripe/webhook" || req.path.startsWith("/api/stripe/billing-webhook/") || req.path === "/api/health",
  message: { message: "Too many requests, please try again later." },
});
app.use("/api", apiLimiter);

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.post(
  '/api/stripe/billing-webhook/:gymId',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const gymId = req.params.gymId;
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }
    try {
      const connection = await storage.getStripeConnection(gymId);
      if (!connection || connection.status !== 'connected') {
        return res.status(404).json({ error: 'No Stripe connection for this gym' });
      }

      if (!connection.webhookSecret) {
        return res.status(400).json({ error: 'Webhook secret not configured. Set up webhook signing in Stripe integration settings.' });
      }

      const stripe = new Stripe(decryptApiKey(connection.apiKeyEncrypted), { apiVersion: '2024-12-18.acacia' as any });
      const sig = Array.isArray(signature) ? signature[0] : signature;
      const event = stripe.webhooks.constructEvent(req.body as Buffer, sig, connection.webhookSecret);

      await processWebhookEvent(gymId, event);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error(`[stripe-billing] Webhook error for gym ${gymId}:`, error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const { runMigrations } = await import('stripe-replit-sync');
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      await runMigrations({ databaseUrl });
      log("Stripe schema ready", "stripe");

      const { getStripeSync } = await import('./stripeClient');
      const stripeSync = await getStripeSync();

      const firstDomain = process.env.REPLIT_DOMAINS?.split(',')[0];
      if (firstDomain) {
        try {
          const { webhook } = await stripeSync.findOrCreateManagedWebhook(
            `https://${firstDomain}/api/stripe/webhook`
          );
          log(`Webhook configured: ${webhook.url}`, "stripe");
        } catch (webhookErr) {
          console.warn("[STRIPE] Could not register managed webhook:", (webhookErr as Error).message);
        }
      }

      stripeSync.syncBackfill()
        .then(() => log("Stripe data synced", "stripe"))
        .catch((err: Error) => console.error("Error syncing Stripe data:", err));
    }
  } catch (e) {
    console.warn("[STRIPE] Stripe initialization skipped:", (e as Error).message);
  }

  await initStripeCheck();

  await registerRoutes(httpServer, app);

  try {
    const cleaned = await storage.cleanupStaleWodifySyncs();
    if (cleaned > 0) {
      log(`Cleaned up ${cleaned} stale Wodify sync run(s) from previous session`, "wodify");
    }
  } catch (err) {
    console.warn("[Wodify] Failed to clean up stale sync runs:", (err as Error).message);
  }

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
