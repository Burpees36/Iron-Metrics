import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { supabase, getAppUrl } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function AuthResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    async function checkRecovery() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
        if (params.get("type") === "recovery" || hashParams.get("type") === "recovery") {
          setIsRecoveryMode(true);
        } else {
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === "PASSWORD_RECOVERY") {
              setIsRecoveryMode(true);
            }
            subscription.unsubscribe();
          });
        }
      }
      setCheckingSession(false);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
        setCheckingSession(false);
      }
    });

    checkRecovery();

    return () => subscription.unsubscribe();
  }, []);

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAppUrl() + "/reset-password",
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setEmailSent(true);
      toast({
        title: "Reset link sent",
        description: "Check your email for a password reset link.",
      });
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      toast({
        title: "Password updated",
        description: "Your password has been updated successfully.",
      });
      setLocation("/login");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            Loading...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isRecoveryMode) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-xl tracking-tight">Iron Metrics</CardTitle>
            <CardDescription>Set your new password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  data-testid="input-new-password"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive" data-testid="text-error">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading} data-testid="button-update-password">
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <a
                href="/login"
                onClick={(e) => { e.preventDefault(); setLocation("/login"); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-login"
              >
                Back to sign in
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-xl tracking-tight">Iron Metrics</CardTitle>
            <CardDescription>Check your email</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center" data-testid="text-success">
              We sent a password reset link to <span className="text-foreground">{email}</span>. Please check your inbox.
            </p>
            <div className="mt-4 text-center">
              <a
                href="/login"
                onClick={(e) => { e.preventDefault(); setLocation("/login"); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-login"
              >
                Back to sign in
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-xl tracking-tight">Iron Metrics</CardTitle>
          <CardDescription>Reset your password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" data-testid="text-error">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading} data-testid="button-request-reset">
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <a
              href="/login"
              onClick={(e) => { e.preventDefault(); setLocation("/login"); }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-login"
            >
              Back to sign in
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
