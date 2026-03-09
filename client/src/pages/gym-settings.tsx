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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Users,
  Shield,
  ShieldCheck,
  Eye,
  MoreHorizontal,
  Crown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

interface StaffMember {
  id: string;
  gymId: string;
  userId: string;
  role: string;
  createdAt: string;
  userName: string;
  userEmail: string;
  isGymOwner: boolean;
}

interface StaffInvite {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

const ROLE_INFO: Record<string, { label: string; description: string; icon: typeof Shield }> = {
  owner: { label: "Owner", description: "Full access including billing, settings, staff management, and sensitive exports", icon: Crown },
  admin: { label: "Admin", description: "Operational management without subscription, staff, or ownership controls", icon: ShieldCheck },
  coach: { label: "Coach", description: "Read-only access with limited member interaction and aggregate exports", icon: Eye },
};

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

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1 pb-1">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const info = ROLE_INFO[role];
  if (!info) return <Badge variant="outline">{role}</Badge>;
  const colorMap: Record<string, string> = {
    owner: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    admin: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    coach: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  };
  return (
    <Badge className={`text-[10px] ${colorMap[role] || ""}`} data-testid={`badge-role-${role}`}>
      {info.label}
    </Badge>
  );
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
          <CheckCircle2 className="w-3 h-3 mr-1" />Active
        </Badge>
      );
    case "trialing":
      return (
        <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30" data-testid="badge-subscription-trial">
          <Sparkles className="w-3 h-3 mr-1" />Free Trial
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

export default function GymSettings() {
  const [, params] = useRoute("/gyms/:id/settings");
  const gymId = params?.id;

  const { data: gym, isLoading: gymLoading } = useGymData(gymId);
  const { user, isDemo } = useAuth();
  const { toast } = useToast();
  const isDemoUser = isDemo;

  const { data: staffList = [], isLoading: staffLoading } = useQuery<StaffMember[]>({
    queryKey: ["/api/gyms", gymId, "staff"],
    enabled: !!gymId,
  });

  const currentUserRole = staffList.find(s => s.userId === user?.id)?.role
    || (gym?.ownerId === user?.id ? "owner" : null);
  const isOwner = currentUserRole === "owner";

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", location: "" },
  });

  useEffect(() => {
    if (gym) {
      form.reset({ name: gym.name, location: gym.location ?? "" });
    }
  }, [gym]);

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

  if (gymLoading) return <GymDetailSkeleton />;
  if (!gym) return <GymNotFound />;

  return (
    <GymPageShell gym={gym}>
      <div className="max-w-2xl space-y-10 animate-fade-in-up">
        <PageHeader
          title="Settings"
          subtitle="Manage your gym profile, team access, billing, and data integrations."
          howTo="Edit your gym info, manage team roles, or use the data tools below."
          icon={Settings}
        />

        <section className="space-y-4" data-testid="section-gym-profile">
          <SectionHeader
            title="Gym Profile"
            description="Your gym's display name and location."
          />
          <Card>
            <CardContent className="p-5">
              <Form {...form}>
                <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Gym Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. CrossFit Iron Valley" {...field} disabled={isDemoUser} data-testid="input-gym-name" />
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
                          <FormLabel className="text-xs">Location</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Austin, TX" {...field} disabled={isDemoUser} data-testid="input-gym-location" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Button type="submit" size="sm" disabled={mutation.isPending || isDemoUser} data-testid="button-save-settings">
                      <Save className="w-3.5 h-3.5 mr-1" />
                      {mutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                    {gym.createdAt && (
                      <span className="text-[11px] text-muted-foreground" data-testid="text-gym-created">
                        Created {formatShortDate(gym.createdAt)}
                      </span>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4" data-testid="section-team-access">
          <SectionHeader
            title="Team & Access"
            description="Manage who has access to this gym and what they can do."
          />
          <TeamAccessSection
            gymId={gymId!}
            staffList={staffList}
            staffLoading={staffLoading}
            isOwner={isOwner}
            isDemoUser={isDemoUser}
            currentUserId={user?.id}
          />
        </section>

        <section className="space-y-4" data-testid="section-billing">
          <SectionHeader
            title="Subscription & Billing"
            description={isOwner ? "Manage your plan and payment method." : "View your gym's current plan."}
          />
          <SubscriptionSection gymId={gymId!} isDemoUser={isDemoUser} />
        </section>

        <section className="space-y-4" data-testid="section-integrations">
          <SectionHeader
            title="Data & Integrations"
            description="Import member data, connect external tools, or refresh your metrics."
          />
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
                      <p className="text-xs text-muted-foreground">Upload from Wodify, PushPress, Zen Planner, or any spreadsheet.</p>
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
                      <p className="text-xs text-muted-foreground">Sync attendance, memberships, and more from your Wodify account.</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </Link>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-3">Billing Integrations</p>
            <Link href={`/gyms/${gymId}/stripe-billing`}>
              <Card className="hover-elevate transition-all duration-300 cursor-pointer group" data-testid="link-stripe-billing">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      <CreditCard className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Stripe Billing</p>
                      <p className="text-xs text-muted-foreground">Import payment history and track billing outcomes from Stripe.</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </Link>
            <Card
              className={`hover-elevate transition-all duration-300 group ${isDemoUser ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              data-testid="button-recompute"
              onClick={() => !isDemoUser && recomputeMutation.mutate()}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <RefreshCw className={`w-4 h-4 text-primary ${recomputeMutation.isPending ? "animate-spin" : ""}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{recomputeMutation.isPending ? "Computing..." : "Recompute Metrics"}</p>
                    <p className="text-xs text-muted-foreground">Refresh all stability metrics, retention scores, and recommendations.</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-4" data-testid="section-exports">
          <SectionHeader
            title="Data Export"
            description="Download your gym data as CSV files."
          />
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ExportItem gymId={gymId!} type="members" label="Members" description="Full member roster with status and billing" />
                <ExportItem gymId={gymId!} type="leads" label="Leads" description="Sales pipeline with stages and contact info" />
                <ExportItem gymId={gymId!} type="metrics" label="Metrics" description="Monthly retention and revenue metrics" />
                <ExportItem gymId={gymId!} type="billing" label="Billing" description="Payment records and collection history" />
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </GymPageShell>
  );
}

function TeamAccessSection({
  gymId,
  staffList,
  staffLoading,
  isOwner,
  isDemoUser,
  currentUserId,
}: {
  gymId: string;
  staffList: StaffMember[];
  staffLoading: boolean;
  isOwner: boolean;
  isDemoUser: boolean;
  currentUserId?: string;
}) {
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("coach");
  const [removeTarget, setRemoveTarget] = useState<StaffMember | null>(null);
  const [roleChangeTarget, setRoleChangeTarget] = useState<StaffMember | null>(null);
  const [pendingRole, setPendingRole] = useState<string>("");

  const { data: invites = [], isLoading: invitesLoading } = useQuery<StaffInvite[]>({
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
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "staff", "invites"] });
      if (data.emailSent) {
        toast({ title: "Invite sent", description: `Invitation email sent to ${inviteEmail}.` });
      } else {
        toast({
          title: "Invite created — email not sent",
          description: data.emailError || "The invitation was saved but the email could not be delivered.",
          variant: "destructive",
        });
      }
      setInviteEmail("");
      setInviteRole("coach");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send invite", description: error.message, variant: "destructive" });
    },
  });

  const cancelInviteMutation = useMutation({
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

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await apiRequest("PATCH", `/api/gyms/${gymId}/staff/${userId}`, { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "staff"] });
      toast({ title: "Role updated", description: `${roleChangeTarget?.userName}'s role has been changed.` });
      setRoleChangeTarget(null);
      setPendingRole("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to change role", description: error.message, variant: "destructive" });
      setRoleChangeTarget(null);
      setPendingRole("");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/gyms/${gymId}/staff/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "staff"] });
      toast({ title: "Access revoked", description: `${removeTarget?.userName} has been removed from this gym.` });
      setRemoveTarget(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove member", description: error.message, variant: "destructive" });
      setRemoveTarget(null);
    },
  });

  const pendingInvites = invites.filter((inv) => inv.status === "pending");
  const ownerCount = staffList.filter(s => s.role === "owner").length;

  return (
    <>
      <Card>
        <CardContent className="p-5 space-y-5">
          {isOwner && !isDemoUser && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                <p className="text-sm font-medium">Invite a team member</p>
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
                  <SelectTrigger className="w-full sm:w-[130px]" data-testid="select-invite-role">
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
                  size="sm"
                  data-testid="button-send-invite"
                >
                  <Mail className="w-3.5 h-3.5 mr-1" />
                  {inviteMutation.isPending ? "Sending..." : "Send Invite"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                {Object.entries(ROLE_INFO).filter(([k]) => k !== "owner").map(([key, info]) => (
                  <p key={key} className="text-[11px] text-muted-foreground">
                    <span className="font-medium">{info.label}:</span> {info.description.split(" without")[0].toLowerCase()}
                  </p>
                ))}
              </div>
            </div>
          )}

          {isOwner && !isDemoUser && pendingInvites.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-border/50">
              <p className="text-xs font-medium text-muted-foreground">Pending Invitations</p>
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/40"
                  data-testid={`invite-row-${invite.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm truncate" data-testid={`text-invite-email-${invite.id}`}>{invite.email}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <RoleBadge role={invite.role} />
                        <span>Expires {formatShortDate(invite.expiresAt)}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cancelInviteMutation.mutate(invite.id)}
                    disabled={cancelInviteMutation.isPending}
                    className="text-muted-foreground hover:text-destructive"
                    data-testid={`button-cancel-invite-${invite.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {(isOwner || !isDemoUser) && (
            <div className={`space-y-2 ${(isOwner && !isDemoUser) ? "pt-3 border-t border-border/50" : ""}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  <Users className="w-3.5 h-3.5 inline mr-1" />
                  Team Members ({staffList.length})
                </p>
              </div>

              {staffLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : staffList.length === 0 ? (
                <div className="py-6 text-center">
                  <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No team members yet</p>
                  {isOwner && <p className="text-xs text-muted-foreground mt-1">Invite your first team member above.</p>}
                </div>
              ) : (
                <div className="space-y-1">
                  {staffList
                    .sort((a, b) => {
                      const roleOrder: Record<string, number> = { owner: 0, admin: 1, coach: 2 };
                      return (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3);
                    })
                    .map((member) => {
                      const isSelf = member.userId === currentUserId;
                      const isLastOwner = member.role === "owner" && ownerCount <= 1;

                      return (
                        <div
                          key={member.id}
                          className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-muted/30 transition-colors"
                          data-testid={`staff-row-${member.userId}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <span className="text-xs font-medium">
                                {member.userName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate" data-testid={`text-staff-name-${member.userId}`}>
                                  {member.userName}
                                  {isSelf && <span className="text-muted-foreground font-normal ml-1">(you)</span>}
                                </p>
                                {member.isGymOwner && (
                                  <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground truncate" data-testid={`text-staff-email-${member.userId}`}>
                                  {member.userEmail}
                                </p>
                                {member.createdAt && (
                                  <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">
                                    Joined {formatShortDate(member.createdAt)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <RoleBadge role={member.role} />
                            {isOwner && !isDemoUser && !isSelf && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-staff-actions-${member.userId}`}>
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  {Object.entries(ROLE_INFO)
                                    .filter(([k]) => k !== member.role)
                                    .map(([key, info]) => (
                                      <DropdownMenuItem
                                        key={key}
                                        onClick={() => {
                                          setRoleChangeTarget(member);
                                          setPendingRole(key);
                                        }}
                                        data-testid={`menu-change-role-${key}-${member.userId}`}
                                      >
                                        <info.icon className="w-3.5 h-3.5 mr-2" />
                                        Make {info.label}
                                      </DropdownMenuItem>
                                    ))}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setRemoveTarget(member)}
                                    disabled={isLastOwner}
                                    data-testid={`menu-remove-${member.userId}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                                    Remove Access
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {isDemoUser && (
            <p className="text-xs text-muted-foreground italic pt-2">
              Team management is disabled in demo mode.
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.userName}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This will revoke <strong>{removeTarget?.userName}</strong>'s access to this gym immediately.
              </span>
              <span className="block">
                They will lose access to all gym data, metrics, member information, and operational tools.
                {removeTarget?.role === "admin" && " Any admin-level configurations they've made will remain."}
              </span>
              {removeTarget?.role === "owner" && (
                <span className="block text-destructive font-medium">
                  Warning: You are removing an owner. This will reduce the number of owners who can manage this gym.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeTarget && removeMutation.mutate(removeTarget.userId)}
              disabled={removeMutation.isPending}
              data-testid="button-confirm-remove"
            >
              {removeMutation.isPending ? "Removing..." : "Remove Access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!roleChangeTarget} onOpenChange={(open) => !open && setRoleChangeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change {roleChangeTarget?.userName}'s role?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Change <strong>{roleChangeTarget?.userName}</strong> from{" "}
                <strong>{ROLE_INFO[roleChangeTarget?.role || ""]?.label}</strong> to{" "}
                <strong>{ROLE_INFO[pendingRole]?.label}</strong>.
              </span>
              <span className="block text-xs text-muted-foreground">
                {ROLE_INFO[pendingRole]?.description}
              </span>
              {roleChangeTarget?.role === "owner" && pendingRole !== "owner" && (
                <span className="block text-destructive font-medium">
                  Warning: Demoting an owner will reduce their access to this gym's billing, staff management, and sensitive settings.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-role-change">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => roleChangeTarget && changeRoleMutation.mutate({ userId: roleChangeTarget.userId, role: pendingRole })}
              disabled={changeRoleMutation.isPending}
              data-testid="button-confirm-role-change"
            >
              {changeRoleMutation.isPending ? "Updating..." : "Confirm Change"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
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
      if (data.url) window.location.href = data.url;
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
      if (data.url) window.location.href = data.url;
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (subLoading) {
    return (
      <Card>
        <CardContent className="p-5 space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-9 w-32" />
        </CardContent>
      </Card>
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
    <Card data-testid="card-subscription">
      <CardContent className="p-5 space-y-4">
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
                  {sub.cancelAtPeriodEnd ? `Access until ${periodEnd}` : `Next billing date: ${periodEnd}`}
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

        <div className="flex flex-wrap gap-2">
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
          <div className="pt-2 border-t border-border/50">
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
  );
}

function ExportItem({ gymId, type, label, description }: { gymId: string; type: string; label: string; description: string }) {
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
    <div
      className="flex items-center justify-between p-3 rounded-md border border-border/50 hover:border-border transition-colors cursor-pointer"
      onClick={handleExport}
      data-testid={`button-export-${type}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      {downloading ? (
        <RefreshCw className="w-4 h-4 text-primary animate-spin shrink-0 ml-2" />
      ) : (
        <Download className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
      )}
    </div>
  );
}
