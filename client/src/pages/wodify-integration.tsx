import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plug,
  Unplug,
  Shield,
  Clock,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Database,
  Square,
  Ban,
} from "lucide-react";
import { Link } from "wouter";

interface WodifyStatus {
  connected: boolean;
  status: string;
  apiKeyFingerprint?: string;
  wodifyLocationName?: string;
  wodifyProgramName?: string;
  connectedAt?: string;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastErrorMessage?: string;
  lastCursorAt?: string;
  recentSyncRuns?: SyncRun[];
}

interface SyncRun {
  id: string;
  runType: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  clientsPulled: number;
  clientsUpserted: number;
  membershipsPulled: number;
  membershipsUpserted: number;
  membersUpserted: number;
  membersSkipped: number;
  errorCount: number;
  errorDetails?: string;
  phase?: string;
  progressMessage?: string;
  cancelRequested?: boolean;
  diagnosticsSummary?: any;
}

interface SyncProgress {
  running: boolean;
  syncRunId?: string;
  runType?: string;
  status?: string;
  phase?: string;
  progressMessage?: string;
  clientsPulled?: number;
  clientsUpserted?: number;
  membershipsPulled?: number;
  membershipsUpserted?: number;
  membersUpserted?: number;
  membersSkipped?: number;
  errorCount?: number;
  startedAt?: string;
}

const PHASE_ORDER = [
  "initializing",
  "fetching_clients",
  "fetching_memberships",
  "fetching_attendance",
  "storing_raw_data",
  "importing_members",
  "finalizing",
] as const;

const PHASE_LABELS: Record<string, string> = {
  initializing: "Initializing",
  fetching_clients: "Fetching Clients",
  fetching_memberships: "Fetching Memberships",
  fetching_attendance: "Fetching Attendance",
  storing_raw_data: "Storing Raw Data",
  importing_members: "Importing Members",
  finalizing: "Finalizing",
};

function getPhaseProgress(phase?: string): number {
  if (!phase) return 0;
  const idx = PHASE_ORDER.indexOf(phase as any);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / PHASE_ORDER.length) * 100);
}

