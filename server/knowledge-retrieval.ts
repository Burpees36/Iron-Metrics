import OpenAI from "openai";
import { storage } from "./storage";
import { generateEmbedding } from "./knowledge-ingestion";
import type { BriefRecommendation } from "./predictive";
import crypto from "crypto";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const INTERVENTION_TO_SEARCH: Record<string, { query: string; tags: string[] }> = {
  "new_member_onboarding": { query: "new member onboarding first 90 days retention touchpoints", tags: ["onboarding", "retention"] },
  "established_member_reengagement": { query: "re-engage drifting established members accountability", tags: ["retention", "accountability", "member-experience"] },
  "ghost_member_recovery": { query: "recover ghost members who stopped attending win back", tags: ["churn", "retention", "accountability"] },
  "high_value_member_retention": { query: "retain high value premium members exclusive experience", tags: ["retention", "member-experience", "pricing"] },
  "milestone_recognition": { query: "celebrate member milestones anniversaries recognition culture", tags: ["culture", "member-experience", "retention"] },
  "community_event_program": { query: "community events social programming member connection", tags: ["community", "culture", "retention"] },
  "coaching_development": { query: "coach development training skill instruction quality", tags: ["coaching", "leadership", "staffing"] },
  "referral_system": { query: "member referral program word of mouth growth bring a friend", tags: ["referral", "growth", "marketing"] },
  "lead_conversion": { query: "convert leads sales no sweat intro consultation close rate", tags: ["sales", "growth", "marketing"] },
  "pricing_structure": { query: "pricing structure rate increase revenue per member value proposition", tags: ["pricing", "financial", "growth"] },
  "seasonal_retention": { query: "seasonal retention summer winter new year campaign", tags: ["retention", "marketing"] },
  "operational_efficiency": { query: "gym operations systems processes scheduling efficiency", tags: ["operations", "leadership"] },
  "goal_review_system": { query: "member goal setting review progress accountability check-in", tags: ["goal-setting", "accountability", "coaching"] },
};

export interface GroundedInsight {
  interventionType: string;
  insight: string;
  sources: Array<{ title: string; url: string; chunkId: string; similarity: number }>;
}

export interface GroundingResult {
  insights: GroundedInsight[];
  auditEntries: Array<{ recommendationType: string; chunkId: string; similarity: number }>;
}

function buildDeterministicSeed(gymId: string, monthStart: string, interventionType: string): number {
  const hash = crypto.createHash("sha256")
    .update(`${gymId}:${monthStart}:${interventionType}`)
    .digest();
  return hash.readUInt32BE(0);
}

const TEMPLATE_VARIANTS: Record<string, string[]> = {
  "new_member_onboarding": [
    "Affiliate doctrine emphasizes: {insight}. Consider adapting this to your onboarding flow.",
    "Proven affiliate playbook: {insight}. This aligns with building early habits in new members.",
    "Source-grounded practice: {insight}. Early touchpoints like these drive 90-day retention.",
  ],
  "established_member_reengagement": [
    "Affiliate best practice: {insight}. Re-engage drifting members before they become ghosts.",
    "Doctrine-grounded approach: {insight}. Personal outreach to established members preserves your core.",
    "Proven strategy: {insight}. Consistent check-ins with your veteran members build lasting loyalty.",
  ],
  "ghost_member_recovery": [
    "Recovery doctrine: {insight}. A structured winback approach can recover lost revenue.",
    "Affiliate playbook: {insight}. Even a few recovered members significantly impact your monthly revenue.",
  ],
  "_default": [
    "Affiliate doctrine: {insight}.",
    "Source-grounded insight: {insight}.",
    "Based on proven affiliate practice: {insight}.",
  ],
};

function selectTemplate(interventionType: string, seed: number): string {
  const templates = TEMPLATE_VARIANTS[interventionType] || TEMPLATE_VARIANTS["_default"];
  return templates[seed % templates.length];
}

