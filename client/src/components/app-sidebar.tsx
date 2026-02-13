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
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Activity,
  Plus,
  Building2,
  LogOut,
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

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/">
          <div className="flex items-center gap-2 hover-elevate rounded-md px-2 py-1.5 cursor-pointer" data-testid="link-home">
            <Activity className="w-5 h-5 text-sidebar-primary flex-shrink-0" />
            <span className="text-base font-bold tracking-tight">Iron Metrics</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/"}>
                  <Link href="/">
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

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
                      isActive={location === `/gyms/${gym.id}` || location.startsWith(`/gyms/${gym.id}/`)}
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
