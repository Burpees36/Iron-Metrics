import OpenAI from "openai";
import { storage } from "./storage";
import { generateEmbedding } from "./knowledge-ingestion";
import type { BriefRecommendation } from "./predictive";
import crypto from "crypto";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const INTERVENTION_TO_SEARCH: Record<string, { query: string; tags: string[] }> = {
  "New Member Onboarding Touchpoints": { query: "new member onboarding first 90 days retention touchpoints coach check-in", tags: ["onboarding", "retention"] },
  "Member Engagement Check-In System": { query: "re-engage drifting established members quarterly goal review accountability", tags: ["retention", "coaching"] },
  "90-Day Skill Milestone Program": { query: "member milestones skill progression first pull-up Rx WOD emotional investment", tags: ["onboarding", "retention", "coaching"] },
  "Attendance Recovery Sprint": { query: "recover drifting members personal outreach attendance reactivation", tags: ["retention", "coaching"] },
  "Referral Activation Sprint": { query: "member referral program sprint incentives word of mouth growth", tags: ["marketing", "community", "sales"] },
  "Bring-A-Friend System": { query: "bring a friend day guest conversion community workout", tags: ["community", "marketing", "sales"] },
  "Social Proof Engine": { query: "social proof testimonials member stories transformation content marketing", tags: ["marketing", "community"] },
  "Local Partnership Activation": { query: "local business partnerships community outreach corporate rate", tags: ["marketing", "community", "sales"] },
  "Event Activation System": { query: "CrossFit Open Friday Night Lights competition events in-house throwdown", tags: ["community", "retention"] },
  "Monthly Community Event Cadence": { query: "community events social belonging potluck partner workout retention", tags: ["community", "retention"] },
  "Nutrition Challenge Cycle": { query: "nutrition challenge coaching revenue expansion ARM upsell accountability", tags: ["pricing", "coaching", "retention"] },
  "Coaching Consistency Audit": { query: "coaching quality consistency class experience shadow audit trust positive", tags: ["coaching", "leadership"] },
  "Programming & Experience Audit": { query: "programming strength cycle scaling consistency facility standards", tags: ["coaching", "programming", "operations"] },
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
  "New Member Onboarding Touchpoints": [
    "Affiliate doctrine emphasizes: {insight}. Consider adapting this to your onboarding flow.",
    "Proven affiliate playbook: {insight}. This aligns with building early habits in new members.",
    "Source-grounded practice: {insight}. Early touchpoints like these drive 90-day retention.",
  ],
  "Member Engagement Check-In System": [
    "Affiliate best practice: {insight}. Re-engage drifting members before they become ghosts.",
    "Doctrine-grounded approach: {insight}. Personal outreach to established members preserves your core.",
    "Proven strategy: {insight}. Consistent check-ins with your veteran members build lasting loyalty.",
  ],
  "Attendance Recovery Sprint": [
    "Recovery doctrine: {insight}. A structured recovery sprint can reactivate drifting members.",
    "Affiliate playbook: {insight}. Personal outreach within the first 7-14 days of absence is critical.",
  ],
  "Coaching Consistency Audit": [
    "Coaching doctrine: {insight}. Consistency across coaches is a direct retention lever.",
    "Affiliate best practice: {insight}. Great coaching is the product — everything else is infrastructure.",
  ],
  "Referral Activation Sprint": [
    "Growth doctrine: {insight}. Your best members are your best marketing channel.",
    "Affiliate playbook: {insight}. Structured referral sprints outperform open-ended referral programs.",
  ],
  "Nutrition Challenge Cycle": [
    "Revenue expansion doctrine: {insight}. Nutrition coaching bridges the gap between fitness and results.",
    "Affiliate playbook: {insight}. Challenges re-engage plateauing members and create natural upsell paths.",
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
