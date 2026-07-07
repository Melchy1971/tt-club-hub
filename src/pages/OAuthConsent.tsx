import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

type AuthorizationDetails = {
  client?: { name?: string; logo_uri?: string; client_uri?: string };
  redirect_url?: string;
  redirect_to?: string;
  scopes?: string[];
};

type OAuthNamespace = {
  getAuthorizationDetails(id: string): Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization(id: string): Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  denyAuthorization(id: string): Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
};

function getOAuth(): OAuthNamespace {
  const oauth = (supabase.auth as unknown as { oauth?: OAuthNamespace }).oauth;
  if (!oauth) throw new Error("Supabase OAuth authorization server is not available on this client.");
  return oauth;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Fehlende authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      try {
        const { data, error } = await getOAuth().getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) return setError(error.message);
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const oauth = getOAuth();
      const { data, error } = approve
        ? await oauth.approveAuthorization(authorizationId)
        : await oauth.denyAuthorization(authorizationId);
      if (error) {
        setBusy(false);
        setError(error.message);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setBusy(false);
        setError("Keine Weiterleitungs-URL vom Autorisierungsserver erhalten.");
        return;
      }
      window.location.href = target;
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const clientName = details?.client?.name ?? "eine externe Anwendung";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verbindung autorisieren</CardTitle>
          <CardDescription>
            {clientName} möchte auf dein TT-Manager Pro Konto zugreifen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          )}
          {!details && !error && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Autorisierungsanfrage wird geladen…
            </div>
          )}
          {details && (
            <>
              <p className="text-sm text-muted-foreground">
                Nach der Freigabe kann {clientName} in deinem Namen auf die Vereinsdaten zugreifen,
                die dir dieses App gewährt (gemäß deiner Rolle und Berechtigungen).
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => decide(true)} disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Freigeben
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => decide(false)}
                  disabled={busy}
                >
                  Ablehnen
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}