import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Gym, GymMonthlyMetrics } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Building2,
  ArrowRight,
  Activity,
  Gauge,
  TrendingDown,
  DollarSign,
  Users,
  Radar,
  TrendingUp,
} from "lucide-react";

export default function Dashboard() {
  const { data: gyms, isLoading } = useQuery<Gym[]>({
    queryKey: ["/api/gyms"],
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!gyms || gyms.length === 0) {
    return <EmptyDashboard />;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight" data-testid="text-dashboard-title">
            Command Center
          </h1>
          <p className="text-muted-foreground text-sm">
            Financial stability overview across your gyms.
          </p>
        </div>
        <Link href="/gyms/new">
          <Button data-testid="button-add-gym">
            <Plus className="w-4 h-4 mr-1" />
            Add Gym
          </Button>
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {gyms.map((gym) => (
          <GymCard key={gym.id} gym={gym} />
        ))}
      </div>
    </div>
  );
}

function GymCard({ gym }: { gym: Gym }) {
  const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
  const { data: metrics } = useQuery<GymMonthlyMetrics>({
    queryKey: ["/api/gyms", gym.id, "heartbeat", currentMonth],
    queryFn: async () => {
      const res = await fetch(`/api/gyms/${gym.id}/heartbeat?month=${currentMonth}`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const netGrowth = metrics ? metrics.newMembers - metrics.cancels : null;

  return (
    <Link href={`/gyms/${gym.id}`}>
      <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-gym-${gym.id}`}>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <h3 className="font-semibold text-base truncate" data-testid={`text-gym-name-${gym.id}`}>
                {gym.name}
              </h3>
              {gym.location && (
                <p className="text-xs text-muted-foreground truncate">{gym.location}</p>
              )}
            </div>
            <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
          </div>

          {metrics ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <MiniMetric
                  icon={Gauge}
                  label="RSI"
                  value={`${metrics.rsi}/100`}
                  status={metrics.rsi >= 80 ? "good" : metrics.rsi >= 60 ? "moderate" : "risk"}
                />
                <MiniMetric
                  icon={TrendingDown}
                  label="Churn"
                  value={`${metrics.churnRate}%`}
                  status={Number(metrics.churnRate) <= 5 ? "good" : Number(metrics.churnRate) <= 7 ? "moderate" : "risk"}
                />
                <MiniMetric
                  icon={DollarSign}
                  label="MRR"
                  value={`$${Number(metrics.mrr).toLocaleString()}`}
                />
                <MiniMetric
                  icon={Users}
                  label="Active"
                  value={String(metrics.activeMembers)}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground pt-1 border-t">
                {netGrowth !== null && (
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Net: {netGrowth >= 0 ? "+" : ""}{netGrowth}
                  </span>
                )}
                {metrics.memberRiskCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Radar className="w-3 h-3" />
                    {metrics.memberRiskCount} at risk
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
              <Activity className="w-3.5 h-3.5" />
              <span>Import members to see metrics</span>
            </div>
          )}

          <div className="flex items-center justify-end text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              View details <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value,
  status,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  status?: "good" | "moderate" | "risk";
}) {
  const statusColor = status === "good"
    ? "text-emerald-600 dark:text-emerald-400"
    : status === "risk"
      ? "text-red-600 dark:text-red-400"
      : "";

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-muted-foreground">
        <Icon className="w-3 h-3" />
        <span className="text-xs">{label}</span>
      </div>
      <p className={`font-mono text-sm font-semibold ${statusColor}`}>{value}</p>
    </div>
  );
}

function EmptyDashboard() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-8 max-w-md px-4">
        <div className="w-16 h-16 rounded-md bg-primary/10 flex items-center justify-center mx-auto">
          <Activity className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-3">
          <h2 className="text-xl font-bold" data-testid="text-empty-title">
            Your Command Center
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Add your first gym to start tracking retention stability, revenue health, and member risk.
            Financial clarity starts here.
          </p>
        </div>
        <Link href="/gyms/new">
          <Button size="lg" data-testid="button-add-first-gym">
            <Plus className="w-4 h-4 mr-1" />
            Add Your First Gym
          </Button>
        </Link>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-56 rounded-md" />
        ))}
      </div>
    </div>
  );
}
