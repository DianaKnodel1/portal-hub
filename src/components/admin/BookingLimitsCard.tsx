import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CalendarClock, Save, Loader2 } from "lucide-react";

type EmploymentType = "minijob" | "teilzeit" | "vollzeit";
interface LimitRow {
  employment_type: EmploymentType;
  daily_limit: number;
  monthly_limit: number | null;
  min_pause_days: number;
}

const LABELS: Record<EmploymentType, string> = {
  minijob: "Minijob",
  teilzeit: "Teilzeit",
  vollzeit: "Vollzeit",
};

export function BookingLimitsCard() {
  const { toast } = useToast();
  const [rows, setRows] = useState<LimitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState<EmploymentType | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from("booking_limits")
        .select("*")
        .order("employment_type");
      if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
      setRows((data ?? []) as LimitRow[]);
      setLoading(false);
    })();
  }, [toast]);

  const update = (type: EmploymentType, patch: Partial<LimitRow>) =>
    setRows((prev) => prev.map((r) => (r.employment_type === type ? { ...r, ...patch } : r)));

  const save = async (row: LimitRow) => {
    setSavingType(row.employment_type);
    const { error } = await (supabase as any)
      .from("booking_limits")
      .update({
        daily_limit: row.daily_limit,
        monthly_limit: row.monthly_limit,
        min_pause_days: row.min_pause_days,
      })
      .eq("employment_type", row.employment_type);
    setSavingType(null);
    if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
    else toast({ title: "Gespeichert", description: `${LABELS[row.employment_type]} aktualisiert` });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarClock className="h-4 w-4" /> Buchungs-Limits
        </CardTitle>
        <CardDescription>
          Wie viele Termine pro Tag/Monat darf ein Mitarbeiter je Beschäftigungsart buchen?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lade…
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.employment_type} className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{LABELS[row.employment_type]}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  disabled={savingType === row.employment_type}
                  onClick={() => save(row)}
                >
                  <Save className="h-3 w-3" />
                  {savingType === row.employment_type ? "Speichern…" : "Speichern"}
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Pro Tag</Label>
                  <Input
                    type="number"
                    min={0}
                    value={row.daily_limit}
                    onChange={(e) => update(row.employment_type, { daily_limit: Number(e.target.value) || 0 })}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Pro Monat (leer = kein Limit)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={row.monthly_limit ?? ""}
                    onChange={(e) =>
                      update(row.employment_type, {
                        monthly_limit: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Pause (Tage)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={row.min_pause_days}
                    onChange={(e) => update(row.employment_type, { min_pause_days: Number(e.target.value) || 0 })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}