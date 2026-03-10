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
  AlertCircle,
  Info,
  Copy,
  Clipboard,
  Lightbulb,
  Sparkles,
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

type OnboardingPhase =
  | "not_connected"
  | "connected_no_dry_run"
  | "dry_run_done"
  | "live_sync_done_unmatched"
  | "ready"
  | "blocked";

function getOnboardingPhase(
  status: StripeStatus | undefined,
  dataQuality: DataQuality | undefined,
  syncRuns: StripeSyncRun[] | undefined,
  matchCounts: MatchCounts | undefined,
  blockingIssues: string[]
): OnboardingPhase {
  if (!status?.connected) return "not_connected";
  if (blockingIssues.length > 0) return "blocked";

  const hasDryRun = dataQuality?.hasCompletedDryRun ||
    syncRuns?.some(r => r.isDryRun || r.runType === "dry_run");
  const hasLiveSync = syncRuns?.some(r =>
    !r.isDryRun && r.runType !== "dry_run" && (r.status === "completed" || r.status === "completed_with_errors")
  );

  if (!hasDryRun) return "connected_no_dry_run";
  if (!hasLiveSync) return "dry_run_done";

  const hasUnresolved = (matchCounts?.unmatched || 0) > 0 || (matchCounts?.ambiguous || 0) > 0;
  if (hasUnresolved || (dataQuality?.customerMatchCoverage ?? 0) < 80) return "live_sync_done_unmatched";

  return "ready";
}

