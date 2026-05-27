import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Schema = z.object({
  user_ids: z.array(z.string().uuid()).min(1).max(500),
});

export const getLastSignIns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any).rpc(
      "get_last_sign_ins",
      { _user_ids: data.user_ids },
    );
    if (error) throw new Error(error.message);
    const map: Record<string, string | null> = {};
    for (const r of (rows ?? []) as Array<{ user_id: string; last_sign_in_at: string | null }>) {
      map[r.user_id] = r.last_sign_in_at;
    }
    return map;
  });
