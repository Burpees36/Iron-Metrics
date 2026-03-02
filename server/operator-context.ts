import { storage } from "./storage";
import { computeSalesSummary } from "./sales-intelligence";
import type { OperatorPill } from "@shared/schema";

export interface GymProfile {
  activeMembers: number;
  totalMembers: number;
  monthsOfData: number;
  hasSalesData: boolean;
  hasAttendanceData: boolean;
}

export interface FinancialSignals {
  mrr?: number;
  mrrTrend?: number;
  arm?: number;
  ltv?: number;
  churnRate?: number;
  churnTrend?: number;
}

export interface RetentionSignals {
  rsi?: number;
  rsiTrend?: number;
  atRiskMembers?: number;
  disengagedCount?: number;
  first90DayChurn?: number;
  memberGrowthRate?: number;
}

export interface SalesSignals {
  newLeads?: number;
  showRate?: number;
  closeRate?: number;
  speedToLeadMin?: number;
  salesHealthScore?: number;
  conversionRate?: number;
  revenuePerLead?: number;
}

export interface OwnerStabilitySignals {
  mrrTrend?: number;
  churnTrend?: number;
  memberGrowthRate?: number;
  rsiDirection?: "improving" | "stable" | "declining";
}

export interface TieredContext {
  gymProfile: GymProfile;
  financialSignals: FinancialSignals;
  retentionSignals: RetentionSignals;
  salesSignals: SalesSignals;
  ownerStabilitySignals: OwnerStabilitySignals;
  recentInterventions: string[];
  gymArchetype: "growth" | "stable" | "declining" | "startup";
  dataCompletenessScore: number;
}

const PILL_TIERS: Record<OperatorPill, (keyof TieredContext)[]> = {
  retention: ["gymProfile", "retentionSignals", "financialSignals"],
  sales: ["gymProfile", "salesSignals", "financialSignals"],
  coaching: ["gymProfile", "retentionSignals"],
  community: ["gymProfile", "retentionSignals"],
  owner: ["gymProfile", "financialSignals", "retentionSignals", "salesSignals", "ownerStabilitySignals"],
};

function computeArchetype(monthsOfData: number, mrrTrend?: number, memberGrowthRate?: number): TieredContext["gymArchetype"] {
  if (monthsOfData < 3) return "startup";
  if (mrrTrend !== undefined && mrrTrend > 2) return "growth";
  if (memberGrowthRate !== undefined && memberGrowthRate > 3) return "growth";
  if (mrrTrend !== undefined && mrrTrend < -3) return "declining";
  if (memberGrowthRate !== undefined && memberGrowthRate < -3) return "declining";
  return "stable";
}

function computeDataCompleteness(profile: GymProfile, financial: FinancialSignals, retention: RetentionSignals, sales: SalesSignals): number {
  let score = 0;
  const maxScore = 100;

  if (profile.activeMembers > 0) score += 10;
  if (profile.monthsOfData >= 1) score += 5;
  if (profile.monthsOfData >= 3) score += 5;
  if (profile.monthsOfData >= 6) score += 5;

  if (financial.mrr !== undefined) score += 8;
  if (financial.arm !== undefined) score += 5;
  if (financial.ltv !== undefined && financial.ltv > 0) score += 5;
  if (financial.churnRate !== undefined) score += 8;
  if (financial.mrrTrend !== undefined) score += 4;

  if (retention.rsi !== undefined) score += 10;
  if (retention.atRiskMembers !== undefined) score += 5;
  if (retention.first90DayChurn !== undefined) score += 5;
  if (retention.disengagedCount !== undefined) score += 5;

  if (sales.newLeads !== undefined) score += 5;
  if (sales.showRate !== undefined) score += 5;
  if (sales.closeRate !== undefined) score += 5;
  if (sales.salesHealthScore !== undefined) score += 5;

  return Math.min(score, maxScore);
}

