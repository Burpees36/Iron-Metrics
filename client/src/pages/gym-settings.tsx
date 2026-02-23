import { useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Settings, Save } from "lucide-react";
import { useGymData, GymPageShell, GymNotFound, GymDetailSkeleton } from "./gym-detail";

const formSchema = z.object({
  name: z.string().min(1, "Gym name is required").max(100),
  location: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function GymSettings() {
  const [, params] = useRoute("/gyms/:id/settings");
  const gymId = params?.id;

  const { data: gym, isLoading: gymLoading } = useGymData(gymId);
  const { toast } = useToast();

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
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
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
      <div className="max-w-lg space-y-6 animate-fade-in-up">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground" data-testid="text-settings-heading">
            Gym Settings
          </h2>
        </div>

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
      </div>
    </GymPageShell>
  );
}
