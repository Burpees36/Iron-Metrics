import { storage } from "./storage";

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
  });
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
