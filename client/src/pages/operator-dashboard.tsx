import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useGymData, GymPageShell, GymNotFound, GymDetailSkeleton, PageHeader } from "./gym-detail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Target,
  CheckCircle2,
  Clock,
  Loader2,
  TrendingUp,
  Shield,
  DollarSign,
  Heart,
  UserCheck,
  User,
  ArrowLeft,
  Zap,
} from "lucide-react";
import type { OperatorTask, OperatorPill } from "@shared/schema";

const PILL_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  retention: { label: "Retention", icon: Shield, color: "text-emerald-400" },
  sales: { label: "Sales", icon: DollarSign, color: "text-blue-400" },
  coaching: { label: "Coaching", icon: UserCheck, color: "text-amber-400" },
  community: { label: "Community", icon: Heart, color: "text-rose-400" },
  owner: { label: "Owner Protection", icon: User, color: "text-violet-400" },
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted/30 text-muted-foreground",
  in_progress: "bg-blue-500/10 text-blue-400",
  complete: "bg-emerald-500/10 text-emerald-400",
};

interface DashboardStats {
  totalProjectedImpact: number;
  completionRate: number;
  totalTasks: number;
  tasksByPill: Record<string, { pending: number; in_progress: number; complete: number }>;
}

interface CompletionForm {
  executionResult: string;
  observedImpact: string;
  completionNotes: string;
}

