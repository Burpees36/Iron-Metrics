import { extractArray } from "./sync-normalizer";

export interface FieldProfile {
  identifierCandidates: string[];
  dateFields: string[];
  revenueFields: string[];
  statusFields: string[];
}

export interface EndpointSummary {
  endpoint: string;
  statusCode: number;
  topLevelKeys: string[];
  detectedArrayKey: string | null;
  sampleRecordCount: number;
  sampleFieldNames: string[];
  notes: string;
}

const IDENTIFIER_PATTERNS = [
  /^id$/i, /^_id$/i, /id$/i, /^uuid$/i,
  /email/i, /^person_?id$/i, /^client_?id$/i, /^member_?id$/i,
  /^membership_?id$/i, /^customer_?id$/i, /^external_?id$/i,
  /^user_?id$/i, /^account_?id$/i, /^contact_?id$/i,
];

const DATE_PATTERNS = [
  /date/i, /created/i, /updated/i, /modified/i,
  /^at$/i, /_at$/i, /timestamp/i, /time$/i,
  /start/i, /end/i, /expires/i, /born/i,
  /birthday/i, /dob/i, /joined/i, /signed/i,
];

const REVENUE_PATTERNS = [
  /amount/i, /price/i, /cost/i, /fee/i, /rate/i,
  /billing/i, /charge/i, /payment/i, /revenue/i,
  /total/i, /balance/i, /credit/i, /debit/i,
  /invoice/i, /discount/i, /tax/i, /subtotal/i,
];

const STATUS_PATTERNS = [
  /status/i, /state/i, /active/i, /enabled/i,
  /type$/i, /category/i, /role/i, /level/i,
  /tier/i, /plan/i, /phase/i, /stage/i,
  /is_/i, /has_/i, /can_/i,
];

function matchesAnyPattern(fieldName: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(fieldName));
}

export function detectIdentifierFields(fieldNames: string[]): string[] {
  return fieldNames.filter((f) => matchesAnyPattern(f, IDENTIFIER_PATTERNS));
}

export function detectDateFields(fieldNames: string[]): string[] {
  return fieldNames.filter((f) => matchesAnyPattern(f, DATE_PATTERNS));
}

export function detectRevenueFields(fieldNames: string[]): string[] {
  return fieldNames.filter((f) => matchesAnyPattern(f, REVENUE_PATTERNS));
}

export function detectStatusFields(fieldNames: string[]): string[] {
  return fieldNames.filter((f) => matchesAnyPattern(f, STATUS_PATTERNS));
}

export function extractFieldNames(records: any[], maxSample = 5): string[] {
  const fieldSet = new Set<string>();
  const sample = records.slice(0, maxSample);
  for (const record of sample) {
    if (record && typeof record === "object" && !Array.isArray(record)) {
      for (const key of Object.keys(record)) {
        fieldSet.add(key);
      }
    }
  }
  return Array.from(fieldSet);
}

export function detectArrayKey(data: any): { records: any[]; detectedKey: string | null } {
  return extractArray(data);
}

export function profileFields(fieldNames: string[]): FieldProfile {
  return {
    identifierCandidates: detectIdentifierFields(fieldNames),
    dateFields: detectDateFields(fieldNames),
    revenueFields: detectRevenueFields(fieldNames),
    statusFields: detectStatusFields(fieldNames),
  };
}

export function buildEndpointSummary(
  endpoint: string,
  statusCode: number,
  rawData: any,
  notes = "",
): EndpointSummary {
  const topLevelKeys = rawData && typeof rawData === "object" && !Array.isArray(rawData)
    ? Object.keys(rawData)
    : Array.isArray(rawData) ? ["(root_array)"] : [];

  const { records, detectedKey } = detectArrayKey(rawData);
  const sampleFieldNames = extractFieldNames(records);

  return {
    endpoint,
    statusCode,
    topLevelKeys,
    detectedArrayKey: detectedKey,
    sampleRecordCount: records.length,
    sampleFieldNames,
    notes,
  };
}

export function aggregateFieldProfiles(summaries: EndpointSummary[]): FieldProfile {
  const allFields = new Set<string>();
  for (const s of summaries) {
    for (const f of s.sampleFieldNames) {
      allFields.add(f);
    }
  }
  return profileFields(Array.from(allFields));
}

export function computeProfileConfidence(
  accessibleCount: number,
  blockedCount: number,
  emptyCount: number,
): "low" | "medium" | "high" {
  if (accessibleCount === 0) return "low";
  const total = accessibleCount + blockedCount + emptyCount;
  const accessibleRatio = accessibleCount / total;
  if (accessibleRatio >= 0.6 && accessibleCount >= 2) return "high";
  if (accessibleRatio >= 0.3 || accessibleCount >= 1) return "medium";
  return "low";
}

export function recommendNextAction(
  confidence: "low" | "medium" | "high",
  accessibleCount: number,
  blockedCount: number,
): string {
  if (accessibleCount === 0) {
    return "Verify API key permissions. No endpoints returned data.";
  }
  if (confidence === "low") {
    return "Review blocked endpoints. Consider requesting broader API access.";
  }
  if (blockedCount > 0 && confidence === "medium") {
    return "Some endpoints are blocked. You can proceed with available data, but full coverage requires broader API permissions.";
  }
  if (confidence === "high") {
    return "Data profile looks good. Ready to proceed with initial sync.";
  }
  return "Review the profile results and proceed with sync when ready.";
}
