import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const Schema = z.object({
  full_name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().nullable(),
  postal_code: z.string().trim().max(20).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  message: z.string().trim().max(2000).optional().nullable(),
  tenant_id: z.string().uuid().optional().nullable(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/applications")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }
        const parsed = Schema.safeParse(payload);
        if (!parsed.success) {
          return json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
        }
        const d = parsed.data;
        const { error } = await supabaseAdmin.from("applications").insert({
          full_name: d.full_name,
          email: d.email,
          phone: d.phone ?? null,
          postal_code: d.postal_code ?? null,
          city: d.city ?? null,
          message: d.message ?? null,
          tenant_id: d.tenant_id ?? null,
          status: "neu",
        });
        if (error) {
          console.error("[applications] insert error:", error);
          return json({ error: "Could not save application" }, 500);
        }
        return json({ success: true });
      },
    },
  },
});