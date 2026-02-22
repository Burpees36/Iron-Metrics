import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useGymData, GymPageShell, MembersView, RecomputeButton, GymNotFound, GymDetailSkeleton } from "./gym-detail";

export default function GymMembers() {
  const [, params] = useRoute("/gyms/:id/members");
  const gymId = params?.id;

  const { data: gym, isLoading: gymLoading } = useGymData(gymId);

  if (gymLoading) return <GymDetailSkeleton />;
  if (!gym) return <GymNotFound />;

  return (
    <GymPageShell
      gym={gym}
      actions={
        <>
          <Link href={`/gyms/${gym.id}/import`}>
            <Button data-testid="button-import-csv">
              <Upload className="w-4 h-4 mr-1" />
              Import CSV
            </Button>
          </Link>
          <RecomputeButton gymId={gym.id} />
        </>
      }
    >
      <MembersView gymId={gym.id} />
    </GymPageShell>
  );
}
