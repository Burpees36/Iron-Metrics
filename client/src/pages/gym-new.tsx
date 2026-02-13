import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { useToast } from "@/hooks/use-toast";
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
import { Building2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const formSchema = z.object({
  name: z.string().min(1, "Gym name is required").max(100),
  location: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function GymNew() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      location: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await apiRequest("POST", "/api/gyms", values);
      return res.json();
    },
    onSuccess: (gym) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gyms"] });
      toast({ title: "Gym created", description: `${gym.name} has been added.` });
      navigate(`/gyms/${gym.id}`);
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

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div className="space-y-1">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-2" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        </Link>
        <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-page-title">
          Add a Gym
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your gym's details to start tracking its financial health.
        </p>
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
                    <FormLabel>Gym Name</FormLabel>
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
                    <FormLabel>Location (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Austin, TX" {...field} data-testid="input-gym-location" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={mutation.isPending}
                data-testid="button-create-gym"
              >
                <Building2 className="w-4 h-4 mr-1" />
                {mutation.isPending ? "Creating..." : "Create Gym"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
