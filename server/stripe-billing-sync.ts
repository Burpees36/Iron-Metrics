import Stripe from "stripe";
import { storage } from "./storage";
import type { Member } from "@shared/schema";
import crypto from "crypto";

let _encryptionKey: string | null = null;

function getEncryptionKey(): string {
  if (_encryptionKey) return _encryptionKey;
  const key = process.env.STRIPE_ENCRYPTION_KEY;
  if (key) {
    _encryptionKey = key;
    return key;
  }
  if (process.env.NODE_ENV === "production") {
    const fallback = process.env.DATABASE_URL?.slice(0, 32);
    if (fallback) {
      console.warn("[stripe-billing] WARNING: STRIPE_ENCRYPTION_KEY not set. Using DATABASE_URL-derived key. Set STRIPE_ENCRYPTION_KEY for full production security.");
      _encryptionKey = fallback;
      return fallback;
    }
    throw new Error("STRIPE_ENCRYPTION_KEY environment variable is required in production when DATABASE_URL is unavailable");
  }
  const fallback = process.env.DATABASE_URL?.slice(0, 32);
  if (fallback) {
    console.warn("[stripe-billing] WARNING: Using DATABASE_URL-derived encryption key. Set STRIPE_ENCRYPTION_KEY for production.");
    _encryptionKey = fallback;
    return fallback;
  }
  console.warn("[stripe-billing] WARNING: Using default encryption key. This is NOT safe for production.");
  _encryptionKey = "iron-metrics-stripe-key-default!";
  return _encryptionKey;
}

export function encryptApiKey(apiKey: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(getEncryptionKey().padEnd(32, "0").slice(0, 32)), iv);
  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decryptApiKey(encrypted: string): string {
  const [ivHex, encryptedData] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(getEncryptionKey().padEnd(32, "0").slice(0, 32)), iv);
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

export interface SyncOptions {
  windowDays?: number;
  dryRun?: boolean;
}

