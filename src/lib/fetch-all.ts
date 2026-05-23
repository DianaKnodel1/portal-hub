import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

/**
 * Lädt ALLE Zeilen einer Supabase-Query in 1000er-Chunks per Pagination.
 * Hebt das Default-Limit (1000) und harte .range()-Caps komplett auf — keine Grenze.
 * Aufrufer übergibt eine Factory, die für jeden Chunk eine frische Query baut
 * (damit .range() nicht doppelt angewendet wird).
 *
 * Beispiel:
 *   const rows = await fetchAll(() =>
 *     supabase.from("applications").select("*").order("created_at", { ascending: false })
 *   );
 */
export async function fetchAll<T = any>(
  queryFactory: () => PostgrestFilterBuilder<any, any, any, any, any> | any,
  chunkSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // Sicherheitsnetz: bei >5 Mio Zeilen abbrechen, damit keine Endlosschleife möglich ist.
  const HARD_CAP = 5_000_000;
  while (from < HARD_CAP) {
    const to = from + chunkSize - 1;
    const { data, error } = await queryFactory().range(from, to);
    if (error) throw error;
    const batch = (data as T[]) ?? [];
    all.push(...batch);
    if (batch.length < chunkSize) break;
    from += chunkSize;
  }
  return all;
}