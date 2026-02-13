import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { useState, useEffect, useRef } from "react";
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
  ArrowDown,
  ArrowUp,
  Minus,
} from "lucide-react";

interface GymScenario {
  name: string;
  rsi: { value: string; target: string; trend: string; interpretation: string };
  churn: { value: string; target: string; trend: string; interpretation: string };
  ltv: { churnFrom: string; churnTo: string; impact: string; direction: "up" | "down" | "flat" };
}

const gymScenarios: GymScenario[] = [
  {
    name: "Summit CrossFit",
    rsi: { value: "72", target: "80/100", trend: "90-day: +4 pts", interpretation: "Moderate retention risk. Early cancellation patterns suggest room for improvement." },
    churn: { value: "6.8", target: "5%", trend: "90-day: -0.3%", interpretation: "Above stability threshold. Revenue volatility risk over the next 6-12 months." },
    ltv: { churnFrom: "6.8%", churnTo: "5.0%", impact: "+$42,000/year unlocked", direction: "up" },
  },
  {
    name: "Iron Republic",
    rsi: { value: "88", target: "80/100", trend: "90-day: +2 pts", interpretation: "Strong retention. Your membership base is stable and growing sustainably." },
    churn: { value: "3.1", target: "5%", trend: "90-day: -0.5%", interpretation: "Below industry benchmark. Your retention engine is operating at high efficiency." },
    ltv: { churnFrom: "3.1%", churnTo: "2.0%", impact: "+$28,500/year unlocked", direction: "up" },
  },
  {
    name: "Coastal Barbell",
    rsi: { value: "54", target: "80/100", trend: "90-day: -6 pts", interpretation: "Stability drift detected. Rising churn and declining tenure signal intervention needed." },
    churn: { value: "9.2", target: "5%", trend: "90-day: +1.8%", interpretation: "Critical threshold. At this rate, 60% of your base turns over annually." },
    ltv: { churnFrom: "9.2%", churnTo: "5.0%", impact: "+$78,000/year unlocked", direction: "up" },
  },
  {
    name: "Forge Athletics",
    rsi: { value: "81", target: "80/100", trend: "90-day: +1 pt", interpretation: "Stable. Your gym just crossed the stability threshold. Maintain current retention practices." },
    churn: { value: "4.5", target: "5%", trend: "90-day: -0.2%", interpretation: "At target. Minor improvements here compound significantly over 12 months." },
    ltv: { churnFrom: "4.5%", churnTo: "3.0%", impact: "+$35,200/year unlocked", direction: "up" },
  },
  {
    name: "Peak Performance",
    rsi: { value: "41", target: "80/100", trend: "90-day: -11 pts", interpretation: "Instability risk. Multiple indicators declining. Immediate retention review recommended." },
    churn: { value: "12.4", target: "5%", trend: "90-day: +3.1%", interpretation: "Severe volatility. Revenue base eroding faster than acquisition can replace." },
    ltv: { churnFrom: "12.4%", churnTo: "5.0%", impact: "+$112,000/year unlocked", direction: "up" },
  },
];

const modules = [
  {
    icon: Gauge,
    title: "Retention Stability Index",
    description: "A single score that shows how steady your membership truly is. Your early warning before churn becomes a problem.",
  },
  {
    icon: BarChart3,
    title: "Revenue Stability Panel",
    description: "Know where volatility lives. See what's driving it. Know what to do next.",
  },
  {
    icon: Radar,
    title: "Member Risk Radar",
    description: "See how small retention improvements unlock real revenue. Make stability measurable.",
  },
  {
    icon: TrendingUp,
    title: "Lifetime Value Engine",
    description: "True average LTV, revenue unlocked per 1% churn improvement, and long-term projection scenarios. Makes the financial impact of retention tangible.",
  },
  {
    icon: LineChart,
    title: "Coach Impact Layer",
    description: "See which classes build long-term retention. Strengthen what keeps members coming back.",
  },
];

