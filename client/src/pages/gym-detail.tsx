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
} from "lucide-react";
import { useState } from "react";
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
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight" data-testid="text-gym-name">
            {gym.name}
          </h1>
          {gym.location && (
            <p className="text-sm text-muted-foreground">{gym.location}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/gyms/${gym.id}/import`}>
            <Button variant="outline" data-testid="button-import-csv">
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
          <TabsTrigger value="members" data-testid="tab-members">Members</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="report" className="mt-8">
          <ReportView gymId={gym.id} />
        </TabsContent>

        <TabsContent value="members" className="mt-8">
          <MembersView gymId={gym.id} />
        </TabsContent>

        <TabsContent value="trends" className="mt-8">
          <TrendsView gymId={gym.id} />
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
          <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-4">
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

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SmallMetric label="Revenue / Member" value={`$${Number(data.metrics.arm).toFixed(0)}`} icon={BarChart3} />
            <SmallMetric label="Lifetime Value" value={`$${Number(data.metrics.ltv).toLocaleString()}`} icon={TrendingUp} />
            <SmallMetric label="New Members" value={String(data.metrics.newMembers)} icon={UserPlus} />
            <SmallMetric label="Cancellations" value={String(data.metrics.cancels)} icon={UserMinus} />
          </div>

          <div className="space-y-6" data-testid="section-reports">
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

  const color = value >= 80
    ? { stroke: "#10b981", glow: "rgba(16, 185, 129, 0.25)", label: "Stable" }
    : value >= 60
      ? { stroke: "#f59e0b", glow: "rgba(245, 158, 11, 0.25)", label: "Moderate" }
      : { stroke: "#ef4444", glow: "rgba(239, 68, 68, 0.25)", label: "Unstable" };

  return (
    <Card data-testid={testId}>
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
              strokeDasharray={`${filledLength} ${circumference - filledLength}`}
              strokeDashoffset={-(circumference - arcLength) / 2 - ((360 - totalArc) / 360) * circumference / 2}
              transform={`rotate(${startAngle} ${center} ${center})`}
              style={{ filter: `drop-shadow(0 0 4px ${color.glow})`, transition: "stroke-dasharray 0.8s ease" }}
            />
            <text
              x={center}
              y={center - 2}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-foreground"
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
    ? "text-emerald-600 dark:text-emerald-400"
    : status === "risk"
      ? "text-red-600 dark:text-red-400"
      : "";

  const indicatorColor = status === "good"
    ? "bg-emerald-500"
    : status === "risk"
      ? "bg-red-500"
      : status === "moderate"
        ? "bg-amber-500"
        : "bg-muted";

  return (
    <Card data-testid={testId}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${indicatorColor}`} />
            <div>
              <span className="text-xs text-muted-foreground font-medium">{label}</span>
              {fullName && <p className="text-[10px] text-muted-foreground/70 leading-tight">{fullName}</p>}
            </div>
          </div>
          <Icon className="w-4 h-4 text-muted-foreground" />
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
    <Card>
      <CardContent className="p-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
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
    <span className={`flex items-center gap-1 text-xs font-mono ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
      {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {value}
    </span>
  );
}

function ReportCard({ report, gymId, atRiskMembers, monthDate }: { report: MetricReport; gymId: string; atRiskMembers?: AtRiskMember[]; monthDate: string }) {
  const isHighRisk = report.metric === "Monthly Churn" && parseFloat(report.current) > 7;
  const isRiskRadar = report.metric === "Member Risk Radar";

  return (
    <Card data-testid={`report-${report.metric.toLowerCase().replace(/\s+/g, "-")}`}>
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
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">What This Means</p>
            <p className="text-sm leading-relaxed">{report.meaning}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Why It Matters</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{report.whyItMatters}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">What To Do Next</p>
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
            <span className="ml-1 text-emerald-600 dark:text-emerald-400">
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
            <p className={`text-xs font-mono ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
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
            <p className={`text-lg font-bold font-mono ${revenueAtRisk > 0 ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`} data-testid="text-forecast-risk">
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
                <TableHead>Last Contact</TableHead>
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
    low: "bg-emerald-500 dark:bg-emerald-400",
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
    ? "text-emerald-600 dark:text-emerald-400"
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
  const { data: allMetrics, isLoading } = useQuery<GymMonthlyMetrics[]>({
    queryKey: ["/api/gyms", gymId, "metrics"],
  });

  if (isLoading) {
    return <Skeleton className="h-80 rounded-md" />;
  }

  if (!allMetrics || allMetrics.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center space-y-4">
          <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">
            Not enough data for trend analysis.
          </p>
          <p className="text-sm text-muted-foreground">
            Import members and recompute metrics to build your 90-day trend.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = allMetrics
    .sort((a, b) => a.monthStart.localeCompare(b.monthStart))
    .map((m) => ({
      month: new Date(m.monthStart + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      mrr: Number(m.mrr),
      members: m.activeMembers,
      churn: Number(m.churnRate),
      rsi: m.rsi,
      arm: Number(m.arm),
      netGrowth: m.newMembers - m.cancels,
    }));

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <TrendChart
          title="Retention Stability Index"
          data={chartData}
          dataKey="rsi"
          gradientId="rsiGrad"
          color="hsl(var(--chart-1))"
          domain={[0, 100]}
          formatter={(v: number) => [`${v}/100`, "RSI"]}
        />
        <TrendChart
          title="Monthly Recurring Revenue"
          data={chartData}
          dataKey="mrr"
          gradientId="mrrGrad"
          color="hsl(var(--chart-2))"
          yFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          formatter={(v: number) => [`$${v.toLocaleString()}`, "MRR"]}
        />
        <TrendChart
          title="Active Members"
          data={chartData}
          dataKey="members"
          gradientId="memGrad"
          color="hsl(var(--chart-5))"
        />
        <ChurnTrendChart data={chartData} />
        <TrendChart
          title="Revenue per Member"
          data={chartData}
          dataKey="arm"
          gradientId="armGrad"
          color="hsl(var(--chart-4))"
          formatter={(v: number) => [`$${v.toFixed(0)}`, "ARM"]}
        />
        <TrendChart
          title="Net Member Growth"
          data={chartData}
          dataKey="netGrowth"
          gradientId="netGrad"
          color="hsl(var(--chart-3))"
          formatter={(v: number) => [`${v >= 0 ? "+" : ""}${v}`, "Net"]}
        />
      </div>
    </div>
  );
}

function TrendChart({
  title,
  data,
  dataKey,
  gradientId,
  color,
  domain,
  yFormatter,
  formatter,
}: {
  title: string;
  data: any[];
  dataKey: string;
  gradientId: string;
  color: string;
  domain?: [number, number];
  yFormatter?: (v: number) => string;
  formatter?: (v: number) => [string, string];
}) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h3 className="font-semibold text-sm">{title}</h3>
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
              <RechartsTooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                formatter={formatter}
              />
              <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#${gradientId})`} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function ChurnTrendChart({ data }: { data: any[] }) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h3 className="font-semibold text-sm">Churn Rate (%)</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `${v}%`} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                formatter={(value: number) => [`${value}%`, "Churn"]}
              />
              <Line type="monotone" dataKey="churn" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 3 }} />
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
