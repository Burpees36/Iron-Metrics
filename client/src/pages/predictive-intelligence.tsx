import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import {
  Brain, AlertTriangle, TrendingDown, TrendingUp, Users, DollarSign,
  Shield, ShieldAlert, ShieldCheck, Target, Zap, FileText, BarChart3,
  ChevronRight, Clock, Minus, ArrowUp, ArrowDown, CheckCircle2, Circle,
  MessageSquare, Phone, UserCheck, CalendarDays, Search, Star, Check, Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
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
    stabilityLevel: string;
    keyMetrics: { label: string; value: string; status: string }[];
    recommendations: BriefRecommendation[];
    focusRecommendation: BriefRecommendation | null;
    cohortAlert: string | null;
    revenueOutlook: string;
    revenueComparison: {
      currentMrr: number;
      expectedMrr: number;
      upsideMrr: number;
      downsideMrr: number;
      expectedDeltaPct: number;
      upsideDeltaPct: number;
      downsideDeltaPct: number;
    };
    memberAlerts: MemberAlertEnriched[];
    roiProjection: { actionTaken: string; membersRetained: number; revenuePreserved: number; annualImpact: number };
  };
  recommendationExecution: RecommendationExecutionCard[];
  periodStart: string;
}

interface RecommendationExecutionCard {
  id: string;
  recommendationType: string;
  headline: string;
  totalItems: number;
  checkedItems: number;
  executionStrength: number;
  executionStrengthThreshold: number;
  checklist: Array<{ itemId: string; text: string; checked: boolean }>;
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
  interventionMicroGuidance: string;
  interventionUrgency: string;
  lastContactDays: number | null;
  isHighValue: boolean;
}

