import Stripe from "stripe";
import { storage } from "./storage";
import type { Member } from "@shared/schema";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.STRIPE_ENCRYPTION_KEY || process.env.DATABASE_URL?.slice(0, 32) || "iron-metrics-stripe-key-default!";

export function encryptApiKey(apiKey: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32)), iv);
  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decryptApiKey(encrypted: string): string {
  const [ivHex, encryptedData] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32)), iv);
  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function fingerprintApiKey(apiKey: string): string {
  const last4 = apiKey.slice(-4);
  const prefix = apiKey.startsWith("sk_live_") ? "sk_live" : apiKey.startsWith("sk_test_") ? "sk_test" : "sk";
  return `${prefix}_...${last4}`;
}

function createStripeClient(apiKey: string): Stripe {
  return new Stripe(apiKey, { apiVersion: "2024-12-18.acacia" as any });
}

export async function testStripeConnection(apiKey: string): Promise<{ valid: boolean; accountId?: string; accountName?: string; error?: string }> {
  try {
    const stripe = createStripeClient(apiKey);
    const account = await stripe.accounts.retrieve();
    return {
      valid: true,
      accountId: account.id,
      accountName: (account as any).business_profile?.name || (account as any).settings?.dashboard?.display_name || account.id,
    };
  } catch (err: any) {
    return { valid: false, error: err.message || "Invalid API key" };
  }
}

function mapInvoiceStatus(stripeStatus: string, amountDue: number, amountPaid: number): string {
  switch (stripeStatus) {
    case "paid":
      return "payment_succeeded";
    case "open":
    case "draft":
      return "overdue";
    case "uncollectible":
    case "void":
      return "failed";
    default:
      if (amountPaid >= amountDue && amountDue > 0) return "payment_succeeded";
      return "overdue";
  }
}

async function findMemberByEmail(gymId: string, email: string | null): Promise<Member | undefined> {
  if (!email) return undefined;
  const members = await storage.getMembersByGym(gymId);
  return members.find(m => m.email?.toLowerCase() === email.toLowerCase());
}

