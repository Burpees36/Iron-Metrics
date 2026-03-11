/**
 * canonical-mapping-job.ts
 *
 * Orchestrates the canonical mapping + promotion pipeline for a gym connection.
 *
 * Architectural intent:
 * - Reads staged raw payloads (raw ingestion layer)
 * - Uses saved source profile + mapping config (source understanding layer)
 * - Maps records into canonical candidates (normalized integration layer)
 * - Applies promotion rules to mark analytics-ready records
 * - Produces a clear diagnostics summary for the UI/API
 *
 * This job does NOT rewrite the existing analytics engine.
 * It builds the foundation that future analytics modules can consume.
 */

import { storage } from "./storage";
import { extractArray } from "./sync-normalizer";
import {
  mapPersonRecord,
  mapMembershipRecord,
  mapAttendanceRecord,
  generateMappingConfigFromProfile,
  type ValidationReason,
} from "./canonical-mapper";
import type { SourceMappingConfig } from "@shared/schema";

export interface MappingRunSummary {
  runId: string;
  stagedPayloadsProcessed: number;
  people: { candidates: number; promoted: number; blocked: number };
  memberships: { candidates: number; promoted: number; blocked: number };
  attendance: { candidates: number; promoted: number; blocked: number };
  validationReasonCounts: Record<string, number>;
  topBlockers: Array<{ reason: string; count: number }>;
  recommendedNextAction: string;
  durationMs: number;
}

function incrementReason(counts: Record<string, number>, reasons: ValidationReason[]): void {
  for (const r of reasons) {
    counts[r] = (counts[r] || 0) + 1;
  }
}

function topBlockers(counts: Record<string, number>, n = 5): Array<{ reason: string; count: number }> {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([reason, count]) => ({ reason, count }));
}

function deriveRecommendation(summary: Omit<MappingRunSummary, "recommendedNextAction" | "runId">): string {
  const totalPromoted = summary.people.promoted + summary.memberships.promoted + summary.attendance.promoted;
  const totalBlocked = summary.people.blocked + summary.memberships.blocked + summary.attendance.blocked;

  if (summary.stagedPayloadsProcessed === 0) {
    return "No staged payloads found. Run a data profile scan first to stage raw Wodify data.";
  }
  if (totalPromoted === 0) {
    return "No records were promoted. Review blocked record reasons and verify the mapping config is complete.";
  }
  if (totalBlocked > totalPromoted) {
    return "More records are blocked than promoted. Check the top blockers and consider verifying your API access or field mapping.";
  }
  if (summary.people.promoted > 0 && summary.memberships.promoted === 0) {
    return "Member records promoted but no memberships found. Verify your Wodify key can access membership data.";
  }
  return "Mapping complete. Promoted records are ready for analytics use in a future sprint.";
}

