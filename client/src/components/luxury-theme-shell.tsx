const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export function LuxuryThemeShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
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
