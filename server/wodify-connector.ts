import crypto from "crypto";

const WODIFY_BASE_URL = "https://api.wodify.com/v1";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const RATE_LIMIT_DELAY_MS = 200;

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

export async function testWodifyConnection(apiKey: string): Promise<{
  success: boolean;
  message: string;
  locations?: any[];
  programs?: any[];
}> {
  try {
    const locationsData = await wodifyFetch("/locations", apiKey);
    const locations = Array.isArray(locationsData) ? locationsData : (locationsData?.data || []);

    let programs: any[] = [];
    try {
      const programsData = await wodifyFetch("/programs", apiKey);
      programs = Array.isArray(programsData) ? programsData : (programsData?.data || []);
    } catch {
      // Programs endpoint may not be available on all tiers
    }

    return {
      success: true,
      message: `Connected successfully. Found ${locations.length} location(s).`,
      locations,
      programs,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to connect to Wodify",
    };
  }
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

export async function fetchWodifyClients(
  apiKey: string,
  options?: { page?: number; pageSize?: number; query?: string },
): Promise<{ clients: WodifyClientRecord[]; hasMore: boolean; total?: number }> {
  const params: Record<string, string> = {};
  if (options?.page) params.page = String(options.page);
  if (options?.pageSize) params.page_size = String(options.pageSize);
  if (options?.query) params.q = options.query;

  try {
    const data = await wodifyFetch("/clients/search", apiKey, params);

    if (Array.isArray(data)) {
      return { clients: data, hasMore: data.length >= (options?.pageSize || 50) };
    }

    const clients = data?.data || data?.results || data?.items || [];
    const total = data?.total || data?.total_count;
    const hasMore = Array.isArray(clients) && clients.length >= (options?.pageSize || 50);

    return { clients: Array.isArray(clients) ? clients : [], hasMore, total };
  } catch (error: any) {
    if (error.message?.includes("404")) {
      try {
        const data = await wodifyFetch("/clients", apiKey, params);
        const clients = Array.isArray(data) ? data : (data?.data || []);
        return { clients, hasMore: clients.length >= (options?.pageSize || 50) };
      } catch {
        throw error;
      }
    }
    throw error;
  }
}

export async function fetchAllWodifyClients(apiKey: string): Promise<WodifyClientRecord[]> {
  const allClients: WodifyClientRecord[] = [];
  let page = 1;
  const pageSize = 100;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchWodifyClients(apiKey, { page, pageSize });
    allClients.push(...result.clients);
    hasMore = result.hasMore;
    page++;

    if (page > 200) break;
  }

  return allClients;
}

export async function fetchWodifyMemberships(
  apiKey: string,
  options?: { page?: number; pageSize?: number; query?: string },
): Promise<{ memberships: WodifyMembershipRecord[]; hasMore: boolean }> {
  const params: Record<string, string> = {};
  if (options?.page) params.page = String(options.page);
  if (options?.pageSize) params.page_size = String(options.pageSize);
  if (options?.query) params.q = options.query;

  try {
    const data = await wodifyFetch("/memberships/search", apiKey, params);

    if (Array.isArray(data)) {
      return { memberships: data, hasMore: data.length >= (options?.pageSize || 50) };
    }

    const memberships = data?.data || data?.results || data?.items || [];
    const hasMore = Array.isArray(memberships) && memberships.length >= (options?.pageSize || 50);

    return { memberships: Array.isArray(memberships) ? memberships : [], hasMore };
  } catch (error: any) {
    if (error.message?.includes("404")) {
      try {
        const data = await wodifyFetch("/memberships", apiKey, params);
        const memberships = Array.isArray(data) ? data : (data?.data || []);
        return { memberships, hasMore: memberships.length >= (options?.pageSize || 50) };
      } catch {
        return { memberships: [], hasMore: false };
      }
    }
    return { memberships: [], hasMore: false };
  }
}

export async function fetchAllWodifyMemberships(apiKey: string): Promise<WodifyMembershipRecord[]> {
  const allMemberships: WodifyMembershipRecord[] = [];
  let page = 1;
  const pageSize = 100;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchWodifyMemberships(apiKey, { page, pageSize });
    allMemberships.push(...result.memberships);
    hasMore = result.hasMore;
    page++;

    if (page > 200) break;
  }

  return allMemberships;
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
} {
  return {
    gymId,
    name: extractClientName(client),
    email: extractClientEmail(client),
    status: extractClientStatus(client),
    joinDate: extractJoinDate(client),
    cancelDate: extractCancelDate(client),
    monthlyRate: extractMonthlyRate(client, memberships),
  };
}
