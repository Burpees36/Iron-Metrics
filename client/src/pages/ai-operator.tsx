import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { useGymData, GymPageShell, GymNotFound, GymDetailSkeleton, PageHeader } from "./gym-detail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Zap,
  Shield,
  Users,
  DollarSign,
  Heart,
  UserCheck,
  ChevronDown,
  ChevronRight,
  Copy,
  CheckCircle2,
  Clock,
  History,
  AlertTriangle,
  FileText,
  Clipboard,
  Mail,
  MessageSquare,
  User,
  Loader2,
  ArrowRight,
  Edit3,
  RefreshCw,
  ListChecks,
  TrendingUp,
  Target,
} from "lucide-react";
import type { OperatorOutput, OperatorPill, OperatorTaskType, AiOperatorRun, ProjectedImpact } from "@shared/schema";
import { OPERATOR_PILLS, OPERATOR_TASK_TYPES } from "@shared/schema";

const PILL_CONFIG: Record<OperatorPill, { label: string; icon: typeof Shield; color: string }> = {
  retention: { label: "Retention", icon: Shield, color: "text-emerald-400" },
  sales: { label: "Sales", icon: DollarSign, color: "text-blue-400" },
  coaching: { label: "Coaching", icon: UserCheck, color: "text-amber-400" },
  community: { label: "Community", icon: Heart, color: "text-rose-400" },
  owner: { label: "Owner Protection", icon: User, color: "text-violet-400" },
};

const TASK_ICONS: Record<string, typeof FileText> = {
  "7-day plan": Clipboard,
  "Member outreach drafts": Mail,
  "Sales follow-up sequence": MessageSquare,
  "Staff coaching note": FileText,
  "Event plan": Users,
};

const CHANNEL_LABELS: Record<string, string> = {
  sms: "SMS",
  email: "Email",
  in_person: "In-Person",
};

interface OperatorContext {
  role: string;
  canGenerate: boolean;
  canViewHistory: boolean;
  metrics: {
    activeMembers: number | null;
    churnRate: number | null;
    mrr: number | null;
    rsi: number | null;
    avgLtv: number | null;
    newLeads: number;
    conversionRate: number;
  };
  gymArchetype?: "growth" | "stable" | "declining" | "startup";
  dataCompletenessScore?: number;
}

interface GenerateResponse {
  run: any;
  outputs: OperatorOutput[];
  reasoningSummary?: string;
  confidenceScore?: number;
  dataCompletenessScore?: number;
}

const ARCHETYPE_LABELS: Record<string, { label: string; color: string }> = {
  growth: { label: "Growth", color: "text-emerald-400" },
  stable: { label: "Stable", color: "text-blue-400" },
  declining: { label: "Declining", color: "text-amber-400" },
  startup: { label: "Startup", color: "text-violet-400" },
};

