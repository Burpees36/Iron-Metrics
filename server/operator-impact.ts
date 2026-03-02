import type { TieredContext } from "./operator-context";
import type { OperatorPill, ProjectedImpact } from "@shared/schema";

const DEFAULT_ARM = 150;
const DEFAULT_MONTHS_REMAINING = 4;

interface LiftConfig {
  baseLift: number;
  archetypeBoost: Record<string, number>;
}

const PILL_LIFT_CONFIG: Record<OperatorPill, LiftConfig> = {
  retention: {
    baseLift: 0.12,
    archetypeBoost: { growth: 0.03, stable: 0.01, declining: 0.04, startup: 0.02 },
  },
  sales: {
    baseLift: 0.10,
    archetypeBoost: { growth: 0.05, stable: 0.02, declining: 0.01, startup: 0.04 },
  },
  coaching: {
    baseLift: 0.08,
    archetypeBoost: { growth: 0.02, stable: 0.02, declining: 0.03, startup: 0.01 },
  },
  community: {
    baseLift: 0.08,
    archetypeBoost: { growth: 0.02, stable: 0.03, declining: 0.02, startup: 0.03 },
  },
  owner: {
    baseLift: 0.10,
    archetypeBoost: { growth: 0.02, stable: 0.01, declining: 0.05, startup: 0.02 },
  },
};

function getMembersAffected(ctx: TieredContext, pill: OperatorPill): number {
  switch (pill) {
    case "retention":
      return ctx.retentionSignals.atRiskMembers ?? Math.round(ctx.gymProfile.activeMembers * 0.15);
    case "sales":
      return ctx.salesSignals.newLeads ?? Math.round(ctx.gymProfile.activeMembers * 0.1);
    case "coaching":
      return ctx.retentionSignals.disengagedCount ?? Math.round(ctx.gymProfile.activeMembers * 0.1);
    case "community":
      return ctx.retentionSignals.disengagedCount ?? Math.round(ctx.gymProfile.activeMembers * 0.12);
    case "owner": {
      const churnRate = ctx.financialSignals.churnRate ?? 5;
      return Math.max(1, Math.round(ctx.gymProfile.activeMembers * (churnRate / 100)));
    }
  }
}

function getMonthsRemaining(pill: OperatorPill, ctx: TieredContext): number {
  if (pill === "retention") return DEFAULT_MONTHS_REMAINING;
  if (pill === "sales") return 6;
  if (pill === "owner") return ctx.gymArchetype === "declining" ? 3 : 6;
  return 5;
}

function computeUrgencyMultiplier(ctx: TieredContext): number {
  let urgency = 1.0;

  if (ctx.financialSignals.churnTrend !== undefined && ctx.financialSignals.churnTrend > 0) {
    urgency += 0.2;
  }

  if (ctx.retentionSignals.rsiTrend !== undefined && ctx.retentionSignals.rsiTrend < -2) {
    urgency += 0.15;
  }

  if (ctx.gymArchetype === "declining") {
    urgency += 0.15;
  }

  return Math.min(urgency, 1.5);
}

export function computeProjectedImpact(ctx: TieredContext, pill: OperatorPill): ProjectedImpact {
  const membersAffected = getMembersAffected(ctx, pill);
  const arm = ctx.financialSignals.arm ?? DEFAULT_ARM;
  const monthsRemaining = getMonthsRemaining(pill, ctx);

  const liftConfig = PILL_LIFT_CONFIG[pill];
  const archetypeBoost = liftConfig.archetypeBoost[ctx.gymArchetype] ?? 0;
  const estimatedLiftPct = liftConfig.baseLift + archetypeBoost;

  const urgencyMultiplier = computeUrgencyMultiplier(ctx);

  const rawImpact = membersAffected * arm * monthsRemaining * estimatedLiftPct;
  const expectedRevenueImpact = Math.round(rawImpact * urgencyMultiplier);

  let impactTier: ProjectedImpact["impact_tier"];
  if (expectedRevenueImpact >= 2000) impactTier = "High";
  else if (expectedRevenueImpact >= 500) impactTier = "Moderate";
  else impactTier = "Low";

  return {
    members_affected: membersAffected,
    arm: Math.round(arm),
    months_remaining: monthsRemaining,
    estimated_lift_pct: Math.round(estimatedLiftPct * 1000) / 10,
    expected_revenue_impact: expectedRevenueImpact,
    impact_tier: impactTier,
    urgency_multiplier: Math.round(urgencyMultiplier * 100) / 100,
  };
}

export function formatImpactSummary(impact: ProjectedImpact): string {
  return `${impact.members_affected} members × $${impact.arm} ARM × ${impact.months_remaining} months × ${impact.estimated_lift_pct}% lift ≈ $${impact.expected_revenue_impact.toLocaleString()} projected retention preservation`;
}
