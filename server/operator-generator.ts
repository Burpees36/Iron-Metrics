import OpenAI from "openai";
import { z } from "zod";
import { operatorOutputSchema, type OperatorOutput, type OperatorPill, type OperatorTaskType } from "@shared/schema";
import { generateStubOutput, buildInputSummary } from "./ai-operator-stub";
import { buildOperatorContext, type OperatorContext } from "./operator-context";
import { storage } from "./storage";
import { generateEmbedding } from "./knowledge-ingestion";

const LLM_MODEL = "gpt-4o-mini";

const PILL_LABELS: Record<OperatorPill, string> = {
  retention: "Member Retention",
  sales: "Sales Pipeline",
  coaching: "Coaching Development",
  community: "Community Building",
  owner: "Owner Operations & Wellbeing",
};

const TASK_DESCRIPTIONS: Record<OperatorTaskType, string> = {
  "7-day plan": "A concrete 7-day action plan with daily or weekly priorities",
  "Member outreach drafts": "Outreach message drafts across SMS, email, and in-person channels with specific talking points",
  "Sales follow-up sequence": "A multi-touch follow-up sequence with timing, channel, and message guidance",
  "Staff coaching note": "A brief for coaching staff with focus areas, talking points, and action items",
  "Event plan": "A structured event plan with logistics, outreach, and follow-up steps",
};

const PILL_DOCTRINE_TAGS: Record<OperatorPill, string[]> = {
  retention: ["retention", "onboarding", "churn", "member-experience"],
  sales: ["sales", "marketing", "pricing", "growth"],
  coaching: ["coaching", "programming", "leadership", "staffing"],
  community: ["community", "culture", "referral", "member-experience"],
  owner: ["leadership", "operations", "financial", "retention"],
};

const PROHIBITED_PHRASES = [
  "this will guarantee",
  "guaranteed",
  "game changing",
  "game-changing",
  "revolutionary",
  "legally",
  "tax strategy",
  "medical advice",
  "consult a lawyer",
  "consult an attorney",
  "hire a lawyer",
  "not financial advice",
  "groundbreaking",
  "life-changing",
];