function ContextPreview({ metrics, pill, gymArchetype, dataCompletenessScore }: {
  metrics: OperatorContext["metrics"];
  pill: OperatorPill;
  gymArchetype?: string;
  dataCompletenessScore?: number;
}) {
  const items: { label: string; value: string }[] = [];

  if (pill === "retention" || pill === "owner") {
    if (metrics.activeMembers !== null) items.push({ label: "Active Members", value: String(metrics.activeMembers) });
    if (metrics.churnRate !== null) items.push({ label: "Churn Rate", value: `${metrics.churnRate}%` });
    if (metrics.rsi !== null) items.push({ label: "RSI", value: String(metrics.rsi) });
  }
  if (pill === "sales") {
    items.push({ label: "Recent Leads (30d)", value: String(metrics.newLeads) });
    items.push({ label: "Conversion Rate", value: `${metrics.conversionRate}%` });
  }
  if (pill === "coaching" || pill === "community") {
    if (metrics.activeMembers !== null) items.push({ label: "Active Members", value: String(metrics.activeMembers) });
    items.push({ label: "Recent Leads", value: String(metrics.newLeads) });
  }
  if (metrics.mrr !== null) items.push({ label: "MRR", value: `$${Number(metrics.mrr).toLocaleString()}` });
  if (metrics.avgLtv !== null && metrics.avgLtv > 0) items.push({ label: "Avg LTV", value: `$${Number(metrics.avgLtv).toLocaleString()}` });

  if (items.length === 0) {
    items.push({ label: "Data", value: "Import members and leads to enable context-aware generation" });
  }

  const archetypeConfig = gymArchetype ? ARCHETYPE_LABELS[gymArchetype] : null;

  return (
    <Card className="border-border/50" data-testid="context-preview">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" />
          Data Context Preview
          {archetypeConfig && (
            <Badge variant="outline" className={`text-[10px] ml-auto ${archetypeConfig.color}`} data-testid="badge-gym-archetype">
              {archetypeConfig.label} Profile
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">High-level metrics that will inform the generated output. No member PII is included.</p>
        {dataCompletenessScore !== undefined && (
          <div className="mb-3" data-testid="data-completeness">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Data Completeness</span>
              <span className="text-xs font-medium">{dataCompletenessScore}/100</span>
            </div>
            <div className="w-full h-1.5 bg-muted/30 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${dataCompletenessScore >= 70 ? "bg-emerald-500" : dataCompletenessScore >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${dataCompletenessScore}%` }}
              />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {items.map((item) => (
            <div key={item.label} className="bg-muted/30 rounded-md px-3 py-2" data-testid={`context-metric-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</div>
              <div className="text-sm font-semibold">{item.value}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const IMPACT_TIER_STYLES: Record<string, string> = {
  High: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  Moderate: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  Low: "bg-muted/30 text-muted-foreground border-border/30",
};

function ProjectedImpactBlock({ impact }: { impact: ProjectedImpact }) {
  return (
    <div className="bg-muted/15 border border-border/30 rounded-lg p-3 space-y-2" data-testid="projected-impact">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Estimated Impact</span>
        <Badge variant="outline" className={`text-[10px] ml-auto border ${IMPACT_TIER_STYLES[impact.impact_tier]}`} data-testid="impact-tier-badge">
          {impact.impact_tier} Impact
        </Badge>
      </div>
      <p className="text-sm font-mono text-foreground" data-testid="impact-formula">
        {impact.members_affected} members × ${impact.arm} ARM × {impact.months_remaining} months × {impact.estimated_lift_pct}% lift
      </p>
      <p className="text-base font-semibold text-emerald-400" data-testid="impact-revenue">
        ≈ ${impact.expected_revenue_impact.toLocaleString()} projected retention preservation
      </p>
      {impact.urgency_multiplier !== undefined && impact.urgency_multiplier > 1.0 && (
        <p className="text-[10px] text-amber-400" data-testid="impact-urgency">
          Urgency multiplier: ×{impact.urgency_multiplier} applied
        </p>
      )}
    </div>
  );
}

function OutputCard({ output, index, pill, gymArchetype, onCopy, onMarkReviewed, onConvertToTasks, convertingTasks }: {
  output: OperatorOutput;
  index: number;
  pill: OperatorPill;
  gymArchetype?: string;
  onCopy: (text: string) => void;
  onMarkReviewed?: () => void;
  onConvertToTasks?: () => void;
  convertingTasks?: boolean;
}) {
  const [draftsExpanded, setDraftsExpanded] = useState(false);
  const [metricsExpanded, setMetricsExpanded] = useState(false);
  const [editingDraft, setEditingDraft] = useState<number | null>(null);
  const [editedDrafts, setEditedDrafts] = useState<Record<number, string>>({});

  const getDraftMessage = (di: number, original: string) => editedDrafts[di] ?? original;

  const fullText = useMemo(() => {
    let text = `${output.headline}\n\n${output.why_it_matters}\n\nActions:\n`;
    output.actions.forEach((a, i) => { text += `${i + 1}. ${a}\n`; });
    if (output.drafts?.length) {
      text += "\nDrafts:\n";
      output.drafts.forEach((d, di) => { text += `\n[${CHANNEL_LABELS[d.channel] || d.channel}]\n${getDraftMessage(di, d.message)}\n`; });
    }
    return text;
  }, [output, editedDrafts]);

  return (
    <Card className="border-border/50" data-testid={`output-card-${index}`}>
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`text-[10px] ${PILL_CONFIG[pill]?.color || ""}`} data-testid={`output-pill-tag-${index}`}>
                {PILL_CONFIG[pill]?.label || pill}
              </Badge>
              {output.projected_impact && (
                <Badge variant="outline" className={`text-[10px] border ${IMPACT_TIER_STYLES[output.projected_impact.impact_tier]}`} data-testid={`output-impact-tag-${index}`}>
                  {output.projected_impact.impact_tier} Impact
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px]" data-testid={`output-confidence-${index}`}>
                {output.confidence_label === "Med" ? "Medium" : output.confidence_label === "Low" ? "Limited Data" : output.confidence_label} Confidence
              </Badge>
              <span className="text-[10px] text-muted-foreground italic">Draft — review before sending.</span>
            </div>
            <h3 className="font-semibold text-base" data-testid={`output-headline-${index}`}>{output.headline}</h3>
          </div>
        </div>

        <p className="text-sm text-muted-foreground" data-testid={`output-why-${index}`}>{output.why_it_matters}</p>

        {output.projected_impact && <ProjectedImpactBlock impact={output.projected_impact} />}

        {gymArchetype && gymArchetype !== "stable" && (
          <p className="text-xs text-muted-foreground italic" data-testid={`archetype-reasoning-${index}`}>
            This recommendation is boosted because your gym is identified as: <span className="font-medium text-foreground">{ARCHETYPE_LABELS[gymArchetype]?.label || gymArchetype}</span>.
          </p>
        )}

        <div className="space-y-1.5">
          {output.actions.map((action, i) => (
            <div key={i} className="flex items-start gap-2 text-sm" data-testid={`output-action-${index}-${i}`}>
              <CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <span>{action}</span>
            </div>
          ))}
        </div>

        {output.drafts && output.drafts.length > 0 && (
          <Collapsible open={draftsExpanded} onOpenChange={setDraftsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" data-testid={`toggle-drafts-${index}`}>
                {draftsExpanded ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
                {output.drafts.length} draft{output.drafts.length > 1 ? "s" : ""} available
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 mt-2">
              {output.drafts.map((draft, di) => (
                <div key={di} className="bg-muted/30 rounded-md p-3 space-y-2" data-testid={`draft-${index}-${di}`}>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-[10px]">{CHANNEL_LABELS[draft.channel] || draft.channel}</Badge>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setEditingDraft(editingDraft === di ? null : di)}
                        data-testid={`edit-draft-${index}-${di}`}
                      >
                        <Edit3 className="w-3 h-3 mr-1" /> {editingDraft === di ? "Done" : "Edit"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onCopy(getDraftMessage(di, draft.message))}
                        data-testid={`copy-draft-${index}-${di}`}
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copy
                      </Button>
                    </div>
                  </div>
                  {editingDraft === di ? (
                    <textarea
                      className="w-full min-h-[100px] text-sm bg-background border border-border rounded-md p-2 resize-y focus:outline-none focus:ring-1 focus:ring-primary"
                      value={getDraftMessage(di, draft.message)}
                      onChange={(e) => setEditedDrafts(prev => ({ ...prev, [di]: e.target.value }))}
                      data-testid={`draft-editor-${index}-${di}`}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{getDraftMessage(di, draft.message)}</p>
                  )}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {output.reasoning_summary && (
          <p className="text-xs italic text-muted-foreground border-l-2 border-border/40 pl-3" data-testid={`output-reasoning-${index}`}>
            {output.reasoning_summary}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2 border-t border-border/30 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => onCopy(fullText)} data-testid={`copy-output-${index}`}>
            <Copy className="w-3.5 h-3.5 mr-1" /> Copy All
          </Button>
          {onMarkReviewed && (
            <Button variant="ghost" size="sm" onClick={onMarkReviewed} data-testid={`mark-reviewed-${index}`}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark as Reviewed
            </Button>
          )}
          {onConvertToTasks && (
            <Button variant="outline" size="sm" onClick={onConvertToTasks} disabled={convertingTasks} data-testid={`convert-tasks-${index}`}>
              {convertingTasks ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ListChecks className="w-3.5 h-3.5 mr-1" />}
              Convert to Tasks
            </Button>
          )}
        </div>

        <Collapsible open={metricsExpanded} onOpenChange={setMetricsExpanded}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors" data-testid={`toggle-metrics-${index}`}>
              {metricsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Metrics used ({output.metrics_used.length})
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-1.5">
            <div className="flex flex-wrap gap-1.5">{output.metrics_used.map((m) => (
              <span key={m} className="text-[10px] bg-muted/40 text-muted-foreground px-2 py-0.5 rounded-full">{m}</span>
            ))}</div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function HistoryTable({ runs }: { runs: AiOperatorRun[] }) {
  if (runs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm" data-testid="history-empty">
        No generation history yet. Run your first generation above.
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="history-list">
      {runs.map((run) => {
        const pillConfig = PILL_CONFIG[run.pill as OperatorPill];
        const PillIcon = pillConfig?.icon || Zap;
        const outputs = (run.outputJson as OperatorOutput[]) || [];

        return (
          <Card key={run.id} className="border-border/30" data-testid={`history-run-${run.id}`}>
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <PillIcon className={`w-4 h-4 flex-shrink-0 ${pillConfig?.color || "text-muted-foreground"}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {pillConfig?.label || run.pill} — {run.taskType}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(run.createdAt).toLocaleDateString()} {new Date(run.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {outputs.length > 0 && ` · ${outputs.length} output${outputs.length > 1 ? "s" : ""}`}
                    </div>
                  </div>
                </div>
                <Badge
                  variant={run.status === "reviewed" ? "default" : run.status === "archived" ? "secondary" : "outline"}
                  className="text-[10px] flex-shrink-0"
                  data-testid={`history-status-${run.id}`}
                >
                  {run.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function AiOperator() {
  const [, params] = useRoute("/gyms/:id/operator");
  const gymId = params?.id;
  const [location] = useLocation();
  const { isDemo } = useAuth();
  const { toast } = useToast();

  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const preselectedPill = searchParams.get("pill") as OperatorPill | null;
  const preselectedTask = searchParams.get("task") as OperatorTaskType | null;

  const [selectedPill, setSelectedPill] = useState<OperatorPill>(
    preselectedPill && OPERATOR_PILLS.includes(preselectedPill) ? preselectedPill : "retention"
  );
  const [selectedTask, setSelectedTask] = useState<OperatorTaskType>(
    preselectedTask && OPERATOR_TASK_TYPES.includes(preselectedTask) ? preselectedTask : "7-day plan"
  );
  const [consentChecked, setConsentChecked] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [outputs, setOutputs] = useState<OperatorOutput[]>([]);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [lastConfidenceScore, setLastConfidenceScore] = useState<number | null>(null);
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
  const [tasksConverted, setTasksConverted] = useState(false);
  const [showWeeklyPlan, setShowWeeklyPlan] = useState(false);

  const { data: gym, isLoading: gymLoading } = useGymData(gymId);

  const { data: context, isLoading: contextLoading } = useQuery<OperatorContext>({
    queryKey: ["/api/gyms", gymId, "operator", "context"],
    enabled: !!gymId,
  });

  const { data: history, isLoading: historyLoading } = useQuery<AiOperatorRun[]>({
    queryKey: ["/api/gyms", gymId, "operator", "history"],
    enabled: !!gymId && showHistory,
  });

  interface WeeklyPlanDay {
    day: string;
    pill: string;
    focus: string;
    impact: ProjectedImpact;
  }
  interface WeeklyPlanData {
    totalProjectedImpact: number;
    topInterventions: Array<ProjectedImpact & { pill: string }>;
    plan: WeeklyPlanDay[];
    archetype: string;
  }

  const { data: weeklyPlan, isLoading: weeklyPlanLoading } = useQuery<WeeklyPlanData>({
    queryKey: ["/api/gyms", gymId, "operator", "weekly-plan"],
    enabled: !!gymId && showWeeklyPlan,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      setRateLimitMessage(null);
      const res = await apiRequest("POST", `/api/gyms/${gymId}/operator/generate`, {
        pill: selectedPill,
        taskType: selectedTask,
      });
      return res.json();
    },
    onSuccess: (data: GenerateResponse) => {
      setOutputs(data.outputs);
      setLastRunId(data.run.id);
      setLastConfidenceScore(data.confidenceScore ?? null);
      setConsentChecked(false);
      setTasksConverted(false);
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "operator", "history"] });
    },
    onError: (err: Error) => {
      if (err.message.startsWith("429:")) {
        try {
          const body = JSON.parse(err.message.slice(5));
          setRateLimitMessage(`Rate limit reached. Try again in ${body.retryAfterSeconds || 60} seconds.`);
        } catch {
          setRateLimitMessage("Rate limit reached. Please wait before generating again.");
        }
      } else {
        toast({ title: "Generation failed", description: "Something went wrong. Try again.", variant: "destructive" });
      }
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ runId, status }: { runId: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/gyms/${gymId}/operator/runs/${runId}`, { status });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "operator", "history"] });
    },
  });

  const convertToTasksMutation = useMutation({
    mutationFn: async ({ runId, output }: { runId: string; output: OperatorOutput }) => {
      const impactPerTask = output.projected_impact
        ? Math.round(output.projected_impact.expected_revenue_impact / output.actions.length)
        : null;
      const tasks = output.actions.map(action => ({
        title: action,
        pill: selectedPill,
        impactValueEstimate: impactPerTask ? String(impactPerTask) : null,
      }));
      const res = await apiRequest("POST", `/api/gyms/${gymId}/operator/tasks`, { runId, tasks });
      return res.json();
    },
    onSuccess: () => {
      setTasksConverted(true);
      toast({ title: "Tasks created", description: "Action items converted to trackable tasks." });
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "operator", "tasks"] });
    },
    onError: () => {
      toast({ title: "Failed to create tasks", variant: "destructive" });
    },
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied to clipboard" });
    });
  };

  if (gymLoading) return <GymDetailSkeleton />;
  if (!gym) return <GymNotFound />;

  const canGen = context?.canGenerate ?? false;

  return (
    <GymPageShell gym={gym}>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title="AI Operator"
          subtitle="Turns your metrics into clear actions."
          howTo="Select a focus area and task type, review the data context, then generate structured output."
          icon={Zap}
        />

        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Focus Area</label>
            <div className="flex flex-wrap gap-2" data-testid="pill-selector">
              {OPERATOR_PILLS.map((pill) => {
                const config = PILL_CONFIG[pill];
                const PillIcon = config.icon;
                return (
                  <Button
                    key={pill}
                    variant={selectedPill === pill ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPill(pill)}
                    className="gap-1.5"
                    data-testid={`pill-${pill}`}
                  >
                    <PillIcon className={`w-3.5 h-3.5 ${selectedPill === pill ? "" : config.color}`} />
                    {config.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Task Type</label>
            <div className="flex flex-wrap gap-2" data-testid="task-selector">
              {OPERATOR_TASK_TYPES.map((task) => {
                const TaskIcon = TASK_ICONS[task] || FileText;
                return (
                  <Button
                    key={task}
                    variant={selectedTask === task ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTask(task)}
                    className="gap-1.5"
                    data-testid={`task-${task.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    <TaskIcon className="w-3.5 h-3.5" />
                    {task}
                  </Button>
                );
              })}
            </div>
          </div>

          <Collapsible open={showContext} onOpenChange={setShowContext}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground" data-testid="toggle-context-preview">
                {showContext ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
                {showContext ? "Hide" : "Show"} data context
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              {contextLoading ? (
                <Skeleton className="h-32 w-full rounded-lg" />
              ) : context ? (
                <ContextPreview
                  metrics={context.metrics}
                  pill={selectedPill}
                  gymArchetype={context.gymArchetype}
                  dataCompletenessScore={context.dataCompletenessScore}
                />
              ) : null}
            </CollapsibleContent>
          </Collapsible>

          <div className="bg-muted/20 border border-border/30 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="consent"
                checked={consentChecked}
                onCheckedChange={(v) => setConsentChecked(v === true)}
                data-testid="checkbox-consent"
              />
              <label htmlFor="consent" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                I understand this is a draft and I must review before use. This is not a substitute for legal, tax, medical, or professional advice.
              </label>
            </div>

            <Button
              onClick={() => generateMutation.mutate()}
              disabled={!consentChecked || generateMutation.isPending || !canGen || isDemo}
              className="w-full sm:w-auto gap-2"
              data-testid="button-generate"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <><Zap className="w-4 h-4" /> Generate</>
              )}
            </Button>

            {isDemo && (
              <p className="text-xs text-muted-foreground">Generation is disabled in demo mode.</p>
            )}

            {!canGen && !isDemo && (
              <p className="text-xs text-muted-foreground">Your current role does not allow generation.</p>
            )}

            {rateLimitMessage && (
              <p className="text-xs text-amber-400" data-testid="text-rate-limit">{rateLimitMessage}</p>
            )}
          </div>
        </div>

        {outputs.length > 0 && (
          <div className="space-y-4" data-testid="output-section">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Strategic Execution Brief</h2>
                {lastConfidenceScore !== null && (
                  <div className="flex items-center gap-2" data-testid="confidence-indicator">
                    <div className="w-16 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${lastConfidenceScore >= 70 ? "bg-emerald-500" : lastConfidenceScore >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${lastConfidenceScore}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{lastConfidenceScore}/100</span>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setConsentChecked(true); generateMutation.mutate(); }}
                disabled={generateMutation.isPending || !canGen || isDemo}
                className="gap-1.5"
                data-testid="button-regenerate"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Regenerating...</>
                ) : (
                  <><RefreshCw className="w-3.5 h-3.5" /> Regenerate</>
                )}
              </Button>
            </div>
            {outputs.map((output, i) => (
              <OutputCard
                key={i}
                output={output}
                index={i}
                pill={selectedPill}
                gymArchetype={context?.gymArchetype}
                onCopy={handleCopy}
                onMarkReviewed={
                  lastRunId
                    ? () => updateStatusMutation.mutate({ runId: lastRunId, status: "reviewed" })
                    : undefined
                }
                onConvertToTasks={
                  lastRunId && !isDemo && !tasksConverted
                    ? () => convertToTasksMutation.mutate({ runId: lastRunId, output })
                    : undefined
                }
                convertingTasks={convertToTasksMutation.isPending}
              />
            ))}
            {tasksConverted && (
              <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg" data-testid="tasks-created-banner">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-400">Tasks created.</span>
                <Link href={`/gyms/${gymId}/operator/active`}>
                  <Button variant="link" size="sm" className="text-emerald-400 p-0 h-auto" data-testid="link-active-tasks">
                    View Active Tasks <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-border/30 pt-4">
          <Collapsible open={showWeeklyPlan} onOpenChange={setShowWeeklyPlan}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5" data-testid="toggle-weekly-plan">
                <Clock className="w-4 h-4" />
                {showWeeklyPlan ? "Hide" : "Show"} Auto-Prioritized Weekly Plan
                {showWeeklyPlan ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              {weeklyPlanLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <Skeleton key={i} className="h-32 rounded-lg" />
                    ))}
                  </div>
                </div>
              ) : weeklyPlan ? (
                <div className="space-y-4" data-testid="weekly-plan-section">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-emerald-400">
                        ${weeklyPlan.totalProjectedImpact.toLocaleString()} total projected impact
                      </Badge>
                      <Badge variant="outline" className="text-muted-foreground text-[10px]">
                        {weeklyPlan.archetype} gym
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2" data-testid="weekly-plan-grid">
                    {weeklyPlan.plan.map((dayPlan) => {
                      const pillConfig = PILL_CONFIG[dayPlan.pill as OperatorPill];
                      const PillIcon = pillConfig?.icon || Zap;
                      return (
                        <Card key={dayPlan.day} className="border-border/30" data-testid={`plan-day-${dayPlan.day.toLowerCase()}`}>
                          <CardContent className="p-3">
                            <div className="flex items-center gap-1.5 mb-2">
                              <PillIcon className={`w-3 h-3 ${pillConfig?.color || "text-muted-foreground"}`} />
                              <span className="text-xs font-medium">{dayPlan.day.slice(0, 3)}</span>
                            </div>
                            <Badge variant="outline" className={`text-[9px] mb-2 ${pillConfig?.color || ""}`}>
                              {pillConfig?.label || dayPlan.pill}
                            </Badge>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">{dayPlan.focus}</p>
                            <p className="text-[9px] text-emerald-400/70 mt-2">
                              ${dayPlan.impact.expected_revenue_impact.toLocaleString()}
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </CollapsibleContent>
          </Collapsible>
        </div>

        {(context?.canViewHistory !== false) && (
          <div className="border-t border-border/30 pt-4">
            <Collapsible open={showHistory} onOpenChange={setShowHistory}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5" data-testid="toggle-history">
                  <History className="w-4 h-4" />
                  {showHistory ? "Hide" : "Show"} Generation History
                  {showHistory ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                {historyLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-14 w-full rounded-lg" />
                    <Skeleton className="h-14 w-full rounded-lg" />
                  </div>
                ) : (
                  <HistoryTable runs={history || []} />
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </div>
    </GymPageShell>
  );
}
