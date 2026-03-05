import { storage } from "./storage";
import type { InsertSubscription } from "@shared/schema";

export const PLANS = {
  starter: {
    name: "Starter",
    price: 14900,
    priceDisplay: "$149/mo",
    features: [
      "Retention Stability Index",
      "Member Risk Radar",
      "Revenue Stability Panel",
      "Billing Intelligence",
      "CSV Import",
      "Wodify Integration",
      "Resources Library",
    ],
  },
  pro: {
    name: "Pro",
    price: 24900,
    priceDisplay: "$249/mo",
    features: [
      "Everything in Starter",
      "AI Operator (unlimited generations)",
      "Predictive Intelligence Stack",
      "Sales Intelligence",
      "Lead Pipeline (CRM)",
      "Ranked Intervention Engine",
      "Data Export",
      "Priority Support",
    ],
  },
} as const;

export const TRIAL_DAYS = 14;

let stripeInstance: any = null;

async function getStripe() {
  if (stripeInstance) return stripeInstance;
  try {
    const Stripe = (await import("stripe")).default;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      console.warn("[STRIPE] No STRIPE_SECRET_KEY found. Stripe features disabled.");
      return null;
    }
    stripeInstance = new Stripe(key, { apiVersion: "2024-12-18.acacia" as any });
    return stripeInstance;
  } catch {
    console.warn("[STRIPE] Stripe module not available.");
    return null;
  }
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export async function createCheckoutSession(gymId: string, plan: "starter" | "pro", userEmail: string, returnUrl: string) {
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");

  const planConfig = PLANS[plan];
  const existing = await storage.getSubscriptionByGym(gymId);

  let customerId: string | undefined;
  if (existing?.stripeCustomerId) {
    customerId = existing.stripeCustomerId;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    ...(customerId ? { customer: customerId } : { customer_email: userEmail }),
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `Iron Metrics ${planConfig.name}` },
          unit_amount: planConfig.price,
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: existing ? undefined : TRIAL_DAYS,
      metadata: { gymId, plan },
    },
    metadata: { gymId, plan },
    success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: returnUrl,
  });

  return { sessionId: session.id, url: session.url };
}

export async function createCustomerPortalSession(gymId: string, returnUrl: string) {
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");

  const sub = await storage.getSubscriptionByGym(gymId);
  if (!sub?.stripeCustomerId) throw new Error("No subscription found");

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

export async function handleWebhookEvent(rawBody: Buffer, signature: string) {
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET not set");

  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as any;
      const gymId = session.metadata?.gymId;
      const plan = session.metadata?.plan || "starter";
      if (!gymId) break;

      const subscriptionId = session.subscription;
      const customerId = session.customer;

      const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);

      const existing = await storage.getSubscriptionByGym(gymId);
      if (existing) {
        await storage.updateSubscription(existing.id, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          plan,
          status: stripeSub.status === "trialing" ? "trialing" : "active",
          trialEndsAt: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
          currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        });
      } else {
        await storage.createSubscription({
          gymId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          plan,
          status: stripeSub.status === "trialing" ? "trialing" : "active",
          trialEndsAt: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
          currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const stripeSub = event.data.object as any;
      const existing = await storage.getSubscriptionByStripeSubscriptionId(stripeSub.id);
      if (existing) {
        const statusMap: Record<string, string> = {
          trialing: "trialing",
          active: "active",
          past_due: "past_due",
          canceled: "canceled",
          unpaid: "unpaid",
        };
        await storage.updateSubscription(existing.id, {
          status: (statusMap[stripeSub.status] || stripeSub.status) as any,
          currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end || false,
          plan: stripeSub.metadata?.plan || existing.plan,
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const stripeSub = event.data.object as any;
      const existing = await storage.getSubscriptionByStripeSubscriptionId(stripeSub.id);
      if (existing) {
        await storage.updateSubscription(existing.id, { status: "canceled" });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as any;
      const customerId = invoice.customer;
      const existing = await storage.getSubscriptionByStripeCustomerId(customerId);
      if (existing) {
        await storage.updateSubscription(existing.id, { status: "past_due" });
      }
      break;
    }
  }

  return { received: true };
}

export async function getSubscriptionStatus(gymId: string) {
  const sub = await storage.getSubscriptionByGym(gymId);
  if (!sub) {
    return {
      hasSubscription: false,
      status: "none" as const,
      plan: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      isActive: false,
      stripeConfigured: isStripeConfigured(),
    };
  }

  const isActive = sub.status === "active" || sub.status === "trialing";
  const trialExpired = sub.status === "trialing" && sub.trialEndsAt && new Date(sub.trialEndsAt) < new Date();

  return {
    hasSubscription: true,
    status: trialExpired ? "expired" as const : sub.status,
    plan: sub.plan,
    trialEndsAt: sub.trialEndsAt,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    isActive: isActive && !trialExpired,
    stripeConfigured: isStripeConfigured(),
  };
}

export async function ensureTrialSubscription(gymId: string): Promise<void> {
  const existing = await storage.getSubscriptionByGym(gymId);
  if (existing) return;

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

  await storage.createSubscription({
    gymId,
    plan: "starter",
    status: "trialing",
    trialEndsAt: trialEnd,
    currentPeriodEnd: trialEnd,
  });
}
