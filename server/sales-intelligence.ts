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
    dataQualitySubScore: number;
    leadAgingSubScore: number;
    funnelBalanceSubScore: number;
    breakdown: HealthBreakdownItem[];
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
  dataQuality: DataQualityScore;
}

export interface HealthBreakdownItem {
  factor: string;
  score: number;
  weight: number;
  contribution: number;
  description: string;
}

export interface DataQualityScore {
  score: number;
  status: "Excellent" | "Good" | "Needs Attention" | "Critical";
  factors: DataQualityFactor[];
}

export interface DataQualityFactor {
  name: string;
  value: number;
  description: string;
}

export interface StaleLead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  createdAt: Date | string;
  daysSinceCreated: number;
  daysSinceLastContact: number | null;
  lastContactAt: Date | string | null;
  nextActionDate: Date | string | null;
  followUpNotes: string | null;
  coachId: string | null;
  category: "untouched" | "booked_not_confirmed" | "no_show_recovery" | "stale";
}

export interface LeadAgingSummary {
  staleLeads: StaleLead[];
  totalStale: number;
  untouchedCount: number;
  bookedNotConfirmedCount: number;
  noShowRecoveryCount: number;
  generalStaleCount: number;
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

function computeDataQualityScore(
  leadsArr: Lead[],
  consultsArr: Consult[],
  membershipsArr: SalesMembership[]
): DataQualityScore {
  if (leadsArr.length === 0) {
    return { score: 100, status: "Excellent", factors: [] };
  }

  const withSource = leadsArr.filter(l => l.source && l.source !== "Unknown").length;
  const sourcePercent = Math.round((withSource / leadsArr.length) * 100);

  const withCoach = leadsArr.filter(l => l.coachId).length;
  const coachPercent = Math.round((withCoach / leadsArr.length) * 100);

  const consultsWithOutcome = consultsArr.filter(c => c.showedAt || c.noShowAt).length;
  const outcomePercent = consultsArr.length > 0 ? Math.round((consultsWithOutcome / consultsArr.length) * 100) : 0;

  const wonLeads = leadsArr.filter(l => l.status === "won");
  const wonWithPrice = wonLeads.filter(l => l.salePrice && Number(l.salePrice) > 0).length;
  const pricePercent = wonLeads.length > 0 ? Math.round((wonWithPrice / wonLeads.length) * 100) : 0;

  const now = Date.now();
  const STALE_DAYS = 14;
  const activeLeads = leadsArr.filter(l => l.status !== "won" && l.status !== "lost");
  const staleLeads = activeLeads.filter(l => {
    const lastActivity = l.lastContactAt || l.showedAt || l.bookedAt || l.firstContactAt || l.createdAt;
    const daysSince = (now - new Date(lastActivity).getTime()) / 86400000;
    return daysSince > STALE_DAYS;
  });
  const stalePercent = activeLeads.length > 0 ? Math.round((staleLeads.length / activeLeads.length) * 100) : 0;

  const emails = leadsArr.filter(l => l.email).map(l => l.email!.toLowerCase());
  const uniqueEmails = new Set(emails);
  const duplicateCount = emails.length - uniqueEmails.size;
  const dupPercent = leadsArr.length > 0 ? Math.round((duplicateCount / leadsArr.length) * 100) : 0;

  const VALID_TRANSITIONS: Record<string, string[]> = {
    new: ["booked", "lost"],
    booked: ["showed", "lost"],
    showed: ["won", "lost"],
  };
  let invalidTransitions = 0;
  for (const lead of leadsArr) {
    if (lead.status === "won" && !lead.showedAt && !lead.bookedAt) invalidTransitions++;
    if (lead.status === "showed" && !lead.bookedAt) invalidTransitions++;
  }
  const invalidPercent = leadsArr.length > 0 ? Math.round((invalidTransitions / leadsArr.length) * 100) : 0;

  const factors: DataQualityFactor[] = [
    { name: "Source Coverage", value: sourcePercent, description: `${withSource}/${leadsArr.length} leads have an assigned source` },
    { name: "Coach Coverage", value: coachPercent, description: `${withCoach}/${leadsArr.length} leads have an assigned coach` },
    { name: "Consult Outcomes", value: outcomePercent, description: `${consultsWithOutcome}/${consultsArr.length} consults have a recorded outcome` },
    { name: "Won Deal Pricing", value: pricePercent, description: `${wonWithPrice}/${wonLeads.length} won deals have a recorded price` },
    { name: "Lead Freshness", value: 100 - stalePercent, description: `${staleLeads.length} leads stuck for 14+ days (${stalePercent}% of active)` },
    { name: "Duplicate Rate", value: 100 - dupPercent, description: `${duplicateCount} potential duplicate leads detected` },
    { name: "Transition Integrity", value: 100 - invalidPercent, description: `${invalidTransitions} leads with skipped pipeline stages` },
  ];

  const weights = [0.20, 0.15, 0.15, 0.15, 0.15, 0.10, 0.10];
  const rawScore = factors.reduce((sum, f, i) => sum + f.value * weights[i], 0);
  const score = Math.round(rawScore);

  let status: DataQualityScore["status"];
  if (score >= 85) status = "Excellent";
  else if (score >= 65) status = "Good";
  else if (score >= 40) status = "Needs Attention";
  else status = "Critical";

  return { score, status, factors };
}

function computeLeadAgingScore(leadsArr: Lead[]): number {
  const now = Date.now();
  const STALE_DAYS = 14;
  const activeLeads = leadsArr.filter(l => l.status !== "won" && l.status !== "lost");
  if (activeLeads.length === 0) return 100;

  const staleCount = activeLeads.filter(l => {
    const lastActivity = l.lastContactAt || l.showedAt || l.bookedAt || l.firstContactAt || l.createdAt;
    return (now - new Date(lastActivity).getTime()) / 86400000 > STALE_DAYS;
  }).length;

  const freshPercent = 1 - (staleCount / activeLeads.length);
  return Math.round(clamp(freshPercent * 100, 0, 100));
}

function computeFunnelBalanceScore(counts: ReturnType<typeof computeCounts>): number {
  if (counts.leads === 0) return 50;

  const setRate = counts.booked / counts.leads;
  const showRate = counts.booked > 0 ? counts.shows / counts.booked : 0;
  const closeRate = counts.shows > 0 ? counts.newMembers / counts.shows : 0;

  const rates = [setRate, showRate, closeRate].filter(r => r > 0);
  if (rates.length < 2) return 50;

  const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / rates.length;
  const cv = avg > 0 ? Math.sqrt(variance) / avg : 1;

  return Math.round(clamp((1 - cv) * 100, 0, 100));
}

function computeSalesHealthScore(
  funnelConversion: number | null,
  responseMedianMin: number | null,
  showRate: number | null,
  closeRate: number | null,
  dataQualityScore: number,
  leadAgingScore: number,
  funnelBalanceScore: number,
  counts: ReturnType<typeof computeCounts>
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
  const showScoreVal = clamp((sr - showTargetLow) / (showTargetHigh - showTargetLow) * 100, 0, 100);
  const closeScoreVal = clamp((cr - closeTargetLow) / (closeTargetHigh - closeTargetLow) * 100, 0, 100);
  const stageScore = (showScoreVal + closeScoreVal) / 2;

  const rawBreakdown = [
    { factor: "Conversion Rates", score: convScore, weight: 0.30, description: `Funnel conversion at ${conv ? (conv * 100).toFixed(1) : 0}% (target: 20-40%)` },
    { factor: "Speed to Lead", score: speedScore, weight: 0.15, description: `Median response time: ${respMedian < 60 ? Math.round(respMedian) + " min" : "60+ min"} (target: <5 min)` },
    { factor: "Stage Efficiency", score: stageScore, weight: 0.15, description: `Show rate: ${sr ? (sr * 100).toFixed(0) : 0}%, Close rate: ${cr ? (cr * 100).toFixed(0) : 0}%` },
    { factor: "Data Quality", score: dataQualityScore, weight: 0.15, description: `Completeness and consistency of your pipeline data` },
    { factor: "Lead Freshness", score: leadAgingScore, weight: 0.15, description: `${100 - leadAgingScore}% of active leads are stale (14+ days untouched)` },
    { factor: "Funnel Balance", score: funnelBalanceScore, weight: 0.10, description: `Consistency across pipeline stages (low variance = balanced)` },
  ];

  const preciseTotal = rawBreakdown.reduce((sum, b) => sum + b.score * b.weight, 0);
  const salesHealth = Math.round(clamp(preciseTotal, 0, 100));

  const breakdown: HealthBreakdownItem[] = rawBreakdown.map(b => ({
    ...b,
    score: Math.round(b.score),
    contribution: Math.round(b.score * b.weight),
  }));

  return {
    salesHealthScore: Math.round(clamp(salesHealth, 0, 100)),
    conversionSubScore: Math.round(convScore),
    speedSubScore: Math.round(speedScore),
    stageSubScore: Math.round(stageScore),
    dataQualitySubScore: dataQualityScore,
    leadAgingSubScore: leadAgingScore,
    funnelBalanceSubScore: funnelBalanceScore,
    breakdown,
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
  const dataQuality = computeDataQualityScore(leadsArr, consultsArr, membershipsArr);
  const leadAgingScore = computeLeadAgingScore(leadsArr);
  const funnelBalanceScore = computeFunnelBalanceScore(counts);
  const composite = computeSalesHealthScore(
    rates.funnelConversion, speed.responseMedianMin, rates.showRate, rates.closeRate,
    dataQuality.score, leadAgingScore, funnelBalanceScore, counts
  );
  const bottleneck = computeBottleneck(counts);

  const prevCounts = computeCounts(prevLeads, prevConsults, prevMemberships);
  const prevRates = computeRates(prevCounts);
  const prevRevenue = computeRevenue(prevMemberships, prevPayments, prevCounts.leads);
  const prevSpeed = computeSpeed(prevLeads, prevMemberships);
  const deltas = computeDeltas(
    { counts, rates, revenue, speed },
    { counts: prevCounts, rates: prevRates, revenue: prevRevenue, speed: prevSpeed }
  );

  return { counts, rates, revenue, speed, composite, bottleneck, deltas, dataQuality };
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

export function computeLeadAging(
  leadsArr: Lead[],
  consultsArr: Consult[],
  staleDaysThreshold: number = 7
): LeadAgingSummary {
  const now = Date.now();
  const activeLeads = leadsArr.filter(l => l.status !== "won" && l.status !== "lost");
  const consultByLead = new Map<string, Consult>();
  for (const c of consultsArr) {
    if (c.leadId) consultByLead.set(c.leadId, c);
  }

  const staleLeads: StaleLead[] = [];

  for (const lead of activeLeads) {
    const lastActivity = lead.lastContactAt || lead.showedAt || lead.bookedAt || lead.firstContactAt || lead.createdAt;
    const daysSinceCreated = Math.floor((now - new Date(lead.createdAt).getTime()) / 86400000);
    const daysSinceLastContact = lastActivity ? Math.floor((now - new Date(lastActivity).getTime()) / 86400000) : null;
    const consult = consultByLead.get(lead.id);

    let category: StaleLead["category"] | null = null;

    if (lead.status === "new" && daysSinceCreated >= staleDaysThreshold && !lead.firstContactAt && !lead.lastContactAt) {
      category = "untouched";
    } else if (lead.status === "booked" && consult && !consult.showedAt && !consult.noShowAt) {
      const scheduledFor = consult.scheduledFor ? new Date(consult.scheduledFor) : null;
      if (scheduledFor && scheduledFor.getTime() < now) {
        category = "booked_not_confirmed";
      } else if (daysSinceLastContact !== null && daysSinceLastContact >= staleDaysThreshold) {
        category = "booked_not_confirmed";
      }
    } else if (consult && consult.noShowAt && lead.status !== "lost") {
      category = "no_show_recovery";
    } else if (daysSinceLastContact !== null && daysSinceLastContact >= staleDaysThreshold) {
      category = "stale";
    } else if (daysSinceCreated >= staleDaysThreshold && !lead.firstContactAt) {
      category = "stale";
    }

    if (category) {
      staleLeads.push({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        status: lead.status,
        createdAt: lead.createdAt,
        daysSinceCreated,
        daysSinceLastContact,
        lastContactAt: lead.lastContactAt,
        nextActionDate: lead.nextActionDate,
        followUpNotes: lead.followUpNotes,
        coachId: lead.coachId,
        category,
      });
    }
  }

  staleLeads.sort((a, b) => (b.daysSinceCreated) - (a.daysSinceCreated));

  return {
    staleLeads,
    totalStale: staleLeads.length,
    untouchedCount: staleLeads.filter(l => l.category === "untouched").length,
    bookedNotConfirmedCount: staleLeads.filter(l => l.category === "booked_not_confirmed").length,
    noShowRecoveryCount: staleLeads.filter(l => l.category === "no_show_recovery").length,
    generalStaleCount: staleLeads.filter(l => l.category === "stale").length,
  };
}
