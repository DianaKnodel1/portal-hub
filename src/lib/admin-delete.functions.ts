import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DeleteSchema = z.object({
  user_id: z.string().uuid(),
  confirm: z.literal("MITARBEITER LÖSCHEN"),
});

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nicht autorisiert");
}

export const deleteEmployeeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    if (data.user_id === context.userId) {
      throw new Error("Du kannst dich nicht selbst löschen");
    }

    const uid = data.user_id;
    const sb = supabaseAdmin as any;

    // Schutz: keine Admins/Teamleiter über diesen Weg hart löschen
    const { data: adminCheck } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    if ((adminCheck ?? []).some((r: any) => r.role === "admin")) {
      throw new Error("Admin-Accounts können nicht über diese Funktion gelöscht werden.");
    }

    // Abhängige Daten aus public-Tabellen entfernen
    const tablesUserId = [
      "chat_conversations",
      "notifications",
      "kyc_verifications",
      "bookings",
      "task_assignments",
      "user_transactions",
      "contracts",
      "uploads",
      "task_submissions",
      "task_sms_messages",
      "user_roles",
    ];

    for (const t of tablesUserId) {
      try {
        await sb.from(t).delete().eq("user_id", uid);
      } catch {
        /* tolerate missing tables / columns */
      }
    }

    try {
      await sb.from("chat_messages").delete().or(`sender_id.eq.${uid},receiver_id.eq.${uid}`);
    } catch {}

    try {
      await sb.from("activity_log").delete().or(`actor_id.eq.${uid},entity_id.eq.${uid}`);
    } catch {}

    try {
      await sb.from("profiles").delete().eq("user_id", uid);
    } catch {}

    // Auth-User löschen
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (authErr) throw new Error(`Auth-Löschung fehlgeschlagen: ${authErr.message}`);

    try {
      await sb.from("activity_log").insert({
        action: "mitarbeiter_geloescht",
        entity_type: "profile",
        entity_id: uid,
        actor_id: context.userId,
        comment: "Mitarbeiter hart gelöscht (inkl. Auth-Account)",
      });
    } catch {}

    return { ok: true };
  });