function buildSystemPrompt(
  pill: OperatorPill,
  taskType: OperatorTaskType,
  context: OperatorContext,
  doctrineSnippets: string[]
): string {
  const contextLines: string[] = [];

  if (context.activeMembers !== undefined) contextLines.push(`Active members: ${context.activeMembers}`);
  if (context.rsi !== undefined) contextLines.push(`RSI (Retention Stability Index): ${context.rsi}/100`);
  if (context.rsiTrend !== undefined) contextLines.push(`RSI trend (month-over-month): ${context.rsiTrend > 0 ? "+" : ""}${context.rsiTrend}`);
  if (context.churnRate !== undefined) contextLines.push(`Monthly churn rate: ${context.churnRate}%`);
  if (context.arm !== undefined) contextLines.push(`ARM (Average Revenue per Member): $${context.arm}`);
  if (context.ltv !== undefined && context.ltv > 0) contextLines.push(`Average LTV: $${context.ltv}`);
  if (context.mrr !== undefined) contextLines.push(`MRR: $${context.mrr}`);
  if (context.atRiskMembers !== undefined) contextLines.push(`At-risk members: ${context.atRiskMembers}`);
  if (context.first90DayChurn !== undefined) contextLines.push(`First 90-day churn rate: ${context.first90DayChurn}%`);
  if (context.newLeads !== undefined) contextLines.push(`New leads (last 30 days): ${context.newLeads}`);
  if (context.showRate !== undefined) contextLines.push(`Show rate: ${Math.round(context.showRate * 100)}%`);
  if (context.closeRate !== undefined) contextLines.push(`Close rate: ${Math.round(context.closeRate * 100)}%`);
  if (context.speedToLeadMin !== undefined) contextLines.push(`Speed to lead (median): ${context.speedToLeadMin} minutes`);
  if (context.salesHealthScore !== undefined) contextLines.push(`Sales Health Score: ${context.salesHealthScore}/100`);
  if (context.conversionRate !== undefined) contextLines.push(`Funnel conversion: ${Math.round(context.conversionRate * 100)}%`);

  const contextBlock = contextLines.length > 0
    ? `GYM METRICS:\n${contextLines.join("\n")}`
    : "GYM METRICS: Limited data available. Provide general best-practice guidance.";

  const doctrineBlock = doctrineSnippets.length > 0
    ? `\nOPERATIONAL STANDARDS:\n${doctrineSnippets.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
    : "";

  const needsDrafts = taskType === "Member outreach drafts" || taskType === "Sales follow-up sequence";
  const draftsInstruction = needsDrafts
    ? `Include a "drafts" array with 2-3 message drafts. Each draft has "channel" (one of "sms", "email", "in_person") and "message" (string, max 600 characters). Make drafts specific to the gym's context.`
    : `Do NOT include a "drafts" field.`;

  return `You are the Iron Metrics AI Operator — a workflow assistant for CrossFit gym owners.

ROLE: Generate structured, actionable output for the "${PILL_LABELS[pill]}" focus area.
TASK: ${TASK_DESCRIPTIONS[taskType]}

${contextBlock}
${doctrineBlock}

OUTPUT RULES:
- Return a JSON array containing 1-2 output objects (never more than 2)
- Each object must match this exact schema:
  {
    "headline": "string — concise title, max 80 characters",
    "why_it_matters": "string — 1-2 sentences explaining business impact, max 240 characters",
    "actions": ["array of 4-7 action items, each max 140 characters"],
    ${needsDrafts ? '"drafts": [{"channel": "sms|email|in_person", "message": "string max 600 chars"}],' : ""}
    "metrics_used": ["array of metric names referenced"],
    "confidence_label": "Low|Med|High"
  }

${draftsInstruction}

TONE RULES:
- Calm, direct, professional
- No hype, no emojis, no motivational fluff
- No "game-changing", "revolutionary", or guarantee language
- No legal, tax, medical, or employment-law advice
- Specific to the gym's actual numbers when available
- If data is sparse, say so and adjust confidence to "Low"

CONFIDENCE RULES:
- "High": Multiple strong data signals support the recommendation
- "Med": Some data available, recommendation is well-established practice
- "Low": Limited data, recommendation is general best practice

Return ONLY valid JSON. No markdown, no explanation, no prose outside the JSON array.`;
}

async function retrieveDoctrine(pill: OperatorPill, taskType: OperatorTaskType): Promise<string[]> {
  const tags = PILL_DOCTRINE_TAGS[pill];
  const query = `${PILL_LABELS[pill]} ${taskType} CrossFit gym`;

  try {
    const embedding = await generateEmbedding(query);
    if (embedding) {
      const results = await storage.searchChunksByVector(embedding, tags, 3);
      if (results.length > 0) {
        return results.map(r => r.content.slice(0, 300).trim());
      }
    }

    const textResults = await storage.searchChunksByText(query, tags, 3);
    return textResults.map(r => r.content.slice(0, 300).trim());
  } catch (err) {
    console.error("[operator] Doctrine retrieval failed:", err);
    return [];
  }
}

function sanitizeText(text: string): string {
  let cleaned = text.trim();
  for (const phrase of PROHIBITED_PHRASES) {
    const regex = new RegExp(phrase, "gi");
    cleaned = cleaned.replace(regex, "");
  }
  cleaned = cleaned.replace(/[^\x20-\x7E\n\r\t—–''""…]/g, "");
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned;
}

function polishOutputs(outputs: OperatorOutput[]): OperatorOutput[] {
  return outputs.map(output => {
    let whyItMatters = sanitizeText(output.why_it_matters);
    if (whyItMatters.length > 240) {
      whyItMatters = whyItMatters.slice(0, 237) + "...";
    }

    const seenActions = new Set<string>();
    const actions = output.actions
      .map(a => {
        let cleaned = sanitizeText(a);
        if (cleaned.length > 140) cleaned = cleaned.slice(0, 137) + "...";
        return cleaned;
      })
      .filter(a => {
        const key = a.toLowerCase();
        if (seenActions.has(key)) return false;
        seenActions.add(key);
        return a.length > 0;
      })
      .slice(0, 7);

    while (actions.length < 4) {
      actions.push("Review results and adjust approach based on outcomes");
    }

    const drafts = output.drafts?.map(d => ({
      channel: d.channel,
      message: sanitizeText(d.message).slice(0, 600),
    }));

    return {
      headline: sanitizeText(output.headline).slice(0, 80),
      why_it_matters: whyItMatters,
      actions,
      drafts: drafts && drafts.length > 0 ? drafts : undefined,
      metrics_used: output.metrics_used.map(m => sanitizeText(m)).filter(m => m.length > 0),
      confidence_label: output.confidence_label,
    };
  });
}

