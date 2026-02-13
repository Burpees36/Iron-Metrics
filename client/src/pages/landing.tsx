import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Activity,
  BarChart3,
  Shield,
  TrendingUp,
  Users,
  Zap,
  ArrowRight,
  Heart,
} from "lucide-react";

const features = [
  {
    icon: Activity,
    title: "Heartbeat Metrics",
    description:
      "Monthly pulse check on your gym's financial health. Active members, churn rate, MRR — all computed and cached for instant access.",
  },
  {
    icon: Shield,
    title: "Multi-Tenant Secure",
    description:
      "Every data point is tenant-scoped and hard-filtered. No data leakage. No cross-gym contamination. Built for scale from day one.",
  },
  {
    icon: TrendingUp,
    title: "Revenue Intelligence",
    description:
      "Transform messy membership exports into retention insights, churn visibility, and predictable growth indicators.",
  },
  {
    icon: Users,
    title: "Member Management",
    description:
      "Import members via CSV, track status changes, and see your roster at a glance. Idempotent imports mean no duplicate headaches.",
  },
  {
    icon: BarChart3,
    title: "Churn Visibility",
    description:
      "Rolling 3-month churn, monthly cancellation tracking, and early warning signals so you can act before revenue dips.",
  },
  {
    icon: Zap,
    title: "Performance-First",
    description:
      "Cache-driven architecture. No heavy request-path computation. Sub-500ms responses. Infrastructure-grade thinking, not hobby SaaS.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 h-14">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary fill-primary" />
            <span className="font-serif text-lg font-bold tracking-tight" data-testid="text-logo">
              Iron Metrics
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a href="/api/login">
              <Button data-testid="button-login">Log In</Button>
            </a>
          </div>
        </div>
      </nav>

      <section className="pt-28 pb-16 sm:pt-36 sm:pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Activity className="w-3.5 h-3.5" />
                Financial Intelligence for Gyms
              </div>
              <h1
                className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight"
                data-testid="text-hero-headline"
              >
                Retention is the
                <br />
                <span className="text-primary">heartbeat</span> of
                <br />
                your gym.
              </h1>
              <p className="text-muted-foreground text-lg max-w-lg leading-relaxed">
                Iron Metrics gives gym owners financial clarity, retention intelligence,
                and revenue stability. Stop guessing. Start knowing.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <a href="/api/login">
                  <Button size="lg" data-testid="button-get-started">
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Free to start
                </span>
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> No credit card required
                </span>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10 rounded-md" />
              <div className="relative p-8 space-y-4">
                <MetricPreviewCard
                  label="Monthly Recurring Revenue"
                  value="$48,250"
                  change="+4.2%"
                  positive
                />
                <MetricPreviewCard
                  label="Active Members"
                  value="321"
                  change="+12"
                  positive
                />
                <MetricPreviewCard
                  label="Monthly Churn Rate"
                  value="3.1%"
                  change="-0.8%"
                  positive
                />
                <MetricPreviewCard
                  label="Avg. Revenue / Member"
                  value="$150.31"
                  change="+$2.10"
                  positive
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 border-t">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 space-y-3">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight" data-testid="text-features-title">
              Built for gym owners who care
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-lg">
              No hype. No fluff. Just the financial clarity your gym deserves.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => (
              <Card key={feature.title} className="hover-elevate">
                <CardContent className="p-6 space-y-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 border-t">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight">
            Strong gyms create strong communities
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto leading-relaxed">
            Financial stability protects the impact your gym has on people's lives.
            Iron Metrics is the operating system behind that stability.
          </p>
          <a href="/api/login">
            <Button size="lg" data-testid="button-cta-bottom">
              Start Your Free Account
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </a>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-primary fill-primary" />
            <span className="font-serif font-semibold text-foreground">Iron Metrics</span>
          </div>
          <p>Built by someone who understands barbells and balance sheets.</p>
        </div>
      </footer>
    </div>
  );
}

function MetricPreviewCard({
  label,
  value,
  change,
  positive,
}: {
  label: string;
  value: string;
  change: string;
  positive: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold font-mono tracking-tight">{value}</p>
        </div>
        <span
          className={`text-sm font-medium font-mono ${
            positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {change}
        </span>
      </CardContent>
    </Card>
  );
}
