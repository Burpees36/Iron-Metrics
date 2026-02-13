import { storage } from "./storage";
import type { Member } from "@shared/schema";

export async function computeMonthlyMetrics(gymId: string, monthStart: string) {
  const monthDate = new Date(monthStart + "T00:00:00");
  const nextMonth = new Date(monthDate);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const monthEnd = new Date(nextMonth);
  monthEnd.setDate(monthEnd.getDate() - 1);
  const monthEndStr = monthEnd.toISOString().slice(0, 10);
  const lastDayOfMonth = monthEndStr;

  const activeMembers = await storage.getActiveMembers(gymId, lastDayOfMonth);
  const newMembers = await storage.getNewMembers(gymId, monthStart, lastDayOfMonth);
  const cancels = await storage.getCancels(gymId, monthStart, lastDayOfMonth);
  const activeStartOfMonth = await storage.getActiveStartOfMonth(gymId, monthStart);

  const activeMemberCount = activeMembers.length;
  const newMemberCount = newMembers.length;
  const cancelCount = cancels.length;

  const churnRate = activeStartOfMonth > 0
    ? parseFloat(((cancelCount / activeStartOfMonth) * 100).toFixed(2))
    : 0;

  const mrr = activeMembers.reduce((sum, m) => sum + Number(m.monthlyRate), 0);
  const arm = activeMemberCount > 0 ? mrr / activeMemberCount : 0;

  const avgChurn = churnRate > 0 ? churnRate / 100 : 0.05;
  const avgLifespan = avgChurn > 0 ? 1 / avgChurn : 20;
  const ltv = arm * avgLifespan;

  let rollingChurn3m: number | null = null;
  const prev1 = getPrevMonth(monthStart, 1);
  const prev2 = getPrevMonth(monthStart, 2);
  const m1 = await storage.getMonthlyMetrics(gymId, prev1);
  const m2 = await storage.getMonthlyMetrics(gymId, prev2);

  if (m1 && m2) {
    rollingChurn3m = parseFloat(
      ((Number(m2.churnRate) + Number(m1.churnRate) + churnRate) / 3).toFixed(2)
    );
  }

  const rsi = computeRSI(churnRate, activeMembers, cancelCount, newMemberCount, activeStartOfMonth);
  const res = computeRES(mrr, activeMemberCount, arm);
  const ltveImpact = computeLTVEImpact(arm, churnRate);
  const memberRiskCount = computeRiskCount(activeMembers, monthDate);

  return storage.upsertMonthlyMetrics({
    gymId,
    monthStart,
    activeMembers: activeMemberCount,
    activeStartOfMonth,
    newMembers: newMemberCount,
    cancels: cancelCount,
    churnRate: String(churnRate),
    rollingChurn3m: rollingChurn3m !== null ? String(rollingChurn3m) : null,
    mrr: String(parseFloat(mrr.toFixed(2))),
    arm: String(parseFloat(arm.toFixed(2))),
    ltv: String(parseFloat(ltv.toFixed(2))),
    rsi,
    res: String(parseFloat(res.toFixed(1))),
    ltveImpact: String(parseFloat(ltveImpact.toFixed(2))),
    memberRiskCount,
  });
}

