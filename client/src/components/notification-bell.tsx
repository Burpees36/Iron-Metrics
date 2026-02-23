import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell, AlertTriangle, AlertCircle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";

interface Alert {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  timestamp: string;
}

export function NotificationBell() {
  const [location] = useLocation();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const gymMatch = location.match(/^\/gyms\/([^/]+)/);
  const gymId = gymMatch && gymMatch[1] !== "new" ? gymMatch[1] : null;

  const { data: alerts } = useQuery<Alert[]>({
    queryKey: ["/api/gyms", gymId, "alerts"],
    queryFn: async () => {
      if (!gymId) return [];
      const res = await fetch(`/api/gyms/${gymId}/alerts`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!gymId,
    refetchInterval: 5 * 60 * 1000,
  });

  const activeAlerts = (alerts || []).filter(a => !dismissed.has(a.id));
  const criticalCount = activeAlerts.filter(a => a.severity === "critical").length;
  const totalCount = activeAlerts.length;

  const dismiss = (id: string) => {
    setDismissed(prev => new Set(prev).add(id));
  };

  if (!gymId) return null;

  const severityConfig = {
    critical: { icon: AlertTriangle, color: "text-red-500 dark:text-red-400", bg: "bg-red-500/10 dark:bg-red-500/15", border: "border-red-500/20" },
    warning: { icon: AlertCircle, color: "text-amber-500 dark:text-amber-400", bg: "bg-amber-500/10 dark:bg-amber-500/15", border: "border-amber-500/20" },
    info: { icon: Info, color: "text-blue-500 dark:text-blue-400", bg: "bg-blue-500/10 dark:bg-blue-500/15", border: "border-blue-500/20" },
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
          <Bell className="w-4 h-4" />
          {totalCount > 0 && (
            <span className={`absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white ${criticalCount > 0 ? "bg-red-500" : "bg-amber-500"}`}>
              {totalCount > 9 ? "9+" : totalCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" data-testid="section-notifications">
        <div className="p-3 border-b">
          <h3 className="text-sm font-semibold">Alerts</h3>
          {totalCount === 0 && (
            <p className="text-xs text-muted-foreground mt-1">No active alerts</p>
          )}
        </div>
        {activeAlerts.length > 0 && (
          <div className="max-h-80 overflow-y-auto">
            {activeAlerts.map(alert => {
              const config = severityConfig[alert.severity];
              const Icon = config.icon;
              return (
                <div key={alert.id} className={`p-3 border-b last:border-b-0 ${config.bg}`} data-testid={`alert-${alert.id}`}>
                  <div className="flex items-start gap-2">
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-tight">{alert.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{alert.detail}</p>
                    </div>
                    <button
                      className="h-5 w-5 flex-shrink-0 rounded hover:bg-muted flex items-center justify-center"
                      onClick={(e) => { e.stopPropagation(); dismiss(alert.id); }}
                      data-testid={`dismiss-alert-${alert.id}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
