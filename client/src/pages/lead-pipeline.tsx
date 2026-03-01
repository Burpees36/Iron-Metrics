import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Lead } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Plus,
  ArrowRight,
  Calendar,
  CheckCircle2,
  XCircle,
  Trophy,
  User,
  Phone,
  Mail,
  ChevronRight,
  UserPlus,
  Clock,
  Upload,
} from "lucide-react";

const SOURCES = ["Referral", "Facebook", "Instagram", "Google", "Walk-in", "Website", "Other"];

const LOST_REASONS: { value: string; label: string }[] = [
  { value: "price", label: "Price" },
  { value: "not_ready", label: "Not Ready" },
  { value: "no_show", label: "No Show" },
  { value: "chose_competitor", label: "Chose Competitor" },
  { value: "other", label: "Other" },
];

const STAGES = [
  { key: "new", label: "New", icon: UserPlus, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { key: "booked", label: "Booked", icon: Calendar, color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { key: "showed", label: "Showed", icon: CheckCircle2, color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  { key: "won", label: "Won", icon: Trophy, color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { key: "lost", label: "Lost", icon: XCircle, color: "bg-red-500/10 text-red-400 border-red-500/20" },
] as const;

function formatDate(d: string | Date | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sourceBadgeColor(source: string) {
  const map: Record<string, string> = {
    Referral: "bg-emerald-500/15 text-emerald-400",
    Facebook: "bg-blue-500/15 text-blue-400",
    Instagram: "bg-pink-500/15 text-pink-400",
    Google: "bg-yellow-500/15 text-yellow-400",
    "Walk-in": "bg-purple-500/15 text-purple-400",
    Website: "bg-cyan-500/15 text-cyan-400",
  };
  return map[source] || "bg-muted text-muted-foreground";
}

export default function LeadPipeline() {
  const { id: gymId } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [stageDialog, setStageDialog] = useState<{ lead: Lead; targetStage: string } | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);

  const [newLead, setNewLead] = useState({ source: "Referral", name: "", email: "", phone: "", coachId: "", notes: "" });
  const [consultDate, setConsultDate] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [lostReason, setLostReason] = useState("");

  const { data: leads, isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/gyms", gymId, "leads"],
    queryFn: async () => {
      const res = await fetch(`/api/gyms/${gymId}/leads`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newLead) => {
      const res = await apiRequest("POST", `/api/gyms/${gymId}/leads`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "leads"] });
      setAddOpen(false);
      setNewLead({ source: "Referral", name: "", email: "", phone: "", coachId: "", notes: "" });
      toast({ title: "Lead created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const stageMutation = useMutation({
    mutationFn: async ({ leadId, stage, extra }: { leadId: string; stage: string; extra?: Record<string, any> }) => {
      const res = await apiRequest("PUT", `/api/gyms/${gymId}/leads/${leadId}/stage`, { stage, ...extra });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to transition stage");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gyms", gymId, "leads"] });
      setStageDialog(null);
      setConsultDate("");
      setSalePrice("");
      setLostReason("");
      toast({ title: "Lead updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const grouped = STAGES.map((stage) => ({
    ...stage,
    leads: (leads || []).filter((l) => l.status === stage.key),
  }));

  const isEmpty = !leads || leads.length === 0;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  function handleStageClick(lead: Lead, targetStage: string) {
    if (targetStage === "showed") {
      stageMutation.mutate({ leadId: lead.id, stage: "showed" });
    } else {
      setStageDialog({ lead, targetStage });
    }
  }

  function confirmStageTransition() {
    if (!stageDialog) return;
    const { lead, targetStage } = stageDialog;
    const extra: Record<string, any> = {};
    if (targetStage === "booked") {
      if (!consultDate) return toast({ title: "Consult date required", variant: "destructive" });
      extra.consultDate = consultDate;
    }
    if (targetStage === "won") {
      if (!salePrice || Number(salePrice) <= 0) return toast({ title: "Sale price required", variant: "destructive" });
      extra.salePrice = Number(salePrice);
    }
    if (targetStage === "lost") {
      if (!lostReason) return toast({ title: "Reason required", variant: "destructive" });
      extra.lostReason = lostReason;
    }
    stageMutation.mutate({ leadId: lead.id, stage: targetStage, extra });
  }

  function getNextActions(lead: Lead) {
    const actions: { label: string; stage: string; icon: typeof ArrowRight }[] = [];
    if (lead.status === "new") {
      actions.push({ label: "Book Consult", stage: "booked", icon: Calendar });
      actions.push({ label: "Mark Lost", stage: "lost", icon: XCircle });
    } else if (lead.status === "booked") {
      actions.push({ label: "Mark Showed", stage: "showed", icon: CheckCircle2 });
      actions.push({ label: "Mark Lost", stage: "lost", icon: XCircle });
    } else if (lead.status === "showed") {
      actions.push({ label: "Close Won", stage: "won", icon: Trophy });
      actions.push({ label: "Mark Lost", stage: "lost", icon: XCircle });
    }
    return actions;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="heading-pipeline">Lead Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">Track every lead from first contact to member.</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/gyms/${gymId}/leads/import`}>
            <Button variant="outline" data-testid="button-import-leads">
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
          </Link>
          <Button onClick={() => setAddOpen(true)} data-testid="button-add-lead">
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      {isEmpty ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-6">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold" data-testid="heading-empty-state">Start tracking your leads in 60 seconds.</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">Every lead you add flows through your pipeline — from first contact to member. Your Sales Intelligence dashboard updates automatically.</p>
            </div>
            <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">1</span> Add a lead</div>
              <ChevronRight className="w-4 h-4" />
              <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">2</span> Book & track</div>
              <ChevronRight className="w-4 h-4" />
              <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">3</span> Close the sale</div>
            </div>
            <Button onClick={() => setAddOpen(true)} data-testid="button-add-lead-empty">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Lead
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4" data-testid="pipeline-board">
          {grouped.map((col) => {
            const StageIcon = col.icon;
            return (
              <div key={col.key} className="space-y-3" data-testid={`column-${col.key}`}>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${col.color}`}>
                  <StageIcon className="w-4 h-4" />
                  <span className="text-sm font-semibold">{col.label}</span>
                  <Badge variant="secondary" className="ml-auto text-xs" data-testid={`count-${col.key}`}>
                    {col.leads.length}
                  </Badge>
                </div>

                <div className="space-y-2 min-h-[100px]">
                  {col.leads.map((lead) => {
                    const actions = getNextActions(lead);
                    return (
                      <Card
                        key={lead.id}
                        className="cursor-pointer hover:border-primary/30 transition-colors"
                        data-testid={`card-lead-${lead.id}`}
                        onClick={() => setDetailLead(lead)}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium truncate" data-testid={`text-lead-name-${lead.id}`}>
                              {lead.name || "Unnamed Lead"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] ${sourceBadgeColor(lead.source)}`}>
                              {lead.source}
                            </Badge>
                            {lead.coachId && (
                              <Badge variant="outline" className="text-[10px]">
                                <User className="w-2.5 h-2.5 mr-0.5" />{lead.coachId}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatDate(lead.createdAt)}
                            {lead.salePrice && <span className="ml-auto font-medium text-emerald-400">${lead.salePrice}</span>}
                            {lead.lostReason && (
                              <span className="ml-auto text-red-400">
                                {LOST_REASONS.find(r => r.value === lead.lostReason)?.label || lead.lostReason}
                              </span>
                            )}
                          </div>
                          {actions.length > 0 && (
                            <div className="flex gap-1 pt-1 border-t border-border/50">
                              {actions.map((action) => (
                                <Button
                                  key={action.stage}
                                  size="sm"
                                  variant={action.stage === "lost" ? "ghost" : "outline"}
                                  className="h-6 text-[10px] flex-1"
                                  data-testid={`button-${action.stage}-${lead.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStageClick(lead, action.stage);
                                  }}
                                >
                                  <action.icon className="w-3 h-3 mr-1" />
                                  {action.label}
                                </Button>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}

                  {col.leads.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-lg">
                      No leads
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Lead</DialogTitle>
            <DialogDescription>Track a new prospect entering your sales funnel.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Source</Label>
              <Select value={newLead.source} onValueChange={(v) => setNewLead({ ...newLead, source: v })}>
                <SelectTrigger data-testid="select-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Name</Label>
              <Input
                placeholder="Full name"
                value={newLead.name}
                onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                data-testid="input-lead-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={newLead.email}
                  onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                  data-testid="input-lead-email"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  placeholder="(555) 123-4567"
                  value={newLead.phone}
                  onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                  data-testid="input-lead-phone"
                />
              </div>
            </div>
            <div>
              <Label>Assigned Coach</Label>
              <Input
                placeholder="Coach name"
                value={newLead.coachId}
                onChange={(e) => setNewLead({ ...newLead, coachId: e.target.value })}
                data-testid="input-lead-coach"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Initial notes..."
                value={newLead.notes}
                onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                data-testid="input-lead-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} data-testid="button-cancel-add">Cancel</Button>
            <Button onClick={() => createMutation.mutate(newLead)} disabled={createMutation.isPending} data-testid="button-submit-lead">
              {createMutation.isPending ? "Adding..." : "Add Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!stageDialog} onOpenChange={(open) => { if (!open) setStageDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {stageDialog?.targetStage === "booked" && "Book Consultation"}
              {stageDialog?.targetStage === "won" && "Close — Won"}
              {stageDialog?.targetStage === "lost" && "Close — Lost"}
            </DialogTitle>
            <DialogDescription>
              {stageDialog?.lead.name || "Unnamed Lead"}
            </DialogDescription>
          </DialogHeader>

          {stageDialog?.targetStage === "booked" && (
            <div>
              <Label>Consultation Date</Label>
              <Input
                type="datetime-local"
                value={consultDate}
                onChange={(e) => setConsultDate(e.target.value)}
                data-testid="input-consult-date"
              />
            </div>
          )}

          {stageDialog?.targetStage === "won" && (
            <div>
              <Label>Monthly Membership Price ($)</Label>
              <Input
                type="number"
                min="1"
                step="0.01"
                placeholder="199.00"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                data-testid="input-sale-price"
              />
            </div>
          )}

          {stageDialog?.targetStage === "lost" && (
            <div>
              <Label>Reason</Label>
              <Select value={lostReason} onValueChange={setLostReason}>
                <SelectTrigger data-testid="select-lost-reason">
                  <SelectValue placeholder="Select reason..." />
                </SelectTrigger>
                <SelectContent>
                  {LOST_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialog(null)} data-testid="button-cancel-stage">Cancel</Button>
            <Button onClick={confirmStageTransition} disabled={stageMutation.isPending} data-testid="button-confirm-stage">
              {stageMutation.isPending ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailLead} onOpenChange={(open) => { if (!open) setDetailLead(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detailLead?.name || "Unnamed Lead"}</DialogTitle>
            <DialogDescription>
              <Badge variant="outline" className="mr-2">{detailLead?.status?.toUpperCase()}</Badge>
              <Badge variant="outline" className={sourceBadgeColor(detailLead?.source || "")}>{detailLead?.source}</Badge>
            </DialogDescription>
          </DialogHeader>
          {detailLead && (
            <div className="space-y-3 text-sm">
              {detailLead.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4" />{detailLead.email}
                </div>
              )}
              {detailLead.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4" />{detailLead.phone}
                </div>
              )}
              {detailLead.coachId && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="w-4 h-4" />Coach: {detailLead.coachId}
                </div>
              )}
              {detailLead.consultDate && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />Consult: {new Date(detailLead.consultDate).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </div>
              )}
              {detailLead.salePrice && (
                <div className="flex items-center gap-2 text-emerald-400">
                  <Trophy className="w-4 h-4" />Won at ${detailLead.salePrice}/mo
                </div>
              )}
              {detailLead.lostReason && (
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle className="w-4 h-4" />Lost: {LOST_REASONS.find(r => r.value === detailLead.lostReason)?.label || detailLead.lostReason}
                </div>
              )}
              {detailLead.notes && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{detailLead.notes}</p>
                </div>
              )}
              <div className="text-xs text-muted-foreground pt-2">
                Created {formatDate(detailLead.createdAt)}
                {detailLead.bookedAt && <> · Booked {formatDate(detailLead.bookedAt)}</>}
                {detailLead.showedAt && <> · Showed {formatDate(detailLead.showedAt)}</>}
                {detailLead.wonAt && <> · Won {formatDate(detailLead.wonAt)}</>}
                {detailLead.lostAt && <> · Lost {formatDate(detailLead.lostAt)}</>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
