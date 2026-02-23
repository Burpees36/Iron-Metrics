import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  ShieldAlert,
  Shield,
  ShieldCheck,
  Star,
  Clock,
  Calendar,
  User,
  DollarSign,
  Activity,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { useGymData, GymPageShell, GymNotFound, GymDetailSkeleton } from "./gym-detail";

interface MemberContact {
  id: string;
  memberId: string;
  gymId: string;
  contactedAt: string;
  note: string;
}

interface MemberDetail {
  id: string;
  name: string;
  email: string | null;
  status: string;
  joinDate: string;
  cancelDate: string | null;
  lastAttendedDate: string | null;
  monthlyRate: string;
  tenureDays: number;
  tenureMonths: number;
  totalRevenue: number;
  risk: "low" | "medium" | "high";
  riskReasons: string[];
  daysSinceContact: number | null;
  lastContacted: string | null;
  isHighValue: boolean;
  churnProbability: number | null;
  engagementClass: string | null;
  contacts: MemberContact[];
}

function getRecommendedAction(member: MemberDetail): string {
  const isHighRisk = member.risk === "high";
  const hasNeverBeenContacted = member.daysSinceContact === null;
  const isLongSilent = member.daysSinceContact !== null && member.daysSinceContact > 60;
  const isDrifting = member.daysSinceContact !== null && member.daysSinceContact > 30;

  if (member.tenureDays <= 14) {
    if (hasNeverBeenContacted) {
      return "This member is in their first two weeks — the highest-risk window. Send a personal follow-up today asking how their first classes felt. Introduce them to at least 3 other members by name. The target is 3 classes in their first 7 days. Members who complete structured onboarding extend their average retention from 78 days to 8 months.";
    }
    return "First two weeks. Ensure they have a clear schedule recommendation, have been introduced to other members, and feel welcomed beyond the workout. A 30-day goal-setting session should already be on the calendar. Early wins — a PR, a skill milestone, a coach callout — build the momentum that turns trial into commitment.";
  }

  if (member.tenureDays <= 30) {
    return "In their first month. Schedule a goal-setting session this week to define 3 specific, measurable targets. Ask what is working and what could be better. Members who complete a goal review within their first 90 days are 3 times more likely to reach the 6-month mark. Address any scheduling friction or social discomfort now, before it becomes a cancellation reason.";
  }

  if (member.tenureDays <= 90) {
    if (isHighRisk) {
      return "In the first 90 days and showing risk signals. The novelty is wearing off and the habit has not solidified. Schedule a goal review immediately — show them any progress they have made, set 3 new targets, and pair them with a workout buddy. Celebrate any wins publicly. Without intervention in this window, most gyms lose these members.";
    }
    return "In the pre-habit window. Visible progress tracking and social connections determine whether they stay. If their first quarterly goal review has not happened yet, schedule it now. Show them measurable improvement, celebrate milestones, and deepen their connection to at least one coach and one other member.";
  }

  if (member.tenureDays <= 270) {
    if (isHighRisk || isLongSilent) {
      return "5 to 9 months in — the identity formation period. This member's connection to the gym is weakening. The gym needs to become part of who they are, not just where they work out. A direct call from their coach, referencing their progress and goals, is the intervention. Invite them to a community event or challenge. Ask if their schedule still works. Compatibility and belonging are the levers here.";
    }
    if (isDrifting) {
      return "Mid-tenure member showing signs of drift. Schedule a goal review to reset motivation. Ask what is working and what is not. Introduce a new challenge — a skill progression, a competition, or a community event. Members at this stage need to feel that the gym sees them as an individual, not just a membership number.";
    }
    return "Established member in the engagement window. Ensure quarterly goal reviews are happening consistently. Look for opportunities to deepen their involvement: community events, bring-a-friend invitations, or small leadership roles. Members who refer someone stay approximately 6 months longer.";
  }

  if (member.tenureDays <= 365) {
    if (isHighRisk) {
      return "Approaching the critical one-year mark with risk signals. This is a pivotal moment — a goal review showing tangible progress over the year is essential. Show them how far they have come since joining. Set ambitious but achievable goals for year two. Consider offering a leadership opportunity or competition entry. The identity-level connection that keeps members beyond year one requires demonstrating that this gym is invested in their future.";
    }
    return "Approaching the one-year mark. Conduct a comprehensive annual review: celebrate their journey, show measurable progress, and set year-two goals. This is the moment to invite deeper engagement — competition participation, a referral, or a mentorship role with newer members. Members who cross the one-year threshold with clear forward direction tend to stay for 2 or more years.";
  }

  if (isHighRisk || isLongSilent) {
    return "Long-tenure member showing risk signals. These members are the hardest to replace and the most valuable to retain. A direct, personal call from their coach is non-negotiable. Acknowledge their history with the gym, ask what has changed, and offer flexibility — schedule adjustments, a membership pause, or a different class format. Losing a member with this much tenure costs far more than the effort to save them.";
  }

  if (hasNeverBeenContacted) {
    return "Long-standing member who has never received personal outreach. They have stayed on their own momentum, but that is not a system. A goal review that acknowledges their loyalty, celebrates their milestones, and sets forward-looking targets converts a passive member into an ambassador. Ask if they would be open to mentoring a newer member or bringing a friend to a workout.";
  }

  return "Established member in good standing. Ensure quarterly goal reviews continue, celebrate milestones, and look for referral opportunities. Members who feel seen, challenged, and connected to the community are the ones who stay for years and bring others with them.";
}

