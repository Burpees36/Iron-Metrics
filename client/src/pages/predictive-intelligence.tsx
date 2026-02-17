import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import {
  Brain, AlertTriangle, TrendingDown, TrendingUp, Users, DollarSign,
  Shield, ShieldAlert, ShieldCheck, Target, Zap, FileText, BarChart3,
  ChevronRight, Clock, Minus, ArrowUp, ArrowDown, CheckCircle2, Circle,
  MessageSquare, Phone, UserCheck, CalendarDays, Search, Star,
} from "lucide-react";
import { useState } from "react";
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
}

interface CausalFactor {
  factor: string;
  impact: number;
  confidence: number;
  evidence: string;
}

interface CounterfactualScenario {
  action: string;
  projectedChurnProbability: number;
  projectedRevenueAtRisk: number;
  churnDelta: number;
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
  causalFactors?: CausalFactor[];
  counterfactuals?: CounterfactualScenario[];
  recommendationMemory?: string;
  gymArchetype?: string;
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
          <TabsTrigger value="planning" data-testid="tab-planning">
            <Target className="w-4 h-4 mr-1" />
            Future Planning
          </TabsTrigger>
        </TabsList>

        <TabsContent value="brief" className="mt-6">
          <StrategicBriefView brief={data.strategicBrief} />
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <MemberRiskView predictions={data.memberPredictions} gymId={gymId} />
        </TabsContent>

