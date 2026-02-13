import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Brain, AlertTriangle, TrendingDown, TrendingUp, Users, DollarSign,
  Shield, ShieldAlert, ShieldCheck, Target, Zap, FileText, BarChart3,
  ChevronRight, Clock, Minus, ArrowUp, ArrowDown,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, Legend, ComposedChart,
} from "recharts";

interface PredictiveIntelligence {
  memberPredictions: {
    members: MemberPrediction[];
    summary: {
      totalAtRisk: number;
      totalRevenueAtRisk: number;
      totalLtvAtRisk: number;
      avgChurnProbability: number;
      classBreakdown: Record<string, number>;
      urgentInterventions: number;
      topRiskDriver: string;
    };
  };
  cohortIntelligence: {
    cohorts: CohortBucket[];
    retentionWindows: RetentionWindow[];
    survivalCurve: { days: number; survivalRate: number }[];
    insights: string[];
    crossfitInsights: string[];
  };
  revenueScenario: {
    projections: ScenarioMonth[];
    breakEvenRisk: number;
    cashFlowRiskLevel: string;
    worstCaseMrr: number;
    expectedMrr: number;
    upsideMrr: number;
    scenarioInsights: string[];
  };
  strategicBrief: {
    generatedAt: string;
    executiveSummary: string;
    stabilityVerdict: string;
    keyMetrics: { label: string; value: string; status: string }[];
    recommendations: BriefRecommendation[];
    cohortAlert: string | null;
    revenueOutlook: string;
    memberAlerts: { name: string; probability: number; driver: string; intervention: string; revenue: string }[];
    roiProjection: { actionTaken: string; membersRetained: number; revenuePreserved: number; annualImpact: number };
  };
}

interface MemberPrediction {
  memberId: string;
  name: string;
  email: string | null;
  monthlyRate: number;
  tenureDays: number;
  tenureMonths: number;
  churnProbability: number;
  engagementClass: string;
  expectedLtvRemaining: number;
  revenueAtRisk: number;
  primaryRiskDriver: string;
  riskDrivers: string[];
  interventionType: string;
  interventionDetail: string;
  interventionUrgency: string;
  lastContactDays: number | null;
  isHighValue: boolean;
}

interface CohortBucket {
  cohortLabel: string;
  cohortMonth: string;
  totalJoined: number;
  stillActive: number;
  survivalRate: number;
  avgTenureDays: number;
  avgMonthlyRate: number;
  revenueRetained: number;
  revenueLost: number;
}

interface RetentionWindow {
  window: string;
  lostCount: number;
  lostPct: number;
  avgRate: number;
  revenueLost: number;
  insight: string;
}

interface ScenarioMonth {
  month: string;
  upside: number;
  expected: number;
  downside: number;
  current: number;
}

interface BriefRecommendation {
  category: string;
  priority: string;
  headline: string;
  detail: string;
  revenueImpact: string;
  interventionType: string;
  crossfitContext: string;
  timeframe: string;
}

