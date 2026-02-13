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
  action: string;
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
}): MetricReport[] {
  const reports: MetricReport[] = [];

  const churnTarget = 5;
  const churnDiff = metrics.churnRate - churnTarget;
  const annualImpact = churnDiff > 0
    ? Math.round(metrics.arm * (churnDiff / 100) * metrics.activeMembers * 12)
    : 0;

  reports.push({
    metric: "Monthly Churn",
    current: `${metrics.churnRate}%`,
    target: `${churnTarget}%`,
    impact: annualImpact > 0
      ? `+$${annualImpact.toLocaleString()} annual revenue if reduced to target`
      : "On track",
    meaning: metrics.churnRate > 7
      ? "Your current churn rate indicates significant revenue volatility over the next 6-12 months. Immediate attention recommended."
      : metrics.churnRate > 5
        ? "Your churn is above the healthy range. This suggests some members are leaving before building lasting habits."
        : "Your retention is solid. Members are staying engaged and building habits.",
    action: metrics.churnRate > 5
      ? "Prioritize outreach to members with declining attendance patterns. Consider implementing a 30-day check-in program for new members."
      : "Maintain your current retention strategy. Look for opportunities to deepen member engagement.",
  });

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
        ? "Your retention has some vulnerabilities. Membership age distribution or early cancellation patterns suggest room for improvement."
        : "Your retention is unstable. Multiple indicators suggest members are not embedding into your community fast enough.",
    action: metrics.rsi < 60
      ? "Implement an onboarding sequence for the first 90 days. Focus on building social connections through group programming."
      : metrics.rsi < 80
        ? "Review your early cancellation trends. Consider what happens in months 2-4 of membership that may cause drop-off."
        : "Continue investing in community events and member milestones to reinforce belonging.",
  });

  reports.push({
    metric: "Revenue Efficiency",
    current: `$${metrics.arm.toFixed(0)} ARM`,
    target: "$150+",
    impact: metrics.arm < 150
      ? `+$${Math.round((150 - metrics.arm) * metrics.activeMembers).toLocaleString()} monthly if ARM reaches target`
      : "Revenue per member is optimized",
    meaning: metrics.arm >= 150
      ? "Your average revenue per member is strong. This suggests good tier distribution or value-add services."
      : metrics.arm >= 100
        ? "Your revenue per member is moderate. There may be opportunities to introduce premium offerings or adjust pricing."
        : "Your revenue per member is low. Consider whether your pricing reflects the value you deliver.",
    action: metrics.arm < 100
      ? "Review your pricing tiers. Consider introducing a premium tier with personal training or specialized programming."
      : metrics.arm < 150
        ? "Explore upsell opportunities like nutrition coaching, recovery services, or accountability programs."
        : "Focus on retention and expanding to new members rather than further price optimization.",
  });

  reports.push({
    metric: "Lifetime Value",
    current: `$${Math.round(metrics.ltv).toLocaleString()}`,
    target: "$3,000+",
    impact: metrics.ltveImpact > 0
      ? `+$${Math.round(metrics.ltveImpact).toLocaleString()} annual value from 1% churn reduction`
      : "LTV is maximized at current churn levels",
    meaning: metrics.ltv >= 3000
      ? "Your member lifetime value is excellent. Each member represents significant long-term revenue."
      : metrics.ltv >= 1500
        ? "Your LTV is moderate. Improving retention or pricing would compound significantly over time."
        : "Your LTV is below optimal levels. This usually indicates high churn eroding long-term revenue potential.",
    action: metrics.ltv < 1500
      ? "Focus on the first 90 days of membership. Members who survive the first quarter are 3x more likely to stay a year."
      : metrics.ltv < 3000
        ? "Invest in member milestone celebrations and community programming to extend average membership duration."
        : "Your LTV is strong. Consider referral programs to acquire similar high-value members.",
  });

  reports.push({
    metric: "Member Risk Radar",
    current: `${metrics.memberRiskCount} at-risk`,
    target: "< 10% of roster",
    impact: metrics.memberRiskCount > 0
      ? `$${Math.round(metrics.memberRiskCount * metrics.arm).toLocaleString()}/mo MRR at risk`
      : "No members currently flagged",
    meaning: metrics.memberRiskCount > metrics.activeMembers * 0.15
      ? "A significant portion of your roster shows early-stage risk signals. These are members in their first 60 days who historically have high drop-off rates."
      : metrics.memberRiskCount > 0
        ? "Some newer members need attention. Early engagement is the strongest predictor of long-term retention."
        : "No members are currently in the high-risk window. Your onboarding is working.",
    action: metrics.memberRiskCount > 0
      ? "Reach out personally to new members within their first 2 weeks. Schedule goal-setting sessions and introduce them to regular class attendees."
      : "Keep monitoring new member engagement through their first 90 days.",
  });

  return reports;
}
