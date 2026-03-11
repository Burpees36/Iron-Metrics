import crypto from "crypto";
import { storage } from "./storage";
import { decryptApiKey } from "./wodify-connector";
import { extractArray } from "./sync-normalizer";
import {
  buildEndpointSummary,
  aggregateFieldProfiles,
  computeProfileConfidence,
  recommendNextAction,
  type EndpointSummary,
} from "./field-profiler";
import type { SourceProfile } from "@shared/schema";

const WODIFY_BASE_URL = "https://api.wodify.com/v1";
const RATE_LIMIT_DELAY_MS = 250;

const WODIFY_PROBE_ENDPOINTS = [
  { path: "/clients", label: "clients", requiresParams: false },
  { path: "/memberships", label: "memberships", requiresParams: false },
  { path: "/classes", label: "classes", requiresParams: false },
  { path: "/attendance", label: "attendance", requiresParams: false },
  { path: "/reservations", label: "reservations", requiresParams: false },
  { path: "/programs", label: "programs", requiresParams: false },
  { path: "/locations", label: "locations", requiresParams: false },
  { path: "/invoices", label: "invoices", requiresParams: false },
  { path: "/payments", label: "payments", requiresParams: false },
  { path: "/wods", label: "wods", requiresParams: false },
];

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computePayloadHash(data: any): string {
  const json = JSON.stringify(data);
  return crypto.createHash("sha256").update(json).digest("hex").slice(0, 16);
}

function responseKeys(data: any): string[] {
  if (Array.isArray(data)) return ["(root_array)"];
  if (data && typeof data === "object") return Object.keys(data);
  return [typeof data];
}

interface ProbeResult {
  endpoint: string;
  label: string;
  status: "accessible" | "blocked" | "empty" | "unsupported_shape" | "error";
  statusCode: number;
  rawData: any;
  errorMessage?: string;
  durationMs: number;
}

async function probeEndpoint(
  path: string,
  label: string,
  apiKey: string,
): Promise<ProbeResult> {
  const start = Date.now();
  try {
    await sleep(RATE_LIMIT_DELAY_MS);

    const url = new URL(`${WODIFY_BASE_URL}${path}`);
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(15000),
    });

    const durationMs = Date.now() - start;

    if (response.status === 401 || response.status === 403) {
      return { endpoint: path, label, status: "blocked", statusCode: response.status, rawData: null, durationMs };
    }

    if (response.status === 404) {
      return { endpoint: path, label, status: "blocked", statusCode: 404, rawData: null, durationMs, errorMessage: "Endpoint not found" };
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { endpoint: path, label, status: "error", statusCode: response.status, rawData: null, durationMs, errorMessage: body.slice(0, 200) };
    }

    const data = await response.json();
    const { records } = extractArray(data);

    if (records.length === 0) {
      return { endpoint: path, label, status: "empty", statusCode: 200, rawData: data, durationMs };
    }

    return { endpoint: path, label, status: "accessible", statusCode: 200, rawData: data, durationMs };
  } catch (error: any) {
    return {
      endpoint: path,
      label,
      status: "error",
      statusCode: 0,
      rawData: null,
      durationMs: Date.now() - start,
      errorMessage: error.message?.slice(0, 200),
    };
  }
}