const RISK_CONFIG = {
  low: { icon: ShieldCheck, color: "text-primary", bg: "bg-primary/10", label: "Low Risk" },
  medium: { icon: Shield, color: "text-amber-500", bg: "bg-amber-500/10", label: "Medium Risk" },
  high: { icon: ShieldAlert, color: "text-red-500 dark:text-red-400", bg: "bg-red-500/10", label: "High Risk" },
};

const STATUS_CONFIG: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
  active: { variant: "default", label: "Active" },
  cancelled: { variant: "destructive", label: "Cancelled" },
  frozen: { variant: "secondary", label: "Frozen" },
};

const TENURE_STAGES = [
  { label: "Onboarding", maxDays: 14, shortLabel: "0-14d" },
  { label: "Pre-Habit", maxDays: 60, shortLabel: "14-60d" },
  { label: "Building", maxDays: 180, shortLabel: "60-180d" },
  { label: "Established", maxDays: 365, shortLabel: "180-365d" },
  { label: "Core", maxDays: Infinity, shortLabel: "365d+" },
];

function getCurrentStageIndex(tenureDays: number): number {
  if (tenureDays <= 14) return 0;
  if (tenureDays <= 60) return 1;
  if (tenureDays <= 180) return 2;
  if (tenureDays <= 365) return 3;
  return 4;
}

