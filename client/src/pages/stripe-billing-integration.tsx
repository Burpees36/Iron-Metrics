import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RefreshCw,
  CreditCard,
  Unplug,
  Shield,
  Clock,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Database,
  Activity,
  Bug,
} from "lucide-react";
import { Link } from "wouter";

interface StripeStatus {
  connected: boolean;
  status: string;
  stripeAccountId?: string;
  apiKeyFingerprint?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  lastErrorAt?: string;
  lastErrorMessage?: string;
  recordsSynced?: number;
}

interface StripeSyncRun {
  id: string;
  runType: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  customersFound: number;
  subscriptionsFound: number;
  invoicesFound: number;
  chargesFound: number;
  refundsFound: number;
  recordsCreated: number;
  recordsUpdated: number;
  errorCount: number;
  errorDetails?: string;
}

interface StripeDebugData {
  connection: any;
  totalBillingRecords: number;
  recentSyncRuns: StripeSyncRun[];
  recentWebhookEvents: Array<{
    id: string;
    stripeEventId: string;
    eventType: string;
    status: string;
    processedAt: string;
  }>;
}

const PLATFORM_ADMIN_IDS = ["54700016"];

export default function StripeBillingIntegration() {
  const { id: gymId } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { isDemo, user } = useAuth();
  const isDemoUser = isDemo;
  const [apiKey, setApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const isAdmin = user && PLATFORM_ADMIN_IDS.includes(user.id);

  const { data: status, isLoading } = useQuery<StripeStatus>({
    queryKey: [`/api/gyms/${gymId}/stripe/status`],
    enabled: !!gymId,
  });

  const { data: syncRuns } = useQuery<StripeSyncRun[]>({
    queryKey: [`/api/gyms/${gymId}/stripe/sync-runs`],
    enabled: !!gymId && !!status?.connected,
  });

  const { data: debugData } = useQuery<StripeDebugData>({
    queryKey: [`/api/gyms/${gymId}/stripe/debug`],
    enabled: !!gymId && !!isAdmin,
  });

  const connectMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest("POST", `/api/gyms/${gymId}/stripe/connect`, { apiKey: key });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/gyms/${gymId}/stripe/status`] });
      setApiKey("");
      setShowApiKeyInput(false);
      toast({ title: "Stripe connected", description: "Your Stripe account has been linked. Run a sync to import payment history." });
    },
    onError: (err: any) => {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/gyms/${gymId}/stripe/connect`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/gyms/${gymId}/stripe/status`] });
      toast({ title: "Stripe disconnected" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/gyms/${gymId}/stripe/sync`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sync started", description: "Payment history import is running in the background." });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [`/api/gyms/${gymId}/stripe/status`] });
        queryClient.invalidateQueries({ queryKey: [`/api/gyms/${gymId}/stripe/sync-runs`] });
        queryClient.invalidateQueries({ queryKey: [`/api/gyms/${gymId}/stripe/debug`] });
      }, 5000);
    },
    onError: (err: any) => {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/gyms/${gymId}/settings`}>
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Stripe Billing Integration</h1>
          <p className="text-sm text-muted-foreground">Connect your Stripe account to import payment history.</p>
        </div>
      </div>

      {isDemoUser && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
            <p className="text-sm text-yellow-600 dark:text-yellow-400" data-testid="text-demo-warning">
              Stripe integration is disabled in demo mode.
            </p>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-stripe-connection">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {status?.connected ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <Badge variant="outline" className="border-green-500/50 text-green-600" data-testid="badge-connected">Connected</Badge>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-muted-foreground" />
                  <Badge variant="outline" className="text-muted-foreground" data-testid="badge-disconnected">Not Connected</Badge>
                </>
              )}
            </div>
            {status?.connected && !isDemoUser && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                data-testid="button-disconnect"
              >
                <Unplug className="w-3 h-3 mr-1" />
                Disconnect
              </Button>
            )}
          </div>

          {status?.connected && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">API Key</p>
                <p className="font-mono text-xs" data-testid="text-api-fingerprint">
                  <Shield className="w-3 h-3 inline mr-1" />
                  {status.apiKeyFingerprint}
                </p>
              </div>
              {status.stripeAccountId && (
                <div>
                  <p className="text-muted-foreground">Account ID</p>
                  <p className="font-mono text-xs" data-testid="text-account-id">{status.stripeAccountId}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Connected</p>
                <p data-testid="text-connected-at">
                  {status.connectedAt ? new Date(status.connectedAt).toLocaleDateString() : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Sync</p>
                <p data-testid="text-last-sync">
                  {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : "Never"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Records Imported</p>
                <p className="font-semibold" data-testid="text-records-synced">
                  <Database className="w-3 h-3 inline mr-1" />
                  {status.recordsSynced ?? 0}
                </p>
              </div>
              {status.lastErrorMessage && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Last Error</p>
                  <p className="text-red-500 text-xs" data-testid="text-last-error">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    {status.lastErrorMessage}
                  </p>
                </div>
              )}
            </div>
          )}

          {status?.connected && !isDemoUser && (
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="w-full"
              data-testid="button-sync"
            >
              {syncMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sync Payment History
            </Button>
          )}

          {!status?.connected && !isDemoUser && (
            <>
              {showApiKeyInput ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="stripe-key">Stripe Secret Key</Label>
                    <Input
                      id="stripe-key"
                      type="password"
                      placeholder="sk_live_... or sk_test_..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      data-testid="input-stripe-key"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Find your API key in{" "}
                      <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="text-primary underline">
                        Stripe Dashboard → Developers → API Keys
                        <ExternalLink className="w-3 h-3 inline ml-0.5" />
                      </a>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => connectMutation.mutate(apiKey)}
                      disabled={connectMutation.isPending || !apiKey.startsWith("sk_")}
                      data-testid="button-connect-confirm"
                    >
                      {connectMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CreditCard className="w-4 h-4 mr-2" />
                      )}
                      Connect
                    </Button>
                    <Button variant="outline" onClick={() => { setShowApiKeyInput(false); setApiKey(""); }} data-testid="button-connect-cancel">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button onClick={() => setShowApiKeyInput(true)} className="w-full" data-testid="button-connect-stripe">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Connect Stripe
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {status?.connected && syncRuns && syncRuns.length > 0 && (
        <Card data-testid="card-sync-history">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Sync History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Started</TableHead>
                    <TableHead className="text-xs">Duration</TableHead>
                    <TableHead className="text-xs">Invoices</TableHead>
                    <TableHead className="text-xs">Records</TableHead>
                    <TableHead className="text-xs">Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncRuns.map((run) => {
                    const duration = run.finishedAt
                      ? `${Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s`
                      : "—";
                    return (
                      <TableRow key={run.id} className="border-border/30" data-testid={`row-sync-${run.id}`}>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              run.status === "completed" ? "border-green-500/50 text-green-600" :
                              run.status === "running" ? "border-blue-500/50 text-blue-600" :
                              run.status === "completed_with_errors" ? "border-yellow-500/50 text-yellow-600" :
                              "border-red-500/50 text-red-600"
                            }
                          >
                            {run.status === "running" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                            {run.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(run.startedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs">{duration}</TableCell>
                        <TableCell className="text-xs">{run.invoicesFound}</TableCell>
                        <TableCell className="text-xs">{run.recordsCreated + run.recordsUpdated}</TableCell>
                        <TableCell className="text-xs">
                          {run.errorCount > 0 ? (
                            <span className="text-red-500">{run.errorCount}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Webhook Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            To receive real-time payment updates, configure a webhook in your Stripe Dashboard:
          </p>
          <div className="bg-muted/30 rounded-md p-3 space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Webhook URL</p>
              <code className="text-xs font-mono break-all" data-testid="text-webhook-url">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/api/stripe/billing-webhook/${gymId}`
                  : `/api/stripe/billing-webhook/${gymId}`}
              </code>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Events to subscribe</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {["invoice.paid", "invoice.payment_failed", "invoice.updated", "customer.subscription.updated", "customer.subscription.deleted"].map((evt) => (
                  <Badge key={evt} variant="secondary" className="text-xs font-mono">{evt}</Badge>
                ))}
              </div>
            </div>
          </div>
          <a
            href="https://dashboard.stripe.com/webhooks/create"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary underline inline-flex items-center gap-1"
          >
            Open Stripe Webhook Settings
            <ExternalLink className="w-3 h-3" />
          </a>
        </CardContent>
      </Card>

      {isAdmin && debugData && (
        <Card className="border-orange-500/30" data-testid="card-admin-debug">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bug className="w-4 h-4 text-orange-500" />
              Admin Debug Panel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Connection Status</p>
                <p className="font-mono text-xs">{debugData.connection?.status || "none"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Billing Records</p>
                <p className="font-semibold">{debugData.totalBillingRecords}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Sync</p>
                <p className="text-xs">{debugData.connection?.lastSyncAt ? new Date(debugData.connection.lastSyncAt).toLocaleString() : "Never"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Account ID</p>
                <p className="font-mono text-xs">{debugData.connection?.stripeAccountId || "—"}</p>
              </div>
            </div>

            {debugData.recentWebhookEvents.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Recent Webhook Activity</p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50">
                        <TableHead className="text-xs">Event</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {debugData.recentWebhookEvents.map((evt) => (
                        <TableRow key={evt.id} className="border-border/30">
                          <TableCell className="text-xs font-mono">{evt.stripeEventId.slice(0, 20)}...</TableCell>
                          <TableCell className="text-xs">{evt.eventType}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{evt.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(evt.processedAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {debugData.recentSyncRuns.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Sync Run Details</p>
                {debugData.recentSyncRuns.map((run) => (
                  <div key={run.id} className="bg-muted/20 rounded-md p-3 mb-2 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="font-mono">{run.id.slice(0, 8)}</span>
                      <Badge variant="outline" className="text-xs">{run.status}</Badge>
                    </div>
                    <p>Customers: {run.customersFound} | Subs: {run.subscriptionsFound} | Invoices: {run.invoicesFound} | Charges: {run.chargesFound} | Refunds: {run.refundsFound}</p>
                    <p>Created: {run.recordsCreated} | Updated: {run.recordsUpdated} | Errors: {run.errorCount}</p>
                    {run.errorDetails && (
                      <pre className="text-red-400 text-xs whitespace-pre-wrap mt-1">{run.errorDetails}</pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