export default function OperatorDashboard() {
  const [, params] = useRoute("/gyms/:id/operator/active");
  const gymId = params?.id;
  const { isDemo } = useAuth();
  const { toast } = useToast();
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completionForm, setCompletionForm] = useState<CompletionForm>({
    executionResult: "",
    observedImpact: "",
    completionNotes: "",
  });

  const { data: gym, isLoading: gymLoading } = useGymData(gymId);

  const { data: tasks, isLoading: tasksLoading } = useQuery<OperatorTask[]>({
    queryKey: ["/api/gyms", gymId, "operator", "tasks"],
    enabled: !!gymId,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/gyms", gymId, "operator", "dashboard"],
    enabled: !!gymId,
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/gyms/${gymId}/operator/tasks/${taskId}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "operator", "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "operator", "dashboard"] });
    },
    onError: () => {
      toast({ title: "Failed to update task", variant: "destructive" });
    },
  });

  const handleStatusChange = (taskId: string, newStatus: string) => {
    if (newStatus === "complete") {
      setCompletingTaskId(taskId);
      setCompletionForm({ executionResult: "", observedImpact: "", completionNotes: "" });
    } else {
      updateTaskMutation.mutate({ taskId, updates: { status: newStatus } });
    }
  };

  const handleCompleteSubmit = () => {
    if (!completingTaskId || !completionForm.executionResult || !completionForm.observedImpact) return;
    updateTaskMutation.mutate({
      taskId: completingTaskId,
      updates: {
        status: "complete",
        executionResult: completionForm.executionResult,
        observedImpact: completionForm.observedImpact,
        completionNotes: completionForm.completionNotes || null,
        createOutcome: true,
      },
    });
    setCompletingTaskId(null);
    toast({ title: "Task completed", description: "Outcome recorded." });
  };

  if (gymLoading) return <GymDetailSkeleton />;
  if (!gym) return <GymNotFound />;

  const pendingTasks = (tasks || []).filter(t => t.status === "pending");
  const inProgressTasks = (tasks || []).filter(t => t.status === "in_progress");
  const completeTasks = (tasks || []).filter(t => t.status === "complete");

  return (
    <GymPageShell gym={gym}>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href={`/gyms/${gymId}/operator`}>
            <Button variant="ghost" size="sm" className="gap-1.5" data-testid="link-back-operator">
              <ArrowLeft className="w-3.5 h-3.5" /> AI Operator
            </Button>
          </Link>
        </div>

        <PageHeader
          title="Active Tasks"
          subtitle="Track interventions from strategy to execution."
          howTo="Tasks are created from AI Operator outputs. Update status and record outcomes when complete."
          icon={Target}
        />

        {statsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="dashboard-stats">
            <Card className="border-border/50">
              <CardContent className="pt-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Projected Impact In-Flight</span>
                </div>
                <p className="text-2xl font-bold text-emerald-400" data-testid="stat-projected-impact">
                  ${stats.totalProjectedImpact.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Completion Rate</span>
                </div>
                <p className="text-2xl font-bold" data-testid="stat-completion-rate">
                  {stats.completionRate}%
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-amber-400" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Tasks</span>
                </div>
                <p className="text-2xl font-bold" data-testid="stat-total-tasks">
                  {stats.totalTasks}
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {stats && Object.keys(stats.tasksByPill).length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" data-testid="pill-breakdown">
            {Object.entries(stats.tasksByPill).map(([pill, counts]) => {
              const config = PILL_CONFIG[pill];
              const PillIcon = config?.icon || Zap;
              return (
                <div key={pill} className="bg-muted/15 border border-border/30 rounded-lg p-3 text-center">
                  <PillIcon className={`w-4 h-4 mx-auto mb-1 ${config?.color || "text-muted-foreground"}`} />
                  <p className="text-xs font-medium">{config?.label || pill}</p>
                  <div className="flex items-center justify-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <span>{counts.pending} pending</span>
                    <span>{counts.in_progress} active</span>
                    <span>{counts.complete} done</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tasksLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        ) : (tasks || []).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground" data-testid="empty-tasks">
            <Target className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No active tasks yet.</p>
            <p className="text-xs mt-1">Generate a plan in the AI Operator and convert it to tasks.</p>
            <Link href={`/gyms/${gymId}/operator`}>
              <Button variant="outline" size="sm" className="mt-3 gap-1.5" data-testid="link-generate">
                <Zap className="w-3.5 h-3.5" /> Go to AI Operator
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {inProgressTasks.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">In Progress ({inProgressTasks.length})</h3>
                <div className="space-y-2">
                  {inProgressTasks.map(task => (
                    <TaskRow key={task.id} task={task} gymId={gymId!} isDemo={isDemo} onStatusChange={handleStatusChange} />
                  ))}
                </div>
              </div>
            )}
            {pendingTasks.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Pending ({pendingTasks.length})</h3>
                <div className="space-y-2">
                  {pendingTasks.map(task => (
                    <TaskRow key={task.id} task={task} gymId={gymId!} isDemo={isDemo} onStatusChange={handleStatusChange} />
                  ))}
                </div>
              </div>
            )}
            {completeTasks.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Complete ({completeTasks.length})</h3>
                <div className="space-y-2">
                  {completeTasks.map(task => (
                    <TaskRow key={task.id} task={task} gymId={gymId!} isDemo={isDemo} onStatusChange={handleStatusChange} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <Dialog open={completingTaskId !== null} onOpenChange={(open) => { if (!open) setCompletingTaskId(null); }}>
          <DialogContent data-testid="completion-dialog">
            <DialogHeader>
              <DialogTitle>Complete Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Was the intervention executed?</label>
                <Select value={completionForm.executionResult} onValueChange={(v) => setCompletionForm(f => ({ ...f, executionResult: v }))}>
                  <SelectTrigger data-testid="select-execution-result"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes — fully executed</SelectItem>
                    <SelectItem value="partial">Partial — some steps completed</SelectItem>
                    <SelectItem value="no">No — not executed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Observed Impact</label>
                <Select value={completionForm.observedImpact} onValueChange={(v) => setCompletionForm(f => ({ ...f, observedImpact: v }))}>
                  <SelectTrigger data-testid="select-observed-impact"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="improved">Improved</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="worse">Worse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Notes (optional)</label>
                <textarea
                  className="w-full min-h-[80px] text-sm bg-background border border-border rounded-md p-2 resize-y focus:outline-none focus:ring-1 focus:ring-primary"
                  value={completionForm.completionNotes}
                  onChange={(e) => setCompletionForm(f => ({ ...f, completionNotes: e.target.value }))}
                  placeholder="Any additional context about the outcome..."
                  data-testid="input-completion-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCompletingTaskId(null)} data-testid="button-cancel-completion">Cancel</Button>
              <Button
                onClick={handleCompleteSubmit}
                disabled={!completionForm.executionResult || !completionForm.observedImpact}
                data-testid="button-confirm-completion"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Complete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </GymPageShell>
  );
}

function TaskRow({ task, gymId, isDemo, onStatusChange }: {
  task: OperatorTask;
  gymId: string;
  isDemo: boolean;
  onStatusChange: (taskId: string, status: string) => void;
}) {
  const config = PILL_CONFIG[task.pill];
  const PillIcon = config?.icon || Zap;
  const impactValue = task.impactValueEstimate ? Number(task.impactValueEstimate) : null;

  return (
    <Card className="border-border/30" data-testid={`task-row-${task.id}`}>
      <CardContent className="py-3 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <PillIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config?.color || "text-muted-foreground"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug" data-testid={`task-title-${task.id}`}>{task.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className={`text-[10px] ${config?.color || ""}`}>
                  {config?.label || task.pill}
                </Badge>
                {impactValue && impactValue > 0 && (
                  <span className="text-[10px] text-emerald-400">${impactValue.toLocaleString()} est.</span>
                )}
                {task.dueDate && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                )}
                {task.executionResult && (
                  <Badge variant="outline" className="text-[10px]">
                    {task.executionResult === "yes" ? "Executed" : task.executionResult === "partial" ? "Partial" : "Not Executed"}
                  </Badge>
                )}
                {task.observedImpact && (
                  <Badge variant="outline" className={`text-[10px] ${task.observedImpact === "improved" ? "text-emerald-400" : task.observedImpact === "worse" ? "text-red-400" : "text-muted-foreground"}`}>
                    {task.observedImpact}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex-shrink-0">
            {task.status === "complete" ? (
              <Badge className={STATUS_STYLES.complete} data-testid={`task-status-${task.id}`}>Complete</Badge>
            ) : (
              <Select
                value={task.status}
                onValueChange={(v) => onStatusChange(task.id, v)}
                disabled={isDemo}
              >
                <SelectTrigger className="h-7 text-xs w-28" data-testid={`task-status-select-${task.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
