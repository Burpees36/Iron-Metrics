import { and, asc, eq, lte, sql } from "drizzle-orm";
import {
  checklistItemCompletions,
  gymMonthlyMetrics,
  outcomeSnapshots,
  ownerAdditionalActions,
  recommendationCards,
  recommendationLearningEvents,
  recommendationLearningStats,
} from "@shared/schema";
import { db } from "./db";

const EVALUATION_WINDOWS = [30, 60, 90];
const MIN_EXECUTION_STRENGTH = 0.6;

export function getPeriodStart(inputDate?: Date): string {
  const d = inputDate ? new Date(inputDate) : new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function getItemId(recommendationType: string, item: string, index: number): string {
  const clean = item.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${recommendationType}-${index}-${clean.slice(0, 32)}`;
}

export async function ensureRecommendationCards(
  gymId: string,
  periodStart: string,
  recommendations: Array<{ interventionType: string; headline: string; executionChecklist: string[] }>,
  baselineForecast: { baselineMembers: number; baselineMrr: number; baselineChurn: number },
) {
  for (const recommendation of recommendations) {
    const checklistItems = recommendation.executionChecklist.map((item, index) => ({
      itemId: getItemId(recommendation.interventionType, item, index),
      text: item,
    }));

    const [existing] = await db
      .select()
      .from(recommendationCards)
      .where(
        and(
          eq(recommendationCards.gymId, gymId),
          eq(recommendationCards.periodStart, periodStart),
          eq(recommendationCards.recommendationType, recommendation.interventionType),
          eq(recommendationCards.headline, recommendation.headline),
        ),
      );

    if (existing) continue;

    await db.insert(recommendationCards).values({
      gymId,
      periodStart,
      recommendationType: recommendation.interventionType,
      headline: recommendation.headline,
      checklistItems,
      baselineForecast,
      executionStrengthThreshold: String(MIN_EXECUTION_STRENGTH),
    });
  }
}

export async function getRecommendationExecutionState(gymId: string, periodStart?: string) {
  const period = periodStart ?? getPeriodStart();
  const cards = await db
    .select()
    .from(recommendationCards)
    .where(and(eq(recommendationCards.gymId, gymId), eq(recommendationCards.periodStart, period)))
    .orderBy(asc(recommendationCards.generatedAt));

  const allCompletions = cards.length === 0 ? [] : await db
    .select()
    .from(checklistItemCompletions)
    .where(sql`${checklistItemCompletions.recommendationId} = ANY(${cards.map((card) => card.id)})`);

  const completionMap = new Map<string, { checked: boolean; checkedAt: Date; note: string | null }>();
  for (const row of allCompletions) {
    completionMap.set(`${row.recommendationId}:${row.itemId}`, {
      checked: row.checked,
      checkedAt: row.checkedAt,
      note: row.note,
    });
  }

  return cards.map((card) => {
    const items = card.checklistItems as Array<{ itemId: string; text: string }>;
    const checklist = items.map((item) => {
      const completion = completionMap.get(`${card.id}:${item.itemId}`);
      return {
        ...item,
        checked: completion?.checked ?? false,
        checkedAt: completion?.checkedAt ?? null,
        note: completion?.note ?? null,
      };
    });

    const checkedItems = checklist.filter((item) => item.checked).length;
    const totalItems = checklist.length;
    const executionStrength = totalItems === 0 ? 0 : checkedItems / totalItems;

    return {
      id: card.id,
      gymId: card.gymId,
      periodStart: card.periodStart,
      recommendationType: card.recommendationType,
      headline: card.headline,
      checklist,
      totalItems,
      checkedItems,
      executionStrength,
      executionStrengthThreshold: Number(card.executionStrengthThreshold),
      baselineForecast: card.baselineForecast,
    };
  });
}

export async function toggleChecklistItem(
  gymId: string,
  recommendationId: string,
  itemId: string,
  checked: boolean,
  note?: string,
) {
  const [card] = await db.select().from(recommendationCards).where(eq(recommendationCards.id, recommendationId));
  if (!card || card.gymId !== gymId) {
    throw new Error("Recommendation not found");
  }

  const [existing] = await db
    .select()
    .from(checklistItemCompletions)
    .where(and(eq(checklistItemCompletions.recommendationId, recommendationId), eq(checklistItemCompletions.itemId, itemId)));

  if (existing) {
    await db
      .update(checklistItemCompletions)
      .set({ checked, checkedAt: new Date(), note: note ?? existing.note })
      .where(eq(checklistItemCompletions.id, existing.id));
  } else {
    await db.insert(checklistItemCompletions).values({
      recommendationId,
      itemId,
      checked,
      checkedAt: new Date(),
      note: note ?? null,
    });
  }
}

function classifyAction(text: string): { classificationType: string | null; confidence: number; status: string } {
  const clean = text.trim().toLowerCase();
  if (clean.length < 8 || /^[a-z]{1,4}$/.test(clean)) {
    return { classificationType: null, confidence: 0, status: "rejected" };
  }

  const mapping: Array<{ type: string; keywords: string[] }> = [
    { type: "community-integration", keywords: ["community", "event", "challenge", "meetup"] },
    { type: "personal-outreach", keywords: ["outreach", "call", "text", "email", "check-in"] },
    { type: "goal-setting", keywords: ["goal", "plan", "assessment", "consult"] },
    { type: "coach-connection", keywords: ["coach", "pt", "session", "onramp"] },
    { type: "pricing-review", keywords: ["pricing", "discount", "offer", "membership option"] },
    { type: "win-back", keywords: ["win back", "former", "rejoin", "reactivation"] },
  ];

  let best: { type: string; score: number } | null = null;
  for (const rule of mapping) {
    const score = rule.keywords.filter((keyword) => clean.includes(keyword)).length;
    if (!best || score > best.score) {
      best = { type: rule.type, score };
    }
  }

  if (!best || best.score === 0) {
    return { classificationType: null, confidence: 0.2, status: "unclassified" };
  }

  const confidence = Math.min(0.95, 0.55 + best.score * 0.2);
  if (confidence < 0.8) {
    return { classificationType: null, confidence, status: "unclassified" };
  }

  return { classificationType: best.type, confidence, status: "classified" };
}

export async function logOwnerAction(gymId: string, periodStart: string, text: string) {
  const classification = classifyAction(text);

  const [created] = await db.insert(ownerAdditionalActions).values({
    gymId,
    periodStart,
    text,
    classificationType: classification.classificationType,
    classificationConfidence: String(classification.confidence),
    classificationStatus: classification.status,
  }).returning();

  return {
    ...created,
    classificationConfidence: Number(created.classificationConfidence ?? 0),
  };
}

function addDays(dateValue: string, days: number): string {
  const d = new Date(`${dateValue}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function getOverlapWeight(executedCount: number) {
  if (executedCount <= 1) return 1;
  if (executedCount === 2) return 0.7;
  return 0.5;
}

export async function runLearningUpdate(gymId: string) {
  const cards = await db.select().from(recommendationCards).where(eq(recommendationCards.gymId, gymId));
  if (cards.length === 0) return { updated: 0 };

  const executionCards = await getRecommendationExecutionState(gymId);
  const eligibleCards = executionCards.filter((card) => card.executionStrength >= Math.max(card.executionStrengthThreshold, MIN_EXECUTION_STRENGTH));
  if (eligibleCards.length === 0) return { updated: 0 };

  let updates = 0;

  for (const card of eligibleCards) {
    for (const window of EVALUATION_WINDOWS) {
      const [existingEvent] = await db
        .select()
        .from(recommendationLearningEvents)
        .where(and(eq(recommendationLearningEvents.recommendationId, card.id), eq(recommendationLearningEvents.evaluationWindowDays, window)));
      if (existingEvent) continue;

      const evaluationDate = addDays(card.periodStart, window);
      if (new Date() < new Date(`${evaluationDate}T00:00:00Z`)) {
        continue;
      }

      const [outcomeMetrics] = await db
        .select()
        .from(gymMonthlyMetrics)
        .where(and(eq(gymMonthlyMetrics.gymId, gymId), lte(gymMonthlyMetrics.monthStart, evaluationDate)))
        .orderBy(sql`${gymMonthlyMetrics.monthStart} DESC`)
        .limit(1);

      if (!outcomeMetrics || !card.baselineForecast) {
        continue;
      }

      await db.insert(outcomeSnapshots).values({
        gymId,
        periodStart: outcomeMetrics.monthStart,
        activeMembers: outcomeMetrics.activeMembers,
        newMembers: outcomeMetrics.newMembers,
        cancels: outcomeMetrics.cancels,
        churnRate: outcomeMetrics.churnRate,
        mrr: outcomeMetrics.mrr,
        arm: outcomeMetrics.arm,
        ltv: outcomeMetrics.ltv,
        memberRiskCount: outcomeMetrics.memberRiskCount,
      }).onConflictDoNothing();

      const baseline = card.baselineForecast as { baselineMembers: number; baselineMrr: number; baselineChurn: number };
      const deltaMembers = outcomeMetrics.activeMembers - baseline.baselineMembers;
      const deltaMrr = Number(outcomeMetrics.mrr) - baseline.baselineMrr;
      const deltaChurn = baseline.baselineChurn - Number(outcomeMetrics.churnRate);

      const impactedInWindow = eligibleCards.filter((row) => {
        const end = addDays(row.periodStart, window);
        return row.periodStart <= evaluationDate && end >= card.periodStart;
      }).length;

      const overlapWeight = getOverlapWeight(impactedInWindow);
      const impactScore = (deltaMrr * 0.65 + deltaMembers * 35 + deltaChurn * 120) * overlapWeight;

      await db.insert(recommendationLearningEvents).values({
        recommendationId: card.id,
        recommendationType: card.recommendationType,
        gymId,
        evaluationWindowDays: window,
        executionStrength: String(card.executionStrength),
        overlapWeight: String(overlapWeight),
        impactScore: String(impactScore),
        deltaMembers,
        deltaMrr: String(deltaMrr),
        deltaChurn: String(deltaChurn),
      });

      await upsertLearningStat(card.recommendationType, null, impactScore, Number(card.executionStrength), outcomeMetrics.activeMembers);
      await upsertLearningStat(card.recommendationType, gymId, impactScore, Number(card.executionStrength), outcomeMetrics.activeMembers);

      updates += 1;
    }
  }

  return { updated: updates };
}

async function upsertLearningStat(
  recommendationType: string,
  gymId: string | null,
  impactScore: number,
  executionStrength: number,
  rosterSize: number,
) {
  const [existing] = await db
    .select()
    .from(recommendationLearningStats)
    .where(and(eq(recommendationLearningStats.recommendationType, recommendationType), gymId ? eq(recommendationLearningStats.gymId, gymId) : sql`${recommendationLearningStats.gymId} IS NULL`));

  const qualityWeight = Math.max(0.2, Math.min(1, rosterSize / 100));
  const learningRate = gymId ? 0.06 * qualityWeight : 0.03 * qualityWeight;
  const confidenceGain = 0.03 * executionStrength * qualityWeight;

  if (!existing) {
    await db.insert(recommendationLearningStats).values({
      recommendationType,
      gymId,
      expectedImpact: String(impactScore * learningRate),
      confidence: String(Math.min(0.4, 0.1 + confidenceGain)),
      sampleSize: 1,
      updatedAt: new Date(),
    });
    return;
  }

  const newExpectedImpact = Number(existing.expectedImpact) * (1 - learningRate) + impactScore * learningRate;
  const newConfidence = Math.min(0.99, Number(existing.confidence) + confidenceGain);

  await db
    .update(recommendationLearningStats)
    .set({
      expectedImpact: String(newExpectedImpact),
      confidence: String(newConfidence),
      sampleSize: existing.sampleSize + 1,
      updatedAt: new Date(),
    })
    .where(eq(recommendationLearningStats.id, existing.id));
}
