import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import type { Gym } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  useGymData,
  GymPageShell,
  GymNotFound,
  GymDetailSkeleton,
  PageHeader,
} from "./gym-detail";
import {
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search,
  Users,
  TrendingUp,
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface BillingRecord {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string | null;
  monthlyRate: number;
  billingDay: number;
  dueDate: string;
  status: "paid" | "pending" | "overdue";
  amountDue: number;
  amountPaid: number;
  paidAt: string | null;
  notes: string | null;
  billingId: string | null;
}

interface CollectionScheduleDay {
  day: number;
  date: string;
  expectedAmount: number;
  collectedAmount: number;
  memberCount: number;
  members: { name: string; amount: number; status: "paid" | "pending" | "overdue" }[];
}

interface BillingSummary {
  totalExpected: number;
  totalCollected: number;
  totalPending: number;
  totalOverdue: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  collectionRate: number;
  projectedEndOfMonth: number;
}

interface BillingData {
  records: BillingRecord[];
  schedule: CollectionScheduleDay[];
  summary: BillingSummary;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function StatusBadge({ status }: { status: "paid" | "pending" | "overdue" }) {
  if (status === "paid") {
    return (
      <Badge
        className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
        data-testid="badge-status-paid"
      >
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Paid
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge
        className="bg-amber-500/15 text-amber-400 border-amber-500/30"
        data-testid="badge-status-pending"
      >
        <Clock className="w-3 h-3 mr-1" />
        Pending
      </Badge>
    );
  }
  return (
    <Badge
      className="bg-red-500/15 text-red-400 border-red-500/30"
      data-testid="badge-status-overdue"
    >
      <AlertTriangle className="w-3 h-3 mr-1" />
      Overdue
    </Badge>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant,
  testId,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: typeof DollarSign;
  variant: "default" | "success" | "warning" | "danger";
  testId: string;
}) {
  const colors = {
    default: "text-muted-foreground",
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
  };

  const bgColors = {
    default: "bg-muted/50",
    success: "bg-emerald-500/10",
    warning: "bg-amber-500/10",
    danger: "bg-red-500/10",
  };

  return (
    <Card className="border-border/50" data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className={`text-2xl font-semibold tracking-tight ${colors[variant]}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className={`p-2 rounded-lg ${bgColors[variant]}`}>
            <Icon className={`w-4 h-4 ${colors[variant]}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CollectionChart({ schedule, currentDay, isCurrentMonth }: { schedule: CollectionScheduleDay[]; currentDay: number; isCurrentMonth: boolean }) {
  const chartData = schedule.map((d) => ({
    name: `${d.day}`,
    day: d.day,
    expected: d.expectedAmount,
    collected: d.collectedAmount,
    members: d.memberCount,
    memberList: d.members,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-sm">
        <p className="font-medium mb-1">Day {data.day}</p>
        <p className="text-muted-foreground">
          Expected: <span className="text-foreground">{formatCurrency(data.expected)}</span>
        </p>
        <p className="text-muted-foreground">
          Collected: <span className="text-emerald-400">{formatCurrency(data.collected)}</span>
        </p>
        <p className="text-muted-foreground">
          Members: <span className="text-foreground">{data.members}</span>
        </p>
        {data.memberList?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50 space-y-0.5">
            {data.memberList.slice(0, 5).map((m: any, i: number) => (
              <p key={i} className="text-xs text-muted-foreground">
                {m.name} — {formatCurrency(m.amount)}
                {m.status === "paid" && " ✓"}
              </p>
            ))}
            {data.memberList.length > 5 && (
              <p className="text-xs text-muted-foreground/60">+{data.memberList.length - 5} more</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
        <XAxis
          dataKey="name"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          axisLine={{ stroke: "hsl(var(--border))" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}k`}
        />
        <RechartsTooltip content={<CustomTooltip />} />
        <Bar dataKey="expected" radius={[4, 4, 0, 0]} maxBarSize={32}>
          {chartData.map((entry) => {
            const isPast = isCurrentMonth && entry.day < currentDay;
            const isToday = isCurrentMonth && entry.day === currentDay;
            let fill = "hsl(var(--muted-foreground))";
            if (entry.collected >= entry.expected && entry.expected > 0) {
              fill = "hsl(160, 60%, 45%)";
            } else if (isPast || isToday) {
              fill = entry.collected > 0 ? "hsl(40, 80%, 55%)" : "hsl(0, 65%, 55%)";
            } else {
              fill = "hsl(var(--muted-foreground))";
            }
            return <Cell key={`cell-${entry.day}`} fill={fill} opacity={isPast && entry.collected >= entry.expected ? 0.7 : 0.85} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function UpdateStatusDialog({
  record,
  open,
  onOpenChange,
  gymId,
  billingMonth,
}: {
  record: BillingRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gymId: string;
  billingMonth: string;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState<string>("paid");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!record) return;
      await apiRequest("PATCH", `/api/gyms/${gymId}/billing/${record.memberId}`, {
        memberId: record.memberId,
        billingMonth,
        status,
        amountPaid: parseFloat(amount) || record.amountDue,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "billing"] });
      toast({ title: "Payment updated", description: `${record?.memberName}'s billing status updated.` });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update payment status.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Payment Status</DialogTitle>
          <DialogDescription>{record?.memberName} — Due: {formatCurrency(record?.amountDue || 0)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="select-billing-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {status === "paid" && (
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Amount Paid</label>
              <Input
                type="number"
                placeholder={record?.amountDue?.toString()}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-testid="input-amount-paid"
              />
            </div>
          )}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Notes (optional)</label>
            <Textarea
              placeholder="e.g., Partial payment, card declined..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="input-billing-notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-billing">
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="button-save-billing">
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BillingIntelligence() {
  const [, params] = useRoute("/gyms/:id/billing");
  const { data: gym, isLoading: gymLoading } = useGymData(params?.id);

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editRecord, setEditRecord] = useState<BillingRecord | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const billingMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
  const currentDay = now.getDate();

  const { data: billingData, isLoading: billingLoading } = useQuery<BillingData>({
    queryKey: [`/api/gyms/${params?.id}/billing?year=${selectedYear}&month=${selectedMonth}`],
    enabled: !!params?.id,
  });

  const filteredRecords = useMemo(() => {
    if (!billingData?.records) return [];
    let filtered = billingData.records;
    if (statusFilter !== "all") {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) => r.memberName.toLowerCase().includes(q) || r.memberEmail?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [billingData?.records, statusFilter, searchQuery]);

  const goToPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const goToCurrentMonth = () => {
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
  };

  if (gymLoading) return <GymDetailSkeleton />;
  if (!gym) return <GymNotFound />;

  const summary = billingData?.summary;

  const cumulativeData = useMemo(() => {
    if (!billingData?.records) return [];
    const byDay = new Map<number, { expected: number; collected: number }>();
    for (const r of billingData.records) {
      const existing = byDay.get(r.billingDay) || { expected: 0, collected: 0 };
      existing.expected += r.amountDue;
      if (r.status === "paid") existing.collected += r.amountPaid;
      byDay.set(r.billingDay, existing);
    }

    let cumExpected = 0;
    let cumCollected = 0;
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const result: { day: number; cumExpected: number; cumCollected: number }[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dayData = byDay.get(d);
      if (dayData) {
        cumExpected += dayData.expected;
        cumCollected += dayData.collected;
      }
      if (d % 5 === 0 || d === 1 || d === daysInMonth || dayData) {
        result.push({ day: d, cumExpected, cumCollected });
      }
    }
    return result;
  }, [billingData?.records, selectedYear, selectedMonth]);

  return (
    <GymPageShell gym={gym}>
      <PageHeader
        title="Billing Intelligence"
        subtitle="Member payment tracking, collection schedule, and billing status overview."
        howTo="See who has paid, who hasn't, and when payments are expected throughout the month."
        icon={DollarSign}
      />

      <div className="flex items-center justify-between mb-6" data-testid="billing-month-selector">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevMonth} data-testid="button-prev-month">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-lg font-semibold min-w-[180px] text-center">
            {MONTH_NAMES[selectedMonth]} {selectedYear}
          </div>
          <Button variant="outline" size="icon" onClick={goToNextMonth} data-testid="button-next-month">
            <ChevronRight className="w-4 h-4" />
          </Button>
          {!isCurrentMonth && (
            <Button variant="ghost" size="sm" onClick={goToCurrentMonth} data-testid="button-current-month">
              Today
            </Button>
          )}
        </div>
      </div>

      {billingLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-4 space-y-2">
                <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                <div className="h-8 w-24 bg-muted rounded animate-pulse" />
                <div className="h-3 w-32 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <SummaryCard
              title="Total Expected"
              value={formatCurrency(summary.totalExpected)}
              subtitle={`${summary.paidCount + summary.pendingCount + summary.overdueCount} members`}
              icon={DollarSign}
              variant="default"
              testId="card-total-expected"
            />
            <SummaryCard
              title="Collected"
              value={formatCurrency(summary.totalCollected)}
              subtitle={`${summary.paidCount} paid · ${summary.collectionRate}% collected`}
              icon={CheckCircle2}
              variant="success"
              testId="card-total-collected"
            />
            <SummaryCard
              title="Pending"
              value={formatCurrency(summary.totalPending)}
              subtitle={`${summary.pendingCount} members upcoming`}
              icon={Clock}
              variant="warning"
              testId="card-total-pending"
            />
            <SummaryCard
              title="Overdue"
              value={formatCurrency(summary.totalOverdue)}
              subtitle={`${summary.overdueCount} members past due`}
              icon={AlertTriangle}
              variant="danger"
              testId="card-total-overdue"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <Card className="lg:col-span-2 border-border/50" data-testid="card-collection-schedule">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  Collection Schedule
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Expected payments by billing day.
                  <span className="ml-1">
                    Green = collected. Yellow = partial. Red = overdue. Gray = upcoming.
                  </span>
                </p>
              </CardHeader>
              <CardContent>
                {billingData?.schedule && billingData.schedule.length > 0 ? (
                  <CollectionChart
                    schedule={billingData.schedule}
                    currentDay={currentDay}
                    isCurrentMonth={isCurrentMonth}
                  />
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                    No billing data for this month.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50" data-testid="card-collection-progress">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  Collection Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Collected</span>
                    <span>{summary.collectionRate}%</span>
                  </div>
                  <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${summary.collectionRate}%` }}
                      data-testid="progress-collection-rate"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-sm text-muted-foreground">Paid</span>
                    </div>
                    <span className="text-sm font-medium" data-testid="text-paid-count">{summary.paidCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="text-sm text-muted-foreground">Pending</span>
                    </div>
                    <span className="text-sm font-medium" data-testid="text-pending-count">{summary.pendingCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span className="text-sm text-muted-foreground">Overdue</span>
                    </div>
                    <span className="text-sm font-medium" data-testid="text-overdue-count">{summary.overdueCount}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground">Projected End of Month</p>
                  <p className="text-xl font-semibold" data-testid="text-projected-eom">
                    {formatCurrency(summary.projectedEndOfMonth)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Assumes all pending payments collected
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/50" data-testid="card-member-billing-table">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  Member Billing Detail
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search members..."
                      className="pl-8 h-9 w-[200px] text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-billing-search"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 w-[120px]" data-testid="select-status-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead className="text-xs">Member</TableHead>
                      <TableHead className="text-xs">Rate</TableHead>
                      <TableHead className="text-xs">Billing Day</TableHead>
                      <TableHead className="text-xs">Due Date</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Paid</TableHead>
                      <TableHead className="text-xs text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                          {billingData?.records.length === 0
                            ? "No active members with billing for this month."
                            : "No members match your filters."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((record) => (
                        <TableRow
                          key={record.memberId}
                          className="border-border/30 hover:bg-muted/30"
                          data-testid={`row-billing-${record.memberId}`}
                        >
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium" data-testid={`text-member-name-${record.memberId}`}>
                                {record.memberName}
                              </p>
                              {record.memberEmail && (
                                <p className="text-xs text-muted-foreground">{record.memberEmail}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm" data-testid={`text-rate-${record.memberId}`}>
                            {formatCurrency(record.monthlyRate)}/mo
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {record.billingDay}{getOrdinalSuffix(record.billingDay)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(record.dueDate + "T12:00:00Z").toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={record.status} />
                          </TableCell>
                          <TableCell className="text-sm">
                            {record.status === "paid" ? (
                              <span className="text-emerald-400">{formatCurrency(record.amountPaid)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant={record.status === "overdue" ? "destructive" : "outline"}
                              className="text-xs"
                              onClick={() => {
                                setEditRecord(record);
                                setEditDialogOpen(true);
                              }}
                              data-testid={`button-update-billing-${record.memberId}`}
                            >
                              {record.status === "paid" ? "Edit" : "Mark Paid"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <UpdateStatusDialog
            record={editRecord}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            gymId={gym.id}
            billingMonth={billingMonth}
          />
        </>
      ) : null}
    </GymPageShell>
  );
}

function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}
