import { storage } from "./storage";
import type { Member } from "@shared/schema";

function normalizeStr(s: string | null | undefined): string {
  return (s || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.toLowerCase().trim();
}

function normalizeName(name: string | null | undefined): string {
  return normalizeStr(name).replace(/[^a-z\s]/g, "");
}

function emailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const parts = email.split("@");
  return parts.length === 2 ? parts[1].toLowerCase() : null;
}

export async function runAutoMatching(gymId: string): Promise<{ matched: number; ambiguous: number; unmatched: number }> {
  const customers = await storage.getUniqueStripeCustomers(gymId);
  const members = await storage.getMembersByGym(gymId);

  const emailMap = new Map<string, Member>();
  const nameMap = new Map<string, Member[]>();

  for (const m of members) {
    if (m.email) {
      emailMap.set(normalizeEmail(m.email)!, m);
    }
    const nName = normalizeName(m.name);
    if (nName) {
      if (!nameMap.has(nName)) nameMap.set(nName, []);
      nameMap.get(nName)!.push(m);
    }
  }

  let matched = 0;
  let ambiguous = 0;
  let unmatched = 0;

  for (const cust of customers) {
    const custEmail = normalizeEmail(cust.customerEmail);
    const custName = normalizeName(cust.customerName);

    if (custEmail && emailMap.has(custEmail)) {
      const member = emailMap.get(custEmail)!;
      await storage.upsertStripeCustomerMatch({
        gymId,
        stripeCustomerId: cust.stripeCustomerId,
        stripeCustomerEmail: cust.customerEmail,
        stripeCustomerName: cust.customerName,
        memberId: member.id,
        matchStatus: "auto_matched",
        matchMethod: "exact_email",
        matchConfidence: 100,
        matchedAt: new Date(),
      });
      await storage.updateStripeBillingRecordsMemberId(gymId, cust.stripeCustomerId, member.id);
      matched++;
      continue;
    }

    if (custName && custEmail) {
      const candidates = nameMap.get(custName);
      if (candidates && candidates.length === 1) {
        const member = candidates[0];
        await storage.upsertStripeCustomerMatch({
          gymId,
          stripeCustomerId: cust.stripeCustomerId,
          stripeCustomerEmail: cust.customerEmail,
          stripeCustomerName: cust.customerName,
          memberId: member.id,
          matchStatus: "auto_matched",
          matchMethod: "normalized_name_email",
          matchConfidence: 85,
          matchedAt: new Date(),
        });
        await storage.updateStripeBillingRecordsMemberId(gymId, cust.stripeCustomerId, member.id);
        matched++;
        continue;
      }
    }

    if (custName) {
      const candidates = nameMap.get(custName);
      if (candidates && candidates.length === 1) {
        await storage.upsertStripeCustomerMatch({
          gymId,
          stripeCustomerId: cust.stripeCustomerId,
          stripeCustomerEmail: cust.customerEmail,
          stripeCustomerName: cust.customerName,
          memberId: null,
          matchStatus: "ambiguous",
          matchMethod: "normalized_name_only",
          matchConfidence: 50,
          notes: `Potential match: ${candidates[0].name} (${candidates[0].email || 'no email'})`,
        });
        ambiguous++;
        continue;
      }
      if (candidates && candidates.length > 1) {
        await storage.upsertStripeCustomerMatch({
          gymId,
          stripeCustomerId: cust.stripeCustomerId,
          stripeCustomerEmail: cust.customerEmail,
          stripeCustomerName: cust.customerName,
          memberId: null,
          matchStatus: "ambiguous",
          matchMethod: "normalized_name_only",
          matchConfidence: 30,
          notes: `Multiple potential matches: ${candidates.map(c => c.name).join(", ")}`,
        });
        ambiguous++;
        continue;
      }
    }

    await storage.upsertStripeCustomerMatch({
      gymId,
      stripeCustomerId: cust.stripeCustomerId,
      stripeCustomerEmail: cust.customerEmail,
      stripeCustomerName: cust.customerName,
      memberId: null,
      matchStatus: "unmatched",
      matchMethod: "none",
      matchConfidence: 0,
    });
    unmatched++;
  }

  return { matched, ambiguous, unmatched };
}

async function verifyMatchBelongsToGym(matchId: string, gymId: string) {
  const matches = await storage.getStripeCustomerMatches(gymId, { search: "" });
  const match = matches.find(m => m.id === matchId);
  if (!match) throw new Error("Match record not found or does not belong to this gym");
  return match;
}

async function verifyMemberBelongsToGym(memberId: string, gymId: string) {
  const members = await storage.getMembersByGym(gymId);
  const member = members.find(m => m.id === memberId);
  if (!member) throw new Error("Member not found or does not belong to this gym");
  return member;
}

export async function manualMatch(matchId: string, memberId: string, userId: string, gymId: string): Promise<void> {
  await verifyMatchBelongsToGym(matchId, gymId);
  await verifyMemberBelongsToGym(memberId, gymId);

  const match = await storage.updateStripeCustomerMatch(matchId, {
    memberId,
    matchStatus: "manually_matched",
    matchMethod: "manual",
    matchConfidence: 100,
    matchedAt: new Date(),
    matchedBy: userId,
  });
  if (match) {
    await storage.updateStripeBillingRecordsMemberId(gymId, match.stripeCustomerId, memberId);
  }
}

export async function unmatchRecord(matchId: string, userId: string, gymId: string): Promise<void> {
  await verifyMatchBelongsToGym(matchId, gymId);

  const match = await storage.updateStripeCustomerMatch(matchId, {
    memberId: null,
    matchStatus: "unmatched",
    matchMethod: "none",
    matchConfidence: 0,
    matchedAt: null,
    matchedBy: userId,
  });
  if (match) {
    await storage.updateStripeBillingRecordsMemberId(gymId, match.stripeCustomerId, null);
  }
}

export async function ignoreRecord(matchId: string, userId: string, gymId: string): Promise<void> {
  await verifyMatchBelongsToGym(matchId, gymId);

  await storage.updateStripeCustomerMatch(matchId, {
    matchStatus: "ignored",
    matchedAt: new Date(),
    matchedBy: userId,
  });
}

export async function rerunMatching(gymId: string): Promise<{ matched: number; ambiguous: number; unmatched: number }> {
  await storage.deleteStripeCustomerMatches(gymId);
  return runAutoMatching(gymId);
}
