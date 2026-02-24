import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useGymData, GymPageShell, GymNotFound, GymDetailSkeleton } from "./gym-detail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Users,
  UserPlus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  Info,
  Gauge,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";

type DatePreset = "7d" | "30d" | "90d" | "mtd" | "last-month" | "custom";

function getDateRange(preset: DatePreset): { start: string; end: string; label: string } {
  const now = new Date();
  const end = now.toISOString();
  let start: Date;
  let label: string;

  switch (preset) {
    case "7d":
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      label = "Last 7 days";
      break;
    case "30d":
      start = new Date(now);
      start.setDate(start.getDate() - 30);
      label = "Last 30 days";
      break;
    case "90d":
      start = new Date(now);
      start.setDate(start.getDate() - 90);
      label = "Last 90 days";
      break;
    case "mtd":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      label = "Month to date";
      break;
    case "last-month": {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start = lastMonth;
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { start: start.toISOString(), end: endOfLastMonth.toISOString(), label: "Last month" };
    }
    default:
      start = new Date(now);
      start.setDate(start.getDate() - 30);
      label = "Last 30 days";
  }

  return { start: start.toISOString(), end, label };
}

interface SalesSummary {
  counts: { leads: number; booked: number; shows: number; newMembers: number };
  rates: { setRate: number | null; showRate: number | null; closeRate: number | null; funnelConversion: number | null };
  revenue: { total: number; revenuePerLead: number | null };
  speed: { responseMedianMin: number | null; leadToMemberMedianDays: number | null };
  composite: { salesHealthScore: number; conversionSubScore: number; speedSubScore: number; stageSubScore: number };
  bottleneck: { stage: string; dropPercent: number; explanation: string } | null;
  deltas: Record<string, number | null>;
}

interface TrendPoint {
  date: string;
  leads: number;
  newMembers: number;
  conversionRate: number | null;
}

interface SourceRow {
  source: string;
  leads: number;
  newMembers: number;
  conversionRate: number | null;
}

interface CoachRow {
  coachId: string;
  shows: number;
  newMembers: number;
  closeRate: number | null;
}

