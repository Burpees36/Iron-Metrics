import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { User } from "@shared/models/auth";
import type { Session } from "@supabase/supabase-js";

const DEMO_USER_ID = "demo-user";

async function fetchUserProfile(session: Session | null): Promise<User | null> {
  const headers: Record<string, string> = {};

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const response = await fetch("/api/auth/user", {
    credentials: "include",
    headers,
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        setSession(newSession);

        if (newSession && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION")) {
          try {
            const profile = await fetchUserProfile(newSession);
            if (mounted) {
              setUser(profile);
              if (event === "SIGNED_IN") {
                queryClient.invalidateQueries();
              }
            }
          } catch (e) {
            console.error("Failed to fetch profile:", e);
          }
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          queryClient.clear();
        } else if (event === "INITIAL_SESSION" && !newSession) {
          try {
            const profile = await fetchUserProfile(null);
            if (mounted && profile) {
              setUser(profile);
            }
          } catch {
          }
        }

        if (mounted) setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const logout = useCallback(async () => {
    if (user?.id === DEMO_USER_ID) {
      await fetch("/api/demo/logout", { method: "POST", credentials: "include" });
      setUser(null);
      setSession(null);
      queryClient.clear();
      window.location.href = "/";
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    queryClient.clear();
    window.location.href = "/";
  }, [user, queryClient]);

  const setDemoUser = useCallback((demoUser: User) => {
    setUser(demoUser);
    setIsLoading(false);
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isDemo: user?.id === DEMO_USER_ID,
    session,
    logout,
    setDemoUser,
    isLoggingOut: false,
  };
}
