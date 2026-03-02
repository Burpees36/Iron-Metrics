import { storage } from "./storage";
import { computeSalesSummary } from "./sales-intelligence";
import type { OperatorPill } from "@shared/schema";

export interface OperatorContext {
  rsi?: number;
  rsiTrend?: number;
  atRiskMembers?: number;
  first90DayChurn?: number;
  arm?: number;
  ltv?: number;
  churnRate?: number;
  mrr?: number;
  activeMembers?: number;
  newLeads?: number;
  showRate?: number;
  closeRate?: number;
  speedToLeadMin?: number;
  salesHealthScore?: number;
  conversionRate?: number;
  revenuePerLead?: number;
}

export async function buildOperatorContext(gymId: string, pill: OperatorPill): Promise<OperatorContext> {
  const ctx: OperatorContext = {};

  const allMetrics = await storage.getAllMonthlyMetrics(gymId);
  const latest = allMetrics.length > 0 ? allMetrics[allMetrics.length - 1] : null;
  const prevMonth = allMetrics.length > 1 ? allMetrics[allMetrics.length - 2] : null;

  if (latest) {
    ctx.rsi = latest.rsi;
    ctx.arm = Number(latest.arm);
    ctx.ltv = Number(latest.ltv);
    ctx.churnRate = Number(latest.churnRate);
    ctx.mrr = Number(latest.mrr);
    ctx.activeMembers = latest.activeMembers;

    if (prevMonth) {
      ctx.rsiTrend = latest.rsi - prevMonth.rsi;
    }
  }

  if (pill === "retention" || pill === "owner" || pill === "coaching") {
    const members = await storage.getMembersByGym(gymId);
    const now = new Date();

    const activeMembers = members.filter(m => m.status === "active");
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const newMemberRisk = activeMembers.filter(m => {
      const joinDate = new Date(m.joinDate);
      return joinDate >= sixtyDaysAgo;
    }).length;

    const disengagingRisk = activeMembers.filter(m => {
      if (m.lastAttendedDate) {
        return new Date(m.lastAttendedDate) < fourteenDaysAgo;
      }
      return false;
    }).length;

    ctx.atRiskMembers = newMemberRisk + disengagingRisk;

    const cancelledMembers = members.filter(m => m.status === "cancelled" && m.cancelDate && m.joinDate);
    const cancelledBefore90 = cancelledMembers.filter(m => {
      const join = new Date(m.joinDate);
      const cancel = new Date(m.cancelDate!);
      const daysDiff = (cancel.getTime() - join.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 90;
    });
    if (cancelledMembers.length > 0) {
      ctx.first90DayChurn = Math.round((cancelledBefore90.length / cancelledMembers.length) * 1000) / 10;
    }
  }

  if (pill === "sales" || pill === "owner") {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const leads = await storage.getLeadsByGym(gymId, thirtyDaysAgo, now);
    const consults = await storage.getConsultsByGym(gymId, thirtyDaysAgo, now);
    const memberships = await storage.getSalesMembershipsByGym(gymId, thirtyDaysAgo, now);
    const payments = await storage.getPaymentsByGym(gymId, thirtyDaysAgo, now);

    const summary = computeSalesSummary(leads, consults, memberships, payments);
    ctx.newLeads = summary.counts.leads;
    ctx.showRate = summary.rates.showRate ?? undefined;
    ctx.closeRate = summary.rates.closeRate ?? undefined;
    ctx.speedToLeadMin = summary.speed.responseMedianMin ?? undefined;
    ctx.salesHealthScore = summary.composite.salesHealthScore;
    ctx.conversionRate = summary.rates.funnelConversion ?? undefined;
    ctx.revenuePerLead = summary.revenue.revenuePerLead ?? undefined;
  }

  return ctx;
}
