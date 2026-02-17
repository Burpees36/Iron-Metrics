import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Brain,
  CheckCircle2,
  Zap,
  FileText,
  AlertTriangle,
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
    revenueProtected: "$3,200/mo",
    verdict: "Moderate — intervention window open",
  },
  {
    name: "Iron Republic",
    members: 98,
    rsi: { value: "88", level: "strong" },
    churn: { value: "3.1%", trend: "-0.5%" },
    atRisk: 2,
    revenueProtected: "$890/mo",
    verdict: "Strong — maintain current trajectory",
  },
  {
    name: "Coastal Barbell",
    members: 210,
    rsi: { value: "54", level: "fragile" },
    churn: { value: "9.2%", trend: "+1.8%" },
    atRisk: 19,
    revenueProtected: "$7,400/mo",
    verdict: "Fragile — immediate action required",
  },
  {
    name: "Forge Athletics",
    members: 76,
    rsi: { value: "81", level: "strong" },
    churn: { value: "4.5%", trend: "-0.2%" },
    atRisk: 3,
    revenueProtected: "$1,100/mo",
    verdict: "Strong — just crossed stability threshold",
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
  if (level === "strong") return "text-emerald-600 dark:text-emerald-400";
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
              <p className="text-sm font-medium text-primary tracking-wide uppercase animate-fade-in-up">The Stability Command Center</p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight animate-fade-in-up animation-delay-100" data-testid="text-hero-headline">
                Stop guessing.
                <br />
                Start <span className="text-primary">knowing.</span>
              </h1>
              <p className="text-muted-foreground text-base sm:text-lg max-w-md leading-relaxed animate-fade-in-up animation-delay-200">
                Iron Metrics turns your member data into retention intelligence, churn predictions, and ranked interventions — so you know exactly what to do next.
              </p>
              <div className="flex flex-wrap items-center gap-3 animate-fade-in-up animation-delay-300">
                <a href="/api/login">
                  <Button size="lg" data-testid="button-get-started">
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground animate-fade-in-up animation-delay-400">
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Import your CSV</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> See risks instantly</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Act with confidence</span>
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
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === activeIdx ? "bg-primary w-4" : "bg-muted-foreground/30"}`}
                      data-testid={`dot-scenario-${i}`}
                    />
                  ))}
                </div>
              </div>

              <div className={`transition-all duration-400 ${transitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
                <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2" data-testid="text-scenario-name">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {scenario.name} — {scenario.members} members
                </p>
                <div className="space-y-3">
                  <Card data-testid="hero-card-stability">
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
                          className={`h-2 rounded-full transition-all duration-700 ${parseInt(scenario.rsi.value) >= 75 ? "bg-emerald-500" : parseInt(scenario.rsi.value) >= 55 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${scenario.rsi.value}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-3 gap-3">
                    <Card>
                      <CardContent className="p-3 text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">Churn</p>
                        <p className="text-base font-bold font-mono">{scenario.churn.value}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {scenario.churn.trend.startsWith("-") ? (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-0.5"><ArrowDown className="w-2.5 h-2.5" />{scenario.churn.trend}</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400 flex items-center justify-center gap-0.5"><ArrowUp className="w-2.5 h-2.5" />{scenario.churn.trend}</span>
                          )}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">At Risk</p>
                        <p className={`text-base font-bold font-mono ${scenario.atRisk > 10 ? "text-red-600 dark:text-red-400" : scenario.atRisk > 5 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {scenario.atRisk}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">members</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">Protectable</p>
                        <p className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">{scenario.revenueProtected}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">revenue</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 border-t" data-testid="section-what-it-does">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-how-title">What Iron Metrics Does</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Upload your member data. Iron Metrics analyzes retention patterns, predicts who's likely to leave, and tells you exactly what to do — ranked by financial impact.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            <FadeInCard delay={0}>
              <Card className="h-full">
                <CardContent className="p-6 space-y-4">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm">Import your member data</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Upload a CSV from Wodify, PushPress, Zen Planner, or any system. Iron Metrics auto-detects your columns and validates every row.
                  </p>
                </CardContent>
              </Card>
            </FadeInCard>
            <FadeInCard delay={100}>
              <Card className="h-full">
                <CardContent className="p-6 space-y-4">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <Brain className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm">Get predictive intelligence</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Member-level churn predictions, risk classification, retention stability scoring, and revenue scenario modeling — all computed from your real data.
                  </p>
                </CardContent>
              </Card>
            </FadeInCard>
            <FadeInCard delay={200}>
              <Card className="h-full">
                <CardContent className="p-6 space-y-4">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <Target className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm">Act on ranked recommendations</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Every recommendation is scored by expected revenue impact, confidence, and urgency. Check off tasks and track what actually works over time.
                  </p>
                </CardContent>
              </Card>
            </FadeInCard>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 border-t" data-testid="section-intelligence-stack">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">The Intelligence Stack</h2>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">Six systems working together to protect your revenue and strengthen your community.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FadeInCard delay={0}><ModuleCard icon={Gauge} title="Retention Stability Index" description="One score that tells you how stable your gym really is. Your north star for retention health." /></FadeInCard>
            <FadeInCard delay={80}><ModuleCard icon={BarChart3} title="Revenue Stability Panel" description="Monthly churn, net growth, revenue per member, and volatility indicators — all with 90-day trends." /></FadeInCard>
            <FadeInCard delay={160}><ModuleCard icon={Radar} title="Member Risk Radar" description="Every member classified by risk level with personalized intervention recommendations and urgency scores." /></FadeInCard>
            <FadeInCard delay={240}><ModuleCard icon={TrendingUp} title="Lifetime Value Engine" description="True LTV calculations and scenario modeling. See exactly what a 1% churn improvement is worth." /></FadeInCard>
            <FadeInCard delay={320}><ModuleCard icon={Zap} title="Ranked Interventions" description="Recommendations scored by revenue impact, confidence, and urgency. The top action surfaces automatically." /></FadeInCard>
            <FadeInCard delay={400}><ModuleCard icon={LineChart} title="Learning Loop" description="Track which actions you take. Iron Metrics evaluates outcomes at 30/60/90 days and learns what works." /></FadeInCard>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 border-t" data-testid="section-how-scoring-works">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Every recommendation is mathematically scored</h2>
              <p className="text-muted-foreground leading-relaxed">
                No vague advice. Every action Iron Metrics suggests comes with a score based on three factors:
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Expected Revenue Impact</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">How many members it affects, their remaining LTV, and the estimated churn reduction.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Shield className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Confidence Weight</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">Based on your data quality — how many months of data, how many members, and how clear the retention signals are.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Urgency Factor</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">Time-sensitive actions score higher. Context multipliers adjust for seasonal patterns and churn acceleration.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Card>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">How a score is built</p>
                  </div>
                  <div className="space-y-2 font-mono text-sm">
                    <div className="flex items-center justify-between gap-2 py-1.5 border-b">
                      <span className="text-muted-foreground">churnReduction</span>
                      <span>0.8%</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 py-1.5 border-b">
                      <span className="text-muted-foreground">membersAffected</span>
                      <span>12</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 py-1.5 border-b">
                      <span className="text-muted-foreground">avgLtvRemaining</span>
                      <span>$4,200</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 py-1.5 border-b">
                      <span className="text-muted-foreground">revenueImpact</span>
                      <span className="text-emerald-600 dark:text-emerald-400">$403/mo</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 py-1.5 border-b">
                      <span className="text-muted-foreground">confidence</span>
                      <span>0.85</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 py-1.5">
                      <span className="text-muted-foreground">urgency</span>
                      <span>1.2x</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-semibold">interventionScore</span>
                    <span className="text-lg font-bold font-mono text-primary">411</span>
                  </div>
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground text-center leading-relaxed">Higher score = higher priority. The top-scored action becomes your Focus Recommendation.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 border-t">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Built for gym owners who want clarity, not chaos.</h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>You built a community. You coach people through transformations every day. You shouldn't have to guess whether your business will be here next year.</p>
              <p>Iron Metrics gives you the financial clarity to make confident decisions. Not more charts. Not more complexity. Actionable intelligence that tells you what to do, why it matters, and what it's worth.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 border-t">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-8">Strength Through Clarity</h2>
          <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <FadeInCard delay={0}><PrincipleCard icon={Shield} title="Reduce volatility" body="Know where revenue risk lives. Know how to reduce it. See the dollar impact of every action." /></FadeInCard>
            <FadeInCard delay={100}><PrincipleCard icon={Users} title="Strengthen community" body="When retention improves, your community deepens. That's the real outcome — and Iron Metrics makes it measurable." /></FadeInCard>
            <FadeInCard delay={200}><PrincipleCard icon={Activity} title="Lower stress" body="Clarity reduces anxiety. Know your numbers. Know your risks. Know your next move." /></FadeInCard>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 border-t">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <div className="max-w-lg mx-auto space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Your gym's stability is in your hands.</h2>
            <p className="text-muted-foreground leading-relaxed">Import your members. See your risks. Act on what matters.</p>
          </div>
          <a href="/api/login">
            <Button size="lg" data-testid="button-cta-bottom">
              Get Started
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
    <Card className="hover-elevate h-full">
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
