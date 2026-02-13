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
        ? "Flat growth. Acquisition is matching attrition."
        : `+${netGrowth} members adds ~$${Math.round(netGrowth * metrics.arm).toLocaleString()}/mo`,
    meaning: netGrowth > 0
      ? "Your gym is growing. New members are outpacing cancellations."
      : netGrowth === 0
        ? "Your roster is flat. Acquisition exactly offsets churn."
        : "Your roster is shrinking. Cancellations are outpacing new sign-ups.",
    whyItMatters: "Net growth is the clearest signal of roster momentum. Negative growth indicates a systemic problem that compounds monthly. Positive growth builds financial resilience.",
    action: netGrowth < 0
      ? "Address retention first before increasing acquisition spend. Reducing churn by 1-2% is more cost-effective than acquiring replacement members."
      : netGrowth === 0
        ? "Evaluate whether your acquisition channels are performing. Consider member referral incentives to break through the plateau."
        : "Sustain current momentum. Ensure new members are well-onboarded to prevent growth from masking rising churn.",
    trendDirection: membersTrend.direction,
    trendValue: membersTrend.value,
  });

  return reports;
}
