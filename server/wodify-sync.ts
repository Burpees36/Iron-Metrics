import { storage } from "./storage";
import {
  decryptApiKey,
  fetchAllWodifyClients,
  fetchAllWodifyMemberships,
  transformWodifyClientToMember,
  type WodifyClientRecord,
  type WodifyMembershipRecord,
} from "./wodify-connector";
import { recomputeAllMetrics } from "./metrics";

export async function runWodifySync(
  gymId: string,
  runType: "backfill" | "incremental" = "incremental",
): Promise<{
  success: boolean;
  syncRunId: string;
  clientsPulled: number;
  clientsUpserted: number;
  membershipsPulled: number;
  membershipsUpserted: number;
  errors: string[];
}> {
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
    errorCount: 0,
    errorDetails: null,
  });

  const errors: string[] = [];
  let clientsPulled = 0;
  let clientsUpserted = 0;
  let rawClientsStored = 0;
  let membershipsPulled = 0;
  let membershipsUpserted = 0;

  try {
    console.log(`[Wodify Sync] Starting ${runType} sync for gym ${gymId}${cursorStart ? ` from cursor ${cursorStart.toISOString()}` : " (full pull)"}`);

    let clients: WodifyClientRecord[] = [];
    try {
      clients = await fetchAllWodifyClients(apiKey);
      clientsPulled = clients.length;

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
        console.log(`[Wodify Sync] Incremental filter: ${originalCount} → ${clients.length} clients (lookback ${connection.syncWindowDays}d from cursor)`);
      }

      console.log(`[Wodify Sync] Pulled ${clientsPulled} clients, processing ${clients.length}`);
    } catch (error: any) {
      const msg = `Failed to fetch clients: ${error.message}`;
      errors.push(msg);
      console.error(`[Wodify Sync] ${msg}`);
    }

    let memberships: WodifyMembershipRecord[] = [];
    try {
      memberships = await fetchAllWodifyMemberships(apiKey);
      membershipsPulled = memberships.length;
      console.log(`[Wodify Sync] Pulled ${membershipsPulled} memberships`);
    } catch (error: any) {
      const msg = `Failed to fetch memberships: ${error.message}`;
      errors.push(msg);
      console.error(`[Wodify Sync] ${msg}`);
    }

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

    for (const client of clients) {
      try {
        const clientId = String(client.id || client.client_id || client.user_id || "");
        if (!clientId) continue;

        const memberData = transformWodifyClientToMember(client, gymId, memberships);

        if (!memberData.name || memberData.name === "Unknown") continue;

        await storage.upsertMember({
          gymId: memberData.gymId,
          name: memberData.name,
          email: memberData.email,
          status: memberData.status,
          joinDate: memberData.joinDate,
          cancelDate: memberData.cancelDate,
          monthlyRate: memberData.monthlyRate,
        });
        clientsUpserted++;
      } catch (error: any) {
        errors.push(`Member transform/upsert failed for client ${client.id}: ${error.message}`);
      }
    }

    const now = new Date();
    await storage.updateWodifySyncRun(syncRun.id, {
      status: errors.length > 0 ? "completed_with_errors" : "completed",
      finishedAt: now,
      cursorEnd: now,
      clientsPulled,
      clientsUpserted,
      membershipsPulled,
      membershipsUpserted,
      errorCount: errors.length,
      errorDetails: errors.length > 0 ? JSON.stringify(errors.slice(0, 100)) : null,
    });

    await storage.updateWodifyConnection(connection.id, {
      lastSuccessAt: now,
      lastCursorAt: now,
      status: "connected",
      lastErrorMessage: errors.length > 0 ? `Sync completed with ${errors.length} error(s)` : null,
    });

    console.log(`[Wodify Sync] Completed for gym ${gymId}: ${clientsUpserted} members synced, ${rawClientsStored} raw clients stored, ${errors.length} errors`);

    recomputeAllMetrics(gymId).catch((err) =>
      console.error("[Wodify Sync] Background metrics recompute failed:", err)
    );

    return {
      success: true,
      syncRunId: syncRun.id,
      clientsPulled,
      clientsUpserted,
      membershipsPulled,
      membershipsUpserted,
      errors,
    };
  } catch (error: any) {
    const errorMsg = error.message || "Unknown sync error";
    errors.push(errorMsg);

    await storage.updateWodifySyncRun(syncRun.id, {
      status: "failed",
      finishedAt: new Date(),
      clientsPulled,
      clientsUpserted,
      membershipsPulled,
      membershipsUpserted,
      errorCount: errors.length,
      errorDetails: JSON.stringify(errors.slice(0, 100)),
    });

    await storage.updateWodifyConnection(connection.id, {
      status: "error",
      lastErrorAt: new Date(),
      lastErrorMessage: errorMsg,
    });

    console.error(`[Wodify Sync] Failed for gym ${gymId}: ${errorMsg}`);

    return {
      success: false,
      syncRunId: syncRun.id,
      clientsPulled,
      clientsUpserted,
      membershipsPulled,
      membershipsUpserted,
      errors,
    };
  }
}
