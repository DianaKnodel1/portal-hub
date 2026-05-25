import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/auth/confirmed")({
  component: AuthConfirmedPage,
});

function AuthConfirmedPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const tokenHash = url.searchParams.get("token_hash");
    const otpType = (url.searchParams.get("type") as "signup" | "email" | "recovery" | null) ?? "signup";

    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const errorDesc = hashParams.get("error_description") ?? hashParams.get("error") ?? url.searchParams.get("error_description");

    if (errorDesc) {
      setState("error");
      setMessage(decodeURIComponent(errorDesc.replace(/\+/g, " ")));
      return;
    }

    const finalize = async () => {
      // 1. Neuer Flow: token_hash in der URL → jetzt im Browser einlösen
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ type: otpType, token_hash: tokenHash });
        if (error) {
          setState("error");
          setMessage(error.message);
          return;
        }
        setState("success");
        window.history.replaceState(null, "", "/auth/confirmed");
        return;
      }

      // 2. Alter Flow (Tokens kommen via Hash von GoTrue verify)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setState("success");
        window.history.replaceState(null, "", "/auth/confirmed");
        return;
      }
      const access_token = hashParams.get("access_token");
      const refresh_token = hashParams.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) {
          setState("error");
          setMessage(error.message);
          return;
        }
        setState("success");
        window.history.replaceState(null, "", "/auth/confirmed");
        return;
      }
      setState("success");
      setTimeout(() => navigate("/login"), 1800);
    };

    void finalize();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/95 backdrop-blur-sm shadow-2xl p-10 text-center animate-fade-in">
        {state === "loading" && (
          <>
            <Loader2 className="h-10 w-10 text-primary mx-auto animate-spin" />
            <h1 className="mt-6 text-2xl font-heading font-bold">Bestätigung wird verarbeitet…</h1>
          </>
        )}
        {state === "success" && (
          <>
            <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            </div>
            <h1 className="mt-6 text-2xl font-heading font-bold text-foreground">
              E-Mail erfolgreich bestätigt
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Dein Account ist jetzt aktiv. Du kannst jetzt ins Dashboard wechseln.
            </p>
            <button
              onClick={() => navigate("/dashboard")}
              className="mt-6 inline-flex items-center justify-center h-11 px-6 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
            >
              Jetzt zum Dashboard
            </button>
          </>
        )}
        {state === "error" && (
          <>
            <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle className="h-9 w-9 text-destructive" />
            </div>
            <h1 className="mt-6 text-2xl font-heading font-bold text-foreground">
              Bestätigung fehlgeschlagen
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {message || "Der Link ist ungültig oder abgelaufen. Bitte fordere eine neue Bestätigungs-E-Mail an."}
            </p>
            <button
              onClick={() => navigate("/register")}
              className="mt-6 inline-flex items-center justify-center h-11 px-6 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
            >
              Neue E-Mail anfordern
            </button>
          </>
        )}
      </div>
    </div>
  );
}
