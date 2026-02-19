import OpenAI from "openai";
import { storage } from "./storage";
import type { KnowledgeSource, KnowledgeDocument } from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TAXONOMY_TAGS = [
  "retention", "onboarding", "pricing", "community", "coaching",
  "sales", "marketing", "leadership", "operations", "programming",
  "culture", "growth", "member-experience", "staffing", "facility",
  "financial", "churn", "referral", "goal-setting", "accountability",
] as const;

const CHUNK_TARGET_TOKENS = 400;
const CHUNK_MAX_TOKENS = 600;
const CHUNK_OVERLAP_TOKENS = 50;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const match = url.match(p);
    if (match) return match[1];
  }
  return null;
}

function isPlaylistUrl(url: string): boolean {
  return url.includes("list=") || url.includes("/playlist");
}

async function resolvePlaylistVideos(url: string): Promise<Array<{ id: string; title: string; url: string; duration?: number }>> {
  try {
    const ytpl = await import("ytpl");
    const listIdMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (!listIdMatch) return [];

    const playlist = await ytpl.default(listIdMatch[1], { limit: Infinity });
    return playlist.items.map((item: any) => ({
      id: item.id,
      title: item.title,
      url: item.shortUrl || `https://www.youtube.com/watch?v=${item.id}`,
      duration: item.durationSec || undefined,
    }));
  } catch (err) {
    console.error("Playlist resolution failed:", err);
    return [];
  }
}

async function fetchTranscript(videoId: string): Promise<string | null> {
  try {
    const { YoutubeTranscript } = await import("youtube-transcript");
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    if (!segments || segments.length === 0) return null;

    return segments.map((s: any) => s.text).join(" ");
  } catch (err) {
    console.error(`Transcript fetch failed for ${videoId}:`, err);
    return null;
  }
}

function normalizeTranscript(raw: string): string {
  return raw
    .replace(/\[.*?\]/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function chunkTranscript(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  const chunks: string[] = [];
  let current = "";
  let overlapBuffer = "";

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    const combined = current ? `${current} ${trimmed}` : trimmed;
    const combinedTokens = estimateTokens(combined);

    if (combinedTokens > CHUNK_MAX_TOKENS && current) {
      chunks.push(current.trim());
      const words = current.split(" ");
      const overlapWords = [];
      let overlapCount = 0;
      for (let i = words.length - 1; i >= 0 && overlapCount < CHUNK_OVERLAP_TOKENS; i--) {
        overlapWords.unshift(words[i]);
        overlapCount += estimateTokens(words[i]);
      }
      overlapBuffer = overlapWords.join(" ");
      current = overlapBuffer ? `${overlapBuffer} ${trimmed}` : trimmed;
    } else if (combinedTokens >= CHUNK_TARGET_TOKENS) {
      chunks.push(combined.trim());
      const words = combined.split(" ");
      const overlapWords = [];
      let overlapCount = 0;
      for (let i = words.length - 1; i >= 0 && overlapCount < CHUNK_OVERLAP_TOKENS; i--) {
        overlapWords.unshift(words[i]);
        overlapCount += estimateTokens(words[i]);
      }
      overlapBuffer = overlapWords.join(" ");
      current = overlapBuffer;
    } else {
      current = combined;
    }
  }

  if (current.trim()) {
    if (chunks.length > 0 && estimateTokens(current) < CHUNK_TARGET_TOKENS / 3) {
      chunks[chunks.length - 1] += " " + current.trim();
    } else {
      chunks.push(current.trim());
    }
  }

  return chunks;
}

function autoTag(content: string): string[] {
  const lower = content.toLowerCase();
  const matched: string[] = [];

  const tagKeywords: Record<string, string[]> = {
    "retention": ["retain", "retention", "keep members", "stay", "churn", "cancel", "attrition", "leaving"],
    "onboarding": ["onboard", "first day", "new member", "welcome", "intro", "foundations", "first week", "90 day", "90-day"],
    "pricing": ["price", "pricing", "rate", "charge", "fee", "discount", "value", "cost", "premium", "revenue per member"],
    "community": ["community", "culture", "belonging", "tribe", "social", "event", "connection", "relationships"],
    "coaching": ["coach", "coaching", "trainer", "instruction", "movement", "cue", "technique", "development"],
    "sales": ["sell", "sales", "close", "lead", "prospect", "convert", "no sweat intro", "consultation", "nsi"],
    "marketing": ["market", "marketing", "advertis", "brand", "content", "social media", "campaign", "outreach"],
    "leadership": ["leader", "leadership", "owner", "manage", "vision", "mission", "values", "standard"],
    "operations": ["operations", "system", "process", "workflow", "schedule", "admin", "efficiency"],
    "programming": ["program", "programming", "wod", "workout", "class", "metcon", "strength", "skill"],
    "culture": ["culture", "values", "standard", "expectation", "behavior", "environment", "atmosphere"],
    "growth": ["grow", "growth", "scale", "expand", "milestone", "goal", "target", "trajectory"],
    "member-experience": ["experience", "journey", "touchpoint", "interaction", "satisfaction", "feedback"],
    "staffing": ["staff", "hire", "employee", "team", "payroll", "compensation", "recruit"],
    "facility": ["facility", "space", "equipment", "gym floor", "clean", "maintenance", "lease"],
    "financial": ["financial", "profit", "revenue", "expense", "margin", "cash flow", "p&l", "budget"],
    "churn": ["churn", "cancel", "quit", "leave", "drop off", "exit", "lose member", "attrition"],
    "referral": ["referral", "refer", "word of mouth", "bring a friend", "testimonial", "advocate"],
    "goal-setting": ["goal", "target", "milestone", "measure", "kpi", "metric", "benchmark", "progress"],
    "accountability": ["accountability", "check-in", "follow up", "follow-up", "touchpoint", "outreach", "call"],
  };

  for (const [tag, keywords] of Object.entries(tagKeywords)) {
    if (keywords.some(kw => lower.includes(kw))) {
      matched.push(tag);
    }
  }

  return matched.length > 0 ? matched.slice(0, 5) : ["general"];
}

let embeddingCircuitOpen = false;
let embeddingCircuitResetAt = 0;

async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  if (embeddingCircuitOpen && Date.now() < embeddingCircuitResetAt) return null;
  if (embeddingCircuitOpen) embeddingCircuitOpen = false;
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
    });
    return response.data[0].embedding;
  } catch (err: any) {
    if (err?.status === 429 || err?.code === "insufficient_quota") {
      embeddingCircuitOpen = true;
      embeddingCircuitResetAt = Date.now() + 5 * 60 * 1000;
    }
    console.error("Embedding generation failed:", err?.message || err);
    return null;
  }
}

