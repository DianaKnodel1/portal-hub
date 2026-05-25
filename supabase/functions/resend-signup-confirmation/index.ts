// Deno Edge Function: resend-signup-confirmation
//
// Schickt einem bereits angelegten, aber noch NICHT bestätigten User eine neue
// Confirmation-Mail über die Tenant-SMTP. Wenn der User schon bestätigt ist
// → 200 mit {already_confirmed:true}. Wenn der User nicht existiert → 404.
//
// Deploy:
//   supabase functions deploy resend-signup-confirmation --no-verify-jwt

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
  tenant_id: string;
  redirect_to?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, tenant_id, redirect_to } = (await req.json()) as Payload;
    if (!email || !tenant_id) return json({ error: "Missing required fields: email, tenant_id" }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Tenant + SMTP laden
    const { data: tenant, error: tErr } = await supabaseAdmin
      .from("tenants")
      .select("id, name, domain, logo_url, primary_color, sender_email, sender_name, reply_to_email, smtp_host, smtp_port, smtp_username, smtp_password")
      .eq("id", tenant_id)
      .maybeSingle();
    if (tErr || !tenant) return json({ error: "Tenant nicht gefunden" }, 404);
    if (!tenant.smtp_host || !tenant.smtp_port || !tenant.smtp_username || !tenant.smtp_password) {
      return json({ error: "Tenant hat keine vollständige SMTP-Konfiguration" }, 400);
    }

    // User per E-Mail finden
    const { data: list, error: lErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (lErr) return json({ error: lErr.message }, 500);
    const user = list.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
    if (!user) return json({ error: "Kein Account mit dieser E-Mail gefunden" }, 404);
    if (user.email_confirmed_at) return json({ success: true, already_confirmed: true }, 200);

    // Frischen Confirmation-Link erzeugen (ohne Passwort → existierender User)
    const redirectTo = redirect_to ?? `https://${tenant.domain}/auth/confirmed`;
    const { data: linkData, error: gErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "signup",
      email,
      options: { redirectTo },
    });
    if (gErr || !linkData?.properties) {
      return json({ error: gErr?.message ?? "Confirmation-Link konnte nicht generiert werden" }, 400);
    }
    // Token-Hash statt action_link (Gmail-Prefetch-Schutz, siehe send-signup-confirmation)
    const tokenHash = (linkData.properties as any)?.hashed_token;
    if (!tokenHash) return json({ error: "hashed_token fehlt" }, 500);
    const actionLink = `${redirectTo}?token_hash=${encodeURIComponent(tokenHash)}&type=signup`;

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
<h1 style="font-size:24px;margin:0 0 16px;color:#0f172a">Neue Bestätigungs-E-Mail</h1>
<p style="font-size:15px;line-height:1.6;color:#475569;margin:0 0 24px">
Du hast eine neue Bestätigungs-E-Mail angefordert. Klicke auf den Button, um deinen Account bei <strong>${escapeHtml(tenant.name)}</strong> zu aktivieren.
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
Diese E-Mail wurde an ${escapeHtml(email)} gesendet. Wenn du das nicht warst, kannst du diese E-Mail ignorieren.
</p>
</td></tr></table>
</td></tr></table>
</body></html>`;

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
      subject: `Neue Bestätigungs-E-Mail – ${tenant.name}`,
      html,
    });

    await supabaseAdmin.from("email_logs").insert({
      tenant_id,
      recipient: email,
      subject: `Neue Bestätigungs-E-Mail – ${tenant.name}`,
      status: "sent",
      template: "signup_confirmation_resend",
    }).then(() => {}, () => {});

    return json({ success: true }, 200);
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
