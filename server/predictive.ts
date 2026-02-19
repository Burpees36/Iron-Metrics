import { storage } from "./storage";
import type { Member, MemberContact } from "@shared/schema";

// ═══════════════════════════════════════════════════════════════
// MEMBER-LEVEL PREDICTIVE INTELLIGENCE
// ═══════════════════════════════════════════════════════════════

export type EngagementClass = "core" | "drifter" | "at-risk" | "ghost";
export type InterventionType = "personal-outreach" | "goal-setting" | "community-integration" | "win-back" | "pricing-review" | "coach-connection" | "milestone-celebration" | "onboarding-acceleration";
export type GymArchetype = "growth-accelerator" | "community-anchor" | "premium-boutique" | "turnaround-lab";

export interface CausalFactor {
  factor: string;
  impact: number;
  confidence: number;
  evidence: string;
}

export interface CounterfactualScenario {
  action: InterventionType;
  projectedChurnProbability: number;
  projectedRevenueAtRisk: number;
  churnDelta: number;
}

export interface InterventionPriority {
  type: InterventionType;
  score: number;
  rationale: string;
  expectedChurnDelta: number;
  expectedRevenueDelta: number;
  confidence: number;
}

export interface InterventionLearningSignal {
  interventionType: InterventionType;
  attempts: number;
  retainedAfter30d: number;
  retentionRate: number;
  quarterlyWeight: number;
}

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
  causalFactors: CausalFactor[];
  counterfactuals: CounterfactualScenario[];
  prioritizedInterventions: InterventionPriority[];
  recommendationMemory: string;
  gymArchetype: GymArchetype;
  urgencyDecayScore: number;
  languageTemplate: string;
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
    gymArchetype: GymArchetype;
    predictedRevenueDeltaFromTopActions: number;
    interventionLearning: InterventionLearningSignal[];
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
  interventionScore: number;
  expectedRevenueImpact: number;
  confidenceWeight: number;
  urgencyFactor: number;
  membersAffected: number;
  churnReductionEstimate: number;
  avgLtvRemaining: number;
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
  focusRecommendation: BriefRecommendation | null;
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
  groundedInsights?: Array<{
    interventionType: string;
    insight: string;
    sources: Array<{ title: string; url: string; chunkId: string; similarity: number }>;
  }>;
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
    activeMembers, allContacts, contactMap, now, gymChurnRate, gymArm,
    top20Threshold, medianCancelTenure, pctCancelledBefore90
  );

  const cohortIntelligence = computeCohortIntelligence(allMembers, now, cancelledTenures);

  const revenueScenario = computeRevenueScenarios(sortedMetrics, activeMembers, gymChurnRate, gymArm);

  const strategicBrief = generateStrategicBrief(
    memberPredictions, cohortIntelligence, revenueScenario,
    sortedMetrics, gymChurnRate, gymArm, activeMembers.length
  );

  const recommendationTypes = strategicBrief.recommendations.map((recommendation) => recommendation.interventionType);
  const learningStats = await storage.getLearningStats(gymId, recommendationTypes);
  const recommendationRanks = new Map<string, number>();

  for (const recommendationType of recommendationTypes) {
    const gymStats = learningStats.find((row) => row.recommendationType === recommendationType && row.gymId === gymId);
    const globalStats = learningStats.find((row) => row.recommendationType === recommendationType && row.gymId === null);
    const gymConfidence = gymStats?.confidence ?? 0;
    const globalConfidence = globalStats?.confidence ?? 0;
    const personalizedBoost = gymConfidence * 0.6 + globalConfidence * 0.4 + (gymStats?.expectedImpact ?? 0) * 0.002;
    recommendationRanks.set(recommendationType, personalizedBoost);
  }

  strategicBrief.recommendations = [...strategicBrief.recommendations].sort((a, b) => {
    const aBoost = recommendationRanks.get(a.interventionType) ?? 0;
    const bBoost = recommendationRanks.get(b.interventionType) ?? 0;
    return (b.interventionScore + bBoost) - (a.interventionScore + aBoost);
  });

  let groundedInsights: PredictiveIntelligence["groundedInsights"];
  try {
    const { groundRecommendations } = await import("./knowledge-retrieval");
    const latestMonth = sortedMetrics.length > 0 ? sortedMetrics[sortedMetrics.length - 1].monthStart : new Date().toISOString().slice(0, 10);
    const grounding = await groundRecommendations(strategicBrief.recommendations, gymId, latestMonth);
    if (grounding.insights.length > 0) {
      groundedInsights = grounding.insights;
    }
  } catch (err) {
    console.error("Knowledge grounding failed (non-fatal):", err);
  }

  return {
    memberPredictions,
    cohortIntelligence,
    revenueScenario,
    strategicBrief,
    groundedInsights,
  };
}

// ═══════════════════════════════════════════════════════════════
// MEMBER PREDICTION ENGINE
// ═══════════════════════════════════════════════════════════════

function computeMemberPredictions(
  activeMembers: Member[],
  allContacts: MemberContact[],
  contactMap: Map<string, Date>,
  now: Date,
  gymChurnRate: number,
  gymArm: number,
  top20Threshold: number,
  medianCancelTenure: number,
  pctCancelledBefore90: number
): MemberPredictionSummary {
  const predictions: MemberPrediction[] = [];
  const gymArchetype = inferGymArchetype(activeMembers, gymChurnRate, gymArm);
  const contactsByMember = new Map<string, MemberContact[]>();
  const interventionLearning = computeInterventionLearningSignals(allContacts, activeMembers, now);
  const quarterlyFeedbackWeights = buildQuarterlyFeedbackWeights(interventionLearning, now);

  for (const contact of allContacts) {
    const list = contactsByMember.get(contact.memberId) || [];
    list.push(contact);
    contactsByMember.set(contact.memberId, list);
  }

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

    let churnProb = 0.03;
    const causalFactors: CausalFactor[] = [];
    const applyFactor = (factor: string, impact: number, confidence: number, evidence: string) => {
      churnProb += impact;
      causalFactors.push({ factor, impact, confidence, evidence });
    };

    if (tenureDays <= 14) {
      applyFactor("Brand new — highest dropout risk", 0.34, 0.82, "Members in their first two weeks are most likely to cancel before forming a routine.");
    } else if (tenureDays <= 30) {
      applyFactor("Still building the habit", 0.27, 0.79, "This member hasn't settled into a consistent class schedule yet.");
    } else if (tenureDays <= 60) {
      applyFactor("Not yet locked in", 0.21, 0.75, "Member is in the 30–60 day window where many people drift away.");
    } else if (tenureDays <= 90) {
      applyFactor("Hasn't found their crew yet", 0.14, 0.7, "Members in the 60–90 day phase need to feel like they belong.");
    } else if (tenureDays <= 180) {
      applyFactor("Attendance may be inconsistent", 0.07, 0.58, "Member is past the early phase but hasn't become a regular yet.");
    } else if (tenureDays <= 365) {
      applyFactor("Stable but could still slip", 0.03, 0.52, "Member is established but a life change or bad experience could push them out.");
    }

    if (lastContactDays === null) {
      if (tenureDays <= 60) {
        applyFactor("No one has reached out yet", 0.2, 0.83, "This new member has no logged contact from staff — they may feel invisible.");
      } else if (tenureDays <= 180) {
        applyFactor("No recorded check-in", 0.1, 0.72, "No outreach logged despite being a member for months.");
      }
    } else if (lastContactDays > 30 && tenureDays <= 90) {
      applyFactor("Losing touch during critical window", 0.15, 0.77, "It's been 30+ days since anyone reached out, and this member is still new.");
    } else if (lastContactDays > 60) {
      applyFactor("Haven't heard from us in a while", 0.08, 0.69, "Over 60 days since last contact — they may feel forgotten.");
    } else if (lastContactDays <= 14) {
      applyFactor("Recently connected", -0.06, 0.71, "Someone on the team reached out recently — that helps.");
    }

    if (gymChurnRate > 7) {
      applyFactor("Gym-wide cancellation trend", 0.06, 0.66, "Your overall churn rate is high, which raises risk for every member.");
    } else if (gymChurnRate > 5) {
      applyFactor("Slightly elevated cancellation rate", 0.03, 0.58, "Gym-wide churn is a bit above normal.");
    }

    if (rate < gymArm * 0.7 && rate > 0) {
      applyFactor("Lower price plan — easier to walk away", 0.04, 0.62, "Members paying well below average may have less financial commitment keeping them.");
    }

    if (tenureDays <= medianCancelTenure * 1.2 && pctCancelledBefore90 > 0.4) {
      applyFactor("In the danger zone for cancellation", 0.05, 0.73, "This member is at the tenure where most of your past cancellations happened.");
    }

    if (isHighValue && tenureDays > 90) {
      applyFactor("Invested at a higher level", -0.03, 0.56, "Members paying more tend to stay longer — they've made a bigger commitment.");
    }

    if (tenureDays > 365) {
      applyFactor("Long-term loyalty", -0.05, 0.8, "Members who've been here over a year are significantly less likely to leave.");
    }

    const archetypeShift = getArchetypeRiskAdjustment(gymArchetype, tenureDays, lastContactDays);
    if (archetypeShift !== 0) {
      const archetypeLabel = gymArchetype.replace(/-/g, " ");
      applyFactor(`Adjusted for your gym's profile`, archetypeShift, 0.6, `Your gym operates as a ${archetypeLabel} — risk is adjusted accordingly.`);
    }

    const urgencyDecayScore = computeUrgencyDecayScore(tenureDays, lastContactDays, now);
    if (urgencyDecayScore > 0.05) {
      applyFactor("Connection window closing", Math.min(0.08, urgencyDecayScore * 0.09), 0.68, "The window to make an impact with this member is shrinking — act soon.");
    }

    churnProb = Math.max(0.01, Math.min(0.95, churnProb));

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

    const monthlyChurnProb = Math.min(churnProb, 0.5);
    const expectedMonthsRemaining = monthlyChurnProb > 0 ? (1 / monthlyChurnProb) : 24;
    const expectedLtvRemaining = Math.round(rate * Math.min(expectedMonthsRemaining, 60));
    const revenueAtRisk = Math.round(rate * Math.min(expectedMonthsRemaining * churnProb, 12));

    const rankedCausalFactors = [...causalFactors].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
    const riskDrivers = rankedCausalFactors.filter(f => f.impact > 0).map(f => f.factor);

    const primaryRiskDriver = riskDrivers.length > 0
      ? riskDrivers[0]
      : tenureDays <= 90 ? "New member — still settling in" : "No significant risk signals";

    const recommendationMemory = buildRecommendationMemory(contactsByMember.get(m.id) || [], now);

    const { type: interventionType, detail: interventionDetail, microGuidance: interventionMicroGuidance, urgency: interventionUrgency } = selectIntervention(
      churnProb, tenureDays, lastContactDays, isHighValue, rate, gymArm, riskDrivers
    );

    const prioritizedInterventions = prioritizeInterventions(
      churnProb,
      tenureDays,
      lastContactDays,
      isHighValue,
      rate,
      gymArm,
      gymArchetype,
      recommendationMemory,
      urgencyDecayScore,
      quarterlyFeedbackWeights
    );

    const languageTemplate = selectCrossfitLanguageTemplate(
      m.id,
      prioritizedInterventions[0]?.type || interventionType,
      gymArchetype,
      now,
      primaryRiskDriver,
      tenureDays,
      engagementClass
    );

    const counterfactuals = buildCounterfactuals(churnProb, rate, prioritizedInterventions);

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
      interventionDetail: personalizeInterventionDetail(interventionDetail, gymArchetype),
      interventionMicroGuidance,
      interventionUrgency,
      lastContactDays,
      isHighValue,
      causalFactors: rankedCausalFactors,
      counterfactuals,
      prioritizedInterventions,
      recommendationMemory,
      gymArchetype,
      urgencyDecayScore: parseFloat(urgencyDecayScore.toFixed(3)),
      languageTemplate,
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
  const predictedRevenueDeltaFromTopActions = predictions
    .filter(p => p.engagementClass === "at-risk" || p.engagementClass === "ghost")
    .reduce((sum, p) => sum + (p.prioritizedInterventions[0]?.expectedRevenueDelta || 0), 0);

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
      gymArchetype,
      predictedRevenueDeltaFromTopActions: Math.round(predictedRevenueDeltaFromTopActions),
      interventionLearning,
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

function computeUrgencyDecayScore(tenureDays: number, lastContactDays: number | null, now: Date): number {
  const quarterAnchor = Math.floor((now.getMonth() + 3) / 3);
  const onboardingDecay = tenureDays <= 90 ? (90 - tenureDays) / 90 : 0;
  const contactDecay = lastContactDays === null ? 1 : Math.min(1, lastContactDays / 45);
  return Math.max(0, Math.min(1, onboardingDecay * 0.65 + contactDecay * 0.35 + quarterAnchor * 0.01));
}

function mapContactToInterventionType(note: string | null): InterventionType | null {
  const normalized = (note || "").toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("onboard") || normalized.includes("first week")) return "onboarding-acceleration";
  if (normalized.includes("coach") || normalized.includes("check-in")) return "coach-connection";
  if (normalized.includes("goal") || normalized.includes("milestone")) return "goal-setting";
  if (normalized.includes("partner") || normalized.includes("event") || normalized.includes("community")) return "community-integration";
  if (normalized.includes("win back") || normalized.includes("rejoin")) return "win-back";
  if (normalized.includes("price") || normalized.includes("upgrade") || normalized.includes("nutrition")) return "pricing-review";
  if (normalized.includes("anniversary") || normalized.includes("celebrate")) return "milestone-celebration";
  if (normalized.includes("call") || normalized.includes("text") || normalized.includes("outreach")) return "personal-outreach";
  return null;
}