export async function syncStripePaymentHistory(gymId: string, connectionId: string, apiKey: string, options: SyncOptions = {}): Promise<string> {
  const stripe = createStripeClient(apiKey);
  const { windowDays, dryRun = false } = options;

  const syncRun = await storage.createStripeSyncRun({
    gymId,
    connectionId,
    runType: dryRun ? "dry_run" : "full",
    status: "running",
    customersFound: 0,
    subscriptionsFound: 0,
    invoicesFound: 0,
    chargesFound: 0,
    refundsFound: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsFailed: 0,
    errorCount: 0,
    syncWindowDays: windowDays || null,
    isDryRun: dryRun,
  });

  const errors: string[] = [];
  const warnings: string[] = [];
  let customersFound = 0;
  let subscriptionsFound = 0;
  let invoicesFound = 0;
  let chargesFound = 0;
  let refundsFound = 0;
  let recordsCreated = 0;
  let recordsUpdated = 0;
  let recordsSkipped = 0;
  let recordsFailed = 0;

  const cutoffTimestamp = windowDays
    ? Math.floor(Date.now() / 1000) - (windowDays * 24 * 60 * 60)
    : undefined;

  try {
    const customerEmailMap = new Map<string, { email: string | null; name: string | null }>();

    for await (const customer of stripe.customers.list({ limit: 100 })) {
      customersFound++;
      customerEmailMap.set(customer.id, {
        email: customer.email,
        name: customer.name,
      });
    }

    try {
      for await (const sub of stripe.subscriptions.list({ limit: 100, status: "all" })) {
        subscriptionsFound++;
      }
    } catch (err: any) {
      warnings.push("Subscription data not available: " + (err.message || "access denied"));
    }

    const existingInvoiceIds = new Set<string>();
    if (!dryRun) {
      const existingRecords = await storage.getStripeBillingRecords(gymId, { limit: 10000 });
      for (const r of existingRecords) {
        if (r.stripeInvoiceId) existingInvoiceIds.add(r.stripeInvoiceId);
      }
    }

    const invoiceListParams: any = { limit: 100 };
    if (cutoffTimestamp) invoiceListParams.created = { gte: cutoffTimestamp };
    for await (const invoice of stripe.invoices.list(invoiceListParams)) {
      invoicesFound++;
      if (dryRun) continue;

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

        const isExisting = existingInvoiceIds.has(invoice.id);

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

        if (isExisting) {
          recordsUpdated++;
        } else {
          recordsCreated++;
        }
      } catch (err: any) {
        recordsFailed++;
        errors.push(`Invoice ${invoice.id}: ${err.message}`);
      }
    }

    const chargeListParams: any = { limit: 100 };
    if (cutoffTimestamp) chargeListParams.created = { gte: cutoffTimestamp };
    for await (const charge of stripe.charges.list(chargeListParams)) {
      chargesFound++;
      if (charge.invoice) {
        recordsSkipped++;
        continue;
      }
      if (dryRun) continue;

      try {
        const custId = typeof charge.customer === "string" ? charge.customer : charge.customer?.id || "";
        const custInfo = custId ? customerEmailMap.get(custId) : undefined;
        const email = charge.billing_details?.email || charge.receipt_email || custInfo?.email || null;
        const name = charge.billing_details?.name || custInfo?.name || null;
        const member = await findMemberByEmail(gymId, email);

        const chargeInvoiceId = `charge_${charge.id}`;
        const isExisting = existingInvoiceIds.has(chargeInvoiceId);

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
        if (isExisting) recordsUpdated++;
        else recordsCreated++;
      } catch (err: any) {
        recordsFailed++;
        errors.push(`Charge ${charge.id}: ${err.message}`);
      }
    }

    try {
      for await (const refund of stripe.refunds.list({ limit: 100 })) {
        refundsFound++;
        if (dryRun) continue;
        try {
          const chargeId = typeof refund.charge === "string" ? refund.charge : refund.charge?.id;
          if (chargeId) {
            const records = await storage.getStripeBillingRecords(gymId, { limit: 10000 });
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
          recordsFailed++;
          errors.push(`Refund ${refund.id}: ${err.message}`);
        }
      }
    } catch (err: any) {
      warnings.push("Refund data not available: " + (err.message || "access denied"));
    }

    if (invoicesFound === 0 && chargesFound > 0) {
      warnings.push("No invoices found but charges exist — invoice access may be restricted.");
    }
    if (customersFound > 0 && invoicesFound === 0 && chargesFound === 0) {
      warnings.push("Customers found but no payment data — API key permissions may be too restricted.");
    }

    const estimatedUnmatched = dryRun ? (() => {
      const emailSet = new Set(Array.from(customerEmailMap.values()).map(c => c.email?.toLowerCase()).filter(Boolean));
      let unmatchable = 0;
      for (const [, info] of customerEmailMap) {
        if (!info.email) unmatchable++;
      }
      return unmatchable;
    })() : 0;

    const dryRunSummary = dryRun ? {
      customersFound,
      subscriptionsFound,
      invoicesFound,
      chargesFound,
      refundsFound,
      estimatedNewRecords: invoicesFound + Math.max(0, chargesFound - invoicesFound),
      estimatedUnmatched,
      warnings,
    } : null;

    const totalRecords = recordsCreated + recordsUpdated;

    await storage.updateStripeSyncRun(syncRun.id, {
      status: dryRun ? "dry_run_completed" : (errors.length > 0 ? "completed_with_errors" : "completed"),
      finishedAt: new Date(),
      customersFound,
      subscriptionsFound,
      invoicesFound,
      chargesFound,
      refundsFound,
      recordsCreated,
      recordsUpdated,
      recordsSkipped,
      recordsFailed,
      errorCount: errors.length,
      errorDetails: errors.length > 0 ? errors.join("\n") : null,
      warningMessages: warnings.length > 0 ? warnings.join("\n") : null,
      dryRunSummary: dryRunSummary as any,
    });

    if (!dryRun) {
      await storage.updateStripeConnection(connectionId, {
        lastSyncAt: new Date(),
        recordsSynced: totalRecords,
        lastErrorAt: errors.length > 0 ? new Date() : undefined,
        lastErrorMessage: errors.length > 0 ? `${errors.length} errors during sync` : null,
      });
    }

    return syncRun.id;

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
      recordsSkipped,
      recordsFailed,
      errorCount: 1,
      errorDetails: err.message,
      warningMessages: warnings.length > 0 ? warnings.join("\n") : null,
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

      // Subscription lifecycle events are received and acknowledged but not yet mapped
      // to billing records. Reserved for future subscription-state tracking and
      // billing reconciliation features. The events are still stored in stripeWebhookEvents
      // for audit purposes.
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        break;
      }
    }
    await storage.updateStripeWebhookEventStatus(event.id, "processed");
  } catch (err: any) {
    console.error(`[stripe-billing] Webhook processing error for ${event.type}:`, err.message);
    await storage.updateStripeWebhookEventStatus(event.id, "failed").catch(() => {});
    await storage.createStripeIntegrationEvent({
      gymId,
      eventType: "webhook_failure",
      details: {
        stripeEventId: event.id,
        webhookEventType: event.type,
        error: err.message || "Unknown processing error",
        occurredAt: new Date().toISOString(),
      },
    }).catch(() => {});
  }
}