        <TabsContent value="planning" className="mt-6">
          <FuturePlanningView cohorts={data.cohortIntelligence} scenario={data.revenueScenario} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STABILITY VERDICT BAR
// ═══════════════════════════════════════════════════════════════

const stabilityConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string; barWidth: string; dotColor: string }> = {
  strong: {
    label: "Strong",
    color: "text-emerald-700 dark:text-emerald-300",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    barWidth: "w-full",
    dotColor: "bg-emerald-500",
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
            <div className={`w-3 h-3 rounded-full ${config.dotColor} ring-4 ring-opacity-20 ${level === "strong" ? "ring-emerald-500" : level === "moderate" ? "ring-amber-500" : "ring-red-500"}`} />
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
      color: "bg-emerald-500 dark:bg-emerald-400",
      textColor: "text-emerald-700 dark:text-emerald-300",
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
            <Badge variant="outline" className="text-xs text-emerald-700 dark:text-emerald-300 border-emerald-500/30" data-testid="badge-upside-delta">
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
                    <span className={`text-[10px] font-medium ${bar.delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
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
          <Badge variant="outline" className="text-xs text-blue-600 dark:text-blue-400 border-blue-500/30" data-testid="badge-focus-score">
            Score: {rec.interventionScore.toLocaleString()}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground italic">If you only do one thing this month — do this.</p>

        <p className="text-sm font-semibold leading-snug" data-testid="text-focus-headline">{rec.headline}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{rec.detail}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Revenue Impact</p>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-focus-revenue-impact">${rec.expectedRevenueImpact.toLocaleString()}</p>
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
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{rec.revenueImpact}</p>
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
        <p className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">${rec.expectedRevenueImpact.toLocaleString()}</p>
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

function StrategicBriefView({ brief }: { brief: PredictiveIntelligence["strategicBrief"] }) {
  const dateStr = new Date(brief.generatedAt).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
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
              <p className={`text-lg font-bold ${km.status === "good" ? "text-emerald-600 dark:text-emerald-400" : km.status === "warning" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
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
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold leading-snug">{rec.headline}</p>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{rec.timeframe}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={rec.priority === "critical" ? "destructive" : "secondary"}
                    className={rec.priority === "high" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" : ""}
                  >
                    {rec.priority}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{rec.category}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{rec.detail}</p>

              {rec.executionChecklist && rec.executionChecklist.length > 0 && (
                <div className="pt-3 border-t space-y-2" data-testid={`checklist-recommendation-${i}`}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Execution Checklist
                  </p>
                  <div className="space-y-1.5 pl-1">
                    {rec.executionChecklist.map((item, j) => (
                      <div key={j} className="flex items-start gap-2 group" data-testid={`checklist-item-${i}-${j}`}>
                        <Circle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-muted-foreground/50" />
                        <span className="text-xs leading-relaxed text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t">
                <div>
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">Revenue Impact</p>
                  <p className="text-xs text-muted-foreground">{rec.revenueImpact}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Action</p>
                  <p className="text-xs text-muted-foreground">{rec.interventionType}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <RevenueOutlookVisual comparison={brief.revenueComparison} outlook={brief.revenueOutlook} />


      <Card className="animate-fade-in-up animation-delay-600 hover-elevate transition-all duration-300" data-testid="card-roi-projection">
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
// ENRICHED MEMBER ALERT CARD
// ═══════════════════════════════════════════════════════════════

function MemberAlertCard({ alert, index }: { alert: MemberAlertEnriched; index: number }) {
  const classColors: Record<string, string> = {
    core: "text-emerald-600 dark:text-emerald-400",
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
              <UserCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            ) : (
              <MessageSquare className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            )}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Outreach</p>
              <p className={`text-xs font-medium ${alert.outreachLogged ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
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
// MEMBER RISK VIEW
// ═══════════════════════════════════════════════════════════════

function MemberRiskView({ predictions, gymId }: { predictions: PredictiveIntelligence["memberPredictions"]; gymId: string }) {
  const { summary, members } = predictions;
  const [search, setSearch] = useState("");
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

  const filteredMembers = members.filter(m =>
    search === "" ||
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.email && m.email.toLowerCase().includes(search.toLowerCase()))
  );

  const totalMembers = Object.values(summary.classBreakdown).reduce((a, b) => a + b, 0);

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

  const classDescriptions: Record<string, (count: number, total: number, members: MemberPrediction[]) => string> = {
    core: (count, total, mems) => {
      const coreMembers = mems.filter(m => m.engagementClass === "core");
      const coreRevenue = coreMembers.reduce((s, m) => s + m.monthlyRate, 0);
      const totalRevenue = mems.reduce((s, m) => s + m.monthlyRate, 0);
      const pct = totalRevenue > 0 ? Math.round((coreRevenue / totalRevenue) * 100) : 0;
      return `Core members account for ${pct}% of revenue. These are your retention foundation.`;
    },
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="grid-risk-summary">
        {(["core", "drifter", "at-risk", "ghost"] as const).map((cls) => {
          const Icon = classIcons[cls];
          const count = summary.classBreakdown[cls] || 0;
          const description = classDescriptions[cls](count, totalMembers, members);
          return (
            <Tooltip key={cls}>
              <TooltipTrigger asChild>
                <Card data-testid={`card-segment-${cls}`}>
                  <CardContent className="pt-4 pb-3 px-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${classColors[cls].split(" ")[0]}`} />
                      <p className="text-xs font-medium capitalize">{cls}</p>
                    </div>
                    <p className="text-2xl font-bold">{count}</p>
                    {cls === "core" && totalMembers > 0 && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1" data-testid="text-core-density">
                        {Math.round((count / totalMembers) * 100)}% of roster
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-xs leading-relaxed">{description}</p>
              </TooltipContent>
            </Tooltip>
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

function FuturePlanningView({ cohorts, scenario }: {
  cohorts: PredictiveIntelligence["cohortIntelligence"];
  scenario: PredictiveIntelligence["revenueScenario"];
}) {
  const riskColors: Record<string, string> = {
    low: "text-emerald-600 dark:text-emerald-400",
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
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">${scenario.upsideMrr.toLocaleString()}/mo</p>
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

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5" /> Cohort Performance
        </h3>

        <Card data-testid="chart-cohort-survival">
          <CardContent className="pt-5">
            <p className="text-sm font-medium mb-4">Cohort Survival Rates</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={cohorts.cohorts}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="cohortLabel" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <RechartsTooltip
                  formatter={(v: number, name: string) => {
                    if (name === "survivalRate") return [`${v}%`, "Survival Rate"];
                    return [v, name];
                  }}
                  contentStyle={{ fontSize: "12px", borderRadius: "6px" }}
                />
                <Bar dataKey="survivalRate" fill="hsl(210, 60%, 50%)" radius={[4, 4, 0, 0]} name="Survival Rate" animationDuration={800} animationBegin={300} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="rounded-md border overflow-x-auto" data-testid="table-cohorts">
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
              {cohorts.cohorts.map((c) => (
                <TableRow key={c.cohortMonth}>
                  <TableCell className="font-medium">{c.cohortLabel}</TableCell>
                  <TableCell className="text-right">{c.totalJoined}</TableCell>
                  <TableCell className="text-right">{c.stillActive}</TableCell>
                  <TableCell className="text-right">
                    <span className={`font-medium ${c.survivalRate >= 70 ? "text-emerald-600 dark:text-emerald-400" : c.survivalRate >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
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

      {cohorts.crossfitInsights.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-3.5 h-3.5" /> CrossFit-Specific Insights
          </h3>
          <Card data-testid="card-crossfit-insights">
            <CardContent className="pt-5 space-y-3">
              {cohorts.crossfitInsights.map((ins, i) => (
                <p key={i} className="text-sm leading-relaxed">{ins}</p>
              ))}
            </CardContent>
          </Card>
        </div>
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
        <Card className="hover-elevate transition-all duration-300 animate-fade-in-up" data-testid="chart-survival-curve">
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
                <Area type="monotone" dataKey="survivalRate" stroke="hsl(210, 60%, 50%)" fill="url(#survivalGrad)" strokeWidth={2} animationDuration={1200} animationBegin={200} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all duration-300 animate-fade-in-up animation-delay-200" data-testid="chart-retention-windows">
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
                <Bar dataKey="lostCount" fill="hsl(0, 70%, 55%)" radius={[4, 4, 0, 0]} name="Members Lost" animationDuration={800} animationBegin={200} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="hover-elevate transition-all duration-300 animate-fade-in-up animation-delay-300" data-testid="chart-cohort-survival">
        <CardContent className="pt-5">
          <p className="text-sm font-medium mb-4">Cohort Survival Rates</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.cohorts}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="cohortLabel" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <RechartsTooltip
                formatter={(v: number, name: string) => {
                  if (name === "survivalRate") return [`${v}%`, "Survival Rate"];
                  return [v, name];
                }}
                contentStyle={{ fontSize: "12px", borderRadius: "6px" }}
              />
              <Bar dataKey="survivalRate" fill="hsl(210, 60%, 50%)" radius={[4, 4, 0, 0]} name="Survival Rate" animationDuration={800} animationBegin={300} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="rounded-md border overflow-x-auto" data-testid="table-cohorts">
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
            {data.cohorts.map((c) => (
              <TableRow key={c.cohortMonth}>
                <TableCell className="font-medium">{c.cohortLabel}</TableCell>
                <TableCell className="text-right">{c.totalJoined}</TableCell>
                <TableCell className="text-right">{c.stillActive}</TableCell>
                <TableCell className="text-right">
                  <span className={`font-medium ${c.survivalRate >= 70 ? "text-emerald-600 dark:text-emerald-400" : c.survivalRate >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
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

      {data.retentionWindows.length > 0 && (
        <Card className="hover-elevate transition-all duration-300 animate-fade-in-up animation-delay-400" data-testid="card-retention-insights">
          <CardContent className="pt-5 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Retention Window Insights</p>
            {data.retentionWindows.filter(w => w.lostCount > 0).map((w, i) => (
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

      {data.crossfitInsights.length > 0 && (
        <Card className="hover-elevate transition-all duration-300 animate-fade-in-up animation-delay-500" data-testid="card-crossfit-insights">
          <CardContent className="pt-5 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">CrossFit-Specific Insights</p>
            {data.crossfitInsights.map((ins, i) => (
              <p key={i} className="text-sm leading-relaxed">{ins}</p>
            ))}
          </CardContent>
        </Card>
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
      <div className="grid sm:grid-cols-4 gap-3 animate-fade-in-up" data-testid="grid-scenario-summary">
        <Card className="hover-elevate transition-all duration-300">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Upside</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">${scenario.upsideMrr.toLocaleString()}</p>
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
    low: "bg-emerald-500 dark:bg-emerald-400",
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

              {prediction?.causalFactors && prediction.causalFactors.length > 0 && (
                <div className="space-y-2" data-testid="section-causal-factors">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Why This Member Is At Risk</p>
                  <div className="space-y-1.5">
                    {prediction.causalFactors.slice(0, 5).map((cf, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs" data-testid={`causal-factor-${i}`}>
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${cf.impact > 0.05 ? "bg-destructive" : cf.impact > 0 ? "bg-yellow-500" : "bg-emerald-500"}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{cf.factor}</span>
                            <span className="text-muted-foreground">
                              {cf.impact > 0 ? "+" : ""}{(cf.impact * 100).toFixed(1)}% risk
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-0.5">{cf.evidence}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {prediction?.counterfactuals && prediction.counterfactuals.length > 0 && (
                <div className="space-y-2" data-testid="section-counterfactual">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">If You Act Now</p>
                  <div className="space-y-1.5">
                    {prediction.counterfactuals.map((cs, i) => (
                      <div key={i} className="rounded-md bg-muted/30 p-2 text-xs space-y-0.5" data-testid={`counterfactual-${i}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium capitalize">{cs.action.replace(/-/g, " ")}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {Math.abs(cs.churnDelta * 100).toFixed(0)}% reduction
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">
                          Projected churn: {(cs.projectedChurnProbability * 100).toFixed(0)}% — ${cs.projectedRevenueAtRisk.toLocaleString()} revenue at risk
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {prediction?.gymArchetype && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="text-gym-archetype">
                  <Target className="w-3 h-3" />
                  <span>Gym profile: <span className="capitalize font-medium text-foreground">{prediction.gymArchetype.replace(/-/g, " ")}</span></span>
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
