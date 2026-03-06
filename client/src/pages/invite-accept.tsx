import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function InviteAccept() {
  const [, params] = useRoute("/invite/:token");
  const [, setLocation] = useLocation();
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const token = params?.token;

  useEffect(() => {
    if (!token) return;
    fetch(`/api/invites/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || "Invalid invite");
        }
        return res.json();
      })
      .then((data) => {
        setInvite(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    setError("");

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      setLocation(`/login?redirect=/invite/${token}`);
      return;
    }

    try {
      const res = await fetch(`/api/invites/${token}/accept`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to accept invite");
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (err: any) {
      setError(err.message);
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md" data-testid="card-invite">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Iron Metrics
          </CardTitle>
          {success ? (
            <CardDescription className="flex items-center justify-center gap-2 text-green-500">
              <CheckCircle className="h-4 w-4" />
              Invite accepted! Redirecting...
            </CardDescription>
          ) : error && !invite ? (
            <CardDescription className="flex items-center justify-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              {error}
            </CardDescription>
          ) : (
            <CardDescription>
              You've been invited to join a gym
            </CardDescription>
          )}
        </CardHeader>
        {invite && !success && (
          <CardContent className="space-y-6">
            <div className="space-y-2 text-center">
              <p className="text-lg font-semibold" data-testid="text-gym-name">
                {invite.gymName}
              </p>
              <p className="text-sm text-muted-foreground" data-testid="text-invite-role">
                Role: <span className="capitalize font-medium">{invite.role}</span>
              </p>
              {invite.inviterName && (
                <p className="text-sm text-muted-foreground" data-testid="text-inviter">
                  Invited by {invite.inviterName}
                </p>
              )}
            </div>
            {error && (
              <p className="text-sm text-destructive text-center" data-testid="text-error">{error}</p>
            )}
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleAccept}
                disabled={accepting}
                data-testid="button-accept-invite"
              >
                {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Accept Invite
              </Button>
              <Button
                variant="ghost"
                onClick={() => setLocation("/")}
                data-testid="button-decline"
              >
                Decline
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
