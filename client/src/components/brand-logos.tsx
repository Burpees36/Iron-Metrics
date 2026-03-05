export function IronMetricsLogo({ className = "", variant = "default" }: { className?: string; variant?: "default" | "white" | "dark" }) {
  const colors = {
    default: {
      primary: "#10b981",
      secondary: "#059669",
      text: "#111827",
    },
    white: {
      primary: "#ffffff",
      secondary: "#f3f4f6",
      text: "#ffffff",
    },
    dark: {
      primary: "#10b981",
      secondary: "#059669",
      text: "#ffffff",
    }
  };

  const c = colors[variant];

  return (
    <svg className={className} viewBox="0 0 240 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(0, 10)">
        <rect x="0" y="10" width="12" height="20" rx="2" fill={c.primary} />
        <rect x="12" y="18" width="16" height="4" rx="2" fill={c.primary} />
        <rect x="28" y="10" width="12" height="20" rx="2" fill={c.primary} />
        <rect x="16" y="8" width="2.5" height="10" rx="1.25" fill={c.secondary} opacity="0.4" />
        <rect x="20" y="4" width="2.5" height="14" rx="1.25" fill={c.secondary} opacity="0.6" />
        <rect x="24" y="0" width="2.5" height="18" rx="1.25" fill={c.primary} />
      </g>
      <g transform="translate(52, 30)">
        <text x="0" y="0" fontFamily="system-ui, -apple-system, sans-serif" fontSize="22" fontWeight="800" fill={c.text} letterSpacing="-0.5">
          IRON
        </text>
        <text x="0" y="18" fontFamily="system-ui, -apple-system, sans-serif" fontSize="12" fontWeight="600" fill={c.secondary} letterSpacing="2">
          METRICS
        </text>
      </g>
      <circle cx="46" cy="20" r="2" fill={c.primary} />
    </svg>
  );
}

export function IronMetricsLogoCompact({ className = "", variant = "default" }: { className?: string; variant?: "default" | "white" | "dark" }) {
  const colors = {
    default: {
      primary: "#10b981",
      secondary: "#059669",
      text: "#111827",
      subtext: "#6b7280",
    },
    white: {
      primary: "#ffffff",
      secondary: "#f3f4f6",
      text: "#ffffff",
      subtext: "#e5e7eb",
    },
    dark: {
      primary: "#10b981",
      secondary: "#059669",
      text: "#ffffff",
      subtext: "#9ca3af",
    }
  };

  const c = colors[variant];

  return (
    <svg className={className} viewBox="0 0 180 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(2, 6)">
        <rect x="0" y="10" width="9" height="16" rx="1.5" fill={c.primary} />
        <rect x="9" y="16" width="12" height="4" rx="2" fill={c.primary} />
        <rect x="21" y="10" width="9" height="16" rx="1.5" fill={c.primary} />
        <rect x="12" y="8" width="2" height="8" rx="1" fill={c.secondary} opacity="0.4" />
        <rect x="15" y="5" width="2" height="11" rx="1" fill={c.secondary} opacity="0.6" />
        <rect x="18" y="2" width="2" height="14" rx="1" fill={c.primary} />
      </g>
      <g transform="translate(48, 24)">
        <text x="0" y="0" fontFamily="system-ui, -apple-system, sans-serif" fontSize="20" fontWeight="800" fill={c.text} letterSpacing="-0.5">
          Iron Metrics
        </text>
        <text x="0" y="12" fontFamily="system-ui, -apple-system, sans-serif" fontSize="8" fontWeight="600" fill={c.subtext} letterSpacing="1.5">
          GYM ANALYTICS
        </text>
      </g>
    </svg>
  );
}

export function IronMetricsWordmark({ className = "", variant = "default" }: { className?: string; variant?: "default" | "white" | "dark" }) {
  const colors = {
    default: {
      primary: "#10b981",
      secondary: "#059669",
      text: "#111827",
      subtext: "#6b7280",
    },
    white: {
      primary: "#ffffff",
      secondary: "#e5e7eb",
      text: "#ffffff",
      subtext: "#d1d5db",
    },
    dark: {
      primary: "#10b981",
      secondary: "#059669",
      text: "#ffffff",
      subtext: "#9ca3af",
    }
  };

  const c = colors[variant];

  return (
    <svg className={className} viewBox="0 0 320 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="textGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={c.primary} />
          <stop offset="100%" stopColor={c.secondary} />
        </linearGradient>
      </defs>
      <rect x="20" y="10" width="280" height="1" fill={c.primary} opacity="0.2" />
      <g transform="translate(20, 50)">
        <text fontFamily="system-ui, -apple-system, sans-serif" fontSize="32" fontWeight="900" letterSpacing="-1">
          <tspan fill={c.text}>IRON</tspan>
          <tspan fill={c.primary} dx="8">METRICS</tspan>
        </text>
      </g>
      <text x="20" y="65" fontFamily="system-ui, -apple-system, sans-serif" fontSize="10" fontWeight="600" fill={c.subtext} letterSpacing="3">
        GYM FINANCIAL INTELLIGENCE
      </text>
      <rect x="20" y="72" width="280" height="1" fill={c.primary} opacity="0.2" />
      <g transform="translate(265, 38)">
        <rect x="0" y="3" width="4" height="8" rx="1" fill={c.primary} opacity="0.7" />
        <rect x="4" y="5" width="6" height="4" rx="2" fill={c.primary} opacity="0.7" />
        <rect x="10" y="3" width="4" height="8" rx="1" fill={c.primary} opacity="0.7" />
        <rect x="5" y="1" width="1.5" height="3" rx="0.75" fill={c.primary} />
        <rect x="7" y="-1" width="1.5" height="5" rx="0.75" fill={c.primary} />
      </g>
    </svg>
  );
}

