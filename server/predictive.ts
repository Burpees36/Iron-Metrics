import { storage } from "./storage";
import type { Member, MemberContact } from "@shared/schema";

// ═══════════════════════════════════════════════════════════════
// MEMBER-LEVEL PREDICTIVE INTELLIGENCE
// ═══════════════════════════════════════════════════════════════

export type EngagementClass = "core" | "drifter" | "at-risk" | "ghost";
export type InterventionType = "personal-outreach" | "goal-setting" | "community-integration" | "win-back" | "pricing-review" | "coach-connection" | "milestone-celebration" | "onboarding-acceleration";

export interface MemberPrediction {
  memberId: string;
  name: string;
  email: string | null;
  monthlyRate: number;
  tenureDays: number;
  tenureMonths: number;
  churnProbability: number;
  engagementClass: EngagementClass;
  expectedLtvRemaining: number;
  revenueAtRisk: number;
  primaryRiskDriver: string;
  riskDrivers: string[];
  interventionType: InterventionType;
  interventionDetail: string;
  interventionMicroGuidance: string;
  interventionUrgency: "immediate" | "this-week" | "this-month" | "monitor";
  lastContactDays: number | null;
  isHighValue: boolean;
}

export interface MemberPredictionSummary {
  members: MemberPrediction[];
  summary: {
    totalAtRisk: number;
    totalRevenueAtRisk: number;
    totalLtvAtRisk: number;
    avgChurnProbability: number;
    classBreakdown: Record<EngagementClass, number>;
    urgentInterventions: number;
    topRiskDriver: string;
  };
}

// ═══════════════════════════════════════════════════════════════
// COHORT INTELLIGENCE
// ═══════════════════════════════════════════════════════════════

export interface CohortBucket {
  cohortLabel: string;
  cohortMonth: string;
  totalJoined: number;
  stillActive: number;
  survivalRate: number;
  avgTenureDays: number;
  avgMonthlyRate: number;
  revenueRetained: number;
  revenueLost: number;
}

export interface RetentionWindow {
  window: string;
  lostCount: number;
  lostPct: number;
  avgRate: number;
  revenueLost: number;
  insight: string;
}

export interface CohortIntelligence {
  cohorts: CohortBucket[];
  retentionWindows: RetentionWindow[];
  survivalCurve: { days: number; survivalRate: number }[];
  insights: string[];
  crossfitInsights: string[];
}

// ═══════════════════════════════════════════════════════════════
// REVENUE SCENARIO MODELING
// ═══════════════════════════════════════════════════════════════

export interface ScenarioMonth {
  month: string;
  upside: number;
  expected: number;
  downside: number;
  current: number;
}

export interface RevenueScenario {
  projections: ScenarioMonth[];
  breakEvenRisk: number;
  cashFlowRiskLevel: "low" | "moderate" | "high" | "critical";
  worstCaseMrr: number;
  expectedMrr: number;
  upsideMrr: number;
  scenarioInsights: string[];
}

// ═══════════════════════════════════════════════════════════════
// STRATEGIC BRIEF
// ═══════════════════════════════════════════════════════════════

export interface BriefRecommendation {
  category: string;
  priority: "critical" | "high" | "medium" | "low";
  headline: string;
  detail: string;
  revenueImpact: string;
  interventionType: string;
  crossfitContext: string;
  timeframe: string;
  executionChecklist: string[];
}

export interface MemberAlertEnriched {
  name: string;
  probability: number;
  driver: string;
  intervention: string;
  revenue: string;
  tenureDays: number;
  lastContactDays: number | null;
  outreachLogged: boolean;
  suggestedAction: string;
  engagementClass: string;
  memberId: string;
}

export interface RevenueComparison {
  currentMrr: number;
  expectedMrr: number;
  upsideMrr: number;
  downsideMrr: number;
  expectedDeltaPct: number;
  upsideDeltaPct: number;
  downsideDeltaPct: number;
}

export interface StrategicBrief {
  generatedAt: string;
  executiveSummary: string;
  stabilityVerdict: string;
  stabilityLevel: "strong" | "moderate" | "fragile";
  keyMetrics: { label: string; value: string; status: "good" | "warning" | "critical" }[];
  recommendations: BriefRecommendation[];
  cohortAlert: string | null;
  revenueOutlook: string;
  revenueComparison: RevenueComparison;
  memberAlerts: MemberAlertEnriched[];
  roiProjection: { actionTaken: string; membersRetained: number; revenuePreserved: number; annualImpact: number };
}

// ═══════════════════════════════════════════════════════════════
// FULL PREDICTIVE PAYLOAD
// ═══════════════════════════════════════════════════════════════

export interface PredictiveIntelligence {
  memberPredictions: MemberPredictionSummary;
  cohortIntelligence: CohortIntelligence;
  revenueScenario: RevenueScenario;
  strategicBrief: StrategicBrief;
}

// ═══════════════════════════════════════════════════════════════
// COMPUTATION ENGINE
// ═══════════════════════════════════════════════════════════════

export async function generatePredictiveIntelligence(gymId: string): Promise<PredictiveIntelligence> {
  const [allMembers, allMetrics, allContacts] = await Promise.all([
    storage.getMembersByGym(gymId),
    storage.getAllMonthlyMetrics(gymId),
    storage.getLatestContacts(gymId),
  ]);

  const sortedMetrics = [...allMetrics].sort((a, b) => a.monthStart.localeCompare(b.monthStart));
  const latestMetrics = sortedMetrics[sortedMetrics.length - 1];

  const contactMap = new Map<string, Date>();
  for (const c of allContacts) {
    if (c.contactedAt && !contactMap.has(c.memberId)) {
      contactMap.set(c.memberId, c.contactedAt);
    }
  }

  const activeMembers = allMembers.filter(m => m.status === "active");
  const cancelledMembers = allMembers.filter(m => m.status === "cancelled");
  const now = new Date();

  if (allMembers.length === 0) {
    return getEmptyIntelligence("No members found. Import members to generate predictive intelligence.");
  }

  const rates = activeMembers.map(m => Number(m.monthlyRate)).sort((a, b) => b - a);
  const top20Threshold = rates.length > 0 ? rates[Math.floor(rates.length * 0.2)] : 0;

  const gymChurnRate = latestMetrics ? Number(latestMetrics.churnRate) : 5;
  const gymArm = latestMetrics ? Number(latestMetrics.arm) : (rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0);

  const cancelledTenures = cancelledMembers
    .filter(m => m.cancelDate)
    .map(m => {
      const join = new Date(m.joinDate + "T00:00:00");
      const cancel = new Date(m.cancelDate! + "T00:00:00");
      return Math.max(0, Math.floor((cancel.getTime() - join.getTime()) / (1000 * 60 * 60 * 24)));
    });

  const medianCancelTenure = cancelledTenures.length > 0
    ? cancelledTenures.sort((a, b) => a - b)[Math.floor(cancelledTenures.length / 2)]
    : 60;

  const pctCancelledBefore90 = cancelledTenures.length > 0
    ? cancelledTenures.filter(t => t <= 90).length / cancelledTenures.length
    : 0.5;

  const memberPredictions = computeMemberPredictions(
    activeMembers, contactMap, now, gymChurnRate, gymArm,
    top20Threshold, medianCancelTenure, pctCancelledBefore90
  );

  const cohortIntelligence = computeCohortIntelligence(allMembers, now, cancelledTenures);

  const revenueScenario = computeRevenueScenarios(sortedMetrics, activeMembers, gymChurnRate, gymArm);

  const strategicBrief = generateStrategicBrief(
    memberPredictions, cohortIntelligence, revenueScenario,
    sortedMetrics, gymChurnRate, gymArm, activeMembers.length
  );

  return {
    memberPredictions,
    cohortIntelligence,
    revenueScenario,
    strategicBrief,
  };
}

// ═══════════════════════════════════════════════════════════════
// MEMBER PREDICTION ENGINE
// ═══════════════════════════════════════════════════════════════

