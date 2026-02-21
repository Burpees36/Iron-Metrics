import { storage } from "./storage";
import { generateEmbedding } from "./knowledge-ingestion";
import type { BriefRecommendation } from "./predictive";
import { sentenceViolatesScope } from "./scope-rules";

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

export interface DoctrineGuidance {
  interventionType: string;
  detailAugmentation: string;
  executionStandard: string | null;
  _audit: { chunkIds: string[]; avgConfidence: number };
}

export interface DoctrineGroundingResult {
  guidances: DoctrineGuidance[];
  auditEntries: Array<{ recommendationType: string; chunkId: string; similarity: number }>;
}

async function retrieveForIntervention(
  interventionType: string,
  limit: number = 6
): Promise<Array<{ content: string; chunkId: string; similarity: number }>> {
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
      }));
    }
  }

  const textResults = await storage.searchChunksByText(searchConfig.query, searchConfig.tags, limit);
  return textResults.map(r => ({
    content: r.content,
    chunkId: r.id,
    similarity: 0.5,
  }));
}

function extractActionableSentences(chunks: Array<{ content: string }>, maxSentences: number = 3): string[] {
  if (chunks.length === 0) return [];

  const combined = chunks.map(c => c.content).join(" ");
  const sentences = combined.match(/[^.!?]+[.!?]+/g) || [combined];

  const scored = sentences.map(s => {
    const lower = s.toLowerCase().trim();
    let score = 0;
    if (lower.includes("member")) score += 2;
    if (lower.includes("coach")) score += 2;
    if (lower.includes("should")) score += 1;
    if (lower.includes("make sure")) score += 2;
    if (lower.includes("every")) score += 1;
    if (lower.includes("create") || lower.includes("build") || lower.includes("start")) score += 1;
    if (lower.includes("week") || lower.includes("day") || lower.includes("month")) score += 1;
    if (lower.includes("check-in") || lower.includes("outreach") || lower.includes("conversation")) score += 2;
    if (lower.includes("class") || lower.includes("workout") || lower.includes("wod")) score += 1;
    if (lower.length < 30) score -= 2;
    if (lower.length > 300) score -= 1;
    if (lower.startsWith("according to") || lower.startsWith("research") || lower.startsWith("studies")) score -= 3;
    return { text: s.trim(), score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .map(s => s.text);
}

function buildDetailAugmentation(sentences: string[]): string {
  if (sentences.length === 0) return "";
  const unique: string[] = [];
  for (const s of sentences) {
    if (!unique.some(u => u === s || u.includes(s) || s.includes(u))) unique.push(s);
  }
  const best = unique.slice(0, 2);
  let augmentation = best.join(" ");
  augmentation = augmentation
    .replace(/according to [^,.]+(,|\.)/gi, "")
    .replace(/research (shows|suggests|indicates)/gi, "typically")
    .replace(/studies (show|suggest|indicate)/gi, "in many affiliates")
    .replace(/\s{2,}/g, " ")
    .trim();
  return augmentation;
}

function buildExecutionStandard(sentences: string[]): string | null {
  if (sentences.length < 2) return null;

  const clauses: string[] = [];
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const hasTimeline = /\d+\s*(day|week|month|hour|minute)s?/i.test(sentence);
    const hasAction = /(check-in|outreach|call|message|conversation|review|goal|milestone|event|challenge)/i.test(lower);
    const hasFrequency = /(every|weekly|monthly|quarterly|daily|annually)/i.test(lower);

    if (hasTimeline || hasAction || hasFrequency) {
      let clause = sentence
        .replace(/^[^a-zA-Z0-9]+/, "")
        .replace(/[.!?]+$/, "")
        .trim();
      if (clause.length > 80) {
        const parts = clause.split(/[,;]/);
        clause = parts[0].trim();
      }
      if (clause.length > 15 && clause.length < 100) {
        clauses.push(clause);
      }
    }
  }

  if (clauses.length < 2) return null;
  return clauses.slice(0, 4).join(". ") + ".";
}

export async function groundRecommendations(
  recommendations: BriefRecommendation[],
  gymId: string,
  periodStart: string
): Promise<DoctrineGroundingResult> {
  const stats = await storage.getKnowledgeStats();
  if (stats.chunks === 0) {
    return { guidances: [], auditEntries: [] };
  }

  const guidances: DoctrineGuidance[] = [];
  const auditEntries: Array<{ recommendationType: string; chunkId: string; similarity: number }> = [];

  const topRecs = recommendations.slice(0, 5);

  for (const rec of topRecs) {
    try {
      const chunks = await retrieveForIntervention(rec.interventionType, 6);
      if (chunks.length === 0) continue;

      const sentences = extractActionableSentences(chunks, 6);
      const scopedSentences = sentences.filter(s => !sentenceViolatesScope(s, rec));
      if (scopedSentences.length === 0) continue;
      const detailAugmentation = buildDetailAugmentation(scopedSentences);
      const executionStandard = buildExecutionStandard(scopedSentences);

      if (!detailAugmentation && !executionStandard) continue;

      const chunkIds = chunks.map(c => c.chunkId);
      const avgConfidence = chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length;

      guidances.push({
        interventionType: rec.interventionType,
        detailAugmentation,
        executionStandard,
        _audit: { chunkIds, avgConfidence },
      });

      for (const chunk of chunks) {
        auditEntries.push({
          recommendationType: rec.interventionType,
          chunkId: chunk.chunkId,
          similarity: chunk.similarity,
        });
      }
    } catch (err) {
      console.error(`Doctrine retrieval failed for ${rec.interventionType}:`, err);
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

  if (guidances.length > 0) {
    console.log(`[Doctrine Library] Grounded ${guidances.length} recommendations for gym ${gymId}:`,
      guidances.map(g => `${g.interventionType} (${g._audit.chunkIds.length} chunks, conf: ${g._audit.avgConfidence.toFixed(2)})`).join(", ")
    );
  }

  return { guidances, auditEntries };
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
