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
      ? "You're losing too many members. If this keeps up, revenue will feel it within a few months."
      : metrics.churnRate > 5
        ? "Churn is above where you want it. Members are leaving before they build lasting habits."
        : "Retention is solid. Members are staying and building routines.",
    whyItMatters: "Churn is the biggest threat to predictable revenue. If it creeps up, you'll feel it fast — and replacing lost members costs more than keeping the ones you have.",
    action: metrics.churnRate > 5
      ? "Reach out to members who seem to be fading. Set up a 30-day check-in for every new member — catch drift early."
      : "Things are working. Keep an eye out for early warning signs and continue building meaningful relationships.",
    trendDirection: churnTrend.direction === "up" ? "down" : churnTrend.direction === "down" ? "up" : churnTrend.direction,
    trendValue: churnTrend.value,
  });

  const rsiTrend = get90DayTrend(metrics.rsi, "rsi");
  reports.push({
    metric: "Retention Stability Index",
    current: `${metrics.rsi}/100`,
    target: "80/100",
    impact: metrics.rsi < 60
      ? "Revenue is at risk if retention doesn't improve soon"
      : metrics.rsi < 80
        ? "Some retention issues to address before they get worse"
        : "Strong foundation — revenue should stay predictable",
    meaning: metrics.rsi >= 80
      ? "Your retention is elite. You have established a baseline of excellence as members are staying, building habits, and contributing to a stable revenue base."
      : metrics.rsi >= 60
        ? "Retention is leaking. You are loosing members in the transition from 'new' to 'committed.'"
        : "Retention is weak. Members are exiting before they ever see results because you haven't integrated them into the culture properly, and it's showing in the numbers.",
    whyItMatters: "RSI rolls up churn, tenure, early cancellations, and growth into one number. It's the clearest single read on whether your gym is building lasting membership or just cycling through new faces.",
    action: metrics.rsi < 60
      ? "Stop focusing on the workout and start focusing on the person. Rebuild your first 90-day protocol today. If they don't have a personal connection to a coach by Day 14, you've already lost them."
      : metrics.rsi < 80
        ? "Audit your 3 Month touchpoints immediately. Identify the exact week engagement drops and insert a mandatory coach intervention. You are leaving revenue on the table through hesitation."
        : "Keep doing what's working but don't mistake stability for a ceiling. Invest in community events and celebrate milestones to reinforce belonging.",
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
      ? "Revenue per member is strong and reflects the value you provide. You have successfully tiered your services to match your member commitment."
      : metrics.arm >= 100
        ? "Your revenue is stagnant. You are providing more value than you are capturing. This is a failure of your sales process or a lack of high-tier offerings."
        : "Your business is undervalued. You are running a high-volume, low-margin model that will lead to burnout and failure.",
    whyItMatters: "The more revenue each member generates, the less pressure you have to constantly chase new signups. Higher revenue per member means more financial breathing room.",
    action: metrics.arm < 100
      ? "You are undercharging because a lack of confidence to demand what your results are worth. Raise your rates or restructure your tiers immediately."
      : metrics.arm < 150
        ? "Look at add-on opportunities: nutrition coaching, personal training, specialized workshops, or recovery services. Move your 'decent' members into 'committed' revenue."
        : "Optimize these high-value relationships. Excellence is not a destination; it's a baseline. Maintain the margin.",
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
      ? "Each member is worth a lot over their lifetime. Your retention and pricing are working together well."
      : metrics.ltv >= 1500
        ? "Your business is stable but inefficient. You are working harder than necessary for every dollar. Even small gains here are the difference between a gym and a thriving community."
        : "Your business model is unsustainable. You are burning through leads and exhausting your local market.",
    whyItMatters: "Lifetime value tells you the total revenue a member will generate before they leave. When you keep members longer, every month compounds — small retention wins create outsized revenue gains.",
    action: metrics.ltv < 1500
      ? "Stop spending money on marketing and start fixing your culture. Your highest leverage move is a total audit of your member journey from Day 1 to Day 90."
      : metrics.ltv < 3000
        ? "Celebrate milestones, build community, and give members reasons to stay beyond the workout itself."
        : "Reinvest. Use this predictable capital to upgrade your facility, hire eliete talent, or scale your acquistion. Do not sit on this lead; widen the gap between you and the competition.",
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
      ? "A lot of your members are showing signs they might leave and are disengaging. This is a reflection of your habit-building protocols."
      : riskTier === "Moderate"
        ? "Some newer members need attention. 'Moderate' risk is a sign that your onboarding is passive, not proactive."
        : riskTier === "Low"
          ? "A small number of members are in the risk window. A little personal outreach can make the difference."
          : "Nobody is flagged right now. Your onboarding is doing its job.",
    whyItMatters: "New members are 3-5x more likely to cancel than members who've been around a while. Reaching out early is the single most effective thing you can do to keep them.",
    action: riskTier === "High"
      ? "You need to execute a 'Personal Intervention' for every flagged member. Do not delegate this to a mass email. Call them. Re-establish their 'Why'."
      : metrics.memberRiskCount > 0
        ? "Reach out to every flagged member within 2 weeks. A personal connection from a coach dramatically reduces the chance they cancel."
        : "Use this stability to optimize. Reach out to your most engaged new members and document why they are succeeding. Use those insights to further strengthen your protocols Complacency is the enemy of retention.",
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
        ? "You are running in place. Every new member is replacing a departure."
        : "Your business is in a state of contraction. You are loosing members faster than you can replace them.",
    whyItMatters: "When you're losing more members than you're gaining, it compounds fast — each month gets harder. When you're growing, momentum builds and makes everything easier.",
    action: netGrowth < 0
      ? "Your sole objective for the next 30 days is fixing retention. Call members who have left in the last 60 days. Find the truth. Fix the experience."
      : netGrowth === 0
        ? "Flat isn't stable — it's stalled. Launch a referral program or community event to break through the plateau. If you don't change the input, the output will remain zero."
        : "Keep the momentum going. Audit your onboarding capacity immediately. If you scale faster than your culture can absorb, your churn will spike in 90 days.",
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
    outlook = "Attention needed. Churn is eating into your gains. Fixing retention is the best move right now.";
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

export interface MicroKpi {
  chartKey: string;
  currentValue: string;
  mom: string | null;
  momDirection: "up" | "down" | "flat";
  yoy: string | null;
  yoyDirection: "up" | "down" | "flat";
  trend: "accelerating" | "decelerating" | "stable";
}

export interface TrendProjection {
  month: string;
  mrr: number | null;
  members: number | null;
  churn: number | null;
  rsi: number | null;
  arm: number | null;
  netGrowth: number | null;
  joins: number | null;
  cancels: number | null;
  cumulativeNetGrowth: number | null;
  projected: boolean;
}

export interface CorrelationInsight {
  title: string;
  detail: string;
  status: "positive" | "warning" | "neutral";
}

export interface NinetyDayOutlook {
  revenue: { status: "stable" | "growing" | "at-risk" | "declining"; label: string };
  memberCount: { status: "stable" | "growing" | "at-risk" | "declining"; label: string };
  churn: { status: "within-tolerance" | "elevated" | "critical"; label: string };
  interventionRequired: "none" | "low" | "moderate" | "high";
}

export interface TargetPath {
  month: string;
  currentTrajectory: number;
  targetTrajectory: number;
}

export interface TimelineEvent {
  month: string;
  type: "churn-spike" | "growth-plateau" | "rsi-drop" | "mrr-inflection" | "milestone";
  description: string;
  severity: "info" | "warning" | "critical";
}

export interface StrategicRecommendation {
  area: string;
  status: "priority" | "maintain" | "monitor";
  headline: string;
  detail: string;
}

export interface TrendIntelligence {
  insights: TrendInsight[];
  microKpis: MicroKpi[];
  projections: TrendProjection[];
  correlations: CorrelationInsight[];
  stabilityScore: {
    score: number;
    tier: "stable" | "plateau-risk" | "early-drift" | "instability-risk";
    headline: string;
    detail: string;
    components: {
      rsiSlope: { score: number; label: string };
      churnAvg: { score: number; label: string };
      netGrowth: { score: number; label: string };
      revenueMomentum: { score: number; label: string };
    };
  };
  ninetyDayOutlook: NinetyDayOutlook;
  targetPath: TargetPath[];
  timelineEvents: TimelineEvent[];
  strategicRecommendations: StrategicRecommendation[];
  growthEngine: {
    cumulativeData: { month: string; cumulative: number; joins: number; cancels: number }[];
    totalNetGrowth: number;
    totalMonths: number;
  };
}

function linearSlope(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

function pctChange(current: number, previous: number): { value: string; direction: "up" | "down" | "flat" } {
  if (previous === 0 && current === 0) return { value: "0%", direction: "flat" };
  if (previous === 0) return { value: current > 0 ? "+100%" : "-100%", direction: current > 0 ? "up" : "down" };
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pct) < 0.5) return { value: "0%", direction: "flat" };
  return { value: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`, direction: pct > 0 ? "up" : "down" };
}

function determineTrend(values: number[]): "accelerating" | "decelerating" | "stable" {
  if (values.length < 3) return "stable";
  const recent = values.slice(-3);
  const d1 = recent[1] - recent[0];
  const d2 = recent[2] - recent[1];
  if (d2 > d1 + 0.5) return "accelerating";
  if (d2 < d1 - 0.5) return "decelerating";
  return "stable";
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
      microKpis: [],
      projections: [],
      correlations: [],
      stabilityScore: { score: 0, tier: "plateau-risk", headline: "Insufficient data", detail: "Import members and recompute to generate intelligence.", components: { rsiSlope: { score: 0, label: "No data" }, churnAvg: { score: 0, label: "No data" }, netGrowth: { score: 0, label: "No data" }, revenueMomentum: { score: 0, label: "No data" } } },
      ninetyDayOutlook: { revenue: { status: "stable", label: "Insufficient data" }, memberCount: { status: "stable", label: "Insufficient data" }, churn: { status: "within-tolerance", label: "Insufficient data" }, interventionRequired: "none" },
      targetPath: [],
      timelineEvents: [],
      strategicRecommendations: [],
      growthEngine: { cumulativeData: [], totalNetGrowth: 0, totalMonths: 0 },
    };
  }

  const latest = sorted[sorted.length - 1];
  const latestChurn = Number(latest.churnRate);
  const latestRsi = latest.rsi;
  const latestMrr = Number(latest.mrr);
  const latestArm = Number(latest.arm);
  const latestMembers = latest.activeMembers;

  // ── STABILITY SCORE ENGINE ──
  // Composite from 4 components, each scored 0-25, total 0-100
  const rsiValues = sorted.map((m) => m.rsi);
  const churnValues = sorted.map((m) => Number(m.churnRate));
  const mrrValues = sorted.map((m) => Number(m.mrr));
  const memberValues = sorted.map((m) => m.activeMembers);

  const recent3 = sorted.length >= 3 ? sorted.slice(-3) : sorted;
  const churn3mo = recent3.reduce((s, m) => s + Number(m.churnRate), 0) / recent3.length;
  const netGrowth3mo = recent3.reduce((s, m) => s + (m.newMembers - m.cancels), 0);

  // Component 1: RSI Slope (0-25)
  const rsiSlope3 = sorted.length >= 3 ? linearSlope(sorted.slice(-3).map((m) => m.rsi)) : 0;
  let rsiSlopeScore: number;
  let rsiSlopeLabel: string;
  if (latestRsi >= 80 && rsiSlope3 >= -1) {
    rsiSlopeScore = 25;
    rsiSlopeLabel = "RSI stable in healthy zone";
  } else if (latestRsi >= 80 && rsiSlope3 < -1) {
    rsiSlopeScore = 20;
    rsiSlopeLabel = "RSI healthy but trending down";
  } else if (rsiSlope3 > 2) {
    rsiSlopeScore = 22;
    rsiSlopeLabel = "RSI recovering quickly";
  } else if (rsiSlope3 > 0) {
    rsiSlopeScore = 18;
    rsiSlopeLabel = "RSI improving slowly";
  } else if (latestRsi >= 60 && rsiSlope3 >= -2) {
    rsiSlopeScore = 15;
    rsiSlopeLabel = "RSI moderate, slight drift";
  } else if (rsiSlope3 < -3) {
    rsiSlopeScore = 5;
    rsiSlopeLabel = "RSI declining rapidly";
  } else {
    rsiSlopeScore = 10;
    rsiSlopeLabel = "RSI below target";
  }

  // Component 2: 3-Month Churn Average (0-25)
  let churnAvgScore: number;
  let churnAvgLabel: string;
  if (churn3mo <= 2) {
    churnAvgScore = 25;
    churnAvgLabel = "Excellent retention";
  } else if (churn3mo <= 4) {
    churnAvgScore = 22;
    churnAvgLabel = "Strong retention";
  } else if (churn3mo <= 5) {
    churnAvgScore = 18;
    churnAvgLabel = "Within target";
  } else if (churn3mo <= 7) {
    churnAvgScore = 12;
    churnAvgLabel = "Above target";
  } else if (churn3mo <= 10) {
    churnAvgScore = 6;
    churnAvgLabel = "Elevated churn";
  } else {
    churnAvgScore = 2;
    churnAvgLabel = "Critical churn";
  }

  // Component 3: Net Growth Trend (0-25)
  let netGrowthScore: number;
  let netGrowthLabel: string;
  const avgNetGrowthPerMonth = netGrowth3mo / recent3.length;
  if (avgNetGrowthPerMonth > 3) {
    netGrowthScore = 25;
    netGrowthLabel = "Strong positive growth";
  } else if (avgNetGrowthPerMonth > 1) {
    netGrowthScore = 22;
    netGrowthLabel = "Moderate growth";
  } else if (avgNetGrowthPerMonth > 0) {
    netGrowthScore = 18;
    netGrowthLabel = "Slight growth";
  } else if (avgNetGrowthPerMonth >= -1) {
    netGrowthScore = 14;
    netGrowthLabel = "Flat — no momentum";
  } else if (avgNetGrowthPerMonth >= -3) {
    netGrowthScore = 8;
    netGrowthLabel = "Contracting";
  } else {
    netGrowthScore = 3;
    netGrowthLabel = "Rapid contraction";
  }

  // Component 4: Revenue Momentum (0-25)
  const mrrSlope3 = sorted.length >= 3 ? linearSlope(sorted.slice(-3).map((m) => Number(m.mrr))) : 0;
  const mrrPctChange = latestMrr > 0 ? (mrrSlope3 / latestMrr) * 100 : 0;
  let revMomentumScore: number;
  let revMomentumLabel: string;
  if (mrrPctChange > 3) {
    revMomentumScore = 25;
    revMomentumLabel = "Revenue accelerating";
  } else if (mrrPctChange > 1) {
    revMomentumScore = 22;
    revMomentumLabel = "Revenue growing";
  } else if (mrrPctChange > -1) {
    revMomentumScore = 18;
    revMomentumLabel = "Revenue stable";
  } else if (mrrPctChange > -3) {
    revMomentumScore = 10;
    revMomentumLabel = "Revenue softening";
  } else {
    revMomentumScore = 4;
    revMomentumLabel = "Revenue declining";
  }

  const totalScore = rsiSlopeScore + churnAvgScore + netGrowthScore + revMomentumScore;

  let tier: "stable" | "plateau-risk" | "early-drift" | "instability-risk";
  let stabilityHeadline: string;
  let stabilityDetail: string;
  if (totalScore >= 75) {
    tier = "stable";
    stabilityHeadline = "This business is stable";
    stabilityDetail = `Stability Score: ${totalScore}/100. Retention, revenue, and growth are all in healthy ranges. Continue current systems and invest in what's working.`;
  } else if (totalScore >= 55) {
    tier = "plateau-risk";
    stabilityHeadline = "Plateau risk detected";
    stabilityDetail = `Stability Score: ${totalScore}/100. Core metrics are holding but not building momentum. Without intentional growth, this position tends to erode over 3-6 months.`;
  } else if (totalScore >= 35) {
    tier = "early-drift";
    stabilityHeadline = "Early drift — attention required";
    stabilityDetail = `Stability Score: ${totalScore}/100. Multiple indicators are softening. Targeted interventions in the weakest areas can reverse this trend within 60-90 days.`;
  } else {
    tier = "instability-risk";
    stabilityHeadline = "Instability risk — action required";
    stabilityDetail = `Stability Score: ${totalScore}/100. Significant weakness across retention, growth, or revenue. Immediate focus on the lowest-scoring component is critical.`;
  }

  // ── INSIGHTS ──
  const consecutiveStable = countConsecutiveAbove(rsiValues, 80);
  if (consecutiveStable >= 3) {
    insights.push({ chartKey: "rsi", status: "positive", headline: `Retention stable for ${consecutiveStable} consecutive months`, detail: "Your retention ecosystem is healthy and consistent. Members are staying and building habits." });
  } else if (latestRsi >= 80) {
    insights.push({ chartKey: "rsi", status: "positive", headline: "Retention is healthy this month", detail: "RSI is in the stable zone. Continue current retention practices." });
  } else if (latestRsi >= 60) {
    insights.push({ chartKey: "rsi", status: "warning", headline: "Retention needs attention", detail: `RSI at ${latestRsi} is below the stability threshold of 80. Investigate early cancellation patterns.` });
  } else {
    insights.push({ chartKey: "rsi", status: "critical", headline: "Retention is unstable", detail: `RSI at ${latestRsi} signals significant membership volatility. Immediate action on onboarding and engagement required.` });
  }

  if (sorted.length >= 2) {
    const prev = sorted[sorted.length - 2];
    const prevChurn = Number(prev.churnRate);
    const churnDelta = latestChurn - prevChurn;

    if (churnDelta > 2) {
      insights.push({ chartKey: "churn", status: "critical", headline: `Churn spike: ${prevChurn.toFixed(1)}% to ${latestChurn.toFixed(1)}%`, detail: "A sharp increase in cancellations suggests a systemic issue. Check for seasonal patterns, pricing changes, or service quality shifts." });
    } else if (latestChurn <= 5) {
      const belowTarget = sorted.filter((m) => Number(m.churnRate) <= 5).length;
      insights.push({ chartKey: "churn", status: "positive", headline: `Churn within target at ${latestChurn.toFixed(1)}%`, detail: belowTarget >= 3 ? `Churn has been at or below 5% for ${belowTarget} months. Strong retention discipline.` : "Churn is under control this month. Maintain outreach to at-risk members." });
    } else if (latestChurn > 7) {
      insights.push({ chartKey: "churn", status: "critical", headline: `Churn elevated at ${latestChurn.toFixed(1)}%`, detail: "Above 7% monthly churn erodes revenue faster than most gyms can acquire new members. This is the top priority." });
    } else {
      insights.push({ chartKey: "churn", status: "warning", headline: `Churn at ${latestChurn.toFixed(1)}% — above 5% target`, detail: "Moderately elevated churn. Focus on members in their first 60 days — that's where most cancellations originate." });
    }

    const prevMrr = Number(prev.mrr);
    const mrrGrowth = prevMrr > 0 ? ((latestMrr - prevMrr) / prevMrr) * 100 : 0;
    if (mrrGrowth > 3) {
      insights.push({ chartKey: "mrr", status: "positive", headline: `MRR growing: +${mrrGrowth.toFixed(1)}% month-over-month`, detail: `Revenue increased from $${prevMrr.toLocaleString()} to $${latestMrr.toLocaleString()}. Momentum is building.` });
    } else if (mrrGrowth < -3) {
      insights.push({ chartKey: "mrr", status: "critical", headline: `MRR declining: ${mrrGrowth.toFixed(1)}% month-over-month`, detail: `Revenue dropped from $${prevMrr.toLocaleString()} to $${latestMrr.toLocaleString()}. Address churn before investing in acquisition.` });
    } else {
      insights.push({ chartKey: "mrr", status: "neutral", headline: `MRR holding steady at $${latestMrr.toLocaleString()}`, detail: "Revenue is flat. Growth requires either more members or higher revenue per member." });
    }

    const prevMembers = prev.activeMembers;
    const memberDelta = latestMembers - prevMembers;
    if (memberDelta > 0) {
      insights.push({ chartKey: "members", status: "positive", headline: `Roster growing: +${memberDelta} members this month`, detail: "New signups are outpacing cancellations. Ensure onboarding keeps up with growth." });
    } else if (memberDelta < -2) {
      insights.push({ chartKey: "members", status: "warning", headline: `Roster contracting: ${memberDelta} members this month`, detail: "More members leaving than joining. Without correction, this compounds monthly." });
    } else {
      insights.push({ chartKey: "members", status: "neutral", headline: `Roster stable at ${latestMembers} active members`, detail: "No significant change in member count. Consider acquisition strategies to build forward momentum." });
    }

    const prevArm = Number(prev.arm);
    const armDelta = latestArm - prevArm;
    if (armDelta > 5) {
      insights.push({ chartKey: "arm", status: "positive", headline: `Revenue per member increasing: $${latestArm.toFixed(0)}`, detail: "Average revenue per member is trending up. This may reflect premium tier adoption or pricing adjustments." });
    } else if (armDelta < -5) {
      insights.push({ chartKey: "arm", status: "warning", headline: `Revenue per member declining: $${latestArm.toFixed(0)}`, detail: "ARM is dropping — likely driven by lower-tier signups or promotional pricing. Monitor pricing mix." });
    } else {
      insights.push({ chartKey: "arm", status: "neutral", headline: `Revenue per member steady at $${latestArm.toFixed(0)}`, detail: latestArm >= 150 ? "ARM is in a healthy range. Focus on retention over pricing changes." : "ARM is below the $150 target. Consider introducing premium programming or pricing adjustments." });
    }

    const netGrowth = latest.newMembers - latest.cancels;
    if (netGrowth > 0) {
      insights.push({ chartKey: "netGrowth", status: "positive", headline: `Positive net growth: +${netGrowth} members`, detail: `${latest.newMembers} new joins vs ${latest.cancels} cancellations. Forward momentum is building.` });
    } else if (netGrowth < 0) {
      insights.push({ chartKey: "netGrowth", status: "critical", headline: `Negative net growth: ${netGrowth} members`, detail: `Losing ${Math.abs(netGrowth)} members per month compounds rapidly. Retention must be the top priority.` });
    } else {
      insights.push({ chartKey: "netGrowth", status: "neutral", headline: "Net growth is flat", detail: "Joins equal cancellations exactly. The gym is treading water — not growing, not shrinking." });
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

  // ── MICRO KPIs ──
  const microKpis: MicroKpi[] = [];
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  const yoyEntry = sorted.length >= 13 ? sorted[sorted.length - 13] : null;

  function buildKpi(key: string, current: number, prevVal: number | null, yoyVal: number | null, formatter: (v: number) => string, values: number[]): MicroKpi {
    const momChange = prevVal !== null ? pctChange(current, prevVal) : null;
    const yoyChange = yoyVal !== null ? pctChange(current, yoyVal) : null;
    return {
      chartKey: key,
      currentValue: formatter(current),
      mom: momChange?.value ?? null,
      momDirection: momChange?.direction ?? "flat",
      yoy: yoyChange?.value ?? null,
      yoyDirection: yoyChange?.direction ?? "flat",
      trend: determineTrend(values),
    };
  }

  microKpis.push(buildKpi("rsi", latestRsi, prev ? prev.rsi : null, yoyEntry ? yoyEntry.rsi : null, (v) => `${v}/100`, rsiValues));
  microKpis.push(buildKpi("mrr", latestMrr, prev ? Number(prev.mrr) : null, yoyEntry ? Number(yoyEntry.mrr) : null, (v) => `$${v.toLocaleString()}`, mrrValues));
  microKpis.push(buildKpi("members", latestMembers, prev ? prev.activeMembers : null, yoyEntry ? yoyEntry.activeMembers : null, (v) => `${v}`, memberValues));
  microKpis.push(buildKpi("churn", latestChurn, prev ? Number(prev.churnRate) : null, yoyEntry ? Number(yoyEntry.churnRate) : null, (v) => `${v.toFixed(1)}%`, churnValues));
  microKpis.push(buildKpi("arm", latestArm, prev ? Number(prev.arm) : null, yoyEntry ? Number(yoyEntry.arm) : null, (v) => `$${v.toFixed(0)}`, sorted.map((m) => Number(m.arm))));

  // ── PROJECTIONS + GROWTH ENGINE ──
  let cumulativeNet = 0;
  const cumulativeData: { month: string; cumulative: number; joins: number; cancels: number }[] = [];

  const projections: TrendProjection[] = sorted.map((m) => {
    const net = m.newMembers - m.cancels;
    cumulativeNet += net;
    cumulativeData.push({
      month: m.monthStart,
      cumulative: cumulativeNet,
      joins: m.newMembers,
      cancels: m.cancels,
    });
    return {
      month: m.monthStart,
      mrr: Number(m.mrr),
      members: m.activeMembers,
      churn: Number(m.churnRate),
      rsi: m.rsi,
      arm: Number(m.arm),
      netGrowth: net,
      joins: m.newMembers,
      cancels: m.cancels,
      cumulativeNetGrowth: cumulativeNet,
      projected: false,
    };
  });

  if (sorted.length >= 2) {
    const last = sorted[sorted.length - 1];
    const churnDec = Number(last.churnRate) / 100;
    const avgNewMembers = sorted.length >= 3
      ? Math.round(sorted.slice(-3).reduce((s, m) => s + m.newMembers, 0) / 3)
      : last.newMembers;
    const arm = Number(last.arm);
    let projMembers = last.activeMembers;
    let projRsi = last.rsi;
    let projChurn = Number(last.churnRate);

    for (let i = 1; i <= 3; i++) {
      const d = new Date(last.monthStart + "T00:00:00");
      d.setMonth(d.getMonth() + i);
      const monthStr = d.toISOString().slice(0, 10);
      const lost = Math.round(projMembers * churnDec);
      projMembers = Math.max(0, projMembers - lost + avgNewMembers);
      const projMrr = projMembers * arm;
      const netGrowth = avgNewMembers - lost;
      cumulativeNet += netGrowth;

      if (projChurn > 7) projRsi = Math.max(0, projRsi - 3);
      else if (projChurn > 5) projRsi = Math.max(0, projRsi - 1);
      else projRsi = Math.min(100, projRsi + 1);

      projections.push({ month: monthStr, mrr: Math.round(projMrr), members: projMembers, churn: parseFloat(projChurn.toFixed(1)), rsi: Math.round(projRsi), arm: Math.round(arm), netGrowth, joins: avgNewMembers, cancels: lost, cumulativeNetGrowth: cumulativeNet, projected: true });
    }
  }

  // ── 90-DAY OUTLOOK ──
  const projected3 = projections.filter((p) => p.projected);
  const lastActual = projections.filter((p) => !p.projected).slice(-1)[0];
  let ninetyDayOutlook: NinetyDayOutlook;

  if (projected3.length >= 3 && lastActual) {
    const proj3Mrr = projected3[2].mrr ?? latestMrr;
    const mrrDelta = proj3Mrr - latestMrr;
    const mrrPct = latestMrr > 0 ? (mrrDelta / latestMrr) * 100 : 0;

    const proj3Members = projected3[2].members ?? latestMembers;
    const memberDelta = proj3Members - latestMembers;

    const revStatus: NinetyDayOutlook["revenue"]["status"] = mrrPct > 3 ? "growing" : mrrPct > -2 ? "stable" : mrrPct > -8 ? "at-risk" : "declining";
    const memStatus: NinetyDayOutlook["memberCount"]["status"] = memberDelta > 3 ? "growing" : memberDelta >= -1 ? "stable" : memberDelta >= -5 ? "at-risk" : "declining";
    const churnStatus: NinetyDayOutlook["churn"]["status"] = churn3mo <= 5 ? "within-tolerance" : churn3mo <= 7 ? "elevated" : "critical";

    let interventionLevel: NinetyDayOutlook["interventionRequired"] = "none";
    const negCount = [revStatus, memStatus].filter((s) => s === "at-risk" || s === "declining").length;
    if (churnStatus === "critical" || negCount >= 2) interventionLevel = "high";
    else if (churnStatus === "elevated" || negCount >= 1) interventionLevel = "moderate";
    else if (revStatus === "stable" && memStatus === "stable") interventionLevel = "low";

    const revLabel = revStatus === "growing" ? `Likely growing (+${mrrPct.toFixed(1)}% projected)` : revStatus === "stable" ? "Likely stable" : revStatus === "at-risk" ? `Risk of decline (${mrrPct.toFixed(1)}% projected)` : `Declining (${mrrPct.toFixed(1)}% projected)`;
    const memLabel = memStatus === "growing" ? `Growing (+${memberDelta} projected)` : memStatus === "stable" ? "Stable" : memStatus === "at-risk" ? `Risk of stagnation (${memberDelta} projected)` : `Declining (${memberDelta} projected)`;
    const churnLabel = churnStatus === "within-tolerance" ? `Within tolerance (${churn3mo.toFixed(1)}% avg)` : churnStatus === "elevated" ? `Elevated (${churn3mo.toFixed(1)}% avg)` : `Critical (${churn3mo.toFixed(1)}% avg)`;

    ninetyDayOutlook = {
      revenue: { status: revStatus, label: revLabel },
      memberCount: { status: memStatus, label: memLabel },
      churn: { status: churnStatus, label: churnLabel },
      interventionRequired: interventionLevel,
    };
  } else {
    ninetyDayOutlook = {
      revenue: { status: "stable", label: "Insufficient data for projection" },
      memberCount: { status: "stable", label: "Insufficient data for projection" },
      churn: { status: "within-tolerance", label: "Insufficient data for projection" },
      interventionRequired: "none",
    };
  }

  // ── TARGET PATH (MRR) ──
  const targetPath: TargetPath[] = [];
  if (sorted.length >= 2) {
    const targetMrr = Math.max(latestMrr * 1.25, latestMrr + 500);
    const last = sorted[sorted.length - 1];
    const churnDec = Number(last.churnRate) / 100;
    const avgNew = sorted.length >= 3 ? Math.round(sorted.slice(-3).reduce((s, m) => s + m.newMembers, 0) / 3) : last.newMembers;
    const arm = Number(last.arm);
    let currentMembers = latestMembers;

    for (let i = 0; i <= 6; i++) {
      const d = new Date(last.monthStart + "T00:00:00");
      d.setMonth(d.getMonth() + i);
      const monthStr = d.toISOString().slice(0, 10);
      const currentTrajectory = currentMembers * arm;
      const targetTrajectory = latestMrr + (targetMrr - latestMrr) * (i / 6);
      targetPath.push({ month: monthStr, currentTrajectory: Math.round(currentTrajectory), targetTrajectory: Math.round(targetTrajectory) });
      if (i < 6) {
        const lost = Math.round(currentMembers * churnDec);
        currentMembers = Math.max(0, currentMembers - lost + avgNew);
      }
    }
  }

  // ── CORRELATIONS ──
  if (sorted.length >= 3) {
    const r3 = sorted.slice(-3);
    const r3Mrr = r3.map((m) => Number(m.mrr));
    const r3Members = r3.map((m) => m.activeMembers);
    const r3Arm = r3.map((m) => Number(m.arm));
    const r3Churn = r3.map((m) => Number(m.churnRate));

    const mrrGrowing = r3Mrr[2] > r3Mrr[0];
    const membersGrowing = r3Members[2] > r3Members[0];
    const armGrowing = r3Arm[2] > r3Arm[0];

    if (mrrGrowing && membersGrowing && !armGrowing) {
      correlations.push({ title: "MRR growth driven by member count, not pricing", detail: "Revenue is increasing because you're adding members, but average revenue per member isn't rising. Consider premium tier opportunities.", status: "neutral" });
    } else if (mrrGrowing && armGrowing && !membersGrowing) {
      correlations.push({ title: "MRR growth driven by pricing, not volume", detail: "Revenue is up because existing members are paying more on average. This is efficient but has a ceiling.", status: "positive" });
    } else if (mrrGrowing && membersGrowing && armGrowing) {
      correlations.push({ title: "Dual-engine growth: more members AND higher revenue each", detail: "Both member count and average revenue are rising. This is the strongest possible growth pattern.", status: "positive" });
    }

    if (r3Churn[2] > r3Churn[0] + 1 && r3Members[2] < r3Members[0]) {
      correlations.push({ title: "Churn spike correlates with member decline", detail: "Rising cancellation rates are directly causing roster contraction. Retention should be prioritized over acquisition.", status: "warning" });
    }

    const r3New = r3.map((m) => m.newMembers);
    if (r3New[2] > r3New[0] && r3Mrr[2] > r3Mrr[0]) {
      correlations.push({ title: "New member influx is lifting revenue", detail: "Acquisition momentum is translating into revenue growth. Ensure onboarding quality keeps pace with volume.", status: "positive" });
    }

    const r3Risk = r3.map((m) => m.memberRiskCount);
    if (r3Risk[2] > r3Risk[0] + 2) {
      correlations.push({ title: "At-risk member count is rising", detail: "More members are entering the risk window (first 60 days). This may precede a churn spike in 1-2 months.", status: "warning" });
    }
  }

  // ── TIMELINE EVENTS ──
  const timelineEvents: TimelineEvent[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const m = sorted[i];
    const p = sorted[i - 1];
    const mChurn = Number(m.churnRate);
    const pChurn = Number(p.churnRate);
    const mMrr = Number(m.mrr);
    const pMrr = Number(p.mrr);

    if (mChurn - pChurn > 2) {
      timelineEvents.push({ month: m.monthStart, type: "churn-spike", description: `Churn jumped from ${pChurn.toFixed(1)}% to ${mChurn.toFixed(1)}%`, severity: "critical" });
    }
    if (m.rsi - p.rsi < -8) {
      timelineEvents.push({ month: m.monthStart, type: "rsi-drop", description: `RSI dropped from ${p.rsi} to ${m.rsi}`, severity: "warning" });
    }
    if (pMrr > 0 && ((mMrr - pMrr) / pMrr) * 100 > 10) {
      timelineEvents.push({ month: m.monthStart, type: "mrr-inflection", description: `MRR surged +${(((mMrr - pMrr) / pMrr) * 100).toFixed(0)}% to $${mMrr.toLocaleString()}`, severity: "info" });
    } else if (pMrr > 0 && ((mMrr - pMrr) / pMrr) * 100 < -8) {
      timelineEvents.push({ month: m.monthStart, type: "mrr-inflection", description: `MRR dropped ${(((mMrr - pMrr) / pMrr) * 100).toFixed(0)}% to $${mMrr.toLocaleString()}`, severity: "warning" });
    }
    if (i >= 3) {
      const last3Net = sorted.slice(i - 2, i + 1).map((x) => x.newMembers - x.cancels);
      if (last3Net.every((n) => Math.abs(n) <= 1)) {
        const alreadyHas = timelineEvents.some((e) => e.type === "growth-plateau" && e.month === m.monthStart);
        if (!alreadyHas) {
          timelineEvents.push({ month: m.monthStart, type: "growth-plateau", description: "Net growth flat for 3 consecutive months", severity: "info" });
        }
      }
    }
  }

  if (sorted.length >= 6) {
    const mid = Math.floor(sorted.length / 2);
    const firstHalfArm = sorted.slice(0, mid).reduce((s, m) => s + Number(m.arm), 0) / mid;
    const secondHalfArm = sorted.slice(mid).reduce((s, m) => s + Number(m.arm), 0) / (sorted.length - mid);
    if (secondHalfArm - firstHalfArm > 15) {
      timelineEvents.push({ month: sorted[mid].monthStart, type: "milestone", description: `Average revenue per member shifted up ~$${Math.round(secondHalfArm - firstHalfArm)} (possible price increase)`, severity: "info" });
    }
  }

  // ── STRATEGIC RECOMMENDATIONS ──
  const strategicRecommendations: StrategicRecommendation[] = [];

  if (avgNetGrowthPerMonth <= 0 && churn3mo <= 5) {
    strategicRecommendations.push({ area: "Acquisition", status: "priority", headline: "Growth is flat — prioritize acquisition", detail: "Retention is solid but you're not adding members. Invest in referral programs, community events, or targeted marketing to build forward momentum." });
  } else if (avgNetGrowthPerMonth > 2) {
    strategicRecommendations.push({ area: "Acquisition", status: "maintain", headline: "Acquisition momentum is healthy", detail: "New members are outpacing cancellations. Continue current acquisition channels and focus on onboarding quality." });
  } else {
    strategicRecommendations.push({ area: "Acquisition", status: "monitor", headline: "Acquisition is steady but not accelerating", detail: "Growth exists but is modest. Consider testing new acquisition channels to find additional leverage." });
  }

  if (latestArm >= 150 && Math.abs(Number(prev?.arm ?? latestArm) - latestArm) < 5) {
    strategicRecommendations.push({ area: "Pricing", status: "maintain", headline: "Revenue per member is steady — no pricing pressure", detail: "ARM is in a healthy range and stable. No immediate pricing adjustments needed. Focus on value delivery." });
  } else if (latestArm < 120) {
    strategicRecommendations.push({ area: "Pricing", status: "priority", headline: "Revenue per member is below potential", detail: "There's room for a premium tier or a price adjustment. Even a small increase per member adds up fast across your whole roster." });
  } else {
    strategicRecommendations.push({ area: "Pricing", status: "monitor", headline: "Revenue per member is moderate", detail: "ARM is acceptable but not optimized. Consider premium add-ons like nutrition coaching or personal training sessions." });
  }

  if (churn3mo <= 5 && latestRsi >= 80) {
    strategicRecommendations.push({ area: "Retention", status: "maintain", headline: "Retention is strong — maintain systems", detail: "Churn is controlled and RSI is healthy. Continue your current engagement practices and monitor for early warning signals." });
  } else if (churn3mo > 7 || latestRsi < 60) {
    strategicRecommendations.push({ area: "Retention", status: "priority", headline: "Retention requires immediate attention", detail: "High churn or low RSI means members aren't embedding into your community. Focus on the first 90 days of membership with structured touchpoints." });
  } else {
    strategicRecommendations.push({ area: "Retention", status: "monitor", headline: "Retention has room for improvement", detail: "Metrics are acceptable but not robust. Strengthen member engagement through personal outreach and community events." });
  }

  const riskPct = latestMembers > 0 ? (latest.memberRiskCount / latestMembers) * 100 : 0;
  if (riskPct > 15) {
    strategicRecommendations.push({ area: "Risk Management", status: "priority", headline: "High exposure to new member churn", detail: `${riskPct.toFixed(0)}% of your roster is in their first 60 days — the period when most people quit. Reaching out to them now is the single most effective thing you can do.` });
  } else if (riskPct > 8) {
    strategicRecommendations.push({ area: "Risk Management", status: "monitor", headline: "Moderate new member risk exposure", detail: "A meaningful portion of members are in the early risk window. Ensure each has been personally contacted within their first two weeks." });
  } else {
    strategicRecommendations.push({ area: "Risk Management", status: "maintain", headline: "New member risk exposure is low", detail: "Most of your roster is past the critical 60-day window. Continue monitoring new signups as they come in." });
  }

  return {
    insights,
    microKpis,
    projections,
    correlations,
    stabilityScore: {
      score: totalScore,
      tier,
      headline: stabilityHeadline,
      detail: stabilityDetail,
      components: {
        rsiSlope: { score: rsiSlopeScore, label: rsiSlopeLabel },
        churnAvg: { score: churnAvgScore, label: churnAvgLabel },
        netGrowth: { score: netGrowthScore, label: netGrowthLabel },
        revenueMomentum: { score: revMomentumScore, label: revMomentumLabel },
      },
    },
    ninetyDayOutlook,
    targetPath,
    timelineEvents,
    strategicRecommendations,
    growthEngine: {
      cumulativeData,
      totalNetGrowth: cumulativeNet,
      totalMonths: sorted.length,
    },
  };
}