function computeMemberPredictions(
  activeMembers: Member[],
  contactMap: Map<string, Date>,
  now: Date,
  gymChurnRate: number,
  gymArm: number,
  top20Threshold: number,
  medianCancelTenure: number,
  pctCancelledBefore90: number
): MemberPredictionSummary {
  const predictions: MemberPrediction[] = [];

  for (const m of activeMembers) {
    const joinDate = new Date(m.joinDate + "T00:00:00");
    const tenureDays = Math.max(0, Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24)));
    const tenureMonths = Math.floor(tenureDays / 30.44);
    const rate = Number(m.monthlyRate);
    const lastContact = contactMap.get(m.id) || null;
    const lastContactDays = lastContact
      ? Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const isHighValue = rate >= top20Threshold && top20Threshold > 0;

    let churnProb = 0;
    const riskDrivers: string[] = [];

    // Tenure-based risk (30-60-90 day danger zones)
    if (tenureDays <= 14) {
      churnProb += 0.35;
      riskDrivers.push("Critical onboarding window (first 2 weeks)");
    } else if (tenureDays <= 30) {
      churnProb += 0.28;
      riskDrivers.push("First month — habit formation period");
    } else if (tenureDays <= 60) {
      churnProb += 0.22;
      riskDrivers.push("Pre-habit window (30-60 days)");
    } else if (tenureDays <= 90) {
      churnProb += 0.15;
      riskDrivers.push("Community integration phase (60-90 days)");
    } else if (tenureDays <= 180) {
      churnProb += 0.08;
    } else if (tenureDays <= 365) {
      churnProb += 0.04;
    } else {
      churnProb += 0.02;
    }

    // Contact recency risk
    if (lastContactDays === null) {
      if (tenureDays <= 60) {
        churnProb += 0.20;
        riskDrivers.push("Never contacted — no coach connection established");
      } else if (tenureDays <= 180) {
        churnProb += 0.10;
        riskDrivers.push("No recorded outreach");
      }
    } else if (lastContactDays > 30 && tenureDays <= 90) {
      churnProb += 0.15;
      riskDrivers.push("No contact in 30+ days during critical window");
    } else if (lastContactDays > 60) {
      churnProb += 0.08;
      riskDrivers.push("No contact in 60+ days");
    }

    // Gym-wide churn pressure
    if (gymChurnRate > 7) {
      churnProb += 0.06;
      if (tenureDays <= 90) riskDrivers.push("High gym-wide churn environment");
    } else if (gymChurnRate > 5) {
      churnProb += 0.03;
    }

    // Rate-based signals
    if (rate < gymArm * 0.7 && rate > 0) {
      churnProb += 0.04;
      riskDrivers.push("Below-average rate — possible discount or trial member");
    }

    // Cohort danger zone amplifier
    if (tenureDays <= medianCancelTenure * 1.2 && pctCancelledBefore90 > 0.4) {
      churnProb += 0.05;
      if (tenureDays <= 90) riskDrivers.push("In the tenure range where most cancellations historically occur");
    }

    // High-value member gets slight reduction (more invested)
    if (isHighValue && tenureDays > 90) {
      churnProb -= 0.03;
    }

    // Tenure loyalty bonus
    if (tenureDays > 365) {
      churnProb -= 0.05;
    }

    churnProb = Math.max(0.01, Math.min(0.95, churnProb));

    // Engagement classification
    let engagementClass: EngagementClass;
    if (churnProb <= 0.15 && tenureDays > 90) {
      engagementClass = "core";
    } else if (churnProb <= 0.30) {
      engagementClass = "drifter";
    } else if (churnProb <= 0.55) {
      engagementClass = "at-risk";
    } else {
      engagementClass = "ghost";
    }

    // Expected LTV remaining
    const monthlyChurnProb = Math.min(churnProb, 0.5);
    const expectedMonthsRemaining = monthlyChurnProb > 0 ? (1 / monthlyChurnProb) : 24;
    const expectedLtvRemaining = Math.round(rate * Math.min(expectedMonthsRemaining, 60));
    const revenueAtRisk = Math.round(rate * Math.min(expectedMonthsRemaining * churnProb, 12));

    // Primary risk driver
    const primaryRiskDriver = riskDrivers.length > 0
      ? riskDrivers[0]
      : tenureDays <= 90 ? "Early-stage member" : "No significant risk signals";

    const { type: interventionType, detail: interventionDetail, microGuidance: interventionMicroGuidance, urgency: interventionUrgency } = selectIntervention(
      churnProb, tenureDays, lastContactDays, isHighValue, rate, gymArm, riskDrivers
    );

    predictions.push({
      memberId: m.id,
      name: m.name,
      email: m.email,
      monthlyRate: rate,
      tenureDays,
      tenureMonths,
      churnProbability: parseFloat(churnProb.toFixed(3)),
      engagementClass,
      expectedLtvRemaining,
      revenueAtRisk,
      primaryRiskDriver,
      riskDrivers,
      interventionType,
      interventionDetail,
      interventionMicroGuidance,
      interventionUrgency,
      lastContactDays,
      isHighValue,
    });
  }

  predictions.sort((a, b) => b.churnProbability - a.churnProbability);

  const classBreakdown: Record<EngagementClass, number> = { core: 0, drifter: 0, "at-risk": 0, ghost: 0 };
  let totalAtRisk = 0;
  let totalRevenueAtRisk = 0;
  let totalLtvAtRisk = 0;
  let sumChurnProb = 0;
  let urgentCount = 0;
  const driverCounts: Record<string, number> = {};

  for (const p of predictions) {
    classBreakdown[p.engagementClass]++;
    if (p.engagementClass === "at-risk" || p.engagementClass === "ghost") {
      totalAtRisk++;
      totalRevenueAtRisk += p.monthlyRate;
      totalLtvAtRisk += p.expectedLtvRemaining;
    }
    sumChurnProb += p.churnProbability;
    if (p.interventionUrgency === "immediate" || p.interventionUrgency === "this-week") {
      urgentCount++;
    }
    if (p.riskDrivers.length > 0) {
      const driver = p.riskDrivers[0];
      driverCounts[driver] = (driverCounts[driver] || 0) + 1;
    }
  }

  const topDriver = Object.entries(driverCounts).sort((a, b) => b[1] - a[1])[0];

  return {
    members: predictions,
    summary: {
      totalAtRisk,
      totalRevenueAtRisk: Math.round(totalRevenueAtRisk),
      totalLtvAtRisk: Math.round(totalLtvAtRisk),
      avgChurnProbability: predictions.length > 0 ? parseFloat((sumChurnProb / predictions.length).toFixed(3)) : 0,
      classBreakdown,
      urgentInterventions: urgentCount,
      topRiskDriver: topDriver ? topDriver[0] : "No significant risk drivers",
    },
  };
}

