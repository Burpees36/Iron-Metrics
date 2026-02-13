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
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight" data-testid="text-dashboard-title">
            Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your gym portfolio at a glance
          </p>
        </div>
        <Link href="/gyms/new">
          <Button data-testid="button-add-gym">
            <Plus className="w-4 h-4 mr-1" />
            Add Gym
          </Button>
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

  return (
    <Link href={`/gyms/${gym.id}`}>
      <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-gym-${gym.id}`}>
        <CardContent className="p-5 space-y-4">
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
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
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
                  label="Members"
                  value={String(metrics.activeMembers)}
                />
              </div>
              {metrics.memberRiskCount > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Radar className="w-3 h-3" />
                  <span>{metrics.memberRiskCount} at-risk members</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
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
    <div className="space-y-0.5">
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
      <div className="text-center space-y-6 max-w-md px-4">
        <div className="w-16 h-16 rounded-md bg-primary/10 flex items-center justify-center mx-auto">
          <Activity className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold" data-testid="text-empty-title">
            Welcome to Iron Metrics
          </h2>
          <p className="text-muted-foreground text-sm">
            Add your first gym to start tracking retention, revenue, and member health.
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
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-52 rounded-md" />
        ))}
      </div>
    </div>
  );
}
