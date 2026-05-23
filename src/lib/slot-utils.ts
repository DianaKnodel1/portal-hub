import { supabase } from "@/integrations/supabase/client";

export interface NextSlotResult {
  slot_id: string;
  slot_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string;
  label: string; // formatted for display
}

/**
 * Findet den nächsten freien Termin-Slot ab heute.
 * - Berücksichtigt max_participants (über Buchungen).
 * - Schließt Slots aus, die der User bereits gebucht hat.
 */
export async function getNextAvailableSlot(userId: string): Promise<NextSlotResult | null> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: slots } = await supabase
    .from("time_slots")
    .select("id, slot_date, start_time, end_time, max_participants")
    .gte("slot_date", today)
    .order("slot_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(50);

  if (!slots || slots.length === 0) return null;

  const slotIds = slots.map((s: any) => s.id);
  const { data: bookings } = await supabase
    .from("bookings")
    .select("time_slot_id, user_id, status")
    .in("time_slot_id", slotIds)
    .neq("status", "storniert");

  const bookedCount = new Map<string, number>();
  const userBooked = new Set<string>();
  (bookings || []).forEach((b: any) => {
    bookedCount.set(b.time_slot_id, (bookedCount.get(b.time_slot_id) || 0) + 1);
    if (b.user_id === userId) userBooked.add(b.time_slot_id);
  });

  for (const s of slots as any[]) {
    const count = bookedCount.get(s.id) || 0;
    if (count >= (s.max_participants || 1)) continue;
    if (userBooked.has(s.id)) continue;
    const [y, m, d] = (s.slot_date as string).split("-");
    const label = `${d}.${m}.${y} · ${(s.start_time as string).slice(0, 5)} Uhr`;
    return {
      slot_id: s.id,
      slot_date: s.slot_date,
      start_time: s.start_time,
      end_time: s.end_time,
      label,
    };
  }
  return null;
}
