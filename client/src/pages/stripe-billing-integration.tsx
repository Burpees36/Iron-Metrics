import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getAuthHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Users,
  Search,
  Link2,
  Link2Off,
  EyeOff,
  Download,
  ListChecks,
  ArrowRight,
  CircleDot,
  FileText,
  BarChart3,
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
  recordsSkipped?: number;
  recordsFailed?: number;
  errorCount: number;
  errorDetails?: string;
  warningMessages?: string;
  syncWindowDays?: number;
  isDryRun?: boolean;
  dryRunSummary?: any;
}

interface MatchCounts {
  matched: number;
  unmatched: number;
  ambiguous: number;
  ignored: number;
  total: number;
}

interface CustomerMatch {
  id: string;
  stripeCustomerId: string;
  stripeCustomerEmail: string | null;
  stripeCustomerName: string | null;
  memberId: string | null;
  matchStatus: string;
  matchMethod: string;
  matchConfidence: number;
  notes: string | null;
}

interface DataQuality {
  connectionStatus: string;
  overallStatus: string;
  fallbackRecommendation: string;
  customerMatchCoverage: number;
  billingRecordCoverage: number;
  webhookSuccessRate: number | null;
  recordCount: number;
  matchCounts: MatchCounts;
  hasInvoices: boolean;
  hasCharges: boolean;
  hasRefunds: boolean;
  hasSubscriptions: boolean;
  partialAccessIssues: string[];
  fallbackNotes: string | null;
  lastSyncAt: string | null;
  lastWebhookAt: string | null;
  hasCompletedDryRun: boolean;
}

