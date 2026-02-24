import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { LuxuryThemeShell } from "@/components/luxury-theme-shell";
import { useAuth } from "@/hooks/use-auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import GymDetail from "@/pages/gym-detail";
import GymNew from "@/pages/gym-new";
import CsvImport from "@/pages/csv-import";
import WodifyIntegration from "@/pages/wodify-integration";
import GymTrends from "@/pages/gym-trends";
import GymStrategy from "@/pages/gym-strategy";
import GymMemberRisk from "@/pages/gym-member-risk";
import GymPlanning from "@/pages/gym-planning";
import MemberDetail from "@/pages/member-detail";
import GymSettings from "@/pages/gym-settings";
import SalesIntelligence from "@/pages/sales-intelligence";
import { NotificationBell } from "@/components/notification-bell";


function AuthenticatedApp() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-4 p-2 border-b border-border/50 sticky top-0 z-40 bg-background/70 backdrop-blur-md">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-1">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/gyms/new" component={GymNew} />
              <Route path="/gyms/:id/import" component={CsvImport} />
              <Route path="/gyms/:id/wodify" component={WodifyIntegration} />
              <Route path="/gyms/:id/trends" component={GymTrends} />
              <Route path="/gyms/:id/strategy" component={GymStrategy} />
              <Route path="/gyms/:id/member-risk" component={GymMemberRisk} />
              <Route path="/gyms/:id/planning" component={GymPlanning} />
              <Route path="/gyms/:id/sales" component={SalesIntelligence} />
              <Route path="/gyms/:id/settings" component={GymSettings} />
              <Route path="/gyms/:id/members/:memberId" component={MemberDetail} />
              <Route path="/gyms/:id" component={GymDetail} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 text-center">
          <Skeleton className="h-8 w-8 rounded-full mx-auto" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LuxuryThemeShell>
            <AppContent />
          </LuxuryThemeShell>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