function selectIntervention(
  churnProb: number,
  tenureDays: number,
  lastContactDays: number | null,
  isHighValue: boolean,
  rate: number,
  gymArm: number,
  riskDrivers: string[]
): { type: InterventionType; detail: string; microGuidance: string; urgency: "immediate" | "this-week" | "this-month" | "monitor" } {
  const hasContactGap = lastContactDays === null || lastContactDays > 14;

  if (churnProb > 0.55) {
    if (tenureDays <= 30) {
      return {
        type: "onboarding-acceleration",
        detail: "This member is at high risk of leaving before building a habit. Get a coach in front of them — a 15-minute 1-on-1 to set specific movement goals for their first month. Then: structured check-ins after their 1st, 7th, and 14th day. Early skill wins create belonging.",
        microGuidance: "Book a 15-min 1-on-1 goal session; check in after day 1, 7, and 14",
        urgency: "immediate",
      };
    }
    if (isHighValue) {
      return {
        type: "personal-outreach",
        detail: "High-value member showing disengagement. A personal call from you or the head coach — not a text. Ask open-ended questions, listen to what's changed, and show genuine interest. This member's revenue justifies the time, but the approach has to be real curiosity, not a retention pitch.",
        microGuidance: "Head coach calls today — listen first, ask what's changed",
        urgency: "immediate",
      };
    }
    return {
      type: "win-back",
      detail: "This member is likely to cancel without direct action. Reconnection happens through shared experience, not emails or discounts. Personally invite them to a partner workout, a community event, or during Open season, encourage them to sign up. Shared physical experience rebuilds the connection that keeps people.",
      microGuidance: "Personally invite to the next partner workout or upcoming event",
      urgency: "this-week",
    };
  }

  if (churnProb > 0.30) {
    if (tenureDays <= 60 && hasContactGap) {
      return {
        type: "coach-connection",
        detail: "This member hasn't been personally connected to a coach yet. Assign one. Have them spend 5 minutes after the next class just listening — not instructing — to find out what this person actually needs to feel like they belong here.",
        microGuidance: "Assign a coach; 5-min post-class conversation within 7 days",
        urgency: "this-week",
      };
    }
    if (tenureDays <= 90) {
      return {
        type: "goal-setting",
        detail: "Set a 90-day skill milestone — first pull-up, first Rx workout, or first competition. This is where a member goes from 'trying CrossFit' to 'being a CrossFitter.' Concrete goals make progress visible and build the emotional investment that turns attendance into identity.",
        microGuidance: "Set 1 specific skill milestone with a target date",
        urgency: "this-week",
      };
    }
    if (tenureDays > 180) {
      return {
        type: "community-integration",
        detail: "Long-tenured member showing drift. Give them a role — new member mentor, competition team captain, or event organizer. Members who contribute to how the gym runs become inseparable from it. When someone has a defined role, leaving means losing part of their identity.",
        microGuidance: "Give them a role: mentor, team captain, or event organizer",
        urgency: "this-month",
      };
    }
    return {
      type: "personal-outreach",
      detail: "Direct personal outreach from a coach who knows this member. Ask about their goals, what's working, what's not. Sometimes members drift because they feel invisible — a genuine conversation where you listen costs nothing and prevents cancellations.",
      microGuidance: "Coach texts today: 'Hey, how's training going? Anything I can help with?'",
      urgency: "this-week",
    };
  }

  if (churnProb > 0.15) {
    if (tenureDays > 365) {
      return {
        type: "milestone-celebration",
        detail: "Celebrate their membership anniversary. Public recognition during class, a small gift, or a social media shout-out. When a 2-year member gets celebrated, every 2-month member sees a future worth staying for. Honoring your veterans sets the standard for what loyalty looks like.",
        microGuidance: "Plan a public shout-out at the next class; post on social",
        urgency: "this-month",
      };
    }
    if (rate < gymArm * 0.8) {
      return {
        type: "pricing-review",
        detail: "This member is on a below-average rate. When their next billing cycle approaches, consider offering a premium tier upgrade with added value (open gym access, nutrition coaching, or specialty programming) rather than a price increase.",
        microGuidance: "Prepare value-add upgrade offer before next billing cycle",
        urgency: "this-month",
      };
    }
    return {
      type: "community-integration",
      detail: "Deepen community connection through partner workouts, team competitions, or social events. Members who have 3+ gym friendships stay at dramatically higher rates. The workout brings them in — the relationships keep them.",
      microGuidance: "Pair with another member for the next partner workout",
      urgency: "this-month",
    };
  }

  return {
    type: "goal-setting",
    detail: "This member is well-embedded and represents your gym's standard. Keep them growing: quarterly goal-setting conversations to review progress and set new targets, track their skill progression (gymnastics, Olympic lifts, engine work), and encourage competition participation — in-house throwdowns, local comps, or the Open. Reinforce that their movement quality sets the bar for everyone else. These are the members who make your gym what it is.",
    microGuidance: "Schedule a quarterly goal review; track their skill progression",
    urgency: "monitor",
  };
}

// ═══════════════════════════════════════════════════════════════
// COHORT INTELLIGENCE ENGINE
// ═══════════════════════════════════════════════════════════════

