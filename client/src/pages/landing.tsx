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

const modules = [
  {
    icon: Gauge,
    title: "Retention Stability Index",
    description:
      "A single score that shows how steady your membership truly is. Your early warning before churn becomes a problem.",
  },
  {
    icon: BarChart3,
    title: "Revenue Stability Panel",
    description:
      "Know where volatility lives. See what's driving it. Know what to do next.",
  },
  {
    icon: Radar,
    title: "Member Risk Radar",
    description:
      "Predictive early-warning system. Flags members by risk tier with intervention window recommendations and outreach priority. Proactive, not reactive.",
  },
  {
    icon: TrendingUp,
    title: "Lifetime Value Engine",
    description:
      "See how small retention improvements unlock real revenue. Make stability measurable.",
  },
  {
    icon: LineChart,
    title: "Coach Impact Layer",
    description:
      "See which classes build long-term retention. Strengthen what keeps members coming back.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 h-14">
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
      <section className="pt-32 pb-20 sm:pt-40 sm:pb-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <p className="text-sm font-medium text-primary tracking-wide uppercase">Stability operating system
</p>
              <h1
                className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight"
                data-testid="text-hero-headline"
              >
                Retention is the
                <br />
                <span className="text-primary">heartbeat.</span>
                <br />
                Stability keeps it steady.
              </h1>
              <p className="text-muted-foreground text-base sm:text-lg max-w-md leading-relaxed">Know your numbers. Know your risks. Know your next move.</p>
              <div className="flex flex-wrap items-center gap-3">
                <a href="/api/login">
                  <Button size="lg" data-testid="button-get-started">
                    Build Stability
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </a>
              </div>
              <p className="text-muted-foreground ml-[0px] mr-[0px] mt-[0px] mb-[0px] text-left text-[13px] pt-[6px] pb-[6px]">Stable gyms build 
              stronger communities</p>
            </div>

            <div className="relative hidden lg:block">
              <div className="relative space-y-4">
                <MetricBlock
                  label="Retention Stability Index"
                  current="72"
                  suffix="/100"
                  target="80/100"
                  trend="90-day: +4 pts"
                  interpretation="Moderate retention risk. Early cancellation patterns suggest room for improvement."
                />
                <MetricBlock
                  label="Monthly Churn"
                  current="6.8"
                  suffix="%"
                  target="5%"
                  trend="90-day: -0.3%"
                  interpretation="Above stability threshold. Revenue volatility risk over the next 6-12 months."
                />
                <Card className="bg-muted/30">
                  <CardContent className="p-4 space-y-3 text-[18px]">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Lifetime Value Impact
                    </p>
                    <p className="text-sm leading-relaxed">
                      If churn decreases from 6.8% to 5.0%:
                    </p>
                    <p className="font-bold font-mono text-primary text-[22px]">
                      +$42,000/year unlocked
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="py-20 sm:py-28 border-t">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-stack-title">The  Stability Framework</h2>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">Five systems working together to protect your revenue.</p>
          </div>
          <div className="space-y-10">
            <div className="space-y-3">
              <p className="text-muted-foreground uppercase tracking-widest text-[13px] font-medium">Layer 1 — Stability Core</p>
              <div className="grid sm:grid-cols-2 gap-6">
                <ModuleCard icon={modules[0].icon} title={modules[0].title} description={modules[0].description} />
                <ModuleCard icon={modules[1].icon} title={modules[1].title} description={modules[1].description} />
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-muted-foreground uppercase tracking-widest text-[13px] font-black">Layer 2 — Risk Control</p>
              <div className="grid sm:grid-cols-2 gap-6">
                <ModuleCard icon={modules[2].icon} title={modules[2].title} description={modules[2].description} />
                <ModuleCard icon={modules[4].icon} title={modules[4].title} description={modules[4].description} />
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-muted-foreground uppercase tracking-widest text-[13px] font-black">Layer 3 — Leverage</p>
              <div className="grid sm:grid-cols-2 gap-6">
                <ModuleCard icon={modules[3].icon} title={modules[3].title} description={modules[3].description} />
                <ModuleCard icon={Target} title="Every Metric, Translated" description="No raw numbers. No guessing. If it doesn't drive action, it doesn't exist." />
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="py-20 sm:py-28 border-t">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Built for gym owners who care about longevity.
            </h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                You built a community. You coach people through transformations.
                You should not have to guess whether your business will be here next year.
              </p>
              <p>
                Iron Metrics gives you the financial clarity to make confident decisions.
                Not more charts. Not more complexity. Stability, engineered.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="py-20 sm:py-28 border-t">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-xl sm:text-2xl font-bold tracking-tight mb-10">Stability changes how you lead.</h2>
          <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <PrincipleCard
              icon={Shield}
              title="Reduce volatility"
              body="Know where revenue risk lives. Know how to reduce it."
            />
            <PrincipleCard
              icon={Users}
              title="Strengthen community"
              body="When retention improves, your community deepens. That is the real outcome."
            />
            <PrincipleCard
              icon={Activity}
              title="Lower stress"
              body="Clarity reduces anxiety. Know your numbers. Know your next move."
            />
          </div>
        </div>
      </section>
      <section className="py-20 sm:py-28 border-t">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Stability is strategy.
          </h2>
          <div className="text-muted-foreground max-w-lg mx-auto leading-relaxed space-y-2">
            <p>Strong gyms create strong communities.</p>
            <p>Strong communities create healthy lives.</p>
            <p>Financial stability protects both.</p>
          </div>
          <a href="/api/login">
            <Button size="lg" data-testid="button-cta-bottom">
              Build Stability
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </a>
        </div>
      </section>
      <footer className="border-t py-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">Iron Metrics</span>
          </div>
          <p>The Stability Command Center for gyms.</p>
        </div>
      </footer>
    </div>
  );
}

function MetricBlock({
  label,
  current,
  suffix,
  target,
  trend,
  interpretation,
}: {
  label: string;
  current: string;
  suffix: string;
  target: string;
  trend: string;
  interpretation: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold font-mono tracking-tight">
            {current}
            <span className="text-sm font-normal text-muted-foreground">{suffix}</span>
          </span>
          <span className="text-xs text-muted-foreground">Target: {target}</span>
        </div>
        <p className="text-xs text-primary font-medium font-mono">{trend}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{interpretation}</p>
      </CardContent>
    </Card>
  );
}

function ModuleCard({ icon: Icon, title, description }: { icon: typeof Gauge; title: string; description: string }) {
  return (
    <Card className="hover-elevate">
      <CardContent className="p-6 space-y-4">
        <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

function PrincipleCard({ icon: Icon, title, body }: { icon: typeof Shield; title: string; body: string }) {
  return (
    <Card>
      <CardContent className="p-6 space-y-3">
        <Icon className="w-6 h-6 text-primary" />
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
      </CardContent>
    </Card>
  );
}
