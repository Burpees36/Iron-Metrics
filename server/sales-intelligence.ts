import type { Lead, Consult, SalesMembership, Payment } from "@shared/schema";

export interface SalesSummary {
  counts: {
    leads: number;
    booked: number;
    shows: number;
    newMembers: number;
  };
  rates: {
    setRate: number | null;
    showRate: number | null;
    closeRate: number | null;
    funnelConversion: number | null;
  };
  revenue: {
    total: number;
    revenuePerLead: number | null;
  };
  speed: {
    responseMedianMin: number | null;
    leadToMemberMedianDays: number | null;
  };
  composite: {
    salesHealthScore: number;
    conversionSubScore: number;
    speedSubScore: number;
    stageSubScore: number;
  };
  bottleneck: {
    stage: string;
    dropPercent: number;
    explanation: string;
  } | null;
  deltas: {
    leads: number | null;
    newMembers: number | null;
    funnelConversion: number | null;
    revenuePerLead: number | null;
    setRate: number | null;
    showRate: number | null;
    closeRate: number | null;
    responseMedianMin: number | null;
  };
}

export interface TrendPoint {
  date: string;
  leads: number;
  newMembers: number;
  conversionRate: number | null;
}

export interface SourceRow {
  source: string;
  leads: number;
  newMembers: number;
  conversionRate: number | null;
}

