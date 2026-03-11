export type SkipReason =
  | "missing_required_identifier"
  | "missing_name"
  | "unsupported_shape"
  | "duplicate_in_payload"
  | "duplicate_in_database"
  | "restricted_endpoint"
  | "empty_response"
  | "parse_error";

export interface SkippedRecord {
  index: number;
  reason: SkipReason;
  detail?: string;
  sample?: Record<string, any>;
}

export interface NormalizeResult<T = Record<string, any>> {
  normalizedRecords: T[];
  rawCount: number;
  normalizedCount: number;
  detectedArrayKey: string | null;
  skippedRecords: SkippedRecord[];
  skipSummary: Record<SkipReason, number>;
}

export interface EndpointDiagnostic {
  endpoint: string;
  httpStatus: number;
  rawCount: number;
  normalizedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  skipReasons: Partial<Record<SkipReason, number>>;
  durationMs: number;
  error?: string;
}

export interface SyncDiagnostics {
  syncRunId: string;
  gymId: string;
  runType: string;
  startedAt: string;
  finishedAt: string;
  totalDurationMs: number;
  endpoints: EndpointDiagnostic[];
  totals: {
    rawRecords: number;
    normalizedRecords: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  skipSummary: Record<SkipReason, number>;
  errors: string[];
  warnings: string[];
}

const KNOWN_WRAPPER_KEYS = [
  "clients", "memberships", "attendance", "reservations",
  "data", "results", "items", "records", "entries", "rows",
];

export function extractArray(
  rawData: any,
  preferredKeys: string[] = KNOWN_WRAPPER_KEYS,
): { records: any[]; detectedKey: string | null } {
  if (rawData === null || rawData === undefined) {
    return { records: [], detectedKey: null };
  }

  if (Array.isArray(rawData)) {
    return { records: rawData, detectedKey: "(root_array)" };
  }

  if (typeof rawData !== "object") {
    return { records: [], detectedKey: null };
  }

  for (const key of preferredKeys) {
    if (Array.isArray(rawData[key])) {
      return { records: rawData[key], detectedKey: key };
    }
  }

  for (const key of Object.keys(rawData)) {
    if (Array.isArray(rawData[key])) {
      return { records: rawData[key], detectedKey: key };
    }
  }

  return { records: [], detectedKey: null };
}

function buildSkipSummary(skipped: SkippedRecord[]): Record<SkipReason, number> {
  const summary: Record<string, number> = {};
  for (const s of skipped) {
    summary[s.reason] = (summary[s.reason] || 0) + 1;
  }
  return summary as Record<SkipReason, number>;
}

function sampleRecord(record: any): Record<string, any> {
  if (!record || typeof record !== "object") return {};
  const keys = Object.keys(record).slice(0, 8);
  const sample: Record<string, any> = {};
  for (const k of keys) {
    const v = record[k];
    sample[k] = typeof v === "string" && v.length > 50 ? v.slice(0, 50) + "…" : v;
  }
  return sample;
}

export interface ClientValidationConfig {
  idFields: string[];
  nameFields: string[];
}

const DEFAULT_CLIENT_CONFIG: ClientValidationConfig = {
  idFields: ["id", "client_id", "user_id", "clientId", "userId"],
  nameFields: ["first_name", "last_name", "firstName", "lastName", "name", "full_name"],
};

const DEFAULT_MEMBERSHIP_CONFIG: ClientValidationConfig = {
  idFields: ["id", "membership_id", "membershipId"],
  nameFields: [],
};

function hasAnyField(record: any, fields: string[]): boolean {
  if (!record || typeof record !== "object") return false;
  return fields.some((f) => {
    const v = record[f];
    return v !== undefined && v !== null && v !== "";
  });
}

export function normalizeRecords<T extends Record<string, any> = Record<string, any>>(
  rawData: any,
  resource: "clients" | "memberships" | "attendance",
  preferredKeys?: string[],
): NormalizeResult<T> {
  const { records: rawRecords, detectedKey } = extractArray(rawData, preferredKeys);
  const skipped: SkippedRecord[] = [];
  const normalized: T[] = [];
  const seenIds = new Set<string>();

  if (rawRecords.length === 0) {
    if (rawData !== null && rawData !== undefined) {
      const keys = typeof rawData === "object" && !Array.isArray(rawData) ? Object.keys(rawData) : [];
      if (keys.length > 0) {
        skipped.push({
          index: -1,
          reason: "unsupported_shape",
          detail: `Response object has keys [${keys.join(",")}] but no array found`,
          sample: sampleRecord(rawData),
        });
      } else {
        skipped.push({ index: -1, reason: "empty_response" });
      }
    } else {
      skipped.push({ index: -1, reason: "empty_response" });
    }

    return {
      normalizedRecords: [],
      rawCount: 0,
      normalizedCount: 0,
      detectedArrayKey: detectedKey,
      skippedRecords: skipped,
      skipSummary: buildSkipSummary(skipped),
    };
  }

  const config = resource === "memberships" ? DEFAULT_MEMBERSHIP_CONFIG : DEFAULT_CLIENT_CONFIG;

  for (let i = 0; i < rawRecords.length; i++) {
    const record = rawRecords[i];

    if (!record || typeof record !== "object" || Array.isArray(record)) {
      skipped.push({
        index: i,
        reason: "unsupported_shape",
        detail: `Record at index ${i} is ${typeof record}`,
      });
      continue;
    }

    if (!hasAnyField(record, config.idFields)) {
      skipped.push({
        index: i,
        reason: "missing_required_identifier",
        detail: `No id field found among [${config.idFields.join(",")}]`,
        sample: sampleRecord(record),
      });
      continue;
    }

    if (resource === "clients" && config.nameFields.length > 0) {
      if (!hasAnyField(record, config.nameFields)) {
        skipped.push({
          index: i,
          reason: "missing_name",
          detail: `No name field found among [${config.nameFields.join(",")}]`,
          sample: sampleRecord(record),
        });
        continue;
      }
    }

    const idValue = String(
      config.idFields.reduce<any>((found, f) => found || record[f], null) || ""
    );
    if (seenIds.has(idValue)) {
      skipped.push({
        index: i,
        reason: "duplicate_in_payload",
        detail: `Duplicate id=${idValue}`,
      });
      continue;
    }
    seenIds.add(idValue);

    normalized.push(record as T);
  }

  return {
    normalizedRecords: normalized,
    rawCount: rawRecords.length,
    normalizedCount: normalized.length,
    detectedArrayKey: detectedKey,
    skippedRecords: skipped,
    skipSummary: buildSkipSummary(skipped),
  };
}

export function createEndpointDiagnostic(endpoint: string): EndpointDiagnostic {
  return {
    endpoint,
    httpStatus: 0,
    rawCount: 0,
    normalizedCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    skipReasons: {} as Partial<Record<SkipReason, number>>,
    durationMs: 0,
  };
}

export function createSyncDiagnostics(
  syncRunId: string,
  gymId: string,
  runType: string,
): SyncDiagnostics {
  return {
    syncRunId,
    gymId,
    runType,
    startedAt: new Date().toISOString(),
    finishedAt: "",
    totalDurationMs: 0,
    endpoints: [],
    totals: {
      rawRecords: 0,
      normalizedRecords: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    },
    skipSummary: {} as Record<SkipReason, number>,
    errors: [],
    warnings: [],
  };
}

export function finalizeDiagnostics(diag: SyncDiagnostics, startTime: number): void {
  diag.finishedAt = new Date().toISOString();
  diag.totalDurationMs = Date.now() - startTime;

  for (const ep of diag.endpoints) {
    diag.totals.rawRecords += ep.rawCount;
    diag.totals.normalizedRecords += ep.normalizedCount;
    diag.totals.inserted += ep.insertedCount;
    diag.totals.updated += ep.updatedCount;
    diag.totals.skipped += ep.skippedCount;
  }
  diag.totals.errors = diag.errors.length;

  const merged: Record<string, number> = {};
  for (const ep of diag.endpoints) {
    for (const [reason, count] of Object.entries(ep.skipReasons)) {
      merged[reason] = (merged[reason] || 0) + count;
    }
  }
  diag.skipSummary = merged as Record<SkipReason, number>;
}

export function logDiagnostics(diag: SyncDiagnostics): void {
  console.log(`[Sync Diagnostics] ──────────────────────────────────`);
  console.log(`[Sync Diagnostics] Run: ${diag.syncRunId} | Gym: ${diag.gymId} | Type: ${diag.runType}`);
  console.log(`[Sync Diagnostics] Duration: ${diag.totalDurationMs}ms`);

  for (const ep of diag.endpoints) {
    const skipStr = Object.entries(ep.skipReasons)
      .filter(([, c]) => c > 0)
      .map(([r, c]) => `${r}=${c}`)
      .join(", ");
    console.log(
      `[Sync Diagnostics]   ${ep.endpoint} | status=${ep.httpStatus} | raw=${ep.rawCount} → normalized=${ep.normalizedCount} | inserted=${ep.insertedCount} updated=${ep.updatedCount} skipped=${ep.skippedCount}${skipStr ? ` | reasons: ${skipStr}` : ""} | ${ep.durationMs}ms${ep.error ? ` | ERROR: ${ep.error}` : ""}`
    );
  }

  console.log(
    `[Sync Diagnostics] TOTALS: raw=${diag.totals.rawRecords} → normalized=${diag.totals.normalizedRecords} | inserted=${diag.totals.inserted} updated=${diag.totals.updated} skipped=${diag.totals.skipped} errors=${diag.totals.errors}`
  );

  const globalSkips = Object.entries(diag.skipSummary).filter(([, c]) => c > 0);
  if (globalSkips.length > 0) {
    console.log(`[Sync Diagnostics] Skip reasons: ${globalSkips.map(([r, c]) => `${r}=${c}`).join(", ")}`);
  }

  if (diag.warnings.length > 0) {
    for (const w of diag.warnings) {
      console.warn(`[Sync Diagnostics] WARNING: ${w}`);
    }
  }

  if (diag.errors.length > 0) {
    for (const e of diag.errors) {
      console.error(`[Sync Diagnostics] ERROR: ${e}`);
    }
  }

  console.log(`[Sync Diagnostics] ──────────────────────────────────`);
}

export class NormalizationError extends Error {
  constructor(
    message: string,
    public endpoint: string,
    public rawResponseKeys: string[],
    public rawSample: any,
  ) {
    super(message);
    this.name = "NormalizationError";
  }
}

export function assertNormalizationNotEmpty(
  result: NormalizeResult,
  rawData: any,
  endpoint: string,
): void {
  if (result.normalizedCount > 0) return;
  if (result.rawCount === 0) return;

  const keys = typeof rawData === "object" && !Array.isArray(rawData)
    ? Object.keys(rawData)
    : ["(array)"];
  const firstItem = Array.isArray(rawData)
    ? rawData[0]
    : result.skippedRecords[0]?.sample;

  throw new NormalizationError(
    `Normalization produced 0 records from ${result.rawCount} raw records on ${endpoint}. ` +
    `Detected key: ${result.detectedArrayKey}. ` +
    `Skip reasons: ${Object.entries(result.skipSummary).map(([r, c]) => `${r}=${c}`).join(", ")}. ` +
    `First record sample: ${JSON.stringify(firstItem).slice(0, 300)}`,
    endpoint,
    keys,
    sampleRecord(firstItem),
  );
}
