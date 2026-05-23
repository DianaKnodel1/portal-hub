import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/unsubscribe")({
  component: UnsubscribePage,
});

import { useState, useEffect } from "react";
import { useSearchParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, MailX } from "lucide-react";

function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "valid" | "invalid" | "done" | "error">("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    }).then(r => r.json()).then(data => {
      setStatus(data.valid ? "valid" : "invalid");
    }).catch(() => setStatus("error"));
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      setStatus(error ? "error" : "done");
    } catch {
      setStatus("error");
    }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          {status === "loading" && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />}
          {status === "valid" && (
            <>
              <MailX className="h-12 w-12 text-muted-foreground mx-auto" />
              <h2 className="text-lg font-heading font-bold text-foreground">E-Mail-Abmeldung</h2>
              <p className="text-sm text-muted-foreground">Möchtest du dich wirklich von unseren E-Mails abmelden?</p>
              <Button onClick={handleUnsubscribe} disabled={processing} variant="destructive">
                {processing ? "Wird verarbeitet…" : "Abmelden bestätigen"}
              </Button>
            </>
          )}
          {status === "done" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-accent mx-auto" />
              <h2 className="text-lg font-heading font-bold text-foreground">Erfolgreich abgemeldet</h2>
              <p className="text-sm text-muted-foreground">Du erhältst keine weiteren E-Mails mehr.</p>
            </>
          )}
          {(status === "invalid" || status === "error") && (
            <>
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-lg font-heading font-bold text-foreground">Ungültiger Link</h2>
              <p className="text-sm text-muted-foreground">Dieser Abmeldelink ist ungültig oder bereits verwendet.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
