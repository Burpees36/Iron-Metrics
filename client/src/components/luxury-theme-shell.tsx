import { useMemo } from "react";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Particle {
  x: number;
  y: number;
  size: number;
  blur: number;
  opacity: number;
  type: "emerald" | "silver";
  driftDuration: number;
  driftX: number;
  driftY: number;
  delay: number;
}

function generateParticles(seed: number): Particle[] {
  const rng = mulberry32(seed);
  const particles: Particle[] = [];

  for (let i = 0; i < 6; i++) {
    particles.push({
      x: rng() * 100,
      y: rng() * 100,
      size: 16 + rng() * 18,
      blur: 10 + rng() * 10,
      opacity: 0.06 + rng() * 0.08,
      type: "emerald",
      driftDuration: 30 + rng() * 25,
      driftX: 8 + rng() * 12,
      driftY: 4 + rng() * 8,
      delay: rng() * -30,
    });
  }

  for (let i = 0; i < 28; i++) {
    particles.push({
      x: rng() * 100,
      y: rng() * 100,
      size: 1 + rng() * 2,
      blur: 0,
      opacity: 0.12 + rng() * 0.2,
      type: "silver",
      driftDuration: 40 + rng() * 30,
      driftX: 3 + rng() * 6,
      driftY: 2 + rng() * 4,
      delay: rng() * -40,
    });
  }

  return particles;
}

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const SEED = 42;

export function LuxuryThemeShell({ children }: { children: React.ReactNode }) {
  const particles = useMemo(() => generateParticles(SEED), []);

  return (
    <div className="relative min-h-screen">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 0, contain: "strict" }}
        aria-hidden="true"
      >
        {particles.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full luxury-particle-drift"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor:
                p.type === "emerald"
                  ? `hsl(var(--primary) / ${p.opacity})`
                  : `hsl(var(--silver) / ${p.opacity})`,
              filter: p.blur > 0 ? `blur(${p.blur}px)` : undefined,
              animationDuration: `${p.driftDuration}s`,
              animationDelay: `${p.delay}s`,
              willChange: "transform",
              ["--drift-x" as string]: `${p.driftX}px`,
              ["--drift-y" as string]: `${p.driftY}px`,
            }}
          />
        ))}
      </div>

      <div
        className="fixed inset-0 pointer-events-none dark:block hidden"
        style={{
          zIndex: 1,
          background: [
            "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 40%, hsl(var(--background) / 0.7) 100%)",
            "radial-gradient(ellipse 60% 50% at 15% 20%, hsl(var(--primary) / 0.06) 0%, transparent 70%)",
            "radial-gradient(ellipse 50% 60% at 85% 40%, hsl(var(--silver) / 0.04) 0%, transparent 70%)",
          ].join(", "),
          boxShadow: "inset 0 0 200px 40px rgba(0, 0, 0, 0.55)",
        }}
        aria-hidden="true"
      />

      <div
        className="fixed inset-0 pointer-events-none dark:hidden block"
        style={{
          zIndex: 1,
          background: [
            "radial-gradient(ellipse 65% 55% at 50% 50%, transparent 35%, hsl(var(--background) / 0.6) 100%)",
            "radial-gradient(ellipse 60% 50% at 15% 20%, hsl(var(--primary) / 0.04) 0%, transparent 70%)",
            "radial-gradient(ellipse 50% 60% at 85% 40%, hsl(var(--silver) / 0.03) 0%, transparent 70%)",
          ].join(", "),
          boxShadow: "inset 0 0 180px 30px rgba(0, 0, 0, 0.12)",
        }}
        aria-hidden="true"
      />

      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 2,
          backgroundImage: GRAIN_SVG,
          backgroundSize: "128px 128px",
          mixBlendMode: "overlay",
          opacity: 0.065,
        }}
        aria-hidden="true"
      />

      <div className="relative" style={{ zIndex: 3 }}>
        {children}
      </div>
    </div>
  );
}
