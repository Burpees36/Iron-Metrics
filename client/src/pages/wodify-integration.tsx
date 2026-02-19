import { useState } from "react";
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
  errorCount: number;
  errorDetails?: string;
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
  });

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
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sync started", description: "Your data is being pulled from Wodify. This may take a few minutes." });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "wodify", "status"] });
        queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "wodify", "sync-history"] });
      }, 3000);
    },
    onError: (err: Error) => {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    },
  });

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
                <Badge variant="default" className="gap-1" data-testid="badge-connection-status">
                  <CheckCircle2 className="w-3 h-3" />
                  Connected
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
                  disabled={syncMutation.isPending}
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
                  disabled={syncMutation.isPending}
                  data-testid="button-sync-backfill"
                >
                  <Database className="w-4 h-4" />
                  <span className="ml-1.5">Full Backfill</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  data-testid="button-disconnect"
                >
                  <Unplug className="w-4 h-4" />
                  <span className="ml-1.5">Disconnect</span>
                </Button>
              </div>
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
                        {run.status === "completed" ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : run.status === "running" ? (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        ) : run.status === "completed_with_errors" ? (
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium capitalize">
                            {run.runType} sync
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {run.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{run.clientsUpserted} members synced</span>
                          <span>{run.clientsPulled} clients pulled</span>
                          <span>{run.membershipsPulled} memberships pulled</span>
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