function computeCohortIntelligence(
  allMembers: Member[],
  now: Date,
  cancelledTenures: number[]
): CohortIntelligence {
  const cohortMap = new Map<string, Member[]>();

  for (const m of allMembers) {
    const joinDate = new Date(m.joinDate + "T00:00:00");
    const key = `${joinDate.getFullYear()}-${String(joinDate.getMonth() + 1).padStart(2, "0")}`;
    const list = cohortMap.get(key) || [];
    list.push(m);
    cohortMap.set(key, list);
  }

  const cohorts: CohortBucket[] = [];
  for (const [key, members] of cohortMap) {
    const active = members.filter(m => m.status === "active");
    const totalRate = members.reduce((s, m) => s + Number(m.monthlyRate), 0);
    const activeRate = active.reduce((s, m) => s + Number(m.monthlyRate), 0);
    const avgDays = active.length > 0
      ? active.reduce((s, m) => s + Math.floor((now.getTime() - new Date(m.joinDate + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24)), 0) / active.length
      : 0;

    cohorts.push({
      cohortLabel: new Date(key + "-01T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      cohortMonth: key,
      totalJoined: members.length,
      stillActive: active.length,
      survivalRate: members.length > 0 ? parseFloat((active.length / members.length * 100).toFixed(1)) : 0,
      avgTenureDays: Math.round(avgDays),
      avgMonthlyRate: members.length > 0 ? parseFloat((totalRate / members.length).toFixed(0)) : 0,
      revenueRetained: Math.round(activeRate),
      revenueLost: Math.round(totalRate - activeRate),
    });
  }

  cohorts.sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth));

  // Retention windows (where members are lost)
  const windows: RetentionWindow[] = [];
  const cancelled = allMembers.filter(m => m.status === "cancelled" && m.cancelDate);

  const windowDefs = [
    { window: "0-30 days", min: 0, max: 30 },
    { window: "31-60 days", min: 31, max: 60 },
    { window: "61-90 days", min: 61, max: 90 },
    { window: "91-180 days", min: 91, max: 180 },
    { window: "181-365 days", min: 181, max: 365 },
    { window: "365+ days", min: 366, max: Infinity },
  ];

  for (const wd of windowDefs) {
    const inWindow = cancelled.filter(m => {
      const join = new Date(m.joinDate + "T00:00:00");
      const cancel = new Date(m.cancelDate! + "T00:00:00");
      const days = Math.floor((cancel.getTime() - join.getTime()) / (1000 * 60 * 60 * 24));
      return days >= wd.min && days <= wd.max;
    });

    const avgRate = inWindow.length > 0
      ? inWindow.reduce((s, m) => s + Number(m.monthlyRate), 0) / inWindow.length
      : 0;
    const revLost = inWindow.reduce((s, m) => s + Number(m.monthlyRate), 0);

    const crossfitInsights: Record<string, string> = {
      "0-30 days": "Members who leave in the first month never formed the habit. They experienced the intensity but didn't find their people. Structured onboarding — personal introductions, scaled workouts, and post-class check-ins — prevents this.",
      "31-60 days": "The 30-60 day window is where initial excitement fades. Members need a tangible goal that shifts them from 'trying CrossFit' to 'being a CrossFitter.' A skill to chase, a PR to hit, a first Rx workout.",
      "61-90 days": "Members leaving at 60-90 days made it past the initial hurdle but didn't cross the belonging threshold. They need a role, not just attendance — partner workouts, team competitions, mentoring opportunities.",
      "91-180 days": "Members who leave between 3-6 months often hit a plateau. Are all your coaches delivering the same standard? Are they connecting with athletes individually? Audit coaching consistency.",
      "181-365 days": "Members leaving in the 6-12 month range are significant losses. These departures often signal coaching changes or cultural drift. Review whether your standards have slipped or the experience has changed.",
      "365+ days": "Long-tenured members who leave represent deep culture loss. These are your culture carriers, and losing them signals systemic issues: pricing pressure, coaching turnover, or a shift in what your gym stands for.",
    };

    windows.push({
      window: wd.window,
      lostCount: inWindow.length,
      lostPct: cancelled.length > 0 ? parseFloat((inWindow.length / cancelled.length * 100).toFixed(1)) : 0,
      avgRate: parseFloat(avgRate.toFixed(0)),
      revenueLost: Math.round(revLost),
      insight: crossfitInsights[wd.window] || "",
    });
  }

  // Survival curve
  const survivalCurve: { days: number; survivalRate: number }[] = [];
  const totalMembers = allMembers.length;
  if (totalMembers > 0) {
    for (const dayMark of [0, 7, 14, 30, 60, 90, 120, 180, 270, 365, 545, 730]) {
      const survivedPast = allMembers.filter(m => {
        if (m.status === "active") return true;
        if (!m.cancelDate) return false;
        const join = new Date(m.joinDate + "T00:00:00");
        const cancel = new Date(m.cancelDate + "T00:00:00");
        const tenure = Math.floor((cancel.getTime() - join.getTime()) / (1000 * 60 * 60 * 24));
        return tenure > dayMark;
      }).length;
      survivalCurve.push({ days: dayMark, survivalRate: parseFloat((survivedPast / totalMembers * 100).toFixed(1)) });
    }
  }

  // Insights
  const insights: string[] = [];
  const crossfitInsights: string[] = [];

  const totalCancelled = cancelled.length;
  const before90 = cancelled.filter(m => {
    const join = new Date(m.joinDate + "T00:00:00");
    const cancel = new Date(m.cancelDate! + "T00:00:00");
    return Math.floor((cancel.getTime() - join.getTime()) / (1000 * 60 * 60 * 24)) <= 90;
  }).length;

  if (totalCancelled > 0) {
    const pctBefore90 = (before90 / totalCancelled * 100);
    insights.push(`${pctBefore90.toFixed(0)}% of all cancellations happen within the first 90 days.`);

    if (pctBefore90 > 50) {
      insights.push(`More than half of member losses occur before the 90-day mark. Your onboarding process is the highest-leverage investment you can make.`);
      crossfitInsights.push(`In CrossFit, the first 90 days determine whether someone becomes a member or a dropout. The workouts are hard enough to quit — the community has to be strong enough to stay for.`);
    }
  }

  const bestCohort = cohorts.filter(c => c.totalJoined >= 3).sort((a, b) => b.survivalRate - a.survivalRate)[0];
  const worstCohort = cohorts.filter(c => c.totalJoined >= 3).sort((a, b) => a.survivalRate - b.survivalRate)[0];

  if (bestCohort && worstCohort && bestCohort.cohortMonth !== worstCohort.cohortMonth) {
    insights.push(`Best retention cohort: ${bestCohort.cohortLabel} (${bestCohort.survivalRate}% still active). Worst: ${worstCohort.cohortLabel} (${worstCohort.survivalRate}% still active).`);

    const bestMonth = new Date(bestCohort.cohortMonth + "-01T00:00:00").getMonth();
    const worstMonth = new Date(worstCohort.cohortMonth + "-01T00:00:00").getMonth();
    const seasonMap: Record<number, string> = { 0: "January", 1: "February", 2: "March", 3: "April", 4: "May", 5: "June", 6: "July", 7: "August", 8: "September", 9: "October", 10: "November", 11: "December" };

    if ([0, 1, 8, 9].includes(bestMonth)) {
      crossfitInsights.push(`Members who join in ${seasonMap[bestMonth]} tend to retain better — they're making intentional decisions (New Year's resolution or post-summer commitment) rather than impulse purchases. Lean into this timing with structured onboarding programs.`);
    }
    if ([5, 6, 11].includes(worstMonth)) {
      crossfitInsights.push(`${seasonMap[worstMonth]} signups have lower retention. Summer and holiday joiners often lack long-term commitment. Consider shorter initial commitments or trial periods for seasonal signups.`);
    }
  }

  if (survivalCurve.length >= 5) {
    const day30Survival = survivalCurve.find(s => s.days === 30)?.survivalRate ?? 100;
    const day90Survival = survivalCurve.find(s => s.days === 90)?.survivalRate ?? 100;
    const day365Survival = survivalCurve.find(s => s.days === 365)?.survivalRate ?? 100;

    if (day90Survival > 0 && day365Survival > 0) {
      const retentionMultiplier = (day365Survival / day90Survival).toFixed(1);
      crossfitInsights.push(`Members who survive their first 90 days retain at ${retentionMultiplier}x the rate through year one. The 90-day mark is your retention cliff — everything before it is onboarding, everything after is community.`);
    }

    if (day30Survival < 85) {
      crossfitInsights.push(`You're losing ${(100 - day30Survival).toFixed(0)}% of members before they complete their first month. This often means the gap between the free trial experience and the ongoing membership experience is too large. Structured Foundations programs close this gap.`);
    }
  }

  const currentMonth = now.getMonth();

  if (currentMonth >= 0 && currentMonth <= 3) {
    crossfitInsights.push(`The CrossFit Open (Feb-March) is your biggest retention and growth window. Run Friday Night Lights, form intramural teams, and invite non-members to watch or try a workout. Open participation correlates with 6-12 months of stronger retention.`);
  }

  if (currentMonth >= 3 && currentMonth <= 5) {
    crossfitInsights.push(`Spring is prime time for specialty seminars — Olympic weightlifting clinics, gymnastics skill sessions, or mobility workshops. These events re-engage drifting members by giving them a new goal. Charge a small fee or make them member-exclusive to reinforce the value of membership.`);
  }

  if (currentMonth >= 5 && currentMonth <= 7) {
    crossfitInsights.push(`Summer brings schedule disruptions and travel. Counter this with Hero WODs on Memorial Day, July 4th partner workouts, or outdoor community events. These create moments members talk about and don't want to miss.`);
  }

  if (currentMonth >= 8 && currentMonth <= 9) {
    crossfitInsights.push(`Fall is your second-best acquisition window after January. Launch a 6-week nutrition challenge or a "Back to Basics" foundations series. Members returning from summer are looking for structure — give it to them before they drift further.`);
  }

  if (currentMonth >= 10 && currentMonth <= 11) {
    crossfitInsights.push(`Holiday season means cancellation risk. Run a "12 Days of Christmas" WOD series, Thanksgiving partner workouts, or a year-end goal-setting event. Give members a reason to stay engaged through the holidays instead of waiting for January to restart.`);
  }

  crossfitInsights.push(`Events are your highest-leverage retention tool. Rotate through: yoga or mobility clinics, nutrition challenges, weightlifting or gymnastics seminars, Hero WODs, bring-a-friend days, and internal competitions. Aim for at least one community event per month — members who participate in events cancel at half the rate.`);

  crossfitInsights.push(`Coaching consistency drives retention. If members get a different experience depending on which coach leads class, your culture has a crack. Invest in coach development, shadowing, and regular feedback. Every class should feel like the same gym.`);

  return { cohorts, retentionWindows: windows, survivalCurve, insights, crossfitInsights };
}

// ═══════════════════════════════════════════════════════════════
// REVENUE SCENARIO ENGINE (MONTE CARLO-STYLE)
// ═══════════════════════════════════════════════════════════════