function DeltaBadge({ value, inverted }: { value: number | null; inverted?: boolean }) {
  if (value === null) return null;
  const isPositive = inverted ? value < 0 : value > 0;
  const isNegative = inverted ? value > 0 : value < 0;
  return (
    <span
      className={`text-xs font-medium inline-flex items-center gap-0.5 ${
        isPositive ? "text-emerald-600 dark:text-emerald-400" : isNegative ? "text-red-500 dark:text-red-400" : "text-muted-foreground"
      }`}
      data-testid="delta-badge"
    >
      {value > 0 ? <TrendingUp className="w-3 h-3" /> : value < 0 ? <TrendingDown className="w-3 h-3" /> : null}
      {value > 0 ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

function KPICard({ title, value, delta, tooltip, icon: Icon, format = "number" }: {
  title: string;
  value: number | null;
  delta: number | null;
  tooltip: string;
  icon: typeof Users;
  format?: "number" | "percent" | "currency";
}) {
  let displayValue = "—";
  if (value !== null) {
    if (format === "percent") displayValue = `${(value * 100).toFixed(1)}%`;
    else if (format === "currency") displayValue = `$${value.toFixed(2)}`;
    else displayValue = value.toString();
  }

  return (
    <Card className="hover-elevate" data-testid={`kpi-card-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3 text-muted-foreground/50" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-xs">{tooltip}</TooltipContent>
              </Tooltip>
            </div>
            <p className="text-2xl font-bold tracking-tight" data-testid={`kpi-value-${title.toLowerCase().replace(/\s+/g, "-")}`}>
              {displayValue}
            </p>
            <DeltaBadge value={delta} />
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelStage({ label, count, rate, isLast }: { label: string; count: number; rate: number | null; isLast?: boolean }) {
  return (
    <div className="flex items-center gap-2" data-testid={`funnel-stage-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex-1 bg-muted/50 rounded-lg p-3 text-center">
        <p className="text-lg font-bold">{count}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      {!isLast && (
        <div className="flex flex-col items-center gap-0.5 text-muted-foreground px-1">
          <ChevronRight className="w-4 h-4" />
          <span className="text-[10px] font-medium">
            {rate !== null ? `${(rate * 100).toFixed(1)}%` : "—"}
          </span>
        </div>
      )}
    </div>
  );
}

function SalesHealthGauge({ score, label }: { score: number; label: string }) {
  const getColor = (s: number) => {
    if (s >= 75) return "text-emerald-500";
    if (s >= 50) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <div className="text-center space-y-2" data-testid="sales-health-score">
      <div className="flex items-center justify-center gap-2">
        <Gauge className={`w-5 h-5 ${getColor(score)}`} />
        <span className={`text-3xl font-bold ${getColor(score)}`}>{score}</span>
        <span className="text-sm text-muted-foreground">/ 100</span>
      </div>
      <p className="text-xs text-muted-foreground max-w-[280px] mx-auto">{label}</p>
    </div>
  );
}

function SourceTable({ data }: { data: SourceRow[] }) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground p-4">No source data available.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="source-breakdown-table">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4 font-medium text-muted-foreground">Source</th>
            <th className="py-2 pr-4 font-medium text-muted-foreground text-right">Leads</th>
            <th className="py-2 pr-4 font-medium text-muted-foreground text-right">New Members</th>
            <th className="py-2 font-medium text-muted-foreground text-right">Conversion</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.source} className="border-b border-border/30" data-testid={`source-row-${row.source}`}>
              <td className="py-2 pr-4 font-medium">{row.source}</td>
              <td className="py-2 pr-4 text-right">{row.leads}</td>
              <td className="py-2 pr-4 text-right">{row.newMembers}</td>
              <td className="py-2 text-right">
                {row.conversionRate !== null ? `${(row.conversionRate * 100).toFixed(1)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CoachTable({ data }: { data: CoachRow[] }) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground p-4">No coach data available.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="coach-breakdown-table">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4 font-medium text-muted-foreground">Coach</th>
            <th className="py-2 pr-4 font-medium text-muted-foreground text-right">Shows</th>
            <th className="py-2 pr-4 font-medium text-muted-foreground text-right">New Members</th>
            <th className="py-2 font-medium text-muted-foreground text-right">Close Rate</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.coachId} className="border-b border-border/30" data-testid={`coach-row-${row.coachId}`}>
              <td className="py-2 pr-4 font-medium">{row.coachId}</td>
              <td className="py-2 pr-4 text-right">{row.shows}</td>
              <td className="py-2 pr-4 text-right">{row.newMembers}</td>
              <td className="py-2 text-right">
                {row.closeRate !== null ? `${(row.closeRate * 100).toFixed(1)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function exportSourceCSV(data: SourceRow[]) {
  const header = "Source,Leads,New Members,Conversion Rate\n";
  const rows = data.map(r => `"${r.source}",${r.leads},${r.newMembers},${r.conversionRate !== null ? (r.conversionRate * 100).toFixed(1) + "%" : "—"}`).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sales-source-breakdown.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function SalesIntelligence() {
  const [, params] = useRoute("/gyms/:id/sales");
  const gymId = params?.id;
  const [preset, setPreset] = useState<DatePreset>("30d");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);

  const { data: gym, isLoading: gymLoading } = useGymData(gymId);
  const dateRange = useMemo(() => getDateRange(preset), [preset]);
  const durationMs = new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime();
  const durationDays = durationMs / 86400000;
  const bucket = durationDays <= 30 ? "daily" : "weekly";

  const { data: summary, isLoading: summaryLoading } = useQuery<SalesSummary>({
    queryKey: ["/api/gyms", gymId, "sales-intelligence", "summary", dateRange.start, dateRange.end],
    queryFn: async () => {
      const res = await fetch(`/api/gyms/${gymId}/sales-intelligence/summary?start=${dateRange.start}&end=${dateRange.end}&compare=true`);
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
    enabled: !!gymId,
  });

  const { data: trends } = useQuery<TrendPoint[]>({
    queryKey: ["/api/gyms", gymId, "sales-intelligence", "trends", dateRange.start, dateRange.end, bucket],
    queryFn: async () => {
      const res = await fetch(`/api/gyms/${gymId}/sales-intelligence/trends?start=${dateRange.start}&end=${dateRange.end}&bucket=${bucket}`);
      if (!res.ok) throw new Error("Failed to fetch trends");
      return res.json();
    },
    enabled: !!gymId,
  });

  const { data: sourceData } = useQuery<SourceRow[]>({
    queryKey: ["/api/gyms", gymId, "sales-intelligence", "by-source", dateRange.start, dateRange.end],
    queryFn: async () => {
      const res = await fetch(`/api/gyms/${gymId}/sales-intelligence/by-source?start=${dateRange.start}&end=${dateRange.end}`);
      if (!res.ok) throw new Error("Failed to fetch source data");
      return res.json();
    },
    enabled: !!gymId,
  });

  const { data: coachData } = useQuery<CoachRow[]>({
    queryKey: ["/api/gyms", gymId, "sales-intelligence", "by-coach", dateRange.start, dateRange.end],
    queryFn: async () => {
      const res = await fetch(`/api/gyms/${gymId}/sales-intelligence/by-coach?start=${dateRange.start}&end=${dateRange.end}`);
      if (!res.ok) throw new Error("Failed to fetch coach data");
      return res.json();
    },
    enabled: !!gymId,
  });

  if (gymLoading) return <GymDetailSkeleton />;
  if (!gym) return <GymNotFound />;

  const presets: { key: DatePreset; label: string }[] = [
    { key: "7d", label: "7D" },
    { key: "30d", label: "30D" },
    { key: "90d", label: "90D" },
    { key: "mtd", label: "MTD" },
    { key: "last-month", label: "Last Mo" },
  ];

  const hasData = summary && summary.counts.leads > 0;

  return (
    <GymPageShell
      gym={gym}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => sourceData && exportSourceCSV(sourceData)}
          disabled={!sourceData || sourceData.length === 0}
          data-testid="button-export-csv"
        >
          <Download className="w-4 h-4 mr-1" /> Export CSV
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold tracking-tight" data-testid="page-title-sales">Sales Intelligence</h2>
          <div className="flex gap-1" data-testid="date-range-selector-sales">
            {presets.map((p) => (
              <Button
                key={p.key}
                variant={preset === p.key ? "default" : "outline"}
                size="sm"
                className="text-xs h-7 px-2.5"
                onClick={() => setPreset(p.key)}
                data-testid={`date-preset-${p.key}`}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        {summaryLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : !hasData ? (
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <Users className="w-10 h-10 mx-auto text-muted-foreground/40" />
              <h3 className="text-base font-semibold">No sales data yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Start tracking leads and consultations to see your sales funnel, conversion rates, and pipeline health.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPICard
                title="Leads"
                value={summary.counts.leads}
                delta={summary.deltas.leads}
                tooltip="Total new leads created in this period"
                icon={Users}
              />
              <KPICard
                title="New Members"
                value={summary.counts.newMembers}
                delta={summary.deltas.newMembers}
                tooltip="Leads who became paying members in this period"
                icon={UserPlus}
              />
              <KPICard
                title="Funnel Conversion"
                value={summary.rates.funnelConversion}
                delta={summary.deltas.funnelConversion}
                tooltip="New Members ÷ Leads — the percentage of leads that became members"
                icon={TrendingUp}
                format="percent"
              />
              <KPICard
                title="Revenue / Lead"
                value={summary.revenue.revenuePerLead}
                delta={summary.deltas.revenuePerLead}
                tooltip="Total first-month revenue from new members ÷ total leads"
                icon={DollarSign}
                format="currency"
              />
            </div>

            <div className="grid md:grid-cols-5 gap-4">
              <Card className="md:col-span-3" data-testid="funnel-visual">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Sales Funnel</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1 overflow-x-auto py-2">
                    <FunnelStage label="Leads" count={summary.counts.leads} rate={summary.rates.setRate} />
                    <FunnelStage label="Booked" count={summary.counts.booked} rate={summary.rates.showRate} />
                    <FunnelStage label="Shows" count={summary.counts.shows} rate={summary.rates.closeRate} />
                    <FunnelStage label="Members" count={summary.counts.newMembers} rate={null} isLast />
                  </div>
                </CardContent>
              </Card>

              <div className="md:col-span-2 space-y-4">
                {summary.bottleneck && (
                  <Card className="border-amber-500/30 bg-amber-500/5" data-testid="bottleneck-card">
                    <CardContent className="p-4 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Biggest Bottleneck</p>
                      </div>
                      <p className="text-sm font-bold" data-testid="bottleneck-stage">{summary.bottleneck.stage}</p>
                      <p className="text-xs text-muted-foreground">{summary.bottleneck.dropPercent}% drop-off</p>
                      <p className="text-xs text-muted-foreground mt-1">{summary.bottleneck.explanation}</p>
                    </CardContent>
                  </Card>
                )}

                <Card data-testid="health-score-card">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sales Health Score</p>
                    <SalesHealthGauge
                      score={summary.composite.salesHealthScore}
                      label="A simple summary of how well your pipeline is converting and how quickly you respond. Higher is better."
                    />
                    <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                      <div>
                        <p className="text-muted-foreground">Conversion</p>
                        <p className="font-semibold">{summary.composite.conversionSubScore}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Speed</p>
                        <p className="font-semibold">{summary.composite.speedSubScore}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Show/Close</p>
                        <p className="font-semibold">{summary.composite.stageSubScore}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {trends && trends.length > 1 && (
              <div className="grid md:grid-cols-2 gap-4">
                <Card data-testid="chart-leads-members">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Leads & New Members</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trends} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                          <RechartsTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line type="monotone" dataKey="leads" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Leads" />
                          <Line type="monotone" dataKey="newMembers" stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={false} name="New Members" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="chart-conversion">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trends.filter(t => t.conversionRate !== null)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`} />
                          <RechartsTooltip
                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                            formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, "Conversion"]}
                          />
                          <Line type="monotone" dataKey="conversionRate" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Conversion %" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card data-testid="source-breakdown">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Source Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <SourceTable data={sourceData || []} />
              </CardContent>
            </Card>

            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between text-sm" data-testid="toggle-details">
                  <span>Stage & Speed Details</span>
                  {detailsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Stage Conversion Rates</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div data-testid="metric-set-rate">
                        <Tooltip>
                          <TooltipTrigger>
                            <p className="text-xs text-muted-foreground">Set Rate</p>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">Booked Consults ÷ Leads</TooltipContent>
                        </Tooltip>
                        <p className="text-xl font-bold">{summary.rates.setRate !== null ? `${(summary.rates.setRate * 100).toFixed(1)}%` : "—"}</p>
                        <DeltaBadge value={summary.deltas.setRate} />
                      </div>
                      <div data-testid="metric-show-rate">
                        <Tooltip>
                          <TooltipTrigger>
                            <p className="text-xs text-muted-foreground">Show Rate</p>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">Shows ÷ Booked Consults</TooltipContent>
                        </Tooltip>
                        <p className="text-xl font-bold">{summary.rates.showRate !== null ? `${(summary.rates.showRate * 100).toFixed(1)}%` : "—"}</p>
                        <DeltaBadge value={summary.deltas.showRate} />
                      </div>
                      <div data-testid="metric-close-rate">
                        <Tooltip>
                          <TooltipTrigger>
                            <p className="text-xs text-muted-foreground">Close Rate</p>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">New Members ÷ Shows</TooltipContent>
                        </Tooltip>
                        <p className="text-xl font-bold">{summary.rates.closeRate !== null ? `${(summary.rates.closeRate * 100).toFixed(1)}%` : "—"}</p>
                        <DeltaBadge value={summary.deltas.closeRate} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Speed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div data-testid="metric-response-time">
                        <p className="text-xs text-muted-foreground">Median Response Time</p>
                        <p className="text-xl font-bold">
                          {summary.speed.responseMedianMin !== null ? `${summary.speed.responseMedianMin} min` : "Not enough data"}
                        </p>
                        <DeltaBadge value={summary.deltas.responseMedianMin} inverted />
                      </div>
                      <div data-testid="metric-lead-to-member">
                        <p className="text-xs text-muted-foreground">Lead → Member Time</p>
                        <p className="text-xl font-bold">
                          {summary.speed.leadToMemberMedianDays !== null ? `${summary.speed.leadToMemberMedianDays} days` : "Not enough data"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {coachData && coachData.length > 0 && (
                  <Collapsible open={coachOpen} onOpenChange={setCoachOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between text-sm" data-testid="toggle-coach-breakdown">
                        <span>Coach Breakdown</span>
                        {coachOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <Card>
                        <CardContent className="p-4">
                          <CoachTable data={coachData} />
                        </CardContent>
                      </Card>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </div>
    </GymPageShell>
  );
}
