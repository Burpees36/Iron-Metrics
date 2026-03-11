import crypto from "crypto";
import {
  normalizeRecords,
  extractArray,
  assertNormalizationNotEmpty,
  type NormalizeResult,
  type EndpointDiagnostic,
  type SkipReason,
  createEndpointDiagnostic,
} from "./sync-normalizer";

const WODIFY_BASE_URL = "https://api.wodify.com/v1";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const RATE_LIMIT_DELAY_MS = 200;
const MAX_PAGES = 200;
const DEFAULT_PAGE_SIZE = 100;

function getEncryptionKey(): Buffer {
  const secret = process.env.WODIFY_ENCRYPTION_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Encryption key not configured. Set WODIFY_ENCRYPTION_SECRET or SESSION_SECRET environment variable.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptApiKey(apiKey: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptApiKey(encryptedData: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = encryptedData.split(":");
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted API key format");
  }
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function generateFingerprint(apiKey: string): string {
  const hash = crypto.createHash("sha256").update(apiKey).digest("hex");
  return `...${hash.slice(-8)}`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


interface WodifyRequestMeta {
  endpoint: string;
  params: Record<string, string>;
  page?: number;
  status: number;
  responseKeys: string[];
  recordCount: number;
  durationMs: number;
}

function logRequest(meta: WodifyRequestMeta): void {
  const parts = [
    `[Wodify] ${meta.endpoint}`,
    `status=${meta.status}`,
    `records=${meta.recordCount}`,
    `keys=[${meta.responseKeys.join(",")}]`,
    `${meta.durationMs}ms`,
  ];
  if (meta.page !== undefined) parts.splice(1, 0, `page=${meta.page}`);
  const paramStr = Object.entries(meta.params).filter(([k]) => k !== "page").map(([k, v]) => `${k}=${v}`).join("&");
  if (paramStr) parts.splice(1, 0, `params={${paramStr}}`);
  console.log(parts.join(" | "));
}


function selectListEndpoint(resource: "clients" | "memberships"): string {
  return `/${resource}`;
}

function selectSearchEndpoint(resource: "clients" | "memberships"): string {
  return `/${resource}/search`;
}


function responseKeys(data: any): string[] {
  if (Array.isArray(data)) return ["(array)"];
  if (data && typeof data === "object") return Object.keys(data);
  return [typeof data];
}

function isAccessDenied(errorMessage: string): boolean {
  return (
    errorMessage.includes("Missing Authentication Token") ||
    errorMessage.includes("403") ||
    errorMessage.includes("Forbidden") ||
    errorMessage.includes("401") ||
    errorMessage.includes("Unauthorized")
  );
}

function isNotFound(errorMessage: string): boolean {
  return errorMessage.includes("404");
}


async function wodifyFetch(
  endpoint: string,
  apiKey: string,
  params?: Record<string, string>,
  retryCount = 0,
): Promise<any> {
  await sleep(RATE_LIMIT_DELAY_MS);

  const url = new URL(`${WODIFY_BASE_URL}${endpoint}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(30000),
    });

    if (response.status === 429 && retryCount < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
      console.log(`[Wodify] Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await sleep(delay);
      return wodifyFetch(endpoint, apiKey, params, retryCount + 1);
    }

    if (response.status >= 500 && retryCount < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
      console.log(`[Wodify] Server error ${response.status}, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await sleep(delay);
      return wodifyFetch(endpoint, apiKey, params, retryCount + 1);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Wodify API error ${response.status}: ${errorBody}`);
    }

    return response.json();
  } catch (error: any) {
    if (error.name === "TimeoutError" && retryCount < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
      console.log(`[Wodify] Timeout, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await sleep(delay);
      return wodifyFetch(endpoint, apiKey, params, retryCount + 1);
    }
    throw error;
  }
}

async function wodifyFetchWithLog(
  endpoint: string,
  apiKey: string,
  params: Record<string, string> = {},
): Promise<{ data: any; meta: WodifyRequestMeta }> {
  const start = Date.now();
  const page = params.page ? parseInt(params.page, 10) : undefined;

  try {
    const data = await wodifyFetch(endpoint, apiKey, params);
    const keys = responseKeys(data);
    const extracted = extractArray(data);
    const recordCount = extracted.records.length;

    const meta: WodifyRequestMeta = {
      endpoint,
      params,
      page,
      status: 200,
      responseKeys: keys,
      recordCount,
      durationMs: Date.now() - start,
    };
    logRequest(meta);
    return { data, meta };
  } catch (error: any) {
    const statusMatch = error.message?.match(/error (\d+)/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;
    const meta: WodifyRequestMeta = {
      endpoint,
      params,
      page,
      status,
      responseKeys: [],
      recordCount: 0,
      durationMs: Date.now() - start,
    };
    logRequest(meta);
    throw error;
  }
}


export async function testWodifyConnection(apiKey: string): Promise<{
  success: boolean;
  message: string;
}> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    return { success: false, message: "API key is empty" };
  }

  const testEndpoints = [
    { path: "/classes", label: "classes" },
    { path: "/clients", label: "clients" },
    { path: "/leads", label: "leads" },
  ];

  for (const { path, label } of testEndpoints) {
    const start = Date.now();
    try {
      const response = await fetch(`${WODIFY_BASE_URL}${path}`, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "x-api-key": trimmedKey,
        },
        signal: AbortSignal.timeout(15000),
      });

      const body = await response.text().catch(() => "");
      let bodyKeys: string[] = [];
      try { bodyKeys = Object.keys(JSON.parse(body)); } catch {}
      logRequest({
        endpoint: `${path} (test)`,
        params: {},
        status: response.status,
        responseKeys: response.ok ? bodyKeys : ["error"],
        recordCount: 0,
        durationMs: Date.now() - start,
      });

      if (response.ok) {
        return {
          success: true,
          message: `Connected successfully. Verified access via ${label} endpoint.`,
        };
      }

      if (response.status === 400 || response.status === 422) {
        return {
          success: true,
          message: `Connected successfully. API key verified via ${label} endpoint.`,
        };
      }

      if (response.status === 403 || response.status === 401) {
        if (body.includes("Missing Authentication Token")) continue;
        if (body.includes("Forbidden") || body.includes("Unauthorized")) continue;
      }

      if (response.status === 404) continue;
    } catch (error: any) {
      logRequest({
        endpoint: `${path} (test)`,
        params: {},
        status: 0,
        responseKeys: [],
        recordCount: 0,
        durationMs: Date.now() - start,
      });
      continue;
    }
  }

  const baselineStart = Date.now();
  const verifyResponse = await fetch(`${WODIFY_BASE_URL}/classes`, {
    method: "GET",
    headers: { "Accept": "application/json", "x-api-key": "INVALID_TEST_KEY_000" },
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  const invalidBody = await verifyResponse?.text().catch(() => "") || "";
  logRequest({
    endpoint: "/classes (baseline)",
    params: {},
    status: verifyResponse?.status || 0,
    responseKeys: [],
    recordCount: 0,
    durationMs: Date.now() - baselineStart,
  });

  const diffStart = Date.now();
  const realResponse = await fetch(`${WODIFY_BASE_URL}/classes`, {
    method: "GET",
    headers: { "Accept": "application/json", "x-api-key": trimmedKey },
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  const realBody = await realResponse?.text().catch(() => "") || "";
  logRequest({
    endpoint: "/classes (diff-check)",
    params: {},
    status: realResponse?.status || 0,
    responseKeys: [],
    recordCount: 0,
    durationMs: Date.now() - diffStart,
  });

  if (realResponse && verifyResponse) {
    if (realResponse.status !== verifyResponse.status || realBody !== invalidBody) {
      return { success: true, message: "Connected successfully. API key accepted by Wodify." };
    }
  }

  return {
    success: false,
    message: "Could not verify the API key with Wodify. All endpoints returned access denied. Please confirm this is a Wodify CRM API key from Automations > Integrations (not a WOD embed key).",
  };
}


export interface WodifyClientRecord {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  client_status?: string;
  date_of_birth?: string;
  created_date?: string;
  membership_start_date?: string;
  [key: string]: any;
}

export interface WodifyMembershipRecord {
  id: string;
  client_id?: string;
  membership_name?: string;
  membership_status?: string;
  start_date?: string;
  end_date?: string;
  billing_amount?: number;
  billing_frequency?: string;
  [key: string]: any;
}

export interface WodifyAttendanceRecord {
  id?: string;
  client_id?: string;
  clientId?: string;
  user_id?: string;
  class_date?: string;
  date?: string;
  attended_date?: string;
  check_in_date?: string;
  reservation_date?: string;
  status?: string;
  attendance_status?: string;
  [key: string]: any;
}

const CLIENT_KEYS = ["clients", "data", "results", "items", "records"];
const MEMBERSHIP_KEYS = ["memberships", "data", "results", "items", "records"];
const ATTENDANCE_KEYS = ["attendance", "reservations", "data", "results", "items", "records"];


export interface FetchResourceResult<T = Record<string, any>> {
  records: T[];
  hasMore: boolean;
  total?: number;
  normalization: NormalizeResult<T>;
  endpointUsed: string;
  httpStatus: number;
}

async function fetchResourcePage<T = Record<string, any>>(
  apiKey: string,
  resource: "clients" | "memberships",
  options: { page?: number; pageSize?: number; query?: string },
): Promise<FetchResourceResult<T>> {
  const params: Record<string, string> = {};
  if (options.page) params.page = String(options.page);
  if (options.pageSize) params.page_size = String(options.pageSize);

  const preferredKeys = resource === "clients" ? CLIENT_KEYS : MEMBERSHIP_KEYS;
  const hasQuery = options.query && options.query.trim().length > 0;
  const emptyResult = (endpoint: string): FetchResourceResult<T> => ({
    records: [],
    hasMore: false,
    normalization: normalizeRecords<T>(null, resource, preferredKeys),
    endpointUsed: endpoint,
    httpStatus: 0,
  });

  if (hasQuery) {
    params.q = options.query!;
    const searchEndpoint = selectSearchEndpoint(resource);
    try {
      const { data, meta } = await wodifyFetchWithLog(searchEndpoint, apiKey, params);
      const norm = normalizeRecords<T>(data, resource, preferredKeys);
      if (norm.normalizedCount > 0) {
        return {
          records: norm.normalizedRecords,
          hasMore: norm.normalizedCount >= (options.pageSize || DEFAULT_PAGE_SIZE),
          total: data?.total || data?.total_count,
          normalization: norm,
          endpointUsed: searchEndpoint,
          httpStatus: meta.status,
        };
      }
      console.log(`[Wodify] ${searchEndpoint} returned 0 normalized records, falling back to list endpoint`);
    } catch (error: any) {
      if (isAccessDenied(error.message) || isNotFound(error.message)) {
        console.log(`[Wodify] ${searchEndpoint} unavailable, falling back to list endpoint`);
      } else {
        throw error;
      }
    }
  }

  const listEndpoint = selectListEndpoint(resource);
  try {
    const { data, meta } = await wodifyFetchWithLog(listEndpoint, apiKey, params);
    const norm = normalizeRecords<T>(data, resource, preferredKeys);

    if (norm.rawCount > 0 && norm.normalizedCount === 0) {
      console.error(`[Wodify] ALERT: ${listEndpoint} returned ${norm.rawCount} raw records but normalization produced 0. ` +
        `detectedKey=${norm.detectedArrayKey}, skipSummary=${JSON.stringify(norm.skipSummary)}`);
      assertNormalizationNotEmpty(norm, data, listEndpoint);
    }

    return {
      records: norm.normalizedRecords,
      hasMore: norm.normalizedCount >= (options.pageSize || DEFAULT_PAGE_SIZE),
      total: data?.total || data?.total_count,
      normalization: norm,
      endpointUsed: listEndpoint,
      httpStatus: meta.status,
    };
  } catch (error: any) {
    if (isAccessDenied(error.message) || isNotFound(error.message)) {
      console.warn(`[Wodify] ${listEndpoint} unavailable (${error.message.slice(0, 80)})`);
      return emptyResult(listEndpoint);
    }
    throw error;
  }
}

export async function fetchWodifyClients(
  apiKey: string,
  options?: { page?: number; pageSize?: number; query?: string },
): Promise<FetchResourceResult<WodifyClientRecord>> {
  return fetchResourcePage<WodifyClientRecord>(apiKey, "clients", options || {});
}

export async function fetchWodifyMemberships(
  apiKey: string,
  options?: { page?: number; pageSize?: number; query?: string },
): Promise<FetchResourceResult<WodifyMembershipRecord>> {
  return fetchResourcePage<WodifyMembershipRecord>(apiKey, "memberships", options || {});
}

export interface FetchAllResult<T = Record<string, any>> {
  records: T[];
  pages: number;
  endpointDiagnostic: EndpointDiagnostic;
}

export async function fetchAllWodifyClients(
  apiKey: string,
  cancelCheck?: () => Promise<boolean>,
): Promise<FetchAllResult<WodifyClientRecord>> {
  const all: WodifyClientRecord[] = [];
  let page = 1;
  let hasMore = true;
  const diag = createEndpointDiagnostic("/clients");
  const start = Date.now();

  while (hasMore && page <= MAX_PAGES) {
    if (cancelCheck && page > 1 && await cancelCheck()) {
      console.log(`[Wodify] fetchAllWodifyClients cancelled at page ${page}`);
      break;
    }
    const result = await fetchWodifyClients(apiKey, { page, pageSize: DEFAULT_PAGE_SIZE });
    all.push(...result.records);
    hasMore = result.hasMore;
    diag.httpStatus = result.httpStatus || 200;
    diag.endpoint = result.endpointUsed;
    diag.rawCount += result.normalization.rawCount;
    diag.normalizedCount += result.normalization.normalizedCount;
    for (const [reason, count] of Object.entries(result.normalization.skipSummary)) {
      diag.skipReasons[reason as SkipReason] = (diag.skipReasons[reason as SkipReason] || 0) + count;
    }
    diag.skippedCount += result.normalization.skippedRecords.length;
    page++;
  }

  diag.durationMs = Date.now() - start;
  console.log(`[Wodify] fetchAllWodifyClients complete: ${all.length} normalized across ${page - 1} page(s) (raw=${diag.rawCount})`);
  return { records: all, pages: page - 1, endpointDiagnostic: diag };
}

export async function fetchAllWodifyMemberships(
  apiKey: string,
  cancelCheck?: () => Promise<boolean>,
): Promise<FetchAllResult<WodifyMembershipRecord>> {
  const all: WodifyMembershipRecord[] = [];
  let page = 1;
  let hasMore = true;
  const diag = createEndpointDiagnostic("/memberships");
  const start = Date.now();

  while (hasMore && page <= MAX_PAGES) {
    if (cancelCheck && page > 1 && await cancelCheck()) {
      console.log(`[Wodify] fetchAllWodifyMemberships cancelled at page ${page}`);
      break;
    }
    const result = await fetchWodifyMemberships(apiKey, { page, pageSize: DEFAULT_PAGE_SIZE });
    all.push(...result.records);
    hasMore = result.hasMore;
    diag.httpStatus = result.httpStatus || 200;
    diag.endpoint = result.endpointUsed;
    diag.rawCount += result.normalization.rawCount;
    diag.normalizedCount += result.normalization.normalizedCount;
    for (const [reason, count] of Object.entries(result.normalization.skipSummary)) {
      diag.skipReasons[reason as SkipReason] = (diag.skipReasons[reason as SkipReason] || 0) + count;
    }
    diag.skippedCount += result.normalization.skippedRecords.length;
    page++;
  }

  diag.durationMs = Date.now() - start;
  console.log(`[Wodify] fetchAllWodifyMemberships complete: ${all.length} normalized across ${page - 1} page(s) (raw=${diag.rawCount})`);
  return { records: all, pages: page - 1, endpointDiagnostic: diag };
}


export async function fetchWodifyAttendance(
  apiKey: string,
  options?: { page?: number; pageSize?: number; startDate?: string; endDate?: string },
): Promise<{ records: WodifyAttendanceRecord[]; hasMore: boolean } | null> {
  const params: Record<string, string> = {};
  if (options?.page) params.page = String(options.page);
  if (options?.pageSize) params.page_size = String(options.pageSize);
  if (options?.startDate) params.start_date = options.startDate;
  if (options?.endDate) params.end_date = options.endDate;

  const endpoints = ["/attendance", "/reservations", "/class-reservations", "/visits"];

  for (const endpoint of endpoints) {
    try {
      const { data } = await wodifyFetchWithLog(endpoint, apiKey, params);
      const { records, detectedKey } = extractArray(data, ATTENDANCE_KEYS);
      if (records.length > 0) {
        return { records, hasMore: records.length >= (options?.pageSize || DEFAULT_PAGE_SIZE) };
      }
    } catch (error: any) {
      if (isAccessDenied(error.message) || isNotFound(error.message)) continue;
      continue;
    }
  }

  return null;
}

export async function fetchAllWodifyAttendance(
  apiKey: string,
  lookbackDays: number = 30,
): Promise<WodifyAttendanceRecord[] | null> {
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const firstPage = await fetchWodifyAttendance(apiKey, { page: 1, pageSize: DEFAULT_PAGE_SIZE, startDate, endDate });
  if (!firstPage) return null;

  const allRecords: WodifyAttendanceRecord[] = [...firstPage.records];
  let page = 2;
  let hasMore = firstPage.hasMore;

  while (hasMore && page <= 100) {
    const result = await fetchWodifyAttendance(apiKey, { page, pageSize: DEFAULT_PAGE_SIZE, startDate, endDate });
    if (!result) break;
    allRecords.push(...result.records);
    hasMore = result.hasMore;
    page++;
  }

  return allRecords;
}


export function buildLastAttendedMap(
  attendanceRecords: WodifyAttendanceRecord[],
): Map<string, string> {
  const map = new Map<string, string>();

  for (const rec of attendanceRecords) {
    const clientId = String(rec.client_id || rec.clientId || rec.user_id || "");
    if (!clientId) continue;

    const status = (rec.status || rec.attendance_status || "").toLowerCase();
    if (status === "cancelled" || status === "canceled" || status === "no_show" || status === "no-show") continue;

    const dateStr = rec.class_date || rec.date || rec.attended_date || rec.check_in_date || rec.reservation_date;
    if (!dateStr) continue;

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) continue;

    const dateFormatted = d.toISOString().slice(0, 10);
    const existing = map.get(clientId);
    if (!existing || dateFormatted > existing) {
      map.set(clientId, dateFormatted);
    }
  }

  return map;
}


function extractClientId(client: WodifyClientRecord): string {
  return String(client.id || client.client_id || client.user_id || "");
}

function extractClientName(client: WodifyClientRecord): string {
  const first = client.first_name || client.firstName || "";
  const last = client.last_name || client.lastName || "";
  if (first || last) return `${first} ${last}`.trim();
  return client.name || client.full_name || "Unknown";
}

function extractClientEmail(client: WodifyClientRecord): string | null {
  return client.email || client.email_address || null;
}

function extractClientStatus(client: WodifyClientRecord): string {
  const raw = (client.client_status || client.status || client.membership_status || "active").toLowerCase();
  if (raw.includes("active") || raw === "on-ramp" || raw === "onramp") return "active";
  if (raw.includes("cancel") || raw.includes("inactive") || raw.includes("terminated") || raw.includes("deactivat")) return "cancelled";
  if (raw.includes("hold") || raw.includes("suspend") || raw.includes("freeze") || raw.includes("paus")) return "cancelled";
  return "active";
}

function extractJoinDate(client: WodifyClientRecord): string {
  const raw = client.created_date || client.membership_start_date || client.start_date || client.join_date || client.created_at;
  if (raw) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function extractCancelDate(client: WodifyClientRecord): string | null {
  const status = extractClientStatus(client);
  if (status !== "cancelled") return null;
  const raw = client.cancel_date || client.end_date || client.deactivation_date || client.cancelled_at;
  if (raw) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function extractMonthlyRate(
  client: WodifyClientRecord,
  memberships: WodifyMembershipRecord[],
): string {
  const clientId = extractClientId(client);
  const activeMembership = memberships.find((m) => {
    const mClientId = String(m.client_id || m.clientId || m.user_id || "");
    const mStatus = (m.membership_status || m.status || "").toLowerCase();
    return mClientId === clientId && (mStatus.includes("active") || mStatus === "");
  });

  if (activeMembership) {
    const amount = activeMembership.billing_amount || activeMembership.amount || activeMembership.rate || activeMembership.price || 0;
    if (amount > 0) {
      const freq = (activeMembership.billing_frequency || activeMembership.frequency || "monthly").toLowerCase();
      if (freq.includes("year") || freq.includes("annual")) return String((Number(amount) / 12).toFixed(2));
      if (freq.includes("quarter")) return String((Number(amount) / 3).toFixed(2));
      if (freq.includes("week")) return String((Number(amount) * 4.33).toFixed(2));
      return String(Number(amount).toFixed(2));
    }
  }

  return "0";
}

function extractMembershipType(
  client: WodifyClientRecord,
  memberships: WodifyMembershipRecord[],
): string | null {
  const clientId = extractClientId(client);
  const activeMembership = memberships.find((m) => {
    const mClientId = String(m.client_id || m.clientId || m.user_id || "");
    const mStatus = (m.membership_status || m.status || "").toLowerCase();
    return mClientId === clientId && (mStatus.includes("active") || mStatus === "");
  });

  if (activeMembership) {
    const name = activeMembership.membership_name || activeMembership.name || activeMembership.plan_name || activeMembership.program_name || "";
    if (name) return String(name).trim();
  }

  return null;
}

export function transformWodifyClientToMember(
  client: WodifyClientRecord,
  gymId: string,
  memberships: WodifyMembershipRecord[],
): {
  gymId: string;
  name: string;
  email: string | null;
  status: string;
  joinDate: string;
  cancelDate: string | null;
  monthlyRate: string;
  membershipType: string | null;
} {
  return {
    gymId,
    name: extractClientName(client),
    email: extractClientEmail(client),
    status: extractClientStatus(client),
    joinDate: extractJoinDate(client),
    cancelDate: extractCancelDate(client),
    monthlyRate: extractMonthlyRate(client, memberships),
    membershipType: extractMembershipType(client, memberships),
  };
}