function computeRevenueScenarios(
  sortedMetrics: { monthStart: string; activeMembers: number; churnRate: string | number; mrr: string | number; arm: string | number; newMembers: number; cancels: number }[],
  activeMembers: Member[],
  gymChurnRate: number,
  gymArm: number
): RevenueScenario {
  const currentMrr = sortedMetrics.length > 0 ? Number(sortedMetrics[sortedMetrics.length - 1].mrr) : activeMembers.length * gymArm;
  const currentMembers = sortedMetrics.length > 0 ? sortedMetrics[sortedMetrics.length - 1].activeMembers : activeMembers.length;
  const arm = gymArm;

  const recent = sortedMetrics.length >= 3 ? sortedMetrics.slice(-3) : sortedMetrics;
  const avgChurn = recent.reduce((s, m) => s + Number(m.churnRate), 0) / Math.max(recent.length, 1);
  const avgNewMembers = recent.reduce((s, m) => s + m.newMembers, 0) / Math.max(recent.length, 1);

  const churnStdDev = recent.length >= 2
    ? Math.sqrt(recent.reduce((s, m) => s + Math.pow(Number(m.churnRate) - avgChurn, 2), 0) / recent.length)
    : avgChurn * 0.3;

  const newMemberStdDev = recent.length >= 2
    ? Math.sqrt(recent.reduce((s, m) => s + Math.pow(m.newMembers - avgNewMembers, 2), 0) / recent.length)
    : avgNewMembers * 0.3;

  const projections: ScenarioMonth[] = [];
  const lastMonth = sortedMetrics.length > 0 ? sortedMetrics[sortedMetrics.length - 1].monthStart : new Date().toISOString().slice(0, 10);

  let expectedMembers = currentMembers;
  let upsideMembers = currentMembers;
  let downsideMembers = currentMembers;

  for (let i = 0; i <= 6; i++) {
    const d = new Date(lastMonth + "T00:00:00");
    d.setMonth(d.getMonth() + i);
    const monthStr = d.toISOString().slice(0, 10);

    if (i === 0) {
      projections.push({
        month: monthStr,
        current: Math.round(currentMrr),
        expected: Math.round(currentMrr),
        upside: Math.round(currentMrr),
        downside: Math.round(currentMrr),
      });
      continue;
    }

    // Expected: average churn, average new
    const expLost = Math.round(expectedMembers * (avgChurn / 100));
    const expGained = Math.round(avgNewMembers);
    expectedMembers = Math.max(0, expectedMembers - expLost + expGained);

    // Upside: low churn (-1 stddev), high acquisition (+1 stddev)
    const upChurn = Math.max(0, avgChurn - churnStdDev);
    const upNew = avgNewMembers + newMemberStdDev;
    const upLost = Math.round(upsideMembers * (upChurn / 100));
    const upGained = Math.round(upNew);
    upsideMembers = Math.max(0, upsideMembers - upLost + upGained);

    // Downside: high churn (+1.5 stddev), low acquisition (-1 stddev)
    const downChurn = avgChurn + churnStdDev * 1.5;
    const downNew = Math.max(0, avgNewMembers - newMemberStdDev);
    const downLost = Math.round(downsideMembers * (downChurn / 100));
    const downGained = Math.round(downNew);
    downsideMembers = Math.max(0, downsideMembers - downLost + downGained);

    projections.push({
      month: monthStr,
      current: Math.round(currentMrr),
      expected: Math.round(expectedMembers * arm),
      upside: Math.round(upsideMembers * arm),
      downside: Math.round(downsideMembers * arm),
    });
  }

  const finalExpected = projections[projections.length - 1]?.expected ?? currentMrr;
  const finalDownside = projections[projections.length - 1]?.downside ?? currentMrr;
  const finalUpside = projections[projections.length - 1]?.upside ?? currentMrr;

  // Break-even risk: probability that MRR drops below operating costs (estimate 60% of current MRR)
  const operatingThreshold = currentMrr * 0.6;
  const breakEvenRisk = finalDownside < operatingThreshold ? 0.7
    : finalDownside < currentMrr * 0.8 ? 0.3
    : finalExpected < currentMrr * 0.95 ? 0.15
    : 0.05;

  const cashFlowRiskLevel: RevenueScenario["cashFlowRiskLevel"] =
    breakEvenRisk > 0.5 ? "critical" : breakEvenRisk > 0.25 ? "high" : breakEvenRisk > 0.1 ? "moderate" : "low";

  const scenarioInsights: string[] = [];
  const expectedDelta = ((finalExpected - currentMrr) / currentMrr * 100);
  const downsideDelta = ((finalDownside - currentMrr) / currentMrr * 100);

  if (expectedDelta > 5) {
    scenarioInsights.push(`On the current path, revenue grows ${expectedDelta.toFixed(1)}% over 6 months to $${finalExpected.toLocaleString()}/mo.`);
  } else if (expectedDelta > -2) {
    scenarioInsights.push(`Revenue looks stable at $${finalExpected.toLocaleString()}/mo. No big changes expected.`);
  } else {
    scenarioInsights.push(`At current churn, revenue shrinks ${Math.abs(expectedDelta).toFixed(1)}% to $${finalExpected.toLocaleString()}/mo. That's the trend you're fighting.`);
  }

  if (downsideDelta < -15) {
    scenarioInsights.push(`If churn gets worse and new signups slow down, revenue could drop to $${finalDownside.toLocaleString()}/mo — that's a ${Math.abs(downsideDelta).toFixed(0)}% hit. This is the scenario you want to prevent.`);
  }

  const spreadPct = ((finalUpside - finalDownside) / currentMrr * 100).toFixed(0);
  scenarioInsights.push(`The gap between best and worst case is ${spreadPct}%. ${Number(spreadPct) > 30 ? "That's a wide range — stabilizing retention would narrow it significantly." : "Moderate spread — your revenue base is reasonably predictable."}`);

  return {
    projections,
    breakEvenRisk: parseFloat(breakEvenRisk.toFixed(2)),
    cashFlowRiskLevel,
    worstCaseMrr: finalDownside,
    expectedMrr: finalExpected,
    upsideMrr: finalUpside,
    scenarioInsights,
  };
}

// ═══════════════════════════════════════════════════════════════
// STRATEGIC BRIEF GENERATOR
// ═══════════════════════════════════════════════════════════════

