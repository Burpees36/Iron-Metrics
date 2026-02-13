import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Activity,
  BarChart3,
  Shield,
  TrendingUp,
  Users,
  ArrowRight,
  Target,
  Gauge,
  Radar,
  LineChart,
} from "lucide-react";

const performanceStack = [
  {
    icon: Gauge,
    title: "Retention Stability Index",
    abbr: "RSI",
    description:
      "A single score (1-100) that captures your monthly churn, early cancellation trends, and membership age distribution. Know your retention health at a glance.",
  },
  {
    icon: BarChart3,
    title: "Revenue Efficiency Score",
    abbr: "RES",
    description:
      "Measures revenue per member, tier distribution, and overall revenue optimization. Identifies opportunities to increase yield without increasing headcount.",
  },
  {
    icon: TrendingUp,
    title: "Lifetime Value Engine",
    abbr: "LTVE",
    description:
      "Calculates true average LTV and shows exactly how much annual revenue you gain from a 1% reduction in churn. Your most powerful financial lever.",
  },
  {
    icon: LineChart,
    title: "Coach Impact Index",
    abbr: "CII",
    description:
      "Identifies retention leverage by class type and attendance patterns. Not rating coaches \u2014 identifying where engagement creates stickiness.",
  },
  {
    icon: Radar,
    title: "Member Risk Radar",
    abbr: "Risk Radar",
    description:
      "Predictive layer flagging members with early risk signals. Suggested intervention windows so you can act before they cancel.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 h-14">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <span className="font-semibold text-base tracking-tight" data-testid="text-logo">
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-primary/10 text-primary text-sm font-medium">
                <Shield className="w-3.5 h-3.5" />
                Financial Intelligence for Gyms
              </div>
              <h1
                className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight"
                data-testid="text-hero-headline"
              >
                Retention is the
                <br />
                <span className="text-primary">heartbeat</span> of
                <br />
                your gym.
              </h1>
              <p className="text-muted-foreground text-base sm:text-lg max-w-lg leading-relaxed">
                Iron Metrics gives gym owners financial clarity, retention intelligence,
                and revenue stability. Simple. Actionable. Calm.
              </p>
              <p className="text-sm text-muted-foreground italic max-w-md">
                When your retention is stable, your impact becomes sustainable.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <a href="/api/login">
                  <Button size="lg" data-testid="button-get-started">
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </a>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="relative space-y-3">
                <MetricPreviewCard
                  label="Monthly Churn"
                  current="6.8%"
                  target="5%"
                  impact="+$42,000 annual revenue if reduced"
                />
                <MetricPreviewCard
                  label="Retention Stability Index"
                  current="72/100"
                  target="80/100"
                  impact="Moderate retention risk"
                />
                <MetricPreviewCard
                  label="Lifetime Value"
                  current="$2,180"
                  target="$3,000+"
                  impact="+$18,400/yr from 1% churn reduction"
                />
                <div className="p-3 rounded-md bg-muted/50">
                  <p className="text-xs font-medium text-muted-foreground mb-1">What This Means</p>
                  <p className="text-sm leading-relaxed">
                    Your current churn suggests revenue volatility over the next 6-12 months.
                  </p>
                  <p className="text-xs font-medium text-muted-foreground mt-2 mb-1">Recommended Action</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Prioritize outreach to members with declining attendance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 border-t">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-stack-title">
              The Iron Metrics Performance Stack
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Five core systems that translate your gym's data into clarity.
              Human insight + Data clarity. Not pure math.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {performanceStack.map((item) => (
              <Card key={item.abbr} className="hover-elevate">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{item.title}</h3>
                      <span className="text-xs text-muted-foreground font-mono">{item.abbr}</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            ))}
            <Card className="hover-elevate sm:col-span-2 lg:col-span-1">
              <CardContent className="p-5 space-y-3 flex flex-col justify-center h-full">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Target className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm">Every Metric, Translated</h3>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Every number includes what it means, why it matters, and what to do next.
                  You are not just reporting. You are translating.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 border-t">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Built for gym owners who
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Love coaching. Hate spreadsheets. Feel stress about revenue swings.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <EmotionCard
              icon={Users}
              quote="Finally... I understand my business."
            />
            <EmotionCard
              icon={Shield}
              quote="This isn't overwhelming."
            />
            <EmotionCard
              icon={Activity}
              quote="I can actually act on this."
            />
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 border-t">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Strong gyms create strong communities
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Strong communities create healthy lives.
            Financial stability protects both.
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
            <Activity className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">Iron Metrics</span>
          </div>
          <p>Built by someone who understands barbells and balance sheets.</p>
        </div>
      </footer>
    </div>
  );
}

function MetricPreviewCard({
  label,
  current,
  target,
  impact,
}: {
  label: string;
  current: string;
  target: string;
  impact: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
        </div>
        <div className="flex items-baseline gap-4">
          <span className="text-lg font-bold font-mono tracking-tight">{current}</span>
          <span className="text-xs text-muted-foreground">
            Target: {target}
          </span>
        </div>
        <p className="text-xs text-primary font-medium">{impact}</p>
      </CardContent>
    </Card>
  );
}

function EmotionCard({ icon: Icon, quote }: { icon: typeof Users; quote: string }) {
  return (
    <Card>
      <CardContent className="p-5 text-center space-y-3">
        <Icon className="w-6 h-6 text-primary mx-auto" />
        <p className="text-sm font-medium italic">"{quote}"</p>
      </CardContent>
    </Card>
  );
}
