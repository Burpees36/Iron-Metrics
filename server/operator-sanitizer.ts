const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts|rules)/i,
  /disregard\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts|rules)/i,
  /forget\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts|rules)/i,
  /you\s+are\s+now\s+a/i,
  /act\s+as\s+(a\s+)?different/i,
  /new\s+instructions?\s*:/i,
  /system\s*:\s*/i,
  /\bprompt\s*injection\b/i,
  /\bjailbreak\b/i,
  /override\s+(system|safety|instructions)/i,
  /do\s+not\s+follow\s+(the\s+)?(system|above|previous)/i,
  /reveal\s+(your|the)\s+(system|instructions|prompt)/i,
  /what\s+(are|is)\s+your\s+(system|instructions|prompt)/i,
  /repeat\s+(the|your)\s+(system|above)\s+(prompt|instructions|message)/i,
  /\bDAN\b/,
  /do\s+anything\s+now/i,
  /pretend\s+you\s+(are|have)\s+no\s+(restrictions|rules|limits)/i,
  /\[\s*SYSTEM\s*\]/i,
  /\[\s*INST\s*\]/i,
  /<<\s*SYS\s*>>/i,
];

const HTML_TAG_RE = /<\/?[a-z][^>]*>/gi;
const MARKDOWN_RE = /(\*{1,3}|_{1,3}|~{2}|`{1,3}|#{1,6}\s|>\s|\[([^\]]*)\]\([^)]*\))/g;
const URL_RE = /https?:\/\/[^\s)>\]]+/gi;
const SCRIPT_BLOCK_RE = /<script[\s\S]*?<\/script>/gi;
const STYLE_BLOCK_RE = /<style[\s\S]*?<\/style>/gi;

const BRAND_PATTERNS = [
  /\b(CrossFit|CF)\s*(HQ|Inc|LLC|®|™)/gi,
  /\bWodify\b/gi,
  /\bSugarWOD\b/gi,
  /\bPushPress\b/gi,
  /\bZen\s*Planner\b/gi,
  /\bMindbody\b/gi,
  /\bGymdesk\b/gi,
];

const CITATION_RE = /\((?:[A-Z][a-z]+(?:\s+(?:et\s+al\.?|&)\s*)?(?:,?\s*\d{4}))\)/g;
const QUOTE_RE = /[""\u201C\u201D][^""\u201C\u201D]{20,}[""\u201C\u201D]/g;

export function sanitizeForPrompt(text: string): string {
  if (!text || typeof text !== "string") return "";

  let cleaned = text;

  cleaned = cleaned.replace(SCRIPT_BLOCK_RE, "");
  cleaned = cleaned.replace(STYLE_BLOCK_RE, "");
  cleaned = cleaned.replace(HTML_TAG_RE, "");
  cleaned = cleaned.replace(MARKDOWN_RE, (match, _full, linkText) => {
    if (linkText) return linkText;
    return "";
  });
  cleaned = cleaned.replace(URL_RE, "");

  for (const pattern of INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  cleaned = cleaned.replace(/[^\x20-\x7E\n\r\t—–''""…]/g, "");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  cleaned = cleaned.replace(/[ \t]{2,}/g, " ");
  cleaned = cleaned.trim();

  if (cleaned.length > 500) {
    cleaned = cleaned.slice(0, 497) + "...";
  }

  return cleaned;
}

export function sanitizeDoctrine(text: string): string {
  if (!text || typeof text !== "string") return "";

  let cleaned = text;

  for (const brandRe of BRAND_PATTERNS) {
    cleaned = cleaned.replace(brandRe, "");
  }

  cleaned = cleaned.replace(CITATION_RE, "");
  cleaned = cleaned.replace(QUOTE_RE, "");
  cleaned = cleaned.replace(URL_RE, "");

  cleaned = cleaned.replace(/[^\x20-\x7E\n\r\t—–''""…]/g, "");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  cleaned = cleaned.replace(/[ \t]{2,}/g, " ");
  cleaned = cleaned.trim();

  return cleaned;
}

export function detectInjectionAttempt(text: string): boolean {
  if (!text || typeof text !== "string") return false;

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      pattern.lastIndex = 0;
      return true;
    }
  }

  return false;
}
