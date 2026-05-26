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

    // Schutz: keine Admins/Teamleiter über diesen Weg hart löschen
    const { data: adminCheck } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    if ((adminCheck ?? []).some((r: any) => r.role === "admin")) {
      throw new Error("Admin-Accounts können nicht über diese Funktion gelöscht werden.");
    }

    // Abhängige Daten aus public-Tabellen entfernen (best-effort, FKs greifen i.d.R. mit ON DELETE CASCADE).
    const tables = [
      "chat_messages",
      "chat_conversations",
      "notifications",
      "kyc_verifications",
      "bookings",
      "task_assignments",
      "user_transactions",
      "contracts",
      "activity_log",
      "uploads",
      "task_submissions",
      "task_sms_messages",
      "user_roles",
      "profiles",
    ];

    for (const t of tables) {
      try {
        // bei chat_messages: sender ODER receiver
        if (t === "chat_messages") {
          await supabaseAdmin.from(t).delete().or(`sender_id.eq.${uid},receiver_id.eq.${uid}`);
          continue;
        }
        if (t === "activity_log") {
          await supabaseAdmin.from(t).delete().or(`actor_id.eq.${uid},entity_id.eq.${uid}`);
          continue;
        }
        if (t === "profiles") {
          await supabaseAdmin.from(t).delete().eq("user_id", uid);
          continue;
        }
        // Default-Spalte user_id
        await supabaseAdmin.from(t).delete().eq("user_id", uid);
      } catch {
        // ignorieren – nicht jede Tabelle existiert / hat user_id
      }
    }

    // Auth-User löschen
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (authErr) throw new Error(`Auth-Löschung fehlgeschlagen: ${authErr.message}`);

    await supabaseAdmin.from("activity_log").insert({
      action: "mitarbeiter_geloescht",
      entity_type: "profile",
      entity_id: uid,
      actor_id: context.userId,
      comment: "Mitarbeiter hart gelöscht (inkl. Auth-Account)",
    }).catch(() => {});

    return { ok: true };
  });
