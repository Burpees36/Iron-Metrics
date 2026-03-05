import { storage } from "./storage";
import { getUncachableStripeClient } from "./stripeClient";

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

let stripeConfigured = false;

export async function initStripeCheck(): Promise<void> {
  try {
    const stripe = await getUncachableStripeClient();
    if (stripe) {
      stripeConfigured = true;
      console.log("[STRIPE] Stripe connection verified");
    }
  } catch (e) {
    console.warn("[STRIPE] Stripe not configured:", (e as Error).message);
    stripeConfigured = false;
  }
}

export function isStripeConfigured(): boolean {
  return stripeConfigured;
}

export async function createCheckoutSession(gymId: string, plan: "starter" | "pro", userEmail: string, returnUrl: string) {
  const stripe = await getUncachableStripeClient();

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
  const stripe = await getUncachableStripeClient();

  const sub = await storage.getSubscriptionByGym(gymId);
  if (!sub?.stripeCustomerId) throw new Error("No subscription found");

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: returnUrl,
  });

  return { url: session.url };
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
