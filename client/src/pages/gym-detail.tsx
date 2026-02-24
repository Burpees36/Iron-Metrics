import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import type { Gym, Member, GymMonthlyMetrics, MemberContact } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import {
  Users,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Activity,
  Upload,
  UserPlus,
  UserMinus,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
  Gauge,
  BarChart3,
  Radar,
  Target,
  ArrowUp,
  ArrowDown,
  Minus,
  AlertTriangle,
  Phone,
  Eye,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Star,
  Clock,
  MessageSquare,
  X,
  Plug,
  Download,
  Printer,
  CheckCircle2,
  Brain,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
  ReferenceArea,
  BarChart,
  Bar,
  ComposedChart,
  Legend,
} from "recharts";

interface MetricReport {
  metric: string;
  current: string;
  target: string;
  impact: string;
  meaning: string;
  whyItMatters: string;
  action: string;
  trendDirection: "up" | "down" | "stable" | "none";
  trendValue: string;
}

interface AtRiskMember {
  id: string;
  name: string;
  email: string | null;
  joinDate: string;
  monthlyRate: string;
  riskCategory: "ghost" | "at-risk" | "drifter";
  riskLabel: string;
  tenureDays: number;
  lastContacted: string | null;
  lastAttended: string | null;
  churnProbability: number;
}

interface EnrichedMember {
  id: string;
  name: string;
  email: string | null;
  status: string;
  joinDate: string;
  cancelDate: string | null;
  monthlyRate: string;
  tenureDays: number;
  tenureMonths: number;
  risk: "low" | "medium" | "high";
  riskReasons: string[];
  lastContacted: string | null;
  daysSinceContact: number | null;
  isHighValue: boolean;
  totalRevenue: number;
}

type MemberFilter = "all" | "high-risk" | "no-contact" | "new" | "high-value" | "pre-60";

interface Forecast {
  nextMonthMrr: number;
  mrrChange: number;
  churnTrajectory: string;
  projectedChurn: number;
  ifNothingChanges: {
    mrrIn3Months: number;
    membersIn3Months: number;
    revenueAtRisk: number;
  };
  outlook: string;
}

interface TrendInsight {
  chartKey: string;
  status: "positive" | "warning" | "critical" | "neutral";
  headline: string;
  detail: string;
}

interface MicroKpi {
  chartKey: string;
  currentValue: string;
  mom: string | null;
  momDirection: "up" | "down" | "flat";
  yoy: string | null;
  yoyDirection: "up" | "down" | "flat";
  trend: "accelerating" | "decelerating" | "stable";
}

interface TrendProjection {
  month: string;
  mrr: number | null;
  members: number | null;
  churn: number | null;
  rsi: number | null;
  arm: number | null;
  netGrowth: number | null;
  joins: number | null;
  cancels: number | null;
  cumulativeNetGrowth: number | null;
  projected: boolean;
}

interface CorrelationInsight {
  title: string;
  detail: string;
  status: "positive" | "warning" | "neutral";
}

interface NinetyDayOutlook {
  revenue: { status: string; label: string };
  memberCount: { status: string; label: string };
  churn: { status: string; label: string };
  interventionRequired: "none" | "low" | "moderate" | "high";
}

interface TargetPathPoint {
  month: string;
  currentTrajectory: number;
  targetTrajectory: number;
}

interface TimelineEvent {
  month: string;
  type: string;
  description: string;
  severity: "info" | "warning" | "critical";
}

interface StrategicRecommendation {
  area: string;
  status: "priority" | "maintain" | "monitor";
  headline: string;
  detail: string;
}

interface TrendIntelligence {
  insights: TrendInsight[];
  microKpis: MicroKpi[];
  projections: TrendProjection[];
  correlations: CorrelationInsight[];
  stabilityScore: {
    score: number;
    tier: "stable" | "plateau-risk" | "early-drift" | "instability-risk";
    headline: string;
    detail: string;
    components: {
      rsiSlope: { score: number; label: string };
      churnAvg: { score: number; label: string };
      netGrowth: { score: number; label: string };
      revenueMomentum: { score: number; label: string };
    };
  };
  ninetyDayOutlook: NinetyDayOutlook;
  targetPath: TargetPathPoint[];
  timelineEvents: TimelineEvent[];
  strategicRecommendations: StrategicRecommendation[];
  growthEngine: {
    cumulativeData: { month: string; cumulative: number; joins: number; cancels: number }[];
    totalNetGrowth: number;
    totalMonths: number;
  };
}

export function useGymData(gymId: string | undefined) {
  return useQuery<Gym>({
    queryKey: ["/api/gyms", gymId],
    enabled: !!gymId,
  });
}