function computeRSI(
  churnRate: number,
  activeMembers: Member[],
  cancelCount: number,
  newMemberCount: number,
  activeStartOfMonth: number
): number {
  let score = 100;

  if (churnRate > 10) score -= 40;
  else if (churnRate > 7) score -= 25;
  else if (churnRate > 5) score -= 15;
  else if (churnRate > 3) score -= 5;

  if (activeStartOfMonth > 0) {
    const earlyChurnRatio = cancelCount / Math.max(activeStartOfMonth, 1);
    if (earlyChurnRatio > 0.1) score -= 15;
    else if (earlyChurnRatio > 0.05) score -= 8;
  }

  const now = new Date();
  const tenureMonths = activeMembers.map((m) => {
    const joinDate = new Date(m.joinDate + "T00:00:00");
    return (now.getFullYear() - joinDate.getFullYear()) * 12 + (now.getMonth() - joinDate.getMonth());
  });

  if (tenureMonths.length > 0) {
    const avgTenure = tenureMonths.reduce((a, b) => a + b, 0) / tenureMonths.length;
    if (avgTenure >= 12) score += 10;
    else if (avgTenure >= 6) score += 5;
    else if (avgTenure < 3) score -= 10;
  }

  if (newMemberCount > 0 && activeStartOfMonth > 0) {
    const growthRate = newMemberCount / activeStartOfMonth;
    if (growthRate > 0.05) score += 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function computeRES(mrr: number, activeMemberCount: number, arm: number): number {
  let score = 0;

  if (arm >= 150) score += 40;
  else if (arm >= 100) score += 30;
  else if (arm >= 75) score += 20;
  else score += 10;

  if (activeMemberCount >= 200) score += 30;
  else if (activeMemberCount >= 100) score += 25;
  else if (activeMemberCount >= 50) score += 20;
  else if (activeMemberCount >= 20) score += 15;
  else score += 5;

  if (mrr >= 30000) score += 30;
  else if (mrr >= 15000) score += 25;
  else if (mrr >= 5000) score += 15;
  else score += 5;

  return Math.min(100, score);
}

function computeLTVEImpact(arm: number, churnRate: number): number {
  if (churnRate <= 0 || arm <= 0) return 0;
  const currentChurnDecimal = churnRate / 100;
  const reducedChurnDecimal = (churnRate - 1) / 100;

  if (currentChurnDecimal <= 0.01) return 0;

  const currentLTV = arm / currentChurnDecimal;
  const improvedLTV = reducedChurnDecimal > 0 ? arm / reducedChurnDecimal : arm * 100;
  const ltvDelta = improvedLTV - currentLTV;

  return ltvDelta * 12;
}

function computeRiskCount(activeMembers: Member[], monthDate: Date): number {
  let riskCount = 0;
  for (const member of activeMembers) {
    const joinDate = new Date(member.joinDate + "T00:00:00");
    const tenureMonths = (monthDate.getFullYear() - joinDate.getFullYear()) * 12 +
      (monthDate.getMonth() - joinDate.getMonth());

    if (tenureMonths <= 2) {
      riskCount++;
    }
  }
  return riskCount;
}

function countConsecutiveAbove(values: number[], threshold: number): number {
  let count = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] >= threshold) count++;
    else break;
  }
  return count;
}

function getPrevMonth(monthStart: string, monthsBack: number): string {
  const d = new Date(monthStart + "T00:00:00");
  d.setMonth(d.getMonth() - monthsBack);
  return d.toISOString().slice(0, 10);
}

export async function recomputeAllMetrics(gymId: string) {
  const allMembers = await storage.getMembersByGym(gymId);
  if (allMembers.length === 0) return;

  const dates = allMembers.map((m) => new Date(m.joinDate + "T00:00:00"));
  const cancelDates = allMembers
    .filter((m) => m.cancelDate)
    .map((m) => new Date(m.cancelDate! + "T00:00:00"));

  const allDates = [...dates, ...cancelDates];
  const earliest = new Date(Math.min(...allDates.map((d) => d.getTime())));
  earliest.setDate(1);

  const now = new Date();
  now.setDate(1);

  const current = new Date(earliest);
  while (current <= now) {
    const monthStr = current.toISOString().slice(0, 10);
    await computeMonthlyMetrics(gymId, monthStr);
    current.setMonth(current.getMonth() + 1);
  }
}

export interface MetricReport {
  metric: string;
  current: string;
  target: string;
  impact: string;
  meaning: string;
  whyItMatters: string;
  action: string;
  trendDirection: "up" | "down" | "stable" | "none";
  trendValue: string;
}