function getBlockingIssues(
  status: StripeStatus | undefined,
  dataQuality: DataQuality | undefined,
  syncRuns: StripeSyncRun[] | undefined,
  events: IntegrationEvent[] | undefined
): string[] {
  const issues: string[] = [];
  if (!status?.connected) return issues;

  const liveSyncs = (syncRuns || [])
    .filter(r => !r.isDryRun && r.runType !== "dry_run")
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  const latestLiveSync = liveSyncs[0];
  if (latestLiveSync && latestLiveSync.status === "failed") {
    issues.push("The most recent import failed. Review sync history for details and try again.");
  }
  const hasLiveSync = syncRuns?.some(r =>
    !r.isDryRun && r.runType !== "dry_run" && (r.status === "completed" || r.status === "completed_with_errors")
  );
  if (hasLiveSync && (dataQuality?.recordCount ?? 0) === 0) {
    issues.push("Live sync completed but no billing records were imported. Verify your Stripe account has payment history.");
  }
  const recentWebhookFailures = events?.filter(e =>
    e.eventType === "webhook_failure" &&
    new Date(e.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  ) || [];
  if (recentWebhookFailures.length >= 3) {
    issues.push(`${recentWebhookFailures.length} webhook failures in the last 24 hours. Check your Stripe webhook configuration.`);
  }
  if (status?.lastErrorMessage && status.lastErrorAt) {
    const errorAge = Date.now() - new Date(status.lastErrorAt).getTime();
    if (errorAge < 48 * 60 * 60 * 1000) {
      issues.push(`Recent error: ${status.lastErrorMessage}`);
    }
  }
  return issues;
}

const PHASE_CONFIG: Record<OnboardingPhase, { title: string; description: string; action: string; variant: "default" | "info" | "warning" | "success" | "destructive" }> = {
  not_connected: {
    title: "Stripe Not Connected",
    description: "Connect your Stripe account to begin importing payment history. Iron Metrics uses your billing data to generate retention and revenue intelligence.",
    action: "Connect your Stripe API key to get started.",
    variant: "default",
  },
  connected_no_dry_run: {
    title: "Connection Established — Run a Preview",
    description: "Your Stripe account is connected. Before importing data, run a dry run to preview what will be imported. This does not create any records.",
    action: "Run a dry run to preview your Stripe data.",
    variant: "info",
  },
  dry_run_done: {
    title: "Preview Complete — Ready for Import",
    description: "Your dry run is complete. Review the results above, then run a live sync to import your payment history into Iron Metrics.",
    action: "Run a live sync to import payment records.",
    variant: "info",
  },
  live_sync_done_unmatched: {
    title: "Payment Data Imported — Matching Needed",
    description: "Payment records have been imported. Some Stripe customers have not been matched to your gym members. Review and resolve unmatched records to ensure accurate billing intelligence.",
    action: "Review and resolve unmatched billing records.",
    variant: "warning",
  },
  ready: {
    title: "Billing Setup Complete",
    description: "Your Stripe integration is fully configured. Payment data is imported and customer records are matched. Billing intelligence is active.",
    action: "Billing setup is ready. No action needed.",
    variant: "success",
  },
  blocked: {
    title: "Setup Blocked — Action Required",
    description: "One or more issues are preventing the billing integration from functioning correctly. Review the blocking issues below and resolve them to continue.",
    action: "Resolve blocking issues before proceeding.",
    variant: "destructive",
  },
};

function OnboardingStatusBanner({ phase }: { phase: OnboardingPhase }) {
  const config = PHASE_CONFIG[phase];
  const bgClass =
    config.variant === "success" ? "bg-green-500/5 border-green-500/30" :
    config.variant === "destructive" ? "bg-red-500/5 border-red-500/30" :
    config.variant === "warning" ? "bg-yellow-500/5 border-yellow-500/30" :
    config.variant === "info" ? "bg-blue-500/5 border-blue-500/30" :
    "bg-muted/30 border-border";
  const iconClass =
    config.variant === "success" ? "text-green-500" :
    config.variant === "destructive" ? "text-red-500" :
    config.variant === "warning" ? "text-yellow-500" :
    config.variant === "info" ? "text-blue-500" :
    "text-muted-foreground";
  const Icon =
    config.variant === "success" ? CheckCircle2 :
    config.variant === "destructive" ? AlertCircle :
    config.variant === "warning" ? AlertTriangle :
    Info;

  return (
    <Card className={`border ${bgClass}`} data-testid="card-onboarding-status">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start gap-3">
          <Icon className={`w-5 h-5 ${iconClass} shrink-0 mt-0.5`} />
          <div className="space-y-1">
            <p className="font-medium text-sm" data-testid="text-onboarding-title">{config.title}</p>
            <p className="text-sm text-muted-foreground" data-testid="text-onboarding-description">{config.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-8">
          <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />
          <p className="text-sm font-medium text-primary" data-testid="text-onboarding-action">{config.action}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function BlockingIssuesBanner({ issues }: { issues: string[] }) {
  if (issues.length === 0) return null;
  return (
    <Card className="border-red-500/40 bg-red-500/5" data-testid="card-blocking-issues">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">Blocking Issues</p>
        </div>
        <div className="space-y-1.5 ml-6">
          {issues.map((issue, i) => (
            <p key={i} className="text-sm text-red-600 dark:text-red-400 flex items-start gap-2" data-testid={`text-blocking-issue-${i}`}>
              <span className="shrink-0 mt-1">•</span>
              <span>{issue}</span>
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function OnboardingSummaryCard({
  status,
  dataQuality,
  syncRuns,
  matchCounts,
  phase,
  blockingIssues,
}: {
  status: StripeStatus | undefined;
  dataQuality: DataQuality | undefined;
  syncRuns: StripeSyncRun[] | undefined;
  matchCounts: MatchCounts | undefined;
  phase: OnboardingPhase;
  blockingIssues: string[];
}) {
  const isReady = phase === "ready";
  const hasLiveSync = syncRuns?.some(r =>
    !r.isDryRun && r.runType !== "dry_run" && (r.status === "completed" || r.status === "completed_with_errors")
  );

  return (
    <Card data-testid="card-onboarding-summary">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Billing Readiness Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
            <div className="flex items-center gap-1.5">
              {isReady ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : blockingIssues.length > 0 ? (
                <AlertCircle className="w-4 h-4 text-red-500" />
              ) : (
                <Clock className="w-4 h-4 text-yellow-500" />
              )}
              <span className={`text-sm font-semibold ${isReady ? "text-green-600" : blockingIssues.length > 0 ? "text-red-600" : "text-yellow-600"}`} data-testid="text-summary-status">
                {isReady ? "Ready" : blockingIssues.length > 0 ? "Blocked" : "In Progress"}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Records Imported</p>
            <p className="text-sm font-semibold" data-testid="text-summary-records">
              {hasLiveSync ? (dataQuality?.recordCount ?? status?.recordsSynced ?? 0).toLocaleString() : "—"}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Customer Match</p>
            <p className="text-sm font-semibold" data-testid="text-summary-customer-match">
              {(matchCounts?.total || 0) > 0 ? `${dataQuality?.customerMatchCoverage ?? 0}%` : "—"}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Billing Coverage</p>
            <p className="text-sm font-semibold" data-testid="text-summary-billing-coverage">
              {(dataQuality?.recordCount || 0) > 0 ? `${dataQuality?.billingRecordCoverage ?? 0}%` : "—"}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Blocking Issues</p>
            <p className={`text-sm font-semibold ${blockingIssues.length > 0 ? "text-red-600" : "text-green-600"}`} data-testid="text-summary-blockers">
              {blockingIssues.length > 0 ? `${blockingIssues.length} issue${blockingIssues.length > 1 ? "s" : ""}` : "None"}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Next Action</p>
            <p className="text-sm font-medium text-primary" data-testid="text-summary-next-action">
              {PHASE_CONFIG[phase].action.split(".")[0]}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OnboardingChecklist({ gymId, status, dataQuality, syncRuns, matchCounts, events }: {
  gymId: string;
  status: StripeStatus | undefined;
  dataQuality: DataQuality | undefined;
  syncRuns: StripeSyncRun[] | undefined;
  matchCounts: MatchCounts | undefined;
  events: IntegrationEvent[] | undefined;
}) {
  const hasDryRun = dataQuality?.hasCompletedDryRun ||
    syncRuns?.some(r => r.isDryRun || r.runType === "dry_run");
  const hasLiveSync = syncRuns?.some(r =>
    !r.isDryRun && r.runType !== "dry_run" && (r.status === "completed" || r.status === "completed_with_errors")
  );
  const hasRecords = (dataQuality?.recordCount || 0) > 0 || (status?.recordsSynced || 0) > 0;
  const hasMatchingRun = (matchCounts?.total || 0) > 0;
  const customerCoverageOk = (dataQuality?.customerMatchCoverage ?? 0) >= 80;
  const billingCoverageOk = (dataQuality?.billingRecordCoverage ?? 0) >= 80;
  const blockingIssues = getBlockingIssues(status, dataQuality, syncRuns, events);
  const noBlockers = blockingIssues.length === 0;

  const steps = [
    { label: "Connect Stripe account", done: !!status?.connected, description: "Provide your Stripe API key to establish a secure connection." },
    { label: "Run a dry run", done: !!hasDryRun, description: "Preview the data that will be imported without making changes." },
    { label: "Complete first live sync", done: !!hasLiveSync, description: "Import your payment history into Iron Metrics." },
    { label: "Verify billing records imported", done: hasRecords && !!hasLiveSync, description: "Confirm that payment records were successfully imported." },
    { label: "Review customer match coverage", done: hasMatchingRun && customerCoverageOk, description: "Ensure most Stripe customers are linked to gym members." },
    { label: "Review billing record coverage", done: hasMatchingRun && billingCoverageOk, description: "Ensure most billing records are associated with known members." },
    { label: "No blocking errors", done: !!status?.connected && noBlockers, description: "All setup checks pass with no critical issues." },
  ];

  const completedCount = steps.filter(s => s.done).length;
  const currentStep = steps.findIndex(s => !s.done);
  const nextAction = currentStep >= 0 ? steps[currentStep] : null;

  return (
    <Card data-testid="card-onboarding-checklist">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="w-4 h-4" />
            Setup Checklist
          </CardTitle>
          <Badge variant="outline" className="text-xs" data-testid="badge-checklist-progress">
            {completedCount} of {steps.length} complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${i === currentStep ? "bg-primary/5 border border-primary/20" : ""}`}
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
                <span className={step.done ? "text-muted-foreground" : ""}>{step.label}</span>
                {i === currentStep && (
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                )}
              </div>
              {step.done && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}
            </div>
          ))}
        </div>

        {nextAction && (
          <div className="bg-primary/5 border border-primary/20 rounded-md p-3 flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-primary shrink-0" />
            <p className="text-sm"><span className="font-medium">Next step:</span> {nextAction.description}</p>
          </div>
        )}

        {completedCount === steps.length && (
          <div className="bg-green-500/5 border border-green-500/20 rounded-md p-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            <p className="text-sm font-medium text-green-600">All setup steps are complete. Billing intelligence is active.</p>
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
  const label =
    status === "completed" ? "Completed" :
    status === "dry_run_completed" ? "Preview Complete" :
    status === "running" ? "Running" :
    status === "completed_with_errors" ? "Completed with Errors" :
    status === "failed" ? "Failed" :
    status.replace(/_/g, " ");

  const className =
    status === "completed" ? "border-green-500/50 text-green-600" :
    status === "dry_run_completed" ? "border-blue-500/50 text-blue-600" :
    status === "running" ? "border-blue-500/50 text-blue-600" :
    status === "completed_with_errors" ? "border-yellow-500/50 text-yellow-600" :
    "border-red-500/50 text-red-600";
  return (
    <Badge variant="outline" className={className}>
      {status === "running" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
      {label}
    </Badge>
  );
}

function ReadinessBlock({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className={`rounded-md p-2.5 border text-center ${ok ? "border-green-500/20 bg-green-500/5" : "border-orange-500/20 bg-orange-500/5"}`}>
      <div className="flex items-center justify-center gap-1.5 mb-1">
        {ok ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <AlertTriangle className="w-3 h-3 text-orange-500" />}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function getSyncOutcome(run: StripeSyncRun): "success" | "partial" | "failed" {
  if (run.status === "failed") return "failed";
  if (run.status === "completed_with_errors" || run.errorCount > 0) return "partial";
  if (run.status === "completed" || run.status === "dry_run_completed") return "success";
  return "partial";
}

function getPartialAccessDiagnostics(run: StripeSyncRun): string[] {
  const diagnostics: string[] = [];
  if (run.customersFound > 0 && run.invoicesFound === 0 && run.chargesFound === 0) {
    diagnostics.push("Customers were retrieved but no invoices or charges were returned. Your Stripe API key may not have read access to payment data.");
  }
  if (run.invoicesFound > 0 && run.chargesFound === 0) {
    diagnostics.push("Invoices are accessible but charges were not returned. Some payment details may be incomplete.");
  }
  if (run.chargesFound > 0 && run.invoicesFound === 0) {
    diagnostics.push("Charges are accessible but invoices were not returned. Subscription billing details may be limited.");
  }
  if ((run.invoicesFound > 0 || run.chargesFound > 0) && run.refundsFound === 0) {
    diagnostics.push("No refund data was returned. Refund tracking will not be available unless your API key has refund read access.");
  }
  if ((run.invoicesFound > 0 || run.chargesFound > 0) && run.subscriptionsFound === 0) {
    diagnostics.push("No subscription data was returned. Recurring billing analysis may be limited.");
  }
  if (run.customersFound === 0) {
    diagnostics.push("No customers were found in your Stripe account for the selected time range. Try expanding the sync window or verify your API key permissions.");
  }
  return diagnostics;
}

function getTroubleshootingGuidance(
  run: StripeSyncRun | undefined,
  status: StripeStatus | undefined,
  matchCounts: MatchCounts | undefined,
  dataQuality: DataQuality | undefined,
  events: IntegrationEvent[] | undefined
): Array<{ scenario: string; guidance: string }> {
  const tips: Array<{ scenario: string; guidance: string }> = [];

  if (status?.connected && run && run.customersFound === 0) {
    tips.push({
      scenario: "No data returned from Stripe",
      guidance: "Verify your Stripe API key has read access to customers, invoices, and charges. Try expanding the sync window to include older records."
    });
  }

  const isRunDryRun = run && (run.isDryRun || run.runType === "dry_run");
  if (isRunDryRun && run.status !== "failed") {
    if (run.invoicesFound > 0 || run.chargesFound > 0) {
      tips.push({
        scenario: "Preview shows data — ready to import",
        guidance: "Your dry run found records. Run a live sync to import this data into Iron Metrics."
      });
    }
  }

  if (run && !run.isDryRun && run.status === "completed" && run.recordsCreated === 0 && run.recordsUpdated === 0) {
    tips.push({
      scenario: "Import completed but no new records created",
      guidance: "This can happen if all records were already imported from a previous sync, or if the selected time range has no billable events. Try a wider sync window."
    });
  }

  if ((matchCounts?.unmatched || 0) > 10) {
    tips.push({
      scenario: "Many unmatched records",
      guidance: "Import your full member roster before running auto-matching. For remaining unmatched records, use manual matching or mark them as ignored if they are not gym members."
    });
  }

  const recentWebhookFailures = events?.filter(e =>
    e.eventType === "webhook_failure" &&
    new Date(e.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  ) || [];
  if (recentWebhookFailures.length > 0) {
    tips.push({
      scenario: "Recent webhook failures",
      guidance: "Check your Stripe webhook configuration. Ensure the endpoint URL is correct and your signing secret matches. Review the activity log for error details."
    });
  }

  if (run && getPartialAccessDiagnostics(run).length > 0) {
    tips.push({
      scenario: "Partial Stripe data access",
      guidance: "Your API key may have limited permissions. In Stripe Dashboard, verify the key has read access to Customers, Charges, Invoices, Subscriptions, and Refunds."
    });
  }

  if (status?.connected && (status.recordsSynced || 0) > 0 &&
      (matchCounts?.total || 0) > 0 &&
      ((matchCounts?.unmatched || 0) + (matchCounts?.ambiguous || 0)) > 0) {
    tips.push({
      scenario: "Data imported but matching incomplete",
      guidance: "Run auto-matching to link Stripe customers to your gym members. Then review any remaining unmatched or ambiguous records manually."
    });
  }

  return tips;
}

function PostSyncVerification({ run, connected, unmatchedCount }: { run: StripeSyncRun; connected?: boolean; unmatchedCount?: number }) {
  const outcome = getSyncOutcome(run);
  const diagnostics = getPartialAccessDiagnostics(run);
  const isDryRun = run.isDryRun || run.runType === "dry_run";

  const outcomeConfig = {
    success: { label: isDryRun ? "Preview Successful" : "Import Successful", color: "text-green-600", bg: "bg-green-500/5 border-green-500/20", icon: CheckCircle2 },
    partial: { label: isDryRun ? "Preview Completed with Warnings" : "Import Completed with Warnings", color: "text-yellow-600", bg: "bg-yellow-500/5 border-yellow-500/20", icon: AlertTriangle },
    failed: { label: isDryRun ? "Preview Failed" : "Import Failed", color: "text-red-600", bg: "bg-red-500/5 border-red-500/20", icon: XCircle },
  };

  const config = outcomeConfig[outcome];
  const Icon = config.icon;

  return (
    <Card className={`border ${config.bg}`} data-testid="card-post-sync-verification">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className={`w-4 h-4 ${config.color}`} />
          <span className={config.color}>{config.label}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Connection</p>
            <p className={`font-semibold flex items-center gap-1 ${connected ? "text-green-600" : "text-muted-foreground"}`}>
              {connected ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {connected ? "Active" : "Inactive"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Customers</p>
            <p className="font-semibold">{run.customersFound.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Subscriptions</p>
            <p className="font-semibold">{run.subscriptionsFound.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Invoices</p>
            <p className="font-semibold">{run.invoicesFound.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Charges</p>
            <p className="font-semibold">{run.chargesFound.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Refunds</p>
            <p className="font-semibold">{run.refundsFound.toLocaleString()}</p>
          </div>
          {!isDryRun && (
            <>
              <div>
                <p className="text-xs text-muted-foreground">Records Created</p>
                <p className="font-semibold">{run.recordsCreated.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Records Updated</p>
                <p className="font-semibold">{run.recordsUpdated.toLocaleString()}</p>
              </div>
            </>
          )}
          {(unmatchedCount ?? 0) > 0 && !isDryRun && (
            <div>
              <p className="text-xs text-muted-foreground">Unmatched</p>
              <p className="font-semibold text-orange-500">{unmatchedCount}</p>
            </div>
          )}
          {run.errorCount > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">Errors</p>
              <p className="font-semibold text-red-500">{run.errorCount}</p>
            </div>
          )}
        </div>

        {run.warningMessages && (
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-md p-2">
            <p className="text-xs text-yellow-600 flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              {run.warningMessages}
            </p>
          </div>
        )}

        {diagnostics.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-orange-600 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Data Access Diagnostics
            </p>
            {diagnostics.map((d, i) => (
              <p key={i} className="text-xs text-muted-foreground ml-4">{d}</p>
            ))}
          </div>
        )}

        {run.errorDetails && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-md p-2">
            <p className="text-xs text-red-500">{run.errorDetails}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FirstLiveSyncSummary({
  run,
  dataQuality,
  matchCounts,
  phase,
}: {
  run: StripeSyncRun;
  dataQuality: DataQuality | undefined;
  matchCounts: MatchCounts | undefined;
  phase: OnboardingPhase;
}) {
  const outcome = getSyncOutcome(run);
  if (outcome === "failed") return null;

  const isFullyReady = phase === "ready";
  const needsMatching = (matchCounts?.total || 0) === 0 || (matchCounts?.unmatched || 0) > 0 || (matchCounts?.ambiguous || 0) > 0;

  return (
    <Card className="border-green-500/20 bg-green-500/5" data-testid="card-first-sync-summary">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-green-500" />
          First Import Complete
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Data Imported</p>
            <p className="font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              {run.recordsCreated.toLocaleString()} records
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Billing Ready</p>
            <p className={`font-semibold flex items-center gap-1 ${isFullyReady ? "text-green-600" : "text-yellow-600"}`}>
              {isFullyReady ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
              {isFullyReady ? "Yes" : "Not yet"}
            </p>
          </div>
        </div>

        {!isFullyReady && (
          <div className="bg-white/50 dark:bg-black/20 rounded-md p-3 space-y-2">
            <p className="text-xs font-medium">What still needs review:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              {needsMatching && <li>Run auto-matching to link Stripe customers to gym members.</li>}
              {(matchCounts?.unmatched || 0) > 0 && <li>Review {matchCounts!.unmatched} unmatched records — match manually or mark as ignored.</li>}
              {(matchCounts?.ambiguous || 0) > 0 && <li>Review {matchCounts!.ambiguous} ambiguous matches that need confirmation.</li>}
              {(dataQuality?.customerMatchCoverage ?? 0) < 80 && <li>Customer match coverage is below 80%. Improve matching for accurate billing insights.</li>}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs">
          <ArrowRight className="w-3.5 h-3.5 text-primary" />
          <span className="font-medium text-primary">
            {isFullyReady
              ? "Billing intelligence is now active. You can close this page."
              : needsMatching
              ? "Next: Run auto-matching to link customers to members."
              : "Next: Review and resolve remaining unmatched records."}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function TroubleshootingPanel({ tips }: { tips: Array<{ scenario: string; guidance: string }> }) {
  if (tips.length === 0) return null;
  return (
    <Card data-testid="card-troubleshooting">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          Guidance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tips.map((tip, i) => (
          <div key={i} className="flex items-start gap-3 p-2 rounded-md bg-muted/30" data-testid={`tip-${i}`}>
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">{tip.scenario}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{tip.guidance}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CopyOnboardingSummaryButton({
  gymName,
  status,
  dataQuality,
  syncRuns,
  matchCounts,
  phase,
  blockingIssues,
}: {
  gymName: string;
  status: StripeStatus | undefined;
  dataQuality: DataQuality | undefined;
  syncRuns: StripeSyncRun[] | undefined;
  matchCounts: MatchCounts | undefined;
  phase: OnboardingPhase;
  blockingIssues: string[];
}) {
  const [copied, setCopied] = useState(false);
  const hasDryRun = dataQuality?.hasCompletedDryRun ||
    syncRuns?.some(r => r.isDryRun || r.runType === "dry_run");
  const hasLiveSync = syncRuns?.some(r =>
    !r.isDryRun && r.runType !== "dry_run" && (r.status === "completed" || r.status === "completed_with_errors")
  );
  const recordCount = dataQuality?.recordCount ?? status?.recordsSynced ?? 0;

  const handleCopy = async () => {
    const lines = [
      `Iron Metrics — Billing Onboarding Summary`,
      `Gym: ${gymName}`,
      `Date: ${new Date().toLocaleDateString()}`,
      ``,
      `Stripe Connected: ${status?.connected ? "Yes" : "No"}`,
      `Dry Run Completed: ${hasDryRun ? "Yes" : "No"}`,
      `Live Sync Completed: ${hasLiveSync ? "Yes" : "No"}`,
      `Billing Records Imported: ${recordCount.toLocaleString()}`,
      `Customer Match Coverage: ${(matchCounts?.total || 0) > 0 ? `${dataQuality?.customerMatchCoverage ?? 0}%` : "N/A"}`,
      `Billing Record Coverage: ${recordCount > 0 ? `${dataQuality?.billingRecordCoverage ?? 0}%` : "N/A"}`,
      ``,
      `Status: ${PHASE_CONFIG[phase].title}`,
      `Blocking Issues: ${blockingIssues.length > 0 ? blockingIssues.join("; ") : "None"}`,
      `Next Action: ${PHASE_CONFIG[phase].action}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="gap-1.5"
      data-testid="button-copy-summary"
    >
      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Clipboard className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy Summary"}
    </Button>
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

  const { data: gym } = useQuery<{ id: string; name: string }>({
    queryKey: ["/api/gyms", gymId],
    enabled: !!gymId,
  });

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
      toast({ title: "Stripe connected", description: "Your Stripe account is now linked. Run a dry run to preview your data." });
    },
    onError: (err: any) => {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => { await apiRequest("DELETE", `/api/gyms/${gymId}/stripe/connect`); },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Stripe disconnected", description: "Your Stripe account has been unlinked. Existing billing records are preserved." });
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
        toast({ title: "Dry run complete", description: "Preview results are ready. Review them below before running a live sync." });
        invalidateAll();
      } else {
        toast({ title: "Live sync started", description: "Payment history is being imported. This may take a few moments." });
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
      toast({ title: "Matching complete", description: `${data.matched} matched, ${data.ambiguous} need review, ${data.unmatched} unmatched.` });
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
      toast({ title: "Re-matching complete", description: `${data.matched} matched, ${data.ambiguous} need review, ${data.unmatched} unmatched.` });
    },
  });

  const manualMatchMutation = useMutation({
    mutationFn: async ({ matchId, memberId }: { matchId: string; memberId: string }) => {
      await apiRequest("POST", `/api/gyms/${gymId}/stripe/matches/${matchId}/manual-match`, { memberId });
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Member matched", description: "Stripe customer linked to gym member." });
    },
  });

  const unmatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      await apiRequest("POST", `/api/gyms/${gymId}/stripe/matches/${matchId}/unmatch`);
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Record unmatched", description: "Customer link removed. You can re-match or ignore this record." });
    },
  });

  const ignoreMutation = useMutation({
    mutationFn: async (matchId: string) => {
      await apiRequest("POST", `/api/gyms/${gymId}/stripe/matches/${matchId}/ignore`);
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Record ignored", description: "This Stripe customer will be excluded from match coverage calculations." });
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
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const windowDays = syncWindow === "all" ? undefined : Number(syncWindow);
  const latestDryRun = syncRuns?.find(r => r.isDryRun || r.runType === "dry_run");
  const blockingIssues = getBlockingIssues(status, dataQuality, syncRuns, events);
  const phase = getOnboardingPhase(status, dataQuality, syncRuns, matchCounts, blockingIssues);
  const mostRecentRun = syncRuns?.[0];
  const firstLiveSync = syncRuns?.find(r => !r.isDryRun && r.runType !== "dry_run" && (r.status === "completed" || r.status === "completed_with_errors"));
  const troubleshootingTips = getTroubleshootingGuidance(mostRecentRun, status, matchCounts, dataQuality, events);
  const gymName = gym?.name || "Your Gym";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/gyms/${gymId}/settings`}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold" data-testid="text-page-title">Stripe Billing Integration</h1>
            <p className="text-sm text-muted-foreground">Import payment history from Stripe to power billing intelligence and retention insights.</p>
          </div>
        </div>
        {status?.connected && (
          <CopyOnboardingSummaryButton
            gymName={gymName}
            status={status}
            dataQuality={dataQuality}
            syncRuns={syncRuns}
            matchCounts={matchCounts}
            phase={phase}
            blockingIssues={blockingIssues}
          />
        )}
      </div>

      {isDemoUser && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
            <p className="text-sm text-yellow-600 dark:text-yellow-400" data-testid="text-demo-warning">
              You are viewing the billing integration in demo mode. Connection, sync, and matching controls are disabled.
            </p>
          </CardContent>
        </Card>
      )}

      <OnboardingStatusBanner phase={phase} />

      <BlockingIssuesBanner issues={blockingIssues} />

      <OnboardingSummaryCard
        status={status}
        dataQuality={dataQuality}
        syncRuns={syncRuns}
        matchCounts={matchCounts}
        phase={phase}
        blockingIssues={blockingIssues}
      />

      <OnboardingChecklist gymId={gymId!} status={status} dataQuality={dataQuality} syncRuns={syncRuns} matchCounts={matchCounts} events={events} />

      {mostRecentRun && mostRecentRun.status !== "running" && (
        <PostSyncVerification run={mostRecentRun} connected={status?.connected} unmatchedCount={matchCounts?.unmatched} />
      )}

      {firstLiveSync && phase !== "ready" && (
        <FirstLiveSyncSummary
          run={firstLiveSync}
          dataQuality={dataQuality}
          matchCounts={matchCounts}
          phase={phase}
        />
      )}

      <TroubleshootingPanel tips={troubleshootingTips} />

      <Card data-testid="card-stripe-connection">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Stripe Connection
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
                <p className="text-muted-foreground text-xs">API Key</p>
                <p className="font-mono text-xs" data-testid="text-api-fingerprint">
                  <Shield className="w-3 h-3 inline mr-1" />
                  {status.apiKeyFingerprint}
                </p>
              </div>
              {status.stripeAccountId && (
                <div>
                  <p className="text-muted-foreground text-xs">Account</p>
                  <p className="font-mono text-xs" data-testid="text-account-id">{status.stripeAccountId}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs">Connected</p>
                <p className="text-xs" data-testid="text-connected-at">{status.connectedAt ? new Date(status.connectedAt).toLocaleDateString() : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Last Sync</p>
                <p className="text-xs" data-testid="text-last-sync">{status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : "No sync yet"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Records Imported</p>
                <p className="font-semibold text-xs" data-testid="text-records-synced">
                  <Database className="w-3 h-3 inline mr-1" />{(status.recordsSynced ?? 0).toLocaleString()}
                </p>
              </div>
              {status.lastErrorMessage && (
                <div className="col-span-2 bg-red-500/5 border border-red-500/20 rounded-md p-2">
                  <p className="text-xs text-red-500 flex items-start gap-1" data-testid="text-last-error">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{status.lastErrorMessage}
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
                    <Label htmlFor="stripe-key">Stripe Restricted API Key</Label>
                    <Input
                      id="stripe-key"
                      type="password"
                      placeholder="rk_live_... or sk_test_..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      data-testid="input-stripe-key"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Use a restricted key with read-only access for security. Find your keys in{" "}
                      <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="text-primary underline">
                        Stripe Dashboard
                        <ExternalLink className="w-3 h-3 inline ml-0.5" />
                      </a>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => connectMutation.mutate(apiKey)} disabled={connectMutation.isPending || !apiKey.startsWith("sk_") && !apiKey.startsWith("rk_")} data-testid="button-connect-confirm">
                      {connectMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                      Connect
                    </Button>
                    <Button variant="outline" onClick={() => { setShowApiKeyInput(false); setApiKey(""); }} data-testid="button-connect-cancel">Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Link your Stripe account to import invoices, charges, and subscription data. Your API key is encrypted and stored securely.
                  </p>
                  <Button onClick={() => setShowApiKeyInput(true)} className="w-full" data-testid="button-connect-stripe">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Connect Stripe Account
                  </Button>
                </div>
              )}
            </>
          )}

          {!status?.connected && isDemoUser && (
            <p className="text-sm text-muted-foreground">
              In demo mode, the connection panel shows what a gym owner would see before linking their Stripe account.
            </p>
          )}
        </CardContent>
      </Card>

      {status?.connected && !isDemoUser && (
        <Card data-testid="card-sync-controls">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Data Sync
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {!dataQuality?.hasCompletedDryRun
                ? "Start with a dry run to preview the data available in your Stripe account. No records will be created."
                : "Run a sync to import or refresh your payment data. Dry runs preview without importing."}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Time Range</Label>
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
                Preview Data (Dry Run)
              </Button>
              <Button
                onClick={() => syncMutation.mutate({ windowDays })}
                disabled={syncMutation.isPending || !dataQuality?.hasCompletedDryRun}
                className="flex-1"
                data-testid="button-live-sync"
                title={!dataQuality?.hasCompletedDryRun ? "Complete a dry run first to preview data" : "Import payment data from Stripe"}
              >
                {syncMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Import Data (Live Sync)
              </Button>
            </div>

            {!dataQuality?.hasCompletedDryRun && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Info className="w-3 h-3 shrink-0" />
                A dry run is required before your first live sync. This lets you review the data before importing.
              </p>
            )}

            {showSyncConfirm && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3 space-y-2" data-testid="sync-confirmation">
                <p className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  Confirm First Import
                </p>
                <p className="text-xs text-muted-foreground">
                  This will create billing records in Iron Metrics from your Stripe payment history. Subsequent syncs will update existing records.
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
                    Confirm & Import
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
                  Preview Results
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Customers:</span> {latestDryRun.dryRunSummary.customersFound}</div>
                  <div><span className="text-muted-foreground">Subscriptions:</span> {latestDryRun.dryRunSummary.subscriptionsFound}</div>
                  <div><span className="text-muted-foreground">Invoices:</span> {latestDryRun.dryRunSummary.invoicesFound}</div>
                  <div><span className="text-muted-foreground">Charges:</span> {latestDryRun.dryRunSummary.chargesFound}</div>
                  <div><span className="text-muted-foreground">Refunds:</span> {latestDryRun.dryRunSummary.refundsFound}</div>
                  <div><span className="text-muted-foreground">Est. Records:</span> {latestDryRun.dryRunSummary.estimatedNewRecords}</div>
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

      {syncRuns && syncRuns.length > 0 ? (
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
                          {run.isDryRun || run.runType === "dry_run" ? "Preview" : "Import"}
                        </Badge>
                      </TableCell>
                      <TableCell><SyncStatusBadge status={run.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{run.syncWindowDays ? `${run.syncWindowDays} days` : "All"}</TableCell>
                      <TableCell className="text-xs">
                        {run.isDryRun || run.runType === "dry_run"
                          ? `~${run.invoicesFound} invoices`
                          : `${run.recordsCreated} new, ${run.recordsUpdated} updated`
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
      ) : status?.connected ? (
        <Card data-testid="card-sync-history-empty">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Sync History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No sync history yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Run a dry run to preview your Stripe data before importing.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {status?.connected && (
        <Card data-testid="card-member-matching">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Customer Matching
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {matchCounts && matchCounts.total > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
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
                    <p className="text-xs text-muted-foreground">Need Review</p>
                  </div>
                  <div className="bg-muted/30 rounded-md p-2">
                    <p className="text-lg font-semibold text-muted-foreground" data-testid="text-ignored-count">{matchCounts.ignored}</p>
                    <p className="text-xs text-muted-foreground">Ignored</p>
                  </div>
                </div>

                {(matchCounts.unmatched > 0 || matchCounts.ambiguous > 0) && (
                  <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-md p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      {matchCounts.unmatched > 0 && matchCounts.ambiguous > 0
                        ? `${matchCounts.unmatched} Stripe customers could not be matched and ${matchCounts.ambiguous} need manual review. Match or ignore these records to improve billing coverage.`
                        : matchCounts.unmatched > 0
                        ? `${matchCounts.unmatched} Stripe customers could not be matched to gym members. Match or ignore these records.`
                        : `${matchCounts.ambiguous} Stripe customers have ambiguous matches. Review and confirm the correct member.`}
                    </p>
                  </div>
                )}

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
                      <SelectItem value="all">All Records</SelectItem>
                      <SelectItem value="unmatched">Unmatched</SelectItem>
                      <SelectItem value="ambiguous">Need Review</SelectItem>
                      <SelectItem value="auto_matched">Auto-matched</SelectItem>
                      <SelectItem value="manually_matched">Manually Matched</SelectItem>
                      <SelectItem value="ignored">Ignored</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {matches && matches.length === 0 && (matchFilter !== "all" || matchSearch) && (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                      {matchSearch
                        ? `No records matching "${matchSearch}".`
                        : `No ${matchFilter === "unmatched" ? "unmatched" : matchFilter === "ambiguous" ? "records needing review" : matchFilter.replace(/_/g, " ")} records found.`}
                    </p>
                  </div>
                )}

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
                                    title="Ignore this customer"
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
            ) : (status?.recordsSynced ?? 0) > 0 ? (
              <div className="text-center py-6">
                <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No matching data yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Run auto-matching to link Stripe customers to your gym members.</p>
              </div>
            ) : (
              <div className="text-center py-6">
                <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Customer matching is available after importing billing records.</p>
                <p className="text-xs text-muted-foreground mt-1">Complete a live sync first, then run auto-matching.</p>
              </div>
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
              Data Readiness
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
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
                {dataQuality.overallStatus === "ready" ? "All Checks Passing" :
                 dataQuality.overallStatus === "needs_matching_review" ? "Matching Review Needed" :
                 dataQuality.overallStatus === "partial_data" ? "Partial Data Available" :
                 dataQuality.overallStatus === "not_connected" ? "Not Connected" :
                 dataQuality.overallStatus.replace(/_/g, " ")}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ReadinessBlock label="Connection" ok={dataQuality.connectionStatus === "connected"} detail={dataQuality.connectionStatus === "connected" ? "Active" : "Not connected"} />
              <ReadinessBlock label="Payment Records" ok={dataQuality.recordCount > 0} detail={dataQuality.recordCount > 0 ? `${dataQuality.recordCount.toLocaleString()} imported` : "None imported"} />
              <ReadinessBlock label="Customer Match" ok={dataQuality.customerMatchCoverage >= 80} detail={`${dataQuality.customerMatchCoverage}% of customers linked`} />
              <ReadinessBlock label="Billing Coverage" ok={dataQuality.billingRecordCoverage >= 80} detail={`${dataQuality.billingRecordCoverage}% of records linked`} />
              <ReadinessBlock label="Invoices" ok={dataQuality.hasInvoices} detail={dataQuality.hasInvoices ? "Available" : "Not found"} />
              <ReadinessBlock label="Refund Data" ok={dataQuality.hasRefunds} detail={dataQuality.hasRefunds ? "Available" : "Not found"} />
              <ReadinessBlock label="Webhooks" ok={(dataQuality.webhookSuccessRate ?? 0) >= 80} detail={dataQuality.webhookSuccessRate !== null ? `${dataQuality.webhookSuccessRate}% success rate` : "Not configured"} />
            </div>

            {dataQuality.partialAccessIssues.length > 0 && (
              <div className="bg-orange-500/5 border border-orange-500/20 rounded-md p-3 space-y-1">
                <p className="text-xs font-medium text-orange-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Data Access Notes
                </p>
                {dataQuality.partialAccessIssues.map((issue, i) => (
                  <p key={i} className="text-xs text-orange-600 ml-4">{issue}</p>
                ))}
              </div>
            )}

            {!isDemoUser && status?.connected && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Operator Notes</Label>
                <Textarea
                  value={fallbackNotes}
                  onChange={(e) => setFallbackNotes(e.target.value)}
                  placeholder="Optional: Note any context about this gym's billing setup (e.g., uses multiple payment processors)"
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

      {events && events.length > 0 ? (
        <Card data-testid="card-integration-timeline">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Activity Log
              </CardTitle>
              {isAdmin && (
                <a
                  href={`/api/gyms/${gymId}/stripe/admin-summary`}
                  download
                  className="text-xs text-primary underline flex items-center gap-1"
                  data-testid="link-download-summary"
                >
                  <Download className="w-3 h-3" />
                  Export Summary
                </a>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30 max-h-64 overflow-y-auto">
              {events.slice(0, 20).map((evt) => {
                const isFailure = evt.eventType.includes("failure") || evt.eventType.includes("error");
                return (
                  <div key={evt.id} className="px-4 py-2.5 flex items-center gap-3 text-sm" data-testid={`event-${evt.id}`}>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${isFailure ? "bg-red-500" : "bg-primary/50"}`} />
                    <div className="flex-1 min-w-0">
                      <span className={`font-medium text-xs ${isFailure ? "text-red-500" : ""}`}>
                        {evt.eventType === "webhook_failure" ? "Webhook Processing Failed" :
                         evt.eventType === "sync_started" ? "Sync Started" :
                         evt.eventType === "sync_completed" ? "Sync Completed" :
                         evt.eventType === "dry_run_completed" ? "Preview Completed" :
                         evt.eventType === "connection_established" ? "Stripe Connected" :
                         evt.eventType === "matching_completed" ? "Matching Completed" :
                         evt.eventType === "manual_match" ? "Manual Match" :
                         evt.eventType.replace(/_/g, " ")}
                      </span>
                      {evt.details && typeof evt.details === "object" && Object.keys(evt.details).length > 0 && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {Object.entries(evt.details)
                            .filter(([k]) => k !== "occurredAt")
                            .slice(0, 2)
                            .map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").toLowerCase()}: ${v}`)
                            .join(", ")}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{new Date(evt.createdAt).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : status?.connected ? (
        <Card data-testid="card-integration-timeline-empty">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Activity Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <Activity className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No activity recorded yet. Events will appear here as you sync and manage billing data.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Webhook Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Webhooks keep your billing data current by receiving real-time updates from Stripe. Configure a webhook endpoint in your Stripe Dashboard to enable automatic syncing.
          </p>
          <div className="bg-muted/30 rounded-md p-3 space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Endpoint URL</p>
              <code className="text-xs font-mono break-all" data-testid="text-webhook-url">
                {typeof window !== "undefined" ? `${window.location.origin}/api/stripe/billing-webhook/${gymId}` : `/api/stripe/billing-webhook/${gymId}`}
              </code>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Events to Subscribe</p>
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
                <p className="text-muted-foreground text-xs">Connection Status</p>
                <p className="font-mono text-xs">{debugData.connection?.status || "none"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Total Billing Records</p>
                <p className="font-semibold">{debugData.totalBillingRecords.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Last Sync</p>
                <p className="text-xs">{debugData.connection?.lastSyncAt ? new Date(debugData.connection.lastSyncAt).toLocaleString() : "Never"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Account ID</p>
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