export default function PredictiveIntelligenceView({ gymId }: { gymId: string }) {
  const { data, isLoading, error } = useQuery<PredictiveIntelligence>({
    queryKey: [`/api/gyms/${gymId}/predictive`],
  });

  if (isLoading) return <PredictiveSkeleton />;
  if (error || !data) return <div className="text-center py-12 text-muted-foreground" data-testid="predictive-error">Unable to load predictive intelligence. Import members and recompute metrics first.</div>;

  return (
    <div className="space-y-8">
      <Tabs defaultValue="brief" data-testid="predictive-tabs">
        <TabsList>
          <TabsTrigger value="brief" data-testid="tab-brief">
            <FileText className="w-4 h-4 mr-1" />
            Strategic Brief
          </TabsTrigger>
          <TabsTrigger value="members" data-testid="tab-member-risk">
            <Brain className="w-4 h-4 mr-1" />
            Member Risk
          </TabsTrigger>
          <TabsTrigger value="cohorts" data-testid="tab-cohorts">
            <Users className="w-4 h-4 mr-1" />
            Cohort Intelligence
          </TabsTrigger>
          <TabsTrigger value="scenarios" data-testid="tab-scenarios">
            <BarChart3 className="w-4 h-4 mr-1" />
            Revenue Scenarios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="brief" className="mt-6">
          <StrategicBriefView brief={data.strategicBrief} />
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <MemberRiskView predictions={data.memberPredictions} />
        </TabsContent>

        <TabsContent value="cohorts" className="mt-6">
          <CohortView cohorts={data.cohortIntelligence} />
        </TabsContent>

        <TabsContent value="scenarios" className="mt-6">
          <ScenarioView scenario={data.revenueScenario} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STRATEGIC BRIEF
// ═══════════════════════════════════════════════════════════════

function StrategicBriefView({ brief }: { brief: PredictiveIntelligence["strategicBrief"] }) {
  const dateStr = new Date(brief.generatedAt).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight" data-testid="text-brief-title">Strategic Intelligence Brief</h2>
          <p className="text-sm text-muted-foreground">{dateStr}</p>
        </div>
        <Badge variant="outline" className="text-xs">
          <Zap className="w-3 h-3 mr-1" />
          Algorithmic Intelligence
        </Badge>
      </div>

      <Card data-testid="card-executive-summary">
        <CardContent className="pt-6 space-y-4">
          <p className="text-sm leading-relaxed">{brief.executiveSummary}</p>
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Stability Verdict</p>
            <p className="text-sm leading-relaxed">{brief.stabilityVerdict}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="grid-key-metrics">
        {brief.keyMetrics.map((km) => (
          <Card key={km.label}>
            <CardContent className="pt-4 pb-3 px-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">{km.label}</p>
              <p className={`text-lg font-bold ${km.status === "good" ? "text-emerald-600 dark:text-emerald-400" : km.status === "warning" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                {km.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {brief.cohortAlert && (
        <Card className="border-amber-500/30" data-testid="card-cohort-alert">
          <CardContent className="pt-4 pb-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Cohort Alert</p>
              <p className="text-sm leading-relaxed">{brief.cohortAlert}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4" data-testid="section-recommendations">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Strategic Recommendations</h3>
        {brief.recommendations.map((rec, i) => (
          <Card key={i} data-testid={`card-recommendation-${i}`}>
            <CardContent className="pt-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={rec.priority === "critical" ? "destructive" : "secondary"}
                    className={rec.priority === "high" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" : ""}
                  >
                    {rec.priority}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{rec.category}</span>
                </div>
                <span className="text-xs text-muted-foreground">{rec.timeframe}</span>
              </div>
              <p className="text-sm font-medium">{rec.headline}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{rec.detail}</p>
              <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t">
                <div>
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">Revenue Impact</p>
                  <p className="text-xs text-muted-foreground">{rec.revenueImpact}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Intervention</p>
                  <p className="text-xs text-muted-foreground">{rec.interventionType}</p>
                </div>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-1">CrossFit Context</p>
                <p className="text-xs text-muted-foreground/80 italic leading-relaxed">{rec.crossfitContext}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card data-testid="card-revenue-outlook">
        <CardContent className="pt-5 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Revenue Outlook</p>
          <p className="text-sm leading-relaxed">{brief.revenueOutlook}</p>
        </CardContent>
      </Card>

      {brief.memberAlerts.length > 0 && (
        <div className="space-y-3" data-testid="section-member-alerts">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Priority Member Alerts</h3>
          <div className="grid gap-2">
            {brief.memberAlerts.map((alert, i) => (
              <Card key={i} data-testid={`card-member-alert-${i}`}>
                <CardContent className="py-3 px-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{alert.name}</span>
                      <Badge variant="destructive" className="text-xs">{alert.probability}% risk</Badge>
                      <span className="text-xs text-muted-foreground">{alert.revenue}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{alert.driver}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card data-testid="card-roi-projection">
        <CardContent className="pt-5 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">ROI Projection</p>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Action</p>
              <p className="text-sm">{brief.roiProjection.actionTaken}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Members Retained</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{brief.roiProjection.membersRetained}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Annual Revenue Preserved</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">${brief.roiProjection.annualImpact.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MEMBER RISK VIEW
// ═══════════════════════════════════════════════════════════════

function MemberRiskView({ predictions }: { predictions: PredictiveIntelligence["memberPredictions"] }) {
  const { summary, members } = predictions;

  const classColors: Record<string, string> = {
    core: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    drifter: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
    "at-risk": "text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20",
    ghost: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20",
  };

  const classIcons: Record<string, typeof ShieldCheck> = {
    core: ShieldCheck,
    drifter: Shield,
    "at-risk": ShieldAlert,
    ghost: AlertTriangle,
  };

  const urgencyColors: Record<string, string> = {
    immediate: "text-red-600 dark:text-red-400",
    "this-week": "text-orange-600 dark:text-orange-400",
    "this-month": "text-amber-600 dark:text-amber-400",
    monitor: "text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="grid-risk-summary">
        {(["core", "drifter", "at-risk", "ghost"] as const).map((cls) => {
          const Icon = classIcons[cls];
          return (
            <Card key={cls}>
              <CardContent className="pt-4 pb-3 px-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${classColors[cls].split(" ")[0]}`} />
                  <p className="text-xs font-medium capitalize">{cls}</p>
                </div>
                <p className="text-2xl font-bold">{summary.classBreakdown[cls] || 0}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">Revenue at Risk</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">${summary.totalRevenueAtRisk.toLocaleString()}/mo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">LTV at Risk</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">${summary.totalLtvAtRisk.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">Urgent Interventions</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{summary.urgentInterventions}</p>
          </CardContent>
        </Card>
      </div>

      {summary.topRiskDriver !== "No significant risk drivers" && (
        <Card className="border-amber-500/20">
          <CardContent className="pt-4 pb-3 flex items-start gap-3">
            <Target className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Top Risk Driver Across Roster</p>
              <p className="text-sm">{summary.topRiskDriver}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-md border overflow-x-auto" data-testid="table-member-risk">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Class</TableHead>
              <TableHead className="text-right">Churn Prob</TableHead>
              <TableHead>Risk Driver</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead>Tenure</TableHead>
              <TableHead>Urgency</TableHead>
              <TableHead>Intervention</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.slice(0, 30).map((m) => {
              const Icon = classIcons[m.engagementClass] || Shield;
              return (
                <TableRow key={m.memberId} data-testid={`row-member-${m.memberId}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{m.name}</span>
                      {m.isHighValue && (
                        <Tooltip>
                          <TooltipTrigger>
                            <DollarSign className="w-3 h-3 text-amber-500" />
                          </TooltipTrigger>
                          <TooltipContent>High-value member</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs capitalize ${classColors[m.engagementClass] || ""}`}>
                      <Icon className="w-3 h-3 mr-1" />
                      {m.engagementClass}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`text-sm font-mono font-medium ${m.churnProbability > 0.5 ? "text-red-600 dark:text-red-400" : m.churnProbability > 0.25 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                      {(m.churnProbability * 100).toFixed(0)}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger className="text-left">
                        <span className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{m.primaryRiskDriver}</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <div className="space-y-1">
                          {m.riskDrivers.map((d, i) => (
                            <p key={i} className="text-xs">{d}</p>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-right text-sm">${m.monthlyRate}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.tenureMonths > 0 ? `${m.tenureMonths}mo` : `${m.tenureDays}d`}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium ${urgencyColors[m.interventionUrgency] || ""}`}>
                      {m.interventionUrgency.replace("-", " ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger className="text-left">
                        <Badge variant="outline" className="text-xs">
                          {m.interventionType.replace(/-/g, " ")}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="text-xs leading-relaxed">{m.interventionDetail}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {members.length > 30 && (
        <p className="text-xs text-muted-foreground text-center">Showing top 30 of {members.length} members by risk</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COHORT VIEW
// ═══════════════════════════════════════════════════════════════

function CohortView({ cohorts: data }: { cohorts: PredictiveIntelligence["cohortIntelligence"] }) {
  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <Card data-testid="chart-survival-curve">
          <CardContent className="pt-5">
            <p className="text-sm font-medium mb-4">Retention Survival Curve</p>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.survivalCurve}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="days" tickFormatter={(d) => d === 0 ? "Join" : d < 365 ? `${d}d` : `${(d/365).toFixed(1)}y`} tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <RechartsTooltip
                  formatter={(v: number) => [`${v}%`, "Survival Rate"]}
                  labelFormatter={(d) => `Day ${d}`}
                  contentStyle={{ fontSize: "12px", borderRadius: "6px" }}
                />
                <defs>
                  <linearGradient id="survivalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(210, 60%, 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(210, 60%, 50%)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="survivalRate" stroke="hsl(210, 60%, 50%)" fill="url(#survivalGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card data-testid="chart-retention-windows">
          <CardContent className="pt-5">
            <p className="text-sm font-medium mb-4">Where Members Are Lost</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.retentionWindows.filter(w => w.lostCount > 0)}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="window" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip
                  formatter={(v: number, name: string) => [name === "lostCount" ? `${v} members` : `$${v}`, name === "lostCount" ? "Members Lost" : "Revenue Lost"]}
                  contentStyle={{ fontSize: "12px", borderRadius: "6px" }}
                />
                <Bar dataKey="lostCount" fill="hsl(0, 70%, 55%)" radius={[4, 4, 0, 0]} name="Members Lost" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {data.retentionWindows.filter(w => w.lostCount > 0).length > 0 && (
        <div className="space-y-3" data-testid="section-retention-windows">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Retention Window Analysis</h3>
          {data.retentionWindows.filter(w => w.lostCount > 0).map((w, i) => (
            <Card key={i} data-testid={`card-window-${i}`}>
              <CardContent className="pt-4 pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{w.window}</Badge>
                    <span className="text-sm text-red-600 dark:text-red-400 font-medium">{w.lostCount} lost ({w.lostPct}%)</span>
                  </div>
                  <span className="text-xs text-muted-foreground">${w.revenueLost.toLocaleString()}/mo lost</span>
                </div>
                {w.insight && <p className="text-xs text-muted-foreground leading-relaxed italic">{w.insight}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {data.insights.length > 0 && (
          <Card data-testid="card-cohort-insights">
            <CardContent className="pt-5 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cohort Insights</p>
              {data.insights.map((ins, i) => (
                <p key={i} className="text-sm leading-relaxed">{ins}</p>
              ))}
            </CardContent>
          </Card>
        )}

        {data.crossfitInsights.length > 0 && (
          <Card data-testid="card-crossfit-insights">
            <CardContent className="pt-5 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">CrossFit-Specific Intelligence</p>
              {data.crossfitInsights.map((ins, i) => (
                <p key={i} className="text-sm text-muted-foreground leading-relaxed italic">{ins}</p>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {data.cohorts.length > 0 && (
        <div data-testid="table-cohorts">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Cohort Performance</h3>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cohort</TableHead>
                  <TableHead className="text-right">Joined</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead className="text-right">Survival</TableHead>
                  <TableHead className="text-right">Avg Rate</TableHead>
                  <TableHead className="text-right">Revenue Retained</TableHead>
                  <TableHead className="text-right">Revenue Lost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.cohorts.slice(-12).map((c) => (
                  <TableRow key={c.cohortMonth}>
                    <TableCell className="text-sm font-medium">{c.cohortLabel}</TableCell>
                    <TableCell className="text-right text-sm">{c.totalJoined}</TableCell>
                    <TableCell className="text-right text-sm">{c.stillActive}</TableCell>
                    <TableCell className="text-right">
                      <span className={`text-sm font-medium ${c.survivalRate >= 70 ? "text-emerald-600 dark:text-emerald-400" : c.survivalRate >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                        {c.survivalRate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm">${c.avgMonthlyRate}</TableCell>
                    <TableCell className="text-right text-sm text-emerald-600 dark:text-emerald-400">${c.revenueRetained.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm text-red-600 dark:text-red-400">${c.revenueLost.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO VIEW
// ═══════════════════════════════════════════════════════════════

function ScenarioView({ scenario }: { scenario: PredictiveIntelligence["revenueScenario"] }) {
  const riskColors: Record<string, string> = {
    low: "text-emerald-600 dark:text-emerald-400",
    moderate: "text-amber-600 dark:text-amber-400",
    high: "text-orange-600 dark:text-orange-400",
    critical: "text-red-600 dark:text-red-400",
  };

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-4 gap-3" data-testid="grid-scenario-summary">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Upside</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">${scenario.upsideMrr.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Expected</p>
            <p className="text-lg font-bold">${scenario.expectedMrr.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Downside</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">${scenario.worstCaseMrr.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Cash Flow Risk</p>
            <p className={`text-lg font-bold capitalize ${riskColors[scenario.cashFlowRiskLevel] || ""}`}>
              {scenario.cashFlowRiskLevel}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="chart-scenario-bands">
        <CardContent className="pt-5">
          <p className="text-sm font-medium mb-4">6-Month Revenue Scenarios</p>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={scenario.projections}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="month"
                tickFormatter={(m) => new Date(m + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
                tick={{ fontSize: 11 }}
              />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <RechartsTooltip
                formatter={(v: number, name: string) => [`$${v.toLocaleString()}`, name]}
                labelFormatter={(m) => new Date(m + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                contentStyle={{ fontSize: "12px", borderRadius: "6px" }}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: "11px" }} />
              <defs>
                <linearGradient id="upsideGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 60%, 45%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(142, 60%, 45%)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="downsideGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 70%, 55%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(0, 70%, 55%)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="upside" stroke="hsl(142, 60%, 45%)" fill="url(#upsideGrad)" strokeWidth={1.5} strokeDasharray="4 2" name="Upside" />
              <Area type="monotone" dataKey="downside" stroke="hsl(0, 70%, 55%)" fill="url(#downsideGrad)" strokeWidth={1.5} strokeDasharray="4 2" name="Downside" />
              <Line type="monotone" dataKey="expected" stroke="hsl(210, 60%, 50%)" strokeWidth={2.5} dot={{ r: 3 }} name="Expected" />
              <Line type="monotone" dataKey="current" stroke="hsl(0, 0%, 60%)" strokeWidth={1} strokeDasharray="6 4" dot={false} name="Current MRR" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card data-testid="card-break-even">
        <CardContent className="pt-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Break-Even Risk Assessment</p>
            <Badge variant="outline" className={riskColors[scenario.cashFlowRiskLevel]}>
              {(scenario.breakEvenRisk * 100).toFixed(0)}% probability
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {scenario.breakEvenRisk > 0.3
              ? "There is a meaningful probability that revenue could fall below sustainable operating levels in the downside scenario. Prioritize churn reduction to narrow the scenario spread."
              : "Revenue is projected to remain above sustainable operating levels across all scenarios. Continue current trajectory while monitoring for early warning signals."}
          </p>
        </CardContent>
      </Card>

      {scenario.scenarioInsights.length > 0 && (
        <Card data-testid="card-scenario-insights">
          <CardContent className="pt-5 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Scenario Analysis</p>
            {scenario.scenarioInsights.map((ins, i) => (
              <p key={i} className="text-sm leading-relaxed">{ins}</p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════════════

function PredictiveSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-48" />
      <Skeleton className="h-48" />
    </div>
  );
}