export default function WodifyIntegration() {
  const { id: gymId } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  const { data: status, isLoading } = useQuery<WodifyStatus>({
    queryKey: ["/api/gyms", gymId, "wodify", "status"],
  });

  const { data: syncHistory } = useQuery<SyncRun[]>({
    queryKey: ["/api/gyms", gymId, "wodify", "sync-history"],
    enabled: status?.connected === true,
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasRunning = data?.some((r) => ["queued", "running", "cancelling"].includes(r.status));
      return hasRunning ? 3000 : false;
    },
  });

  const { data: syncProgress } = useQuery<SyncProgress>({
    queryKey: ["/api/gyms", gymId, "wodify", "sync", "progress"],
    enabled: status?.connected === true,
    refetchInterval: (query) => {
      return query.state.data?.running ? 2000 : false;
    },
  });

  const isSyncRunning = syncProgress?.running === true;

  const testMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest("POST", `/api/gyms/${gymId}/wodify/test`, { apiKey: key });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Connection test passed", description: data.message });
      } else {
        toast({ title: "Connection test failed", description: data.message, variant: "destructive" });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest("POST", `/api/gyms/${gymId}/wodify/connect`, { apiKey: key });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Wodify connected", description: data.message });
      setApiKey("");
      setShowApiKeyInput(false);
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "wodify", "status"] });
    },
    onError: (err: Error) => {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/gyms/${gymId}/wodify/disconnect`);
    },
    onSuccess: () => {
      toast({ title: "Wodify disconnected" });
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "wodify", "status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "wodify", "sync-history"] });
    },
    onError: (err: Error) => {
      toast({ title: "Disconnect failed", description: err.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (runType: string) => {
      const res = await apiRequest("POST", `/api/gyms/${gymId}/wodify/sync`, { runType });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Sync request failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sync started", description: "Your data is being pulled from Wodify." });
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "wodify", "sync", "progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "wodify", "sync-history"] });
    },
    onError: (err: Error) => {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/gyms/${gymId}/wodify/sync/cancel`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Cancellation requested", description: "The sync will stop after its current phase completes." });
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "wodify", "sync", "progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "wodify", "sync-history"] });
    },
    onError: (err: Error) => {
      toast({ title: "Cancel failed", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (syncProgress && !syncProgress.running) {
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "wodify", "sync-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "wodify", "status"] });
    }
  }, [syncProgress?.running, gymId]);

  const isConnected = status?.connected === true;

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href={`/gyms/${gymId}`}>
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Wodify Integration</h1>
          <p className="text-sm text-muted-foreground">Automatically sync member data from your Wodify account</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plug className="w-4 h-4" />
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected ? (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={status?.status === "error" ? "destructive" : "default"} className="gap-1" data-testid="badge-connection-status">
                  {status?.status === "error" ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                  {status?.status === "error" ? "Connection Error" : "Connected"}
                </Badge>
                {status?.apiKeyFingerprint && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Key: {status.apiKeyFingerprint}
                  </span>
                )}
              </div>

              {status?.wodifyLocationName && (
                <p className="text-sm text-muted-foreground">
                  Location: <span className="text-foreground">{status.wodifyLocationName}</span>
                </p>
              )}

              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                {status?.connectedAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Connected {formatTimeAgo(status.connectedAt)}
                  </span>
                )}
                {status?.lastSuccessAt && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Last sync {formatTimeAgo(status.lastSuccessAt)}
                  </span>
                )}
                {status?.lastErrorMessage && (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertTriangle className="w-3 h-3" />
                    {status.lastErrorMessage}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 flex-wrap">
                <Button
                  onClick={() => syncMutation.mutate("incremental")}
                  disabled={syncMutation.isPending || isSyncRunning}
                  data-testid="button-sync-incremental"
                >
                  {syncMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span className="ml-1.5">Sync Now</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => syncMutation.mutate("backfill")}
                  disabled={syncMutation.isPending || isSyncRunning}
                  data-testid="button-sync-backfill"
                >
                  <Database className="w-4 h-4" />
                  <span className="ml-1.5">Full Backfill</span>
                </Button>
                {isSyncRunning && (
                  <Button
                    variant="destructive"
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending || syncProgress?.status === "cancelling"}
                    data-testid="button-cancel-sync"
                  >
                    <Square className="w-4 h-4" />
                    <span className="ml-1.5">
                      {syncProgress?.status === "cancelling" ? "Cancelling..." : "Stop Sync"}
                    </span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending || isSyncRunning}
                  data-testid="button-disconnect"
                >
                  <Unplug className="w-4 h-4" />
                  <span className="ml-1.5">Disconnect</span>
                </Button>
              </div>

              {isSyncRunning && (
                <p className="text-xs text-muted-foreground">
                  A sync is in progress. You cannot start another sync or disconnect until it finishes.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="gap-1" data-testid="badge-connection-status">
                  <XCircle className="w-3 h-3" />
                  Not Connected
                </Badge>
              </div>

              {!showApiKeyInput ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Connect your Wodify account to automatically import and sync member data.
                    You can find your API key in your Wodify admin panel under Settings.
                  </p>
                  <Button onClick={() => setShowApiKeyInput(true)} data-testid="button-start-connect">
                    <Plug className="w-4 h-4" />
                    <span className="ml-1.5">Connect Wodify</span>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="api-key">Wodify API Key</Label>
                    <Input
                      id="api-key"
                      type="password"
                      placeholder="Enter your Wodify API key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      data-testid="input-api-key"
                    />
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Your API key is encrypted at rest and never stored in plaintext.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      onClick={() => testMutation.mutate(apiKey)}
                      disabled={!apiKey || testMutation.isPending}
                      variant="outline"
                      data-testid="button-test-connection"
                    >
                      {testMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span className="ml-1.5">Test Connection</span>
                    </Button>
                    <Button
                      onClick={() => connectMutation.mutate(apiKey)}
                      disabled={!apiKey || connectMutation.isPending}
                      data-testid="button-connect"
                    >
                      {connectMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plug className="w-4 h-4" />
                      )}
                      <span className="ml-1.5">Connect & Save</span>
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => { setShowApiKeyInput(false); setApiKey(""); }}
                      data-testid="button-cancel-connect"
                    >
                      Cancel
                    </Button>
                  </div>
                  <a
                    href="https://app.wodify.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Find your API key in Wodify admin
                  </a>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {isSyncRunning && syncProgress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              Sync in Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {PHASE_LABELS[syncProgress.phase || ""] || syncProgress.phase || "Starting..."}
                </span>
                <span className="text-muted-foreground">
                  {getPhaseProgress(syncProgress.phase)}%
                </span>
              </div>
              <Progress value={getPhaseProgress(syncProgress.phase)} className="h-2" data-testid="progress-sync" />
              {syncProgress.progressMessage && (
                <p className="text-xs text-muted-foreground" data-testid="text-progress-message">
                  {syncProgress.progressMessage}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ProgressStat label="Clients Pulled" value={syncProgress.clientsPulled || 0} />
              <ProgressStat label="Memberships Pulled" value={syncProgress.membershipsPulled || 0} />
              <ProgressStat label="Members Imported" value={syncProgress.membersUpserted || 0} />
              <ProgressStat label="Skipped" value={syncProgress.membersSkipped || 0} />
            </div>

            {syncProgress.status === "cancelling" && (
              <div className="flex items-center gap-2 text-sm text-yellow-600">
                <Ban className="w-4 h-4" />
                Cancellation requested — stopping after current phase...
              </div>
            )}

            {syncProgress.startedAt && (
              <p className="text-xs text-muted-foreground">
                Started {formatTimeAgo(syncProgress.startedAt)}
                {" · "}{syncProgress.runType === "backfill" ? "Full Backfill" : "Incremental Sync"}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {isConnected && (syncHistory || status?.recentSyncRuns) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-4 h-4" />
              Sync History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const runs = syncHistory || status?.recentSyncRuns || [];
              if (runs.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground">
                    No sync runs yet. Click "Sync Now" to pull member data from Wodify.
                  </p>
                );
              }
              return (
                <div className="space-y-3">
                  {runs.map((run) => (
                    <div
                      key={run.id}
                      className="flex items-start gap-3 p-3 rounded-md border"
                      data-testid={`sync-run-${run.id}`}
                    >
                      <div className="pt-0.5">
                        <SyncStatusIcon status={run.status} />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {run.runType === "backfill" ? "Full Backfill" : "Incremental Sync"}
                          </span>
                          <SyncStatusBadge status={run.status} />
                        </div>

                        {["running", "queued", "cancelling"].includes(run.status) && run.progressMessage && (
                          <p className="text-xs text-blue-600">{run.progressMessage}</p>
                        )}

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{run.membersUpserted || run.clientsUpserted} members synced</span>
                          <span>{run.clientsPulled} clients pulled</span>
                          <span>{run.membershipsPulled} memberships pulled</span>
                          {(run.membersSkipped || 0) > 0 && (
                            <span>{run.membersSkipped} skipped</span>
                          )}
                          {run.errorCount > 0 && (
                            <span className="text-destructive">{run.errorCount} errors</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {run.startedAt ? formatTimeAgo(run.startedAt) : "Just now"}
                          {run.finishedAt && run.startedAt && (
                            <> &middot; took {formatDuration(run.startedAt, run.finishedAt)}</>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-4 h-4" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="font-medium text-foreground shrink-0">1.</span>
              <span>Enter your Wodify API key to establish a secure connection.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium text-foreground shrink-0">2.</span>
              <span>Iron Metrics pulls client and membership data from your Wodify account.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium text-foreground shrink-0">3.</span>
              <span>Data is transformed and merged with your existing member records.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium text-foreground shrink-0">4.</span>
              <span>Retention metrics, churn predictions, and intervention recommendations are automatically recalculated.</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProgressStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center p-2 rounded-md bg-muted/50">
      <p className="text-lg font-semibold tabular-nums">{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SyncStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "running":
    case "queued":
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    case "cancelling":
      return <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />;
    case "cancelled":
      return <Ban className="w-4 h-4 text-muted-foreground" />;
    case "completed_with_errors":
    case "completed_with_warnings":
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-destructive" />;
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
}

function SyncStatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, " ");
  switch (status) {
    case "completed":
      return <Badge variant="default" className="text-xs bg-green-600">{label}</Badge>;
    case "running":
    case "queued":
      return <Badge variant="default" className="text-xs bg-blue-600">{label}</Badge>;
    case "cancelling":
      return <Badge variant="default" className="text-xs bg-yellow-600">{label}</Badge>;
    case "cancelled":
      return <Badge variant="secondary" className="text-xs">{label}</Badge>;
    case "completed_with_errors":
    case "completed_with_warnings":
      return <Badge variant="default" className="text-xs bg-yellow-600">{label}</Badge>;
    case "failed":
      return <Badge variant="destructive" className="text-xs">{label}</Badge>;
    default:
      return <Badge variant="secondary" className="text-xs">{label}</Badge>;
  }
}

function formatTimeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function formatDuration(startStr: string, endStr: string): string {
  const diffMs = new Date(endStr).getTime() - new Date(startStr).getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  return `${mins}m ${remainSecs}s`;
}