export async function runCanonicalMappingJob(gymId: string): Promise<MappingRunSummary> {
  const startTime = Date.now();

  const connection = await storage.getWodifyConnection(gymId);
  if (!connection) throw new Error("No Wodify connection found for this gym");

  const run = await storage.createCanonicalMappingRun({
    gymId,
    connectionId: connection.id,
    sourceType: "wodify",
    status: "running",
  });

  console.log(`[Canonical Mapping] Starting run ${run.id} for gym ${gymId}`);

  try {
    const profile = await storage.getLatestSourceProfile(gymId, "wodify");
    let mappingConfig = await storage.getMappingConfig(gymId, connection.id, "wodify");

    if (!mappingConfig) {
      console.log(`[Canonical Mapping] No mapping config found — auto-generating from source profile`);

      if (!profile) {
        const noProfileSummary: MappingRunSummary = {
          runId: run.id,
          stagedPayloadsProcessed: 0,
          people: { candidates: 0, promoted: 0, blocked: 0 },
          memberships: { candidates: 0, promoted: 0, blocked: 0 },
          attendance: { candidates: 0, promoted: 0, blocked: 0 },
          validationReasonCounts: {},
          topBlockers: [],
          recommendedNextAction: "No source profile found. Run a data profile scan first.",
          durationMs: Date.now() - startTime,
        };
        await storage.updateCanonicalMappingRun(run.id, {
          status: "completed",
          finishedAt: new Date(),
          recommendedNextAction: noProfileSummary.recommendedNextAction,
          totalDurationMs: noProfileSummary.durationMs,
        });
        return noProfileSummary;
      }

      const profileData = {
        discoveredEndpoints: (profile.discoveredEndpoints as string[]) || [],
        endpointSummaries: (profile.endpointSummaries as Array<{ endpoint: string; sampleFieldNames: string[] }>) || [],
        discoveredIdentifierCandidates: (profile.discoveredIdentifierCandidates as string[]) || [],
        discoveredDateFields: (profile.discoveredDateFields as string[]) || [],
        discoveredRevenueFields: (profile.discoveredRevenueFields as string[]) || [],
        discoveredStatusFields: (profile.discoveredStatusFields as string[]) || [],
      };

      const configData = generateMappingConfigFromProfile(gymId, connection.id, "wodify", profileData, profile.id);
      mappingConfig = await storage.upsertMappingConfig(configData);
      console.log(`[Canonical Mapping] Auto-generated mapping config ${mappingConfig.id}`);
    }

    const stagedPayloads = await storage.getRawStagedPayloads(gymId, { connectionId: connection.id, limit: 100 });
    console.log(`[Canonical Mapping] Processing ${stagedPayloads.length} staged payloads`);

    // Counters
    let peopleCandidates = 0, peoplePromoted = 0, peopleBlocked = 0;
    let membershipCandidates = 0, membershipsPromoted = 0, membershipsBlocked = 0;
    let attendanceCandidates = 0, attendancePromoted = 0, attendanceBlocked = 0;
    const reasonCounts: Record<string, number> = {};

    // Build a person ID lookup map for cross-domain linking
    // Key: source person identifier → canonical person DB id
    const personIdLookup = new Map<string, string>();

    // ── Pass 1: Map people ──
    const personEndpoints = ["/clients"];
    for (const staged of stagedPayloads) {
      if (!personEndpoints.includes(staged.endpoint)) continue;
      if (!staged.payloadJson) continue;

      const { records } = extractArray(staged.payloadJson as any);
      console.log(`[Canonical Mapping] Mapping ${records.length} people from ${staged.endpoint}`);

      for (const record of records) {
        if (!record || typeof record !== "object") continue;

        const candidate = mapPersonRecord(record, mappingConfig, gymId, connection.id, staged.endpoint, "wodify");
        peopleCandidates++;
        if (candidate.validationStatus === "promoted") peoplePromoted++;
        if (candidate.validationStatus === "blocked") peopleBlocked++;
        incrementReason(reasonCounts, candidate.validationReasons);

        const saved = await storage.upsertCanonicalPerson({
          gymId: candidate.gymId,
          sourceType: candidate.sourceType,
          sourceConnectionId: candidate.sourceConnectionId,
          sourceRecordId: candidate.sourceRecordId,
          sourceEndpoint: candidate.sourceEndpoint,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          fullName: candidate.fullName,
          email: candidate.email,
          phone: candidate.phone,
          externalPersonId: candidate.externalPersonId,
          completenessLevel: candidate.completenessLevel,
          mappingConfidence: candidate.mappingConfidence,
          validationStatus: candidate.validationStatus,
          validationReasons: candidate.validationReasons,
          lastSeenAt: new Date(),
        });

        // Register in lookup for membership/attendance linking
        if (candidate.externalPersonId) personIdLookup.set(candidate.externalPersonId, saved.id);
        if (candidate.sourceRecordId) personIdLookup.set(candidate.sourceRecordId, saved.id);
      }
    }

    console.log(`[Canonical Mapping] People: ${peopleCandidates} candidates, ${peoplePromoted} promoted, ${peopleBlocked} blocked`);

    // ── Pass 2: Map memberships ──
    const membershipEndpoints = ["/memberships"];
    for (const staged of stagedPayloads) {
      if (!membershipEndpoints.includes(staged.endpoint)) continue;
      if (!staged.payloadJson) continue;

      const { records } = extractArray(staged.payloadJson as any);
      console.log(`[Canonical Mapping] Mapping ${records.length} memberships from ${staged.endpoint}`);

      for (const record of records) {
        if (!record || typeof record !== "object") continue;

        const candidate = mapMembershipRecord(record, mappingConfig, gymId, connection.id, staged.endpoint, "wodify", personIdLookup);
        membershipCandidates++;
        if (candidate.validationStatus === "promoted") membershipsPromoted++;
        if (candidate.validationStatus === "blocked") membershipsBlocked++;
        incrementReason(reasonCounts, candidate.validationReasons);

        await storage.upsertCanonicalMembership({
          gymId: candidate.gymId,
          sourceType: candidate.sourceType,
          sourceConnectionId: candidate.sourceConnectionId,
          sourceRecordId: candidate.sourceRecordId,
          sourceEndpoint: candidate.sourceEndpoint,
          canonicalPersonId: candidate.canonicalPersonId,
          membershipName: candidate.membershipName,
          membershipStatus: candidate.membershipStatus,
          startDate: candidate.startDate,
          endDate: candidate.endDate,
          billingAmount: candidate.billingAmount,
          billingPeriod: candidate.billingPeriod,
          externalMembershipId: candidate.externalMembershipId,
          completenessLevel: candidate.completenessLevel,
          mappingConfidence: candidate.mappingConfidence,
          validationStatus: candidate.validationStatus,
          validationReasons: candidate.validationReasons,
          lastSeenAt: new Date(),
        });
      }
    }

    console.log(`[Canonical Mapping] Memberships: ${membershipCandidates} candidates, ${membershipsPromoted} promoted, ${membershipsBlocked} blocked`);

    // ── Pass 3: Map attendance ──
    const attendanceEndpoints = ["/attendance", "/reservations"];
    for (const staged of stagedPayloads) {
      if (!attendanceEndpoints.includes(staged.endpoint)) continue;
      if (!staged.payloadJson) continue;

      const { records } = extractArray(staged.payloadJson as any);
      console.log(`[Canonical Mapping] Mapping ${records.length} attendance records from ${staged.endpoint}`);

      for (const record of records) {
        if (!record || typeof record !== "object") continue;

        const candidate = mapAttendanceRecord(record, mappingConfig, gymId, connection.id, staged.endpoint, "wodify", personIdLookup);
        attendanceCandidates++;
        if (candidate.validationStatus === "promoted") attendancePromoted++;
        if (candidate.validationStatus === "blocked") attendanceBlocked++;
        incrementReason(reasonCounts, candidate.validationReasons);

        await storage.upsertCanonicalAttendance({
          gymId: candidate.gymId,
          sourceType: candidate.sourceType,
          sourceConnectionId: candidate.sourceConnectionId,
          sourceRecordId: candidate.sourceRecordId,
          sourceEndpoint: candidate.sourceEndpoint,
          canonicalPersonId: candidate.canonicalPersonId,
          attendanceDate: candidate.attendanceDate,
          className: candidate.className,
          programName: candidate.programName,
          locationName: candidate.locationName,
          attendanceStatus: candidate.attendanceStatus,
          externalAttendanceId: candidate.externalAttendanceId,
          completenessLevel: candidate.completenessLevel,
          mappingConfidence: candidate.mappingConfidence,
          validationStatus: candidate.validationStatus,
          validationReasons: candidate.validationReasons,
          lastSeenAt: new Date(),
        });
      }
    }

    console.log(`[Canonical Mapping] Attendance: ${attendanceCandidates} candidates, ${attendancePromoted} promoted, ${attendanceBlocked} blocked`);

    const durationMs = Date.now() - startTime;
    const blockers = topBlockers(reasonCounts);

    const partialSummary = {
      runId: run.id,
      stagedPayloadsProcessed: stagedPayloads.length,
      people: { candidates: peopleCandidates, promoted: peoplePromoted, blocked: peopleBlocked },
      memberships: { candidates: membershipCandidates, promoted: membershipsPromoted, blocked: membershipsBlocked },
      attendance: { candidates: attendanceCandidates, promoted: attendancePromoted, blocked: attendanceBlocked },
      validationReasonCounts: reasonCounts,
      topBlockers: blockers,
      durationMs,
    };
    const recommendedNextAction = deriveRecommendation(partialSummary);

    await storage.updateCanonicalMappingRun(run.id, {
      status: "completed",
      finishedAt: new Date(),
      stagedPayloadsProcessed: stagedPayloads.length,
      peopleCandidates,
      peoplePromoted,
      peopleBlocked,
      membershipCandidates,
      membershipsPromoted,
      membershipsBlocked,
      attendanceCandidates,
      attendancePromoted,
      attendanceBlocked,
      validationReasonCounts: reasonCounts,
      topBlockers: blockers,
      recommendedNextAction,
      totalDurationMs: durationMs,
    });

    console.log(`[Canonical Mapping] Run ${run.id} complete in ${durationMs}ms`);
    console.log(`[Canonical Mapping] Next action: ${recommendedNextAction}`);

    return { ...partialSummary, recommendedNextAction };
  } catch (error: any) {
    console.error(`[Canonical Mapping] Run ${run.id} failed:`, error);
    await storage.updateCanonicalMappingRun(run.id, {
      status: "failed",
      finishedAt: new Date(),
      errorMessage: error.message,
      totalDurationMs: Date.now() - startTime,
    });
    throw error;
  }
}