export function generateMetricReports(metrics: {
  activeMembers: number;
  churnRate: number;
  mrr: number;
  arm: number;
  ltv: number;
  rsi: number;
  res: number;
  ltveImpact: number;
  memberRiskCount: number;
  rollingChurn3m: number | null;
  newMembers: number;
  cancels: number;
}, trendData?: {
  prev1?: { rsi: number; churnRate: number; mrr: number; arm: number; ltv: number; memberRiskCount: number; activeMembers: number };
  prev2?: { rsi: number; churnRate: number; mrr: number; arm: number; ltv: number; memberRiskCount: number; activeMembers: number };
  prev3?: { rsi: number; churnRate: number; mrr: number; arm: number; ltv: number; memberRiskCount: number; activeMembers: number };
}): MetricReport[] {
  const reports: MetricReport[] = [];

  function get90DayTrend(currentVal: number, key: "rsi" | "churnRate" | "mrr" | "arm" | "ltv" | "memberRiskCount" | "activeMembers"): { direction: "up" | "down" | "stable" | "none"; value: string } {
    if (!trendData?.prev3 && !trendData?.prev2 && !trendData?.prev1) {
      return { direction: "none", value: "Insufficient data" };
    }
    const baseline = trendData?.prev3?.[key] ?? trendData?.prev2?.[key] ?? trendData?.prev1?.[key];
    if (baseline === undefined || baseline === null) {
      return { direction: "none", value: "Insufficient data" };
    }
    const delta = currentVal - baseline;
    const pct = baseline !== 0 ? ((delta / baseline) * 100).toFixed(1) : "0";
    if (Math.abs(delta) < 0.01) return { direction: "stable", value: "Stable" };
    if (delta > 0) return { direction: "up", value: `+${pct}%` };
    return { direction: "down", value: `${pct}%` };
  }

  const churnTarget = 5;
  const churnDiff = metrics.churnRate - churnTarget;
  const annualImpact = churnDiff > 0
    ? Math.round(metrics.arm * (churnDiff / 100) * metrics.activeMembers * 12)
    : 0;
  const churnTrend = get90DayTrend(metrics.churnRate, "churnRate");

  reports.push({
    metric: "Monthly Churn",
    current: `${metrics.churnRate}%`,
    target: `${churnTarget}%`,
    impact: annualImpact > 0
      ? `+$${annualImpact.toLocaleString()} annual revenue if reduced to target`
      : "On track",
    meaning: metrics.churnRate > 7
      ? "Your current churn rate indicates significant revenue volatility over the next 6-12 months. Immediate attention required."
      : metrics.churnRate > 5
        ? "Churn is above the stability threshold. Members are leaving before building lasting habits."
        : "Retention is solid. Members are staying and building routines.",
    whyItMatters: "Churn is the single largest driver of revenue instability. Every percentage point above target erodes predictable income and increases acquisition cost pressure.",
    action: metrics.churnRate > 5
      ? "Prioritize outreach to members showing attendance decline. Implement a structured 30-day check-in for all new members."
      : "Maintain current retention systems. Look for early warning signals before they become cancellations.",
    trendDirection: churnTrend.direction === "up" ? "down" : churnTrend.direction === "down" ? "up" : churnTrend.direction,
    trendValue: churnTrend.value,
  });

  const rsiTrend = get90DayTrend(metrics.rsi, "rsi");
  reports.push({
    metric: "Retention Stability Index",
    current: `${metrics.rsi}/100`,
    target: "80/100",
    impact: metrics.rsi < 60
      ? "High risk of revenue instability in the next quarter"
      : metrics.rsi < 80
        ? "Moderate retention risk requires proactive intervention"
        : "Strong foundation for predictable revenue",
    meaning: metrics.rsi >= 80
      ? "Your retention ecosystem is healthy. Members are staying, engaging, and contributing to a stable revenue base."
      : metrics.rsi >= 60
        ? "Retention has vulnerabilities. Membership age distribution or early cancellation patterns suggest room for improvement."
        : "Retention is unstable. Multiple indicators suggest members are not embedding into your community fast enough.",
    whyItMatters: "RSI is the composite health indicator of your gym's financial resilience. It synthesizes churn, tenure, early cancellation, and growth into a single stability signal.",
    action: metrics.rsi < 60
      ? "Implement a structured onboarding sequence for the first 90 days. Focus on building social connections through group programming."
      : metrics.rsi < 80
        ? "Review early cancellation trends. Investigate what happens in months 2-4 of membership that causes drop-off."
        : "Continue investing in community events and member milestones to reinforce belonging.",
    trendDirection: rsiTrend.direction,
    trendValue: rsiTrend.value,
  });

  const armTrend = get90DayTrend(metrics.arm, "arm");
  reports.push({
    metric: "Revenue per Member",
    current: `$${metrics.arm.toFixed(0)}`,
    target: "$150+",
    impact: metrics.arm < 150
      ? `+$${Math.round((150 - metrics.arm) * metrics.activeMembers).toLocaleString()} monthly if ARM reaches target`
      : "Revenue per member is optimized",
    meaning: metrics.arm >= 150
      ? "Average revenue per member is strong. This suggests healthy tier distribution or effective value-add services."
      : metrics.arm >= 100
        ? "Revenue per member is moderate. Opportunities exist to introduce premium offerings or adjust pricing."
        : "Revenue per member is low. Pricing may not reflect the value delivered.",
    whyItMatters: "Revenue per member determines how efficiently your roster generates income. Higher ARM means you need fewer members to achieve the same revenue, reducing dependency on constant growth.",
    action: metrics.arm < 100
      ? "Review pricing tiers. Consider introducing a premium tier with personal training or specialized programming."
      : metrics.arm < 150
        ? "Explore upsell opportunities: nutrition coaching, recovery services, or accountability programs."
        : "Focus on retention and member acquisition rather than further price optimization.",
    trendDirection: armTrend.direction,
    trendValue: armTrend.value,
  });

  const ltvTrend = get90DayTrend(metrics.ltv, "ltv");
  const targetChurn = Math.max(metrics.churnRate - 1.8, 2);
  const currentChurnDec = metrics.churnRate / 100;
  const targetChurnDec = targetChurn / 100;
  const currentLTV = currentChurnDec > 0 ? metrics.arm / currentChurnDec : 0;
  const targetLTV = targetChurnDec > 0 ? metrics.arm / targetChurnDec : 0;
  const ltvScenarioDelta = targetLTV - currentLTV;

  reports.push({
    metric: "Lifetime Value Engine",
    current: `$${Math.round(metrics.ltv).toLocaleString()}`,
    target: "$3,000+",
    impact: metrics.ltveImpact > 0
      ? `If churn drops from ${metrics.churnRate}% to ${targetChurn.toFixed(1)}%: +$${Math.round(ltvScenarioDelta).toLocaleString()} LTV per member`
      : "LTV is maximized at current churn levels",
    meaning: metrics.ltv >= 3000
      ? "Member lifetime value is excellent. Each member represents significant long-term revenue."
      : metrics.ltv >= 1500
        ? "LTV is moderate. Improving retention or pricing would compound significantly over time."
        : "LTV is below optimal. High churn is eroding long-term revenue potential.",
    whyItMatters: "Lifetime value quantifies the total revenue each member will generate. Small improvements in retention create outsized financial returns because the compounding effect works in your favor.",
    action: metrics.ltv < 1500
      ? "Focus on the first 90 days of membership. Members who survive the first quarter are 3x more likely to stay a year."
      : metrics.ltv < 3000
        ? "Invest in member milestone celebrations and community programming to extend average membership duration."
        : "LTV is strong. Consider referral programs to acquire similar high-value members.",
    trendDirection: ltvTrend.direction,
    trendValue: ltvTrend.value,
  });

  const riskTrend = get90DayTrend(metrics.memberRiskCount, "memberRiskCount");
  const riskPct = metrics.activeMembers > 0
    ? ((metrics.memberRiskCount / metrics.activeMembers) * 100).toFixed(1)
    : "0";
  const riskTier = metrics.memberRiskCount > metrics.activeMembers * 0.15
    ? "High"
    : metrics.memberRiskCount > metrics.activeMembers * 0.08
      ? "Moderate"
      : metrics.memberRiskCount > 0
        ? "Low"
        : "Clear";

  reports.push({
    metric: "Member Risk Radar",
    current: `${metrics.memberRiskCount} flagged (${riskPct}%)`,
    target: "< 10% of roster",
    impact: metrics.memberRiskCount > 0
      ? `$${Math.round(metrics.memberRiskCount * metrics.arm).toLocaleString()}/mo revenue at risk`
      : "No members currently flagged",
    meaning: riskTier === "High"
      ? "A significant portion of your roster shows early-stage risk signals. These members are in their first 60 days with historically high drop-off rates."
      : riskTier === "Moderate"
        ? "Some newer members need attention. Early engagement is the strongest predictor of long-term retention."
        : riskTier === "Low"
          ? "A small number of new members are in the risk window. Targeted outreach can prevent cancellation."
          : "No members are currently in the high-risk window. Your onboarding is working.",
    whyItMatters: "Members in their first 60 days are 3-5x more likely to cancel than tenured members. Proactive intervention during this window has the highest retention ROI of any action you can take.",
    action: riskTier === "High"
      ? "Immediate action required. Personally reach out to every flagged member this week. Schedule goal-setting sessions and introduce them to regular class attendees."
      : metrics.memberRiskCount > 0
        ? "Reach out to flagged members within their first 2 weeks. A personal connection dramatically reduces early cancellation risk."
        : "Continue monitoring. Review new member engagement patterns through their first 90 days.",
    trendDirection: riskTrend.direction === "up" ? "down" : riskTrend.direction === "down" ? "up" : riskTrend.direction,
    trendValue: riskTrend.value,
  });

  const netGrowth = metrics.newMembers - metrics.cancels;
  const growthRate = metrics.activeMembers > 0
    ? ((netGrowth / metrics.activeMembers) * 100).toFixed(1)
    : "0";
  const membersTrend = get90DayTrend(metrics.activeMembers, "activeMembers");

  reports.push({
    metric: "Net Member Growth",
    current: `${netGrowth >= 0 ? "+" : ""}${netGrowth} (${growthRate}%)`,
    target: "Positive net growth",
    impact: netGrowth < 0
      ? `Losing ${Math.abs(netGrowth)} members/month compounds to significant revenue erosion`
      : netGrowth === 0
        ? "No forward momentum. Every month flat is a month without compounding."
        : `+${netGrowth} members adds ~$${Math.round(netGrowth * metrics.arm).toLocaleString()}/mo`,
    meaning: netGrowth > 0
      ? "Your gym is growing. New members are outpacing cancellations. Momentum is building."
      : netGrowth === 0
        ? "Stable roster — but no forward momentum. Acquisition is matching attrition exactly."
        : "Your roster is contracting. Every month without correction accelerates the decline.",
    whyItMatters: "Net growth is the clearest signal of roster momentum. Negative growth compounds monthly — it doesn't just stall revenue, it erodes community. Positive growth builds financial resilience and culture simultaneously.",
    action: netGrowth < 0
      ? "Address retention first before increasing acquisition spend. Reducing churn by 1-2% is more cost-effective than acquiring replacement members."
      : netGrowth === 0
        ? "Flat growth is friction, not stability. Evaluate acquisition channels and consider member referral incentives to break through the plateau."
        : "Sustain current momentum. Ensure new members are well-onboarded to prevent growth from masking rising churn.",
    trendDirection: membersTrend.direction,
    trendValue: membersTrend.value,
  });

  return reports;
}

