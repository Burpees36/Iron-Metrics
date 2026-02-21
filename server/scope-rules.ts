export const SCOPE_BANNED_KEYWORDS: Record<string, string[]> = {
  "Retention": ["pricing", "upsell", "add-on", "corporate rate", "ARM increase", "subscription upgrade", "lead flow", "inbound inquiries"],
  "Acquisition": ["onboarding touchpoint", "coaching audit", "scaling consistency", "whiteboard brief", "nutrition coaching", "coaching playbook"],
  "Community Depth": ["referral sprint", "corporate rate", "lead flow", "inbound inquiries", "coaching audit", "coaching playbook", "movement standards", "scaling guidelines", "emergency procedures", "communication templates"],
  "Coaching Quality": ["referral", "bring-a-friend", "upsell", "pricing", "ARM increase", "nutrition challenge", "social proof", "lead flow"],
};

export const CROSS_LEVER_BLOCKED_TOPICS = [
  "onboarding", "coaching development", "upsell", "upsells", "pricing",
  "coaching playbook", "emergency procedures", "communication templates", "movement standards",
];

export const DEFAULT_BANNED_KEYWORDS = [
  "coaching playbook", "emergency procedures", "communication templates",
  "movement standards", "scaling guidelines",
];

export interface ScopeContext {
  category: string;
  headline: string;
  interventionType: string;
}

export function allowsBlockedTopic(ctx: ScopeContext, topic: string): boolean {
  const haystack = `${ctx.headline} ${ctx.interventionType} ${ctx.category}`.toLowerCase();
  return haystack.includes(topic);
}

export function sentenceViolatesScope(sentence: string, ctx: ScopeContext): boolean {
  const lower = sentence.toLowerCase();
  const bannedTerms = SCOPE_BANNED_KEYWORDS[ctx.category] || DEFAULT_BANNED_KEYWORDS;
  if (bannedTerms.some(term => lower.includes(term.toLowerCase()))) return true;
  for (const topic of CROSS_LEVER_BLOCKED_TOPICS) {
    if (lower.includes(topic) && !allowsBlockedTopic(ctx, topic)) return true;
  }
  return false;
}

export function removeBlockedTopicContent(text: string, ctx: ScopeContext): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const filtered = sentences.filter(s => !sentenceViolatesScope(s, ctx));
  return filtered.join(" ").trim();
}

export function trimToWordLimit(text: string, wordLimit: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= wordLimit) return text.trim();
  return words.slice(0, wordLimit).join(" ").trim();
}
