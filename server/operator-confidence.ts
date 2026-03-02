import type { TieredContext } from "./operator-context";
import type { OperatorPill } from "@shared/schema";

export interface ConfidenceResult {
  score: number;
  label: "Low" | "Med" | "High";
  reasons: string[];
}

export function computeConfidence(ctx: TieredContext, pill: OperatorPill): ConfidenceResult {
  let score = 0;
  const reasons: string[] = [];

  const months = ctx.gymProfile.monthsOfData;
  if (months >= 6) {
    score += 15;
    reasons.push("6+ months of historical data");
  } else if (months >= 3) {
    score += 10;
    reasons.push("3-5 months of historical data");
  } else if (months >= 1) {
    score += 5;
    reasons.push("Limited historical data (1-2 months)");
  } else {
    reasons.push("No historical metric data available");
  }

  if (ctx.gymProfile.activeMembers >= 50) {
    score += 10;
  } else if (ctx.gymProfile.activeMembers >= 20) {
    score += 7;
  } else if (ctx.gymProfile.activeMembers > 0) {
    score += 3;
    reasons.push("Small member base — patterns may be less reliable");
  }

  if (ctx.gymProfile.hasSalesData) {
    score += 5;
  } else if (pill === "sales") {
    reasons.push("No sales funnel data available");
  }

  const pillSignals = getPillSignalCount(ctx, pill);
  if (pillSignals >= 5) {
    score += 30;
    reasons.push("Strong signal coverage for this focus area");
  } else if (pillSignals >= 3) {
    score += 20;
    reasons.push("Moderate signal coverage");
  } else if (pillSignals >= 1) {
    score += 10;
    reasons.push("Limited signals for this focus area");
  } else {
    reasons.push("No relevant signals — output is general best practice only");
  }

  if (ctx.financialSignals.mrrTrend !== undefined && ctx.financialSignals.churnTrend !== undefined) {
    const mrrVolatile = Math.abs(ctx.financialSignals.mrrTrend) > (ctx.financialSignals.mrr ?? 1) * 0.2;
    const churnVolatile = Math.abs(ctx.financialSignals.churnTrend) > 3;

    if (!mrrVolatile && !churnVolatile) {
      score += 15;
    } else if (mrrVolatile || churnVolatile) {
      score += 8;
      reasons.push("Recent metric volatility detected — recommendation may need adjustment");
    }
  } else if (months >= 2) {
    score += 10;
  }

  if (months >= 1) {
    score += 15;
  } else {
    reasons.push("No recent data — confidence reduced");
  }

  score = Math.min(score, 100);

  let label: ConfidenceResult["label"];
  if (score >= 70) label = "High";
  else if (score >= 40) label = "Med";
  else label = "Low";

  return { score, label, reasons };
}

function getPillSignalCount(ctx: TieredContext, pill: OperatorPill): number {
  let count = 0;
  switch (pill) {
    case "retention":
      if (ctx.retentionSignals.rsi !== undefined) count++;
      if (ctx.retentionSignals.rsiTrend !== undefined) count++;
      if (ctx.retentionSignals.atRiskMembers !== undefined) count++;
      if (ctx.retentionSignals.first90DayChurn !== undefined) count++;
      if (ctx.retentionSignals.disengagedCount !== undefined) count++;
      if (ctx.financialSignals.churnRate !== undefined) count++;
      break;
    case "sales":
      if (ctx.salesSignals.newLeads !== undefined) count++;
      if (ctx.salesSignals.showRate !== undefined) count++;
      if (ctx.salesSignals.closeRate !== undefined) count++;
      if (ctx.salesSignals.salesHealthScore !== undefined) count++;
      if (ctx.salesSignals.conversionRate !== undefined) count++;
      if (ctx.salesSignals.speedToLeadMin !== undefined) count++;
      break;
    case "coaching":
      if (ctx.retentionSignals.rsi !== undefined) count++;
      if (ctx.retentionSignals.atRiskMembers !== undefined) count++;
      if (ctx.retentionSignals.disengagedCount !== undefined) count++;
      if (ctx.gymProfile.hasAttendanceData) count++;
      break;
    case "community":
      if (ctx.retentionSignals.rsi !== undefined) count++;
      if (ctx.retentionSignals.memberGrowthRate !== undefined) count++;
      if (ctx.gymProfile.activeMembers > 0) count++;
      break;
    case "owner":
      if (ctx.financialSignals.mrr !== undefined) count++;
      if (ctx.financialSignals.churnRate !== undefined) count++;
      if (ctx.retentionSignals.rsi !== undefined) count++;
      if (ctx.salesSignals.salesHealthScore !== undefined) count++;
      if (ctx.ownerStabilitySignals.rsiDirection !== undefined) count++;
      if (ctx.financialSignals.mrrTrend !== undefined) count++;
      break;
  }
  return count;
}

export function buildReasoningSummary(ctx: TieredContext, pill: OperatorPill): string {
  const parts: string[] = [];

  if (ctx.retentionSignals.rsiTrend !== undefined) {
    const dir = ctx.retentionSignals.rsiTrend > 0 ? "improving" : ctx.retentionSignals.rsiTrend < 0 ? "declining" : "stable";
    parts.push(`${dir} RSI trend`);
  }

  if (ctx.retentionSignals.atRiskMembers !== undefined && ctx.retentionSignals.atRiskMembers > 0) {
    parts.push(`${ctx.retentionSignals.atRiskMembers} at-risk members`);
  }

  if (ctx.retentionSignals.first90DayChurn !== undefined && ctx.retentionSignals.first90DayChurn > 0) {
    parts.push(`${ctx.retentionSignals.first90DayChurn}% first-90-day churn`);
  }

  if (pill === "sales" || pill === "owner") {
    if (ctx.salesSignals.conversionRate !== undefined) {
      parts.push(`${Math.round(ctx.salesSignals.conversionRate * 100)}% funnel conversion`);
    }
    if (ctx.salesSignals.salesHealthScore !== undefined) {
      parts.push(`Sales Health Score ${ctx.salesSignals.salesHealthScore}/100`);
    }
  }

  if (ctx.financialSignals.churnRate !== undefined) {
    parts.push(`${ctx.financialSignals.churnRate}% monthly churn`);
  }

  if (ctx.gymArchetype !== "stable") {
    parts.push(`${ctx.gymArchetype} gym profile`);
  }

  if (parts.length === 0) {
    return "Based on: general best practices (limited data available).";
  }

  return `Based on: ${parts.slice(0, 4).join(", ")}.`;
}
