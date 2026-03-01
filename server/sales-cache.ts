import type { SalesSummary } from "./sales-intelligence";
import { computeSalesSummary, computeLeadAging } from "./sales-intelligence";
import type { IStorage } from "./storage";

interface CacheEntry {
  data: SalesSummary;
  computedAt: number;
  gymId: string;
  periodKey: string;
}

interface RecalcStatus {
  lastRun: number | null;
  lastSuccess: boolean;
  lastError: string | null;
  nextRun: number | null;
  gymsProcessed: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const NIGHTLY_INTERVAL_MS = 24 * 60 * 60 * 1000;

let recalcStatus: RecalcStatus = {
  lastRun: null,
  lastSuccess: true,
  lastError: null,
  nextRun: null,
  gymsProcessed: 0,
};

let recalcTimer: ReturnType<typeof setTimeout> | null = null;

function cacheKey(gymId: string, start: string, end: string): string {
  return `${gymId}:${start}:${end}`;
}

export function getCachedSummary(gymId: string, start: string, end: string): SalesSummary | null {
  const key = cacheKey(gymId, start, end);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.computedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedSummary(gymId: string, start: string, end: string, data: SalesSummary): void {
  const key = cacheKey(gymId, start, end);
  cache.set(key, {
    data,
    computedAt: Date.now(),
    gymId,
    periodKey: key,
  });
}

export function invalidateGymCache(gymId: string): void {
  for (const [key] of cache) {
    if (key.startsWith(`${gymId}:`)) {
      cache.delete(key);
    }
  }
}

export function getRecalcStatus(): RecalcStatus {
  return { ...recalcStatus };
}

async function runNightlyRecalc(storage: IStorage): Promise<void> {
  const startTime = Date.now();
  console.log(`[sales-cache] Starting nightly recalculation at ${new Date().toISOString()}`);

  try {
    const gyms = await storage.getGyms();
    let processed = 0;

    for (const gym of gyms) {
      try {
        const now = new Date();
        const end = now;
        const start90 = new Date(now.getTime() - 90 * 86400000);

        const [leadsArr, consultsArr, membershipsArr, paymentsArr] = await Promise.all([
          storage.getLeadsByGym(gym.id, start90, end),
          storage.getConsultsByGym(gym.id, start90, end),
          storage.getSalesMembershipsByGym(gym.id, start90, end),
          storage.getPaymentsByGym(gym.id, start90, end),
        ]);

        const prevStart = new Date(start90.getTime() - 90 * 86400000);
        const [prevLeads, prevConsults, prevMemberships, prevPayments] = await Promise.all([
          storage.getLeadsByGym(gym.id, prevStart, start90),
          storage.getConsultsByGym(gym.id, prevStart, start90),
          storage.getSalesMembershipsByGym(gym.id, prevStart, start90),
          storage.getPaymentsByGym(gym.id, prevStart, start90),
        ]);

        const summary = computeSalesSummary(
          leadsArr, consultsArr, membershipsArr, paymentsArr,
          prevLeads, prevConsults, prevMemberships, prevPayments
        );

        setCachedSummary(gym.id, start90.toISOString(), end.toISOString(), summary);

        const integrityIssues: string[] = [];
        if (summary.dataQuality.score < 40) {
          integrityIssues.push(`Gym ${gym.id}: Data quality critical (${summary.dataQuality.score})`);
        }

        const allLeads = await storage.getLeadsByGymAllTime(gym.id);
        const wonLeads = allLeads.filter(l => l.status === "won");
        const wonWithoutPrice = wonLeads.filter(l => !l.salePrice || Number(l.salePrice) <= 0);
        if (wonWithoutPrice.length > 0) {
          integrityIssues.push(`Gym ${gym.id}: ${wonWithoutPrice.length} won leads missing sale price`);
        }

        if (integrityIssues.length > 0) {
          console.warn(`[sales-cache] Data integrity warnings for gym ${gym.id}:`, integrityIssues);
        }

        processed++;
      } catch (gymError: any) {
        console.error(`[sales-cache] Error processing gym ${gym.id}:`, gymError.message);
      }
    }

    recalcStatus = {
      lastRun: startTime,
      lastSuccess: true,
      lastError: null,
      nextRun: startTime + NIGHTLY_INTERVAL_MS,
      gymsProcessed: processed,
    };

    console.log(`[sales-cache] Nightly recalculation complete. ${processed}/${gyms.length} gyms processed in ${Date.now() - startTime}ms`);
  } catch (error: any) {
    recalcStatus = {
      lastRun: startTime,
      lastSuccess: false,
      lastError: error.message,
      nextRun: startTime + NIGHTLY_INTERVAL_MS,
      gymsProcessed: 0,
    };
    console.error(`[sales-cache] Nightly recalculation FAILED:`, error.message);
  }
}

function scheduleNextRun(storage: IStorage): void {
  if (recalcTimer) clearTimeout(recalcTimer);

  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(2, 0, 0, 0);
  if (nextMidnight.getTime() <= now.getTime()) {
    nextMidnight.setDate(nextMidnight.getDate() + 1);
  }

  const delay = nextMidnight.getTime() - now.getTime();
  recalcStatus.nextRun = nextMidnight.getTime();

  console.log(`[sales-cache] Next recalculation scheduled for ${nextMidnight.toISOString()} (in ${Math.round(delay / 60000)} minutes)`);

  recalcTimer = setTimeout(async () => {
    await runNightlyRecalc(storage);
    scheduleNextRun(storage);
  }, delay);
}

export function initSalesCache(storage: IStorage): void {
  console.log(`[sales-cache] Initializing sales cache and scheduling nightly recalculation`);
  scheduleNextRun(storage);
}
