import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useGymData, GymPageShell, GymNotFound, GymDetailSkeleton, PageHeader } from "./gym-detail";
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
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  Info,
  Zap,
  Target,
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

type DatePreset = "7d" | "30d" | "90d" | "mtd" | "last-month";

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

function KPICard({ title, value, delta, tooltip, icon: Icon, format = "number", accent }: {
  title: string;
  value: number | null;
  delta: number | null;
  tooltip: string;
  icon: typeof Users;
  format?: "number" | "percent" | "currency" | "time";
  accent?: string;
}) {
  let displayValue = "—";
  if (value !== null) {
    if (format === "percent") displayValue = `${(value * 100).toFixed(1)}%`;
    else if (format === "currency") displayValue = `$${value.toFixed(2)}`;
    else if (format === "time") displayValue = value < 1 ? "<1 min" : `${Math.round(value)} min`;
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
            <p className={`text-2xl font-bold tracking-tight ${accent || ""}`} data-testid={`kpi-value-${title.toLowerCase().replace(/\s+/g, "-")}`}>
              {displayValue}
            </p>
            <DeltaBadge value={delta} inverted={format === "time"} />
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PremiumFunnel({ counts, rates }: {
  counts: SalesSummary["counts"];
  rates: SalesSummary["rates"];
}) {
  const stages = [
    { label: "Leads", count: counts.leads, rate: rates.setRate },
    { label: "Booked", count: counts.booked, rate: rates.showRate },
    { label: "Showed", count: counts.shows, rate: rates.closeRate },
    { label: "Members", count: counts.newMembers, rate: null },
  ];

  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div className="space-y-0 py-1" data-testid="funnel-visual">
      {stages.map((stage, i) => {
        const widthPct = Math.max(30, (stage.count / maxCount) * 100);
        const isLast = i === stages.length - 1;
        const opacity = 1 - (i * 0.18);

        return (
          <div key={stage.label}>
            <div className="flex items-center gap-3">
              <div
                className="relative rounded-md overflow-hidden transition-all duration-500 mx-auto"
                style={{ width: `${widthPct}%`, minWidth: "100px" }}
              >
                <div
                  className="px-4 py-2.5 relative z-10"
                  style={{
                    background: `linear-gradient(135deg, hsl(var(--primary) / ${opacity}) 0%, hsl(var(--primary) / ${opacity * 0.6}) 100%)`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-primary-foreground/80 uppercase tracking-wider">{stage.label}</span>
                    <span className="text-base font-bold text-primary-foreground tabular-nums">{stage.count}</span>
                  </div>
                </div>
              </div>
            </div>
            {!isLast && (
              <div className="flex flex-col items-center py-1">
                <ChevronDown className="w-4 h-4 text-muted-foreground/40" />
                {stage.rate !== null && (
                  <span className="text-[10px] font-semibold tabular-nums text-muted-foreground -mt-0.5">
                    {(stage.rate * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function getScoreColor(score: number) {
  if (score >= 75) return { text: "text-emerald-500", bg: "bg-emerald-500", ring: "ring-emerald-500/20" };
  if (score >= 50) return { text: "text-amber-500", bg: "bg-amber-500", ring: "ring-amber-500/20" };
  return { text: "text-red-500", bg: "bg-red-500", ring: "ring-red-500/20" };
}

function getStrategicDirective(score: number, composite: SalesSummary["composite"], bottleneck: SalesSummary["bottleneck"]): string {
  if (score >= 80) return "Pipeline is strong. Protect your speed advantage and maintain coaching consistency through the close.";
  if (score >= 65) {
    if (composite.speedSubScore < 50) return "Your conversion is solid but speed is costing you. Leads contacted within 5 minutes close at 4x the rate. Tighten response time.";
    if (composite.stageSubScore < 50) return "Leads are entering the funnel but dropping off at the consultation stage. Review your show-up process and closing conversation.";
    return "Good foundation. Focus on the weakest sub-score to unlock the next tier of performance.";
  }
  if (score >= 40) {
    if (bottleneck?.stage === "Lead → Booked") return "Leads aren't converting to consultations. Implement a same-day follow-up system and give every lead a clear next step.";
    if (bottleneck?.stage === "Booked → Show") return "No-shows are bleeding your pipeline. Add confirmation texts, reduce time-to-appointment, and make the consultation feel unmissable.";
    if (bottleneck?.stage === "Show → Member") return "People are showing up but not signing. Restructure your consultation to lead with their goals, not your pricing.";
    return "Multiple pipeline stages need attention. Start with the biggest bottleneck and fix one stage at a time.";
  }
  return "Pipeline needs foundational work. Prioritize speed-to-lead and a structured follow-up system before optimizing downstream stages.";
}

function SalesHealthCard({ composite, bottleneck }: { composite: SalesSummary["composite"]; bottleneck: SalesSummary["bottleneck"] }) {
  const score = composite.salesHealthScore;
  const colors = getScoreColor(score);
  const directive = getStrategicDirective(score, composite, bottleneck);

  return (
    <Card className={`ring-1 ${colors.ring}`} data-testid="health-score-card">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1">Sales Health</p>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-4xl font-bold tracking-tight ${colors.text}`} data-testid="health-score-value">{score}</span>
              <span className="text-sm text-muted-foreground font-medium">/ 100</span>
            </div>
          </div>
          <div className={`p-2.5 rounded-xl ${colors.ring} ring-1 bg-background`}>
            <Target className={`w-5 h-5 ${colors.text}`} />
          </div>
        </div>

        <div className={`rounded-lg p-3 border ${score >= 65 ? "border-emerald-500/15 bg-emerald-500/5" : score >= 40 ? "border-amber-500/15 bg-amber-500/5" : "border-red-500/15 bg-red-500/5"}`}>
          <p className="text-xs leading-relaxed font-medium" data-testid="health-directive">{directive}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function getSourceInsight(data: SourceRow[]): string | null {
  if (data.length < 2) return null;

  const withConversion = data.filter(r => r.conversionRate !== null && r.leads >= 2);
  if (withConversion.length === 0) return null;

  const best = withConversion.reduce((a, b) => (a.conversionRate! > b.conversionRate! ? a : b));
  const mostVolume = data.reduce((a, b) => (a.leads > b.leads ? a : b));
  const weakest = withConversion.filter(r => r.leads >= 3).reduce((a, b) => (a.conversionRate! < b.conversionRate! ? a : b), withConversion[0]);

  const parts: string[] = [];

  if (best.conversionRate! >= 0.3) {
    parts.push(`${best.source} is your strongest converter at ${(best.conversionRate! * 100).toFixed(0)}%.`);
  }

  if (mostVolume.source !== best.source && mostVolume.leads > best.leads) {
    parts.push(`${mostVolume.source} drives the most volume (${mostVolume.leads} leads) but converts at ${mostVolume.conversionRate !== null ? (mostVolume.conversionRate * 100).toFixed(0) + "%" : "an unknown rate"}.`);
  }

  if (weakest && weakest.source !== best.source && weakest.conversionRate! < 0.2 && weakest.leads >= 3) {
    parts.push(`${weakest.source} needs attention — ${weakest.leads} leads but only ${(weakest.conversionRate! * 100).toFixed(0)}% conversion.`);
  }

  if (parts.length === 0) {
    parts.push(`${best.source} leads with ${(best.conversionRate! * 100).toFixed(0)}% conversion across ${best.leads} leads.`);
  }

  return parts.join(" ");
}

function SourceTable({ data }: { data: SourceRow[] }) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground p-4">No source data available.</p>;

  const maxLeads = Math.max(...data.map(r => r.leads), 1);
  const insight = getSourceInsight(data);

  return (
    <div className="space-y-3" data-testid="source-breakdown-table">
      <div className="space-y-2">
        {data.map((row) => {
          const barPct = (row.leads / maxLeads) * 100;
          return (
            <div key={row.source} className="group" data-testid={`source-row-${row.source}`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium truncate mr-3">{row.source}</span>
                <div className="flex items-center gap-3 flex-shrink-0 tabular-nums text-muted-foreground">
                  <span>{row.leads} leads</span>
                  <span>{row.newMembers} members</span>
                  <span className="font-semibold text-foreground w-12 text-right">
                    {row.conversionRate !== null ? `${(row.conversionRate * 100).toFixed(0)}%` : "—"}
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all duration-500"
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {insight && (
        <p className="text-[11px] leading-relaxed text-muted-foreground border-t border-border/30 pt-2" data-testid="source-insight">
          {insight}
        </p>
      )}
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
              <td className="py-2 pr-4 text-right tabular-nums">{row.shows}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{row.newMembers}</td>
              <td className="py-2 text-right tabular-nums font-semibold">
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
  const [preset, setPreset] = useState<DatePreset>("90d");
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
        <PageHeader
          title="Sales Intelligence"
          subtitle="Your sales pipeline from first contact to signed member. See where leads are getting stuck, how fast you're responding, and which sources bring the best members."
          howTo="Check the funnel for your biggest drop-off point — that's your bottleneck. Use the source breakdown to double down on what's working and cut what isn't."
          icon={TrendingUp}
        />
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div />
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
                tooltip="New Members / Leads — percentage of leads that became members"
                icon={TrendingUp}
                format="percent"
              />
              <KPICard
                title="Speed to Lead"
                value={summary.speed.responseMedianMin}
                delta={summary.deltas.responseMedianMin}
                tooltip="Median time from lead creation to first contact. Target: sub 5 minutes."
                icon={Zap}
                format="time"
                accent={
                  summary.speed.responseMedianMin !== null
                    ? summary.speed.responseMedianMin <= 5 ? "text-emerald-500" : summary.speed.responseMedianMin <= 30 ? "" : "text-amber-500"
                    : ""
                }
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2 grid md:grid-cols-2 gap-4">
                <Card data-testid="funnel-card">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Pipeline</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <PremiumFunnel counts={summary.counts} rates={summary.rates} />
                  </CardContent>
                </Card>

                <Card data-testid="source-breakdown">
                  <CardHeader className="pb-1">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Sources</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <SourceTable data={sourceData || []} />
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <SalesHealthCard composite={summary.composite} bottleneck={summary.bottleneck} />

                {summary.bottleneck && (
                  <Card className="border-amber-500/20" data-testid="bottleneck-card">
                    <CardContent className="p-4 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-600 dark:text-amber-400">Bottleneck</p>
                      </div>
                      <p className="text-sm font-bold" data-testid="bottleneck-stage">{summary.bottleneck.stage}</p>
                      <p className="text-xs text-muted-foreground">{summary.bottleneck.dropPercent}% drop-off — {summary.bottleneck.explanation}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {trends && trends.length > 1 && (
              <Card data-testid="chart-leads-members">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Lead & Member Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trends} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/20" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} className="text-muted-foreground" />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} className="text-muted-foreground" />
                        <RechartsTooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="leads" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Leads" />
                        <Line type="monotone" dataKey="newMembers" stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={false} name="New Members" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-2 px-1" data-testid="toggle-details">
                  <span className="uppercase tracking-[0.12em]">Stage & Speed Details</span>
                  {detailsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-1">
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Stage Rates</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div data-testid="metric-set-rate">
                          <Tooltip>
                            <TooltipTrigger>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Set Rate</p>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">Booked Consults / Leads</TooltipContent>
                          </Tooltip>
                          <p className="text-xl font-bold tabular-nums mt-0.5">{summary.rates.setRate !== null ? `${(summary.rates.setRate * 100).toFixed(1)}%` : "—"}</p>
                          <DeltaBadge value={summary.deltas.setRate} />
                        </div>
                        <div data-testid="metric-show-rate">
                          <Tooltip>
                            <TooltipTrigger>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Show Rate</p>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">Shows / Booked Consults</TooltipContent>
                          </Tooltip>
                          <p className="text-xl font-bold tabular-nums mt-0.5">{summary.rates.showRate !== null ? `${(summary.rates.showRate * 100).toFixed(1)}%` : "—"}</p>
                          <DeltaBadge value={summary.deltas.showRate} />
                        </div>
                        <div data-testid="metric-close-rate">
                          <Tooltip>
                            <TooltipTrigger>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Close Rate</p>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">New Members / Shows</TooltipContent>
                          </Tooltip>
                          <p className="text-xl font-bold tabular-nums mt-0.5">{summary.rates.closeRate !== null ? `${(summary.rates.closeRate * 100).toFixed(1)}%` : "—"}</p>
                          <DeltaBadge value={summary.deltas.closeRate} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Speed Metrics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div data-testid="metric-response-time">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Response Time</p>
                          <p className="text-xl font-bold tabular-nums mt-0.5">
                            {summary.speed.responseMedianMin !== null ? `${Math.round(summary.speed.responseMedianMin)}m` : "—"}
                          </p>
                          <DeltaBadge value={summary.deltas.responseMedianMin} inverted />
                        </div>
                        <div data-testid="metric-lead-to-member">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Lead to Member</p>
                          <p className="text-xl font-bold tabular-nums mt-0.5">
                            {summary.speed.leadToMemberMedianDays !== null ? `${summary.speed.leadToMemberMedianDays}d` : "—"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {coachData && coachData.length > 0 && (
                  <Collapsible open={coachOpen} onOpenChange={setCoachOpen}>
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-2 px-1" data-testid="toggle-coach-breakdown">
                        <span className="uppercase tracking-[0.12em]">Coach Breakdown</span>
                        {coachOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-1">
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
