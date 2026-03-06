import { useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Save,
  Upload,
  Plug,
  RefreshCw,
  ChevronRight,
  Download,
  CreditCard,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Sparkles,
  ArrowUpRight,
  UserPlus,
  Mail,
  Trash2,
} from "lucide-react";
import { Link } from "wouter";
import { useGymData, GymPageShell, GymNotFound, GymDetailSkeleton, PageHeader } from "./gym-detail";
import { useAuth } from "@/hooks/use-auth";

interface SubscriptionStatus {
  hasSubscription: boolean;
  status: "none" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "expired";
  plan: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd?: boolean;
  isActive: boolean;
  stripeConfigured: boolean;
}

interface PlansData {
  plans: {
    starter: { name: string; price: number; priceDisplay: string; features: string[] };
    pro: { name: string; price: number; priceDisplay: string; features: string[] };
  };
  stripeConfigured: boolean;
}

const formSchema = z.object({
  name: z.string().min(1, "Gym name is required").max(100),
  location: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof formSchema>;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function StatusBadge({ status, cancelAtPeriodEnd }: { status: string; cancelAtPeriodEnd?: boolean }) {
  if (cancelAtPeriodEnd && status === "active") {
    return (
      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30" data-testid="badge-subscription-canceling">
        <Clock className="w-3 h-3 mr-1" />
        Canceling
      </Badge>
    );
  }

  switch (status) {
    case "active":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30" data-testid="badge-subscription-active">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    case "trialing":
      return (
        <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30" data-testid="badge-subscription-trial">
          <Sparkles className="w-3 h-3 mr-1" />
          Free Trial
        </Badge>
      );
    case "past_due":
    case "unpaid":
      return (
        <Badge className="bg-red-500/15 text-red-400 border-red-500/30" data-testid="badge-subscription-past-due">
          <AlertTriangle className="w-3 h-3 mr-1" />
          {status === "unpaid" ? "Unpaid" : "Past Due"}
        </Badge>
      );
    case "canceled":
    case "expired":
      return (
        <Badge className="bg-muted text-muted-foreground border-border" data-testid="badge-subscription-canceled">
          <XCircle className="w-3 h-3 mr-1" />
          {status === "expired" ? "Trial Expired" : "Canceled"}
        </Badge>
      );
    default:
      return (
        <Badge className="bg-muted text-muted-foreground border-border" data-testid="badge-subscription-none">
          No Plan
        </Badge>
      );
  }
}

function SubscriptionSection({ gymId, isDemoUser }: { gymId: string; isDemoUser: boolean }) {
  const { toast } = useToast();

  const { data: subscription, isLoading: subLoading } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/gyms", gymId, "subscription"],
    queryFn: async () => {
      const res = await fetch(`/api/gyms/${gymId}/subscription`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load subscription");
      return res.json();
    },
  });

  const { data: plansData, isLoading: plansLoading } = useQuery<PlansData>({
    queryKey: ["/api/plans"],
  });

  const checkoutMutation = useMutation({
    mutationFn: async (plan: "starter" | "pro") => {
      const res = await apiRequest("POST", `/api/gyms/${gymId}/subscription/checkout`, {
        plan,
        returnUrl: window.location.href,
      });
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/gyms/${gymId}/subscription/portal`, {
        returnUrl: window.location.href,
      });
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (subLoading) {
    return (
      <div className="space-y-3 pt-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subscription & Billing</p>
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-9 w-32" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const sub = subscription;
  const plans = plansData?.plans;
  const dataLoaded = !subLoading && !plansLoading;
  const stripeReady = dataLoaded && sub?.stripeConfigured && plansData?.stripeConfigured;
  const currentPlan = sub?.plan as "starter" | "pro" | null;
  const trialDaysLeft = daysUntil(sub?.trialEndsAt ?? null);
  const periodEnd = sub?.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : null;
  const hasActiveSubscription = sub?.isActive && sub?.status !== "trialing";
  const hasBillingHistory = !!sub?.hasSubscription && !!sub?.plan;
  const starterLabel = plans?.starter ? `${plans.starter.name} ${plans.starter.priceDisplay}` : "Starter $149/mo";
  const proLabel = plans?.pro ? `${plans.pro.name} ${plans.pro.priceDisplay}` : "Pro $249/mo";

  return (
    <div className="space-y-3 pt-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subscription & Billing</p>

      <Card data-testid="card-subscription">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <CreditCard className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium" data-testid="text-current-plan">
                    {currentPlan ? `${plans?.[currentPlan]?.name ?? currentPlan} Plan` : "No Plan"}
                  </p>
                  <StatusBadge status={sub?.status ?? "none"} cancelAtPeriodEnd={sub?.cancelAtPeriodEnd} />
                </div>
                {sub?.status === "trialing" && trialDaysLeft !== null && (
                  <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-trial-info">
                    {trialDaysLeft > 0
                      ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} remaining in your free trial`
                      : "Your free trial has ended"}
                  </p>
                )}
                {sub?.status === "active" && periodEnd && (
                  <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-period-end">
                    {sub.cancelAtPeriodEnd
                      ? `Access until ${periodEnd}`
                      : `Next billing date: ${periodEnd}`}
                  </p>
                )}
                {(sub?.status === "past_due" || sub?.status === "unpaid") && (
                  <p className="text-xs text-red-400 mt-0.5" data-testid="text-past-due-warning">
                    Payment failed. Update your payment method to avoid service interruption.
                  </p>
                )}
                {(sub?.status === "canceled" || sub?.status === "expired") && (
                  <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-canceled-info">
                    Subscribe to regain full access to Iron Metrics.
                  </p>
                )}
              </div>
            </div>
          </div>

          {(sub?.status === "past_due" || sub?.status === "unpaid") && stripeReady && !isDemoUser && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400 font-medium">Payment Required</p>
              <p className="text-xs text-red-400/80 mt-1">
                Your last payment didn't go through. Please update your payment method to keep your account active.
              </p>
              <Button
                size="sm"
                variant="destructive"
                className="mt-2"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                data-testid="button-update-payment-urgent"
              >
                <CreditCard className="w-3.5 h-3.5 mr-1" />
                {portalMutation.isPending ? "Loading..." : "Update Payment Method"}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {hasActiveSubscription && stripeReady && !isDemoUser && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                data-testid="button-manage-billing"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                {portalMutation.isPending ? "Loading..." : "Manage Billing"}
              </Button>
            )}

            {sub?.status === "trialing" && stripeReady && !isDemoUser && (
              <>
                <Button
                  size="sm"
                  onClick={() => checkoutMutation.mutate("starter")}
                  disabled={checkoutMutation.isPending}
                  data-testid="button-subscribe-starter"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                  {checkoutMutation.isPending ? "Loading..." : `Subscribe — ${starterLabel}`}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => checkoutMutation.mutate("pro")}
                  disabled={checkoutMutation.isPending}
                  data-testid="button-subscribe-pro"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                  {checkoutMutation.isPending ? "Loading..." : `Subscribe — ${proLabel}`}
                </Button>
              </>
            )}

            {(sub?.status === "canceled" || sub?.status === "expired" || sub?.status === "none") && stripeReady && !isDemoUser && (
              <>
                <Button
                  size="sm"
                  onClick={() => checkoutMutation.mutate("starter")}
                  disabled={checkoutMutation.isPending}
                  data-testid="button-resubscribe-starter"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                  {checkoutMutation.isPending ? "Loading..." : `Start ${starterLabel}`}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => checkoutMutation.mutate("pro")}
                  disabled={checkoutMutation.isPending}
                  data-testid="button-resubscribe-pro"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                  {checkoutMutation.isPending ? "Loading..." : `Start ${proLabel}`}
                </Button>
              </>
            )}

            {currentPlan === "starter" && sub?.isActive && stripeReady && !isDemoUser && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => checkoutMutation.mutate("pro")}
                disabled={checkoutMutation.isPending}
                data-testid="button-upgrade-pro"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                {checkoutMutation.isPending ? "Loading..." : `Upgrade to ${proLabel}`}
              </Button>
            )}
          </div>

          {hasBillingHistory && stripeReady && !isDemoUser && (
            <div className="pt-3 border-t border-border/50">
              <button
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                data-testid="link-billing-portal"
              >
                <ExternalLink className="w-3 h-3" />
                View invoices, update payment method, or cancel
              </button>
            </div>
          )}

          {!stripeReady && dataLoaded && !isDemoUser && (
            <p className="text-xs text-muted-foreground">
              Payment processing is being configured. Subscription management will be available soon.
            </p>
          )}

          {plansLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Loading plan details...
            </div>
          )}

          {isDemoUser && (
            <p className="text-xs text-muted-foreground italic">
              Subscription management is disabled in demo mode.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function GymSettings() {
  const [, params] = useRoute("/gyms/:id/settings");
  const gymId = params?.id;

  const { data: gym, isLoading: gymLoading } = useGymData(gymId);
  const { user } = useAuth();
  const { toast } = useToast();
  const isDemoUser = !user;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      location: "",
    },
  });

  useEffect(() => {
    if (gym) {
      form.reset({
        name: gym.name,
        location: gym.location ?? "",
      });
    }
  }, [gym]);

  const recomputeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/gyms/${gymId}/recompute`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId] });
      toast({ title: "Metrics recomputed", description: "All monthly metrics have been refreshed." });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await apiRequest("PUT", `/api/gyms/${gymId}`, values);
      return res.json();
    },
    onSuccess: (updatedGym) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gyms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId] });
      toast({ title: "Settings saved", description: `${updatedGym.name} has been updated.` });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: FormValues) => mutation.mutate(values);

  if (gymLoading) return <GymDetailSkeleton />;
  if (!gym) return <GymNotFound />;

  return (
    <GymPageShell gym={gym}>
      <div className="max-w-lg space-y-8 animate-fade-in-up">
        <PageHeader
          title="Settings"
          subtitle="Manage your gym details, subscription, and data integrations."
          howTo="Edit your gym info, manage your subscription, or use the data tools below."
          icon={Settings}
        />

        <Card>
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-wide">Gym Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. CrossFit Iron Valley" {...field} data-testid="input-gym-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-wide">Location (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Austin, TX" {...field} data-testid="input-gym-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  data-testid="button-save-settings"
                >
                  <Save className="w-4 h-4 mr-1" />
                  {mutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {gym.createdAt && (
          <p className="text-xs text-muted-foreground" data-testid="text-gym-created">
            Created {new Date(gym.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        )}

        <SubscriptionSection gymId={gymId!} isDemoUser={isDemoUser} />

        <StaffInvitesSection gymId={gymId!} isOwner={!isDemoUser && gym.ownerId === user?.id} />

        <div className="space-y-3 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data & Integrations</p>
          <div className="space-y-2">
            <Link href={`/gyms/${gymId}/import`}>
              <Card className="hover-elevate transition-all duration-300 cursor-pointer group" data-testid="link-csv-import">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      <Upload className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Import Members (CSV)</p>
                      <p className="text-xs text-muted-foreground">Upload a roster from Wodify, PushPress, Zen Planner, or any spreadsheet.</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </Link>
            <Link href={`/gyms/${gymId}/wodify`}>
              <Card className="hover-elevate transition-all duration-300 cursor-pointer group" data-testid="link-wodify-integration">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      <Plug className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Wodify Integration</p>
                      <p className="text-xs text-muted-foreground">Connect directly to Wodify for automatic data sync — attendance, memberships, and more.</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </Link>
            <Card
              className="hover-elevate transition-all duration-300 cursor-pointer group"
              data-testid="button-recompute"
              onClick={() => recomputeMutation.mutate()}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <RefreshCw className={`w-4 h-4 text-primary ${recomputeMutation.isPending ? "animate-spin" : ""}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{recomputeMutation.isPending ? "Computing..." : "Recompute Metrics"}</p>
                    <p className="text-xs text-muted-foreground">Refresh all stability metrics, retention scores, and strategic recommendations.</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Export Your Data</p>
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Download className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Export My Data</p>
                  <p className="text-xs text-muted-foreground">Download all your gym data as CSV files.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <ExportButton gymId={gymId!} type="members" label="Members" />
                <ExportButton gymId={gymId!} type="leads" label="Leads" />
                <ExportButton gymId={gymId!} type="metrics" label="Metrics" />
                <ExportButton gymId={gymId!} type="billing" label="Billing" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </GymPageShell>
  );
}

