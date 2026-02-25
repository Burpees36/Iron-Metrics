import { useRoute } from "wouter";
import { useGymData, GymPageShell, TrendsView, GymNotFound, GymDetailSkeleton } from "./gym-detail";

export default function GymTrends() {
  const [, params] = useRoute("/gyms/:id/trends");
  const gymId = params?.id;

  const { data: gym, isLoading: gymLoading } = useGymData(gymId);

  if (gymLoading) return <GymDetailSkeleton />;
  if (!gym) return <GymNotFound />;

  return (
    <GymPageShell
      gym={gym}
    >
      <TrendsView gymId={gym.id} />
    </GymPageShell>
  );
}