function useInterval(callback: () => void, delay: number) {
  const savedCallback = useRef(callback);
  useEffect(() => { savedCallback.current = callback; });
  useEffect(() => {
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function getRsiColor(val: number) {
  if (val >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (val >= 55) return "text-amber-600 dark:text-amber-400";
  if (val >= 35) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function getChurnColor(val: number) {
  if (val <= 5) return "text-emerald-600 dark:text-emerald-400";
  if (val <= 7) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function getRsiTrendIcon(trend: string) {
  if (trend.includes("+")) return <ArrowUp className="w-3 h-3 text-emerald-500 inline" />;
  if (trend.includes("-")) return <ArrowDown className="w-3 h-3 text-red-500 inline" />;
  return <Minus className="w-3 h-3 text-muted-foreground inline" />;
}

function getChurnTrendIcon(trend: string) {
  if (trend.includes("-")) return <ArrowDown className="w-3 h-3 text-emerald-500 inline" />;
  if (trend.includes("+")) return <ArrowUp className="w-3 h-3 text-red-500 inline" />;
  return <Minus className="w-3 h-3 text-muted-foreground inline" />;
}

export default function LandingPage() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const triggerTransition = (nextIdx: number) => {
    setTransitioning(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setActiveIdx(nextIdx);
      setTransitioning(false);
    }, 400);
  };

  useInterval(() => {
    triggerTransition((activeIdx + 1) % gymScenarios.length);
  }, 5000);

  const scenario = gymScenarios[activeIdx];

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 h-14">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <span className="font-semibold text-base tracking-tight" data-testid="text-logo">Iron Metrics</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a href="/api/login">
              <Button data-testid="button-login">Log In</Button>
            </a>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 sm:pt-40 sm:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-float-slow" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-primary/3 rounded-full blur-3xl animate-float-slower" />
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <p className="text-sm font-medium text-primary tracking-wide uppercase animate-fade-in-up">Stability operating system</p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight animate-fade-in-up animation-delay-100" data-testid="text-hero-headline">
                Retention is the
                <br />
                <span className="text-primary">heartbeat.</span>
                <br />
                Stability keeps it steady.
              </h1>
              <p className="text-muted-foreground text-base sm:text-lg max-w-md leading-relaxed animate-fade-in-up animation-delay-200">Know your numbers. Know your risks. Know your next move.</p>
              <div className="flex flex-wrap items-center gap-3 animate-fade-in-up animation-delay-300">
                <a href="/api/login">
                  <Button size="lg" data-testid="button-get-started">
                    Build Stability
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </a>
              </div>
              <p className="text-muted-foreground text-[13px] pt-1.5 pb-1.5 animate-fade-in-up animation-delay-400">Stable gyms build stronger communities</p>
            </div>

            <div className="relative hidden lg:block" data-testid="section-hero-cards">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest">
                  Live Example
                </p>
                <div className="flex items-center gap-1.5">
                  {gymScenarios.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => triggerTransition(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === activeIdx ? "bg-primary w-4" : "bg-muted-foreground/30"}`}
                      data-testid={`dot-scenario-${i}`}
                    />
                  ))}
                </div>
              </div>

              <div className={`transition-all duration-400 ${transitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
                <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2" data-testid="text-scenario-name">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {scenario.name}
                </p>
                <div className="space-y-3">
                  <Card data-testid="hero-card-rsi">
                    <CardContent className="p-4 space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Retention Stability Index</p>
                      <div className="flex items-baseline gap-3">
                        <span className={`text-2xl font-bold font-mono tracking-tight ${getRsiColor(parseInt(scenario.rsi.value))}`} data-testid="text-rsi-value">
                          {scenario.rsi.value}
                          <span className="text-sm font-normal text-muted-foreground">/100</span>
                        </span>
                        <span className="text-xs text-muted-foreground">Target: {scenario.rsi.target}</span>
                      </div>
                      <p className="text-xs font-medium font-mono flex items-center gap-1">
                        {getRsiTrendIcon(scenario.rsi.trend)}
                        <span className="text-primary">{scenario.rsi.trend}</span>
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{scenario.rsi.interpretation}</p>
                    </CardContent>
                  </Card>

                  <Card data-testid="hero-card-churn">
                    <CardContent className="p-4 space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Monthly Churn</p>
                      <div className="flex items-baseline gap-3">
                        <span className={`text-2xl font-bold font-mono tracking-tight ${getChurnColor(parseFloat(scenario.churn.value))}`} data-testid="text-churn-value">
                          {scenario.churn.value}
                          <span className="text-sm font-normal text-muted-foreground">%</span>
                        </span>
                        <span className="text-xs text-muted-foreground">Target: {scenario.churn.target}</span>
                      </div>
                      <p className="text-xs font-medium font-mono flex items-center gap-1">
                        {getChurnTrendIcon(scenario.churn.trend)}
                        <span className="text-primary">{scenario.churn.trend}</span>
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{scenario.churn.interpretation}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-muted/30" data-testid="hero-card-ltv">
                    <CardContent className="p-4 space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lifetime Value Impact</p>
                      <p className="text-sm leading-relaxed">
                        If churn decreases from {scenario.ltv.churnFrom} to {scenario.ltv.churnTo}:
                      </p>
                      <p className="font-bold font-mono text-primary text-xl" data-testid="text-ltv-impact">{scenario.ltv.impact}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 border-t">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-stack-title">The Stability Framework</h2>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">Five systems working together to protect your revenue.</p>
          </div>
          <div className="space-y-10">
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Layer 1 — Stability Core</p>
              <div className="grid sm:grid-cols-2 gap-6">
                <FadeInCard delay={0}><ModuleCard icon={modules[0].icon} title={modules[0].title} description={modules[0].description} /></FadeInCard>
                <FadeInCard delay={100}><ModuleCard icon={modules[1].icon} title={modules[1].title} description={modules[1].description} /></FadeInCard>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Layer 2 — Risk Control</p>
              <div className="grid sm:grid-cols-2 gap-6">
                <FadeInCard delay={0}><ModuleCard icon={modules[2].icon} title={modules[2].title} description={modules[2].description} /></FadeInCard>
                <FadeInCard delay={100}><ModuleCard icon={modules[4].icon} title={modules[4].title} description={modules[4].description} /></FadeInCard>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Layer 3 — Leverage</p>
              <div className="grid sm:grid-cols-2 gap-6">
                <FadeInCard delay={0}><ModuleCard icon={modules[3].icon} title={modules[3].title} description={modules[3].description} /></FadeInCard>
                <FadeInCard delay={100}><ModuleCard icon={Target} title="Every Metric, Translated" description="No raw numbers. No guessing. If it doesn't drive action, it doesn't exist." /></FadeInCard>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 border-t">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Built for gym owners who want clarity, not chaos.</h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>You built a community. You coach people through transformations. You should not have to guess whether your business will be here next year.</p>
              <p>Iron Metrics gives you the financial clarity to make confident decisions. Not more charts. Not more complexity. Stability, engineered.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 border-t">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-8">Strength Through Clarity</h2>
          <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <FadeInCard delay={0}><PrincipleCard icon={Shield} title="Reduce volatility" body="Know where revenue risk lives. Know how to reduce it." /></FadeInCard>
            <FadeInCard delay={100}><PrincipleCard icon={Users} title="Strengthen community" body="When retention improves, your community deepens. That is the real outcome." /></FadeInCard>
            <FadeInCard delay={200}><PrincipleCard icon={Activity} title="Lower stress" body="Clarity reduces anxiety. Know your numbers. Know your next move." /></FadeInCard>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 border-t">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <div className="max-w-lg mx-auto space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">The Iron Metrics Creed</h2>
            <p className="text-muted-foreground leading-relaxed">Strong gyms create strong communities.</p>
            <p className="text-muted-foreground leading-relaxed">Strong communities create healthy lives.</p>
            <p className="font-medium leading-relaxed">Financial stability protects both.</p>
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
          <p>The Stability Operating System for gyms.</p>
        </div>
      </footer>
    </div>
  );
}

function FadeInCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, inView } = useInView(0.1);
  return (
    <div
      ref={ref}
      className="transition-all duration-700 ease-out"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(20px)",
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
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
