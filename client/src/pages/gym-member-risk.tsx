import { useRoute, Link } from "wouter";
import { useGymData, GymPageShell, GymNotFound, GymDetailSkeleton } from "./gym-detail";
import { usePredictiveData, MemberRiskView, PredictiveSkeleton } from "./predictive-intelligence";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

export default function GymMemberRisk() {
  const [, params] = useRoute("/gyms/:id/member-risk");
  const gymId = params?.id;

  const { data: gym, isLoading: gymLoading } = useGymData(gymId);
  const { data, isLoading: predLoading, error } = usePredictiveData(gymId || "");

  if (gymLoading) return <GymDetailSkeleton />;
  if (!gym) return <GymNotFound />;

  return (
    <GymPageShell
      gym={gym}
      actions={
        <Link href={`/gyms/${gym.id}/operator?pill=retention&task=Member+outreach+drafts`}>
          <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-operator-outreach">
            <Zap className="w-3.5 h-3.5" /> Generate Outreach Drafts
          </Button>
        </Link>
      }
    >
      {predLoading ? (
        <PredictiveSkeleton />
      ) : error || !data ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="predictive-error">
          Unable to load member risk data. Import members and recompute metrics first.
        </div>
      ) : (
        <MemberRiskView predictions={data.memberPredictions} gymId={gym.id} />
      )}
    </GymPageShell>
  );
}