interface MemberAlertEnriched {
  name: string;
  memberId: string;
  probability: number;
  driver: string;
  intervention: string;
  revenue: string;
  tenureDays: number;
  lastContactDays: number | null;
  outreachLogged: boolean;
  suggestedAction: string;
  engagementClass: string;
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
  executionChecklist: string[];
  executionStandard?: string;
  interventionScore: number;
  expectedRevenueImpact: number;
  confidenceWeight: number;
  urgencyFactor: number;
  membersAffected: number;
  churnReductionEstimate: number;
  avgLtvRemaining: number;
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

interface MemberContact {
  id: string;
  memberId: string;
  contactedAt: string;
  note: string | null;
}

export function usePredictiveData(gymId: string) {
  return useQuery<PredictiveIntelligence>({
    queryKey: [`/api/gyms/${gymId}/predictive`],
    enabled: !!gymId,
  });
}

export { StrategicBriefView, MemberRiskView, FuturePlanningView, PredictiveSkeleton };
export type { PredictiveIntelligence };

export default function PredictiveIntelligenceView({ gymId, gymName }: { gymId: string; gymName: string }) {
  const { data, isLoading, error } = usePredictiveData(gymId);

  if (isLoading) return <PredictiveSkeleton />;
  if (error || !data) return <div className="text-center py-12 text-muted-foreground" data-testid="predictive-error">Unable to load predictive intelligence. Import members and recompute metrics first.</div>;

  return (
    <div className="space-y-8">
      <StrategicBriefView gymId={gymId} periodStart={data.periodStart} brief={data.strategicBrief} recommendationExecution={data.recommendationExecution} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STABILITY VERDICT BAR
// ═══════════════════════════════════════════════════════════════

const stabilityConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string; barWidth: string; dotColor: string }> = {
  strong: {
    label: "Strong",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/30",
    barWidth: "w-full",
    dotColor: "bg-primary",
  },
  moderate: {
    label: "Moderate",
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    barWidth: "w-2/3",
    dotColor: "bg-amber-500",
  },
  fragile: {
    label: "Fragile",
    color: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    barWidth: "w-1/3",
    dotColor: "bg-red-500",
  },
};

function StabilityVerdictBar({ level, verdict }: { level: string; verdict: string }) {
  const config = stabilityConfig[level] || stabilityConfig.fragile;

  return (
    <Card className={`${config.borderColor}`} data-testid="card-stability-verdict">
      <CardContent className="pt-5 pb-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${config.dotColor} ring-4 ring-opacity-20 ${level === "strong" ? "ring-primary" : level === "moderate" ? "ring-amber-500" : "ring-red-500"}`} />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stability Status</p>
              <p className={`text-lg font-semibold tracking-tight ${config.color}`} data-testid="text-stability-level">{config.label}</p>
            </div>
          </div>
          <Badge variant="outline" className={`${config.color} ${config.borderColor}`} data-testid="badge-stability-level">
            <ShieldCheck className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Stability Index</p>
            <p className={`text-xs font-medium ${config.color}`}>{config.label}</p>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden" data-testid="bar-stability">
            <div className={`h-full rounded-full transition-all duration-700 ${config.barWidth} ${config.dotColor}`} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground/60">
            <span>Fragile</span>
            <span>Moderate</span>
            <span>Strong</span>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground" data-testid="text-stability-verdict">{verdict}</p>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// REVENUE OUTLOOK BAR VISUAL
// ═══════════════════════════════════════════════════════════════

interface OwnerAction {
  id: string;
  periodStart: string;
  text: string;
  classificationType: string | null;
  classificationStatus: string;
  createdAt: string;
}

function OwnerActionsCard({ gymId, periodStart }: { gymId: string; periodStart: string }) {
  const { toast } = useToast();
  const [actionText, setActionText] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const PAGE_SIZE = 10;

  const ownerActionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/gyms/${gymId}/recommendations/actions`, { text: actionText, periodStart });
      return res.json();
    },
    onSuccess: (payload: { classificationType?: string | null }) => {
      setActionText("");
      queryClient.invalidateQueries({ queryKey: [`/api/gyms/${gymId}/recommendations/actions`] });
      toast({
        title: "Action logged",
        description: payload.classificationType
          ? `Logged as: ${payload.classificationType}`
          : "Saved as unclassified action.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to log action", description: error.message, variant: "destructive" });
    },
  });

  const historyQuery = useQuery<{ items: OwnerAction[]; hasMore: boolean }>({
    queryKey: [`/api/gyms/${gymId}/recommendations/actions`, historyPage],
    queryFn: async () => {
      const res = await fetch(`/api/gyms/${gymId}/recommendations/actions?limit=${PAGE_SIZE}&offset=${historyPage * PAGE_SIZE}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: showHistory,
  });

  const groupedByPeriod = useMemo(() => {
    if (!historyQuery.data?.items) return [];
    const map = new Map<string, OwnerAction[]>();
    for (const action of historyQuery.data.items) {
      const key = action.periodStart;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(action);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [historyQuery.data]);

  return (
    <Card className="animate-fade-in-up animation-delay-500 hover-elevate transition-all duration-300">
      <CardContent className="pt-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What else did you do?</p>
        <Textarea
          value={actionText}
          onChange={(event) => setActionText(event.target.value)}
          placeholder="Log any other actions you took this month (optional)"
          data-testid="textarea-owner-actions"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="text-xs text-muted-foreground flex items-center gap-1"
            onClick={() => setShowHistory(!showHistory)}
            data-testid="button-toggle-action-history"
          >
            <Clock className="w-3 h-3" />
            {showHistory ? "Hide past actions" : "View past actions"}
            <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${showHistory ? "rotate-90" : ""}`} />
          </button>
          <Button
            size="sm"
            disabled={!actionText.trim() || ownerActionMutation.isPending}
            onClick={() => ownerActionMutation.mutate()}
            data-testid="button-log-owner-action"
          >
            {ownerActionMutation.isPending ? "Logging..." : "Log action"}
          </Button>
        </div>

        {showHistory && (
          <div className="border-t pt-3 space-y-3" data-testid="section-action-history">
            {historyQuery.isLoading && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            )}
            {historyQuery.data && historyQuery.data.items.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">No actions logged yet.</p>
            )}
            {groupedByPeriod.map(([period, actions]) => (
              <div key={period} className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {new Date(period + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long" })}
                </p>
                {actions.map((action) => (
                  <div key={action.id} className="flex items-start gap-2 py-1" data-testid={`action-item-${action.id}`}>
                    <FileText className="w-3 h-3 mt-0.5 flex-shrink-0 text-muted-foreground/50" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-relaxed break-words">{action.text}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(action.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                        {action.classificationType && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                            {action.classificationType}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {historyQuery.data && (historyQuery.data.hasMore || historyPage > 0) && (
              <div className="flex items-center justify-center gap-2 pt-1">
                {historyPage > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setHistoryPage(historyPage - 1)}
                    data-testid="button-action-history-prev"
                  >
                    Newer
                  </Button>
                )}
                {historyQuery.data.hasMore && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setHistoryPage(historyPage + 1)}
                    data-testid="button-action-history-next"
                  >
                    Older
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RevenueOutlookVisual({ comparison, outlook }: {
  comparison: PredictiveIntelligence["strategicBrief"]["revenueComparison"];
  outlook: string;
}) {
  const maxVal = Math.max(comparison.currentMrr, comparison.expectedMrr, comparison.upsideMrr, comparison.downsideMrr, 1);

  const bars = [
    {
      label: "Current",
      value: comparison.currentMrr,
      pct: (comparison.currentMrr / maxVal) * 100,
      delta: null as number | null,
      color: "bg-muted-foreground/40",
      textColor: "text-muted-foreground",
    },
    {
      label: "Expected",
      value: comparison.expectedMrr,
      pct: (comparison.expectedMrr / maxVal) * 100,
      delta: comparison.expectedDeltaPct,
      color: "bg-blue-500 dark:bg-blue-400",
      textColor: "text-blue-700 dark:text-blue-300",
    },
    {
      label: "Upside",
      value: comparison.upsideMrr,
      pct: (comparison.upsideMrr / maxVal) * 100,
      delta: comparison.upsideDeltaPct,
      color: "bg-primary",
      textColor: "text-primary",
    },
    {
      label: "Downside",
      value: comparison.downsideMrr,
      pct: (comparison.downsideMrr / maxVal) * 100,
      delta: comparison.downsideDeltaPct,
      color: "bg-red-500/70 dark:bg-red-400/70",
      textColor: "text-red-700 dark:text-red-300",
    },
  ];

  return (
    <Card className="hover-elevate transition-all duration-300" data-testid="card-revenue-outlook">
      <CardContent className="pt-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Revenue Outlook</p>
          {comparison.upsideDeltaPct > 0 && (
            <Badge variant="outline" className="text-xs text-primary border-primary/30" data-testid="badge-upside-delta">
              <ArrowUp className="w-3 h-3 mr-1" />
              +{comparison.upsideDeltaPct}% upside potential
            </Badge>
          )}
        </div>

        <div className="space-y-3" data-testid="bars-revenue-comparison">
          {bars.map((bar) => (
            <div key={bar.label} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{bar.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono font-semibold ${bar.textColor}`}>
                    ${bar.value.toLocaleString()}
                  </span>
                  {bar.delta !== null && (
                    <span className={`text-[10px] font-medium ${bar.delta >= 0 ? "text-primary" : "text-red-600 dark:text-red-400"}`}>
                      {bar.delta >= 0 ? "+" : ""}{bar.delta}%
                    </span>
                  )}
                </div>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${bar.color}`}
                  style={{ width: `${Math.max(bar.pct, 2)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground pt-2 border-t" data-testid="text-revenue-outlook">{outlook}</p>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// FOCUS RECOMMENDATION HERO
// ═══════════════════════════════════════════════════════════════

function FocusRecommendationHero({ rec }: { rec: BriefRecommendation }) {
  return (
    <Card className="border-blue-500/30 animate-fade-in-up animation-delay-250" data-testid="card-focus-recommendation">
      <CardContent className="pt-5 pb-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-500" />
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Focus Recommendation</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {rec.crossfitContext && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground border-muted-foreground/20">
                {rec.crossfitContext}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs text-blue-600 dark:text-blue-400 border-blue-500/30" data-testid="badge-focus-score">
              Score: {rec.interventionScore.toLocaleString()}
            </Badge>
          </div>
        </div>

        <p className="text-xs text-muted-foreground italic">If you only do one thing this month — do this.</p>

        <p className="text-sm font-semibold leading-snug" data-testid="text-focus-headline">{rec.headline}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{rec.detail}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Revenue Impact</p>
            <p className="text-sm font-bold text-primary" data-testid="text-focus-revenue-impact">${rec.expectedRevenueImpact.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Members Affected</p>
            <p className="text-sm font-bold" data-testid="text-focus-members-affected">{rec.membersAffected}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Confidence</p>
            <p className="text-sm font-bold" data-testid="text-focus-confidence">{(rec.confidenceWeight * 100).toFixed(0)}%</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Urgency</p>
            <p className="text-sm font-bold" data-testid="text-focus-urgency">{rec.urgencyFactor.toFixed(2)}x</p>
          </div>
        </div>

        <div className="pt-2">
          <p className="text-xs font-medium text-primary">{rec.revenueImpact}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// INTERVENTION SCORE BREAKDOWN
// ═══════════════════════════════════════════════════════════════

function ScoreBreakdown({ rec }: { rec: BriefRecommendation }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2 border-t" data-testid="score-breakdown">
      <div>
        <p className="text-[10px] text-muted-foreground">Score</p>
        <p className="text-xs font-bold font-mono">{rec.interventionScore.toLocaleString()}</p>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground">Rev. Impact</p>
        <p className="text-xs font-bold font-mono text-primary">${rec.expectedRevenueImpact.toLocaleString()}</p>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground">Members</p>
        <p className="text-xs font-bold font-mono">{rec.membersAffected}</p>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground">Churn Est.</p>
        <p className="text-xs font-bold font-mono">{(rec.churnReductionEstimate * 100).toFixed(0)}%</p>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground">Confidence</p>
        <p className="text-xs font-bold font-mono">{(rec.confidenceWeight * 100).toFixed(0)}%</p>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground">Urgency</p>
        <p className="text-xs font-bold font-mono">{rec.urgencyFactor.toFixed(2)}x</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STRATEGIC BRIEF
// ═══════════════════════════════════════════════════════════════

function StrategicBriefView({ gymId, periodStart, brief, recommendationExecution }: { gymId: string; periodStart: string; brief: PredictiveIntelligence["strategicBrief"]; recommendationExecution: RecommendationExecutionCard[] }) {
  const dateStr = new Date(brief.generatedAt).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const { toast } = useToast();
  const executionByHeadline = useMemo(() => new Map(recommendationExecution.map((card) => [card.headline, card])), [recommendationExecution]);

  const toggleChecklistMutation = useMutation({
    mutationFn: async ({ recommendationId, itemId, checked }: { recommendationId: string; itemId: string; checked: boolean }) => {
      await apiRequest("POST", `/api/gyms/${gymId}/recommendations/${recommendationId}/checklist/${itemId}`, { checked, periodStart });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/gyms/${gymId}/predictive`] });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to save checklist", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 animate-fade-in-up">
        <div>
          <h2 className="text-lg font-semibold tracking-tight" data-testid="text-brief-title">Strategic Intelligence Brief</h2>
          <p className="text-sm text-muted-foreground">{dateStr}</p>
        </div>
        <Badge variant="outline" className="text-xs">
          <Zap className="w-3 h-3 mr-1" />
          Algorithmic Intelligence
        </Badge>
      </div>

      <div className="animate-fade-in-up animation-delay-100">
        <StabilityVerdictBar level={brief.stabilityLevel} verdict={brief.stabilityVerdict} />
      </div>

      <Card className="animate-fade-in-up animation-delay-200 hover-elevate transition-all duration-300" data-testid="card-executive-summary">
        <CardContent className="pt-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Executive Summary</p>
          <p className="text-sm leading-relaxed">{brief.executiveSummary}</p>
        </CardContent>
      </Card>

      {brief.focusRecommendation && (
        <FocusRecommendationHero rec={brief.focusRecommendation} />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 animate-fade-in-up animation-delay-300" data-testid="grid-key-metrics">
        {brief.keyMetrics.map((km) => (
          <Card key={km.label} className="hover-elevate transition-all duration-300">
            <CardContent className="pt-4 pb-3 px-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">{km.label}</p>
              <p className={`text-lg font-bold ${km.status === "good" ? "text-primary" : km.status === "warning" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                {km.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {brief.cohortAlert && (
        <Card className="border-amber-500/30 animate-fade-in-up animation-delay-300 hover-elevate transition-all duration-300" data-testid="card-cohort-alert">
          <CardContent className="pt-4 pb-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Cohort Alert</p>
              <p className="text-sm leading-relaxed">{brief.cohortAlert}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4 animate-fade-in-up animation-delay-400" data-testid="section-recommendations">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Strategic Recommendations</h3>
        {brief.recommendations.map((rec, i) => (
          <Card key={i} className="hover-elevate transition-all duration-300" data-testid={`card-recommendation-${i}`}>
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
                  {rec.crossfitContext && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground border-muted-foreground/20">
                      {rec.crossfitContext}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{rec.timeframe}</span>
              </div>
              <p className="text-sm font-medium">{rec.headline}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{rec.detail}</p>

              {rec.executionChecklist && rec.executionChecklist.length > 0 && (
                <div className="pt-3 border-t space-y-2" data-testid={`checklist-recommendation-${i}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Execution Checklist
                    </p>
                    {executionByHeadline.get(rec.headline) && (
                      <Badge variant="outline" className="text-[10px]">
                        Strength {(executionByHeadline.get(rec.headline)!.executionStrength * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1.5 pl-1">
                    {rec.executionChecklist.map((item, j) => {
                      const card = executionByHeadline.get(rec.headline);
                      const checklistItem = card?.checklist.find((entry: { itemId: string; text: string; checked: boolean }) => entry.text === item);
                      const checked = checklistItem?.checked ?? false;
                      return (
                        <button
                          key={j}
                          type="button"
                          className="flex items-start gap-2 group w-full text-left"
                          data-testid={`checklist-item-${i}-${j}`}
                          onClick={() => {
                            if (!card || !checklistItem) return;
                            toggleChecklistMutation.mutate({ recommendationId: card.id, itemId: checklistItem.itemId, checked: !checked });
                          }}
                        >
                          {checked ? <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-primary" /> : <Circle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-muted-foreground/50" />}
                          <span className={`text-xs leading-relaxed ${checked ? "text-foreground" : "text-muted-foreground"}`}>{item}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t">
                <div>
                  <p className="text-xs font-medium text-primary mb-1">Revenue Impact</p>
                  <p className="text-xs text-muted-foreground">{rec.revenueImpact}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Action</p>
                  <p className="text-xs text-muted-foreground">{rec.interventionType}</p>
                </div>
              </div>

              {rec.executionStandard && (
                <div className="pt-2" data-testid={`execution-standard-${i}`}>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Execution Standard: </span>
                    {rec.executionStandard}
                  </p>
                </div>
              )}

              <ScoreBreakdown rec={rec} />
            </CardContent>
          </Card>
        ))}
      </div>

      <OwnerActionsCard gymId={gymId} periodStart={periodStart} />

      <RevenueOutlookVisual comparison={brief.revenueComparison} outlook={brief.revenueOutlook} />

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ENRICHED MEMBER ALERT CARD
// ═══════════════════════════════════════════════════════════════

function MemberAlertCard({ alert, index }: { alert: MemberAlertEnriched; index: number }) {
  const classColors: Record<string, string> = {
    core: "text-primary",
    rising: "text-sky-600 dark:text-sky-400",
    drifter: "text-amber-600 dark:text-amber-400",
    "at-risk": "text-orange-600 dark:text-orange-400",
    ghost: "text-red-600 dark:text-red-400",
  };

  const formatTenure = (days: number): string => {
    if (days < 30) return `${days} days`;
    const months = Math.floor(days / 30.44);
    return `${months} month${months !== 1 ? "s" : ""}`;
  };

  return (
    <Card data-testid={`card-member-alert-${index}`}>
      <CardContent className="py-4 px-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold" data-testid={`text-alert-name-${index}`}>{alert.name}</span>
            <Badge variant="destructive" className="text-xs" data-testid={`badge-alert-risk-${index}`}>{alert.probability}% risk</Badge>
            <Badge variant="outline" className={`text-xs capitalize ${classColors[alert.engagementClass] || ""}`}>
              {alert.engagementClass}
            </Badge>
          </div>
          <span className="text-xs font-medium text-muted-foreground" data-testid={`text-alert-revenue-${index}`}>{alert.revenue}</span>
        </div>

        <p className="text-xs text-muted-foreground" data-testid={`text-alert-driver-${index}`}>{alert.driver}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t">
          <div className="flex items-center gap-2" data-testid={`stat-tenure-${index}`}>
            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Tenure</p>
              <p className="text-xs font-medium">{formatTenure(alert.tenureDays)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2" data-testid={`stat-last-contact-${index}`}>
            <Clock className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Last Contact</p>
              <p className="text-xs font-medium">{alert.lastContactDays !== null ? `${alert.lastContactDays} days ago` : "Never"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2" data-testid={`stat-outreach-${index}`}>
            {alert.outreachLogged ? (
              <UserCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            ) : (
              <MessageSquare className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            )}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Outreach</p>
              <p className={`text-xs font-medium ${alert.outreachLogged ? "text-primary" : "text-red-600 dark:text-red-400"}`}>
                {alert.outreachLogged ? "Yes" : "No"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2" data-testid={`stat-suggested-action-${index}`}>
            <Phone className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Suggested</p>
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">{alert.suggestedAction}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// MEMBER INTELLIGENCE VIEW
// ═══════════════════════════════════════════════════════════════

function MemberRiskView({ predictions, gymId }: { predictions: PredictiveIntelligence["memberPredictions"]; gymId: string }) {
  const { summary, members } = predictions;
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<EnrichedMember | null>(null);
  const [selectedPrediction, setSelectedPrediction] = useState<MemberPrediction | null>(null);

  const { data: enrichedMembers } = useQuery<EnrichedMember[]>({
    queryKey: ["/api/gyms", gymId, "members", "enriched"],
    queryFn: async () => {
      const res = await fetch(`/api/gyms/${gymId}/members/enriched`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const filteredMembers = members.filter(m => {
    const matchesSearch = search === "" ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.email && m.email.toLowerCase().includes(search.toLowerCase()));
    const matchesFilter = activeFilter === null || m.engagementClass === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const totalMembers = Object.values(summary.classBreakdown).reduce((a, b) => a + b, 0);

  const classColors: Record<string, string> = {
    core: "text-primary bg-primary/10 border-primary/20",
    rising: "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20",
    drifter: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
    "at-risk": "text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20",
    ghost: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20",
  };

  const classIcons: Record<string, typeof ShieldCheck> = {
    core: ShieldCheck,
    rising: Sparkles,
    drifter: Shield,
    "at-risk": ShieldAlert,
    ghost: AlertTriangle,
  };

  const classLabels: Record<string, string> = {
    core: "Core",
    rising: "Rising",
    drifter: "Drifter",
    "at-risk": "At-Risk",
    ghost: "Ghost",
  };

  const classTooltips: Record<string, string> = {
    core: "Your retention foundation. These members have been here 90+ days with consistently low churn probability. They attend regularly, are engaged, and drive a significant share of your revenue. Protect them.",
    rising: "Members showing strong early engagement signals — recent attendance, low churn risk, and building momentum in their first 90 days. These are your future Core members. Nurture them with personal attention and goal-setting.",
    drifter: "Showing early signs of disengagement. Attendance may be slipping, or contact has lapsed. A gentle check-in now — a quick text, a coach conversation — can prevent escalation before it starts.",
    "at-risk": "Significant risk signals detected. These members are likely considering leaving. Prioritize direct outreach this week. A personal conversation about their goals can change the trajectory.",
    ghost: "High probability of cancellation without intervention. These members have disengaged significantly and may already be mentally out the door. Immediate, personal outreach is critical to retain them.",
  };

  const classDescriptions: Record<string, (count: number, total: number, members: MemberPrediction[]) => string> = {
    core: (count, total, mems) => {
      const coreMembers = mems.filter(m => m.engagementClass === "core");
      const coreRevenue = coreMembers.reduce((s, m) => s + m.monthlyRate, 0);
      const totalRevenue = mems.reduce((s, m) => s + m.monthlyRate, 0);
      const pct = totalRevenue > 0 ? Math.round((coreRevenue / totalRevenue) * 100) : 0;
      return `Core members account for ${pct}% of revenue. These are your retention foundation.`;
    },
    rising: (count) => `${count} member${count !== 1 ? "s" : ""} building momentum early. Strong engagement in their first 90 days — future Core members.`,
    drifter: (count) => `${count} member${count !== 1 ? "s" : ""} showing early signs of drift. Gentle re-engagement now prevents escalation.`,
    "at-risk": (count) => `${count} member${count !== 1 ? "s" : ""} showing signs they might leave. Reach out this week.`,
    ghost: (count) => `${count} member${count !== 1 ? "s" : ""} likely to cancel without direct action. Immediate outreach is critical.`,
  };

  const urgencyConfig: Record<string, { color: string; bgColor: string; dotColor: string; label: string }> = {
    immediate: { color: "text-red-700 dark:text-red-300", bgColor: "bg-red-500/10", dotColor: "bg-red-500", label: "Immediate" },
    "this-week": { color: "text-red-600 dark:text-red-400", bgColor: "bg-red-500/10", dotColor: "bg-red-400", label: "This Week" },
    "this-month": { color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-500/10", dotColor: "bg-amber-500", label: "This Month" },
    monitor: { color: "text-muted-foreground", bgColor: "", dotColor: "bg-muted-foreground/40", label: "Monitor" },
  };

  const allClasses = ["core", "rising", "drifter", "at-risk", "ghost"] as const;

  const directiveSummary = (() => {
    if (summary.urgentInterventions > 0) {
      return `You have ${summary.urgentInterventions} member${summary.urgentInterventions !== 1 ? "s" : ""} who need attention this week — focus there first to protect $${summary.totalRevenueAtRisk.toLocaleString()}/mo in revenue.`;
    }
    if (summary.totalAtRisk > 0) {
      return `${summary.totalAtRisk} member${summary.totalAtRisk !== 1 ? "s" : ""} are showing risk signals — proactive outreach now can prevent cancellations before they happen.`;
    }
    return "Your roster is in a healthy position. Keep strengthening your Core density and monitoring for early drift signals.";
  })();

  return (
    <div className="space-y-6">
      <div data-testid="text-risk-directive">
        <p className="text-sm leading-relaxed">{directiveSummary}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3" data-testid="grid-risk-summary">
        {allClasses.map((cls) => {
          const Icon = classIcons[cls];
          const count = summary.classBreakdown[cls] || 0;
          const isActive = activeFilter === cls;
          return (
            <Tooltip key={cls}>
              <TooltipTrigger asChild>
                <Card
                  className={`cursor-pointer transition-all duration-200 ${isActive ? `ring-2 ring-offset-1 ${classColors[cls].split(" ").slice(0, 1).join(" ")} ring-current` : "hover-elevate"}`}
                  onClick={() => setActiveFilter(isActive ? null : cls)}
                  data-testid={`card-segment-${cls}`}
                >
                  <CardContent className="pt-4 pb-3 px-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${classColors[cls].split(" ")[0]}`} />
                      <p className="text-xs font-medium">{classLabels[cls]}</p>
                    </div>
                    <p className="text-2xl font-bold">{count}</p>
                    {cls === "core" && totalMembers > 0 && (
                      <p className="text-[10px] text-primary mt-1" data-testid="text-core-density">
                        {Math.round((count / totalMembers) * 100)}% of roster
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-xs font-semibold mb-1">{classLabels[cls]}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{classTooltips[cls]}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {activeFilter && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-xs ${classColors[activeFilter] || ""}`}>
            {classLabels[activeFilter] || activeFilter}
          </Badge>
          <button
            onClick={() => setActiveFilter(null)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-clear-filter"
          >
            Clear filter
          </button>
          <span className="text-xs text-muted-foreground">
            — {filteredMembers.length} member{filteredMembers.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

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
            <p className="text-xs text-muted-foreground mb-1">Need Attention</p>
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

      <div className="sticky top-0 z-50 bg-background pb-3" data-testid="search-member-risk">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search members by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-member-search"
          />
        </div>
      </div>

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
              <TableHead>Recommended Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.slice(0, 50).map((m) => {
              const Icon = classIcons[m.engagementClass] || Shield;
              const urg = urgencyConfig[m.interventionUrgency] || urgencyConfig.monitor;
              return (
                <TableRow
                  key={m.memberId}
                  data-testid={`row-member-${m.memberId}`}
                  className="cursor-pointer"
                  onClick={() => {
                    const enriched = enrichedMembers?.find(em => em.id === m.memberId);
                    if (enriched) {
                      setSelectedMember(enriched);
                      setSelectedPrediction(m);
                    }
                  }}
                >
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
                    <Badge variant="outline" className={`text-xs ${classColors[m.engagementClass] || ""}`}>
                      <Icon className="w-3 h-3 mr-1" />
                      {classLabels[m.engagementClass] || m.engagementClass}
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
                  <TableCell data-testid={`cell-urgency-${m.memberId}`}>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${urg.dotColor}`} />
                      <span className={`text-xs font-semibold ${urg.color}`}>
                        {urg.label}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger className="text-left">
                        <div className="space-y-0.5">
                          <Badge variant="outline" className="text-xs">
                            {m.interventionType.replace(/-/g, " ")}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground/70 leading-tight max-w-[180px]" data-testid={`text-micro-guidance-${m.memberId}`}>
                            {m.interventionMicroGuidance}
                          </p>
                        </div>
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
      {filteredMembers.length > 50 && (
        <p className="text-xs text-muted-foreground text-center">Showing top 50 of {filteredMembers.length} members by risk</p>
      )}

      <PredictiveMemberDrawer 
        member={selectedMember} 
        prediction={selectedPrediction}
        gymId={gymId} 
        onClose={() => { setSelectedMember(null); setSelectedPrediction(null); }} 
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FUTURE PLANNING VIEW (merged Cohort + Scenario)
// ═══════════════════════════════════════════════════════════════

function FuturePlanningView({ cohorts, scenario, gymName, recommendations, memberPredictions }: {
  cohorts: PredictiveIntelligence["cohortIntelligence"];
  scenario: PredictiveIntelligence["revenueScenario"];
  gymName: string;
  recommendations: BriefRecommendation[];
  memberPredictions: PredictiveIntelligence["memberPredictions"];
}) {
  const riskColors: Record<string, string> = {
    low: "text-primary",
    moderate: "text-amber-600 dark:text-amber-400",
    high: "text-orange-600 dark:text-orange-400",
    critical: "text-red-600 dark:text-red-400",
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <DollarSign className="w-3.5 h-3.5" /> Where Your Revenue Is Heading
        </h3>

        <div className="grid sm:grid-cols-4 gap-3" data-testid="grid-scenario-summary">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Best Case</p>
              <p className="text-lg font-bold text-primary">${scenario.upsideMrr.toLocaleString()}/mo</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Most Likely</p>
              <p className="text-lg font-bold">${scenario.expectedMrr.toLocaleString()}/mo</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">If Things Slip</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">${scenario.worstCaseMrr.toLocaleString()}/mo</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Financial Risk</p>
              <p className={`text-lg font-bold capitalize ${riskColors[scenario.cashFlowRiskLevel] || ""}`}>
                {scenario.cashFlowRiskLevel}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="chart-scenario-bands">
          <CardContent className="pt-5">
            <p className="text-sm font-medium mb-4">6-Month Revenue Projection</p>
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
                  <linearGradient id="planUpsideGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 60%, 45%)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(142, 60%, 45%)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="planDownsideGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0, 70%, 55%)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(0, 70%, 55%)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="upside" stroke="hsl(142, 60%, 45%)" fill="url(#planUpsideGrad)" strokeWidth={1.5} strokeDasharray="4 2" name="Upside" />
                <Area type="monotone" dataKey="downside" stroke="hsl(0, 70%, 55%)" fill="url(#planDownsideGrad)" strokeWidth={1.5} strokeDasharray="4 2" name="Downside" />
                <Line type="monotone" dataKey="expected" stroke="hsl(210, 60%, 50%)" strokeWidth={2.5} dot={{ r: 3 }} name="Expected" />
                <Line type="monotone" dataKey="current" stroke="hsl(0, 0%, 60%)" strokeWidth={1} strokeDasharray="6 4" dot={false} name="Current MRR" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Users className="w-3.5 h-3.5" /> How Members Stay (and Leave)
        </h3>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card data-testid="chart-survival-curve">
            <CardContent className="pt-5">
              <p className="text-sm font-medium mb-4">Retention Survival Curve</p>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={cohorts.survivalCurve}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="days" tickFormatter={(d) => d === 0 ? "Join" : d < 365 ? `${d}d` : `${(d/365).toFixed(1)}y`} tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                  <RechartsTooltip
                    formatter={(v: number) => [`${v}%`, "Survival Rate"]}
                    labelFormatter={(d) => `Day ${d}`}
                    contentStyle={{ fontSize: "12px", borderRadius: "6px" }}
                  />
                  <defs>
                    <linearGradient id="planSurvivalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(210, 60%, 50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(210, 60%, 50%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="survivalRate" stroke="hsl(210, 60%, 50%)" fill="url(#planSurvivalGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card data-testid="chart-retention-windows">
            <CardContent className="pt-5">
              <p className="text-sm font-medium mb-4">Where Members Are Lost</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={cohorts.retentionWindows.filter(w => w.lostCount > 0)}>
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
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" /> Planning Ahead
        </h3>

        <Card className="hover-elevate transition-all duration-300" data-testid="card-break-even">
          <CardContent className="pt-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Financial Safety Check</p>
              <Badge variant="outline" className={riskColors[scenario.cashFlowRiskLevel]}>
                {(scenario.breakEvenRisk * 100).toFixed(0)}% risk
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {scenario.breakEvenRisk > 0.3
                ? "There is a meaningful chance revenue could dip below what you need to keep the lights on. Focus on reducing cancellations now to narrow the gap between your best and worst case scenarios."
                : "Your revenue should stay above sustainable levels across all scenarios. Keep doing what you're doing while watching for early warning signs."}
            </p>
          </CardContent>
        </Card>

        {scenario.scenarioInsights.length > 0 && (
          <Card data-testid="card-scenario-insights">
            <CardContent className="pt-5 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">What the Numbers Are Telling You</p>
              {scenario.scenarioInsights.map((ins, i) => (
                <p key={i} className="text-sm leading-relaxed">{ins}</p>
              ))}
            </CardContent>
          </Card>
        )}

        {cohorts.retentionWindows.length > 0 && (
          <Card data-testid="card-retention-insights">
            <CardContent className="pt-5 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">When You're Losing Members</p>
              {cohorts.retentionWindows.filter(w => w.lostCount > 0).map((w, i) => (
                <div key={i} className="border-b last:border-0 pb-3 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">{w.window}</Badge>
                    <span className="text-xs text-red-600 dark:text-red-400">{w.lostCount} lost ({w.lostPct.toFixed(0)}%)</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{w.insight}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <GymSpecificInsights gymName={gymName} recommendations={recommendations} memberPredictions={memberPredictions} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GYM-SPECIFIC INSIGHTS (condensed call-to-action)
// ═══════════════════════════════════════════════════════════════

function GymSpecificInsights({ gymName, recommendations, memberPredictions }: {
  gymName: string;
  recommendations: BriefRecommendation[];
  memberPredictions: PredictiveIntelligence["memberPredictions"];
}) {
  const sortedRecs = [...recommendations].sort((a, b) => b.interventionScore - a.interventionScore);
  const totalRevenueAtRisk = memberPredictions.summary.totalRevenueAtRisk;
  const totalAtRisk = memberPredictions.summary.totalAtRisk;
  const totalImpact = sortedRecs.reduce((sum, r) => sum + r.expectedRevenueImpact, 0);

  const priorityIcon = (priority: string) => {
    if (priority === "critical" || priority === "high") return <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />;
    if (priority === "medium") return <TrendingUp className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />;
    return <Target className="w-3.5 h-3.5 text-primary flex-shrink-0" />;
  };

  return (
    <div className="space-y-3" data-testid="section-gym-specific-insights">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        <Zap className="w-3.5 h-3.5" /> {gymName}-Specific Insights
      </h3>

      <Card className="hover-elevate transition-all duration-300 animate-fade-in-up animation-delay-500">
        <CardContent className="pt-5 space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Your action plan this month</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {totalAtRisk > 0
                ? `${totalAtRisk} member${totalAtRisk === 1 ? " is" : "s are"} at risk representing $${totalRevenueAtRisk.toLocaleString()}/mo in revenue. `
                : ""}
              {sortedRecs.length > 0
                ? `These ${sortedRecs.length} action${sortedRecs.length === 1 ? "" : "s"} can protect up to $${totalImpact.toLocaleString()}/mo. You have control over this outcome.`
                : "No specific actions recommended right now — your gym is in a strong position."}
            </p>
          </div>

          {sortedRecs.length > 0 && (
            <div className="space-y-2">
              {sortedRecs.map((rec, i) => (
                <div key={i} className="flex items-start gap-2.5 py-2 border-b last:border-0 last:pb-0">
                  {priorityIcon(rec.priority)}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-medium leading-snug">{rec.headline}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">{rec.category}</Badge>
                      <span className="text-[10px] text-muted-foreground">{rec.timeframe}</span>
                      {rec.expectedRevenueImpact > 0 && (
                        <span className="text-[10px] font-medium text-primary">
                          +${rec.expectedRevenueImpact.toLocaleString()}/mo potential
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {sortedRecs.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground leading-relaxed text-center">
                Every recommendation above comes from your gym's real data. Check off tasks in the Strategic Brief to start tracking results.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO VIEW
// ═══════════════════════════════════════════════════════════════

function ScenarioView({ scenario }: { scenario: PredictiveIntelligence["revenueScenario"] }) {
  const riskColors: Record<string, string> = {
    low: "text-primary",
    moderate: "text-amber-600 dark:text-amber-400",
    high: "text-orange-600 dark:text-orange-400",
    critical: "text-red-600 dark:text-red-400",
  };

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-4 gap-3 animate-fade-in-up" data-testid="grid-scenario-summary">
        <Card className="hover-elevate transition-all duration-300">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Upside</p>
            <p className="text-lg font-bold text-primary">${scenario.upsideMrr.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate transition-all duration-300">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Expected</p>
            <p className="text-lg font-bold">${scenario.expectedMrr.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate transition-all duration-300">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Downside</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">${scenario.worstCaseMrr.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate transition-all duration-300">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Cash Flow Risk</p>
            <p className={`text-lg font-bold capitalize ${riskColors[scenario.cashFlowRiskLevel] || ""}`}>
              {scenario.cashFlowRiskLevel}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="hover-elevate transition-all duration-300 animate-fade-in-up animation-delay-200" data-testid="chart-scenario-bands">
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
              <Area type="monotone" dataKey="upside" stroke="hsl(142, 60%, 45%)" fill="url(#upsideGrad)" strokeWidth={1.5} strokeDasharray="4 2" name="Upside" animationDuration={1200} animationBegin={200} />
              <Area type="monotone" dataKey="downside" stroke="hsl(0, 70%, 55%)" fill="url(#downsideGrad)" strokeWidth={1.5} strokeDasharray="4 2" name="Downside" animationDuration={1200} animationBegin={400} />
              <Line type="monotone" dataKey="expected" stroke="hsl(210, 60%, 50%)" strokeWidth={2.5} dot={{ r: 3 }} name="Expected" animationDuration={1200} animationBegin={600} />
              <Line type="monotone" dataKey="current" stroke="hsl(0, 0%, 60%)" strokeWidth={1} strokeDasharray="6 4" dot={false} name="Current MRR" animationDuration={1000} animationBegin={800} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="hover-elevate transition-all duration-300 animate-fade-in-up animation-delay-300" data-testid="card-break-even">
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
        <Card className="hover-elevate transition-all duration-300 animate-fade-in-up animation-delay-400" data-testid="card-scenario-insights">
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
// MEMBER DRAWER HELPERS
// ═══════════════════════════════════════════════════════════════

function PredictiveRiskDot({ risk }: { risk: "low" | "medium" | "high" }) {
  const colors = {
    high: "bg-red-500 dark:bg-red-400",
    medium: "bg-amber-500 dark:bg-amber-400",
    low: "bg-primary",
  };
  return <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[risk]}`} />;
}

function PredictiveRiskBadge({ risk }: { risk: "low" | "medium" | "high" }) {
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

function PredictiveMemberDrawer({ member, prediction, gymId, onClose }: { member: EnrichedMember | null; prediction: MemberPrediction | null; gymId: string; onClose: () => void }) {
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
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto" data-testid="drawer-member-detail">
        {member && (
          <>
            <SheetHeader className="space-y-1 pr-8">
              <SheetTitle className="flex items-center gap-2">
                <PredictiveRiskDot risk={member.status === "active" ? member.risk : "low"} />
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
                  <Badge variant={member.status === "active" ? "default" : "outline"} className="text-xs" data-testid="badge-member-status">
                    {member.status}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Risk</p>
                  <PredictiveRiskBadge risk={member.risk} />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tenure</p>
                  <p className="text-sm font-mono font-medium" data-testid="text-member-tenure">
                    {member.tenureMonths > 0 ? `${member.tenureMonths} months` : `${member.tenureDays} days`}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Monthly Rate</p>
                  <p className="text-sm font-mono font-medium" data-testid="text-member-rate">${rate.toFixed(0)}/mo</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Total Revenue</p>
                  <p className="text-sm font-mono font-medium" data-testid="text-member-revenue">${member.totalRevenue.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Joined</p>
                  <p className="text-sm" data-testid="text-member-join-date">
                    {new Date(member.joinDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              </div>

              {member.riskReasons.length > 0 && member.status === "active" && (
                <div className="space-y-2" data-testid="section-risk-signals">
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

              {prediction && (
                <div className="space-y-3" data-testid="section-recommended-action">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Recommended Action</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2" data-testid="badge-engagement-class">
                      <Badge variant="outline" className="text-xs capitalize" data-testid="badge-engagement-class-value">
                        {prediction.engagementClass}
                      </Badge>
                      <span className="text-xs text-muted-foreground" data-testid="text-churn-risk">
                        {(prediction.churnProbability * 100).toFixed(0)}% churn risk
                      </span>
                    </div>
                    <div className="rounded-md bg-muted/50 p-3 space-y-1.5" data-testid="div-intervention-detail">
                      <p className="text-xs font-semibold capitalize" data-testid="text-intervention-type">{prediction.interventionType.replace(/-/g, " ")}</p>
                      <p className="text-sm leading-relaxed" data-testid="text-intervention-detail">{prediction.interventionDetail}</p>
                    </div>
                    {prediction.interventionMicroGuidance && (
                      <p className="text-xs text-muted-foreground leading-relaxed italic" data-testid="text-intervention-guidance">
                        {prediction.interventionMicroGuidance}
                      </p>
                    )}
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
                  data-testid="input-drawer-contact-note"
                />
                <Button
                  size="sm"
                  onClick={() => contactMutation.mutate()}
                  disabled={contactMutation.isPending}
                  data-testid="button-drawer-log-touchpoint"
                >
                  <Phone className="w-3.5 h-3.5 mr-1" />
                  {contactMutation.isPending ? "Logging..." : "Log Touchpoint"}
                </Button>
              </div>

              <div className="border-t pt-4 space-y-3">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Contact History</p>
                {(!contactHistory || contactHistory.length === 0) ? (
                  <p className="text-xs text-muted-foreground" data-testid="text-no-contact-history">No contact history yet.</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto" data-testid="list-contact-history">
                    {contactHistory.slice(0, 20).map((c) => (
                      <div key={c.id} className="flex items-start gap-2 text-xs" data-testid={`contact-entry-${c.id}`}>
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
