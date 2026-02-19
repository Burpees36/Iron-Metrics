import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { useState, useEffect, useRef } from "react";
import {
  Activity,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
} from "lucide-react";

interface GymScenario {
  name: string;
  members: number;
  rsi: { value: string; level: string };
  churn: { value: string; trend: string };
  atRisk: number;
  revenueProtected: string;
  verdict: string;
}

const gymScenarios: GymScenario[] = [
  {
    name: "Summit CrossFit",
    members: 142,
    rsi: { value: "72", level: "moderate" },
    churn: { value: "6.8%", trend: "-0.3%" },
    atRisk: 8,
    revenueProtected: "$3,200",
    verdict: "Moderate \u2014 intervention window open",
  },
  {
    name: "Iron Republic",
    members: 98,
    rsi: { value: "88", level: "strong" },
    churn: { value: "3.1%", trend: "-0.5%" },
    atRisk: 2,
    revenueProtected: "$890",
    verdict: "Strong \u2014 maintain current trajectory",
  },
  {
    name: "Coastal Barbell",
    members: 210,
    rsi: { value: "54", level: "fragile" },
    churn: { value: "9.2%", trend: "+1.8%" },
    atRisk: 19,
    revenueProtected: "$7,400",
    verdict: "Fragile \u2014 immediate action required",
  },
  {
    name: "Forge Athletics",
    members: 76,
    rsi: { value: "81", level: "strong" },
    churn: { value: "4.5%", trend: "-0.2%" },
    atRisk: 3,
    revenueProtected: "$1,100",
    verdict: "Strong \u2014 stability threshold crossed",
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

function getVerdictColor(level: string) {
  if (level === "strong") return "text-primary";
  if (level === "moderate") return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
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
    <div className="min-h-screen">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/70 border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 h-14">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <span className="font-semibold text-base tracking-tight" data-testid="text-logo">Iron Metrics</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a href="/api/login">
              <Button
                data-testid="button-login"
              >
                Log In
              </Button>
            </a>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 sm:pt-40 sm:pb-28 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <span
                className="inline-block text-xs font-bold text-primary tracking-widest uppercase bg-primary/10 border border-primary/25 rounded-full px-4 py-1.5 animate-fade-in-up"
                data-testid="text-subtitle"
              >
                The Stability Command Center
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] animate-fade-in-up animation-delay-100" data-testid="text-hero-headline">
                Stop guessing.
                <br />
                <span className="text-primary">Start knowing.</span>
              </h1>
              <div className="space-y-1 text-muted-foreground text-base sm:text-lg max-w-md leading-relaxed animate-fade-in-up animation-delay-200" data-testid="text-hero-copy">
                <p>Iron Metrics turns your member data into retention intelligence, churn predictions, and ranked interventions - so you know exactly what to do next.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 animate-fade-in-up animation-delay-300">
                <a href="/api/login">
                  <Button
                    size="lg"
                    className="pl-[32px] pr-[32px] pt-[16px] pb-[16px]"
                    data-testid="button-get-started"
                  >
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground animate-fade-in-up animation-delay-400">
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Import your CSV</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> See risks instantly</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Act with confidence</span>
              </div>
            </div>

            <div className="relative hidden lg:block" data-testid="section-hero-cards">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest">
                  Live Intelligence Preview
                </p>
                <div className="flex items-center gap-1.5">
                  {gymScenarios.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => triggerTransition(i)}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${i === activeIdx ? "bg-primary w-4" : "bg-muted-foreground/30"}`}
                      data-testid={`dot-scenario-${i}`}
                    />
                  ))}
                </div>
              </div>

              <div className={`transition-all duration-400 ${transitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
                <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2" data-testid="text-scenario-name">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {scenario.name} \u2014 {scenario.members} members
                </p>
                <div className="space-y-3">
                  <Card className="bg-card/80 backdrop-blur-sm" data-testid="hero-card-stability">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-xs text-muted-foreground font-medium">Stability Verdict</p>
                        <Badge variant="outline" className={`text-[10px] ${getVerdictColor(scenario.rsi.level)}`}>
                          RSI: {scenario.rsi.value}/100
                        </Badge>
                      </div>
                      <p className={`text-sm font-semibold ${getVerdictColor(scenario.rsi.level)}`} data-testid="text-verdict">
                        {scenario.verdict}
                      </p>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-700 ${parseInt(scenario.rsi.value) >= 75 ? "bg-primary" : parseInt(scenario.rsi.value) >= 55 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${scenario.rsi.value}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-3 gap-3">
                    <Card className="bg-card/80 backdrop-blur-sm">
                      <CardContent className="p-3 text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">Churn</p>
                        <p className="text-base font-bold font-mono">{scenario.churn.value}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {scenario.churn.trend.startsWith("-") ? (
                            <span className="text-primary flex items-center justify-center gap-0.5"><ArrowDown className="w-2.5 h-2.5" />{scenario.churn.trend}</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400 flex items-center justify-center gap-0.5"><ArrowUp className="w-2.5 h-2.5" />{scenario.churn.trend}</span>
                          )}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-card/80 backdrop-blur-sm">
                      <CardContent className="p-3 text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">At Risk</p>
                        <p className={`text-base font-bold font-mono ${scenario.atRisk > 10 ? "text-red-600 dark:text-red-400" : scenario.atRisk > 5 ? "text-amber-600 dark:text-amber-400" : "text-primary"}`}>
                          {scenario.atRisk}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">members</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-card/80 backdrop-blur-sm">
                      <CardContent className="p-3 text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">Protectable</p>
                        <p className="text-base font-bold font-mono text-primary">{scenario.revenueProtected}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">/mo revenue</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 border-t border-border/50" data-testid="section-outcomes">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center" data-testid="text-outcomes-title">Know the risk.
            Know the dollars.
            Know the move.</h2>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">Iron Metrics turns retention into a decision system \u2014 not another dashboard</p>
          </div>

          <div className="space-y-6">
            <FadeInCard delay={0}>
              <OutcomeRow
                number="1"
                title="Identify the risk"
                description="Every member gets a live risk score based on tenure, attendance patterns, payment behavior, and engagement signals. You see exactly who needs attention -- and how urgent it is."
              />
            </FadeInCard>
            <FadeInCard delay={100}>
              <OutcomeRow
                number="2"
                title="Know what it's costing you"
                description="Revenue at risk. Lifetime value remaining. Scenario projections. We translate churn into dollars so you understand the real financial impact."
              />
            </FadeInCard>
            <FadeInCard delay={200}>
              <OutcomeRow
                number="3"
                title="Take the next best step"
                description="Every intervention is ranked by expected revenue impact and urgency. One clear priority surfaces automatically. No noise. No guessing."
              />
            </FadeInCard>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 border-t border-border/50" data-testid="section-how-it-works">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            <FadeInCard delay={0}>
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <span className="text-sm font-bold text-primary">1</span>
                </div>
                <h3 className="font-semibold text-sm">Connect Your Data</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Upload a CSV from any gym management system. Columns are auto-detected.</p>
              </div>
            </FadeInCard>
            <FadeInCard delay={100}>
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <span className="text-sm font-bold text-primary">2</span>
                </div>
                <h3 className="font-semibold text-sm">Reveal the Risk</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">We calculate your Retention Stability Index, classify every member by risk level, and model revenue scenarios.</p>
              </div>
            </FadeInCard>
            <FadeInCard delay={200}>
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <span className="text-sm font-bold text-primary">3</span>
                </div>
                <h3 className="font-semibold text-sm">Act With Precision</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Iron Metrics ranks interventions by revenue impact and urgency.
                You execute. Track outcomes. The system learns what works.</p>
              </div>
            </FadeInCard>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 border-t border-border/50" data-testid="section-trust">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Strong gyms create strong communities.
            Strong communities create healthier lives.</h2>
            <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">Iron Metrics gives you financial clarity so your coaching, your culture, and your community can keep growing.</p>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, transparent 0%, hsl(var(--primary) / 0.06) 50%, hsl(var(--primary) / 0.10) 100%)" }} />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8 relative">
          <div className="max-w-lg mx-auto space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Your gym's stability is in your hands.</h2>
            <p className="text-muted-foreground leading-relaxed">Import your members. See your risks. Act on what matters.</p>
          </div>
          <a href="/api/login">
            <Button
              size="lg"
              className="pt-[12px] pb-[12px] mt-[6px] mb-[6px]"
              data-testid="button-cta-bottom"
            >
              Get Started
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </a>
        </div>
      </section>

      <footer className="border-t border-border/50 py-10">
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

function OutcomeRow({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-5">
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-sm font-bold text-primary">{number}</span>
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