export function IronMetricsLogoStacked({ className = "", variant = "default" }: { className?: string; variant?: "default" | "white" | "dark" }) {
  const colors = {
    default: {
      primary: "#10b981",
      secondary: "#059669",
      text: "#111827",
      subtext: "#6b7280",
    },
    white: {
      primary: "#ffffff",
      secondary: "#e5e7eb",
      text: "#ffffff",
      subtext: "#d1d5db",
    },
    dark: {
      primary: "#10b981",
      secondary: "#059669",
      text: "#ffffff",
      subtext: "#9ca3af",
    }
  };

  const c = colors[variant];

  return (
    <svg className={className} viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(33, 20)">
        <rect x="0" y="8" width="14" height="22" rx="2.5" fill={c.primary} />
        <rect x="14" y="16" width="26" height="6" rx="3" fill={c.primary} />
        <rect x="40" y="8" width="14" height="22" rx="2.5" fill={c.primary} />
        <rect x="19" y="6" width="3" height="10" rx="1.5" fill={c.secondary} opacity="0.4" />
        <rect x="24" y="2" width="3" height="14" rx="1.5" fill={c.secondary} opacity="0.6" />
        <rect x="29" y="-2" width="3" height="18" rx="1.5" fill={c.primary} />
      </g>
      <g>
        <text x="60" y="80" fontFamily="system-ui, -apple-system, sans-serif" fontSize="24" fontWeight="900" fill={c.text} textAnchor="middle" letterSpacing="-0.5">
          IRON
        </text>
        <text x="60" y="100" fontFamily="system-ui, -apple-system, sans-serif" fontSize="18" fontWeight="700" fill={c.primary} textAnchor="middle" letterSpacing="0.5">
          METRICS
        </text>
        <text x="60" y="115" fontFamily="system-ui, -apple-system, sans-serif" fontSize="8" fontWeight="600" fill={c.subtext} textAnchor="middle" letterSpacing="2">
          GYM ANALYTICS
        </text>
      </g>
    </svg>
  );
}

export function IronMetricsIcon({ className = "", variant = "default" }: { className?: string; variant?: "default" | "white" | "dark" | "gradient" }) {
  const colors = {
    default: {
      primary: "#10b981",
      secondary: "#059669",
      accent: "#34d399",
    },
    white: {
      primary: "#ffffff",
      secondary: "#f3f4f6",
      accent: "#e5e7eb",
    },
    dark: {
      primary: "#10b981",
      secondary: "#059669",
      accent: "#34d399",
    },
    gradient: {
      primary: "url(#emeraldGradient)",
      secondary: "#059669",
      accent: "#34d399",
    }
  };

  const c = colors[variant];

  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {variant === "gradient" && (
        <defs>
          <linearGradient id="emeraldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
      )}
      <circle cx="24" cy="24" r="22" fill={variant === "gradient" ? c.primary : "transparent"} opacity={variant === "gradient" ? 0.1 : 0} />
      <g transform="translate(6, 14)">
        <rect x="0" y="4" width="10" height="18" rx="2.5" fill={c.primary} />
        <rect x="10" y="11" width="16" height="4" rx="2" fill={c.primary} />
        <rect x="26" y="4" width="10" height="18" rx="2.5" fill={c.primary} />
        <rect x="14" y="3" width="2.5" height="8" rx="1.25" fill={variant === "gradient" ? "url(#barGradient)" : c.secondary} opacity="0.5" />
        <rect x="18" y="0" width="2.5" height="11" rx="1.25" fill={variant === "gradient" ? "url(#barGradient)" : c.secondary} opacity="0.7" />
        <rect x="22" y="-3" width="2.5" height="14" rx="1.25" fill={variant === "gradient" ? "url(#barGradient)" : c.accent} />
      </g>
    </svg>
  );
}

export function IronMetricsIconMinimal({ className = "", variant = "default" }: { className?: string; variant?: "default" | "white" }) {
  const color = variant === "white" ? "#ffffff" : "#10b981";

  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(3, 10)">
        <rect x="0" y="3" width="6" height="10" rx="1.5" fill={color} />
        <rect x="6" y="6" width="14" height="4" rx="2" fill={color} />
        <rect x="20" y="3" width="6" height="10" rx="1.5" fill={color} />
        <rect x="10" y="1" width="2" height="4" rx="1" fill={color} opacity="0.5" />
        <rect x="13" y="-1" width="2" height="6" rx="1" fill={color} opacity="0.7" />
        <rect x="16" y="-3" width="2" height="8" rx="1" fill={color} />
      </g>
    </svg>
  );
}