function generateStrategicBrief(
  memberPredictions: MemberPredictionSummary,
  cohortIntelligence: CohortIntelligence,
  revenueScenario: RevenueScenario,
  sortedMetrics: { monthStart: string; activeMembers: number; churnRate: string | number; mrr: string | number; arm: string | number; newMembers: number; cancels: number; rsi: number }[],
  gymChurnRate: number,
  gymArm: number,
  activeMemberCount: number
): StrategicBrief {
  const now = new Date();
  const latest = sortedMetrics[sortedMetrics.length - 1];
  const latestRsi = latest?.rsi ?? 0;
  const latestMrr = latest ? Number(latest.mrr) : 0;

  // Key metrics
  const keyMetrics: StrategicBrief["keyMetrics"] = [
    { label: "Active Members", value: String(activeMemberCount), status: activeMemberCount > 50 ? "good" : activeMemberCount > 20 ? "warning" : "critical" },
    { label: "Monthly Churn", value: `${gymChurnRate.toFixed(1)}%`, status: gymChurnRate <= 5 ? "good" : gymChurnRate <= 7 ? "warning" : "critical" },
    { label: "Revenue/Member", value: `$${gymArm.toFixed(0)}`, status: gymArm >= 150 ? "good" : gymArm >= 100 ? "warning" : "critical" },
    { label: "RSI", value: `${latestRsi}/100`, status: latestRsi >= 80 ? "good" : latestRsi >= 60 ? "warning" : "critical" },
    { label: "At-Risk Members", value: String(memberPredictions.summary.totalAtRisk), status: memberPredictions.summary.totalAtRisk === 0 ? "good" : memberPredictions.summary.totalAtRisk <= 3 ? "warning" : "critical" },
    { label: "Revenue at Risk", value: `$${memberPredictions.summary.totalRevenueAtRisk.toLocaleString()}/mo`, status: memberPredictions.summary.totalRevenueAtRisk === 0 ? "good" : memberPredictions.summary.totalRevenueAtRisk < latestMrr * 0.1 ? "warning" : "critical" },
  ];

  let stabilityVerdict: string;
  let stabilityLevel: "strong" | "moderate" | "fragile";
  if (latestRsi >= 80 && gymChurnRate <= 5) {
    stabilityLevel = "strong";
    stabilityVerdict = "Your gym is in a strong position. Retention is working, revenue is predictable, and your community is stable. Now deepen it — invest in coaching development and don't coast.";
  } else if (latestRsi >= 60 && gymChurnRate <= 7) {
    stabilityLevel = "moderate";
    stabilityVerdict = "Your gym is functional but not fortified. The numbers are acceptable, but one bad month — a coaching change, a competitor opening, a seasonal dip — could expose the cracks. Now is the time to strengthen, while you have margin.";
  } else {
    stabilityLevel = "fragile";
    stabilityVerdict = "Your gym is in a tough spot. Revenue is volatile, retention is leaking, and your membership base isn't building the loyalty that creates resilience. Start with the fundamentals: define your standards, connect individually with your members, and build trust. Every month without action makes the next month harder.";
  }

  // Executive summary
  const { summary } = memberPredictions;
  const totalRevAtRisk = summary.totalRevenueAtRisk;
  const annualRisk = totalRevAtRisk * 12;

  let executiveSummary: string;
  if (summary.totalAtRisk === 0) {
    executiveSummary = `All ${activeMemberCount} active members are in good shape. No immediate risk. Focus on community and referrals.`;
  } else {
    executiveSummary = `${summary.totalAtRisk} of ${activeMemberCount} members are showing signs they might leave, putting $${totalRevAtRisk.toLocaleString()}/month ($${annualRisk.toLocaleString()}/year) at risk. ${summary.urgentInterventions > 0 ? `${summary.urgentInterventions} need action this week.` : "All can be addressed through structured outreach this month."} The most common issue: ${summary.topRiskDriver}.`;
  }

  // Recommendations (non-generic, economically quantified)
  const recommendations: BriefRecommendation[] = [];

  // Recommendation 1: Based on cohort analysis
  const worst30Day = cohortIntelligence.retentionWindows.find(w => w.window === "0-30 days");
  const worst60Day = cohortIntelligence.retentionWindows.find(w => w.window === "31-60 days");

  if (worst30Day && worst30Day.lostCount > 0 && worst30Day.lostPct > 20) {
    const savedRevenue = Math.round(worst30Day.lostCount * 0.3 * gymArm * 6);
    recommendations.push({
      category: "Onboarding",
      priority: "critical",
      headline: `${worst30Day.lostCount} members lost before day 30 — your onboarding is the highest-leverage fix`,
      detail: `${worst30Day.lostPct.toFixed(0)}% of all cancellations happen in the first month. Implement a structured 4-week Foundations program: Week 1 (movement basics + coach intro), Week 2 (first benchmark WOD), Week 3 (partner workout + community intro), Week 4 (goal-setting session with coach). In CrossFit, the first month determines everything — members need to feel competent, connected, and challenged. Without all three, they leave.`,
      revenueImpact: `Retaining just 30% of these members preserves ~$${savedRevenue.toLocaleString()} over 6 months`,
      interventionType: "Structured onboarding program",
      crossfitContext: "",
      timeframe: "Implement within 2 weeks",
      executionChecklist: [
        "Assign a dedicated coach to every new member within 24 hours of signup",
        "Schedule a 1-on-1 intro session in their first week",
        "Set 3 movement-based milestones for their first 30 days",
        "Pair them with a buddy member by their 3rd class",
        "Coach check-in call/text after their 1st, 7th, and 14th day",
        "Track first benchmark WOD completion in week 2",
      ],
    });
  } else if (worst60Day && worst60Day.lostCount > 0 && worst60Day.lostPct > 15) {
    const savedRevenue = Math.round(worst60Day.lostCount * 0.25 * gymArm * 8);
    recommendations.push({
      category: "Retention",
      priority: "high",
      headline: `${worst60Day.lostCount} members lost between days 31-60 — the belonging gap`,
      detail: `Members are surviving the initial shock but leaving before building community. Implement "90-Day Skill Milestones": first pull-up, first Rx WOD, first competition. Members who achieve a concrete goal in their first quarter retain at dramatically higher rates. The 30-60 day window is where CrossFit either becomes identity or exits — members need visible progress that creates emotional investment.`,
      revenueImpact: `Closing this gap could preserve ~$${savedRevenue.toLocaleString()} over 8 months`,
      interventionType: "Skill milestone program",
      crossfitContext: "",
      timeframe: "Launch within 1 month",
      executionChecklist: [
        "Define 3 skill milestones for each new member (e.g. first pull-up, first Rx workout, first competition)",
        "Assign coach to track milestone progress per member",
        "Set 30/60/90-day check-in schedule with each member",
        "Track first Rx workout completion",
        "Celebrate milestone achievements publicly in class",
        "Log milestone progress in member notes",
      ],
    });
  }

  // Recommendation 2: Based on churn dynamics
  if (gymChurnRate > 7) {
    const churnImprovement = gymChurnRate - 5;
    const membersRetainedPerMonth = Math.round(activeMemberCount * (churnImprovement / 100));
    const annualSaved = Math.round(membersRetainedPerMonth * gymArm * 12);
    recommendations.push({
      category: "Churn Reduction",
      priority: "critical",
      headline: `Reducing churn from ${gymChurnRate.toFixed(1)}% to 5% would save $${annualSaved.toLocaleString()}/year`,
      detail: `At current rates, you're losing ~${Math.round(activeMemberCount * gymChurnRate / 100)} members per month. The gap between your churn (${gymChurnRate.toFixed(1)}%) and the stability target (5%) represents ${membersRetainedPerMonth} members/month — each worth $${gymArm.toFixed(0)} in monthly revenue. High churn usually means one of three things: poor onboarding, coaching inconsistency across your team, or weak culture where members work out but don't connect.`,
      revenueImpact: `$${annualSaved.toLocaleString()} annual revenue preserved`,
      interventionType: "Retention system overhaul",
      crossfitContext: "",
      timeframe: "Begin assessment this week",
      executionChecklist: [
        "Call every member who cancelled in the last 60 days — ask what could have been different",
        "Audit onboarding: does every new member get a personal coach intro?",
        "Review coaching consistency — are class experiences uniform across coaches?",
        "Identify members with 0 logged contacts and schedule outreach",
        "Implement a cancellation save process (exit interview before processing)",
        "Set a weekly churn review meeting with coaching staff",
      ],
    });
  } else if (gymChurnRate > 5) {
    const improvement = gymChurnRate - 4;
    const saved = Math.round(activeMemberCount * (improvement / 100) * gymArm * 12);
    recommendations.push({
      category: "Retention Optimization",
      priority: "medium",
      headline: `Each 1% churn improvement unlocks ~$${Math.round(activeMemberCount * 0.01 * gymArm * 12).toLocaleString()}/year`,
      detail: `Your churn is above target but not critical. Focus on the specific members showing drift signals rather than system-wide changes. Personal outreach to the ${summary.totalAtRisk} at-risk members is the most efficient use of your time this week. At this churn level, the problem isn't systemic — it's individual. Each at-risk member has a specific reason they're drifting, and a genuine conversation where you listen more than you talk is the highest-ROI retention tool.`,
      revenueImpact: `$${saved.toLocaleString()} potential annual recovery`,
      interventionType: "Targeted member outreach",
      crossfitContext: "",
      timeframe: "This week — personal outreach",
      executionChecklist: [
        "Pull the at-risk member list from the Member Risk tab",
        "Assign each at-risk member to a specific coach for personal outreach",
        "Schedule text or call within 48 hours for each at-risk member",
        "Ask one open-ended question: 'What can we do better for you?'",
        "Log every contact in Iron Metrics to track outreach coverage",
      ],
    });
  } else {
    recommendations.push({
      category: "Retention",
      priority: "low",
      headline: "Churn is controlled — shift focus to deepening loyalty",
      detail: `At ${gymChurnRate.toFixed(1)}%, your retention is strong. The next level is building members who would never leave — not because of a contract, but because leaving would mean losing their identity. Define your standards, teach them, communicate them consistently, protect them, and be consistent. When your culture is defined and defended, community emerges naturally. Write down your gym's standards, etiquette, and dos/don'ts, and assign veteran members as mentors with defined roles.`,
      revenueImpact: "Compound loyalty reduces future churn risk and creates organic referral growth",
      interventionType: "Culture deepening",
      crossfitContext: "",
      timeframe: "Ongoing — culture investment",
      executionChecklist: [
        "Write down your gym's standards, etiquette, and dos/don'ts — make them visible",
        "Identify 3-5 long-tenured members to serve as community ambassadors with defined roles",
        "Assign veteran members as mentors to newer members — formalize the pairing",
        "Celebrate membership anniversaries publicly (6mo, 1yr, 2yr)",
        "Create a member spotlight routine (weekly or monthly)",
        "Host one community event per month outside the gym",
        "Protect your culture: have the difficult conversations when standards slip",
      ],
    });
  }

  // Recommendation 3: Revenue optimization
  if (gymArm < 120) {
    const armGap = 150 - gymArm;
    const revenueUnlocked = Math.round(armGap * activeMemberCount);
    recommendations.push({
      category: "Revenue per Member",
      priority: "high",
      headline: `$${armGap.toFixed(0)} gap between current ARM ($${gymArm.toFixed(0)}) and target ($150)`,
      detail: `Closing this gap adds $${revenueUnlocked.toLocaleString()}/month to your revenue without a single new member. Options: introduce premium tiers (unlimited + open gym + specialty classes), add nutrition coaching, or launch personal training packages. Members investing in transformation will pay more when the value is explicit and the coaching relationship is genuine.`,
      revenueImpact: `+$${revenueUnlocked.toLocaleString()}/month ($${(revenueUnlocked * 12).toLocaleString()}/year)`,
      interventionType: "Pricing tier introduction",
      crossfitContext: "",
      timeframe: "Design within 2 weeks, launch within 1 month",
      executionChecklist: [
        "Define 2-3 pricing tiers (e.g. Base, Performance, Unlimited)",
        "Add value to premium tiers: open gym, nutrition coaching, specialty classes",
        "Present upgrade options to current members at their next check-in",
        "Set a target: convert 20% of base members to a higher tier within 60 days",
        "Track ARM weekly to measure impact",
      ],
    });
  } else if (gymArm < 150) {
    recommendations.push({
      category: "Revenue Optimization",
      priority: "medium",
      headline: `ARM at $${gymArm.toFixed(0)} — room for premium tier expansion`,
      detail: "Your baseline pricing is reasonable. The opportunity is in value-add services: nutrition coaching ($50-100/mo), accountability programs, or specialty class access. These increase ARM without changing your core pricing. Members who invest more engage more — a higher-ARM member who gets nutrition coaching and quarterly goal reviews is far stickier than one who just shows up for WODs.",
      revenueImpact: `+$${Math.round((150 - gymArm) * activeMemberCount).toLocaleString()}/month if ARM reaches $150`,
      interventionType: "Value-add services",
      crossfitContext: "",
      timeframe: "Plan and pilot within 1 month",
      executionChecklist: [
        "Survey members: which add-on service would they value most?",
        "Pilot a nutrition coaching add-on with 5-10 interested members",
        "Create a specialty class series (Olympic lifting, gymnastics, etc.)",
        "Offer quarterly goal-review sessions as a premium perk",
        "Measure uptake rate and ARM impact monthly",
      ],
    });
  }

  // Recommendation 4: Growth or scenario-based
  const recent3Months = sortedMetrics.slice(-3);
  const avgNetGrowth = recent3Months.length > 0
    ? recent3Months.reduce((s, m) => s + (m.newMembers - m.cancels), 0) / recent3Months.length
    : 0;

  if (avgNetGrowth <= 0 && gymChurnRate <= 5) {
    recommendations.push({
      category: "Growth Strategy",
      priority: "high",
      headline: "Retention is strong but growth is flat — time to invest in acquisition",
      detail: `You're not losing members, but you're not adding them either. With churn at ${gymChurnRate.toFixed(1)}%, new members are highly likely to stick. This is the ideal time to invest in acquisition — referral programs, community events open to non-members, and the CrossFit Open as your biggest growth vehicle. Host Friday Night Lights during the Open — every member invites someone. Run 'Bring Your Person' weeks year-round. Your retention is your competitive advantage for growth.`,
      revenueImpact: `Each new member adds ~$${gymArm.toFixed(0)}/month with high retention probability`,
      interventionType: "Referral and acquisition programs",
      crossfitContext: "",
      timeframe: "Launch referral program within 2 weeks",
      executionChecklist: [
        "Launch a 'Bring Your Person' week — every member invites one guest",
        "Host Friday Night Lights during the Open — make it the event of the year",
        "Create a referral reward (free month, gear credit, etc.)",
        "Host one open community event per month (partner workout, potluck, competition)",
        "Post member transformation stories on social media weekly",
        "Track referral source for every new signup",
      ],
    });
  } else if (avgNetGrowth < -2) {
    const monthlyLoss = Math.abs(avgNetGrowth);
    recommendations.push({
      category: "Roster Stabilization",
      priority: "critical",
      headline: `Losing ${monthlyLoss.toFixed(0)} members/month net — roster is contracting`,
      detail: `At this rate, you'll lose ${Math.round(monthlyLoss * 6)} members over the next 6 months. This isn't a growth problem — it's a retention emergency. Before spending on acquisition, stop the bleeding. Every new member acquired into a high-churn environment is wasted acquisition cost. Fix the culture first: are your standards defined and enforced? Are your coaches trained to connect individually with athletes? Call every member who left and listen — don't pitch.`,
      revenueImpact: `$${Math.round(monthlyLoss * gymArm * 12).toLocaleString()}/year in lost revenue if trend continues`,
      interventionType: "Retention emergency protocol",
      crossfitContext: "",
      timeframe: "Start exit interviews this week",
      executionChecklist: [
        "Freeze all acquisition spending until churn is below 7%",
        "Call every member who cancelled in the last 90 days",
        "Ask one question: 'What could we have done differently?'",
        "Identify the top 3 cancellation reasons and create a fix plan for each",
        "Implement a 'save' conversation before processing any cancellation",
        "Review coaching quality and class experience consistency",
      ],
    });
  }

  // Coaching Development recommendation
  if (activeMemberCount >= 10) {
    const coachingPriority = gymChurnRate > 7 ? "high" : gymChurnRate > 3 ? "medium" : "low";
    recommendations.push({
      category: "Coaching Development",
      priority: coachingPriority as "high" | "medium" | "low",
      headline: "Invest in your coaching team — they are the delivery system for your culture",
      detail: `Great coaches don't just see movement faults — they connect with athletes individually. Develop awareness (read each athlete's needs), build trust (listen more than you coach), and coach the positive ("Big set!" not "Don't put it down!"). All coaches need training, shadowing, feedback loops, and mentorship. They must understand not just what your standards are, but why they matter.`,
      revenueImpact: "Coaching quality directly drives retention — members stay for coaches who see them as individuals",
      interventionType: "Coaching development program",
      crossfitContext: "",
      timeframe: "Start monthly coaching development meetings within 2 weeks",
      executionChecklist: [
        "Hold a monthly coaching meeting focused on one coaching skill (awareness, trust, positive language)",
        "Shadow each coach once per month and give specific, positive feedback",
        "Implement '5 minutes after class' rule: every coach spends 5 min with a newer member post-class",
        "Create a coaching dos and don'ts list specific to your gym",
        "Train coaches to read athletes individually — not every member responds to the same cues",
        "Practice coaching the positive: replace 'don't' cues with action cues in every class",
      ],
    });
  }

  // Culture Standards recommendation
  if (gymChurnRate > 5 || activeMemberCount < 30) {
    recommendations.push({
      category: "Culture Standards",
      priority: gymChurnRate > 7 ? "high" : "medium",
      headline: "Define, teach, and protect your gym's culture — it's what keeps members beyond the first year",
      detail: `Culture isn't a vibe or a slogan. It's built through a commitment to standards, values, and equality. Define your culture through three pillars: Methodology (movement standards, scaling, intensity), Etiquette (how things work in your house), and Dos/Don'ts (the unspoken rules that protect your long-term culture). Every person who walks through your door — coaches, staff, athletes — needs to understand what your gym stands for. The same standards that attract the right people will repel the wrong ones — that's not a bug, it's a feature.`,
      revenueImpact: "Strong culture creates members who would never leave — retention becomes identity, not obligation",
      interventionType: "Culture definition and enforcement",
      crossfitContext: "",
      timeframe: "Complete culture document within 1 month",
      executionChecklist: [
        "Write down your movement standards — what is non-negotiable? (e.g., squat below parallel every time)",
        "Define your gym's etiquette: on-time policy, phone policy, equipment breakdown expectations",
        "Create a dos and don'ts list for coaches (e.g., no coaching while taking class, no coffee while walking the floor)",
        "Build a new member onboarding checklist that teaches your culture from day one",
        "Have the difficult conversations: correct athletes in the moment, with care but with conviction",
        "Review and reinforce standards weekly in coaching meetings",
      ],
    });
  }

  // Community & Open recommendation
  const currentMonth = now.getMonth();
  const isOpenSeason = currentMonth >= 0 && currentMonth <= 3;
  if (isOpenSeason || avgNetGrowth <= 0) {
    recommendations.push({
      category: "Community Events",
      priority: isOpenSeason ? "high" : "medium",
      headline: isOpenSeason
        ? "The CrossFit Open is your biggest retention and growth tool of the year — use it"
        : "Community events create shared experience that no discount can replace",
      detail: isOpenSeason
        ? `The CrossFit Open has more global participants than any other sporting event. It's your chance to energize every member, create shared goals, and bring non-members through the door. Run Friday Night Lights, set up intramural teams, and make it an event — not just a workout. Every member should be encouraged to sign up, regardless of fitness level. The Open is where 'I do CrossFit' becomes 'I AM a CrossFitter.' When members cheer each other through a workout and compare scores, they're part of something — that feeling prevents cancellations months later.`
        : `Shared physical experience creates bonds that no marketing campaign can replicate. Partner workouts, team competitions, potlucks, and bring-a-friend events transform attendance into belonging. Members who have 3+ gym friendships retain at dramatically higher rates. The workout brings them in — the relationships keep them.`,
      revenueImpact: isOpenSeason
        ? "Open participation correlates with 6-12 month retention boost — members who compete together stay together"
        : "Each community event that brings a guest creates a warm referral lead worth $" + gymArm.toFixed(0) + "/month",
      interventionType: isOpenSeason ? "CrossFit Open activation" : "Community event series",
      crossfitContext: "",
      timeframe: isOpenSeason ? "Register and plan Friday Night Lights this week" : "Schedule monthly community events",
      executionChecklist: isOpenSeason ? [
        "Encourage every member to register for the Open — make it a gym-wide goal",
        "Set up Friday Night Lights: heats, judges, scorecards, music, energy",
        "Create intramural teams for friendly competition within the gym",
        "Invite non-members to watch or try a scaled version of the Open workout",
        "Post member Open stories and results on social media",
        "Plan a post-Open celebration event for everyone who participated",
      ] : [
        "Schedule one community event per month (partner workout, potluck, bring-a-friend)",
        "Run a 'Bring Your Person' week — every member invites one guest",
        "Organize a quarterly in-house competition with teams",
        "Create a post-event follow-up process for guests who attended",
        "Track which events generate the most guest sign-ups",
        "Celebrate participation and effort, not just performance",
      ],
    });
  }

  // Sort by priority and take TOP 3 only
  recommendations.sort((a, b) => {
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
  });
  const top3 = recommendations.slice(0, 3);

  // Cohort alert
  let cohortAlert: string | null = null;
  const recentCohorts = cohortIntelligence.cohorts.slice(-3);
  const lowSurvival = recentCohorts.filter(c => c.survivalRate < 60 && c.totalJoined >= 3);
  if (lowSurvival.length > 0) {
    const worst = lowSurvival.sort((a, b) => a.survivalRate - b.survivalRate)[0];
    cohortAlert = `The ${worst.cohortLabel} cohort is underperforming: only ${worst.survivalRate}% of ${worst.totalJoined} members are still active. This cohort represents $${worst.revenueLost.toLocaleString()}/month in lost revenue. Investigate what was different about onboarding during that period.`;
  }

  // Revenue outlook
  const expectedDelta = ((revenueScenario.expectedMrr - latestMrr) / latestMrr * 100);
  let revenueOutlook: string;
  if (expectedDelta > 5) {
    revenueOutlook = `Revenue is on track to grow ${expectedDelta.toFixed(1)}% over the next 6 months to $${revenueScenario.expectedMrr.toLocaleString()}/mo. Momentum is in your favor — if you keep retention steady, you have upside to $${revenueScenario.upsideMrr.toLocaleString()}/mo.`;
  } else if (expectedDelta > -3) {
    revenueOutlook = `Revenue should hold near $${revenueScenario.expectedMrr.toLocaleString()}/mo — stable but not growing. The gap between where you are and where you could be ($${revenueScenario.upsideMrr.toLocaleString()}/mo) shows the revenue you're leaving on the table.`;
  } else {
    revenueOutlook = `Revenue is headed down — projected to drop ${Math.abs(expectedDelta).toFixed(1)}% to $${revenueScenario.expectedMrr.toLocaleString()}/mo. If things get worse, it could hit $${revenueScenario.worstCaseMrr.toLocaleString()}/mo. Acting now gives you the best chance to turn this around.`;
  }

  const topAlerts: MemberAlertEnriched[] = memberPredictions.members
    .filter(m => m.churnProbability > 0.25)
    .slice(0, 5)
    .map(m => {
      let suggestedAction: string;
      if (m.lastContactDays === null && m.tenureDays <= 60) {
        suggestedAction = "Text + personal goal check-in";
      } else if (m.lastContactDays === null) {
        suggestedAction = "Personal call from head coach";
      } else if (m.lastContactDays > 30) {
        suggestedAction = "Text check-in + invite to partner workout";
      } else if (m.tenureDays <= 30) {
        suggestedAction = "1-on-1 intro session with assigned coach";
      } else if (m.tenureDays <= 90) {
        suggestedAction = "Set a 90-day skill milestone together";
      } else {
        suggestedAction = "Community re-engagement (invite to event or competition)";
      }

      return {
        name: m.name,
        memberId: m.memberId,
        probability: parseFloat((m.churnProbability * 100).toFixed(0)),
        driver: m.primaryRiskDriver,
        intervention: m.interventionDetail,
        revenue: `$${m.monthlyRate}/mo`,
        tenureDays: m.tenureDays,
        lastContactDays: m.lastContactDays,
        outreachLogged: m.lastContactDays !== null,
        suggestedAction,
        engagementClass: m.engagementClass,
      };
    });

  // ROI projection
  const retainableMembers = memberPredictions.members.filter(m => m.churnProbability > 0.25 && m.churnProbability < 0.7);
  const retainedIfActed = Math.round(retainableMembers.length * 0.3);
  const preservedRevenue = retainedIfActed * gymArm;
  const roiProjection = {
    actionTaken: `Personal outreach to ${retainableMembers.length} at-risk members`,
    membersRetained: retainedIfActed,
    revenuePreserved: Math.round(preservedRevenue),
    annualImpact: Math.round(preservedRevenue * 12),
  };

  const revenueComparison: RevenueComparison = {
    currentMrr: latestMrr,
    expectedMrr: revenueScenario.expectedMrr,
    upsideMrr: revenueScenario.upsideMrr,
    downsideMrr: revenueScenario.worstCaseMrr,
    expectedDeltaPct: latestMrr > 0 ? parseFloat(((revenueScenario.expectedMrr - latestMrr) / latestMrr * 100).toFixed(1)) : 0,
    upsideDeltaPct: latestMrr > 0 ? parseFloat(((revenueScenario.upsideMrr - latestMrr) / latestMrr * 100).toFixed(1)) : 0,
    downsideDeltaPct: latestMrr > 0 ? parseFloat(((revenueScenario.worstCaseMrr - latestMrr) / latestMrr * 100).toFixed(1)) : 0,
  };

  return {
    generatedAt: now.toISOString(),
    executiveSummary,
    stabilityVerdict,
    stabilityLevel,
    keyMetrics,
    recommendations: top3,
    cohortAlert,
    revenueOutlook,
    revenueComparison,
    memberAlerts: topAlerts,
    roiProjection,
  };
}