async function processDocument(doc: KnowledgeDocument): Promise<number> {
  if (!doc.rawTranscript) return 0;

  await storage.deleteChunksByDocument(doc.id);

  const normalized = normalizeTranscript(doc.rawTranscript);
  const chunks = chunkTranscript(normalized);
  let created = 0;

  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i];
    const taxonomy = autoTag(content);
    const embedding = await generateEmbedding(content);
    const tokenCount = estimateTokens(content);

    await storage.createKnowledgeChunk({
      documentId: doc.id,
      chunkIndex: i,
      content,
      embedding,
      taxonomy,
      tsv: null,
      tokenCount,
    });
    created++;
  }

  await storage.updateKnowledgeDocument(doc.id, {
    status: "processed",
    chunkCount: created,
  });

  return created;
}

export async function ingestSource(sourceId: string): Promise<{
  videosFound: number;
  videosProcessed: number;
  chunksCreated: number;
  errors: string[];
}> {
  const source = await storage.getKnowledgeSource(sourceId);
  if (!source) throw new Error("Knowledge source not found");

  const job = await storage.createIngestJob({
    sourceId,
    status: "running",
    videosFound: 0,
    videosProcessed: 0,
    chunksCreated: 0,
    errorDetails: null,
  });

  const errors: string[] = [];
  let videosFound = 0;
  let videosProcessed = 0;
  let chunksCreated = 0;

  try {
    let videos: Array<{ id: string; title: string; url: string; duration?: number }> = [];

    if (isPlaylistUrl(source.url)) {
      videos = await resolvePlaylistVideos(source.url);
    } else {
      const videoId = extractVideoId(source.url);
      if (videoId) {
        videos = [{ id: videoId, title: source.name, url: source.url }];
      }
    }

    videosFound = videos.length;
    await storage.updateIngestJob(job.id, { videosFound });

    for (const video of videos) {
      try {
        const doc = await storage.upsertKnowledgeDocument({
          sourceId,
          externalId: video.id,
          title: video.title,
          url: video.url,
          channelName: null,
          durationSeconds: video.duration || null,
          rawTranscript: null,
          status: "pending",
          chunkCount: 0,
        });

        if (doc.status === "processed" && doc.chunkCount > 0) {
          videosProcessed++;
          chunksCreated += doc.chunkCount;
          continue;
        }

        const transcript = await fetchTranscript(video.id);
        if (!transcript) {
          errors.push(`No transcript for: ${video.title}`);
          await storage.updateKnowledgeDocument(doc.id, { status: "no_transcript" });
          continue;
        }

        await storage.updateKnowledgeDocument(doc.id, { rawTranscript: transcript });

        const chunksMade = await processDocument({
          ...doc,
          rawTranscript: transcript,
        });

        chunksCreated += chunksMade;
        videosProcessed++;

        await storage.updateIngestJob(job.id, { videosProcessed, chunksCreated });
      } catch (err: any) {
        errors.push(`Error processing ${video.title}: ${err.message}`);
      }
    }

    await storage.updateKnowledgeSource(sourceId, { lastIngestedAt: new Date() });

    await storage.updateIngestJob(job.id, {
      status: "completed",
      videosFound,
      videosProcessed,
      chunksCreated,
      errorDetails: errors.length > 0 ? errors.join("\n") : null,
      finishedAt: new Date(),
    });
  } catch (err: any) {
    await storage.updateIngestJob(job.id, {
      status: "failed",
      errorDetails: err.message,
      finishedAt: new Date(),
    });
    throw err;
  }

  return { videosFound, videosProcessed, chunksCreated, errors };
}

export async function reprocessDocument(documentId: string): Promise<number> {
  const doc = await storage.getKnowledgeDocument(documentId);
  if (!doc) throw new Error("Document not found");
  if (!doc.rawTranscript) throw new Error("No transcript available");
  return processDocument(doc);
}

export { autoTag, chunkTranscript, normalizeTranscript, generateEmbedding, TAXONOMY_TAGS };
