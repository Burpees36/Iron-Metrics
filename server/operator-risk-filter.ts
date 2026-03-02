import type { OperatorOutput } from "@shared/schema";

const LEGAL_PATTERNS = [
  /\b(lawsuit|litigation|sue|liable|liability)\b/i,
  /\b(comply|compliance|regulatory|regulation)\b/i,
  /\bHIPAA\b/,
  /\bADA\b/,
  /\bOSHA\b/,
  /\b(attorney|lawyer|legal counsel)\b/i,
  /\b(employment law|labor law|wage law)\b/i,
  /\b(copyright|trademark|patent)\s+(infring|violat)/i,
];

const MEDICAL_PATTERNS = [
  /\b(diagnos[ei]|prescri(?:be|ption)|treatment\s+plan)\b/i,
  /\b(mental\s+health\s+treatment|psychiatric|psycholog(?:ical|ist))\b/i,
  /\b(physical\s+therapy|chiropractic|medical\s+advice)\b/i,
  /\b(dosage|medication|pharmaceutical)\b/i,
];

const GUARANTEE_PATTERNS = [
  /\b(guarantee[ds]?|guaranteed)\b/i,
  /\bpromise\s+(you|that|to)\b/i,
  /\bwill\s+definitely\b/i,
  /\b100%\s+(success|effective|guaranteed|certain)\b/i,
  /\bno\s+risk\b/i,
  /\bcannot\s+fail\b/i,
  /\bnever\s+fail\b/i,
];

const DOCTRINE_SOURCE_PATTERNS = [
  /\bTwo-Brain\b/i,
  /\bGym\s+Launch\b/i,
  /\bAlex\s+Hormozi\b/i,
  /\bGreg\s+Glassman\b/i,
  /\bChris\s+Cooper\b/i,
  /\bJohn\s+Franklin\b/i,
  /\b(according\s+to|as\s+stated\s+by|quoted\s+from|sourced\s+from)\b/i,
  /\bper\s+the\s+(book|article|study|research)\b/i,
];

const MAX_HEADLINE_LENGTH = 80;
const MAX_WHY_LENGTH = 240;
const MAX_ACTION_LENGTH = 140;
const MAX_DRAFT_LENGTH = 600;
const MAX_ACTIONS = 7;

export interface RiskScanResult {
  passed: boolean;
  violations: string[];
}

function scanText(text: string, patterns: RegExp[], category: string): string[] {
  const violations: string[] = [];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      violations.push(`${category}: "${match[0]}" detected`);
    }
  }
  return violations;
}

export function scanOutputRisk(outputs: OperatorOutput[]): RiskScanResult {
  const violations: string[] = [];

  for (let i = 0; i < outputs.length; i++) {
    const o = outputs[i];
    const prefix = outputs.length > 1 ? `Output ${i + 1}: ` : "";

    const allText = [o.headline, o.why_it_matters, ...o.actions, ...(o.drafts?.map(d => d.message) || [])].join(" ");

    violations.push(...scanText(allText, LEGAL_PATTERNS, `${prefix}Legal content`));
    violations.push(...scanText(allText, MEDICAL_PATTERNS, `${prefix}Medical content`));
    violations.push(...scanText(allText, GUARANTEE_PATTERNS, `${prefix}Guarantee language`));
    violations.push(...scanText(allText, DOCTRINE_SOURCE_PATTERNS, `${prefix}Doctrine source`));

    if (o.headline.length > MAX_HEADLINE_LENGTH) {
      violations.push(`${prefix}Headline exceeds ${MAX_HEADLINE_LENGTH} chars (${o.headline.length})`);
    }
    if (o.why_it_matters.length > MAX_WHY_LENGTH) {
      violations.push(`${prefix}why_it_matters exceeds ${MAX_WHY_LENGTH} chars (${o.why_it_matters.length})`);
    }
    if (o.actions.length > MAX_ACTIONS) {
      violations.push(`${prefix}Too many actions (${o.actions.length}, max ${MAX_ACTIONS})`);
    }
    for (const action of o.actions) {
      if (action.length > MAX_ACTION_LENGTH) {
        violations.push(`${prefix}Action exceeds ${MAX_ACTION_LENGTH} chars`);
        break;
      }
    }
    if (o.drafts) {
      for (const draft of o.drafts) {
        if (draft.message.length > MAX_DRAFT_LENGTH) {
          violations.push(`${prefix}Draft exceeds ${MAX_DRAFT_LENGTH} chars`);
          break;
        }
      }
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}
