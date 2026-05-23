import { useEffect, useMemo, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useNavigate } from "@/lib/router-compat";
import { useAdminData } from "@/contexts/AdminDataContext";
import { Users, FileText, ClipboardList, Mailbox, LayoutGrid, Settings, CalendarDays, Wallet, MessageCircle, Phone } from "lucide-react";

const PAGES: { label: string; path: string; icon: any }[] = [
  { label: "Dashboard", path: "/admin", icon: LayoutGrid },
  { label: "Bewerbungen", path: "/admin/applications", icon: FileText },
  { label: "Mitarbeiter", path: "/admin/employees", icon: Users },
  { label: "Aufgaben", path: "/admin/tasks", icon: ClipboardList },
  { label: "Termine", path: "/admin/appointments", icon: CalendarDays },
  { label: "Chat", path: "/admin/chat", icon: MessageCircle },
  { label: "SMS", path: "/admin/sms", icon: Phone },
  { label: "Post", path: "/admin/post", icon: Mailbox },
  { label: "Transaktionen", path: "/admin/transactions", icon: Wallet },
  { label: "Einstellungen", path: "/admin/settings", icon: Settings },
];

export function AdminCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { profiles, applications, assignments } = useAdminData();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const q = query.trim().toLowerCase();

  const matchedEmployees = useMemo(() => {
    if (!q) return profiles.slice(0, 5);
    return profiles
      .filter((p: any) =>
        (p.full_name ?? "").toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.phone ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [profiles, q]);

  const matchedApplications = useMemo(() => {
    if (!q) return [];
    return applications
      .filter((a: any) =>
        (a.full_name ?? "").toLowerCase().includes(q) ||
        (a.email ?? "").toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [applications, q]);

  const matchedAssignments = useMemo(() => {
    if (!q) return [];
    return assignments
      .filter((a: any) =>
        (a.id ?? "").toLowerCase().includes(q) ||
        (a.task_templates?.title ?? "").toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [assignments, q]);

  const go = (path: string) => {
    setOpen(false);
    setQuery("");
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Suche nach Mitarbeitern, Bewerbungen, Seiten…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>Nichts gefunden.</CommandEmpty>

        <CommandGroup heading="Seiten">
          {PAGES.filter((p) => !q || p.label.toLowerCase().includes(q)).map((p) => (
            <CommandItem key={p.path} onSelect={() => go(p.path)}>
              <p.icon className="h-4 w-4 mr-2" /> {p.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {matchedEmployees.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Mitarbeiter">
              {matchedEmployees.map((p: any) => (
                <CommandItem key={p.user_id} onSelect={() => go(`/admin/employees/${p.user_id}`)}>
                  <Users className="h-4 w-4 mr-2" />
                  <span>{p.full_name ?? "Unbenannt"}</span>
                  {p.email && <span className="ml-2 text-xs text-muted-foreground">{p.email}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {matchedApplications.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Bewerbungen">
              {matchedApplications.map((a: any) => (
                <CommandItem key={a.id} onSelect={() => go(`/admin/applications/${a.id}`)}>
                  <FileText className="h-4 w-4 mr-2" />
                  <span>{a.full_name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{a.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {matchedAssignments.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Aufträge">
              {matchedAssignments.map((a: any) => (
                <CommandItem key={a.id} onSelect={() => go(`/admin/assignments/${a.id}`)}>
                  <ClipboardList className="h-4 w-4 mr-2" />
                  <span>{a.task_templates?.title ?? "Auftrag"}</span>
                  <span className="ml-2 text-xs text-muted-foreground">#{a.id.slice(0, 8)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