export async function syncStripePaymentHistory(gymId: string, connectionId: string, apiKey: string): Promise<void> {
  const stripe = createStripeClient(apiKey);

  const syncRun = await storage.createStripeSyncRun({
    gymId,
    connectionId,
    runType: "full",
    status: "running",
    customersFound: 0,
    subscriptionsFound: 0,
    invoicesFound: 0,
    chargesFound: 0,
    refundsFound: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    errorCount: 0,
  });

  const errors: string[] = [];
  let customersFound = 0;
  let subscriptionsFound = 0;
  let invoicesFound = 0;
  let chargesFound = 0;
  let refundsFound = 0;
  let recordsCreated = 0;
  let recordsUpdated = 0;

  try {
    const customerEmailMap = new Map<string, { email: string | null; name: string | null }>();

    for await (const customer of stripe.customers.list({ limit: 100 })) {
      customersFound++;
      customerEmailMap.set(customer.id, {
        email: customer.email,
        name: customer.name,
      });
    }

    for await (const sub of stripe.subscriptions.list({ limit: 100, status: "all" })) {
      subscriptionsFound++;
    }

    const twelveMonthsAgo = Math.floor(Date.now() / 1000) - (365 * 24 * 60 * 60);

    for await (const invoice of stripe.invoices.list({ limit: 100, created: { gte: twelveMonthsAgo } })) {
      invoicesFound++;
      try {
        const custId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id || "";
        const custInfo = customerEmailMap.get(custId);
        const email = invoice.customer_email || custInfo?.email || null;
        const name = invoice.customer_name || custInfo?.name || null;
        const member = await findMemberByEmail(gymId, email);

        const status = mapInvoiceStatus(
          invoice.status || "open",
          invoice.amount_due || 0,
          invoice.amount_paid || 0,
        );

        const existing = await storage.getStripeBillingRecords(gymId, { limit: 1, offset: 0 });
        const existingRecord = existing.find(r => r.stripeInvoiceId === invoice.id);

        await storage.upsertStripeBillingRecord({
          gymId,
          memberId: member?.id || null,
          stripeCustomerId: custId,
          stripeInvoiceId: invoice.id,
          stripeChargeId: typeof invoice.charge === "string" ? invoice.charge : invoice.charge?.id || null,
          amount: invoice.amount_paid || invoice.amount_due || 0,
          currency: invoice.currency || "usd",
          status,
          paymentDate: invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
          dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : (invoice.created ? new Date(invoice.created * 1000) : null),
          description: invoice.lines?.data?.[0]?.description || `Invoice ${invoice.number || invoice.id}`,
          customerEmail: email,
          customerName: name,
          source: "stripe",
        });

        if (existingRecord) {
          recordsUpdated++;
        } else {
          recordsCreated++;
        }
      } catch (err: any) {
        errors.push(`Invoice ${invoice.id}: ${err.message}`);
      }
    }

    for await (const charge of stripe.charges.list({ limit: 100, created: { gte: twelveMonthsAgo } })) {
      chargesFound++;
      if (charge.invoice) continue;

      try {
        const custId = typeof charge.customer === "string" ? charge.customer : charge.customer?.id || "";
        const custInfo = custId ? customerEmailMap.get(custId) : undefined;
        const email = charge.billing_details?.email || charge.receipt_email || custInfo?.email || null;
        const name = charge.billing_details?.name || custInfo?.name || null;
        const member = await findMemberByEmail(gymId, email);

        const chargeInvoiceId = `charge_${charge.id}`;

        await storage.upsertStripeBillingRecord({
          gymId,
          memberId: member?.id || null,
          stripeCustomerId: custId || "no_customer",
          stripeInvoiceId: chargeInvoiceId,
          stripeChargeId: charge.id,
          amount: charge.amount,
          currency: charge.currency || "usd",
          status: charge.refunded ? "refunded" : charge.paid ? "payment_succeeded" : "failed",
          paymentDate: new Date(charge.created * 1000),
          dueDate: null,
          description: charge.description || `Charge ${charge.id}`,
          customerEmail: email,
          customerName: name,
          source: "stripe",
        });
        recordsCreated++;
      } catch (err: any) {
        errors.push(`Charge ${charge.id}: ${err.message}`);
      }
    }

    const refundIds = new Set<string>();
    for await (const refund of stripe.refunds.list({ limit: 100 })) {
      refundsFound++;
      refundIds.add(refund.id);
      try {
        const chargeId = typeof refund.charge === "string" ? refund.charge : refund.charge?.id;
        if (chargeId) {
          const records = await storage.getStripeBillingRecords(gymId, { limit: 1000 });
          const matchingRecord = records.find(r => r.stripeChargeId === chargeId);
          if (matchingRecord && matchingRecord.status !== "refunded") {
            await storage.upsertStripeBillingRecord({
              ...matchingRecord,
              status: "refunded",
              memberId: matchingRecord.memberId,
              stripeInvoiceId: matchingRecord.stripeInvoiceId || `refund_${refund.id}`,
            });
            recordsUpdated++;
          }
        }
      } catch (err: any) {
        errors.push(`Refund ${refund.id}: ${err.message}`);
      }
    }

    const totalRecords = recordsCreated + recordsUpdated;

    await storage.updateStripeSyncRun(syncRun.id, {
      status: errors.length > 0 ? "completed_with_errors" : "completed",
      finishedAt: new Date(),
      customersFound,
      subscriptionsFound,
      invoicesFound,
      chargesFound,
      refundsFound,
      recordsCreated,
      recordsUpdated,
      errorCount: errors.length,
      errorDetails: errors.length > 0 ? errors.join("\n") : null,
    });

    await storage.updateStripeConnection(connectionId, {
      lastSyncAt: new Date(),
      recordsSynced: totalRecords,
      lastErrorAt: errors.length > 0 ? new Date() : undefined,
      lastErrorMessage: errors.length > 0 ? `${errors.length} errors during sync` : null,
    });

  } catch (err: any) {
    await storage.updateStripeSyncRun(syncRun.id, {
      status: "failed",
      finishedAt: new Date(),
      customersFound,
      subscriptionsFound,
      invoicesFound,
      chargesFound,
      refundsFound,
      recordsCreated,
      recordsUpdated,
      errorCount: 1,
      errorDetails: err.message,
    });

    await storage.updateStripeConnection(connectionId, {
      lastErrorAt: new Date(),
      lastErrorMessage: err.message,
    });

    throw err;
  }
}

export async function processWebhookEvent(
  gymId: string,
  event: Stripe.Event,
): Promise<void> {
  const existing = await storage.getStripeWebhookEvent(event.id);
  if (existing) return;

  await storage.createStripeWebhookEvent({
    gymId,
    stripeEventId: event.id,
    eventType: event.type,
    payload: event.data.object as any,
    status: "processing",
  });

  try {
    switch (event.type) {
      case "invoice.paid":
      case "invoice.payment_failed":
      case "invoice.updated": {
        const invoice = event.data.object as Stripe.Invoice;
        const custId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id || "";
        const member = await findMemberByEmail(gymId, invoice.customer_email);

        const status = event.type === "invoice.paid"
          ? "payment_succeeded"
          : event.type === "invoice.payment_failed"
            ? "failed"
            : mapInvoiceStatus(invoice.status || "open", invoice.amount_due || 0, invoice.amount_paid || 0);

        await storage.upsertStripeBillingRecord({
          gymId,
          memberId: member?.id || null,
          stripeCustomerId: custId,
          stripeInvoiceId: invoice.id,
          stripeChargeId: typeof invoice.charge === "string" ? invoice.charge : invoice.charge?.id || null,
          amount: invoice.amount_paid || invoice.amount_due || 0,
          currency: invoice.currency || "usd",
          status,
          paymentDate: invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
          dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
          description: invoice.lines?.data?.[0]?.description || `Invoice ${invoice.number || invoice.id}`,
          customerEmail: invoice.customer_email,
          customerName: invoice.customer_name,
          source: "stripe",
        });
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        break;
      }
    }
    await storage.updateStripeWebhookEventStatus(event.id, "processed");
  } catch (err: any) {
    console.error(`[stripe-billing] Webhook processing error for ${event.type}:`, err.message);
    await storage.updateStripeWebhookEventStatus(event.id, "failed").catch(() => {});
  }
}
