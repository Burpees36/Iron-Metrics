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
      "Single composite score (1-100) synthesizing churn rate, early cancellation trends, membership age distribution, and attendance decay. Your north star for retention health.",
  },
  {
    icon: BarChart3,
    title: "Revenue Stability Panel",
    description:
      "Monthly churn, net member growth, revenue per member, tier distribution, and volatility indicators. Every number includes what it means, why it matters, and what to do next.",
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
      "True average LTV, revenue unlocked per 1% churn improvement, and long-term projection scenarios. Makes the financial impact of retention tangible.",
  },
  {
    icon: LineChart,
    title: "Coach Impact Layer",
    description:
      "Class attendance retention, engagement stickiness by class type, and time-block patterns. Not coach ranking. Retention leverage insight.",
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
                Stability protects your peace of mind.
              </h1>
              <p className="text-muted-foreground text-base sm:text-lg max-w-md leading-relaxed">Iron Metrics is the Stability Operating System for gyms.
              We reduce financial stress so you can focus on your members.</p>
              <div className="flex flex-wrap items-center gap-3">
                <a href="/api/login">
                  <Button size="lg" data-testid="button-get-started">
                    Build Stability
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </a>
              </div>
              <p className="text-muted-foreground ml-[0px] mr-[0px] mt-[0px] mb-[0px] text-left text-[13px] pt-[6px] pb-[6px]">Clarity reduces anxiety. Stability restores focus.</p>
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
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-stack-title">
              Core Modules
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Five systems that translate your data into decisions.
              Not a reporting tool. A decision engine.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((item) => (
              <Card key={item.title} className="hover-elevate">
                <CardContent className="p-6 space-y-4">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            ))}
            <Card className="hover-elevate">
              <CardContent className="p-6 space-y-4 flex flex-col justify-center h-full">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm">Every Metric, Translated</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Value. Target. 90-day trend. Interpretation. Recommended action.
                  If it does not drive action, it is not shown.
                </p>
              </CardContent>
            </Card>
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
          <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <PrincipleCard
              icon={Shield}
              title="Reduce volatility"
              body="Understand exactly where revenue risk lives and what to do about it."
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
          <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Strong gyms create strong communities.
            Strong communities create healthy lives.
            Financial stability protects both.
          </p>
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