export function GymPageShell({ gym, children, actions }: { gym: Gym; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="space-y-0.5">
            <h1 className="text-xl font-bold tracking-tight" data-testid="text-gym-name">
              {gym.name}
            </h1>
            {gym.location && (
              <p className="text-sm text-muted-foreground">{gym.location}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

export { ReportView, TrendsView, MembersView, RecomputeButton, GymNotFound, GymDetailSkeleton };

export default function GymDetail() {
  const [, params] = useRoute("/gyms/:id");
  const gymId = params?.id;

  const { data: gym, isLoading: gymLoading } = useGymData(gymId);

  if (gymLoading) return <GymDetailSkeleton />;
  if (!gym) return <GymNotFound />;

  return (
    <GymPageShell
      gym={gym}
      actions={
        <>
          <Link href={`/gyms/${gym.id}/wodify`}>
            <Button data-testid="button-wodify-integration">
              <Plug className="w-4 h-4 mr-1" />
              Wodify
            </Button>
          </Link>
          <Link href={`/gyms/${gym.id}/import`}>
            <Button data-testid="button-import-csv">
              <Upload className="w-4 h-4 mr-1" />
              Import CSV
            </Button>
          </Link>
          <RecomputeButton gymId={gym.id} />
        </>
      }
    >
      <ReportView gymId={gym.id} />
    </GymPageShell>
  );
}

function RecomputeButton({ gymId }: { gymId: string }) {
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/gyms/${gymId}/recompute`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId] });
      toast({ title: "Metrics recomputed", description: "All monthly metrics have been refreshed." });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Button
      variant="outline"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      data-testid="button-recompute"
    >
      <RefreshCw className={`w-4 h-4 mr-1 ${mutation.isPending ? "animate-spin" : ""}`} />
      {mutation.isPending ? "Computing..." : "Recompute"}
    </Button>
  );
}

interface SalesSummaryOverview {
  counts: { leads: number; booked: number; shows: number; newMembers: number };
  rates: { funnelConversion: number | null };
  bottleneck: { stage: string; dropPercent: number; explanation: string } | null;
}

interface TrendPulsePoint {
  month: string;
  members: number | null;
  mrr: number | null;
  churn: number | null;
}

function generateFocusDirective(
  data: { metrics: GymMonthlyMetrics; atRiskMembers: AtRiskMember[]; forecast: Forecast },
  sales: SalesSummaryOverview | null,
): { headline: string; detail: string; action: string } {
  const revenueAtRisk = data.forecast.ifNothingChanges.revenueAtRisk;
  const ghostCount = data.atRiskMembers.filter(m => m.riskCategory === "ghost").length;
  const atRiskCount = data.atRiskMembers.filter(m => m.riskCategory === "at-risk").length;
  const totalFlagged = ghostCount + atRiskCount;
  const churnRate = Number(data.metrics.churnRate);
  const flaggedRevenue = data.atRiskMembers
    .filter(m => m.riskCategory === "ghost" || m.riskCategory === "at-risk")
    .reduce((sum, m) => sum + Number(m.monthlyRate), 0);

  if (totalFlagged > 0 && flaggedRevenue > 0) {
    const topRisk = data.atRiskMembers.filter(m => m.riskCategory === "ghost" || m.riskCategory === "at-risk");
    const gapMembers = topRisk.filter(m => {
      if (!m.lastAttended) return true;
      const daysSince = (Date.now() - new Date(m.lastAttended).getTime()) / 86400000;
      return daysSince > 10;
    });
    return {
      headline: `Protect $${flaggedRevenue.toLocaleString()} in revenue`,
      detail: `${totalFlagged} member${totalFlagged !== 1 ? "s are" : " is"} ${ghostCount > 0 ? "disengaged or " : ""}at risk due to attendance drop-off.`,
      action: gapMembers.length > 0
        ? `Call ${Math.min(gapMembers.length, 5)} members with 10+ day attendance gaps this week.`
        : `Schedule personal check-ins with all ${totalFlagged} flagged members this week.`,
    };
  }

  if (sales?.bottleneck && sales.bottleneck.dropPercent >= 30) {
    return {
      headline: `Improve ${sales.bottleneck.stage} (${sales.bottleneck.dropPercent}% drop-off)`,
      detail: sales.bottleneck.explanation,
      action: sales.bottleneck.stage.includes("Show")
        ? "Restructure the consultation to lead with their goals, not your pricing."
        : sales.bottleneck.stage.includes("Booked")
        ? "Add confirmation texts and reduce time-to-appointment."
        : "Implement a same-day follow-up system for every new lead.",
    };
  }

  if (churnRate > 5) {
    return {
      headline: `Reduce churn from ${churnRate}% to under 5%`,
      detail: `At the current rate, you'll lose ${Math.round(data.metrics.activeMembers * (churnRate / 100))} members this month. Each lost member costs more to replace than to retain.`,
      action: "Audit your first-90-day experience. Schedule goal reviews for all members under 60 days.",
    };
  }

  if (data.metrics.newMembers > 0 && data.metrics.cancels === 0) {
    return {
      headline: "Maintain momentum — protect the streak",
      detail: `Zero cancellations and ${data.metrics.newMembers} new member${data.metrics.newMembers > 1 ? "s" : ""}. Revenue is growing predictably.`,
      action: "Check in with your newest members this week. The first 60 days determine whether they stay.",
    };
  }

  return {
    headline: "Strengthen your retention foundation",
    detail: "No immediate fires, but consistent attention to member engagement is what separates stable gyms from volatile ones.",
    action: "Schedule 3 personal check-ins this week with members you haven't spoken to recently.",
  };
}

function PillarCard({ label, icon: Icon, primary, primaryLabel, supporting, supportingLabel, direction, interpretation, href, testId }: {
  label: string;
  icon: typeof Users;
  primary: string;
  primaryLabel: string;
  supporting: string;
  supportingLabel: string;
  direction?: "up" | "down" | "stable";
  interpretation: string;
  href?: string;
  testId: string;
}) {
  const content = (
    <Card className="hover-elevate transition-all duration-300 h-full" data-testid={testId}>
      <CardContent className="p-4 sm:p-5 space-y-3 h-full flex flex-col">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-muted/50">
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight font-mono" data-testid={`${testId}-value`}>{primary}</span>
          {direction && direction !== "stable" && (
            direction === "up"
              ? <ArrowUp className="w-3.5 h-3.5 text-primary" />
              : <ArrowDown className="w-3.5 h-3.5 text-red-500" />
          )}
          {direction === "stable" && <Minus className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{primaryLabel}</p>
        <div className="mt-auto pt-2 border-t border-border/30">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{supportingLabel}</span>
            <span className="font-semibold font-mono">{supporting}</span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{interpretation}</p>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function ReportView({ gymId }: { gymId: string }) {
  const [monthOffset, setMonthOffset] = useState(0);

  const getMonthDate = (offset: number) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    return d.toISOString().slice(0, 10);
  };

  const monthDate = getMonthDate(monthOffset);
  const displayMonth = new Date(monthDate + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const { data, isLoading } = useQuery<{
    metrics: GymMonthlyMetrics;
    reports: MetricReport[];
    atRiskMembers: AtRiskMember[];
    forecast: Forecast;
    communityEngagement?: { score: number; activePercent: number };
  } | null>({
    queryKey: ["/api/gyms", gymId, "report", monthDate],
    queryFn: async () => {
      const res = await fetch(`/api/gyms/${gymId}/report?month=${monthDate}`, {
        credentials: "include",
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const now = new Date();
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const { data: salesSummary } = useQuery<SalesSummaryOverview>({
    queryKey: ["/api/gyms", gymId, "sales-intelligence", "summary-overview"],
    queryFn: async () => {
      const res = await fetch(`/api/gyms/${gymId}/sales-intelligence/summary?start=${ninetyDaysAgo.toISOString()}&end=${now.toISOString()}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!gymId,
  });

  const { data: trendIntelligence } = useQuery<TrendIntelligence>({
    queryKey: ["/api/gyms", gymId, "trends", "intelligence"],
    enabled: !!gymId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 rounded-md" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-44 rounded-md" />)}
        </div>
        <Skeleton className="h-36 rounded-md" />
        <Skeleton className="h-52 rounded-md" />
      </div>
    );
  }

  if (!data) {
    return <OnboardingChecklist gymId={gymId} month={displayMonth} />;
  }

  const churnRate = Number(data.metrics.churnRate);
  const mrr = Number(data.metrics.mrr);
  const rsi = data.metrics.rsi;
  const revenueAtRisk = data.forecast.ifNothingChanges.revenueAtRisk;
  const ghostCount = data.atRiskMembers.filter(m => m.riskCategory === "ghost").length;
  const atRiskOnlyCount = data.atRiskMembers.filter(m => m.riskCategory === "at-risk").length;
  const totalFlagged = ghostCount + atRiskOnlyCount;
  const cei = data.communityEngagement || { score: 50, activePercent: 0 };

  const churnDirection: "up" | "down" | "stable" = (() => {
    const churnReport = data.reports.find(r => r.metric === "Monthly Churn");
    if (!churnReport) return "stable";
    return churnReport.trendDirection === "up" ? "up" : churnReport.trendDirection === "down" ? "down" : "stable";
  })();

  const mrrDirection: "up" | "down" | "stable" = (() => {
    const mrrReport = data.reports.find(r => r.metric === "Revenue per Member");
    if (!mrrReport) return "stable";
    return mrrReport.trendDirection === "up" ? "up" : mrrReport.trendDirection === "down" ? "down" : "stable";
  })();

  const retentionInterpretation = churnRate === 0
    ? "Zero churn. Retention is holding."
    : churnRate <= 3
    ? "Healthy retention. Members are staying."
    : churnRate <= 5
    ? "Within target. Watch for early signs of drift."
    : churnRate <= 7
    ? "Above target. Attention required before it compounds."
    : "Critical. Revenue is eroding monthly.";

  const revenueInterpretation = data.forecast.mrrChange > 0
    ? `Growing. +$${data.forecast.mrrChange.toLocaleString()} projected next month.`
    : data.forecast.mrrChange === 0
    ? "Stable. Revenue is holding but not growing."
    : `Contracting. $${Math.abs(data.forecast.mrrChange).toLocaleString()} at risk next month.`;

  const salesConversion = salesSummary?.rates?.funnelConversion;
  const salesInterpretation = salesConversion !== null && salesConversion !== undefined
    ? salesConversion >= 0.3
      ? "Pipeline is converting well. Protect what's working."
      : salesConversion >= 0.15
      ? "Room to improve. Review your bottleneck stage."
      : "Low conversion. Focus on the biggest drop-off point."
    : "No sales data yet.";

  const engagementInterpretation = cei.score >= 70
    ? "Strong engagement. Members are showing up consistently."
    : cei.score >= 40
    ? "Moderate engagement. Some members are drifting."
    : "Low engagement. Attendance-driven outreach recommended.";

  const focus = generateFocusDirective(data, salesSummary || null);

  const trendPulseData: TrendPulsePoint[] = trendIntelligence?.projections
    ?.filter(p => !p.projected)
    ?.slice(-6)
    ?.map(p => ({
      month: new Date(p.month + "T00:00:00").toLocaleDateString("en-US", { month: "short" }),
      members: p.members,
      mrr: p.mrr ? Math.round(p.mrr / 1000) : null,
      churn: p.churn,
    })) || [];

  const rsiColor = rsi >= 80
    ? { stroke: "hsl(var(--primary))", glow: "hsl(var(--primary) / 0.25)", label: "Stable", bg: "bg-primary/5 dark:bg-primary/10", border: "border-primary/20", text: "text-primary" }
    : rsi >= 60
    ? { stroke: "#f59e0b", glow: "rgba(245, 158, 11, 0.25)", label: "Moderate", bg: "bg-amber-500/5 dark:bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-600 dark:text-amber-400" }
    : { stroke: "#ef4444", glow: "rgba(239, 68, 68, 0.25)", label: "Unstable", bg: "bg-red-500/5 dark:bg-red-500/10", border: "border-red-500/20", text: "text-red-600 dark:text-red-400" };

  const stabilityVerdict = rsi >= 80
    ? "Your gym is stable. Revenue is predictable and members are staying."
    : rsi >= 60
    ? "Your gym is holding, but watch for drift. Small cracks in retention can widen quickly."
    : "Stability is at risk. Churn is outpacing growth and revenue is under pressure.";

  return (
    <div className="space-y-6">
      {/* ── Section 1: Stability Verdict ── */}
      <Card className={`${rsiColor.bg} border ${rsiColor.border} animate-fade-in-up`} data-testid="section-stability-verdict">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <RSIDial value={rsi} testId="metric-rsi" />
            <div className="flex-1 space-y-1.5">
              <h2 className={`text-base font-bold ${rsiColor.text}`} data-testid="text-stability-label">
                {rsiColor.label}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-stability-verdict">
                {stabilityVerdict}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: The 4 Core Pillars ── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up animation-delay-100">
        <PillarCard
          label="Retention"
          icon={Activity}
          primary={`${churnRate}%`}
          primaryLabel="Monthly Churn"
          supporting={String(totalFlagged)}
          supportingLabel="At-risk members"
          direction={churnDirection === "up" ? "down" : churnDirection === "down" ? "up" : "stable"}
          interpretation={retentionInterpretation}
          href={`/gyms/${gymId}/member-risk`}
          testId="pillar-retention"
        />
        <PillarCard
          label="Revenue"
          icon={DollarSign}
          primary={`$${mrr.toLocaleString()}`}
          primaryLabel="MRR"
          supporting={revenueAtRisk > 0 ? `$${revenueAtRisk.toLocaleString()}` : "$0"}
          supportingLabel="Revenue at risk"
          direction={mrrDirection}
          interpretation={revenueInterpretation}
          href={`/gyms/${gymId}/planning`}
          testId="pillar-revenue"
        />
        <PillarCard
          label="Sales"
          icon={TrendingUp}
          primary={salesConversion !== null && salesConversion !== undefined ? `${(salesConversion * 100).toFixed(0)}%` : "—"}
          primaryLabel="Lead → Member"
          supporting={salesSummary?.bottleneck?.stage || "—"}
          supportingLabel="Biggest bottleneck"
          interpretation={salesInterpretation}
          href={`/gyms/${gymId}/sales`}
          testId="pillar-sales"
        />
        <PillarCard
          label="Engagement"
          icon={Users}
          primary={String(cei.score)}
          primaryLabel="Community Engagement Index"
          supporting={`${cei.activePercent}%`}
          supportingLabel="Active (2+ visits / 14d)"
          interpretation={engagementInterpretation}
          href={`/gyms/${gymId}/trends`}
          testId="pillar-engagement"
        />
      </div>

      {/* ── Section 3: This Week's Focus ── */}
      <Card className="border-primary/20 bg-primary/[0.02] dark:bg-primary/[0.04] animate-fade-in-up animation-delay-200" data-testid="section-focus-panel">
        <CardContent className="p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">This Week's Focus</p>
          </div>
          <h3 className="text-base font-bold" data-testid="text-focus-headline">{focus.headline}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-focus-detail">{focus.detail}</p>
          <div className="p-3 rounded-md bg-primary/5 dark:bg-primary/10 border border-primary/10">
            <p className="text-xs font-medium" data-testid="text-focus-action">
              <span className="text-primary font-semibold">Action:</span>{" "}{focus.action}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 4: Trend Pulse ── */}
      {trendPulseData.length >= 2 && (
        <Card className="animate-fade-in-up animation-delay-200" data-testid="section-trend-pulse">
          <CardContent className="p-5 sm:p-6 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Trend Pulse</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendPulseData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v) => `${v}%`} />
                  <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line yAxisId="left" type="monotone" dataKey="members" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Members" />
                  <Line yAxisId="left" type="monotone" dataKey="mrr" stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={false} name="MRR (k)" />
                  <Line yAxisId="right" type="monotone" dataKey="churn" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Churn %" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Section 5: Drill-Down Gateways ── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in-up animation-delay-200" data-testid="section-drill-down">
        {[
          { label: "Reports", href: `/gyms/${gymId}/trends`, icon: BarChart3 },
          { label: "Member Intelligence", href: `/gyms/${gymId}/member-risk`, icon: Brain },
          { label: "Sales Intelligence", href: `/gyms/${gymId}/sales`, icon: DollarSign },
          { label: "Future Planning", href: `/gyms/${gymId}/planning`, icon: Target },
        ].map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="hover-elevate transition-all duration-300 cursor-pointer group" data-testid={`gateway-${link.label.toLowerCase().replace(/\s+/g, "-")}`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <link.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-sm font-medium">{link.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function RSIDial({ value, testId }: { value: number; testId: string }) {
  const radius = 40;
  const strokeWidth = 6;
  const center = 50;
  const circumference = 2 * Math.PI * radius;
  const startAngle = 135;
  const totalArc = 270;
  const arcLength = (totalArc / 360) * circumference;
  const filledLength = (value / 100) * arcLength;
  const dashOffset = arcLength - filledLength;

  const color = value >= 80
    ? { stroke: "hsl(var(--primary))", glow: "hsl(var(--primary) / 0.25)", label: "Stable" }
    : value >= 60
      ? { stroke: "#f59e0b", glow: "rgba(245, 158, 11, 0.25)", label: "Moderate" }
      : { stroke: "#ef4444", glow: "rgba(239, 68, 68, 0.25)", label: "Unstable" };

  return (
    <div className="flex flex-col items-center justify-center space-y-1 flex-shrink-0" data-testid={testId}>
      <div className="relative w-[100px] h-[85px]">
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference - arcLength}`}
            strokeDashoffset={-(circumference - arcLength) / 2 - ((360 - totalArc) / 360) * circumference / 2}
            transform={`rotate(${startAngle} ${center} ${center})`}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference - arcLength}`}
            strokeDashoffset={-(circumference - arcLength) / 2 - ((360 - totalArc) / 360) * circumference / 2}
            transform={`rotate(${startAngle} ${center} ${center})`}
            className="animate-progress-ring"
            style={{
              filter: `drop-shadow(0 0 4px ${color.glow})`,
              "--ring-circumference": `${arcLength}`,
              "--ring-offset": `${dashOffset}`,
            } as React.CSSProperties}
          />
          <text
            x={center}
            y={center - 2}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-foreground animate-count-up-pulse"
            style={{ fontSize: "18px", fontWeight: 700, fontFamily: "var(--font-mono, monospace)" }}
          >
            {value}
          </text>
          <text
            x={center}
            y={center + 14}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-muted-foreground"
            style={{ fontSize: "7px", fontWeight: 500 }}
          >
            / 100
          </text>
        </svg>
        <div
          className="absolute -top-1 left-1/2 w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: color.stroke,
            boxShadow: `0 0 6px 2px ${color.glow}`,
            animation: "rsi-pulse 2.5s ease-in-out infinite",
          }}
        />
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-muted-foreground">RSI</p>
        <p className="text-[10px] text-muted-foreground/70">Retention Stability Index</p>
      </div>
    </div>
  );
}

function ScoreCard({
  icon: Icon,
  label,
  fullName,
  value,
  suffix,
  status,
  testId,
}: {
  icon: typeof Gauge;
  label: string;
  fullName?: string;
  value: string;
  suffix?: string;
  status?: "good" | "moderate" | "risk";
  testId: string;
}) {
  const statusColor = status === "good"
    ? "text-primary"
    : status === "risk"
      ? "text-red-600 dark:text-red-400"
      : "";

  const indicatorColor = status === "good"
    ? "bg-primary"
    : status === "risk"
      ? "bg-red-500"
      : status === "moderate"
        ? "bg-amber-500"
        : "bg-muted";

  return (
    <Card className="hover-elevate transition-all duration-300" data-testid={testId}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${indicatorColor}`} />
            <div>
              <span className="text-xs text-muted-foreground font-medium">{label}</span>
              {fullName && <p className="text-[10px] text-muted-foreground/70 leading-tight">{fullName}</p>}
            </div>
          </div>
          <Icon className="w-4 h-4 text-primary/60" />
        </div>
        <p className={`text-2xl font-bold font-mono tracking-tight ${statusColor}`}>
          {value}
          {suffix && <span className="text-sm font-normal text-muted-foreground">{suffix}</span>}
        </p>
      </CardContent>
    </Card>
  );
}

function SmallMetric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return (
    <Card className="hover-elevate transition-all duration-300">
      <CardContent className="p-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-primary/50" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <span className="font-mono text-sm font-semibold">{value}</span>
      </CardContent>
    </Card>
  );
}

function TrendIndicator({ direction, value }: { direction: MetricReport["trendDirection"]; value: string }) {
  if (direction === "none") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
        <Minus className="w-3 h-3" />
        {value}
      </span>
    );
  }
  if (direction === "stable") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
        <Minus className="w-3 h-3" />
        Stable
      </span>
    );
  }
  const isPositive = direction === "up";
  return (
    <span className={`flex items-center gap-1 text-xs font-mono ${isPositive ? "text-primary" : "text-red-600 dark:text-red-400"}`}>
      {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {value}
    </span>
  );
}

function ReportCard({ report, gymId, atRiskMembers, monthDate }: { report: MetricReport; gymId: string; atRiskMembers?: AtRiskMember[]; monthDate: string }) {
  const isHighRisk = report.metric === "Monthly Churn" && parseFloat(report.current) > 7;
  const isRiskRadar = report.metric === "Member Risk Radar";

  return (
    <Card className="hover-elevate transition-all duration-300" data-testid={`report-${report.metric.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {isHighRisk && <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400" />}
              <h3 className="font-semibold text-sm">{report.metric}</h3>
            </div>
            <div className="flex flex-wrap items-baseline gap-4 font-mono">
              <span className="text-xl font-bold">{report.current}</span>
              <span className="text-xs text-muted-foreground">Target: {report.target}</span>
              <TrendIndicator direction={report.trendDirection} value={report.trendValue} />
            </div>
          </div>
          {isRiskRadar && report.current.includes("flagged") && (
            <RiskTierBadge current={report.current} />
          )}
        </div>

        <div className="p-3 rounded-md bg-muted/50">
          <p className="text-xs font-medium text-primary font-mono">{report.impact}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-3 h-3 text-primary" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What This Means</p>
            </div>
            <p className="text-sm leading-relaxed break-words">{report.meaning}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Target className="w-3 h-3 text-primary" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Why It Matters</p>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground break-words">{report.whyItMatters}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Activity className="w-3 h-3 text-primary" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What To Do Next</p>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground break-words">{report.action}</p>
          </div>
        </div>

        {isRiskRadar && atRiskMembers && atRiskMembers.length > 0 && (() => {
          const ghostMembers = atRiskMembers.filter(m => m.riskCategory === "ghost");
          const atRiskOnly = atRiskMembers.filter(m => m.riskCategory === "at-risk");
          const drifterMembers = atRiskMembers.filter(m => m.riskCategory === "drifter");
          const sections: { label: string; members: AtRiskMember[]; color: string; watchList?: boolean }[] = [
            { label: "Ghost", members: ghostMembers, color: "bg-red-500" },
            { label: "At-Risk", members: atRiskOnly, color: "bg-amber-500" },
            { label: "Drifting — Watch List", members: drifterMembers, color: "bg-yellow-400", watchList: true },
          ];
          return (
            <div className="border-t pt-4 space-y-4" data-testid="section-flagged-members">
              {sections.map(({ label, members, color }) => members.length > 0 && (
                <div key={label} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${color}`} />
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {label} ({members.length})
                    </p>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {members.map((m) => (
                      <FlaggedMemberCard key={m.id} member={m} gymId={gymId} monthDate={monthDate} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}

function FlaggedMemberCard({ member: m, gymId, monthDate }: { member: AtRiskMember; gymId: string; monthDate: string }) {
  const { toast } = useToast();
  const { label, description } = getRiskReason(m);

  const contactMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/gyms/${gymId}/members/${m.id}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ note: "Outreach logged from risk radar" }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Contact logged", description: `Outreach to ${m.name} recorded.` });
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "report", monthDate] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/api/login";
        return;
      }
      toast({ title: "Error", description: "Failed to log contact. Try again.", variant: "destructive" });
    },
  });

  const contactedRecently = m.lastContacted
    ? (Date.now() - new Date(m.lastContacted).getTime()) < 7 * 24 * 60 * 60 * 1000
    : false;

  return (
    <div
      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
      data-testid={`row-risk-member-${m.id}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{m.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {new Date(m.joinDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          {m.lastContacted && (
            <span className="ml-1 text-primary">
              {" "}· Contacted {new Date(m.lastContacted).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Badge variant="outline" className="text-[10px] cursor-default whitespace-nowrap">
                {label}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[220px] text-xs">
            {description}
          </TooltipContent>
        </Tooltip>
        {!contactedRecently && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                disabled={contactMutation.isPending}
                onClick={() => contactMutation.mutate()}
                data-testid={`button-contact-${m.id}`}
              >
                <Phone className="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Log outreach
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

function getRiskReason(member: AtRiskMember): { label: string; description: string } {
  const pct = Math.round(member.churnProbability * 100);
  if (member.riskCategory === "ghost") {
    return {
      label: `Ghost · ${pct}% churn risk`,
      description: "This member has essentially disengaged. Without direct personal intervention — a phone call, not a text — they are very likely to cancel. Reference their history, express that they are missed, and offer a specific re-entry path: a class with their favorite coach, a goal-setting session, or an invitation to a community event."
    };
  }
  if (member.riskCategory === "at-risk") {
    return {
      label: `At-Risk · ${pct}% churn risk`,
      description: "This member is showing significant disengagement signals but hasn't fully checked out. A personal check-in from their coach — asking about their goals, acknowledging their effort, and scheduling their next class — can interrupt the drift before it becomes a cancellation."
    };
  }
  return {
    label: `Drifting · ${pct}% churn risk`,
    description: "Early signs of disengagement. The connection is fading but the window to re-engage is still wide open. A casual coach check-in — referencing a specific milestone or asking about a goal — can prevent the slow slide toward cancellation."
  };
}

function RiskTierBadge({ current }: { current: string }) {
  const count = parseInt(current);
  const tier = isNaN(count) ? "Clear" : count > 10 ? "High" : count > 3 ? "Moderate" : count > 0 ? "Low" : "Clear";
  const variant = tier === "High" ? "destructive" : "secondary";
  return (
    <Badge variant={variant} className="text-xs">
      {tier} Risk
    </Badge>
  );
}

function ForecastSection({ forecast }: { forecast: Forecast }) {
  const mrrDelta = forecast.mrrChange;
  const isPositive = mrrDelta >= 0;
  const revenueAtRisk = forecast.ifNothingChanges.revenueAtRisk;

  return (
    <Card data-testid="section-forecast">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">What Happens Next</h3>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Projected MRR</p>
            <p className="text-lg font-bold font-mono" data-testid="text-forecast-mrr">
              ${forecast.nextMonthMrr.toLocaleString()}
            </p>
            <p className={`text-xs font-mono ${isPositive ? "text-primary" : "text-red-500 dark:text-red-400"}`}>
              {isPositive ? "+" : ""}{mrrDelta.toLocaleString()} vs. current
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Churn Trajectory</p>
            <p className="text-sm font-medium" data-testid="text-forecast-churn-trajectory">{forecast.churnTrajectory}</p>
            <p className="text-xs text-muted-foreground font-mono">Projected: {forecast.projectedChurn}%</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">90-Day Revenue at Risk</p>
            <p className={`text-lg font-bold font-mono ${revenueAtRisk > 0 ? "text-red-500 dark:text-red-400" : "text-primary"}`} data-testid="text-forecast-risk">
              ${revenueAtRisk.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-md bg-muted/50 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">If Nothing Changes (3 months)</p>
          <div className="flex flex-wrap gap-6 text-sm font-mono">
            <span>MRR: <span className="font-bold">${forecast.ifNothingChanges.mrrIn3Months.toLocaleString()}</span></span>
            <span>Members: <span className="font-bold">{forecast.ifNothingChanges.membersIn3Months}</span></span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Outlook</p>
          <p className="text-sm leading-relaxed" data-testid="text-forecast-outlook">{forecast.outlook}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function OnboardingChecklist({ gymId, month }: { gymId: string; month: string }) {
  const { data: members } = useQuery<any[]>({
    queryKey: ["/api/gyms", gymId, "members", "enriched"],
    queryFn: async () => {
      const res = await fetch(`/api/gyms/${gymId}/members/enriched`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const hasMembers = members && members.length > 0;

  const steps = [
    {
      id: "import",
      label: "Import your member roster",
      description: "Upload a CSV from Wodify, PushPress, Zen Planner, or any spreadsheet.",
      done: !!hasMembers,
      href: `/gyms/${gymId}/import`,
      icon: Upload,
    },
    {
      id: "recompute",
      label: "Generate your first stability report",
      description: "Once members are imported, compute your retention metrics.",
      done: false,
      action: "recompute",
      icon: RefreshCw,
    },
    {
      id: "review",
      label: "Review your Command Center",
      description: "Explore RSI, churn rate, member risk, and strategic recommendations.",
      done: false,
      icon: Activity,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progress = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <Card className="border-dashed">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Gauge className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-lg font-bold" data-testid="text-onboarding-title">Set Up Your Stability Engine</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Complete these steps to unlock your retention intelligence for {month}.
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>{completedCount} of {steps.length} complete</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
                data-testid="progress-onboarding"
              />
            </div>
          </div>

          <div className="max-w-md mx-auto space-y-3">
            {steps.map((step, i) => (
              <div
                key={step.id}
                className={`flex items-start gap-4 p-4 rounded-lg border ${
                  step.done
                    ? "bg-primary/5 border-primary/20"
                    : i === completedCount
                    ? "bg-card border-border shadow-sm"
                    : "bg-muted/30 border-transparent opacity-60"
                }`}
                data-testid={`step-${step.id}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step.done
                      ? "bg-primary text-primary-foreground"
                      : i === completedCount
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.done ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <step.icon className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className={`text-sm font-medium ${step.done ? "line-through text-muted-foreground" : ""}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                  {!step.done && i === completedCount && step.href && (
                    <Link href={step.href}>
                      <Button size="sm" className="mt-2" data-testid={`button-${step.id}`}>
                        <step.icon className="w-3.5 h-3.5 mr-1" />
                        Get Started
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MembersView({ gymId }: { gymId: string }) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<MemberFilter>("all");
  const [selectedMember, setSelectedMember] = useState<EnrichedMember | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: members, isLoading } = useQuery<EnrichedMember[]>({
    queryKey: ["/api/gyms", gymId, "members", "enriched"],
    queryFn: async () => {
      const res = await fetch(`/api/gyms/${gymId}/members/enriched`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center space-y-4">
          <Users className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">No members imported yet.</p>
          <Link href={`/gyms/${gymId}/import`}>
            <Button variant="outline">
              <Upload className="w-4 h-4 mr-1" />
              Import CSV
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const activeMembers = members.filter((m) => m.status === "active");
  const activeCount = activeMembers.length;
  const cancelledCount = members.filter((m) => m.status === "cancelled").length;
  const highRiskCount = activeMembers.filter((m) => m.risk === "high").length;
  const noContactCount = activeMembers.filter((m) => m.daysSinceContact === null || m.daysSinceContact > 7).length;
  const newCount = activeMembers.filter((m) => m.tenureDays <= 60).length;
  const highValueCount = activeMembers.filter((m) => m.isHighValue).length;

  let filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (activeFilter === "high-risk") filtered = filtered.filter((m) => m.risk === "high" && m.status === "active");
  else if (activeFilter === "no-contact") filtered = filtered.filter((m) => (m.daysSinceContact === null || m.daysSinceContact > 7) && m.status === "active");
  else if (activeFilter === "new") filtered = filtered.filter((m) => m.tenureDays <= 60 && m.status === "active");
  else if (activeFilter === "high-value") filtered = filtered.filter((m) => m.isHighValue && m.status === "active");
  else if (activeFilter === "pre-60") filtered = filtered.filter((m) => m.tenureDays > 14 && m.tenureDays <= 60 && m.status === "active");

  const riskOrder = { high: 0, medium: 1, low: 2 };
  filtered.sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (a.status !== "active" && b.status === "active") return 1;
    return riskOrder[a.risk] - riskOrder[b.risk];
  });

  const pre60Count = activeMembers.filter((m) => m.tenureDays > 14 && m.tenureDays <= 60).length;

  const filters: { key: MemberFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: members.length },
    { key: "high-risk", label: "High Risk", count: highRiskCount },
    { key: "no-contact", label: "Needs Outreach", count: noContactCount },
    { key: "new", label: "New (< 60 days)", count: newCount },
    { key: "high-value", label: "High Value", count: highValueCount },
    { key: "pre-60", label: "Pre-Habit Window", count: pre60Count },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40 bg-background pb-3 pt-1 border-b">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" data-testid="badge-active-count">{activeCount} active</Badge>
          <Badge variant="outline" data-testid="badge-cancelled-count">{cancelledCount} cancelled</Badge>
          {highRiskCount > 0 && (
            <Badge variant="destructive" data-testid="badge-risk-count">
              {highRiskCount} at risk
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-members"
            />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  window.open(`/api/gyms/${gymId}/export/members`, "_blank");
                }}
                data-testid="button-export-members"
              >
                <Download className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Export members CSV</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" data-testid="section-member-filters">
        {filters.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={activeFilter === f.key ? "default" : "outline"}
            onClick={() => setActiveFilter(f.key)}
            data-testid={`filter-${f.key}`}
          >
            {f.label}
            <span className="ml-1.5 text-xs opacity-70">{f.count}</span>
          </Button>
        ))}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-[90px]">Risk</TableHead>
                <TableHead>Last Touchpoint</TableHead>
                <TableHead>Tenure</TableHead>
                <TableHead>Monthly Rate</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((member) => (
                <TableRow
                  key={member.id}
                  className="cursor-pointer hover-elevate"
                  onClick={() => navigate(`/gyms/${gymId}/members/${member.id}`)}
                  data-testid={`row-member-${member.id}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <RiskDot risk={member.status === "active" ? member.risk : "low"} />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{member.name}</p>
                        {member.email && (
                          <p className="text-[11px] text-muted-foreground truncate">{member.email}</p>
                        )}
                      </div>
                      {member.isHighValue && member.status === "active" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Star className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">Top 20% revenue</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {member.status === "active" ? (
                      <RiskBadge risk={member.risk} />
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Cancelled</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <ContactRecency daysSinceContact={member.daysSinceContact} lastContacted={member.lastContacted} />
                  </TableCell>
                  <TableCell>
                    <TenureDisplay tenureMonths={member.tenureMonths} tenureDays={member.tenureDays} />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    ${Number(member.monthlyRate).toFixed(0)}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No members match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <MemberDrawer
        member={selectedMember}
        gymId={gymId}
        onClose={() => setSelectedMember(null)}
      />
    </div>
  );
}

function RiskDot({ risk }: { risk: "low" | "medium" | "high" }) {
  const colors = {
    high: "bg-red-500 dark:bg-red-400",
    medium: "bg-amber-500 dark:bg-amber-400",
    low: "bg-primary",
  };
  return <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[risk]}`} />;
}

function RiskBadge({ risk }: { risk: "low" | "medium" | "high" }) {
  const config = {
    high: { variant: "destructive" as const, icon: ShieldAlert, label: "High" },
    medium: { variant: "secondary" as const, icon: Shield, label: "Medium" },
    low: { variant: "outline" as const, icon: ShieldCheck, label: "Low" },
  };
  const c = config[risk];
  return (
    <Badge variant={c.variant} className="text-[10px] gap-1">
      <c.icon className="w-3 h-3" />
      {c.label}
    </Badge>
  );
}

function ContactRecency({ daysSinceContact, lastContacted }: { daysSinceContact: number | null; lastContacted: string | null }) {
  if (daysSinceContact === null || !lastContacted) {
    return <span className="text-xs text-muted-foreground">No contact</span>;
  }
  const color = daysSinceContact <= 3
    ? "text-primary"
    : daysSinceContact <= 7
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-500 dark:text-red-400";

  const label = daysSinceContact === 0
    ? "Today"
    : daysSinceContact === 1
      ? "Yesterday"
      : `${daysSinceContact}d ago`;

  return <span className={`text-xs font-mono ${color}`}>{label}</span>;
}

function TenureDisplay({ tenureMonths, tenureDays }: { tenureMonths: number; tenureDays: number }) {
  if (tenureDays < 30) {
    return <span className="text-xs font-mono">{tenureDays}d</span>;
  }
  return (
    <span className="text-xs font-mono">
      {tenureMonths} {tenureMonths === 1 ? "mo" : "mos"}
    </span>
  );
}

function getRecommendedAction(member: EnrichedMember): string {
  const isHighRisk = member.risk === "high";
  const hasNeverBeenContacted = member.daysSinceContact === null;
  const isLongSilent = member.daysSinceContact !== null && member.daysSinceContact > 60;
  const isDrifting = member.daysSinceContact !== null && member.daysSinceContact > 30;

  if (member.tenureDays <= 14) {
    if (hasNeverBeenContacted) {
      return "This member is in their first two weeks — the highest-risk window. Send a personal follow-up today asking how their first classes felt. Introduce them to at least 3 other members by name. The target is 3 classes in their first 7 days. Members who complete structured onboarding extend their average retention from 78 days to 8 months.";
    }
    return "First two weeks. Ensure they have a clear schedule recommendation, have been introduced to other members, and feel welcomed beyond the workout. A 30-day goal-setting session should already be on the calendar. Early wins — a PR, a skill milestone, a coach callout — build the momentum that turns trial into commitment.";
  }

  if (member.tenureDays <= 30) {
    return "In their first month. Schedule a goal-setting session this week to define 3 specific, measurable targets. Ask what is working and what could be better. Members who complete a goal review within their first 90 days are 3 times more likely to reach the 6-month mark. Address any scheduling friction or social discomfort now, before it becomes a cancellation reason.";
  }

  if (member.tenureDays <= 90) {
    if (isHighRisk) {
      return "In the first 90 days and showing risk signals. The novelty is wearing off and the habit has not solidified. Schedule a goal review immediately — show them any progress they have made, set 3 new targets, and pair them with a workout buddy. Celebrate any wins publicly. Without intervention in this window, most gyms lose these members.";
    }
    return "In the pre-habit window. Visible progress tracking and social connections determine whether they stay. If their first quarterly goal review has not happened yet, schedule it now. Show them measurable improvement, celebrate milestones, and deepen their connection to at least one coach and one other member.";
  }

  if (member.tenureDays <= 270) {
    if (isHighRisk || isLongSilent) {
      return "5 to 9 months in — the identity formation period. This member's connection to the gym is weakening. The gym needs to become part of who they are, not just where they work out. A direct call from their coach, referencing their progress and goals, is the intervention. Invite them to a community event or challenge. Ask if their schedule still works. Compatibility and belonging are the levers here.";
    }
    if (isDrifting) {
      return "Mid-tenure member showing signs of drift. Schedule a goal review to reset motivation. Ask what is working and what is not. Introduce a new challenge — a skill progression, a competition, or a community event. Members at this stage need to feel that the gym sees them as an individual, not just a membership number.";
    }
    return "Established member in the engagement window. Ensure quarterly goal reviews are happening consistently. Look for opportunities to deepen their involvement: community events, bring-a-friend invitations, or small leadership roles. Members who refer someone stay approximately 6 months longer.";
  }

  if (member.tenureDays <= 365) {
    if (isHighRisk) {
      return "Approaching the critical one-year mark with risk signals. This is a pivotal moment — a goal review showing tangible progress over the year is essential. Show them how far they have come since joining. Set ambitious but achievable goals for year two. Consider offering a leadership opportunity or competition entry. The identity-level connection that keeps members beyond year one requires demonstrating that this gym is invested in their future.";
    }
    return "Approaching the one-year mark. Conduct a comprehensive annual review: celebrate their journey, show measurable progress, and set year-two goals. This is the moment to invite deeper engagement — competition participation, a referral, or a mentorship role with newer members. Members who cross the one-year threshold with clear forward direction tend to stay for 2 or more years.";
  }

  if (isHighRisk || isLongSilent) {
    return "Long-tenure member showing risk signals. These members are the hardest to replace and the most valuable to retain. A direct, personal call from their coach is non-negotiable. Acknowledge their history with the gym, ask what has changed, and offer flexibility — schedule adjustments, a membership pause, or a different class format. Losing a member with this much tenure costs far more than the effort to save them.";
  }

  if (hasNeverBeenContacted) {
    return "Long-standing member who has never received personal outreach. They have stayed on their own momentum, but that is not a system. A goal review that acknowledges their loyalty, celebrates their milestones, and sets forward-looking targets converts a passive member into an ambassador. Ask if they would be open to mentoring a newer member or bringing a friend to a workout.";
  }

  return "Established member in good standing. Ensure quarterly goal reviews continue, celebrate milestones, and look for referral opportunities. Members who feel seen, challenged, and connected to the community are the ones who stay for years and bring others with them.";
}

function MemberDrawer({ member, gymId, onClose }: { member: EnrichedMember | null; gymId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [note, setNote] = useState("");

  const { data: contactHistory } = useQuery<MemberContact[]>({
    queryKey: ["/api/gyms", gymId, "members", member?.id, "contacts"],
    queryFn: async () => {
      const res = await fetch(`/api/gyms/${gymId}/members/${member!.id}/contacts`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!member,
  });

  const contactMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/gyms/${gymId}/members/${member!.id}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ note: note || "Touchpoint logged" }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Touchpoint logged", description: `Contact with ${member!.name} recorded.` });
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "members", "enriched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "members", member!.id, "contacts"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/api/login";
        return;
      }
      toast({ title: "Error", description: "Failed to log contact.", variant: "destructive" });
    },
  });

  const rate = member ? Number(member.monthlyRate) : 0;

  return (
    <Sheet open={!!member} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {member && (
          <>
            <SheetHeader className="space-y-1 pr-8">
              <SheetTitle className="flex items-center gap-2">
                <RiskDot risk={member.status === "active" ? member.risk : "low"} />
                {member.name}
                {member.isHighValue && member.status === "active" && (
                  <Star className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                )}
              </SheetTitle>
              <SheetDescription>
                {member.email || "No email on file"}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                  <Badge variant={member.status === "active" ? "default" : "outline"} className="text-xs">
                    {member.status}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Risk</p>
                  <RiskBadge risk={member.risk} />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tenure</p>
                  <p className="text-sm font-mono font-medium">
                    {member.tenureMonths > 0 ? `${member.tenureMonths} months` : `${member.tenureDays} days`}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Monthly Rate</p>
                  <p className="text-sm font-mono font-medium">${rate.toFixed(0)}/mo</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Total Revenue</p>
                  <p className="text-sm font-mono font-medium">${member.totalRevenue.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Joined</p>
                  <p className="text-sm">
                    {new Date(member.joinDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              </div>

              {member.riskReasons.length > 0 && member.status === "active" && (
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Risk Signals</p>
                  <div className="flex flex-wrap gap-1">
                    {member.riskReasons.map((r, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {member.status === "active" && (
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Recommended Action</p>
                  <div className="p-3 rounded-md bg-muted/50 text-sm leading-relaxed" data-testid="text-recommended-action">
                    {getRecommendedAction(member)}
                  </div>
                </div>
              )}

              <div className="border-t pt-4 space-y-3">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Log Touchpoint</p>
                <Textarea
                  placeholder="Quick note about this interaction..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="text-sm resize-none"
                  rows={2}
                  data-testid="input-contact-note"
                />
                <Button
                  size="sm"
                  onClick={() => contactMutation.mutate()}
                  disabled={contactMutation.isPending}
                  data-testid="button-log-touchpoint"
                >
                  <Phone className="w-3.5 h-3.5 mr-1" />
                  {contactMutation.isPending ? "Logging..." : "Log Touchpoint"}
                </Button>
              </div>

              <div className="border-t pt-4 space-y-3">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Contact History</p>
                {(!contactHistory || contactHistory.length === 0) ? (
                  <p className="text-xs text-muted-foreground">No contact history yet.</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {contactHistory.slice(0, 20).map((c) => (
                      <div key={c.id} className="flex items-start gap-2 text-xs">
                        <MessageSquare className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-muted-foreground">
                            {c.contactedAt ? new Date(c.contactedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Unknown"}
                          </p>
                          {c.note && <p className="text-foreground mt-0.5">{c.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

type DateRange = "3m" | "6m" | "12m" | "all";

function TrendsView({ gymId }: { gymId: string }) {
  const { data: intelligence, isLoading: intellLoading } = useQuery<TrendIntelligence>({
    queryKey: ["/api/gyms", gymId, "trends", "intelligence"],
  });
  const [showTargetPath, setShowTargetPath] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>("all");

  if (intellLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 rounded-md" />
        <Skeleton className="h-32 rounded-md" />
        <div className="grid lg:grid-cols-2 gap-6">
          {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-80 rounded-md" />)}
        </div>
      </div>
    );
  }

  if (!intelligence || intelligence.projections.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center space-y-4">
          <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Not enough data for trend analysis.</p>
          <p className="text-sm text-muted-foreground">Import members and recompute metrics to build your intelligence layer.</p>
        </CardContent>
      </Card>
    );
  }

  const { insights, microKpis, projections, correlations, stabilityScore, ninetyDayOutlook, targetPath, strategicRecommendations, growthEngine } = intelligence;
  const getInsight = (key: string) => insights.find((i) => i.chartKey === key);
  const getKpi = (key: string) => microKpis.find((k) => k.chartKey === key);

  const fmtMonth = (m: string) => new Date(m + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" });

  const chartData = projections.map((p) => ({
    month: fmtMonth(p.month),
    mrr: p.projected ? null : p.mrr,
    mrrProjected: p.projected ? p.mrr : null,
    members: p.projected ? null : p.members,
    membersProjected: p.projected ? p.members : null,
    churn: p.projected ? null : p.churn,
    churnProjected: p.projected ? p.churn : null,
    rsi: p.projected ? null : p.rsi,
    rsiProjected: p.projected ? p.rsi : null,
    arm: p.projected ? null : p.arm,
    armProjected: p.projected ? p.arm : null,
    projected: p.projected,
  }));

  const lastActualIdx = chartData.findIndex((d) => d.projected) - 1;
  if (lastActualIdx >= 0 && lastActualIdx < chartData.length - 1) {
    const b = chartData[lastActualIdx];
    chartData[lastActualIdx] = { ...b, mrrProjected: b.mrr, membersProjected: b.members, churnProjected: b.churn, rsiProjected: b.rsi, armProjected: b.arm };
    const n = chartData[lastActualIdx + 1];
    chartData[lastActualIdx + 1] = { ...n, mrrProjected: n.mrrProjected ?? b.mrr, membersProjected: n.membersProjected ?? b.members, churnProjected: n.churnProjected ?? b.churn, rsiProjected: n.rsiProjected ?? b.rsi, armProjected: n.armProjected ?? b.arm };
  }

  const rangeSlice = dateRange === "3m" ? -3 : dateRange === "6m" ? -6 : dateRange === "12m" ? -12 : undefined;
  const filteredChartData = rangeSlice ? chartData.slice(rangeSlice) : chartData;

  const tierColors = {
    "stable": { bg: "bg-primary/10 dark:bg-primary/15", border: "border-primary/30", text: "text-primary", dot: "bg-primary", barColor: "hsl(var(--primary))" },
    "plateau-risk": { bg: "bg-amber-500/10 dark:bg-amber-500/15", border: "border-amber-500/30", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500", barColor: "#f59e0b" },
    "early-drift": { bg: "bg-orange-500/10 dark:bg-orange-500/15", border: "border-orange-500/30", text: "text-orange-700 dark:text-orange-400", dot: "bg-orange-500", barColor: "#f97316" },
    "instability-risk": { bg: "bg-red-500/10 dark:bg-red-500/15", border: "border-red-500/30", text: "text-red-700 dark:text-red-400", dot: "bg-red-500", barColor: "#ef4444" },
  };
  const tc = tierColors[stabilityScore.tier];

  const targetPathData = targetPath.map((t) => ({
    month: fmtMonth(t.month),
    current: t.currentTrajectory,
    target: t.targetTrajectory,
  }));

  const growthData = growthEngine.cumulativeData.map((g) => ({
    month: fmtMonth(g.month),
    cumulative: g.cumulative,
    joins: g.joins,
    cancels: -g.cancels,
  }));

  const outlookStatusColor = (status: string) => {
    if (status === "growing" || status === "within-tolerance") return "text-primary";
    if (status === "stable") return "text-muted-foreground";
    if (status === "at-risk" || status === "elevated") return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const interventionColors = {
    none: { text: "text-primary", label: "None" },
    low: { text: "text-muted-foreground", label: "Low" },
    moderate: { text: "text-amber-600 dark:text-amber-400", label: "Moderate" },
    high: { text: "text-red-600 dark:text-red-400", label: "High" },
  };

  const dynamicBg = stabilityScore.score >= 85
    ? "bg-gradient-to-br from-background via-background to-primary/[0.03] dark:to-primary/[0.04]"
    : stabilityScore.score < 60
      ? "bg-gradient-to-br from-background via-background to-red-500/[0.03] dark:to-red-500/[0.06]"
      : "";

  const dateRanges: { label: string; value: DateRange }[] = [
    { label: "3M", value: "3m" },
    { label: "6M", value: "6m" },
    { label: "12M", value: "12m" },
    { label: "All", value: "all" },
  ];

  return (
    <div className={`space-y-8 rounded-lg transition-colors duration-700 ${dynamicBg}`} style={{ background: dynamicBg ? undefined : "linear-gradient(135deg, hsl(var(--background)) 0%, hsl(215 18% 12% / 0.03) 100%)" }}>
      <div className="flex items-center justify-end gap-1" data-testid="date-range-selector">
        {dateRanges.map((r) => (
          <Button
            key={r.value}
            variant={dateRange === r.value ? "default" : "ghost"}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => setDateRange(r.value)}
            data-testid={`button-range-${r.value}`}
          >
            {r.label}
          </Button>
        ))}
      </div>
      {/* ── EXECUTIVE HEALTH + 90-DAY OUTLOOK ── */}
      <Card className={`${tc.bg} border ${tc.border} animate-fade-in-up`} data-testid="section-stability-score">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${tc.dot}`} />
                <h2 className={`text-lg font-bold ${tc.text}`} data-testid="text-stability-headline">
                  {stabilityScore.headline}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-stability-detail">
                {stabilityScore.detail}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {Object.entries(stabilityScore.components).map(([key, comp]) => {
                  const isRsi = key === "rsiSlope";
                  const lastActualProjection = projections.filter(p => !p.projected).slice(-1)[0];
                  const actualRsi = lastActualProjection?.rsi ?? 0;
                  const displayScore = isRsi ? actualRsi : comp.score;
                  const displayMax = isRsi ? 100 : 25;
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          {isRsi ? "RSI" : key === "churnAvg" ? "Churn" : key === "netGrowth" ? "Growth" : "Revenue"}
                        </span>
                        <span className="text-xs font-mono font-semibold">{displayScore}/{displayMax}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${(displayScore / displayMax) * 100}%`, backgroundColor: tc.barColor }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground">{comp.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="lg:w-80 space-y-3">
              <div className={`rounded-md p-4 space-y-3 border-l-[3px] ${
                ninetyDayOutlook.interventionRequired === "none" ? "bg-primary/5 border-l-primary/50" :
                ninetyDayOutlook.interventionRequired === "low" ? "bg-muted/50 border-l-muted-foreground/30" :
                ninetyDayOutlook.interventionRequired === "moderate" ? "bg-amber-500/5 border-l-amber-500/50" :
                "bg-red-500/5 border-l-red-500/50"
              }`}>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Target className="w-3.5 h-3.5" />
                  90-Day Outlook
                </h3>
                <div className="space-y-2.5" data-testid="section-90day-outlook">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        ninetyDayOutlook.revenue.status === "growing" || ninetyDayOutlook.revenue.status === "within-tolerance" ? "bg-primary" :
                        ninetyDayOutlook.revenue.status === "stable" ? "bg-muted-foreground/50" :
                        ninetyDayOutlook.revenue.status === "at-risk" || ninetyDayOutlook.revenue.status === "elevated" ? "bg-amber-500" : "bg-red-500"
                      }`} />
                      <span className="text-xs text-muted-foreground">Revenue</span>
                    </div>
                    <span className={`text-xs font-semibold ${outlookStatusColor(ninetyDayOutlook.revenue.status)}`} data-testid="text-outlook-revenue">{ninetyDayOutlook.revenue.label}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        ninetyDayOutlook.memberCount.status === "growing" || ninetyDayOutlook.memberCount.status === "within-tolerance" ? "bg-primary" :
                        ninetyDayOutlook.memberCount.status === "stable" ? "bg-muted-foreground/50" :
                        ninetyDayOutlook.memberCount.status === "at-risk" || ninetyDayOutlook.memberCount.status === "elevated" ? "bg-amber-500" : "bg-red-500"
                      }`} />
                      <span className="text-xs text-muted-foreground">Member Count</span>
                    </div>
                    <span className={`text-xs font-semibold ${outlookStatusColor(ninetyDayOutlook.memberCount.status)}`} data-testid="text-outlook-members">{ninetyDayOutlook.memberCount.label}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        ninetyDayOutlook.churn.status === "growing" || ninetyDayOutlook.churn.status === "within-tolerance" ? "bg-primary" :
                        ninetyDayOutlook.churn.status === "stable" ? "bg-muted-foreground/50" :
                        ninetyDayOutlook.churn.status === "at-risk" || ninetyDayOutlook.churn.status === "elevated" ? "bg-amber-500" : "bg-red-500"
                      }`} />
                      <span className="text-xs text-muted-foreground">Churn</span>
                    </div>
                    <span className={`text-xs font-semibold ${outlookStatusColor(ninetyDayOutlook.churn.status)}`} data-testid="text-outlook-churn">{ninetyDayOutlook.churn.label}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-border/50">
                    <span className="text-xs font-semibold">Intervention</span>
                    <Badge variant="outline" className={`text-[10px] font-bold ${interventionColors[ninetyDayOutlook.interventionRequired].text}`} data-testid="text-outlook-intervention">
                      {interventionColors[ninetyDayOutlook.interventionRequired].label}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── STABILITY & RETENTION ── */}
      <div className="space-y-3 animate-fade-in-up animation-delay-100">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" /> Stability & Retention
        </h3>
        <div className="grid lg:grid-cols-2 gap-6">
          <IntelligentChart title="Retention Stability Index" insight={getInsight("rsi")} kpi={getKpi("rsi")} dataKey="rsi" projectedKey="rsiProjected" gradientId="rsiGrad" color="hsl(var(--chart-1))" data={filteredChartData} domain={[0, 100]} formatter={(v: number) => [`${v}/100`, "RSI"]} referenceArea={{ y1: 80, y2: 100, label: "Stable Zone" }} testId="chart-rsi" />
          <IntelligentChurnChart insight={getInsight("churn")} kpi={getKpi("churn")} data={filteredChartData} testId="chart-churn" />
        </div>
      </div>

      {/* ── REVENUE ENGINE ── */}
      <div className="space-y-3 animate-fade-in-up animation-delay-200">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <DollarSign className="w-3.5 h-3.5" /> Revenue Engine
        </h3>
        <div className="grid lg:grid-cols-2 gap-6">
          <Card data-testid="chart-mrr">
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm">Monthly Recurring Revenue</h3>
                  <Button variant="outline" size="sm" onClick={() => setShowTargetPath(!showTargetPath)} data-testid="button-toggle-target">
                    {showTargetPath ? "Hide Target" : "Show Target Path"}
                  </Button>
                </div>
                <KpiBadge kpi={getKpi("mrr")} />
                <InsightHeader insight={getInsight("mrr")} />
              </div>
              {showTargetPath && targetPathData.length > 0 ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={targetPathData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} formatter={(v: number) => [`$${v.toLocaleString()}`, ""]} />
                      <Line type="monotone" dataKey="current" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Current Trajectory" dot={{ r: 3 }} animationDuration={1200} animationBegin={200} />
                      <Line type="monotone" dataKey="target" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="6 4" name="Target Path" dot={false} animationDuration={1200} animationBegin={600} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredChartData}>
                      <defs>
                        <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                      <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} formatter={(v: number) => [`$${v.toLocaleString()}`, "MRR"]} />
                      <Area type="monotone" dataKey="mrr" stroke="hsl(var(--chart-2))" fill="url(#mrrGrad)" strokeWidth={2} connectNulls={false} animationDuration={1200} animationBegin={200} />
                      <Area type="monotone" dataKey="mrrProjected" stroke="hsl(var(--chart-2))" fill="none" strokeWidth={2} strokeDasharray="6 4" strokeOpacity={0.5} connectNulls={false} animationDuration={1200} animationBegin={600} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
          <IntelligentChart title="Revenue per Member" insight={getInsight("arm")} kpi={getKpi("arm")} dataKey="arm" projectedKey="armProjected" gradientId="armGrad" color="hsl(var(--chart-4))" data={filteredChartData} formatter={(v: number) => [`$${v.toFixed(0)}`, "ARM"]} referenceLine={{ y: 150, label: "Target" }} testId="chart-arm" />
        </div>
      </div>

      {/* ── GROWTH ENGINE ── */}
      <div className="space-y-3 animate-fade-in-up animation-delay-300">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <UserPlus className="w-3.5 h-3.5" /> Growth Engine
        </h3>
        <div className="grid lg:grid-cols-2 gap-6">
          <Card data-testid="chart-cumulative-growth">
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Cumulative Net Growth</h3>
                <InsightHeader insight={getInsight("netGrowth")} />
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={growthData}>
                    <defs>
                      <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-5))" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="hsl(var(--chart-5))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} formatter={(v: number) => [`${v >= 0 ? "+" : ""}${v}`, "Net"]} />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="6 4" strokeOpacity={0.4} />
                    <Area type="monotone" dataKey="cumulative" stroke="hsl(var(--chart-5))" fill="url(#cumGrad)" strokeWidth={2} animationDuration={1200} animationBegin={200} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {growthEngine.totalNetGrowth >= 0 ? "+" : ""}{growthEngine.totalNetGrowth} members over {growthEngine.totalMonths} months
              </p>
            </CardContent>
          </Card>

          <JoinsCancelsChart growthData={growthData} />
        </div>
      </div>

      {/* ── LEADING INDICATORS ── */}
      <div className="space-y-3 animate-fade-in-up animation-delay-400">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Radar className="w-3.5 h-3.5" /> Leading Indicators
        </h3>
        <div className="grid lg:grid-cols-2 gap-6">
          <IntelligentChart title="Active Members" insight={getInsight("members")} kpi={getKpi("members")} dataKey="members" projectedKey="membersProjected" gradientId="memGrad" color="hsl(var(--chart-5))" data={filteredChartData} testId="chart-members" />
          {correlations.length > 0 && (
            <Card data-testid="section-correlations">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Correlation Intelligence</h3>
                </div>
                <div className="space-y-3">
                  {correlations.map((c, i) => {
                    const cColors = { positive: { dot: "bg-primary", text: "text-primary" }, warning: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" }, neutral: { dot: "bg-muted-foreground", text: "" } };
                    const cc = cColors[c.status];
                    return (
                      <div key={i} className="rounded-md border p-3 space-y-1" data-testid={`correlation-${i}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cc.dot}`} />
                          <p className={`text-xs font-medium ${cc.text}`}>{c.title}</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{c.detail}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

    </div>
  );
}

function JoinsCancelsChart({ growthData }: { growthData: { month: string; joins: number; cancels: number }[] }) {
  const monthsWithJoins = growthData.filter(g => g.joins > 0);
  const monthsWithCancels = growthData.filter(g => g.cancels < 0);

  const totalJoins = growthData.reduce((s, g) => s + g.joins, 0);
  const totalCancels = growthData.reduce((s, g) => s + Math.abs(g.cancels), 0);
  const avgJoins = growthData.length > 0 ? (totalJoins / growthData.length).toFixed(1) : "0";
  const avgCancels = growthData.length > 0 ? (totalCancels / growthData.length).toFixed(1) : "0";

  const bestMonth = monthsWithJoins.length > 0
    ? monthsWithJoins.reduce((best, g) => g.joins > best.joins ? g : best, monthsWithJoins[0])
    : null;
  const worstMonth = monthsWithCancels.length > 0
    ? monthsWithCancels.reduce((worst, g) => g.cancels < worst.cancels ? g : worst, monthsWithCancels[0])
    : null;

  return (
    <Card data-testid="chart-joins-cancels">
      <CardContent className="p-6 space-y-4">
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Monthly Joins vs Cancellations</h3>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={growthData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} formatter={(v: number, name: string) => [name === "cancels" ? `${Math.abs(v)}` : `${v}`, name === "cancels" ? "Cancellations" : "New Joins"]} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.3} />
              <Bar dataKey="joins" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="joins" animationDuration={800} animationBegin={200} />
              <Bar dataKey="cancels" fill="#ef4444" radius={[0, 0, 3, 3]} name="cancels" animationDuration={800} animationBegin={400} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1" data-testid="joins-cancels-insights">
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Avg Joins / Month</p>
            <p className="text-sm font-bold text-primary" data-testid="text-avg-joins">{avgJoins}</p>
            {bestMonth && (
              <p className="text-[10px] text-muted-foreground" data-testid="text-peak-joins">Peak: {bestMonth.joins} in {bestMonth.month}</p>
            )}
          </div>
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Avg Cancels / Month</p>
            <p className="text-sm font-bold text-red-600 dark:text-red-400" data-testid="text-avg-cancels">{avgCancels}</p>
            {worstMonth && (
              <p className="text-[10px] text-muted-foreground" data-testid="text-worst-cancels">Worst: {Math.abs(worstMonth.cancels)} in {worstMonth.month}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SlopeIcon({ direction }: { direction: "up" | "down" | "flat" }) {
  if (direction === "up") return <ArrowUp className="w-3 h-3 text-primary" />;
  if (direction === "down") return <ArrowDown className="w-3 h-3 text-red-600 dark:text-red-400" />;
  return <Minus className="w-3 h-3 text-muted-foreground" />;
}

function KpiBadge({ kpi }: { kpi?: MicroKpi }) {
  if (!kpi) return null;
  const trendLabel = kpi.trend === "accelerating" ? "Accelerating" : kpi.trend === "decelerating" ? "Decelerating" : "Stable";
  const trendColor = kpi.trend === "accelerating" ? "text-primary" : kpi.trend === "decelerating" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";
  return (
    <div className="flex items-center gap-3 flex-wrap" data-testid="kpi-badge">
      {kpi.mom && (
        <span className="inline-flex items-center gap-1 text-xs">
          <SlopeIcon direction={kpi.momDirection} />
          <span className="font-mono font-medium">{kpi.mom}</span>
          <span className="text-muted-foreground">MoM</span>
        </span>
      )}
      {kpi.yoy && (
        <span className="inline-flex items-center gap-1 text-xs">
          <SlopeIcon direction={kpi.yoyDirection} />
          <span className="font-mono font-medium">{kpi.yoy}</span>
          <span className="text-muted-foreground">YoY</span>
        </span>
      )}
      <span className={`text-[10px] font-medium ${trendColor}`}>
        Trend: {trendLabel}
      </span>
    </div>
  );
}

function InsightHeader({ insight }: { insight?: TrendInsight }) {
  if (!insight) return null;
  const statusConfig = {
    positive: { dot: "bg-primary", text: "text-primary" },
    warning: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
    critical: { dot: "bg-red-500", text: "text-red-700 dark:text-red-400" },
    neutral: { dot: "bg-muted-foreground", text: "text-muted-foreground" },
  };
  const sc = statusConfig[insight.status];
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`} />
        <p className={`text-sm font-semibold ${sc.text}`} data-testid="text-insight-headline">{insight.headline}</p>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{insight.detail}</p>
    </div>
  );
}

function IntelligentChart({ title, insight, kpi, data, dataKey, projectedKey, gradientId, color, domain, yFormatter, formatter, referenceArea, referenceLine, testId }: {
  title: string; insight?: TrendInsight; kpi?: MicroKpi; data: any[]; dataKey: string; projectedKey: string; gradientId: string; color: string; domain?: [number, number]; yFormatter?: (v: number) => string; formatter?: (v: number) => [string, string]; referenceArea?: { y1: number; y2: number; label: string }; referenceLine?: { y: number; label: string }; testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 min-w-0">
            <h3 className="font-semibold text-sm">{title}</h3>
            <InsightHeader insight={insight} />
          </div>
          {kpi && (
            <div className="flex flex-col items-end flex-shrink-0">
              <span className="text-2xl font-bold font-mono tracking-tight" data-testid={`${testId}-value`}>{kpi.currentValue}</span>
              <KpiBadge kpi={kpi} />
            </div>
          )}
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" domain={domain} tickFormatter={yFormatter} />
              <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} formatter={formatter} />
              {referenceArea && <ReferenceArea y1={referenceArea.y1} y2={referenceArea.y2} fill="hsl(var(--primary))" fillOpacity={0.06} stroke="hsl(var(--primary))" strokeOpacity={0.15} strokeDasharray="3 3" />}
              {referenceLine && <ReferenceLine y={referenceLine.y} stroke="hsl(var(--muted-foreground))" strokeDasharray="6 4" strokeOpacity={0.5} label={{ value: referenceLine.label, position: "right", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />}
              <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#${gradientId})`} strokeWidth={2} connectNulls={false} animationDuration={1200} animationBegin={200} />
              <Area type="monotone" dataKey={projectedKey} stroke={color} fill="none" strokeWidth={2} strokeDasharray="6 4" strokeOpacity={0.5} connectNulls={false} animationDuration={1200} animationBegin={600} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function IntelligentChurnChart({ insight, kpi, data, testId }: { insight?: TrendInsight; kpi?: MicroKpi; data: any[]; testId: string }) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 min-w-0">
            <h3 className="font-semibold text-sm">Churn Rate (%)</h3>
            <InsightHeader insight={insight} />
          </div>
          {kpi && (
            <div className="flex flex-col items-end flex-shrink-0">
              <span className="text-2xl font-bold font-mono tracking-tight" data-testid={`${testId}-value`}>{kpi.currentValue}</span>
              <KpiBadge kpi={kpi} />
            </div>
          )}
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `${v}%`} />
              <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} formatter={(value: number) => [`${value}%`, "Churn"]} />
              <ReferenceLine y={5} stroke="#f59e0b" strokeDasharray="6 4" strokeOpacity={0.6} label={{ value: "5% Target", position: "right", fontSize: 10, fill: "#f59e0b" }} />
              <ReferenceArea y1={7} y2={15} fill="#ef4444" fillOpacity={0.04} stroke="#ef4444" strokeOpacity={0.1} strokeDasharray="3 3" />
              <Line type="monotone" dataKey="churn" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} animationDuration={1200} animationBegin={200} />
              <Line type="monotone" dataKey="churnProjected" stroke="hsl(var(--chart-3))" strokeWidth={2} strokeDasharray="6 4" strokeOpacity={0.5} dot={false} connectNulls={false} animationDuration={1200} animationBegin={600} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function GymNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <h2 className="text-xl font-bold">Gym not found</h2>
        <Link href="/">
          <Button variant="outline">Back to Command Center</Button>
        </Link>
      </div>
    </div>
  );
}

function GymDetailSkeleton() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <Skeleton className="h-10 w-64" />
      <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)}
      </div>
    </div>
  );
}
