import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import type { Gym, Member, GymMonthlyMetrics, MemberContact } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import PredictiveIntelligenceView from "./predictive-intelligence";
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
  tenureDays: number;
  lastContacted: string | null;
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

export default function GymDetail() {
  const [, params] = useRoute("/gyms/:id");
  const gymId = params?.id;

  const { data: gym, isLoading: gymLoading } = useQuery<Gym>({
    queryKey: ["/api/gyms", gymId],
  });

  if (gymLoading) return <GymDetailSkeleton />;
  if (!gym) return <GymNotFound />;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
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
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </div>

      <Tabs defaultValue="report">
        <TabsList data-testid="tabs-gym-detail">
          <TabsTrigger value="report" data-testid="tab-report">Report</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
          <TabsTrigger value="predictive" data-testid="tab-predictive">Predictive</TabsTrigger>
        </TabsList>

        <TabsContent value="report" className="mt-8">
          <ReportView gymId={gym.id} />
        </TabsContent>

        <TabsContent value="trends" className="mt-8">
          <TrendsView gymId={gym.id} />
        </TabsContent>

        <TabsContent value="predictive" className="mt-8">
          <PredictiveIntelligenceView gymId={gym.id} gymName={gym.name} />
        </TabsContent>
      </Tabs>
    </div>
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

  const { data, isLoading } = useQuery<{ metrics: GymMonthlyMetrics; reports: MetricReport[]; atRiskMembers: AtRiskMember[]; forecast: Forecast } | null>({
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-36 rounded-md" />)}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setMonthOffset((o) => o - 1)}
            data-testid="button-prev-month"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[160px] text-center" data-testid="text-current-month">
            {displayMonth}
          </h2>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setMonthOffset((o) => Math.min(o + 1, 0))}
            disabled={monthOffset >= 0}
            data-testid="button-next-month"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {!data ? (
        <Card>
          <CardContent className="p-10 text-center space-y-4">
            <Activity className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">
              No metrics available for {displayMonth}.
            </p>
            <p className="text-sm text-muted-foreground">
              Import members and recompute to generate your stability report.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-4 animate-fade-in-up">
            <RSIDial value={data.metrics.rsi} testId="metric-rsi" />
            <ScoreCard
              icon={TrendingDown}
              label="Churn"
              fullName="Monthly Churn Rate"
              value={`${data.metrics.churnRate}`}
              suffix="%"
              status={Number(data.metrics.churnRate) <= 5 ? "good" : Number(data.metrics.churnRate) <= 7 ? "moderate" : "risk"}
              testId="metric-churn"
            />
            <ScoreCard
              icon={DollarSign}
              label="MRR"
              fullName="Monthly Recurring Revenue"
              value={`$${Number(data.metrics.mrr).toLocaleString()}`}
              status={Number(data.metrics.arm) >= 150 ? "good" : Number(data.metrics.arm) >= 100 ? "moderate" : "risk"}
              testId="metric-mrr"
            />
            <ScoreCard
              icon={Users}
              label="Active"
              fullName="Active Members"
              value={String(data.metrics.activeMembers)}
              status={data.metrics.activeMembers >= 50 ? "good" : data.metrics.activeMembers >= 20 ? "moderate" : undefined}
              testId="metric-active"
            />
            <ScoreCard
              icon={Radar}
              label="At Risk"
              fullName="Members at Risk"
              value={String(data.metrics.memberRiskCount)}
              status={data.metrics.memberRiskCount > data.metrics.activeMembers * 0.15 ? "risk" : data.metrics.memberRiskCount > 0 ? "moderate" : "good"}
              testId="metric-risk"
            />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up animation-delay-100">
            <SmallMetric label="Revenue / Member" value={`$${Number(data.metrics.arm).toFixed(0)}`} icon={BarChart3} />
            <SmallMetric label="Lifetime Value" value={`$${Number(data.metrics.ltv).toLocaleString()}`} icon={TrendingUp} />
            <SmallMetric label="New Members" value={String(data.metrics.newMembers)} icon={UserPlus} />
            <SmallMetric label="Cancellations" value={String(data.metrics.cancels)} icon={UserMinus} />
          </div>

          <div className="space-y-6 animate-fade-in-up animation-delay-200" data-testid="section-reports">
            {data.reports.map((report, i) => (
              <ReportCard
                key={i}
                report={report}
                gymId={gymId}
                atRiskMembers={report.metric === "Member Risk Radar" ? data.atRiskMembers : undefined}
                monthDate={monthDate}
              />
            ))}
          </div>

          {data.forecast && <ForecastSection forecast={data.forecast} />}
        </>
      )}
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
    <Card className="hover-elevate transition-all duration-300" data-testid={testId}>
      <CardContent className="p-5 flex flex-col items-center justify-center space-y-1">
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
      </CardContent>
    </Card>
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

        <div className="grid sm:grid-cols-3 gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-3 h-3 text-primary" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What This Means</p>
            </div>
            <p className="text-sm leading-relaxed">{report.meaning}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Target className="w-3 h-3 text-primary" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Why It Matters</p>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{report.whyItMatters}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Activity className="w-3 h-3 text-primary" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What To Do Next</p>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{report.action}</p>
          </div>
        </div>

        {isRiskRadar && atRiskMembers && atRiskMembers.length > 0 && (
          <div className="border-t pt-4 space-y-3" data-testid="section-flagged-members">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Flagged Members</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {atRiskMembers.map((m) => (
                <FlaggedMemberCard key={m.id} member={m} gymId={gymId} monthDate={monthDate} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FlaggedMemberCard({ member: m, gymId, monthDate }: { member: AtRiskMember; gymId: string; monthDate: string }) {
  const { toast } = useToast();
  const { label, description } = getRiskReason(m.tenureDays);

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

function getRiskReason(tenureDays: number): { label: string; description: string } {
  if (tenureDays <= 14)
    return { label: "New member", description: "Joined in the last 2 weeks. Highest cancellation risk — personal outreach now has the greatest impact." };
  if (tenureDays <= 30)
    return { label: "Early stage", description: "In their first month. Still deciding if this gym is the right fit. Check-ins and class introductions reduce drop-off." };
  return { label: "Pre-habit window", description: "30-60 days in. Exercise habits haven't solidified yet. Social connections and routine consistency are key to retention." };
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

function MembersView({ gymId }: { gymId: string }) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<MemberFilter>("all");
  const [selectedMember, setSelectedMember] = useState<EnrichedMember | null>(null);
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
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-members"
          />
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
                  onClick={() => setSelectedMember(member)}
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

function TrendsView({ gymId }: { gymId: string }) {
  const { data: intelligence, isLoading: intellLoading } = useQuery<TrendIntelligence>({
    queryKey: ["/api/gyms", gymId, "trends", "intelligence"],
  });
  const [showTargetPath, setShowTargetPath] = useState(false);

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

  return (
    <div className={`space-y-8 rounded-lg transition-colors duration-700 ${dynamicBg}`} style={{ background: dynamicBg ? undefined : "linear-gradient(135deg, hsl(var(--background)) 0%, hsl(215 18% 12% / 0.03) 100%)" }}>
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
          <IntelligentChart title="Retention Stability Index" insight={getInsight("rsi")} kpi={getKpi("rsi")} dataKey="rsi" projectedKey="rsiProjected" gradientId="rsiGrad" color="hsl(var(--chart-1))" data={chartData} domain={[0, 100]} formatter={(v: number) => [`${v}/100`, "RSI"]} referenceArea={{ y1: 80, y2: 100, label: "Stable Zone" }} testId="chart-rsi" />
          <IntelligentChurnChart insight={getInsight("churn")} kpi={getKpi("churn")} data={chartData} testId="chart-churn" />
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
                    <AreaChart data={chartData}>
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
          <IntelligentChart title="Revenue per Member" insight={getInsight("arm")} kpi={getKpi("arm")} dataKey="arm" projectedKey="armProjected" gradientId="armGrad" color="hsl(var(--chart-4))" data={chartData} formatter={(v: number) => [`$${v.toFixed(0)}`, "ARM"]} referenceLine={{ y: 150, label: "Target" }} testId="chart-arm" />
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
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── LEADING INDICATORS ── */}
      <div className="space-y-3 animate-fade-in-up animation-delay-400">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Radar className="w-3.5 h-3.5" /> Leading Indicators
        </h3>
        <div className="grid lg:grid-cols-2 gap-6">
          <IntelligentChart title="Active Members" insight={getInsight("members")} kpi={getKpi("members")} dataKey="members" projectedKey="membersProjected" gradientId="memGrad" color="hsl(var(--chart-5))" data={chartData} testId="chart-members" />
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
      <Tooltip>
        <TooltipTrigger asChild>
          <p className="text-xs text-muted-foreground truncate cursor-help max-w-md">{insight.detail}</p>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">{insight.detail}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function IntelligentChart({ title, insight, kpi, data, dataKey, projectedKey, gradientId, color, domain, yFormatter, formatter, referenceArea, referenceLine, testId }: {
  title: string; insight?: TrendInsight; kpi?: MicroKpi; data: any[]; dataKey: string; projectedKey: string; gradientId: string; color: string; domain?: [number, number]; yFormatter?: (v: number) => string; formatter?: (v: number) => [string, string]; referenceArea?: { y1: number; y2: number; label: string }; referenceLine?: { y: number; label: string }; testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-6 space-y-4">
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">{title}</h3>
          <KpiBadge kpi={kpi} />
          <InsightHeader insight={insight} />
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
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Churn Rate (%)</h3>
          <KpiBadge kpi={kpi} />
          <InsightHeader insight={insight} />
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
