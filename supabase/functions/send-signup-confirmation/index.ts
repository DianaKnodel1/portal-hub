// Deno Edge Function: send-signup-confirmation
//
// Flow:
//   1. Admin-create user with email_confirm=false (kein GoTrue-Mail-Versand, da SMTP fake)
//   2. generateLink({type:'signup'}) → Confirmation-URL OHNE Mailversand
//   3. Tenant-SMTP aus DB laden
//   4. Branded HTML-Mail via nodemailer über Tenant-SMTP senden
//   5. email_logs schreiben
//   Bei SMTP-Fehler: User rollback via admin.deleteUser
//
// Env (auf Supabase-Server gesetzt):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Deploy:
//   supabase functions deploy send-signup-confirmation --no-verify-jwt
//
// Server (.env): GOTRUE_MAILER_AUTOCONFIRM=false  → docker compose up -d auth

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import nodemailer from "https://esm.sh/nodemailer@6.9.14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  email: string;
  password: string;
  tenant_id: string;
  full_name?: string;
  redirect_to?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, password, tenant_id, full_name, redirect_to } = (await req.json()) as Payload;

    if (!email || !password || !tenant_id) {
      return json({ error: "Missing required fields: email, password, tenant_id" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // 1. Tenant + SMTP laden
    const { data: tenant, error: tErr } = await supabaseAdmin
      .from("tenants")
      .select("id, name, domain, logo_url, primary_color, sender_email, sender_name, reply_to_email, smtp_host, smtp_port, smtp_username, smtp_password")
      .eq("id", tenant_id)
      .maybeSingle();

    if (tErr || !tenant) return json({ error: "Tenant nicht gefunden" }, 404);
    if (!tenant.smtp_host || !tenant.smtp_port || !tenant.smtp_username || !tenant.smtp_password) {
      return json({ error: "Tenant hat keine vollständige SMTP-Konfiguration" }, 400);
    }

    // 2. User anlegen + Confirmation-Link in EINEM Call.
    //    generateLink({type:'signup'}) erstellt den User automatisch und liefert den Link
    //    zurück OHNE Mailversand durch GoTrue.
    const redirectTo = redirect_to ?? `https://${tenant.domain}/auth/confirmed`;
    let { data: linkData, error: lErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: { data: { full_name: full_name ?? "" }, redirectTo },
    });

    // Fallback: User existiert bereits. Wenn er NICHT bestätigt ist → neuen Link
    // erzeugen und resenden. Wenn bestätigt → echter Fehler.
    if (lErr || !linkData?.properties?.action_link || !linkData?.user) {
      const msg = (lErr?.message ?? "").toLowerCase();
      const looksLikeExists = msg.includes("already") || msg.includes("registered") || msg.includes("exists");
      if (looksLikeExists) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = list?.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
        if (existing?.email_confirmed_at) {
          return json({ error: "Diese E-Mail-Adresse ist bereits registriert und bestätigt. Bitte melde dich an." }, 409);
        }
        const retry = await supabaseAdmin.auth.admin.generateLink({
          type: "signup",
          email,
          options: { redirectTo },
        });
        if (retry.error || !retry.data?.properties?.action_link || !retry.data?.user) {
          return json({ error: retry.error?.message ?? "Confirmation-Link konnte nicht erzeugt werden" }, 400);
        }
        linkData = retry.data;
      } else {
        return json({ error: lErr?.message ?? "Confirmation-Link konnte nicht generiert werden" }, 400);
      }
    }
    const userId = linkData!.user!.id;
    // WICHTIG: Wir verwenden NICHT properties.action_link (der wird von Mail-Scannern
    // wie Gmail beim Prefetch konsumiert → otp_expired). Stattdessen bauen wir einen
    // Link auf unsere eigene /auth/confirmed-Seite mit token_hash. Die Seite ruft
    // verifyOtp() erst beim echten User-Klick im Browser auf.
    const tokenHash = (linkData!.properties as any)?.hashed_token;
    if (!tokenHash) {
      return json({ error: "hashed_token fehlt in generateLink response" }, 500);
    }
    const confirmBase = redirect_to ?? `https://${tenant.domain}/auth/confirmed`;
    const actionLink = `${confirmBase}?token_hash=${encodeURIComponent(tokenHash)}&type=signup`;

    try {

      // 4. Mail rendern
      const senderName = tenant.sender_name ?? tenant.name;
      const senderEmail = tenant.sender_email ?? tenant.smtp_username;
      const brand = tenant.primary_color ?? "#0f172a";
      const logo = tenant.logo_url
        ? `<img src="${tenant.logo_url}" alt="${escapeHtml(tenant.name)}" style="max-height:40px;margin-bottom:24px"/>`
        : `<div style="font-weight:700;font-size:20px;margin-bottom:24px;color:${brand}">${escapeHtml(tenant.name)}</div>`;

      const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:40px;max-width:560px">
<tr><td>
${logo}
<h1 style="font-size:24px;margin:0 0 16px;color:#0f172a">Willkommen${full_name ? `, ${escapeHtml(full_name.split(" ")[0])}` : ""}!</h1>
<p style="font-size:15px;line-height:1.6;color:#475569;margin:0 0 24px">
Bitte bestätige deine E-Mail-Adresse, um deinen Account bei <strong>${escapeHtml(tenant.name)}</strong> zu aktivieren.
</p>
<table cellpadding="0" cellspacing="0"><tr><td style="background:${brand};border-radius:8px">
<a href="${actionLink}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px">E-Mail bestätigen</a>
</td></tr></table>
<p style="font-size:13px;color:#94a3b8;margin:32px 0 0;line-height:1.5">
Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br/>
<a href="${actionLink}" style="color:${brand};word-break:break-all">${actionLink}</a>
</p>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0"/>
<p style="font-size:12px;color:#94a3b8;margin:0">
Diese E-Mail wurde an ${escapeHtml(email)} gesendet. Wenn du keinen Account angelegt hast, kannst du diese E-Mail ignorieren.
</p>
</td></tr></table>
</td></tr></table>
</body></html>`;

      // 5. SMTP senden
      const transporter = nodemailer.createTransport({
        host: tenant.smtp_host,
        port: tenant.smtp_port,
        secure: tenant.smtp_port === 465,
        auth: { user: tenant.smtp_username, pass: tenant.smtp_password },
      });

      await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to: email,
        replyTo: tenant.reply_to_email ?? senderEmail,
        subject: `Bestätige deine E-Mail-Adresse – ${tenant.name}`,
        html,
      });

      // 6. Log
      await supabaseAdmin.from("email_logs").insert({
        tenant_id,
        recipient: email,
        subject: `Bestätige deine E-Mail-Adresse – ${tenant.name}`,
        status: "sent",
        template: "signup_confirmation",
      }).then(() => {}, () => {}); // ignore log errors

      return json({ success: true, user_id: userId }, 200);
    } catch (sendErr: any) {
      // Rollback: User wieder löschen, damit er es nochmal versuchen kann
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      console.error("SMTP send failed:", sendErr);
      return json({ error: `Mail-Versand fehlgeschlagen: ${sendErr?.message ?? sendErr}` }, 500);
    }
  } catch (err: any) {
    console.error(err);
    return json({ error: err?.message ?? "Unknown error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