function computeInterventionLearningSignals(allContacts: MemberContact[], activeMembers: Member[], now: Date): InterventionLearningSignal[] {
  const activeSet = new Set(activeMembers.map(m => m.id));
  const learning = new Map<InterventionType, { attempts: number; retainedAfter30d: number }>();

  for (const contact of allContacts) {
    const type = mapContactToInterventionType(contact.note);
    if (!type) continue;

    const record = learning.get(type) || { attempts: 0, retainedAfter30d: 0 };
    record.attempts += 1;

    if (contact.contactedAt) {
      const daysSince = Math.floor((now.getTime() - new Date(contact.contactedAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= 30 && activeSet.has(contact.memberId)) {
        record.retainedAfter30d += 1;
      }
    }

    learning.set(type, record);
  }

  return Array.from(learning.entries())
    .map(([interventionType, value]) => ({
      interventionType,
      attempts: value.attempts,
      retainedAfter30d: value.retainedAfter30d,
      retentionRate: value.attempts > 0 ? parseFloat((value.retainedAfter30d / value.attempts).toFixed(3)) : 0,
      quarterlyWeight: 1,
    }))
    .sort((a, b) => b.attempts - a.attempts);
}

function buildQuarterlyFeedbackWeights(
  learningSignals: InterventionLearningSignal[],
  now: Date
): Partial<Record<InterventionType, number>> {
  const monthInQuarter = now.getMonth() % 3;
  const recencyBlend = monthInQuarter === 2 ? 1 : monthInQuarter === 1 ? 0.85 : 0.75;
  const weights: Partial<Record<InterventionType, number>> = {};

  for (const signal of learningSignals) {
    const samplePenalty = signal.attempts < 4 ? 0.9 : 1;
    const performanceShift = (signal.retentionRate - 0.55) * 0.4;
    const weight = Math.max(0.75, Math.min(1.25, (1 + performanceShift) * recencyBlend * samplePenalty));
    weights[signal.interventionType] = parseFloat(weight.toFixed(3));
    signal.quarterlyWeight = parseFloat(weight.toFixed(3));
  }

  return weights;
}

function selectCrossfitLanguageTemplate(
  memberId: string,
  interventionType: InterventionType,
  archetype: GymArchetype,
  now: Date,
  triggerReason: string,
  tenureDays: number,
  engagementClass: EngagementClass
): string {
  type LanguageMode = "new-athlete" | "established" | "longevity";
  type TemplateCard = {
    hook: string;
    ownerAction: string;
    coachCue: string;
    winCondition: string;
    timeBox: string;
    memberScript: string;
  };

  const languageMode: LanguageMode = tenureDays <= 120
    ? "new-athlete"
    : tenureDays >= 540
      ? "longevity"
      : "established";

  const riskCohort = engagementClass === "ghost" || engagementClass === "at-risk"
    ? "acute"
    : engagementClass === "drifter"
      ? "drift"
      : "stable";

  const playBucket = mapInterventionToPlayBucket(interventionType, tenureDays);

  const cardsByBucket: Record<string, Record<LanguageMode, TemplateCard[]>> = {
    "onboarding-touchpoints": {
      "new-athlete": [
        {
          hook: "Protect the first 30 days before habits fade.",
          ownerAction: "What to do this week: ask the coach they usually see to do a 2-minute check-in after class and lock the next two class days.",
          coachCue: "Coach cue: 'Let's pick two training days this week and protect them.'",
          winCondition: "Win condition: member attends 2+ classes in the next 7 days.",
          timeBox: "Time box: 7 days.",
          memberScript: "Coach-to-member: 'You're building rhythm now; two classes this week is the win.'",
        },
      ],
      "established": [
        {
          hook: "Member is acting like a reset case; treat as re-onboarding.",
          ownerAction: "What to do this week: have their usual class coach run a quick reset check-in and confirm schedule fit.",
          coachCue: "Coach cue: 'What's the friction this month? Let's make your next two weeks easier.'",
          winCondition: "Win condition: no 7+ day attendance gap in next 14 days.",
          timeBox: "Time box: 14 days.",
          memberScript: "Coach-to-member: 'We're rebuilding training rhythm, not chasing intensity yet.'",
        },
      ],
      "longevity": [
        {
          hook: "Long-term member needs rhythm reset, not hype.",
          ownerAction: "What to do this week: coach they know best confirms one low-friction class lane for this month.",
          coachCue: "Coach cue: 'Let's keep training pain-free and steady this month.'",
          winCondition: "Win condition: 6+ sessions this month with no extended absence.",
          timeBox: "Time box: 30 days.",
          memberScript: "Coach-to-member: 'Consistency and recovery are the target right now.'",
        },
      ],
    },
    "engagement-checkin": {
      "new-athlete": [
        {
          hook: "Early drift needs a fast human touchpoint.",
          ownerAction: "What to do this week: ask their usual class coach for a post-class check-in focused on schedule obstacles.",
          coachCue: "Coach cue: 'What's making attendance hard this week? We'll solve that first.'",
          winCondition: "Win condition: member commits to 2 class dates before leaving today.",
          timeBox: "Time box: 7 days.",
          memberScript: "Coach-to-member: 'Let's get you back in a rhythm with two locked-in days.'",
        },
      ],
      "established": [
        {
          hook: "Established athletes retain when coaching feels personal and specific.",
          ownerAction: "What to do this week: have the coach they see most run a 3-question check-in after class.",
          coachCue: "Coach cue: 'How's training rhythm, confidence, and recovery this month?'",
          winCondition: "Win condition: one actionable change implemented in next 2 weeks.",
          timeBox: "Time box: 14 days.",
          memberScript: "Coach-to-member: 'Let's set one small target for the next two weeks.'",
        },
      ],
      "longevity": [
        {
          hook: "Longevity athletes respond to quality and pain-free consistency language.",
          ownerAction: "What to do this week: usual coach reviews movement quality and recovery constraints in a 2-minute conversation.",
          coachCue: "Coach cue: 'Let's keep reps clean and keep you training week to week.'",
          winCondition: "Win condition: athlete reports confidence and no flare-up in next 14 days.",
          timeBox: "Time box: 14 days.",
          memberScript: "Coach-to-member: 'Quality reps and consistency beat intensity spikes.'",
        },
      ],
    },
    "attendance-recovery": {
      "new-athlete": [
        {
          hook: "Attendance recovery sprint: stop a cancellation before it starts.",
          ownerAction: "What to do this week: trigger a 7-day recovery sprint with their usual class coach and one accountability text.",
          coachCue: "Coach cue: 'Pick two classes now; I'll check in after each.'",
          winCondition: "Win condition: 2 attendances in 7 days.",
          timeBox: "Time box: 7 days.",
          memberScript: "Coach-to-member: 'Let's stack two sessions first, then build from there.'",
        },
      ],
      "established": [
        {
          hook: "Rebuild momentum with structure, not motivation speeches.",
          ownerAction: "What to do this week: coach of record sets a back-to-rhythm plan and logs attendance checkpoints.",
          coachCue: "Coach cue: 'We'll protect two training days and review after week one.'",
          winCondition: "Win condition: no missed full week over next month.",
          timeBox: "Time box: 30 days.",
          memberScript: "Coach-to-member: 'Back-to-baseline week first, then we'll progress.'",
        },
      ],
      "longevity": [
        {
          hook: "For long-tenure athletes, attendance recovery should protect capacity.",
          ownerAction: "What to do this week: have familiar coach set conservative volume lane and consistency target.",
          coachCue: "Coach cue: 'Let's keep capacity stable and training pain-free this month.'",
          winCondition: "Win condition: 8+ classes this month with stable recovery notes.",
          timeBox: "Time box: 30 days.",
          memberScript: "Coach-to-member: 'Consistency is the PR now; we build from steady weeks.'",
        },
      ],
    },
    "milestones": {
      "new-athlete": [
        {
          hook: "Milestone framing works best early when identity is forming.",
          ownerAction: "What to do this week: coach they usually see sets one benchmark or first-Rx-adjacent target.",
          coachCue: "Coach cue: 'One small benchmark in 2 weeks, then we celebrate progress.'",
          winCondition: "Win condition: benchmark completed and logged.",
          timeBox: "Time box: 14 days.",
          memberScript: "Coach-to-member: 'We'll track progress, not perfection.'",
        },
      ],
      "established": [
        {
          hook: "Celebrate consistency and training rhythm over novelty.",
          ownerAction: "What to do this week: coach calls out a consistency milestone (e.g., 10-class month).",
          coachCue: "Coach cue: 'You've been steady — let's keep this rhythm another month.'",
          winCondition: "Win condition: consistency milestone repeated next month.",
          timeBox: "Time box: 30 days.",
          memberScript: "Coach-to-member: 'You're building durable capacity — keep stacking quality weeks.'",
        },
      ],
      "longevity": [
        {
          hook: "Use longevity milestones, not PR-bell language.",
          ownerAction: "What to do this week: coach highlights pain-free month, movement quality, or consistent attendance streak.",
          coachCue: "Coach cue: 'Quality reps and recovery are your win metrics this cycle.'",
          winCondition: "Win condition: athlete reports confidence and stable training availability.",
          timeBox: "Time box: 30 days.",
          memberScript: "Coach-to-member: 'Strength for life means training well, not forcing max days.'",
        },
      ],
    },
    "referrals": {
      "new-athlete": [{ hook: "Referral asks should follow visible progress.", ownerAction: "What to do this week: after a positive class streak, invite one friend to foundations class.", coachCue: "Coach cue: 'Know someone who would enjoy this class vibe? Bring them Saturday.'", winCondition: "Win condition: 1 referral invite sent.", timeBox: "Time box: 7 days.", memberScript: "Coach-to-member: 'Bring-a-friend day is low pressure — great first step.'" }],
      "established": [{ hook: "Established members are the highest-conversion referral channel.", ownerAction: "What to do this week: owner asks 3 core members for one intro each.", coachCue: "Coach cue: 'Who's one person you'd train better with? Invite them this month.'", winCondition: "Win condition: 3 warm intros logged.", timeBox: "Time box: 30 days.", memberScript: "Coach-to-member: 'If someone keeps saying they should start, bring them with you.'" }],
      "longevity": [{ hook: "Long-tenure members carry credibility in the community.", ownerAction: "What to do this week: ask veterans to invite one friend to a community workout.", coachCue: "Coach cue: 'You're a culture carrier — help one person get started.'", winCondition: "Win condition: veteran-led referral attendance.", timeBox: "Time box: 30 days.", memberScript: "Coach-to-member: 'Your consistency story can help someone else begin.'" }],
    },
    "event-activation": {
      "new-athlete": [{ hook: "Events accelerate belonging for newer members.", ownerAction: "What to do this week: ensure this member is personally invited to the next inclusive event.", coachCue: "Coach cue: 'You're on our team for the next event — scaled is perfect.'", winCondition: "Win condition: event RSVP confirmed.", timeBox: "Time box: 14 days.", memberScript: "Coach-to-member: 'Events are where friendships form fast — we'd love you there.'" }],
      "established": [{ hook: "Events prevent mid-tenure drift.", ownerAction: "What to do this week: coach gives this member a specific role in upcoming event.", coachCue: "Coach cue: 'Can you anchor warm-up or a team lane Friday night?'", winCondition: "Win condition: attends and participates in event role.", timeBox: "Time box: 30 days.", memberScript: "Coach-to-member: 'Having a role keeps training connected to community.'" }],
      "longevity": [{ hook: "Veterans stabilize event culture.", ownerAction: "What to do this week: ask a long-tenure member to mentor a newer teammate at event.", coachCue: "Coach cue: 'Pair with a newer athlete and guide their first event experience.'", winCondition: "Win condition: veteran-new athlete pairing completed.", timeBox: "Time box: 30 days.", memberScript: "Coach-to-member: 'Your experience can make someone else's first event a win.'" }],
    },
    "coaching-consistency": {
      "new-athlete": [{ hook: "New athletes need consistent standards across all coaches.", ownerAction: "What to do this week: run a 15-minute coach huddle on onboarding cues.", coachCue: "Coach cue: 'Same warm welcome, same scaling clarity, every class.'", winCondition: "Win condition: onboarding checklist used in every intro class.", timeBox: "Time box: 14 days.", memberScript: "Coach-to-member: 'You'll get the same support no matter who coaches.'" }],
      "established": [{ hook: "Consistency in coaching language protects retention.", ownerAction: "What to do this week: shadow one class per coach and audit whiteboard brief quality.", coachCue: "Coach cue: 'Clear intent, clear scaling, clear member touchpoint every class.'", winCondition: "Win condition: coaching audit completed with one improvement per coach.", timeBox: "Time box: 30 days.", memberScript: "Coach-to-member: 'Your training experience should feel reliable every day.'" }],
      "longevity": [{ hook: "Long-term members notice quality drift first.", ownerAction: "What to do this week: gather feedback from veterans on class quality consistency.", coachCue: "Coach cue: 'Ask one veteran athlete what feels better and what needs tightening.'", winCondition: "Win condition: 3 veteran insights actioned this month.", timeBox: "Time box: 30 days.", memberScript: "Coach-to-member: 'Your feedback helps keep standards high for everyone.'" }],
    },
    "programming-experience": {
      "new-athlete": [{ hook: "Programming clarity reduces new-member intimidation.", ownerAction: "What to do this week: ensure each class has clear intended stimulus and scaling path.", coachCue: "Coach cue: 'Explain today's goal in one sentence before warm-up.'", winCondition: "Win condition: new athlete reports confidence in class plan.", timeBox: "Time box: 14 days.", memberScript: "Coach-to-member: 'We'll scale this so you leave feeling successful.'" }],
      "established": [{ hook: "Programming progression should feel visible month to month.", ownerAction: "What to do this week: review cycle progression and communicate next checkpoint.", coachCue: "Coach cue: 'Here's where this week fits in your bigger progression.'", winCondition: "Win condition: member can state next training checkpoint.", timeBox: "Time box: 30 days.", memberScript: "Coach-to-member: 'You're building skill confidence and training rhythm, not random effort.'" }],
      "longevity": [{ hook: "Experience quality for longevity athletes means capacity + recovery balance.", ownerAction: "What to do this week: audit volume/intensity options for pain-free progression lanes.", coachCue: "Coach cue: 'Give a quality-reps option before intensity options.'", winCondition: "Win condition: no recovery-related drop-off this month.", timeBox: "Time box: 30 days.", memberScript: "Coach-to-member: 'We train for strength for life — quality first.'" }],
    },
  };

  const poolByMode = cardsByBucket[playBucket]?.[languageMode] || cardsByBucket["engagement-checkin"][languageMode];
  const triggerToken = triggerReason.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "general";
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const rotationSeed = `${memberId}-${archetype}-${interventionType}-${playBucket}-${riskCohort}-${triggerToken}-${monthStart}`;
  const index = hashString(rotationSeed) % poolByMode.length;
  const selected = poolByMode[index];

  return [
    `Play: ${playBucket} (${languageMode})`,
    `Hook: ${selected.hook}`,
    selected.ownerAction,
    selected.coachCue,
    selected.winCondition,
    selected.timeBox,
    selected.memberScript,
  ].join("\n");
}

function mapInterventionToPlayBucket(interventionType: InterventionType, tenureDays: number): string {
  switch (interventionType) {
    case "onboarding-acceleration":
      return "onboarding-touchpoints";
    case "coach-connection":
      return "engagement-checkin";
    case "goal-setting":
      return tenureDays <= 120 ? "milestones" : "programming-experience";
    case "community-integration":
      return "event-activation";
    case "win-back":
      return "attendance-recovery";
    case "pricing-review":
      return "programming-experience";
    case "milestone-celebration":
      return "milestones";
    case "personal-outreach":
    default:
      return tenureDays <= 120 ? "attendance-recovery" : "engagement-checkin";
  }
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function inferGymArchetype(activeMembers: Member[], gymChurnRate: number, gymArm: number): GymArchetype {
  const rates = activeMembers.map(m => Number(m.monthlyRate)).filter(r => r > 0);
  const avgRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : gymArm;

  if (gymChurnRate >= 8) return "turnaround-lab";
  if (gymChurnRate <= 4 && avgRate >= 180) return "premium-boutique";
  if (gymChurnRate <= 5) return "community-anchor";
  return "growth-accelerator";
}

function getArchetypeRiskAdjustment(archetype: GymArchetype, tenureDays: number, lastContactDays: number | null): number {
  if (archetype === "turnaround-lab" && tenureDays <= 90) return 0.04;
  if (archetype === "growth-accelerator" && lastContactDays !== null && lastContactDays <= 14) return -0.02;
  if (archetype === "community-anchor" && tenureDays > 180) return -0.01;
  if (archetype === "premium-boutique" && tenureDays <= 30) return 0.02;
  return 0;
}

function buildRecommendationMemory(contacts: MemberContact[], now: Date): string {
  if (contacts.length === 0) {
    return "No prior outreach logged. Start with a coach-led check-in and log the outcome.";
  }

  const latest = contacts[0];
  const latestDays = latest.contactedAt
    ? Math.floor((now.getTime() - new Date(latest.contactedAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const notes = contacts.map(c => (c.note || "").toLowerCase()).join(" ");
  const contains = (token: string) => notes.includes(token);

  const interventionLabels: string[] = [];
  const interventionTypes: string[] = [];
  if (contains("goal") || contains("milestone")) { interventionLabels.push("goal-setting"); interventionTypes.push("goal-setting"); }
  if (contains("call") || contains("phone") || contains("outreach")) { interventionLabels.push("personal outreach"); interventionTypes.push("personal-outreach"); }
  if (contains("event") || contains("partner") || contains("community")) { interventionLabels.push("community event"); interventionTypes.push("community-integration"); }

  const cadenceSignal = latestDays === null
    ? "unknown cadence"
    : latestDays <= 14
      ? "recent outreach cadence"
      : latestDays <= 45
        ? "moderate outreach cadence"
        : "stale outreach cadence";

  const cadenceHuman = latestDays === null
    ? "no recent contact on file"
    : latestDays <= 14
      ? "last contact was recent"
      : latestDays <= 45
        ? `last contact was ${latestDays} days ago`
        : `it's been ${latestDays} days since last contact`;

  const typeTags = interventionTypes.length > 0 ? ` [${interventionTypes.join(",")}]` : "";

  if (interventionLabels.length === 0) {
    return `Past notes found but no clear pattern. ${cadenceHuman.charAt(0).toUpperCase() + cadenceHuman.slice(1)}.${typeTags} [${cadenceSignal}]`;
  }

  return `Previously tried: ${Array.from(new Set(interventionLabels)).join(", ")}. ${cadenceHuman.charAt(0).toUpperCase() + cadenceHuman.slice(1)}.${typeTags} [${cadenceSignal}]`;
}

function prioritizeInterventions(
  churnProb: number,
  tenureDays: number,
  lastContactDays: number | null,
  isHighValue: boolean,
  rate: number,
  gymArm: number,
  archetype: GymArchetype,
  recommendationMemory: string,
  urgencyDecayScore: number,
  quarterlyFeedbackWeights: Partial<Record<InterventionType, number>>
): InterventionPriority[] {
  const candidates: InterventionType[] = [
    "personal-outreach",
    "coach-connection",
    "goal-setting",
    "community-integration",
    "onboarding-acceleration",
    "win-back",
    "milestone-celebration",
    "pricing-review",
  ];

  return candidates.map((type) => {
    const feedbackWeight = quarterlyFeedbackWeights[type] || 1;
    const expectedChurnDelta = estimateInterventionDelta(type, churnProb, tenureDays, lastContactDays, isHighValue, archetype) * feedbackWeight;
    const confidence = estimateInterventionConfidence(type, recommendationMemory, lastContactDays);
    const urgency = (churnProb > 0.55 ? 1.25 : churnProb > 0.35 ? 1.1 : 0.95) + Math.min(0.22, urgencyDecayScore * 0.2);
    const valueWeight = rate >= gymArm ? 1.15 : 1;
    const expectedRevenueDelta = Math.max(0, rate * Math.min(12, expectedChurnDelta * 12));
    const score = Math.max(0, expectedRevenueDelta * confidence * urgency * valueWeight);

    return {
      type,
      score: parseFloat(score.toFixed(1)),
      rationale: `${type} prioritized for ${archetype}; expected churn lift ${(expectedChurnDelta * 100).toFixed(1)}pp and ~$${Math.round(expectedRevenueDelta)}/mo protected value.`,
      expectedChurnDelta: parseFloat(expectedChurnDelta.toFixed(3)),
      expectedRevenueDelta: Math.round(expectedRevenueDelta),
      confidence: parseFloat(confidence.toFixed(2)),
    };
  }).sort((a, b) => b.score - a.score).slice(0, 3);
}

function estimateInterventionDelta(
  type: InterventionType,
  churnProb: number,
  tenureDays: number,
  lastContactDays: number | null,
  isHighValue: boolean,
  archetype: GymArchetype
): number {
  const base = {
    "onboarding-acceleration": tenureDays <= 30 ? 0.16 : 0.05,
    "coach-connection": tenureDays <= 90 ? 0.12 : 0.06,
    "personal-outreach": churnProb > 0.45 ? 0.11 : 0.07,
    "goal-setting": tenureDays <= 120 ? 0.1 : 0.05,
    "community-integration": tenureDays > 60 ? 0.09 : 0.04,
    "win-back": churnProb > 0.55 ? 0.14 : 0.06,
    "milestone-celebration": tenureDays > 365 ? 0.07 : 0.03,
    "pricing-review": isHighValue ? 0.03 : 0.06,
  }[type];

  const archetypeMultiplier = archetype === "community-anchor"
    ? (type === "community-integration" ? 1.2 : 1)
    : archetype === "premium-boutique"
      ? (type === "personal-outreach" ? 1.15 : 1)
      : archetype === "turnaround-lab"
        ? (type === "onboarding-acceleration" || type === "coach-connection" ? 1.2 : 1)
        : 1;

  const contactPenalty = lastContactDays !== null && lastContactDays <= 10 && type === "personal-outreach" ? 0.75 : 1;
  return base * archetypeMultiplier * contactPenalty;
}

function estimateInterventionConfidence(type: InterventionType, recommendationMemory: string, lastContactDays: number | null): number {
  let confidence = 0.62;

  if (recommendationMemory.includes(type)) confidence -= 0.08;
  if (recommendationMemory.includes("stale outreach cadence")) confidence += 0.05;
  if (lastContactDays !== null && lastContactDays <= 7) confidence -= 0.04;

  return Math.max(0.45, Math.min(0.9, confidence));
}

function buildCounterfactuals(
  churnProb: number,
  monthlyRate: number,
  prioritizedInterventions: InterventionPriority[]
): CounterfactualScenario[] {
  const expectedMonthsRemaining = Math.min(60, 1 / Math.max(churnProb, 0.05));

  return prioritizedInterventions.map((option) => {
    const projectedChurnProbability = Math.max(0.01, churnProb - option.expectedChurnDelta);
    const projectedRevenueAtRisk = Math.round(monthlyRate * Math.min(expectedMonthsRemaining * projectedChurnProbability, 12));

    return {
      action: option.type,
      projectedChurnProbability: parseFloat(projectedChurnProbability.toFixed(3)),
      projectedRevenueAtRisk,
      churnDelta: parseFloat((churnProb - projectedChurnProbability).toFixed(3)),
    };
  });
}

function personalizeInterventionDetail(detail: string, archetype: GymArchetype): string {
  const archetypeGuidance: Record<GymArchetype, string> = {
    "growth-accelerator": "Focus on repeatable playbooks coaches can execute consistently as membership scales.",
    "community-anchor": "Anchor the action in rituals that deepen member-to-member trust and belonging.",
    "premium-boutique": "Preserve high-touch delivery quality and individual coaching precision.",
    "turnaround-lab": "Execute rapidly with strict weekly follow-through and accountability checkpoints.",
  };

  return `${detail} ${archetypeGuidance[archetype]}`;
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
  for (const [key, members] of Array.from(cohortMap.entries())) {
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

// ═══════════════════════════════════════════════════════════════
// RANKED INTERVENTION ENGINE — SCORING HELPERS
// ═══════════════════════════════════════════════════════════════

type ChurnTrend = "rising" | "stable" | "improving";
type InterventionCategory = "retention" | "acquisition" | "arm_expansion";

interface GymUrgencyContext {
  churnTrend: ChurnTrend;
  acquisitionFlat: boolean;
  isOpenSeason: boolean;
}

function detectChurnTrend(sortedMetrics: { churnRate: string | number }[]): ChurnTrend {
  if (sortedMetrics.length < 2) return "stable";
  const recent3 = sortedMetrics.slice(-3);
  const rates = recent3.map(m => Number(m.churnRate));
  if (rates.length < 2) return "stable";
  const first = rates[0];
  const last = rates[rates.length - 1];
  const delta = last - first;
  if (delta > 1.0) return "rising";
  if (delta < -1.0) return "improving";
  return "stable";
}

function computeUrgency(ctx: GymUrgencyContext, interventionCategory: InterventionCategory): number {
  let factor = 1.0;

  if (interventionCategory === "retention") {
    if (ctx.churnTrend === "rising") factor = 1.3;
    else if (ctx.churnTrend === "stable") factor = 1.0;
    else if (ctx.churnTrend === "improving") factor = 0.7;
  }

  if (interventionCategory === "acquisition" && ctx.acquisitionFlat) {
    factor = Math.max(factor, 1.2);
  }

  if (ctx.isOpenSeason) {
    factor = Math.max(factor, 1.4);
  }

  return factor;
}

function computeRetentionImpact(membersAffected: number, arm: number, monthsRemaining: number, liftPct: number): number {
  return membersAffected * arm * monthsRemaining * liftPct;
}

function computeAcquisitionImpact(expectedNewMembers: number, arm: number): number {
  return expectedNewMembers * arm * 6;
}

function computeArmExpansionImpact(membersParticipating: number, armIncrease: number): number {
  return membersParticipating * armIncrease * 6;
}

function computeInterventionScore(
  expectedRevenueImpactRaw: number,
  confidence: number,
  urgency: number
): { expectedRevenueImpact: number; interventionScore: number } {
  const expectedRevenueImpact = Math.round(expectedRevenueImpactRaw);
  const interventionScore = Math.round(expectedRevenueImpactRaw * confidence * urgency);
  return { expectedRevenueImpact, interventionScore };
}

function derivePriority(score: number, allScores: number[]): "critical" | "high" | "medium" | "low" {
  if (allScores.length === 0) return "medium";
  const sorted = [...allScores].sort((a, b) => b - a);
  const p75 = sorted[Math.floor(sorted.length * 0.25)] ?? 0;
  const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  if (score >= p75 && score > 0) return "critical";
  if (score >= p50 && score > 0) return "high";
  if (score > 0) return "medium";
  return "low";
}

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

  // ═══════════════════════════════════════════════════════════════
  // RANKED INTERVENTION ENGINE — 12-INTERVENTION LIBRARY
  // Baseline lift models are Bayesian priors, adjustable as data accumulates
  // ═══════════════════════════════════════════════════════════════

  const recommendations: BriefRecommendation[] = [];
  const dataMonths = sortedMetrics.length;
  const hasRetentionWindows = cohortIntelligence.retentionWindows.length > 0;
  const avgLtvRemainingGym = memberPredictions.members.length > 0
    ? memberPredictions.members.reduce((s, m) => s + m.expectedLtvRemaining, 0) / memberPredictions.members.length
    : gymArm * 12;
  const members = memberPredictions.members;
  const classBreakdown = summary.classBreakdown as Record<string, number>;
  const recent3Months = sortedMetrics.slice(-3);
  const avgNetGrowth = recent3Months.length > 0
    ? recent3Months.reduce((s, m) => s + (m.newMembers - m.cancels), 0) / recent3Months.length
    : 0;
  const avgNewMembers = recent3Months.length > 0
    ? recent3Months.reduce((s, m) => s + m.newMembers, 0) / recent3Months.length
    : 0;
  const currentMonth = now.getMonth();
  const isOpenSeason = currentMonth >= 0 && currentMonth <= 3;

  const churnTrend = detectChurnTrend(sortedMetrics);
  const urgencyCtx: GymUrgencyContext = {
    churnTrend,
    acquisitionFlat: avgNetGrowth <= 1,
    isOpenSeason,
  };

  const newMembers090 = members.filter(m => m.tenureDays <= 90);
  const newMembersAtRisk090 = newMembers090.filter(m => m.engagementClass === "drifter" || m.engagementClass === "at-risk" || m.engagementClass === "ghost");
  const establishedMembers = members.filter(m => m.tenureDays > 90);
  const establishedDrifting = establishedMembers.filter(m => m.engagementClass === "drifter" || m.engagementClass === "at-risk");
  const drifterCount = (classBreakdown["drifter"] || 0) + (classBreakdown["at-risk"] || 0);
  const ghostCount = classBreakdown["ghost"] || 0;
  const coreCount = classBreakdown["core"] || 0;
  const milestoneEligible = members.filter(m => m.tenureDays <= 120 && (m.engagementClass === "drifter" || m.engagementClass === "at-risk"));
  const worst30Day = cohortIntelligence.retentionWindows.find(w => w.window === "0-30 days");
  const worst60Day = cohortIntelligence.retentionWindows.find(w => w.window === "31-60 days");
  const cohort3to6Drop = cohortIntelligence.retentionWindows.find(w => w.window === "91-180 days");

  // ─── PILLAR 1: RETENTION (Protect the Core) ───

  // [1] New Member Onboarding Touchpoint System
  // Trigger: tenure ≤ 90, attendance drop, low engagement
  // Baseline: 4-8% improvement in 90-day retention, confidence 0.85, impact 30-60 days
  if (newMembers090.length > 0 && (newMembersAtRisk090.length > 0 || (worst30Day && worst30Day.lostPct > 15))) {
    const membersAff = Math.max(newMembersAtRisk090.length, newMembers090.length);
    const baselineLift = 0.06;
    const monthsRemaining = 6;
    const timeframe = "Implement within 2 weeks";
    const confidence = 0.85;
    const urgency = computeUrgency(urgencyCtx, "retention");
    const impact = computeRetentionImpact(membersAff, gymArm, monthsRemaining, baselineLift);
    const { expectedRevenueImpact, interventionScore } = computeInterventionScore(impact, confidence, urgency);
    recommendations.push({
      category: "Retention",
      priority: "critical",
      headline: `${membersAff} members in their first 90 days need structured onboarding touchpoints`,
      detail: `${newMembersAtRisk090.length > 0 ? `${newMembersAtRisk090.length} of your newest members are already showing drift signals. ` : ""}Early relationship formation is universally powerful — members who feel seen in their first month stay dramatically longer. Structure: Week 2 coach check-in (in person or quick message), Day 30 goal confirmation, Day 60 progress conversation, Day 90 milestone conversation. Important: "assigning a coach" means telling the coach who already sees them in class — "Make sure you connect with ${newMembers090.length > 0 ? newMembers090[0].name.split(" ")[0] : "them"} this week." No corporate CRM feeling. This preserves CrossFit culture.`,
      revenueImpact: `Retaining ${baselineLift * 100}% more new members preserves ~$${expectedRevenueImpact.toLocaleString()} over 6 months`,
      interventionType: "New Member Onboarding Touchpoints",
      crossfitContext: "Pillar 1: Retention",
      timeframe,
      executionChecklist: [
        "Identify every member under 90 days tenure — this is your onboarding cohort",
        "Tell each coach: 'Connect with [name] this week' — not a reassignment, a nudge",
        "Week 2: Coach check-in (in person or quick message after class)",
        "Day 30: Goal confirmation conversation — 'What do you want to achieve here?'",
        "Day 60: Progress conversation — 'Here's what I've noticed you're improving at'",
        "Day 90: Milestone conversation — celebrate their first quarter and set next goals",
      ],
      interventionScore, expectedRevenueImpact, confidenceWeight: confidence, urgencyFactor: urgency, membersAffected: membersAff, churnReductionEstimate: baselineLift, avgLtvRemaining: gymArm * monthsRemaining,
    });
  }

  // [2] Member Engagement Check-In System
  // Trigger: tenure > 90 days, attendance declining
  // Baseline: 2-4% 6-month retention, confidence 0.65, impact 30-90 days
  if (establishedDrifting.length > 0) {
    const membersAff = establishedDrifting.length;
    const baselineLift = 0.03;
    const monthsRemaining = 6;
    const timeframe = "Begin quarterly check-ins this week";
    const confidence = 0.65;
    const urgency = computeUrgency(urgencyCtx, "retention");
    const impact = computeRetentionImpact(membersAff, gymArm, monthsRemaining, baselineLift);
    const { expectedRevenueImpact, interventionScore } = computeInterventionScore(impact, confidence, urgency);
    recommendations.push({
      category: "Retention",
      priority: "high",
      headline: `${membersAff} established members are showing engagement drift — reactivate before they leave`,
      detail: `These aren't new members — they've been with you, but their attendance or engagement is slipping. The fix isn't onboarding structure, it's re-engagement. Quarterly goal refresh conversations, annual vision check-ins, and immediate reactivation touchpoints when attendance drops. For long-tenured members, the question isn't "Are you hitting PRs?" — it's "What's keeping you coming back, and how can we make that stronger?"`,
      revenueImpact: `Reactivating ${baselineLift * 100}% of drifting established members preserves ~$${expectedRevenueImpact.toLocaleString()}`,
      interventionType: "Member Engagement Check-In System",
      crossfitContext: "Pillar 1: Retention",
      timeframe,
      executionChecklist: [
        "Pull the list of members with tenure > 90 days showing attendance decline",
        "Schedule a quarterly goal refresh conversation with each — even a 5-minute chat after class",
        "For members with declining attendance: personal text from head coach within 48 hours",
        "Ask: 'Hey [name], haven't seen you as much lately — everything good?'",
        "For annual members: schedule a vision conversation — 'What does the next year look like for you here?'",
        "Log every touchpoint in Iron Metrics to track coverage",
      ],
      interventionScore, expectedRevenueImpact, confidenceWeight: confidence, urgencyFactor: urgency, membersAffected: membersAff, churnReductionEstimate: baselineLift, avgLtvRemaining: gymArm * monthsRemaining,
    });
  }

  // [3] 90-Day Skill Milestone Program (cohort-sensitive)
  // Trigger: tenure ≤ 120 AND no progression AND NOT (tenure > 120 with stable attendance)
  // Baseline: 3-6% 3-month retention, confidence 0.75, impact 45-75 days
  if (milestoneEligible.length > 0) {
    const membersAff = milestoneEligible.length;
    const baselineLift = 0.045;
    const monthsRemaining = 8;
    const timeframe = "Launch within 1 month";
    const confidence = 0.75;
    const urgency = computeUrgency(urgencyCtx, "retention");
    const impact = computeRetentionImpact(membersAff, gymArm, monthsRemaining, baselineLift);
    const { expectedRevenueImpact, interventionScore } = computeInterventionScore(impact, confidence, urgency);
    recommendations.push({
      category: "Retention",
      priority: "high",
      headline: `${membersAff} newer members need visible skill milestones to build emotional investment`,
      detail: `Members under 120 days who are drifting need concrete goals — not just "show up more." Define 3 milestones: first pull-up (or progression), first Rx WOD, first partner/team workout. This does NOT apply to masters athletes, long-tenured members, or experienced competitors with stable attendance — for them, a PR drought is normal, not a risk signal. The milestone program targets members who haven't yet built the identity connection to CrossFit.`,
      revenueImpact: `Improving 3-month retention by ${(baselineLift * 100).toFixed(0)}% preserves ~$${expectedRevenueImpact.toLocaleString()}`,
      interventionType: "90-Day Skill Milestone Program",
      crossfitContext: "Pillar 1: Retention",
      timeframe,
      executionChecklist: [
        "Identify members under 120 days showing drift — these are milestone candidates",
        "DO NOT apply this to long-tenured members with stable attendance (they don't need milestone pressure)",
        "Define 3 milestones per member: movement skill, benchmark WOD, community moment",
        "Coach sets milestones in first week: 'By day 90, let's get your first [pull-up/Rx workout/team comp]'",
        "Track milestone completion — celebrate publicly when achieved",
        "If tenure > 120 days AND attendance declining: use Engagement Check-In instead, not milestone pressure",
      ],
      interventionScore, expectedRevenueImpact, confidenceWeight: confidence, urgencyFactor: urgency, membersAffected: membersAff, churnReductionEstimate: baselineLift, avgLtvRemaining: gymArm * monthsRemaining,
    });
  }

  // [4] Attendance Recovery Sprint
  // Trigger: drifter spike, rising days-since-last-visit (7-14 day absence)
  // Baseline: 20-30% of at-risk reactivated, ~2-5% overall churn reduction, confidence 0.80, impact 14-30 days
  if (drifterCount > 0) {
    const membersAff = drifterCount;
    const baselineLift = 0.25;
    const monthsRemaining = 6;
    const timeframe = "Start personal outreach this week";
    const confidence = 0.80;
    const urgency = computeUrgency(urgencyCtx, "retention");
    const impact = computeRetentionImpact(membersAff, gymArm, monthsRemaining, baselineLift);
    const { expectedRevenueImpact, interventionScore } = computeInterventionScore(impact, confidence, urgency);
    recommendations.push({
      category: "Retention",
      priority: "critical",
      headline: `${drifterCount} members are drifting — a recovery sprint can reactivate 20-30% of them`,
      detail: `Drifters are members who haven't fully disengaged but are losing momentum. A 7-14 day absence is the trigger window — after that, reactivation rates drop sharply. Personal outreach (not automated emails), a specific reintegration plan ("Come to Thursday's partner workout — I'll pair you with someone"), and coach follow-up within 48 hours of their return. This is a high short-term impact lever with 80% confidence.`,
      revenueImpact: `Reactivating 25% of ${drifterCount} drifting members preserves ~$${expectedRevenueImpact.toLocaleString()}`,
      interventionType: "Attendance Recovery Sprint",
      crossfitContext: "Pillar 1: Retention",
      timeframe,
      executionChecklist: [
        "Pull every member classified as 'drifter' or 'at-risk' from the Member Risk tab",
        "Personal text from their coach (not a mass message): 'Hey [name], missed you this week — everything OK?'",
        "Offer a specific reintegration plan: 'Come to [day]'s class, I'll pair you with [buddy]'",
        "Follow up within 48 hours of their return — acknowledge they came back",
        "If no response after 3 days: phone call from head coach or owner",
        "Track reactivation rate — target 25%+ of outreach converting to attendance",
      ],
      interventionScore, expectedRevenueImpact, confidenceWeight: confidence, urgencyFactor: urgency, membersAffected: membersAff, churnReductionEstimate: baselineLift, avgLtvRemaining: gymArm * monthsRemaining,
    });
  }

  // ─── PILLAR 2: ACQUISITION (Build Forward Momentum) ───

  // [5] Referral Activation Sprint
  // Trigger: flat growth, stable churn, strong core membership
  // Baseline: +1-3 members/60d (small), +3-6 (mid), confidence 0.70, impact 30-60 days
  if (avgNetGrowth <= 1 && gymChurnRate <= 7 && coreCount >= 5) {
    const expectedNew = activeMemberCount >= 50 ? 4.5 : 2;
    const membersAff = Math.round(expectedNew);
    const timeframe = "Launch referral window within 2 weeks";
    const confidence = 0.70;
    const urgency = computeUrgency(urgencyCtx, "acquisition");
    const impact = computeAcquisitionImpact(expectedNew, gymArm);
    const { expectedRevenueImpact, interventionScore } = computeInterventionScore(impact, confidence, urgency);
    recommendations.push({
      category: "Acquisition",
      priority: "high",
      headline: `Growth is flat but your core is strong — launch a referral sprint to add ${membersAff}+ members`,
      detail: `With ${coreCount} core members and churn at ${gymChurnRate.toFixed(1)}%, new members acquired now are highly likely to stick. A defined referral window (not an open-ended "refer a friend" — a specific 2-week sprint with urgency), clear incentives (free month, gear credit, or community recognition), and tracking every referral source. Your retention is your competitive advantage for acquisition.`,
      revenueImpact: `${membersAff} new members at $${gymArm.toFixed(0)}/mo = +$${Math.round(membersAff * gymArm).toLocaleString()}/mo ($${Math.round(membersAff * gymArm * 12).toLocaleString()}/yr)`,
      interventionType: "Referral Activation Sprint",
      crossfitContext: "Pillar 2: Acquisition",
      timeframe,
      executionChecklist: [
        "Define a 2-week referral window — create urgency, not an open-ended ask",
        "Set clear incentive: free month, gear credit, or public recognition for referrer",
        "Announce in every class: 'This month, bring someone who needs what we have'",
        "Give every core member a personal ask: 'Who's one person you'd want to work out with?'",
        "Track referral source for every new signup — measure which members drive referrals",
        "Follow up with every referred lead within 24 hours of first visit",
      ],
      interventionScore, expectedRevenueImpact, confidenceWeight: confidence, urgencyFactor: urgency, membersAffected: membersAff, churnReductionEstimate: 1.0, avgLtvRemaining: gymArm * 6,
    });
  }

  // [6] Bring-A-Friend System
  // Trigger: low new members, strong community engagement
  // Baseline: +0.5-2 members/month sustained, confidence 0.60, impact 30-90 days
  if (avgNewMembers < 3 && coreCount >= 3) {
    const expectedNew = Math.max(1, Math.round(activeMemberCount * 0.02));
    const membersAff = expectedNew;
    const timeframe = "Schedule first Bring-A-Friend week within 1 month";
    const confidence = 0.60;
    const urgency = computeUrgency(urgencyCtx, "acquisition");
    const impact = computeAcquisitionImpact(expectedNew, gymArm);
    const { expectedRevenueImpact, interventionScore } = computeInterventionScore(impact, confidence, urgency);
    recommendations.push({
      category: "Acquisition",
      priority: "medium",
      headline: `New member flow is low — a recurring Bring-A-Friend system creates steady growth`,
      detail: `You're averaging ${avgNewMembers.toFixed(1)} new members/month. A structured Bring-A-Friend week (monthly or quarterly) with coach conversion scripts and tracking creates a reliable pipeline. Less explosive than a referral sprint, but more sustainable. Every member invites one person. Coach welcomes the guest by name, pairs them with the member who invited them, and follows up within 24 hours.`,
      revenueImpact: `Sustained +1-2 members/month adds $${Math.round(1.5 * gymArm).toLocaleString()}/mo average growth`,
      interventionType: "Bring-A-Friend System",
      crossfitContext: "Pillar 2: Acquisition",
      timeframe,
      executionChecklist: [
        "Schedule a monthly 'Bring Your Person' week — pick the same week each month",
        "Coach script: greet guest by name, pair with inviting member, check in after workout",
        "Track every guest: name, who invited them, did they return, did they sign up",
        "Follow up within 24 hours: personal text from the coach who met them",
        "Convert tracking: measure how many guests become members each month",
        "Celebrate members who successfully bring someone into the community",
      ],
      interventionScore, expectedRevenueImpact, confidenceWeight: confidence, urgencyFactor: urgency, membersAffected: membersAff, churnReductionEstimate: 1.0, avgLtvRemaining: gymArm * 6,
    });
  }

  // [7] Social Proof Engine
  // Trigger: low lead flow, low engagement, stalled acquisition
  // Baseline: 5-15% increase in inbound inquiries, confidence 0.55, impact 60-120 days
  if (avgNetGrowth <= 0 || avgNewMembers < 2) {
    const expectedNew = Math.max(1, Math.round(activeMemberCount * 0.03));
    const membersAff = expectedNew;
    const timeframe = "Begin weekly content within 2 weeks";
    const confidence = 0.55;
    const urgency = computeUrgency(urgencyCtx, "acquisition");
    const impact = computeAcquisitionImpact(expectedNew, gymArm);
    const { expectedRevenueImpact, interventionScore } = computeInterventionScore(impact, confidence, urgency);
    recommendations.push({
      category: "Acquisition",
      priority: "medium",
      headline: "Stalled acquisition — build a social proof engine to generate inbound leads",
      detail: `Member highlights, testimonials, transformation stories, and PR celebration videos create organic lead flow. This is a slower burn (60-120 days to see results) but compounds over time. The key is consistency — weekly posts featuring real members, real results, real community moments. Not polished marketing — authentic stories that show what it's like to be part of your gym.`,
      revenueImpact: `5-15% increase in inbound inquiries over 60-120 days, converting to ~${membersAff}+ members`,
      interventionType: "Social Proof Engine",
      crossfitContext: "Pillar 2: Acquisition",
      timeframe,
      executionChecklist: [
        "Post one member spotlight per week — transformation story, PR video, or testimonial",
        "Ask 3 long-tenured members to write a short 'Why I stay' testimonial",
        "Film PR celebrations and post with member permission",
        "Share before/after stories (with permission) that show real results",
        "Track which content types generate the most inbound inquiries",
        "Ensure every piece of content shows community, not just fitness",
      ],
      interventionScore, expectedRevenueImpact, confidenceWeight: confidence, urgencyFactor: urgency, membersAffected: membersAff, churnReductionEstimate: 1.0, avgLtvRemaining: gymArm * 6,
    });
  }

  // [8] Local Partnership Activation
  // Trigger: small roster size, rural/community setting
  // Baseline: +2-5 members/90d, confidence 0.80 small-town / 0.40 urban, impact 30-90 days
  if (activeMemberCount < 80) {
    const expectedNew = Math.max(2, Math.round(activeMemberCount < 40 ? 3.5 : 2));
    const membersAff = expectedNew;
    const timeframe = "Initiate first partnership within 1 month";
    const confidence = activeMemberCount < 40 ? 0.80 : 0.50;
    const urgency = computeUrgency(urgencyCtx, "acquisition");
    const impact = computeAcquisitionImpact(expectedNew, gymArm);
    const { expectedRevenueImpact, interventionScore } = computeInterventionScore(impact, confidence, urgency);
    recommendations.push({
      category: "Acquisition",
      priority: "medium",
      headline: `Small roster — local partnerships are your highest-conversion growth lever`,
      detail: `Church partnerships, local business collaborations, school athletics tie-ins, police/fire department events. This differentiates you from generic gym marketing. At ${activeMemberCount} members, every community connection matters more. The approach: offer a free class for the partner's team, host a joint event, or create a corporate rate. Community-rooted acquisition has 80% confidence in smaller settings because word-of-mouth carries further.`,
      revenueImpact: `+${membersAff}-5 members over 90 days at $${gymArm.toFixed(0)}/mo = $${Math.round(membersAff * gymArm).toLocaleString()}-$${Math.round(5 * gymArm).toLocaleString()}/mo`,
      interventionType: "Local Partnership Activation",
      crossfitContext: "Pillar 2: Acquisition",
      timeframe,
      executionChecklist: [
        "List 5 local organizations you could partner with (churches, businesses, schools, first responders)",
        "Offer a free team class or community workout for each partner organization",
        "Create a simple corporate/group rate for partner organizations",
        "Host one joint event per quarter with a local partner",
        "Track which partnerships generate actual signups",
        "Build relationships with 2-3 key community leaders who can champion your gym",
      ],
      interventionScore, expectedRevenueImpact, confidenceWeight: confidence, urgencyFactor: urgency, membersAffected: membersAff, churnReductionEstimate: 1.0, avgLtvRemaining: gymArm * 6,
    });
  }

  // ─── PILLAR 3: COMMUNITY DEPTH (Belonging & Identity) ───

  // [9] Event Activation System
  // Trigger: low event participation, cohort drop at 3-6 months, Open season
  // Baseline: 3-7% retention increase among participants, confidence 0.75, seasonal
  if (isOpenSeason || (cohort3to6Drop && cohort3to6Drop.lostPct > 10) || gymChurnRate > 5) {
    const membersAff = isOpenSeason ? activeMemberCount : Math.round(activeMemberCount * 0.6);
    const baselineLift = 0.05;
    const monthsRemaining = isOpenSeason ? 10 : 8;
    const timeframe = isOpenSeason ? "Register and plan Friday Night Lights this week" : "Schedule next in-house competition within 1 month";
    const confidence = 0.75;
    const urgency = computeUrgency(urgencyCtx, "retention");
    const impact = computeRetentionImpact(membersAff, gymArm, monthsRemaining, baselineLift);
    const { expectedRevenueImpact, interventionScore } = computeInterventionScore(impact, confidence, urgency);
    recommendations.push({
      category: "Community Depth",
      priority: isOpenSeason ? "high" : "medium",
      headline: isOpenSeason
        ? "The CrossFit Open is your biggest retention and growth event — activate it now"
        : "Event activation prevents the 3-6 month dropout cliff",
      detail: isOpenSeason
        ? `The Open transforms 'I do CrossFit' into 'I AM a CrossFitter.' Run Friday Night Lights, set up intramural teams, make it the event of the year. Every member registers regardless of level. The shared experience of cheering each other through workouts prevents cancellations months later. Invite non-members to watch — it's your best marketing.`
        : `Members who participate in gym events retain 3-7% better than those who don't. In-house competitions, Hero WOD events, Friday Night Lights, and holiday throwdowns create shared identity. ${cohort3to6Drop && cohort3to6Drop.lostPct > 10 ? `Your 3-6 month cohort is losing ${cohort3to6Drop.lostPct.toFixed(0)}% of members — events bridge the gap between 'new member' and 'community member.'` : ""}`,
      revenueImpact: `${(baselineLift * 100).toFixed(0)}% retention lift among ${membersAff} participants preserves ~$${expectedRevenueImpact.toLocaleString()}`,
      interventionType: "Event Activation System",
      crossfitContext: "Pillar 3: Community Depth",
      timeframe,
      executionChecklist: isOpenSeason ? [
        "Encourage every member to register for the Open — make it a gym-wide goal",
        "Set up Friday Night Lights: heats, judges, scorecards, music, energy",
        "Create intramural teams for friendly competition within the gym",
        "Invite non-members to watch or try a scaled version of the Open workout",
        "Post member Open stories and results — celebrate effort, not just scores",
        "Plan a post-Open celebration for everyone who participated",
      ] : [
        "Schedule one major event per quarter: in-house competition, Hero WOD, holiday throwdown",
        "Make events inclusive — scaled divisions so every member can participate",
        "Create teams/heats that mix newer and experienced members",
        "Post results and highlights — celebrate participation and personal bests",
        "Track which members participate vs. which don't — follow up with non-participants",
        "Use events as natural bring-a-friend opportunities",
      ],
      interventionScore, expectedRevenueImpact, confidenceWeight: confidence, urgencyFactor: urgency, membersAffected: membersAff, churnReductionEstimate: baselineLift, avgLtvRemaining: gymArm * monthsRemaining,
    });
  }

  // [10] Monthly Community Event Cadence
  // Trigger: low belonging score, attendance inconsistency, referral drop
  // Baseline: 1-3% retention improvement, confidence 0.60, impact 60-120 days
  if (drifterCount > coreCount * 0.3 || avgNetGrowth <= 0) {
    const membersAff = activeMemberCount;
    const baselineLift = 0.02;
    const monthsRemaining = 8;
    const timeframe = "Schedule monthly community events — start this month";
    const confidence = 0.60;
    const urgency = computeUrgency(urgencyCtx, "retention");
    const impact = computeRetentionImpact(membersAff, gymArm, monthsRemaining, baselineLift);
    const { expectedRevenueImpact, interventionScore } = computeInterventionScore(impact, confidence, urgency);
    recommendations.push({
      category: "Community Depth",
      priority: "medium",
      headline: "Monthly community events build the belonging that prevents mid-tenure dropout",
      detail: `Potlucks, BBQs, partner workouts, community nights — these aren't extras, they're retention infrastructure. Members who have 3+ gym friendships retain at dramatically higher rates. ${drifterCount > coreCount * 0.3 ? `With ${drifterCount} members showing inconsistent attendance, community events re-establish the social connections that keep people coming back.` : "Community events also create natural referral opportunities — every guest is a warm lead."}`,
      revenueImpact: `${(baselineLift * 100).toFixed(0)}% retention improvement across ${membersAff} members preserves ~$${expectedRevenueImpact.toLocaleString()}`,
      interventionType: "Monthly Community Event Cadence",
      crossfitContext: "Pillar 3: Community Depth",
      timeframe,
      executionChecklist: [
        "Schedule one non-workout community event per month (potluck, BBQ, game night)",
        "Alternate between social events and partner/team workouts",
        "Create a recurring 'Community Night' on the same day each month",
        "Encourage members to bring family or friends to social events",
        "Track attendance at community events vs. regular class attendance",
        "Follow up with members who attend events but have low class attendance",
      ],
      interventionScore, expectedRevenueImpact, confidenceWeight: confidence, urgencyFactor: urgency, membersAffected: membersAff, churnReductionEstimate: baselineLift, avgLtvRemaining: gymArm * monthsRemaining,
    });
  }

  // [11] Nutrition Challenge Cycle
  // Trigger: mid-tenure plateau (3-6 months), low engagement, ARM expansion opportunity
  // Baseline: 2-4% retention + $20-60 ARM increase, confidence 0.70, impact 30-60 days
  if ((cohort3to6Drop && cohort3to6Drop.lostPct > 8) || gymArm < 150 || drifterCount > 3) {
    const participants = Math.round(activeMemberCount * 0.4);
    const membersAff = participants;
    const armLift = 40;
    const timeframe = "Launch first challenge within 1 month";
    const confidence = 0.70;
    const urgency = computeUrgency(urgencyCtx, "retention");
    const impact = computeArmExpansionImpact(participants, armLift);
    const retentionLift = 0.03;
    const { expectedRevenueImpact, interventionScore } = computeInterventionScore(impact, confidence, urgency);
    recommendations.push({
      category: "Community Depth",
      priority: "medium",
      headline: "A nutrition challenge re-engages plateauing members and expands ARM",
      detail: `Nutrition challenges sit between retention and revenue expansion. Members at the 3-6 month mark often plateau — they've adapted to the workouts but haven't seen the body composition changes they expected. A structured challenge (macro tracking, accountability pods, weekly check-ins) reignites engagement and creates a natural upsell to ongoing nutrition coaching ($20-60/mo ARM increase). ${gymArm < 150 ? `With ARM at $${gymArm.toFixed(0)}, nutrition coaching is the easiest path to premium revenue.` : ""}`,
      revenueImpact: `${(retentionLift * 100).toFixed(0)}% retention lift + $${armLift}/mo ARM increase for participants = ~$${expectedRevenueImpact.toLocaleString()} impact`,
      interventionType: "Nutrition Challenge Cycle",
      crossfitContext: "Pillar 3: Community Depth",
      timeframe,
      executionChecklist: [
        "Design a 4-6 week nutrition challenge (macro tracking, accountability pods, weekly weigh-ins)",
        "Price it as a standalone ($99-149) or bundle with membership upgrade",
        "Create accountability pods of 4-6 members for peer support",
        "Weekly group check-in (can be 10 min before/after class)",
        "At challenge end, offer ongoing nutrition coaching as a subscription add-on",
        "Track ARM change for participants vs. non-participants",
      ],
      interventionScore, expectedRevenueImpact, confidenceWeight: confidence, urgencyFactor: urgency, membersAffected: membersAff, churnReductionEstimate: retentionLift, avgLtvRemaining: gymArm * 6,
    });
  }

  // ─── PILLAR 4: COACHING QUALITY & STANDARDS ───

  // [12] Coaching Consistency Audit
  // Trigger: retention variance by coach, 6-12 month churn, NPS variance
  // Baseline: 2-5% 6-12 month retention, confidence 0.65, impact 60-180 days
  if (gymChurnRate > 5 || activeMemberCount >= 20) {
    const membersAff = activeMemberCount;
    const baselineLift = gymChurnRate > 7 ? 0.04 : 0.025;
    const monthsRemaining = 8;
    const timeframe = "Start coaching audit within 2 weeks";
    const confidence = 0.65;
    const urgency = computeUrgency(urgencyCtx, "retention");
    const impact = computeRetentionImpact(membersAff, gymArm, monthsRemaining, baselineLift);
    const { expectedRevenueImpact, interventionScore } = computeInterventionScore(impact, confidence, urgency);
    recommendations.push({
      category: "Coaching Quality",
      priority: "medium",
      headline: "Coaching consistency directly drives retention — audit and improve the member experience",
      detail: `Retention variance often traces back to coaching quality differences. Shadow each coach, audit whiteboard briefs, review class experience consistency. Are all coaches connecting individually with athletes? Is the experience the same quality regardless of which coach runs the class? ${gymChurnRate > 7 ? `With churn at ${gymChurnRate.toFixed(1)}%, coaching inconsistency is a likely contributing factor.` : "Even with stable churn, coaching development prevents future drift."} Great coaches don't just see movement faults — they read each athlete's needs, build trust by listening, and coach the positive.`,
      revenueImpact: `${(baselineLift * 100).toFixed(1)}% 6-12 month retention improvement across ${membersAff} members preserves ~$${expectedRevenueImpact.toLocaleString()}`,
      interventionType: "Coaching Consistency Audit",
      crossfitContext: "Pillar 4: Coaching Quality",
      timeframe,
      executionChecklist: [
        "Shadow each coach once per month — observe class flow, athlete interaction, energy",
        "Audit whiteboard briefs: is the workout explained clearly? Is scaling offered proactively?",
        "Review: does every coach connect individually with at least 3 members per class?",
        "Create a coaching dos and don'ts list specific to your gym",
        "Hold monthly coaching meetings focused on one skill (awareness, trust, positive language)",
        "Practice coaching the positive: 'Big set!' not 'Don't put it down!' — in every class",
      ],
      interventionScore, expectedRevenueImpact, confidenceWeight: confidence, urgencyFactor: urgency, membersAffected: membersAff, churnReductionEstimate: baselineLift, avgLtvRemaining: gymArm * monthsRemaining,
    });
  }

  // [13] Programming & Experience Audit
  // Trigger: plateau churn, inconsistent PRs, culture drift
  // Baseline: 1-3% long-term retention, confidence 0.60, impact 90-180 days
  if (gymChurnRate > 5 || (cohort3to6Drop && cohort3to6Drop.lostPct > 12)) {
    const membersAff = activeMemberCount;
    const baselineLift = 0.02;
    const monthsRemaining = 8;
    const timeframe = "Complete audit within 1 month";
    const confidence = 0.60;
    const urgency = computeUrgency(urgencyCtx, "retention");
    const impact = computeRetentionImpact(membersAff, gymArm, monthsRemaining, baselineLift);
    const { expectedRevenueImpact, interventionScore } = computeInterventionScore(impact, confidence, urgency);
    recommendations.push({
      category: "Coaching Quality",
      priority: "medium",
      headline: "Programming and experience audit — ensure your product matches your standards",
      detail: `Strength cycle balance, skill progression clarity, scaling consistency, equipment and cleanliness baseline. ${cohort3to6Drop && cohort3to6Drop.lostPct > 12 ? `Your 3-6 month cohort is losing ${cohort3to6Drop.lostPct.toFixed(0)}% — this often signals programming plateau where members stop seeing progress.` : ""} This is a slower but stabilizing intervention. Review: is there a clear strength cycle? Are members progressing in skills? Is scaling consistent across coaches? Is the facility clean and equipment maintained? These hygiene factors compound into retention over time.`,
      revenueImpact: `${(baselineLift * 100).toFixed(0)}% long-term retention improvement preserves ~$${expectedRevenueImpact.toLocaleString()}`,
      interventionType: "Programming & Experience Audit",
      crossfitContext: "Pillar 4: Coaching Quality",
      timeframe,
      executionChecklist: [
        "Review programming: is there a clear strength cycle? Do members see skill progression?",
        "Audit scaling: are coaches scaling consistently, or does it vary by who's coaching?",
        "Check equipment: is everything maintained, organized, and clean?",
        "Review facility cleanliness: bathrooms, floors, equipment — the basics matter",
        "Survey 5-10 members: 'What's one thing we could improve about the class experience?'",
        "Create a monthly programming review meeting with coaching staff",
      ],
      interventionScore, expectedRevenueImpact, confidenceWeight: confidence, urgencyFactor: urgency, membersAffected: membersAff, churnReductionEstimate: baselineLift, avgLtvRemaining: gymArm * monthsRemaining,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // RANK, DERIVE PRIORITY, SELECT TOP 3 + FOCUS
  // ═══════════════════════════════════════════════════════════════
  const allScores = recommendations.map(r => r.interventionScore);
  recommendations.forEach(r => {
    r.priority = derivePriority(r.interventionScore, allScores);
  });
  recommendations.sort((a, b) => b.interventionScore - a.interventionScore);
  const focusRecommendation = recommendations.length > 0 ? recommendations[0] : null;
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
    focusRecommendation,
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
        gymArchetype: "growth-accelerator",
        predictedRevenueDeltaFromTopActions: 0,
        interventionLearning: [],
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
      focusRecommendation: null,
      cohortAlert: null,
      revenueOutlook: message,
      revenueComparison: { currentMrr: 0, expectedMrr: 0, upsideMrr: 0, downsideMrr: 0, expectedDeltaPct: 0, upsideDeltaPct: 0, downsideDeltaPct: 0 },
      memberAlerts: [],
      roiProjection: { actionTaken: "N/A", membersRetained: 0, revenuePreserved: 0, annualImpact: 0 },
    },
  };
}