function getEmptyIntelligence(message: string): PredictiveIntelligence {
  return {
    memberPredictions: {
      members: [],
      summary: {
        totalAtRisk: 0,
        totalRevenueAtRisk: 0,
        totalLtvAtRisk: 0,
        avgChurnProbability: 0,
        classBreakdown: { core: 0, drifter: 0, "at-risk": 0, ghost: 0 },
        urgentInterventions: 0,
        topRiskDriver: message,
      },
    },
    cohortIntelligence: {
      cohorts: [],
      retentionWindows: [],
      survivalCurve: [],
      insights: [message],
      crossfitInsights: [],
    },
    revenueScenario: {
      projections: [],
      breakEvenRisk: 0,
      cashFlowRiskLevel: "low",
      worstCaseMrr: 0,
      expectedMrr: 0,
      upsideMrr: 0,
      scenarioInsights: [message],
    },
    strategicBrief: {
      generatedAt: new Date().toISOString(),
      executiveSummary: message,
      stabilityVerdict: message,
      stabilityLevel: "fragile",
      keyMetrics: [],
      recommendations: [],
      cohortAlert: null,
      revenueOutlook: message,
      revenueComparison: { currentMrr: 0, expectedMrr: 0, upsideMrr: 0, downsideMrr: 0, expectedDeltaPct: 0, upsideDeltaPct: 0, downsideDeltaPct: 0 },
      memberAlerts: [],
      roiProjection: { actionTaken: "N/A", membersRetained: 0, revenuePreserved: 0, annualImpact: 0 },
    },
  };
}