export async function runWodifyDiscovery(gymId: string, profileId?: string): Promise<SourceProfile> {
  const startTime = Date.now();

  const connection = await storage.getWodifyConnection(gymId);
  if (!connection) {
    throw new Error("No Wodify connection found for this gym");
  }

  const apiKey = decryptApiKey(connection.apiKeyEncrypted);

  let profile: SourceProfile;
  if (profileId) {
    profile = await storage.updateSourceProfile(profileId, { profileStatus: "running" });
  } else {
    profile = await storage.createSourceProfile({
      gymId,
      connectionId: connection.id,
      sourceType: "wodify",
      profileStatus: "running",
    });
  }

  console.log(`[Wodify Discovery] Starting profile run ${profile.id} for gym ${gymId}`);

  const accessible: string[] = [];
  const blocked: string[] = [];
  const empty: string[] = [];
  const summaries: EndpointSummary[] = [];
  const warnings: string[] = [];

  try {
    for (const ep of WODIFY_PROBE_ENDPOINTS) {
      console.log(`[Wodify Discovery] Probing ${ep.path}...`);

      const result = await probeEndpoint(ep.path, ep.label, apiKey);

      if (result.status === "accessible") {
        accessible.push(ep.label);
        const summary = buildEndpointSummary(ep.path, result.statusCode, result.rawData);
        summaries.push(summary);

        const payloadHash = computePayloadHash(result.rawData);
        const keys = responseKeys(result.rawData);
        const { records, detectedKey } = extractArray(result.rawData);

        try {
          await storage.upsertRawStagedPayload({
            gymId,
            connectionId: connection.id,
            sourceType: "wodify",
            profileRunId: profile.id,
            endpoint: ep.path,
            pageNumber: 1,
            requestParams: {},
            responseStatus: result.statusCode,
            topLevelKeys: keys,
            detectedArrayKey: detectedKey,
            recordCount: records.length,
            payloadJson: result.rawData,
            payloadHash,
            parseStatus: "raw",
            parseNotes: `Profiled during discovery run ${profile.id}`,
          });
        } catch (stageErr: any) {
          console.warn(`[Wodify Discovery] Failed to stage payload for ${ep.path}: ${stageErr.message}`);
          warnings.push(`Failed to stage payload for ${ep.label}: ${stageErr.message}`);
        }

        console.log(`[Wodify Discovery] ${ep.path} → accessible (${records.length} records, array key: ${detectedKey})`);
      } else if (result.status === "blocked") {
        blocked.push(ep.label);
        console.log(`[Wodify Discovery] ${ep.path} → blocked (${result.statusCode})`);
      } else if (result.status === "empty") {
        empty.push(ep.label);

        if (result.rawData) {
          const summary = buildEndpointSummary(ep.path, result.statusCode, result.rawData, "Endpoint returned empty data");
          summaries.push(summary);

          const payloadHash = computePayloadHash(result.rawData);
          const keys = responseKeys(result.rawData);

          try {
            await storage.upsertRawStagedPayload({
              gymId,
              connectionId: connection.id,
              sourceType: "wodify",
              profileRunId: profile.id,
              endpoint: ep.path,
              pageNumber: 1,
              requestParams: {},
              responseStatus: result.statusCode,
              topLevelKeys: keys,
              detectedArrayKey: null,
              recordCount: 0,
              payloadJson: result.rawData,
              payloadHash,
              parseStatus: "raw",
              parseNotes: `Empty response during discovery run ${profile.id}`,
            });
          } catch (stageErr: any) {
            warnings.push(`Failed to stage empty payload for ${ep.label}: ${stageErr.message}`);
          }
        }
        console.log(`[Wodify Discovery] ${ep.path} → empty`);
      } else if (result.status === "error") {
        warnings.push(`${ep.label}: request error (status ${result.statusCode}) — ${result.errorMessage || "unknown"}`);
        console.log(`[Wodify Discovery] ${ep.path} → error (${result.errorMessage || "unknown error"})`);
      } else {
        blocked.push(ep.label);
        if (result.errorMessage) {
          warnings.push(`${ep.label}: ${result.errorMessage}`);
        }
        console.log(`[Wodify Discovery] ${ep.path} → ${result.status} (${result.errorMessage || "unknown error"})`);
      }

      await storage.updateSourceProfile(profile.id, {
        discoveredEndpoints: accessible,
        blockedEndpoints: blocked,
        emptyEndpoints: empty,
        endpointSummaries: summaries,
        profileWarnings: warnings,
      });
    }

    const fieldProfile = aggregateFieldProfiles(summaries);
    const confidence = computeProfileConfidence(accessible.length, blocked.length, empty.length);
    const nextAction = recommendNextAction(confidence, accessible.length, blocked.length);

    const totalDurationMs = Date.now() - startTime;

    const updated = await storage.updateSourceProfile(profile.id, {
      profileStatus: "completed",
      discoveredEndpoints: accessible,
      blockedEndpoints: blocked,
      emptyEndpoints: empty,
      endpointSummaries: summaries,
      discoveredIdentifierCandidates: fieldProfile.identifierCandidates,
      discoveredDateFields: fieldProfile.dateFields,
      discoveredRevenueFields: fieldProfile.revenueFields,
      discoveredStatusFields: fieldProfile.statusFields,
      profileWarnings: warnings,
      recommendedNextAction: nextAction,
      profileConfidence: confidence,
      totalDurationMs,
    });

    console.log(`[Wodify Discovery] Profile run ${profile.id} completed in ${totalDurationMs}ms`);
    console.log(`[Wodify Discovery] Accessible: ${accessible.length}, Blocked: ${blocked.length}, Empty: ${empty.length}`);
    console.log(`[Wodify Discovery] Confidence: ${confidence}`);
    console.log(`[Wodify Discovery] Next action: ${nextAction}`);

    return updated;
  } catch (error: any) {
    console.error(`[Wodify Discovery] Profile run ${profile.id} failed:`, error);

    const updated = await storage.updateSourceProfile(profile.id, {
      profileStatus: "failed",
      discoveredEndpoints: accessible,
      blockedEndpoints: blocked,
      emptyEndpoints: empty,
      endpointSummaries: summaries,
      profileWarnings: [...warnings, `Fatal error: ${error.message}`],
      totalDurationMs: Date.now() - startTime,
    });

    return updated;
  }
}
