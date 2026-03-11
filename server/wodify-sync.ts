import { storage } from "./storage";
import {
  decryptApiKey,
  fetchAllWodifyClients,
  fetchAllWodifyMemberships,
  fetchAllWodifyAttendance,
  buildLastAttendedMap,
  transformWodifyClientToMember,
  type WodifyClientRecord,
  type WodifyMembershipRecord,
} from "./wodify-connector";
import {
  createSyncDiagnostics,
  createEndpointDiagnostic,
  finalizeDiagnostics,
  logDiagnostics,
  type SyncDiagnostics,
  type EndpointDiagnostic,
  type SkipReason,
} from "./sync-normalizer";
import { recomputeAllMetrics } from "./metrics";

export type SyncPhase =
  | "initializing"
  | "fetching_clients"
  | "fetching_memberships"
  | "fetching_attendance"
  | "storing_raw_data"
  | "importing_members"
  | "finalizing";

export interface WodifySyncResult {
  success: boolean;
  syncRunId: string;
  status: string;
  clientsPulled: number;
  clientsUpserted: number;
  membershipsPulled: number;
  membershipsUpserted: number;
  membersUpserted: number;
  membersSkipped: number;
  errors: string[];
  diagnostics: SyncDiagnostics;
}

async function checkCancelled(syncRunId: string): Promise<boolean> {
  const run = await storage.updateWodifySyncRun(syncRunId, {});
  return run?.cancelRequested === true;
}

async function updateProgress(
  syncRunId: string,
  phase: SyncPhase,
  message: string,
  counts: Partial<{
    clientsPulled: number;
    clientsUpserted: number;
    membershipsPulled: number;
    membershipsUpserted: number;
    membersUpserted: number;
    membersSkipped: number;
    errorCount: number;
  }> = {},
): Promise<void> {
  await storage.updateWodifySyncRun(syncRunId, {
    phase,
    progressMessage: message,
    ...counts,
  });
}

