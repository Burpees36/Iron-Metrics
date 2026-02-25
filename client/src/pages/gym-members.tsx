import { useRoute } from "wouter";
import { useGymData, GymPageShell, MembersView, GymNotFound, GymDetailSkeleton } from "./gym-detail";

export default function GymMembers() {
  const [, params] = useRoute("/gyms/:id/members");
  const gymId = params?.id;

  const { data: gym, isLoading: gymLoading } = useGymData(gymId);

  if (gymLoading) return <GymDetailSkeleton />;
  if (!gym) return <GymNotFound />;

  return (
    <GymPageShell gym={gym}>
      <MembersView gymId={gym.id} />
    </GymPageShell>
  );
}