interface IntegrationEvent {
  id: string;
  eventType: string;
  details: any;
  createdAt: string;
  createdBy: string | null;
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

interface GymMember {
  id: string;
  name: string;
  email: string | null;
  status: string;
}

const PLATFORM_ADMIN_IDS = ["54700016"];

const SYNC_WINDOWS = [
  { value: "90", label: "Last 90 days" },
  { value: "180", label: "Last 180 days" },
  { value: "365", label: "Last 12 months" },
  { value: "all", label: "All available" },
];

function OnboardingChecklist({ gymId, status, dataQuality, syncRuns, matchCounts }: {
  gymId: string;
  status: StripeStatus | undefined;
  dataQuality: DataQuality | undefined;
  syncRuns: StripeSyncRun[] | undefined;
  matchCounts: MatchCounts | undefined;
}) {
  const hasDryRun = syncRuns?.some(r => r.isDryRun || r.runType === "dry_run");
  const hasLiveSync = syncRuns?.some(r => !r.isDryRun && r.runType !== "dry_run" && r.status !== "failed");
  const hasMatchingRun = (matchCounts?.total || 0) > 0;
  const isReady = dataQuality?.overallStatus === "ready";

  const steps = [
    { label: "Connect Stripe", done: !!status?.connected, description: "Link your Stripe API key" },
    { label: "Run dry-run sync", done: !!hasDryRun, description: "Preview what will be imported" },
    { label: "Review dry-run results", done: hasDryRun && !!hasLiveSync, description: "Confirm the data looks right" },
    { label: "Run live sync", done: !!hasLiveSync, description: "Import payment history" },
    { label: "Run member matching", done: !!hasMatchingRun, description: "Link Stripe customers to members" },
    { label: "Review matching results", done: hasMatchingRun && (matchCounts?.unmatched || 0) === 0 && (matchCounts?.ambiguous || 0) === 0, description: "Resolve unmatched records" },
    { label: "Confirm billing data readiness", done: isReady, description: "Data quality passes all checks" },
  ];

  const currentStep = steps.findIndex(s => !s.done);
  const nextAction = currentStep >= 0 ? steps[currentStep] : null;

  return (
    <Card data-testid="card-onboarding-checklist">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ListChecks className="w-4 h-4" />
          Billing Integration Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Iron Metrics combines Stripe payment outcomes with your member data to deliver billing intelligence.
        </p>

        <div className="space-y-2">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 p-2 rounded-md text-sm ${i === currentStep ? "bg-primary/5 border border-primary/20" : ""}`}
              data-testid={`step-${i}`}
            >
              {step.done ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              ) : i === currentStep ? (
                <CircleDot className="w-4 h-4 text-primary shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className={step.done ? "text-muted-foreground line-through" : ""}>{step.label}</span>
                {i === currentStep && (
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                )}
              </div>
              {step.done && <Badge variant="outline" className="text-xs border-green-500/50 text-green-600 shrink-0">Done</Badge>}
            </div>
          ))}
        </div>

        {nextAction && (
          <div className="bg-primary/5 border border-primary/20 rounded-md p-3 flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-primary shrink-0" />
            <p className="text-sm"><span className="font-medium">Next:</span> {nextAction.description}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MatchStatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; label: string }> = {
    auto_matched: { className: "border-green-500/50 text-green-600", label: "Auto-matched" },
    manually_matched: { className: "border-blue-500/50 text-blue-600", label: "Manual" },
    unmatched: { className: "border-red-500/50 text-red-600", label: "Unmatched" },
    ambiguous: { className: "border-yellow-500/50 text-yellow-600", label: "Ambiguous" },
    ignored: { className: "border-muted-foreground/50 text-muted-foreground", label: "Ignored" },
  };
  const c = config[status] || config.unmatched;
  return <Badge variant="outline" className={`text-xs ${c.className}`}>{c.label}</Badge>;
}

function SyncStatusBadge({ status }: { status: string }) {
  const className =
    status === "completed" ? "border-green-500/50 text-green-600" :
    status === "dry_run_completed" ? "border-blue-500/50 text-blue-600" :
    status === "running" ? "border-blue-500/50 text-blue-600" :
    status === "completed_with_errors" ? "border-yellow-500/50 text-yellow-600" :
    "border-red-500/50 text-red-600";
  return (
    <Badge variant="outline" className={className}>
      {status === "running" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export default function StripeBillingIntegration() {
  const { id: gymId } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { isDemo, user } = useAuth();
  const isDemoUser = isDemo;
  const [apiKey, setApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [syncWindow, setSyncWindow] = useState("365");
  const [matchFilter, setMatchFilter] = useState("all");
  const [matchSearch, setMatchSearch] = useState("");
  const [fallbackNotes, setFallbackNotes] = useState("");
  const [notesLoaded, setNotesLoaded] = useState(false);
  const isAdmin = user && PLATFORM_ADMIN_IDS.includes(user.id);

  const { data: status, isLoading } = useQuery<StripeStatus>({
    queryKey: ["/api/gyms", gymId, "stripe", "status"],
    enabled: !!gymId,
  });

  const { data: syncRuns } = useQuery<StripeSyncRun[]>({
    queryKey: ["/api/gyms", gymId, "stripe", "sync-runs"],
    enabled: !!gymId,
  });

  const { data: matchCounts } = useQuery<MatchCounts>({
    queryKey: ["/api/gyms", gymId, "stripe", "match-counts"],
    enabled: !!gymId,
  });

  const { data: matches } = useQuery<CustomerMatch[]>({
    queryKey: ["/api/gyms", gymId, "stripe", "matches", matchFilter, matchSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (matchFilter !== "all") params.set("status", matchFilter);
      if (matchSearch) params.set("search", matchSearch);
      const res = await fetch(`/api/gyms/${gymId}/stripe/matches?${params}`);
      if (!res.ok) throw new Error("Failed to fetch matches");
      return res.json();
    },
    enabled: !!gymId && (matchCounts?.total || 0) > 0,
  });

  const { data: dataQuality } = useQuery<DataQuality>({
    queryKey: ["/api/gyms", gymId, "stripe", "data-quality"],
    enabled: !!gymId,
  });

  const { data: events } = useQuery<IntegrationEvent[]>({
    queryKey: ["/api/gyms", gymId, "stripe", "events"],
    enabled: !!gymId,
  });

  const { data: members } = useQuery<GymMember[]>({
    queryKey: ["/api/gyms", gymId, "members"],
    enabled: !!gymId,
  });

  const { data: debugData } = useQuery<StripeDebugData>({
    queryKey: ["/api/gyms", gymId, "stripe", "debug"],
    enabled: !!gymId && !!isAdmin,
  });

  if (dataQuality && !notesLoaded) {
    setFallbackNotes(dataQuality.fallbackNotes || "");
    setNotesLoaded(true);
  }

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "stripe"] });
  };

  const connectMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest("POST", `/api/gyms/${gymId}/stripe/connect`, { apiKey: key });
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      setApiKey("");
      setShowApiKeyInput(false);
      toast({ title: "Stripe connected", description: "Run a dry-run sync to preview data before importing." });
    },
    onError: (err: any) => {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => { await apiRequest("DELETE", `/api/gyms/${gymId}/stripe/connect`); },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Stripe disconnected" });
    },
  });

  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [pendingSyncOpts, setPendingSyncOpts] = useState<{ windowDays?: number } | null>(null);

  const syncMutation = useMutation({
    mutationFn: async (opts: { dryRun?: boolean; windowDays?: number; confirmFirstSync?: boolean }) => {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/gyms/${gymId}/stripe/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        credentials: "include",
        body: JSON.stringify(opts),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.requiresConfirmation) {
          return { ...data, _confirmation: true, _windowDays: opts.windowDays };
        }
        throw new Error(data.message || "Sync failed");
      }
      return data;
    },
    onSuccess: (data, variables) => {
      if (data._confirmation) {
        setPendingSyncOpts({ windowDays: data._windowDays });
        setShowSyncConfirm(true);
        return;
      }
      if (variables.dryRun) {
        toast({ title: "Dry run completed", description: "Review the results below before running a live sync." });
        invalidateAll();
      } else {
        toast({ title: "Sync started", description: "Payment history import is running in the background." });
        setTimeout(invalidateAll, 5000);
      }
    },
    onError: (err: any) => {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    },
  });

  const matchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/gyms/${gymId}/stripe/run-matching`);
      return res.json();
    },
    onSuccess: (data) => {
      invalidateAll();
      toast({ title: "Matching completed", description: `${data.matched} matched, ${data.ambiguous} ambiguous, ${data.unmatched} unmatched` });
    },
    onError: (err: any) => {
      toast({ title: "Matching failed", description: err.message, variant: "destructive" });
    },
  });

  const rerunMatchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/gyms/${gymId}/stripe/rerun-matching`);
      return res.json();
    },
    onSuccess: (data) => {
      invalidateAll();
      toast({ title: "Re-matching completed", description: `${data.matched} matched, ${data.ambiguous} ambiguous, ${data.unmatched} unmatched` });
    },
  });

  const manualMatchMutation = useMutation({
    mutationFn: async ({ matchId, memberId }: { matchId: string; memberId: string }) => {
      await apiRequest("POST", `/api/gyms/${gymId}/stripe/matches/${matchId}/manual-match`, { memberId });
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Member matched" });
    },
  });

  const unmatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      await apiRequest("POST", `/api/gyms/${gymId}/stripe/matches/${matchId}/unmatch`);
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Record unmatched" });
    },
  });

  const ignoreMutation = useMutation({
    mutationFn: async (matchId: string) => {
      await apiRequest("POST", `/api/gyms/${gymId}/stripe/matches/${matchId}/ignore`);
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Record ignored" });
    },
  });

  const notesMutation = useMutation({
    mutationFn: async (notes: string) => {
      await apiRequest("PATCH", `/api/gyms/${gymId}/stripe/fallback-notes`, { notes });
    },
    onSuccess: () => {
      toast({ title: "Notes saved" });
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

  const windowDays = syncWindow === "all" ? undefined : Number(syncWindow);
  const latestDryRun = syncRuns?.find(r => r.isDryRun || r.runType === "dry_run");
  const hasDryRun = !!latestDryRun;

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
          <p className="text-sm text-muted-foreground">Connect your Stripe account to import payment history and enable billing intelligence.</p>
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

      <OnboardingChecklist gymId={gymId!} status={status} dataQuality={dataQuality} syncRuns={syncRuns} matchCounts={matchCounts} />

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
              <Button variant="outline" size="sm" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending} data-testid="button-disconnect">
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
                <p data-testid="text-connected-at">{status.connectedAt ? new Date(status.connectedAt).toLocaleDateString() : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Sync</p>
                <p data-testid="text-last-sync">{status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : "Never"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Records Imported</p>
                <p className="font-semibold" data-testid="text-records-synced">
                  <Database className="w-3 h-3 inline mr-1" />{status.recordsSynced ?? 0}
                </p>
              </div>
              {status.lastErrorMessage && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Last Error</p>
                  <p className="text-red-500 text-xs" data-testid="text-last-error">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />{status.lastErrorMessage}
                  </p>
                </div>
              )}
            </div>
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
                    <Button onClick={() => connectMutation.mutate(apiKey)} disabled={connectMutation.isPending || !apiKey.startsWith("sk_")} data-testid="button-connect-confirm">
                      {connectMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                      Connect
                    </Button>
                    <Button variant="outline" onClick={() => { setShowApiKeyInput(false); setApiKey(""); }} data-testid="button-connect-cancel">Cancel</Button>
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

      {status?.connected && !isDemoUser && (
        <Card data-testid="card-sync-controls">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Sync Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Sync Window</Label>
                <Select value={syncWindow} onValueChange={setSyncWindow}>
                  <SelectTrigger className="mt-1" data-testid="select-sync-window">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SYNC_WINDOWS.map(w => (
                      <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => syncMutation.mutate({ dryRun: true, windowDays })}
                disabled={syncMutation.isPending}
                className="flex-1"
                data-testid="button-dry-run"
              >
                {syncMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                Run Dry Run
              </Button>
              <Button
                onClick={() => syncMutation.mutate({ windowDays })}
                disabled={syncMutation.isPending || !dataQuality?.hasCompletedDryRun}
                className="flex-1"
                data-testid="button-live-sync"
                title={!dataQuality?.hasCompletedDryRun ? "Run a dry run first to preview data" : undefined}
              >
                {syncMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Run Live Sync
              </Button>
            </div>

            {showSyncConfirm && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3 space-y-2" data-testid="sync-confirmation">
                <p className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  First Live Sync Confirmation
                </p>
                <p className="text-xs text-muted-foreground">
                  This will import payment records into your gym's billing data. This action creates new records based on your Stripe account data.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setShowSyncConfirm(false);
                      syncMutation.mutate({ ...pendingSyncOpts, confirmFirstSync: true });
                    }}
                    disabled={syncMutation.isPending}
                    data-testid="button-confirm-sync"
                  >
                    Confirm & Sync
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setShowSyncConfirm(false); setPendingSyncOpts(null); }}
                    data-testid="button-cancel-sync"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {latestDryRun?.dryRunSummary && (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-md p-3 space-y-2" data-testid="dry-run-results">
                <p className="text-sm font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  Dry Run Results
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Customers:</span> {latestDryRun.dryRunSummary.customersFound}</div>
                  <div><span className="text-muted-foreground">Subscriptions:</span> {latestDryRun.dryRunSummary.subscriptionsFound}</div>
                  <div><span className="text-muted-foreground">Invoices:</span> {latestDryRun.dryRunSummary.invoicesFound}</div>
                  <div><span className="text-muted-foreground">Charges:</span> {latestDryRun.dryRunSummary.chargesFound}</div>
                  <div><span className="text-muted-foreground">Refunds:</span> {latestDryRun.dryRunSummary.refundsFound}</div>
                  <div><span className="text-muted-foreground">Est. New Records:</span> {latestDryRun.dryRunSummary.estimatedNewRecords}</div>
                </div>
                {latestDryRun.dryRunSummary.warnings?.length > 0 && (
                  <div className="space-y-1">
                    {latestDryRun.dryRunSummary.warnings.map((w: string, i: number) => (
                      <p key={i} className="text-xs text-yellow-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />{w}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {syncRuns && syncRuns.length > 0 && (
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
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Started</TableHead>
                    <TableHead className="text-xs">Window</TableHead>
                    <TableHead className="text-xs">Records</TableHead>
                    <TableHead className="text-xs">Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncRuns.map((run) => (
                    <TableRow key={run.id} className="border-border/30" data-testid={`row-sync-${run.id}`}>
                      <TableCell className="text-xs">
                        <Badge variant="secondary" className="text-xs">
                          {run.isDryRun || run.runType === "dry_run" ? "Dry Run" : "Live"}
                        </Badge>
                      </TableCell>
                      <TableCell><SyncStatusBadge status={run.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{run.syncWindowDays ? `${run.syncWindowDays}d` : "All"}</TableCell>
                      <TableCell className="text-xs">
                        {run.isDryRun || run.runType === "dry_run"
                          ? `~${run.invoicesFound} inv`
                          : `${run.recordsCreated}↑ ${run.recordsUpdated}↻`
                        }
                      </TableCell>
                      <TableCell className="text-xs">
                        {run.errorCount > 0 ? <span className="text-red-500">{run.errorCount}</span> : <span className="text-muted-foreground">0</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {status?.connected && (
        <Card data-testid="card-member-matching">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Member Matching
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {matchCounts && matchCounts.total > 0 ? (
              <>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="bg-green-500/5 border border-green-500/20 rounded-md p-2">
                    <p className="text-lg font-semibold text-green-600" data-testid="text-matched-count">{matchCounts.matched}</p>
                    <p className="text-xs text-muted-foreground">Matched</p>
                  </div>
                  <div className="bg-red-500/5 border border-red-500/20 rounded-md p-2">
                    <p className="text-lg font-semibold text-red-600" data-testid="text-unmatched-count">{matchCounts.unmatched}</p>
                    <p className="text-xs text-muted-foreground">Unmatched</p>
                  </div>
                  <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-md p-2">
                    <p className="text-lg font-semibold text-yellow-600" data-testid="text-ambiguous-count">{matchCounts.ambiguous}</p>
                    <p className="text-xs text-muted-foreground">Ambiguous</p>
                  </div>
                  <div className="bg-muted/30 rounded-md p-2">
                    <p className="text-lg font-semibold text-muted-foreground" data-testid="text-ignored-count">{matchCounts.ignored}</p>
                    <p className="text-xs text-muted-foreground">Ignored</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or email..."
                        value={matchSearch}
                        onChange={(e) => setMatchSearch(e.target.value)}
                        className="pl-8 h-9 text-sm"
                        data-testid="input-match-search"
                      />
                    </div>
                  </div>
                  <Select value={matchFilter} onValueChange={setMatchFilter}>
                    <SelectTrigger className="w-36 h-9" data-testid="select-match-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="unmatched">Unmatched</SelectItem>
                      <SelectItem value="ambiguous">Ambiguous</SelectItem>
                      <SelectItem value="auto_matched">Auto-matched</SelectItem>
                      <SelectItem value="manually_matched">Manual</SelectItem>
                      <SelectItem value="ignored">Ignored</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {matches && matches.length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/50">
                          <TableHead className="text-xs">Stripe Customer</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Confidence</TableHead>
                          <TableHead className="text-xs">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {matches.map((m) => (
                          <TableRow key={m.id} className="border-border/30" data-testid={`row-match-${m.id}`}>
                            <TableCell>
                              <p className="text-sm font-medium">{m.stripeCustomerName || "—"}</p>
                              <p className="text-xs text-muted-foreground">{m.stripeCustomerEmail || m.stripeCustomerId}</p>
                              {m.notes && <p className="text-xs text-yellow-600 mt-0.5">{m.notes}</p>}
                            </TableCell>
                            <TableCell><MatchStatusBadge status={m.matchStatus} /></TableCell>
                            <TableCell className="text-xs">{m.matchConfidence}%</TableCell>
                            <TableCell>
                              {!isDemoUser && (m.matchStatus === "unmatched" || m.matchStatus === "ambiguous") && (
                                <div className="flex items-center gap-1">
                                  <Select
                                    onValueChange={(memberId) => manualMatchMutation.mutate({ matchId: m.id, memberId })}
                                  >
                                    <SelectTrigger className="h-7 text-xs w-32" data-testid={`select-manual-match-${m.id}`}>
                                      <SelectValue placeholder="Match to..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(members || []).filter(mb => mb.status === "active").slice(0, 50).map(mb => (
                                        <SelectItem key={mb.id} value={mb.id}>
                                          {mb.name} {mb.email ? `(${mb.email})` : ""}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => ignoreMutation.mutate(m.id)}
                                    title="Ignore"
                                    data-testid={`button-ignore-${m.id}`}
                                  >
                                    <EyeOff className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                              {!isDemoUser && (m.matchStatus === "auto_matched" || m.matchStatus === "manually_matched") && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => unmatchMutation.mutate(m.id)}
                                  data-testid={`button-unmatch-${m.id}`}
                                >
                                  <Link2Off className="w-3 h-3 mr-1" />Unmatch
                                </Button>
                              )}
                              {!isDemoUser && m.matchStatus === "ignored" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => unmatchMutation.mutate(m.id)}
                                  data-testid={`button-unignore-${m.id}`}
                                >
                                  Restore
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No matching data yet. Run a sync first, then run auto-matching.</p>
            )}

            {!isDemoUser && status?.connected && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => matchMutation.mutate()}
                  disabled={matchMutation.isPending || (status.recordsSynced || 0) === 0}
                  data-testid="button-run-matching"
                >
                  {matchMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                  Run Auto-Matching
                </Button>
                {matchCounts && matchCounts.total > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => rerunMatchMutation.mutate()}
                    disabled={rerunMatchMutation.isPending}
                    data-testid="button-rerun-matching"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Re-run Matching
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {dataQuality && (
        <Card data-testid="card-data-quality">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Billing Data Readiness
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant="outline"
                className={
                  dataQuality.overallStatus === "ready" ? "border-green-500/50 text-green-600" :
                  dataQuality.overallStatus === "needs_matching_review" ? "border-yellow-500/50 text-yellow-600" :
                  dataQuality.overallStatus === "partial_data" ? "border-orange-500/50 text-orange-600" :
                  "border-muted-foreground/50 text-muted-foreground"
                }
                data-testid="badge-overall-status"
              >
                {dataQuality.overallStatus.replace(/_/g, " ")}
              </Badge>
              <Badge
                variant="outline"
                className={
                  dataQuality.fallbackRecommendation === "direct_sync_usable" ? "border-green-500/50 text-green-600" :
                  dataQuality.fallbackRecommendation === "direct_sync_partially_usable" ? "border-yellow-500/50 text-yellow-600" :
                  "border-red-500/50 text-red-600"
                }
                data-testid="badge-fallback-recommendation"
              >
                {dataQuality.fallbackRecommendation.replace(/_/g, " ")}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ReadinessBlock label="Connection" ok={dataQuality.connectionStatus === "connected"} detail={dataQuality.connectionStatus} />
              <ReadinessBlock label="Payment History" ok={dataQuality.recordCount > 0} detail={`${dataQuality.recordCount} records`} />
              <ReadinessBlock label="Customer Match" ok={dataQuality.customerMatchCoverage >= 80} detail={`${dataQuality.customerMatchCoverage}% of customers`} />
              <ReadinessBlock label="Billing Coverage" ok={dataQuality.billingRecordCoverage >= 80} detail={`${dataQuality.billingRecordCoverage}% of records`} />
              <ReadinessBlock label="Invoices" ok={dataQuality.hasInvoices} detail={dataQuality.hasInvoices ? "Available" : "Missing"} />
              <ReadinessBlock label="Refunds" ok={dataQuality.hasRefunds} detail={dataQuality.hasRefunds ? "Available" : "Not found"} />
              <ReadinessBlock label="Webhooks" ok={(dataQuality.webhookSuccessRate ?? 0) >= 80} detail={dataQuality.webhookSuccessRate !== null ? `${dataQuality.webhookSuccessRate}% success` : "No events"} />
            </div>

            {dataQuality.partialAccessIssues.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-orange-600">Partial Access Warnings</p>
                {dataQuality.partialAccessIssues.map((issue, i) => (
                  <p key={i} className="text-xs text-orange-600 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{issue}
                  </p>
                ))}
              </div>
            )}

            {!isDemoUser && status?.connected && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Internal Notes (why fallback may be needed)</Label>
                <Textarea
                  value={fallbackNotes}
                  onChange={(e) => setFallbackNotes(e.target.value)}
                  placeholder="e.g., 'Gym uses PaySimple for some members, Stripe only covers online signups'"
                  rows={2}
                  className="text-sm"
                  data-testid="textarea-fallback-notes"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => notesMutation.mutate(fallbackNotes)}
                  disabled={notesMutation.isPending}
                  data-testid="button-save-notes"
                >
                  Save Notes
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {events && events.length > 0 && (
        <Card data-testid="card-integration-timeline">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Integration Timeline
              </CardTitle>
              {isAdmin && (
                <a
                  href={`/api/gyms/${gymId}/stripe/admin-summary`}
                  download
                  className="text-xs text-primary underline flex items-center gap-1"
                  data-testid="link-download-summary"
                >
                  <Download className="w-3 h-3" />
                  Download Summary
                </a>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30 max-h-64 overflow-y-auto">
              {events.slice(0, 20).map((evt) => (
                <div key={evt.id} className="px-4 py-2 flex items-center gap-3 text-sm" data-testid={`event-${evt.id}`}>
                  <div className="w-2 h-2 rounded-full bg-primary/50 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-xs">{evt.eventType.replace(/_/g, " ")}</span>
                    {evt.details && typeof evt.details === "object" && Object.keys(evt.details).length > 0 && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {Object.entries(evt.details).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(", ")}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{new Date(evt.createdAt).toLocaleString()}</span>
                </div>
              ))}
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
                {typeof window !== "undefined" ? `${window.location.origin}/api/stripe/billing-webhook/${gymId}` : `/api/stripe/billing-webhook/${gymId}`}
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
          <a href="https://dashboard.stripe.com/webhooks/create" target="_blank" rel="noreferrer" className="text-sm text-primary underline inline-flex items-center gap-1">
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
                          <TableCell><Badge variant="outline" className="text-xs">{evt.status}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(evt.processedAt).toLocaleString()}</TableCell>
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
                      <SyncStatusBadge status={run.status} />
                    </div>
                    <p>Customers: {run.customersFound} | Subs: {run.subscriptionsFound} | Invoices: {run.invoicesFound} | Charges: {run.chargesFound} | Refunds: {run.refundsFound}</p>
                    <p>Created: {run.recordsCreated} | Updated: {run.recordsUpdated} | Skipped: {run.recordsSkipped || 0} | Failed: {run.recordsFailed || 0} | Errors: {run.errorCount}</p>
                    {run.warningMessages && <p className="text-yellow-500">{run.warningMessages}</p>}
                    {run.errorDetails && <pre className="text-red-400 text-xs whitespace-pre-wrap mt-1">{run.errorDetails}</pre>}
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

function ReadinessBlock({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className={`rounded-md p-2 border text-center ${ok ? "border-green-500/20 bg-green-500/5" : "border-orange-500/20 bg-orange-500/5"}`}>
      <div className="flex items-center justify-center gap-1 mb-1">
        {ok ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <AlertTriangle className="w-3 h-3 text-orange-500" />}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