export interface GenerationResult {
  outputs: OperatorOutput[];
  model: string;
  context: OperatorContext;
  retryCount: number;
  validationPassed: boolean;
  usedStub: boolean;
}

export async function generateOperatorOutput(
  gymId: string,
  pill: OperatorPill,
  taskType: OperatorTaskType
): Promise<GenerationResult> {
  const context = await buildOperatorContext(gymId, pill);
  const doctrine = await retrieveDoctrine(pill, taskType);

  if (!process.env.OPENAI_API_KEY) {
    const stubOutputs = generateStubOutput(pill, taskType, {
      activeMembers: context.activeMembers,
      churnRate: context.churnRate,
      mrr: context.mrr,
      rsi: context.rsi,
      avgLtv: context.ltv,
      newLeads: context.newLeads,
      conversionRate: context.conversionRate,
    });
    return {
      outputs: polishOutputs(stubOutputs),
      model: "stub",
      context,
      retryCount: 0,
      validationPassed: true,
      usedStub: true,
    };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const systemPrompt = buildSystemPrompt(pill, taskType, context, doctrine);

  let retryCount = 0;
  const maxRetries = 1;

  while (retryCount <= maxRetries) {
    try {
      const userMessage = retryCount === 0
        ? `Generate ${taskType} for the ${PILL_LABELS[pill]} focus area.`
        : `Your previous response was not valid JSON. Return ONLY a valid JSON array of output objects. No markdown, no explanation.`;

      const response = await openai.chat.completions.create({
        model: LLM_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 2000,
      });

      const raw = response.choices[0]?.message?.content;
      if (!raw) throw new Error("Empty LLM response");

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.error("[operator] JSON parse failed, retry", retryCount);
        retryCount++;
        continue;
      }

      let outputArray: unknown[];
      if (Array.isArray(parsed)) {
        outputArray = parsed;
      } else if (typeof parsed === "object" && parsed !== null) {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.outputs)) {
          outputArray = obj.outputs;
        } else if (Array.isArray(obj.data)) {
          outputArray = obj.data;
        } else if (Array.isArray(obj.results)) {
          outputArray = obj.results;
        } else {
          const keys = Object.keys(obj);
          const firstArrayKey = keys.find(k => Array.isArray(obj[k]));
          if (firstArrayKey) {
            outputArray = obj[firstArrayKey] as unknown[];
          } else {
            outputArray = [obj];
          }
        }
      } else {
        retryCount++;
        continue;
      }

      const outputsSchema = z.array(operatorOutputSchema);
      const validated = outputsSchema.safeParse(outputArray);

      if (validated.success) {
        const polished = polishOutputs(validated.data).slice(0, 2);
        return {
          outputs: polished,
          model: LLM_MODEL,
          context,
          retryCount,
          validationPassed: true,
          usedStub: false,
        };
      }

      console.error("[operator] Schema validation failed:", validated.error.message);
      retryCount++;
    } catch (err: any) {
      console.error("[operator] LLM call failed:", err?.message || err);
      retryCount++;
    }
  }

  console.warn("[operator] Falling back to stub output after LLM failures");
  const stubOutputs = generateStubOutput(pill, taskType, {
    activeMembers: context.activeMembers,
    churnRate: context.churnRate,
    mrr: context.mrr,
    rsi: context.rsi,
    avgLtv: context.ltv,
    newLeads: context.newLeads,
    conversionRate: context.conversionRate,
  });

  return {
    outputs: polishOutputs(stubOutputs),
    model: "stub-fallback",
    context,
    retryCount,
    validationPassed: false,
    usedStub: true,
  };
}