export default function MemberDetailPage() {
  const [, params] = useRoute("/gyms/:id/members/:memberId");
  const gymId = params?.id;
  const memberId = params?.memberId;

  const { data: gym, isLoading: gymLoading } = useGymData(gymId);

  const { data: member, isLoading: memberLoading } = useQuery<MemberDetail>({
    queryKey: ["/api/gyms", gymId, "members", memberId, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/gyms/${gymId}/members/${memberId}/detail`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch member detail");
      return res.json();
    },
    enabled: !!gymId && !!memberId,
  });

  if (gymLoading || memberLoading) return <GymDetailSkeleton />;
  if (!gym) return <GymNotFound />;

  if (!member) {
    return (
      <GymPageShell gym={gym}>
        <Card>
          <CardContent className="p-10 text-center space-y-4">
            <User className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Member not found.</p>
            <Link href={`/gyms/${gymId}`}>
              <Button variant="outline" data-testid="button-back-to-gym">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Gym
              </Button>
            </Link>
          </CardContent>
        </Card>
      </GymPageShell>
    );
  }

  return (
    <GymPageShell gym={gym}>
      <div className="space-y-6">
        <MemberHeader member={member} gymId={gymId!} />
        <StatsGrid member={member} />
        {member.riskReasons.length > 0 && <RiskSignals reasons={member.riskReasons} />}
        <TenureTimeline tenureDays={member.tenureDays} />
        <RecommendedAction member={member} />
        <LogTouchpoint gymId={gymId!} memberId={member.id} />
        <ContactHistory contacts={member.contacts} />
      </div>
    </GymPageShell>
  );
}

function MemberHeader({ member, gymId }: { member: MemberDetail; gymId: string }) {
  const riskCfg = RISK_CONFIG[member.risk];
  const RiskIcon = riskCfg.icon;

  return (
    <div className="flex flex-wrap items-center gap-4 animate-fade-in-up" data-testid="section-member-header">
      <Link href={`/gyms/${gymId}`}>
        <Button variant="ghost" size="icon" data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
      </Link>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-10 h-10 rounded-full ${riskCfg.bg} flex items-center justify-center flex-shrink-0`}>
          <User className={`w-5 h-5 ${riskCfg.color}`} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight truncate" data-testid="text-member-name">
              {member.name}
            </h1>
            {member.isHighValue && (
              <Tooltip>
                <TooltipTrigger>
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0" data-testid="icon-high-value" />
                </TooltipTrigger>
                <TooltipContent>High-value member</TooltipContent>
              </Tooltip>
            )}
            <Badge
              variant={member.risk === "high" ? "destructive" : member.risk === "medium" ? "secondary" : "outline"}
              data-testid="badge-risk"
            >
              <RiskIcon className="w-3 h-3 mr-1" />
              {riskCfg.label}
            </Badge>
          </div>
          {member.email && (
            <p className="text-sm text-muted-foreground truncate" data-testid="text-member-email">{member.email}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatsGrid({ member }: { member: MemberDetail }) {
  const statusCfg = STATUS_CONFIG[member.status] || { variant: "outline" as const, label: member.status };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 animate-fade-in-up" data-testid="section-stats-grid">
      <StatCard
        label="Status"
        icon={Activity}
        testId="stat-status"
      >
        <Badge variant={statusCfg.variant} data-testid="badge-status">{statusCfg.label}</Badge>
      </StatCard>

      <StatCard
        label="Risk Level"
        icon={RISK_CONFIG[member.risk].icon}
        testId="stat-risk"
      >
        <span className={`font-mono text-lg font-bold ${RISK_CONFIG[member.risk].color}`} data-testid="text-risk-level">
          {member.risk.charAt(0).toUpperCase() + member.risk.slice(1)}
        </span>
      </StatCard>

      <StatCard
        label="Tenure"
        icon={Clock}
        testId="stat-tenure"
      >
        <span className="font-mono text-lg font-bold" data-testid="text-tenure">
          {member.tenureMonths}
          <span className="text-sm font-normal text-muted-foreground">mo</span>
        </span>
        <span className="text-xs text-muted-foreground font-mono">{member.tenureDays}d</span>
      </StatCard>

      <StatCard
        label="Monthly Rate"
        icon={DollarSign}
        testId="stat-monthly-rate"
      >
        <span className="font-mono text-lg font-bold" data-testid="text-monthly-rate">
          ${Number(member.monthlyRate).toFixed(0)}
          <span className="text-sm font-normal text-muted-foreground">/mo</span>
        </span>
      </StatCard>

      <StatCard
        label="Total Revenue"
        icon={TrendingUp}
        testId="stat-total-revenue"
      >
        <span className="font-mono text-lg font-bold" data-testid="text-total-revenue">
          ${member.totalRevenue.toLocaleString()}
        </span>
      </StatCard>

      <StatCard
        label="Join Date"
        icon={Calendar}
        testId="stat-join-date"
      >
        <span className="font-mono text-sm font-semibold" data-testid="text-join-date">
          {new Date(member.joinDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </StatCard>

      {member.churnProbability !== null && (
        <StatCard
          label="Churn Probability"
          icon={ShieldAlert}
          testId="stat-churn-probability"
        >
          <span className={`font-mono text-lg font-bold ${member.churnProbability > 50 ? "text-red-500 dark:text-red-400" : member.churnProbability > 25 ? "text-amber-500" : "text-primary"}`} data-testid="text-churn-probability">
            {member.churnProbability}%
          </span>
        </StatCard>
      )}

      {member.engagementClass && (
        <StatCard
          label="Engagement Class"
          icon={Activity}
          testId="stat-engagement-class"
        >
          <Badge variant="outline" data-testid="badge-engagement-class">{member.engagementClass}</Badge>
        </StatCard>
      )}
    </div>
  );
}

function StatCard({ label, icon: Icon, children, testId }: { label: string; icon: typeof Activity; children: React.ReactNode; testId: string }) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

function RiskSignals({ reasons }: { reasons: string[] }) {
  return (
    <div className="space-y-2 animate-fade-in-up" data-testid="section-risk-signals">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Risk Signals</p>
      <div className="flex flex-wrap gap-2">
        {reasons.map((reason, i) => (
          <Badge
            key={i}
            variant="destructive"
            data-testid={`badge-risk-reason-${i}`}
          >
            <ShieldAlert className="w-3 h-3 mr-1" />
            {reason}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function TenureTimeline({ tenureDays }: { tenureDays: number }) {
  const currentStage = getCurrentStageIndex(tenureDays);

  return (
    <Card className="animate-fade-in-up" data-testid="section-tenure-timeline">
      <CardContent className="p-5 space-y-4">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tenure Timeline</p>
        <div className="flex gap-1 h-3 rounded-full overflow-hidden">
          {TENURE_STAGES.map((stage, i) => (
            <div
              key={stage.label}
              className={`flex-1 rounded-sm transition-colors ${
                i === currentStage
                  ? "bg-primary"
                  : i < currentStage
                    ? "bg-primary/30"
                    : "bg-muted"
              }`}
              data-testid={`timeline-segment-${i}`}
            />
          ))}
        </div>
        <div className="flex gap-1">
          {TENURE_STAGES.map((stage, i) => (
            <div
              key={stage.label}
              className={`flex-1 text-center ${
                i === currentStage ? "text-foreground" : "text-muted-foreground/60"
              }`}
            >
              <p className={`text-[10px] font-medium ${i === currentStage ? "text-primary font-semibold" : ""}`}>
                {stage.label}
              </p>
              <p className="text-[9px] text-muted-foreground">{stage.shortLabel}</p>
            </div>
          ))}
        </div>
        <div className="text-center">
          <Badge variant="outline" data-testid="badge-current-stage">
            <Clock className="w-3 h-3 mr-1" />
            Day {tenureDays} — {TENURE_STAGES[currentStage].label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function RecommendedAction({ member }: { member: MemberDetail }) {
  const action = getRecommendedAction(member);

  return (
    <Card className="animate-fade-in-up" data-testid="section-recommended-action">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Phone className="w-3 h-3 text-primary" />
          </div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Recommended Action</p>
        </div>
        <div className="p-4 rounded-md bg-muted/50">
          <p className="text-sm leading-relaxed text-foreground/90" data-testid="text-recommended-action">
            {action}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function LogTouchpoint({ gymId, memberId }: { gymId: string; memberId: string }) {
  const { toast } = useToast();
  const [note, setNote] = useState("");

  const contactMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/gyms/${gymId}/members/${memberId}/contact`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "members", memberId, "detail"] });
      toast({ title: "Touchpoint logged", description: "Contact has been recorded." });
      setNote("");
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
    <Card className="animate-fade-in-up" data-testid="section-log-touchpoint">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-3 h-3 text-primary" />
          </div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Log Touchpoint</p>
        </div>
        <Textarea
          placeholder="Quick note about this interaction..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="text-sm resize-none"
          rows={3}
          data-testid="input-contact-note"
        />
        <Button
          onClick={() => contactMutation.mutate()}
          disabled={contactMutation.isPending || !note.trim()}
          data-testid="button-log-touchpoint"
        >
          <Phone className="w-4 h-4 mr-1" />
          {contactMutation.isPending ? "Logging..." : "Log Touchpoint"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ContactHistory({ contacts }: { contacts: MemberContact[] }) {
  const sorted = [...contacts].sort((a, b) =>
    new Date(b.contactedAt).getTime() - new Date(a.contactedAt).getTime()
  );

  return (
    <Card className="animate-fade-in-up" data-testid="section-contact-history">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Clock className="w-3 h-3 text-primary" />
          </div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Contact History</p>
        </div>
        {sorted.length === 0 ? (
          <div className="py-6 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground" data-testid="text-no-contacts">No contact history yet.</p>
          </div>
        ) : (
          <div className="space-y-0" data-testid="list-contacts">
            {sorted.map((contact, i) => (
              <div
                key={contact.id}
                className="flex gap-3 py-3 border-b border-border/50 last:border-0"
                data-testid={`contact-item-${i}`}
              >
                <div className="flex flex-col items-center pt-0.5">
                  <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  {i < sorted.length - 1 && <div className="w-px flex-1 bg-border/50 mt-1" />}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-xs text-muted-foreground font-mono" data-testid={`contact-date-${i}`}>
                    {new Date(contact.contactedAt).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {" "}
                    {new Date(contact.contactedAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  {contact.note && (
                    <p className="text-sm text-foreground leading-relaxed" data-testid={`contact-note-${i}`}>
                      {contact.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