export async function buildTieredContext(gymId: string, pill: OperatorPill): Promise<TieredContext> {
  const allMetrics = await storage.getAllMonthlyMetrics(gymId);
  const latest = allMetrics.length > 0 ? allMetrics[allMetrics.length - 1] : null;
  const prevMonth = allMetrics.length > 1 ? allMetrics[allMetrics.length - 2] : null;
  const threeMonthsAgo = allMetrics.length > 2 ? allMetrics[allMetrics.length - 3] : null;
  const monthsOfData = allMetrics.length;

  const members = await storage.getMembersByGym(gymId);
  const activeMembers = members.filter(m => m.status === "active");
  const now = new Date();

  const gymProfile: GymProfile = {
    activeMembers: activeMembers.length,
    totalMembers: members.length,
    monthsOfData,
    hasSalesData: false,
    hasAttendanceData: activeMembers.some(m => m.lastAttendedDate !== null),
  };

  const financialSignals: FinancialSignals = {};
  if (latest) {
    financialSignals.mrr = Number(latest.mrr);
    financialSignals.arm = Number(latest.arm);
    financialSignals.ltv = Number(latest.ltv);
    financialSignals.churnRate = Number(latest.churnRate);
    if (prevMonth) {
      financialSignals.mrrTrend = Number(latest.mrr) - Number(prevMonth.mrr);
      financialSignals.churnTrend = Number(latest.churnRate) - Number(prevMonth.churnRate);
    }
  }

  const retentionSignals: RetentionSignals = {};
  if (latest) {
    retentionSignals.rsi = latest.rsi;
    if (prevMonth) {
      retentionSignals.rsiTrend = latest.rsi - prevMonth.rsi;
    }
  }

  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const disengaged = activeMembers.filter(m => {
    if (m.lastAttendedDate) return new Date(m.lastAttendedDate) < fourteenDaysAgo;
    return false;
  });
  retentionSignals.disengagedCount = disengaged.length;

  const newMemberRisk = activeMembers.filter(m => new Date(m.joinDate) >= sixtyDaysAgo).length;
  retentionSignals.atRiskMembers = newMemberRisk + disengaged.length;

  const cancelledMembers = members.filter(m => m.status === "cancelled" && m.cancelDate && m.joinDate);
  const cancelledBefore90 = cancelledMembers.filter(m => {
    const join = new Date(m.joinDate);
    const cancel = new Date(m.cancelDate!);
    return (cancel.getTime() - join.getTime()) / (1000 * 60 * 60 * 24) <= 90;
  });
  if (cancelledMembers.length > 0) {
    retentionSignals.first90DayChurn = Math.round((cancelledBefore90.length / cancelledMembers.length) * 1000) / 10;
  }

  if (prevMonth && latest) {
    const prevActive = prevMonth.activeMembers || 0;
    if (prevActive > 0) {
      retentionSignals.memberGrowthRate = Math.round(((latest.activeMembers - prevActive) / prevActive) * 1000) / 10;
    }
  }

  const salesSignals: SalesSignals = {};
  const allowedTiers = PILL_TIERS[pill];
  if (allowedTiers.includes("salesSignals") || pill === "owner") {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    try {
      const leads = await storage.getLeadsByGym(gymId, thirtyDaysAgo, now);
      const consults = await storage.getConsultsByGym(gymId, thirtyDaysAgo, now);
      const memberships = await storage.getSalesMembershipsByGym(gymId, thirtyDaysAgo, now);
      const payments = await storage.getPaymentsByGym(gymId, thirtyDaysAgo, now);

      const summary = computeSalesSummary(leads, consults, memberships, payments);
      salesSignals.newLeads = summary.counts.leads;
      salesSignals.showRate = summary.rates.showRate ?? undefined;
      salesSignals.closeRate = summary.rates.closeRate ?? undefined;
      salesSignals.speedToLeadMin = summary.speed.responseMedianMin ?? undefined;
      salesSignals.salesHealthScore = summary.composite.salesHealthScore;
      salesSignals.conversionRate = summary.rates.funnelConversion ?? undefined;
      salesSignals.revenuePerLead = summary.revenue.revenuePerLead ?? undefined;
      gymProfile.hasSalesData = leads.length > 0;
    } catch {
      gymProfile.hasSalesData = false;
    }
  }

  const ownerStabilitySignals: OwnerStabilitySignals = {};
  if (allowedTiers.includes("ownerStabilitySignals")) {
    ownerStabilitySignals.mrrTrend = financialSignals.mrrTrend;
    ownerStabilitySignals.churnTrend = financialSignals.churnTrend;
    ownerStabilitySignals.memberGrowthRate = retentionSignals.memberGrowthRate;
    if (retentionSignals.rsiTrend !== undefined) {
      ownerStabilitySignals.rsiDirection = retentionSignals.rsiTrend > 2 ? "improving" : retentionSignals.rsiTrend < -2 ? "declining" : "stable";
    }
  }

  const gymArchetype = computeArchetype(monthsOfData, financialSignals.mrrTrend, retentionSignals.memberGrowthRate);
  const dataCompletenessScore = computeDataCompleteness(gymProfile, financialSignals, retentionSignals, salesSignals);

  const ctx: TieredContext = {
    gymProfile,
    financialSignals: allowedTiers.includes("financialSignals") ? financialSignals : {},
    retentionSignals: allowedTiers.includes("retentionSignals") ? retentionSignals : {},
    salesSignals: allowedTiers.includes("salesSignals") ? salesSignals : {},
    ownerStabilitySignals: allowedTiers.includes("ownerStabilitySignals") ? ownerStabilitySignals : {},
    recentInterventions: [],
    gymArchetype,
    dataCompletenessScore,
  };

  return ctx;
}

export function flattenContextForLegacy(ctx: TieredContext): Record<string, number | undefined> {
  return {
    activeMembers: ctx.gymProfile.activeMembers,
    rsi: ctx.retentionSignals.rsi,
    churnRate: ctx.financialSignals.churnRate,
    mrr: ctx.financialSignals.mrr,
    ltv: ctx.financialSignals.ltv,
    arm: ctx.financialSignals.arm,
    newLeads: ctx.salesSignals.newLeads,
    conversionRate: ctx.salesSignals.conversionRate !== undefined ? Math.round(ctx.salesSignals.conversionRate * 100) : undefined,
  };
}