export async function runWodifySync(
  gymId: string,
  runType: "backfill" | "incremental" = "incremental",
): Promise<WodifySyncResult> {
  const syncStart = Date.now();

  const existingRun = await storage.getRunningWodifySync(gymId);
  if (existingRun) {
    throw new Error(`A sync is already running for this gym (run ${existingRun.id}, status: ${existingRun.status})`);
  }

  const connection = await storage.getWodifyConnection(gymId);
  if (!connection || connection.status !== "connected") {
    throw new Error("No active Wodify connection for this gym");
  }

  let apiKey: string;
  try {
    apiKey = decryptApiKey(connection.apiKeyEncrypted);
  } catch {
    await storage.updateWodifyConnection(connection.id, {
      status: "error",
      lastErrorAt: new Date(),
      lastErrorMessage: "Failed to decrypt API key. Please reconnect.",
    });
    throw new Error("Failed to decrypt API key. Please reconnect your Wodify account.");
  }

  const cursorStart = runType === "incremental" && connection.lastCursorAt
    ? connection.lastCursorAt
    : null;

  const syncRun = await storage.createWodifySyncRun({
    gymId,
    connectionId: connection.id,
    runType,
    status: "running",
    cursorStart,
    cursorEnd: null,
    clientsPulled: 0,
    clientsUpserted: 0,
    membershipsPulled: 0,
    membershipsUpserted: 0,
    membersUpserted: 0,
    membersSkipped: 0,
    errorCount: 0,
    errorDetails: null,
  });

  const diag = createSyncDiagnostics(syncRun.id, gymId, runType);
  const errors: string[] = [];
  let clientsPulled = 0;
  let clientsUpserted = 0;
  let rawClientsStored = 0;
  let membershipsPulled = 0;
  let membershipsUpserted = 0;
  let membersUpsertedCount = 0;
  let membersSkippedCount = 0;

  const makeCancelledResult = async (): Promise<WodifySyncResult> => {
    finalizeDiagnostics(diag, syncStart);
    logDiagnostics(diag);
    const now = new Date();
    await storage.updateWodifySyncRun(syncRun.id, {
      status: "cancelled",
      finishedAt: now,
      phase: "finalizing",
      progressMessage: "Sync cancelled by user",
      clientsPulled,
      clientsUpserted,
      membershipsPulled,
      membershipsUpserted,
      membersUpserted: membersUpsertedCount,
      membersSkipped: membersSkippedCount,
      errorCount: errors.length,
      errorDetails: errors.length > 0 ? JSON.stringify(errors.slice(0, 100)) : null,
      diagnosticsSummary: buildDiagnosticsSummary(diag),
    });
    console.log(`[Wodify Sync] Cancelled for gym ${gymId} — partial: ${clientsPulled} clients, ${membershipsPulled} memberships, ${membersUpsertedCount} members`);
    return {
      success: false,
      syncRunId: syncRun.id,
      status: "cancelled",
      clientsPulled,
      clientsUpserted,
      membershipsPulled,
      membershipsUpserted,
      membersUpserted: membersUpsertedCount,
      membersSkipped: membersSkippedCount,
      errors,
      diagnostics: diag,
    };
  };

  try {
    await updateProgress(syncRun.id, "initializing", `Starting ${runType} sync...`);
    console.log(`[Wodify Sync] Starting ${runType} sync for gym ${gymId}${cursorStart ? ` from cursor ${cursorStart.toISOString()}` : " (full pull)"}`);

    // ── Phase 1: Fetch Clients ──
    if (await checkCancelled(syncRun.id)) return await makeCancelledResult();
    await updateProgress(syncRun.id, "fetching_clients", "Fetching clients from Wodify...");

    const cancelChecker = () => checkCancelled(syncRun.id);

    let clients: WodifyClientRecord[] = [];
    let clientDiag: EndpointDiagnostic;
    try {
      const clientResult = await fetchAllWodifyClients(apiKey, cancelChecker);
      clients = clientResult.records;
      clientDiag = clientResult.endpointDiagnostic;
      clientsPulled = clientDiag.rawCount;

      if (runType === "incremental" && cursorStart) {
        const lookbackMs = (connection.syncWindowDays || 7) * 24 * 60 * 60 * 1000;
        const lookbackDate = new Date(cursorStart.getTime() - lookbackMs);
        const originalCount = clients.length;
        clients = clients.filter((c) => {
          const updatedAt = c.updated_at || c.modified_date || c.created_date;
          if (!updatedAt) return true;
          const d = new Date(updatedAt);
          return isNaN(d.getTime()) || d >= lookbackDate;
        });
        if (originalCount !== clients.length) {
          console.log(`[Wodify Sync] Incremental filter: ${originalCount} → ${clients.length} clients (lookback ${connection.syncWindowDays}d from cursor)`);
        }
      }

      await updateProgress(syncRun.id, "fetching_clients", `Pulled ${clientsPulled} clients (${clientDiag.normalizedCount} normalized)`, { clientsPulled });
      console.log(`[Wodify Sync] Pulled ${clientsPulled} raw → ${clientDiag.normalizedCount} normalized clients, processing ${clients.length}`);
    } catch (error: any) {
      const msg = `Failed to fetch clients: ${error.message}`;
      errors.push(msg);
      console.error(`[Wodify Sync] ${msg}`);
      clientDiag = createEndpointDiagnostic("/clients");
      clientDiag.error = error.message;
    }

    // ── Phase 2: Fetch Memberships ──
    if (await checkCancelled(syncRun.id)) return await makeCancelledResult();
    await updateProgress(syncRun.id, "fetching_memberships", "Fetching memberships from Wodify...", { clientsPulled });

    let memberships: WodifyMembershipRecord[] = [];
    let membershipDiag: EndpointDiagnostic;
    try {
      const membershipResult = await fetchAllWodifyMemberships(apiKey, cancelChecker);
      memberships = membershipResult.records;
      membershipDiag = membershipResult.endpointDiagnostic;
      membershipsPulled = membershipDiag.rawCount;
      await updateProgress(syncRun.id, "fetching_memberships", `Pulled ${membershipsPulled} memberships (${membershipDiag.normalizedCount} normalized)`, { clientsPulled, membershipsPulled });
      console.log(`[Wodify Sync] Pulled ${membershipsPulled} raw → ${membershipDiag.normalizedCount} normalized memberships`);
    } catch (error: any) {
      const msg = `Failed to fetch memberships: ${error.message}`;
      errors.push(msg);
      console.error(`[Wodify Sync] ${msg}`);
      membershipDiag = createEndpointDiagnostic("/memberships");
      membershipDiag.error = error.message;
    }

    // ── Phase 3: Store Raw Data ──
    if (await checkCancelled(syncRun.id)) return await makeCancelledResult();
    await updateProgress(syncRun.id, "storing_raw_data", `Storing ${clients.length} raw clients and ${memberships.length} raw memberships...`, { clientsPulled, membershipsPulled });

    for (const client of clients) {
      try {
        const clientId = String(client.id || client.client_id || client.user_id || "");
        if (!clientId) continue;
        await storage.upsertWodifyRawClient({
          gymId,
          wodifyClientId: clientId,
          payload: client,
          sourceUpdatedAt: client.updated_at ? new Date(client.updated_at) : null,
          syncRunId: syncRun.id,
        });
        rawClientsStored++;
      } catch (error: any) {
        errors.push(`Raw client upsert failed for ${client.id}: ${error.message}`);
      }
    }

    for (const membership of memberships) {
      try {
        const membershipId = String(membership.id || membership.membership_id || "");
        const clientId = String(membership.client_id || membership.clientId || membership.user_id || "");
        if (!membershipId) continue;
        await storage.upsertWodifyRawMembership({
          gymId,
          wodifyMembershipId: membershipId,
          wodifyClientId: clientId,
          payload: membership,
          sourceUpdatedAt: membership.updated_at ? new Date(membership.updated_at) : null,
          syncRunId: syncRun.id,
        });
        membershipsUpserted++;
      } catch (error: any) {
        errors.push(`Raw membership upsert failed for ${membership.id}: ${error.message}`);
      }
    }

    await updateProgress(syncRun.id, "storing_raw_data", `Stored ${rawClientsStored} clients, ${membershipsUpserted} memberships`, {
      clientsPulled, membershipsPulled, clientsUpserted: rawClientsStored, membershipsUpserted,
    });

    // ── Phase 4: Fetch Attendance ──
    if (await checkCancelled(syncRun.id)) return await makeCancelledResult();
    await updateProgress(syncRun.id, "fetching_attendance", "Fetching attendance data...", {
      clientsPulled, membershipsPulled, clientsUpserted: rawClientsStored, membershipsUpserted,
    });

    let lastAttendedMap = new Map<string, string>();
    const attendanceDiag = createEndpointDiagnostic("/attendance");
    const attendanceStart = Date.now();
    try {
      const attendanceRecords = await fetchAllWodifyAttendance(apiKey, 60);
      if (attendanceRecords) {
        lastAttendedMap = buildLastAttendedMap(attendanceRecords);
        attendanceDiag.rawCount = attendanceRecords.length;
        attendanceDiag.normalizedCount = lastAttendedMap.size;
        attendanceDiag.httpStatus = 200;
        console.log(`[Wodify Sync] Pulled attendance data: ${attendanceRecords.length} records, ${lastAttendedMap.size} unique clients`);
      } else {
        attendanceDiag.error = "No attendance endpoints available";
        console.log(`[Wodify Sync] Attendance endpoints not available — skipping`);
      }
    } catch (error: any) {
      attendanceDiag.error = error.message;
      console.log(`[Wodify Sync] Attendance fetch failed (non-critical): ${error.message}`);
    }
    attendanceDiag.durationMs = Date.now() - attendanceStart;

    // ── Phase 5: Import Members ──
    if (await checkCancelled(syncRun.id)) return await makeCancelledResult();
    await updateProgress(syncRun.id, "importing_members", `Importing ${clients.length} members...`, {
      clientsPulled, membershipsPulled, clientsUpserted: rawClientsStored, membershipsUpserted,
    });

    const memberSkipReasons: Record<string, number> = {};
    let batchCounter = 0;

    for (const client of clients) {
      if (batchCounter > 0 && batchCounter % 50 === 0) {
        if (await checkCancelled(syncRun.id)) return await makeCancelledResult();
        await updateProgress(syncRun.id, "importing_members",
          `Importing members... ${membersUpsertedCount} imported, ${membersSkippedCount} skipped (${batchCounter}/${clients.length})`, {
          clientsPulled, membershipsPulled, clientsUpserted: rawClientsStored, membershipsUpserted,
          membersUpserted: membersUpsertedCount, membersSkipped: membersSkippedCount, errorCount: errors.length,
        });
      }
      batchCounter++;

      try {
        const clientId = String(client.id || client.client_id || client.user_id || "");
        if (!clientId) {
          membersSkippedCount++;
          memberSkipReasons["missing_required_identifier"] = (memberSkipReasons["missing_required_identifier"] || 0) + 1;
          continue;
        }

        const memberData = transformWodifyClientToMember(client, gymId, memberships);

        if (!memberData.name || memberData.name === "Unknown") {
          membersSkippedCount++;
          memberSkipReasons["missing_name"] = (memberSkipReasons["missing_name"] || 0) + 1;
          continue;
        }

        const lastAttended = lastAttendedMap.get(clientId) || null;

        await storage.upsertMember({
          gymId: memberData.gymId,
          name: memberData.name,
          email: memberData.email,
          status: memberData.status,
          joinDate: memberData.joinDate,
          cancelDate: memberData.cancelDate,
          monthlyRate: memberData.monthlyRate,
          membershipType: memberData.membershipType,
          lastAttendedDate: lastAttended,
        });

        membersUpsertedCount++;
        clientsUpserted++;
      } catch (error: any) {
        errors.push(`Member transform/upsert failed for client ${client.id}: ${error.message}`);
      }
    }

    clientDiag.insertedCount = membersUpsertedCount;
    clientDiag.updatedCount = 0;
    clientDiag.skippedCount += membersSkippedCount;
    for (const [reason, count] of Object.entries(memberSkipReasons)) {
      clientDiag.skipReasons[reason as SkipReason] = (clientDiag.skipReasons[reason as SkipReason] || 0) + count;
    }

    membershipDiag.insertedCount = membershipsUpserted;

    diag.endpoints.push(clientDiag, membershipDiag, attendanceDiag);

    if (errors.length > 0) {
      diag.errors.push(...errors);
    }

    if (clientDiag.rawCount > 0 && clientsUpserted === 0 && membersSkippedCount === 0) {
      diag.warnings.push(
        `${clientDiag.rawCount} raw client records fetched but 0 members inserted or updated. ` +
        `Normalized=${clientDiag.normalizedCount}, skipped=${clientDiag.skippedCount}. ` +
        `This may indicate a data shape mismatch.`
      );
    }

    // ── Phase 6: Finalize ──
    await updateProgress(syncRun.id, "finalizing", "Saving results...", {
      clientsPulled, membershipsPulled, clientsUpserted: rawClientsStored, membershipsUpserted,
      membersUpserted: membersUpsertedCount, membersSkipped: membersSkippedCount, errorCount: errors.length,
    });

    finalizeDiagnostics(diag, syncStart);
    logDiagnostics(diag);

    const hasWarnings = diag.warnings.length > 0 || (errors.length > 0 && membersUpsertedCount > 0);
    const finalStatus = errors.length > 0 && membersUpsertedCount === 0
      ? "failed"
      : hasWarnings
        ? "completed_with_warnings"
        : "completed";

    const now = new Date();
    await storage.updateWodifySyncRun(syncRun.id, {
      status: finalStatus,
      finishedAt: now,
      cursorEnd: now,
      phase: "finalizing",
      progressMessage: finalStatus === "completed" ? "Sync completed successfully" : `Completed with ${errors.length} error(s)`,
      clientsPulled: clientDiag.rawCount,
      clientsUpserted: rawClientsStored,
      membershipsPulled: membershipDiag.rawCount,
      membershipsUpserted,
      membersUpserted: membersUpsertedCount,
      membersSkipped: membersSkippedCount,
      errorCount: errors.length,
      errorDetails: errors.length > 0 ? JSON.stringify(errors.slice(0, 100)) : null,
      diagnosticsSummary: buildDiagnosticsSummary(diag),
    });

    await storage.updateWodifyConnection(connection.id, {
      lastSuccessAt: now,
      lastCursorAt: now,
      status: "connected",
      lastErrorMessage: errors.length > 0 ? `Sync completed with ${errors.length} error(s)` : null,
    });

    console.log(`[Wodify Sync] ${finalStatus} for gym ${gymId}: ${membersUpsertedCount} members upserted, ${membersSkippedCount} skipped, ${rawClientsStored} raw clients stored, ${errors.length} errors`);

    recomputeAllMetrics(gymId).catch((err) =>
      console.error("[Wodify Sync] Background metrics recompute failed:", err)
    );

    return {
      success: true,
      syncRunId: syncRun.id,
      status: finalStatus,
      clientsPulled: clientDiag.rawCount,
      clientsUpserted: rawClientsStored,
      membershipsPulled: membershipDiag.rawCount,
      membershipsUpserted,
      membersUpserted: membersUpsertedCount,
      membersSkipped: membersSkippedCount,
      errors,
      diagnostics: diag,
    };
  } catch (error: any) {
    const errorMsg = error.message || "Unknown sync error";
    errors.push(errorMsg);

    finalizeDiagnostics(diag, syncStart);
    diag.errors.push(errorMsg);
    logDiagnostics(diag);

    await storage.updateWodifySyncRun(syncRun.id, {
      status: "failed",
      finishedAt: new Date(),
      phase: "finalizing",
      progressMessage: `Failed: ${errorMsg}`,
      clientsPulled,
      clientsUpserted,
      membershipsPulled,
      membershipsUpserted,
      membersUpserted: membersUpsertedCount,
      membersSkipped: membersSkippedCount,
      errorCount: errors.length,
      errorDetails: JSON.stringify(errors.slice(0, 100)),
      diagnosticsSummary: buildDiagnosticsSummary(diag),
    });

    const isAuthError = /unauthorized|forbidden|invalid.*key|auth|401|403/i.test(errorMsg);
    await storage.updateWodifyConnection(connection.id, {
      ...(isAuthError ? { status: "error" as const } : {}),
      lastErrorAt: new Date(),
      lastErrorMessage: errorMsg,
    });

    console.error(`[Wodify Sync] Failed for gym ${gymId}: ${errorMsg}`);

    return {
      success: false,
      syncRunId: syncRun.id,
      status: "failed",
      clientsPulled,
      clientsUpserted,
      membershipsPulled,
      membershipsUpserted,
      membersUpserted: membersUpsertedCount,
      membersSkipped: membersSkippedCount,
      errors,
      diagnostics: diag,
    };
  }
}