export interface CoachRow {
  coachId: string;
  shows: number;
  newMembers: number;
  closeRate: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function safeDiv(num: number, den: number): number | null {
  return den === 0 ? null : num / den;
}

function round1(val: number | null): number | null {
  return val === null ? null : Math.round(val * 10) / 10;
}

function round2(val: number | null): number | null {
  return val === null ? null : Math.round(val * 100) / 100;
}

function computeCounts(
  leadsArr: Lead[],
  consultsArr: Consult[],
  membershipsArr: SalesMembership[]
) {
  const booked = consultsArr.length;
  const shows = consultsArr.filter(c => c.showedAt !== null).length;
  return {
    leads: leadsArr.length,
    booked,
    shows,
    newMembers: membershipsArr.length,
  };
}

function computeRates(counts: ReturnType<typeof computeCounts>) {
  return {
    setRate: round2(safeDiv(counts.booked, counts.leads)),
    showRate: round2(safeDiv(counts.shows, counts.booked)),
    closeRate: round2(safeDiv(counts.newMembers, counts.shows)),
    funnelConversion: round2(safeDiv(counts.newMembers, counts.leads)),
  };
}

function computeRevenue(
  membershipsArr: SalesMembership[],
  paymentsArr: Payment[],
  leadCount: number
) {
  let total = 0;
  if (paymentsArr.length > 0) {
    total = paymentsArr.reduce((sum, p) => sum + Number(p.amount), 0);
  } else {
    total = membershipsArr.reduce((sum, m) => sum + Number(m.priceMonthly), 0);
  }
  return {
    total: Math.round(total * 100) / 100,
    revenuePerLead: round2(safeDiv(total, leadCount)),
  };
}

function computeSpeed(leadsArr: Lead[], membershipsArr: SalesMembership[]) {
  const responseTimes: number[] = [];
  for (const lead of leadsArr) {
    if (lead.firstContactAt && lead.createdAt) {
      const diffMin = (new Date(lead.firstContactAt).getTime() - new Date(lead.createdAt).getTime()) / 60000;
      if (diffMin >= 0) responseTimes.push(diffMin);
    }
  }

  const leadToMemberTimes: number[] = [];
  const leadMap = new Map(leadsArr.map(l => [l.id, l]));
  for (const m of membershipsArr) {
    const lead = leadMap.get(m.leadId);
    if (lead) {
      const diffDays = (new Date(m.startedAt).getTime() - new Date(lead.createdAt).getTime()) / 86400000;
      if (diffDays >= 0) leadToMemberTimes.push(diffDays);
    }
  }

  return {
    responseMedianMin: responseTimes.length >= 5 ? round1(median(responseTimes)) : null,
    leadToMemberMedianDays: leadToMemberTimes.length >= 3 ? round1(median(leadToMemberTimes)) : null,
  };
}

function computeSalesHealthScore(
  funnelConversion: number | null,
  responseMedianMin: number | null,
  showRate: number | null,
  closeRate: number | null
) {
  const targetConvLow = 0.20, targetConvHigh = 0.40;
  const conv = funnelConversion ?? 0;
  const convScore = clamp((conv - targetConvLow) / (targetConvHigh - targetConvLow) * 100, 0, 100);

  const targetFast = 5, targetSlow = 60;
  const respMedian = responseMedianMin ?? targetSlow;
  const speedScore = clamp((targetSlow - respMedian) / (targetSlow - targetFast) * 100, 0, 100);

  const showTargetLow = 0.70, showTargetHigh = 0.90;
  const closeTargetLow = 0.60, closeTargetHigh = 0.85;
  const sr = showRate ?? 0;
  const cr = closeRate ?? 0;
  const showScore = clamp((sr - showTargetLow) / (showTargetHigh - showTargetLow) * 100, 0, 100);
  const closeScore = clamp((cr - closeTargetLow) / (closeTargetHigh - closeTargetLow) * 100, 0, 100);
  const stageScore = (showScore + closeScore) / 2;

  const salesHealth = Math.round(0.50 * convScore + 0.25 * speedScore + 0.25 * stageScore);

  return {
    salesHealthScore: salesHealth,
    conversionSubScore: Math.round(convScore),
    speedSubScore: Math.round(speedScore),
    stageSubScore: Math.round(stageScore),
  };
}

function computeBottleneck(counts: ReturnType<typeof computeCounts>) {
  if (counts.leads === 0) return null;

  const drops = [
    {
      stage: "Lead → Booked",
      drop: 1 - (counts.booked / counts.leads),
      explanation: "Most leads are not booking a consultation. This could mean follow-up is too slow or there's no clear next step after initial contact.",
    },
    {
      stage: "Booked → Show",
      drop: counts.booked > 0 ? 1 - (counts.shows / counts.booked) : 0,
      explanation: "People are booking but not showing up. Appointment reminders or a more compelling reason to attend could help.",
    },
    {
      stage: "Show → Member",
      drop: counts.shows > 0 ? 1 - (counts.newMembers / counts.shows) : 0,
      explanation: "People are showing up but not signing up. The consultation experience or pricing presentation may need adjustment.",
    },
  ];

  const worst = drops.reduce((max, d) => d.drop > max.drop ? d : max, drops[0]);
  return {
    stage: worst.stage,
    dropPercent: Math.round(worst.drop * 1000) / 10,
    explanation: worst.explanation,
  };
}

function computeDeltas(
  current: { counts: ReturnType<typeof computeCounts>; rates: ReturnType<typeof computeRates>; revenue: ReturnType<typeof computeRevenue>; speed: ReturnType<typeof computeSpeed> },
  prev: { counts: ReturnType<typeof computeCounts>; rates: ReturnType<typeof computeRates>; revenue: ReturnType<typeof computeRevenue>; speed: ReturnType<typeof computeSpeed> }
) {
  function pctChange(curr: number | null, previous: number | null): number | null {
    if (curr === null || previous === null || previous === 0) return null;
    return round1(((curr - previous) / Math.abs(previous)) * 100);
  }

  return {
    leads: prev.counts.leads === 0 ? null : round1(((current.counts.leads - prev.counts.leads) / prev.counts.leads) * 100),
    newMembers: prev.counts.newMembers === 0 ? null : round1(((current.counts.newMembers - prev.counts.newMembers) / prev.counts.newMembers) * 100),
    funnelConversion: pctChange(current.rates.funnelConversion, prev.rates.funnelConversion),
    revenuePerLead: pctChange(current.revenue.revenuePerLead, prev.revenue.revenuePerLead),
    setRate: pctChange(current.rates.setRate, prev.rates.setRate),
    showRate: pctChange(current.rates.showRate, prev.rates.showRate),
    closeRate: pctChange(current.rates.closeRate, prev.rates.closeRate),
    responseMedianMin: pctChange(current.speed.responseMedianMin, prev.speed.responseMedianMin),
  };
}

export function computeSalesSummary(
  leadsArr: Lead[],
  consultsArr: Consult[],
  membershipsArr: SalesMembership[],
  paymentsArr: Payment[],
  prevLeads: Lead[],
  prevConsults: Consult[],
  prevMemberships: SalesMembership[],
  prevPayments: Payment[]
): SalesSummary {
  const counts = computeCounts(leadsArr, consultsArr, membershipsArr);
  const rates = computeRates(counts);
  const revenue = computeRevenue(membershipsArr, paymentsArr, counts.leads);
  const speed = computeSpeed(leadsArr, membershipsArr);
  const composite = computeSalesHealthScore(rates.funnelConversion, speed.responseMedianMin, rates.showRate, rates.closeRate);
  const bottleneck = computeBottleneck(counts);

  const prevCounts = computeCounts(prevLeads, prevConsults, prevMemberships);
  const prevRates = computeRates(prevCounts);
  const prevRevenue = computeRevenue(prevMemberships, prevPayments, prevCounts.leads);
  const prevSpeed = computeSpeed(prevLeads, prevMemberships);
  const deltas = computeDeltas(
    { counts, rates, revenue, speed },
    { counts: prevCounts, rates: prevRates, revenue: prevRevenue, speed: prevSpeed }
  );

  return { counts, rates, revenue, speed, composite, bottleneck, deltas };
}

export function computeTrends(
  leadsArr: Lead[],
  membershipsArr: SalesMembership[],
  bucket: "daily" | "weekly"
): TrendPoint[] {
  if (leadsArr.length === 0 && membershipsArr.length === 0) return [];

  const allDates = [
    ...leadsArr.map(l => new Date(l.createdAt)),
    ...membershipsArr.map(m => new Date(m.startedAt)),
  ];
  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

  function bucketKey(d: Date): string {
    const iso = d.toISOString().slice(0, 10);
    if (bucket === "daily") return iso;
    const dt = new Date(iso);
    const day = dt.getDay();
    const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(dt.setDate(diff));
    return monday.toISOString().slice(0, 10);
  }

  const buckets = new Map<string, { leads: number; newMembers: number }>();

  const current = new Date(minDate);
  current.setUTCHours(0, 0, 0, 0);
  const end = new Date(maxDate);
  end.setUTCHours(23, 59, 59, 999);
  while (current <= end) {
    const key = bucketKey(current);
    if (!buckets.has(key)) buckets.set(key, { leads: 0, newMembers: 0 });
    current.setDate(current.getDate() + 1);
  }

  for (const lead of leadsArr) {
    const key = bucketKey(new Date(lead.createdAt));
    const b = buckets.get(key);
    if (b) b.leads++;
  }

  for (const m of membershipsArr) {
    const key = bucketKey(new Date(m.startedAt));
    const b = buckets.get(key);
    if (b) b.newMembers++;
  }

  const sorted = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return sorted.map(([date, data]) => ({
    date,
    leads: data.leads,
    newMembers: data.newMembers,
    conversionRate: data.leads > 0 ? round2(data.newMembers / data.leads) : null,
  }));
}

export function computeBySource(
  leadsArr: Lead[],
  membershipsArr: SalesMembership[]
): SourceRow[] {
  const memberLeadIds = new Set(membershipsArr.map(m => m.leadId));
  const sourceMap = new Map<string, { leads: number; newMembers: number }>();

  for (const lead of leadsArr) {
    const src = lead.source || "Unknown";
    const entry = sourceMap.get(src) || { leads: 0, newMembers: 0 };
    entry.leads++;
    if (memberLeadIds.has(lead.id)) entry.newMembers++;
    sourceMap.set(src, entry);
  }

  return [...sourceMap.entries()]
    .map(([source, data]) => ({
      source,
      leads: data.leads,
      newMembers: data.newMembers,
      conversionRate: data.leads > 0 ? round2(data.newMembers / data.leads) : null,
    }))
    .sort((a, b) => b.leads - a.leads);
}

export function computeByCoach(
  consultsArr: Consult[],
  membershipsArr: SalesMembership[]
): CoachRow[] {
  const consultsWithCoach = consultsArr.filter(c => c.coachId && c.showedAt);
  if (consultsWithCoach.length === 0) return [];

  const memberLeadIds = new Set(membershipsArr.map(m => m.leadId));
  const coachMap = new Map<string, { shows: number; newMembers: number }>();

  for (const consult of consultsWithCoach) {
    const cid = consult.coachId!;
    const entry = coachMap.get(cid) || { shows: 0, newMembers: 0 };
    entry.shows++;
    if (memberLeadIds.has(consult.leadId)) entry.newMembers++;
    coachMap.set(cid, entry);
  }

  return [...coachMap.entries()]
    .map(([coachId, data]) => ({
      coachId,
      shows: data.shows,
      newMembers: data.newMembers,
      closeRate: data.shows > 0 ? round2(data.newMembers / data.shows) : null,
    }))
    .sort((a, b) => b.shows - a.shows);
}