export interface Forecast {
  nextMonthMrr: number;
  mrrChange: number;
  churnTrajectory: string;
  projectedChurn: number;
  ifNothingChanges: {
    mrrIn3Months: number;
    membersIn3Months: number;
    revenueAtRisk: number;
  };
  outlook: string;
}

export function generateForecast(metricsHistory: {
  activeMembers: number;
  churnRate: string | number;
  mrr: string | number;
  arm: string | number;
  newMembers: number;
  cancels: number;
}[]): Forecast {
  const current = metricsHistory[0];
  if (!current) {
    return {
      nextMonthMrr: 0,
      mrrChange: 0,
      churnTrajectory: "Insufficient data",
      projectedChurn: 0,
      ifNothingChanges: { mrrIn3Months: 0, membersIn3Months: 0, revenueAtRisk: 0 },
      outlook: "Not enough data to project.",
    };
  }

  const churnRate = Number(current.churnRate);
  const mrr = Number(current.mrr);
  const arm = Number(current.arm);
  const members = current.activeMembers;
  const netGrowth = current.newMembers - current.cancels;

  const projectedMembers = Math.max(0, members + netGrowth);
  const projectedMrr = projectedMembers * arm;
  const mrrChange = projectedMrr - mrr;

  let churnTrajectory: string;
  let projectedChurn = churnRate;
  if (metricsHistory.length >= 3) {
    const churnValues = metricsHistory.slice(0, 3).map((m) => Number(m.churnRate));
    const churnTrend = churnValues[0] - churnValues[2];
    if (churnTrend > 1) {
      churnTrajectory = "Rising — churn is accelerating";
      projectedChurn = Math.min(churnRate + (churnTrend / 2), 100);
    } else if (churnTrend < -1) {
      churnTrajectory = "Declining — retention is improving";
      projectedChurn = Math.max(churnRate + (churnTrend / 2), 0);
    } else {
      churnTrajectory = "Holding steady";
      projectedChurn = churnRate;
    }
  } else {
    churnTrajectory = "Insufficient history for trend";
  }

  const monthlyChurnDec = projectedChurn / 100;
  let m3Members = members;
  let m3Mrr = mrr;
  for (let i = 0; i < 3; i++) {
    const lost = Math.round(m3Members * monthlyChurnDec);
    const gained = current.newMembers;
    m3Members = Math.max(0, m3Members - lost + gained);
    m3Mrr = m3Members * arm;
  }
  const revenueAtRisk = Math.max(0, mrr - m3Mrr) * 3;

  let outlook: string;
  if (churnRate <= 3 && netGrowth > 0) {
    outlook = "Strong position. Revenue is predictable and growing. Maintain current systems.";
  } else if (churnRate <= 5 && netGrowth >= 0) {
    outlook = "Stable but watchful. No immediate risk, but forward momentum is limited.";
  } else if (churnRate <= 7) {
    outlook = "Attention needed. Churn is eroding gains. Retention interventions will have the highest ROI.";
  } else {
    outlook = "Urgent action required. Current trajectory leads to meaningful revenue loss within 90 days.";
  }

  return {
    nextMonthMrr: Math.round(projectedMrr),
    mrrChange: Math.round(mrrChange),
    churnTrajectory,
    projectedChurn: parseFloat(projectedChurn.toFixed(1)),
    ifNothingChanges: {
      mrrIn3Months: Math.round(m3Mrr),
      membersIn3Months: m3Members,
      revenueAtRisk: Math.round(revenueAtRisk),
    },
    outlook,
  };
}

