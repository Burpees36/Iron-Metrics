import { useRoute } from "wouter";
import { useGymData, GymPageShell, RecomputeButton, GymNotFound, GymDetailSkeleton } from "./gym-detail";
import { usePredictiveData, MemberRiskView, PredictiveSkeleton } from "./predictive-intelligence";

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
      actions={<RecomputeButton gymId={gym.id} />}
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
