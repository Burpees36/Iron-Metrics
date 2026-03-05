import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { useToast } from "@/hooks/use-toast";
import { IronMetricsLogoCompact } from "@/components/brand-logos";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Plug, Database, ArrowRight, BarChart3, Brain, CreditCard } from "lucide-react";

type DataSource = "csv" | "wodify" | "sample";

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [gymName, setGymName] = useState("");
  const [location, setLocation] = useState("");
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [createdGymId, setCreatedGymId] = useState<number | null>(null);

  const totalSteps = dataSource === "sample" ? 3 : 2;

  const createGymMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/gyms", {
        name: gymName,
        location: location || undefined,
      });
      return res.json();
    },
    onSuccess: (gym) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gyms"] });
      setCreatedGymId(gym.id);

      if (dataSource === "csv") {
        navigate(`/gyms/${gym.id}/import`);
      } else if (dataSource === "wodify") {
        navigate(`/gyms/${gym.id}/wodify`);
      } else if (dataSource === "sample") {
        setStep(3);
      }
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

  const handleStep1Continue = () => {
    if (!gymName.trim()) return;
    setStep(2);
  };

  const handleStep2Continue = () => {
    if (!dataSource) return;
    createGymMutation.mutate();
  };

  const handleGoToDashboard = () => {
    if (createdGymId) {
      navigate(`/gyms/${createdGymId}`);
    }
  };

  const dataSourceOptions = [
    {
      id: "csv" as DataSource,
      title: "Import CSV",
      icon: Upload,
      description: "Upload a roster from any gym management system",
    },
    {
      id: "wodify" as DataSource,
      title: "Connect Wodify",
      icon: Plug,
      description: "Sync directly with your Wodify account",
    },
    {
      id: "sample" as DataSource,
      title: "Start with Sample Data",
      icon: Database,
      description: "Explore with demo data to learn the platform",
    },
  ];

  const tourFeatures = [
    {
      title: "Command Center",
      description: "Your financial stability dashboard",
      icon: BarChart3,
    },
    {
      title: "AI Operator",
      description: "Generate action plans from your data",
      icon: Brain,
    },
    {
      title: "Billing Intelligence",
      description: "Track member payments and collections",
      icon: CreditCard,
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8">
        <div className="flex justify-center">
          <IronMetricsLogoCompact className="h-12" variant="dark" data-testid="logo-onboarding" />
        </div>

        <div className="flex justify-center gap-2" data-testid="progress-dots">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i + 1 === step ? "w-8 bg-primary" : i + 1 < step ? "w-2 bg-primary" : "w-2 bg-muted"
              }`}
              data-testid={`progress-dot-${i + 1}`}
            />
          ))}
        </div>

        {step === 1 && (
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2 text-center">
                <h1 className="text-2xl font-bold tracking-tight" data-testid="text-welcome-heading">
                  Welcome to Iron Metrics
                </h1>
                <p className="text-sm text-muted-foreground" data-testid="text-welcome-description">
                  The financial intelligence platform built for gym owners. Get clarity on revenue, retention, and growth in minutes.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gym-name">Gym Name</Label>
                  <Input
                    id="gym-name"
                    placeholder="e.g. CrossFit Iron Valley"
                    value={gymName}
                    onChange={(e) => setGymName(e.target.value)}
                    data-testid="input-gym-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gym-location">Location (optional)</Label>
                  <Input
                    id="gym-location"
                    placeholder="e.g. Austin, TX"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    data-testid="input-gym-location"
                  />
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleStep1Continue}
                disabled={!gymName.trim()}
                data-testid="button-continue-step1"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2 text-center">
                <h1 className="text-2xl font-bold tracking-tight" data-testid="text-data-source-heading">
                  Connect Your Data
                </h1>
                <p className="text-sm text-muted-foreground">
                  Choose how you'd like to get started with your gym data.
                </p>
              </div>

              <div className="space-y-3">
                {dataSourceOptions.map((option) => (
                  <div
                    key={option.id}
                    className={`flex items-center gap-4 p-4 rounded-md border cursor-pointer transition-colors hover-elevate ${
                      dataSource === option.id
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                    onClick={() => setDataSource(option.id)}
                    data-testid={`card-source-${option.id}`}
                  >
                    <div className={`flex items-center justify-center w-10 h-10 rounded-md ${
                      dataSource === option.id ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      <option.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm" data-testid={`text-source-title-${option.id}`}>
                        {option.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      dataSource === option.id ? "border-primary" : "border-muted-foreground/30"
                    }`}>
                      {dataSource === option.id && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Button
                className="w-full"
                onClick={handleStep2Continue}
                disabled={!dataSource || createGymMutation.isPending}
                data-testid="button-continue-step2"
              >
                {createGymMutation.isPending ? "Setting up..." : "Continue"}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2 text-center">
                <h1 className="text-2xl font-bold tracking-tight" data-testid="text-tour-heading">
                  You're All Set
                </h1>
                <p className="text-sm text-muted-foreground">
                  Here's a quick look at what Iron Metrics can do for your gym.
                </p>
              </div>

              <div className="space-y-3">
                {tourFeatures.map((feature) => (
                  <div
                    key={feature.title}
                    className="flex items-center gap-4 p-4 rounded-md border border-border"
                    data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10 text-primary">
                      <feature.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{feature.title}</p>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                className="w-full"
                onClick={handleGoToDashboard}
                data-testid="button-go-to-dashboard"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
