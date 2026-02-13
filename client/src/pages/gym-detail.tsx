import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import type { Gym, Member, GymMonthlyMetrics } from "@shared/schema";
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
  Heart,
  UserPlus,
  UserMinus,
  Calculator,
  Clock,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
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

export default function GymDetail() {
  const [, params] = useRoute("/gyms/:id");
  const gymId = params?.id;

  const { data: gym, isLoading: gymLoading } = useQuery<Gym>({
    queryKey: ["/api/gyms", gymId],
  });

  if (gymLoading) return <GymDetailSkeleton />;
  if (!gym) return <GymNotFound />;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-gym-name">
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

      <Tabs defaultValue="heartbeat">
        <TabsList data-testid="tabs-gym-detail">
          <TabsTrigger value="heartbeat" data-testid="tab-heartbeat">Heartbeat</TabsTrigger>
          <TabsTrigger value="members" data-testid="tab-members">Members</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="heartbeat" className="mt-6">
          <HeartbeatView gymId={gym.id} />
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <MembersView gymId={gym.id} />
        </TabsContent>

        <TabsContent value="trends" className="mt-6">
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

function HeartbeatView({ gymId }: { gymId: string }) {
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

  const { data: metrics, isLoading } = useQuery<GymMonthlyMetrics | null>({
    queryKey: ["/api/gyms", gymId, "heartbeat", monthDate],
    queryFn: async () => {
      const res = await fetch(`/api/gyms/${gymId}/heartbeat?month=${monthDate}`, {
        credentials: "include",
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-md" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
          <h2 className="font-serif text-xl font-semibold min-w-[160px] text-center" data-testid="text-current-month">
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
        {metrics?.generatedAt && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Computed {new Date(metrics.generatedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {!metrics ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Activity className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">
              No metrics available for {displayMonth}. Import members and recompute to generate.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={Users}
            label="Active Members"
            value={String(metrics.activeMembers)}
            sublabel={`Started month: ${metrics.activeStartOfMonth}`}
            testId="metric-active-members"
          />
          <MetricCard
            icon={UserPlus}
            label="New Members"
            value={String(metrics.newMembers)}
            sublabel="Joined this month"
            positive
            testId="metric-new-members"
          />
          <MetricCard
            icon={UserMinus}
            label="Cancellations"
            value={String(metrics.cancels)}
            sublabel="Left this month"
            negative={metrics.cancels > 0}
            testId="metric-cancels"
          />
          <MetricCard
            icon={TrendingDown}
            label="Churn Rate"
            value={`${metrics.churnRate}%`}
            sublabel={metrics.rollingChurn3m ? `3mo avg: ${metrics.rollingChurn3m}%` : undefined}
            negative={Number(metrics.churnRate) > 5}
            testId="metric-churn-rate"
          />
          <MetricCard
            icon={DollarSign}
            label="MRR"
            value={`$${Number(metrics.mrr).toLocaleString()}`}
            sublabel="Monthly Recurring Revenue"
            testId="metric-mrr"
          />
          <MetricCard
            icon={Calculator}
            label="ARM"
            value={`$${Number(metrics.arm).toFixed(2)}`}
            sublabel="Avg. Revenue / Member"
            testId="metric-arm"
          />
          <MetricCard
            icon={Heart}
            label="LTV"
            value={`$${Number(metrics.ltv).toLocaleString()}`}
            sublabel="Lifetime Value"
            testId="metric-ltv"
          />
          <MetricCard
            icon={TrendingUp}
            label="Rolling 3mo Churn"
            value={metrics.rollingChurn3m ? `${metrics.rollingChurn3m}%` : "N/A"}
            sublabel="3-month average"
            testId="metric-rolling-churn"
          />
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sublabel,
  positive,
  negative,
  testId,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sublabel?: string;
  positive?: boolean;
  negative?: boolean;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
        <p
          className={`text-2xl font-bold font-mono tracking-tight ${
            positive ? "text-emerald-600 dark:text-emerald-400" : negative ? "text-red-600 dark:text-red-400" : ""
          }`}
        >
          {value}
        </p>
        {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
      </CardContent>
    </Card>
  );
}

function MembersView({ gymId }: { gymId: string }) {
  const [search, setSearch] = useState("");
  const { data: members, isLoading } = useQuery<Member[]>({
    queryKey: ["/api/gyms", gymId, "members"],
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <Users className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">
            No members yet. Import a CSV to get started.
          </p>
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

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = members.filter((m) => m.status === "active").length;
  const cancelledCount = members.filter((m) => m.status === "cancelled").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" data-testid="badge-active-count">
            {activeCount} active
          </Badge>
          <Badge variant="outline" data-testid="badge-cancelled-count">
            {cancelledCount} cancelled
          </Badge>
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

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Monthly Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((member) => (
                <TableRow key={member.id} data-testid={`row-member-${member.id}`}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{member.email || "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={member.status === "active" ? "default" : "outline"}
                      className="text-xs"
                    >
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(member.joinDate + "T00:00:00").toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    ${Number(member.monthlyRate).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
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
        <CardContent className="p-8 text-center space-y-3">
          <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">
            Not enough data for trends. Import members and recompute metrics.
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
    }));

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="font-semibold text-sm">Monthly Recurring Revenue</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, "MRR"]}
                  />
                  <Area type="monotone" dataKey="mrr" stroke="hsl(var(--chart-1))" fill="url(#mrrGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="font-semibold text-sm">Active Members</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="members" stroke="hsl(var(--chart-3))" fill="url(#memGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-semibold text-sm">Churn Rate (%)</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `${v}%`} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                    formatter={(value: number) => [`${value}%`, "Churn"]}
                  />
                  <Line type="monotone" dataKey="churn" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GymDetailSkeleton() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-10 w-64" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-md" />)}
      </div>
    </div>
  );
}

function GymNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <Building2 className="w-12 h-12 text-muted-foreground mx-auto" />
        <h2 className="font-serif text-xl font-bold">Gym not found</h2>
        <Link href="/">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
