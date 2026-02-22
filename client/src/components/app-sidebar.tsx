import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import type { Gym } from "@shared/schema";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Activity,
  Plus,
  Building2,
  LogOut,
  BarChart3,
  FileText,
  Brain,
  Target,
} from "lucide-react";

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const { data: gyms } = useQuery<Gym[]>({
    queryKey: ["/api/gyms"],
  });

  const initials = user
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "U"
    : "U";

  const gymMatch = location.match(/^\/gyms\/([^/]+)/);
  const activeGymId = gymMatch && gymMatch[1] !== "new" ? gymMatch[1] : null;
  const activeGym = activeGymId && gyms ? gyms.find(g => String(g.id) === activeGymId) : null;

  const gymNavItems = activeGymId ? [
    { href: `/gyms/${activeGymId}`, label: "Overview", icon: LayoutDashboard, exact: true },
    { href: `/gyms/${activeGymId}/trends`, label: "Reports", icon: BarChart3 },
    { href: `/gyms/${activeGymId}/strategy`, label: "AI Strategy Plays", icon: FileText },
    { href: `/gyms/${activeGymId}/member-risk`, label: "Member Intelligence", icon: Brain },
    { href: `/gyms/${activeGymId}/planning`, label: "Future Planning", icon: Target },
  ] : [];

  const isGymNavActive = (item: typeof gymNavItems[0]) => {
    if (item.exact) {
      return location === item.href;
    }
    return location === item.href || location.startsWith(item.href + "/");
  };

  return (
    <Sidebar className="sidebar-gradient">
      <SidebarHeader className="p-4">
        <Link href="/">
          <div className="flex items-center gap-2 hover-elevate rounded-md px-2 py-1.5 cursor-pointer" data-testid="link-home">
            <Activity className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <span className="text-base font-bold tracking-tight">Iron Metrics</span>
              <p className="text-[10px] text-muted-foreground leading-tight">CrossFit Command Center</p>
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {activeGym ? (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] uppercase tracking-wider">
                {activeGym.name}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {gymNavItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isGymNavActive(item)}>
                        <Link href={item.href}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />
          </>
        ) : (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/"}>
                    <Link href="/">
                      <LayoutDashboard className="w-4 h-4" />
                      <span>Command Center</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between gap-2 pr-2">
            <span>Your Gyms</span>
            <Link href="/gyms/new">
              <Button size="icon" variant="ghost" className="h-5 w-5" data-testid="button-add-gym-sidebar">
                <Plus className="w-3 h-3" />
              </Button>
            </Link>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {gyms && gyms.length > 0 ? (
                gyms.map((gym) => (
                  <SidebarMenuItem key={gym.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={String(gym.id) === activeGymId}
                    >
                      <Link href={`/gyms/${gym.id}`}>
                        <Building2 className="w-4 h-4" />
                        <span className="truncate">{gym.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No gyms yet
                </div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid="text-user-name">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate" data-testid="text-user-email">
              {user?.email}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => logout()}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