async function retrieveForIntervention(
  interventionType: string,
  limit: number = 3
): Promise<Array<{ content: string; chunkId: string; similarity: number; docTitle: string; docUrl: string }>> {
  const searchConfig = INTERVENTION_TO_SEARCH[interventionType] || {
    query: interventionType.replace(/_/g, " "),
    tags: [],
  };

  const embedding = await generateEmbedding(searchConfig.query);

  if (embedding) {
    const results = await storage.searchChunksByVector(embedding, searchConfig.tags, limit);
    if (results.length > 0) {
      return results.map(r => ({
        content: r.content,
        chunkId: r.id,
        similarity: r.similarity,
        docTitle: r.docTitle,
        docUrl: r.docUrl,
      }));
    }
  }

  const textResults = await storage.searchChunksByText(searchConfig.query, searchConfig.tags, limit);
  return textResults.map(r => ({
    content: r.content,
    chunkId: r.id,
    similarity: 0.5,
    docTitle: r.docTitle,
    docUrl: r.docUrl,
  }));
}

function distillInsight(chunks: Array<{ content: string }>): string {
  if (chunks.length === 0) return "";

  const combined = chunks.map(c => c.content).join(" ");

  const sentences = combined.match(/[^.!?]+[.!?]+/g) || [combined];
  const actionable = sentences.filter(s => {
    const lower = s.toLowerCase();
    return (
      lower.includes("you") ||
      lower.includes("member") ||
      lower.includes("coach") ||
      lower.includes("should") ||
      lower.includes("need") ||
      lower.includes("make sure") ||
      lower.includes("important") ||
      lower.includes("focus") ||
      lower.includes("create") ||
      lower.includes("build") ||
      lower.includes("start") ||
      lower.includes("every")
    );
  });

  const bestSentences = (actionable.length > 0 ? actionable : sentences).slice(0, 2);
  return bestSentences.map(s => s.trim()).join(" ");
}

export async function groundRecommendations(
  recommendations: BriefRecommendation[],
  gymId: string,
  periodStart: string
): Promise<GroundingResult> {
  const stats = await storage.getKnowledgeStats();
  if (stats.chunks === 0) {
    return { insights: [], auditEntries: [] };
  }

  const insights: GroundedInsight[] = [];
  const auditEntries: Array<{ recommendationType: string; chunkId: string; similarity: number }> = [];

  const topRecs = recommendations.slice(0, 5);

  for (const rec of topRecs) {
    try {
      const chunks = await retrieveForIntervention(rec.interventionType, 3);
      if (chunks.length === 0) continue;

      const rawInsight = distillInsight(chunks);
      if (!rawInsight) continue;

      const seed = buildDeterministicSeed(gymId, periodStart, rec.interventionType);
      const template = selectTemplate(rec.interventionType, seed);
      const formattedInsight = template.replace("{insight}", rawInsight);

      insights.push({
        interventionType: rec.interventionType,
        insight: formattedInsight,
        sources: chunks.map(c => ({
          title: c.docTitle,
          url: c.docUrl,
          chunkId: c.chunkId,
          similarity: c.similarity,
        })),
      });

      for (const chunk of chunks) {
        auditEntries.push({
          recommendationType: rec.interventionType,
          chunkId: chunk.chunkId,
          similarity: chunk.similarity,
        });
      }
    } catch (err) {
      console.error(`Grounding failed for ${rec.interventionType}:`, err);
    }
  }

  for (const entry of auditEntries) {
    try {
      await storage.createRecommendationChunkAudit({
        gymId,
        periodStart,
        recommendationType: entry.recommendationType,
        chunkId: entry.chunkId,
        similarityScore: String(entry.similarity),
      });
    } catch (err) {
      // ignore duplicate audit entries
    }
  }

  return { insights, auditEntries };
}

export async function searchKnowledge(
  query: string,
  tags: string[] = [],
  limit: number = 10
): Promise<Array<{ content: string; chunkId: string; similarity: number; docTitle: string; docUrl: string; taxonomy: string[] }>> {
  const embedding = await generateEmbedding(query);

  if (embedding) {
    const results = await storage.searchChunksByVector(embedding, tags, limit);
    return results.map(r => ({
      content: r.content,
      chunkId: r.id,
      similarity: r.similarity,
      docTitle: r.docTitle,
      docUrl: r.docUrl,
      taxonomy: r.taxonomy || [],
    }));
  }

  const textResults = await storage.searchChunksByText(query, tags, limit);
  return textResults.map(r => ({
    content: r.content,
    chunkId: r.id,
    similarity: 0.5,
    docTitle: r.docTitle,
    docUrl: r.docUrl,
    taxonomy: r.taxonomy || [],
  }));
}