function buildDiagnosticsSummary(diag: SyncDiagnostics): Record<string, any> {
  const endpoints = diag.endpoints.map((ep) => ({
    endpoint: ep.endpoint,
    httpStatus: ep.httpStatus,
    rawCount: ep.rawCount,
    normalizedCount: ep.normalizedCount,
    insertedCount: ep.insertedCount,
    updatedCount: ep.updatedCount,
    skippedCount: ep.skippedCount,
    skipReasons: ep.skipReasons,
    durationMs: ep.durationMs,
    error: ep.error || null,
  }));

  return {
    syncRunId: diag.syncRunId,
    gymId: diag.gymId,
    runType: diag.runType,
    totalDurationMs: diag.totalDurationMs,
    endpoints,
    warnings: diag.warnings,
    errors: diag.errors.slice(0, 20),
    recommendedNextAction: deriveRecommendation(diag),
  };
}

function deriveRecommendation(diag: SyncDiagnostics): string {
  const clientEp = diag.endpoints.find((e) => e.endpoint.includes("client"));
  const membershipEp = diag.endpoints.find((e) => e.endpoint.includes("membership"));

  if (clientEp?.error && membershipEp?.error) {
    return "Both client and membership endpoints failed. Verify your Wodify API key has CRM access (not just WOD embed access).";
  }
  if (clientEp?.rawCount === 0) {
    return "No clients returned from Wodify. Check that your API key has access to client data.";
  }
  if (clientEp && clientEp.rawCount > 0 && clientEp.insertedCount === 0) {
    return "Clients were fetched but none could be imported. This usually means the data shape is unexpected — contact support with the diagnostics summary.";
  }
  if (diag.warnings.length > 0) {
    return "Sync completed with warnings. Review the warnings and consider a full backfill if data looks incomplete.";
  }
  if (diag.errors.length > 0) {
    return "Sync completed with errors. Some records may not have imported correctly. Try running another sync.";
  }
  return "Sync completed successfully. No action needed.";
}