interface StaffInvite {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

function StaffInvitesSection({ gymId, isOwner }: { gymId: string; isOwner: boolean }) {
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("coach");

  const { data: invites = [], isLoading } = useQuery<StaffInvite[]>({
    queryKey: ["/api/gyms", gymId, "staff", "invites"],
    enabled: isOwner,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/gyms/${gymId}/staff/invite`, {
        email: inviteEmail,
        role: inviteRole,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "staff", "invites"] });
      toast({ title: "Invite sent", description: `Invitation sent to ${inviteEmail}.` });
      setInviteEmail("");
      setInviteRole("coach");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send invite", description: error.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      await apiRequest("DELETE", `/api/gyms/${gymId}/staff/invites/${inviteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "staff", "invites"] });
      toast({ title: "Invite cancelled" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to cancel invite", description: error.message, variant: "destructive" });
    },
  });

  if (!isOwner) return null;

  const pendingInvites = invites.filter((inv) => inv.status === "pending");

  return (
    <div className="space-y-3 pt-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Staff Invitations</p>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <UserPlus className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Invite Staff</p>
              <p className="text-xs text-muted-foreground">Add coaches or admins to your gym by email.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1"
              data-testid="input-invite-email"
            />
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="w-full sm:w-[120px]" data-testid="select-invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="coach">Coach</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteEmail || inviteMutation.isPending}
              data-testid="button-send-invite"
            >
              <Mail className="w-4 h-4 mr-1" />
              {inviteMutation.isPending ? "Sending..." : "Invite"}
            </Button>
          </div>

          {isLoading && <Skeleton className="h-10 w-full" />}

          {pendingInvites.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground pt-2">Pending Invitations</p>
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50"
                  data-testid={`invite-row-${invite.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm truncate" data-testid={`text-invite-email-${invite.id}`}>{invite.email}</p>
                      <p className="text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] mr-1">{invite.role}</Badge>
                        Expires {new Date(invite.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cancelMutation.mutate(invite.id)}
                    disabled={cancelMutation.isPending}
                    data-testid={`button-cancel-invite-${invite.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ExportButton({ gymId, type, label }: { gymId: string; type: string; label: string }) {
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setDownloading(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const response = await fetch(`/api/gyms/${gymId}/export/${type}`, { credentials: "include", headers });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: "Export failed" }));
        throw new Error(err.message);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-${gymId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Export complete", description: `${label} data downloaded successfully.` });
    } catch (error: any) {
      toast({ title: "Export failed", description: error.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={downloading}
      data-testid={`button-export-${type}`}
    >
      <Download className="w-3.5 h-3.5 mr-1" />
      {downloading ? "Downloading..." : label}
    </Button>
  );
}