export interface TrendInsight {
  chartKey: string;
  status: "positive" | "warning" | "critical" | "neutral";
  headline: string;
  detail: string;
}

export interface TrendProjection {
  month: string;
  mrr: number | null;
  members: number | null;
  churn: number | null;
  rsi: number | null;
  arm: number | null;
  netGrowth: number | null;
  projected: boolean;
}

export interface CorrelationInsight {
  title: string;
  detail: string;
  status: "positive" | "warning" | "neutral";
}

export interface TrendIntelligence {
  insights: TrendInsight[];
  projections: TrendProjection[];
  correlations: CorrelationInsight[];
  stabilityVerdict: {
    status: "strengthening" | "plateauing" | "drifting";
    headline: string;
    detail: string;
  };
}

export function generateTrendIntelligence(
  metricsHistory: {
    monthStart: string;
    activeMembers: number;
    churnRate: string | number;
    mrr: string | number;
    arm: string | number;
    rsi: number;
    newMembers: number;
    cancels: number;
    ltv: string | number;
    memberRiskCount: number;
  }[]
): TrendIntelligence {
  const sorted = [...metricsHistory].sort((a, b) => a.monthStart.localeCompare(b.monthStart));
  const insights: TrendInsight[] = [];
  const correlations: CorrelationInsight[] = [];

  if (sorted.length === 0) {
    return {
      insights: [],
      projections: [],
      correlations: [],
      stabilityVerdict: { status: "plateauing", headline: "Insufficient data", detail: "Import members and recompute to generate intelligence." },
    };
  }

  const latest = sorted[sorted.length - 1];
  const latestChurn = Number(latest.churnRate);
  const latestRsi = latest.rsi;
  const latestMrr = Number(latest.mrr);
  const latestArm = Number(latest.arm);
  const latestMembers = latest.activeMembers;

  const rsiValues = sorted.map((m) => m.rsi);
  const consecutiveStable = countConsecutiveAbove(rsiValues, 80);
  if (consecutiveStable >= 3) {
    insights.push({
      chartKey: "rsi",
      status: "positive",
      headline: `Retention stable for ${consecutiveStable} consecutive months`,
      detail: "Your retention ecosystem is healthy and consistent. Members are staying and building habits.",
    });
  } else if (latestRsi >= 80) {
    insights.push({
      chartKey: "rsi",
      status: "positive",
      headline: "Retention is healthy this month",
      detail: "RSI is in the stable zone. Continue current retention practices.",
    });
  } else if (latestRsi >= 60) {
    insights.push({
      chartKey: "rsi",
      status: "warning",
      headline: "Retention needs attention",
      detail: `RSI at ${latestRsi} is below the stability threshold of 80. Investigate early cancellation patterns.`,
    });
  } else {
    insights.push({
      chartKey: "rsi",
      status: "critical",
      headline: "Retention is unstable",
      detail: `RSI at ${latestRsi} signals significant membership volatility. Immediate action on onboarding and engagement required.`,
    });
  }

  if (sorted.length >= 2) {
    const prev = sorted[sorted.length - 2];
    const prevChurn = Number(prev.churnRate);
    const churnDelta = latestChurn - prevChurn;

    if (churnDelta > 2) {
      insights.push({
        chartKey: "churn",
        status: "critical",
        headline: `Churn spike detected: ${prevChurn.toFixed(1)}% to ${latestChurn.toFixed(1)}%`,
        detail: "A sharp increase in cancellations suggests a systemic issue. Check for seasonal patterns, pricing changes, or service quality shifts.",
      });
    } else if (latestChurn <= 5) {
      const belowTarget = sorted.filter((m) => Number(m.churnRate) <= 5).length;
      insights.push({
        chartKey: "churn",
        status: "positive",
        headline: `Churn within target at ${latestChurn.toFixed(1)}%`,
        detail: belowTarget >= 3
          ? `Churn has been at or below 5% for ${belowTarget} months. Strong retention discipline.`
          : "Churn is under control this month. Maintain outreach to at-risk members.",
      });
    } else if (latestChurn > 7) {
      insights.push({
        chartKey: "churn",
        status: "critical",
        headline: `Churn elevated at ${latestChurn.toFixed(1)}%`,
        detail: "Above 7% monthly churn erodes revenue faster than most gyms can acquire new members. This is the top priority.",
      });
    } else {
      insights.push({
        chartKey: "churn",
        status: "warning",
        headline: `Churn at ${latestChurn.toFixed(1)}% — above 5% target`,
        detail: "Moderately elevated churn. Focus on members in their first 60 days — that's where most cancellations originate.",
      });
    }

    const prevMrr = Number(prev.mrr);
    const mrrGrowth = prevMrr > 0 ? ((latestMrr - prevMrr) / prevMrr) * 100 : 0;
    if (mrrGrowth > 3) {
      insights.push({
        chartKey: "mrr",
        status: "positive",
        headline: `MRR growing: +${mrrGrowth.toFixed(1)}% month-over-month`,
        detail: `Revenue increased from $${prevMrr.toLocaleString()} to $${latestMrr.toLocaleString()}. Momentum is building.`,
      });
    } else if (mrrGrowth < -3) {
      insights.push({
        chartKey: "mrr",
        status: "critical",
        headline: `MRR declining: ${mrrGrowth.toFixed(1)}% month-over-month`,
        detail: `Revenue dropped from $${prevMrr.toLocaleString()} to $${latestMrr.toLocaleString()}. Address churn before investing in acquisition.`,
      });
    } else {
      insights.push({
        chartKey: "mrr",
        status: "neutral",
        headline: `MRR holding steady at $${latestMrr.toLocaleString()}`,
        detail: "Revenue is flat. Growth requires either more members or higher revenue per member.",
      });
    }

    const prevMembers = prev.activeMembers;
    const memberDelta = latestMembers - prevMembers;
    if (memberDelta > 0) {
      insights.push({
        chartKey: "members",
        status: "positive",
        headline: `Roster growing: +${memberDelta} members this month`,
        detail: "New signups are outpacing cancellations. Ensure onboarding keeps up with growth.",
      });
    } else if (memberDelta < -2) {
      insights.push({
        chartKey: "members",
        status: "warning",
        headline: `Roster contracting: ${memberDelta} members this month`,
        detail: "More members leaving than joining. Without correction, this compounds monthly.",
      });
    } else {
      insights.push({
        chartKey: "members",
        status: "neutral",
        headline: `Roster stable at ${latestMembers} active members`,
        detail: "No significant change in member count. Consider acquisition strategies to build forward momentum.",
      });
    }

    const prevArm = Number(prev.arm);
    const armDelta = latestArm - prevArm;
    if (armDelta > 5) {
      insights.push({
        chartKey: "arm",
        status: "positive",
        headline: `Revenue per member increasing: $${latestArm.toFixed(0)}`,
        detail: "Average revenue per member is trending up. This may reflect premium tier adoption or pricing adjustments.",
      });
    } else if (armDelta < -5) {
      insights.push({
        chartKey: "arm",
        status: "warning",
        headline: `Revenue per member declining: $${latestArm.toFixed(0)}`,
        detail: "ARM is dropping — likely driven by lower-tier signups or promotional pricing. Monitor pricing mix.",
      });
    } else {
      insights.push({
        chartKey: "arm",
        status: "neutral",
        headline: `Revenue per member steady at $${latestArm.toFixed(0)}`,
        detail: latestArm >= 150 ? "ARM is in a healthy range. Focus on retention over pricing changes." : "ARM is below the $150 target. Consider introducing premium programming or pricing adjustments.",
      });
    }

    const netGrowth = latest.newMembers - latest.cancels;
    if (netGrowth > 0) {
      insights.push({
        chartKey: "netGrowth",
        status: "positive",
        headline: `Positive net growth: +${netGrowth} members`,
        detail: `${latest.newMembers} new joins vs ${latest.cancels} cancellations. Forward momentum is building.`,
      });
    } else if (netGrowth < 0) {
      insights.push({
        chartKey: "netGrowth",
        status: "critical",
        headline: `Negative net growth: ${netGrowth} members`,
        detail: `Losing ${Math.abs(netGrowth)} members per month compounds rapidly. Retention must be the top priority.`,
      });
    } else {
      insights.push({
        chartKey: "netGrowth",
        status: "neutral",
        headline: "Net growth is flat",
        detail: "Joins equal cancellations exactly. The gym is treading water — not growing, not shrinking.",
      });
    }
  } else {
    insights.push(
      { chartKey: "churn", status: "neutral", headline: `Current churn: ${latestChurn.toFixed(1)}%`, detail: "Not enough history for trend analysis yet." },
      { chartKey: "mrr", status: "neutral", headline: `Current MRR: $${latestMrr.toLocaleString()}`, detail: "Build more months of data to see revenue trends." },
      { chartKey: "members", status: "neutral", headline: `${latestMembers} active members`, detail: "More data needed for member trend analysis." },
      { chartKey: "arm", status: "neutral", headline: `ARM: $${latestArm.toFixed(0)}`, detail: "Track over time to identify pricing trends." },
      { chartKey: "netGrowth", status: "neutral", headline: `Net: ${latest.newMembers - latest.cancels}`, detail: "More months needed for growth trend." },
    );
  }

  const projections: TrendProjection[] = sorted.map((m) => ({
    month: m.monthStart,
    mrr: Number(m.mrr),
    members: m.activeMembers,
    churn: Number(m.churnRate),
    rsi: m.rsi,
    arm: Number(m.arm),
    netGrowth: m.newMembers - m.cancels,
    projected: false,
  }));

  if (sorted.length >= 2) {
    const last = sorted[sorted.length - 1];
    const churnDec = Number(last.churnRate) / 100;
    const avgNewMembers = sorted.length >= 3
      ? Math.round(sorted.slice(-3).reduce((s, m) => s + m.newMembers, 0) / 3)
      : last.newMembers;
    const arm = Number(last.arm);

    let projMembers = last.activeMembers;
    let projMrr = Number(last.mrr);
    let projRsi = last.rsi;
    let projChurn = Number(last.churnRate);

    for (let i = 1; i <= 3; i++) {
      const d = new Date(last.monthStart + "T00:00:00");
      d.setMonth(d.getMonth() + i);
      const monthStr = d.toISOString().slice(0, 10);

      const lost = Math.round(projMembers * churnDec);
      projMembers = Math.max(0, projMembers - lost + avgNewMembers);
      projMrr = projMembers * arm;
      const netGrowth = avgNewMembers - lost;

      if (projChurn > 7) projRsi = Math.max(0, projRsi - 3);
      else if (projChurn > 5) projRsi = Math.max(0, projRsi - 1);
      else projRsi = Math.min(100, projRsi + 1);

      projections.push({
        month: monthStr,
        mrr: Math.round(projMrr),
        members: projMembers,
        churn: parseFloat(projChurn.toFixed(1)),
        rsi: Math.round(projRsi),
        arm: Math.round(arm),
        netGrowth,
        projected: true,
      });
    }
  }

  if (sorted.length >= 3) {
    const recent3 = sorted.slice(-3);
    const mrrValues = recent3.map((m) => Number(m.mrr));
    const memberValues = recent3.map((m) => m.activeMembers);
    const armValues = recent3.map((m) => Number(m.arm));
    const churnValues = recent3.map((m) => Number(m.churnRate));

    const mrrGrowing = mrrValues[2] > mrrValues[0];
    const membersGrowing = memberValues[2] > memberValues[0];
    const armGrowing = armValues[2] > armValues[0];

    if (mrrGrowing && membersGrowing && !armGrowing) {
      correlations.push({
        title: "MRR growth driven by member count, not pricing",
        detail: "Revenue is increasing because you're adding members, but average revenue per member isn't rising. Consider premium tier opportunities.",
        status: "neutral",
      });
    } else if (mrrGrowing && armGrowing && !membersGrowing) {
      correlations.push({
        title: "MRR growth driven by pricing, not volume",
        detail: "Revenue is up because existing members are paying more on average. This is efficient but has a ceiling — growth will require new members eventually.",
        status: "positive",
      });
    } else if (mrrGrowing && membersGrowing && armGrowing) {
      correlations.push({
        title: "Dual-engine growth: more members AND higher revenue each",
        detail: "Both member count and average revenue are rising. This is the strongest possible growth pattern.",
        status: "positive",
      });
    }

    const churnRising = churnValues[2] > churnValues[0] + 1;
    const membersDecreasing = memberValues[2] < memberValues[0];
    if (churnRising && membersDecreasing) {
      correlations.push({
        title: "Churn spike correlates with member decline",
        detail: "Rising cancellation rates are directly causing roster contraction. Retention should be prioritized over acquisition.",
        status: "warning",
      });
    }

    const newMemberTrend = recent3.map((m) => m.newMembers);
    const mrrRising = mrrValues[2] > mrrValues[0];
    if (newMemberTrend[2] > newMemberTrend[0] && mrrRising) {
      correlations.push({
        title: "New member influx is lifting revenue",
        detail: "Acquisition momentum is translating into revenue growth. Ensure onboarding quality keeps pace with volume.",
        status: "positive",
      });
    }

    const riskValues = recent3.map((m) => m.memberRiskCount);
    if (riskValues[2] > riskValues[0] + 2) {
      correlations.push({
        title: "At-risk member count is rising",
        detail: "More members are entering the risk window (first 60 days). This may precede a churn spike in 1-2 months if not addressed.",
        status: "warning",
      });
    }
  }

  let stabilityVerdict: TrendIntelligence["stabilityVerdict"];
  if (sorted.length >= 3) {
    const recent = sorted.slice(-3);
    const rsiTrend = recent[2].rsi - recent[0].rsi;
    const mrrTrend = Number(recent[2].mrr) - Number(recent[0].mrr);
    const churnAvg = recent.reduce((s, m) => s + Number(m.churnRate), 0) / 3;

    if (rsiTrend > 5 && mrrTrend > 0 && churnAvg <= 5) {
      stabilityVerdict = {
        status: "strengthening",
        headline: "This business is strengthening",
        detail: "RSI is trending up, revenue is growing, and churn is controlled. Your retention systems are working. Stay the course.",
      };
    } else if (rsiTrend < -5 || churnAvg > 7) {
      stabilityVerdict = {
        status: "drifting",
        headline: "This business is drifting toward instability",
        detail: "Key stability indicators are declining. Without intervention, expect revenue erosion and community fragility within 90 days.",
      };
    } else {
      stabilityVerdict = {
        status: "plateauing",
        headline: "This business is plateauing",
        detail: "Metrics are flat — not declining, but not building momentum. A plateau often precedes drift if left unaddressed.",
      };
    }
  } else {
    stabilityVerdict = {
      status: "plateauing",
      headline: "Building your stability baseline",
      detail: "More months of data will reveal whether this business is strengthening, plateauing, or drifting.",
    };
  }

  return { insights, projections, correlations, stabilityVerdict };
}
