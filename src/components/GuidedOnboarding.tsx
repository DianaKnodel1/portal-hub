import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, X, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface TourStep {
  id: string;
  title: string;
  text: string;
  target?: string;       // CSS selector – falls leer: zentriert
  route?: string;        // wenn gesetzt: vorher dorthin navigieren
  placement?: "top" | "bottom" | "left" | "right" | "center";
}

const STEPS: TourStep[] = [
  { id: "welcome",          title: "Willkommen im Team!",      text: "Führen Sie nun diese Tour durch, um einen Einblick in die Funktionen Ihres digitalen Arbeitsplatzes zu verschaffen.", route: "/dashboard", placement: "center" },
  { id: "help",             title: "Einführung starten",       text: "Sie können diese Einführung jederzeit noch einmal wiederholen, wenn Sie auf diesen Button klicken.", target: "[data-tour='help-button']", placement: "left" },
  { id: "checklist",        title: "Die To-Do Liste",          text: "Ihre To-Do Liste gibt Ihnen Hinweise, was noch zu erledigen ist. Hier werden unter anderem aktive Aufträge oder andere Aufgaben angezeigt.", target: "[data-tour='tasks-list']", placement: "top" },
  { id: "transactions",     title: "Transaktionen",            text: "In dieser Tabelle sehen Sie alle Ihre Transaktionen, darunter Gutschriften für erledigte Aufträge und Gehaltsauszahlungen.", target: "[data-tour='transactions']", placement: "top" },
  { id: "upcoming",         title: "Termine",                  text: "Hier sehen Sie Ihre zukünftigen Termine. So haben Sie einen Überblick, welche Termine anstehen und können diese gegebenenfalls absagen.", target: "[data-tour='next-appointment']", placement: "left" },
  { id: "nav-appointments", title: "Termin buchen",            text: "Hier können Sie neue Termine buchen. Klicken Sie auf diesen Menüpunkt, um zur Terminbuchung zu gelangen.", target: "[data-tour='nav-appointments']", placement: "right" },
  { id: "calendar",         title: "Terminkalender",           text: "Hier können Sie das Datum und die Uhrzeit für den nächsten Auftrag auswählen.", route: "/appointments", target: "[data-tour='calendar']", placement: "right" },
  { id: "book-btn",         title: "Termin buchen",            text: "Mit diesem Button können Sie den ausgewählten Termin buchen.", route: "/appointments", target: "[data-tour='book-button']", placement: "right" },
  { id: "nav-tasks",        title: "Aufträge",                 text: "Hier finden Sie alle Ihre Aufträge. Klicken Sie auf diesen Menüpunkt, um zur Auftragsübersicht zu gelangen.", target: "[data-tour='nav-tasks']", placement: "right" },
  { id: "tasks-list",       title: "Auftragsübersicht",        text: "Hier sehen Sie alle Ihnen zugewiesenen Aufträge mit Status und Details. Klicken Sie auf einen Auftrag, um die einzelnen Schritte zu bearbeiten.", route: "/tasks", target: "[data-tour='tasks-list']", placement: "top" },
  { id: "nav-documents",    title: "Upload Center",            text: "Im Upload Center können Sie wichtige Dokumente wie Ihren Ausweis oder andere Nachweise hochladen.", route: "/dashboard", target: "[data-tour='nav-documents']", placement: "right" },
  { id: "nav-notifications",title: "Mitteilungen",             text: "Wichtige Mitteilungen und Ankündigungen Ihrer Teamleitung erhalten Sie in diesem Bereich.", target: "[data-tour='nav-notifications']", placement: "right" },
  { id: "nav-settings",     title: "Einstellungen",            text: "Unter Einstellungen können Sie Ihre persönlichen Daten, Passwort und Benachrichtigungen verwalten.", target: "[data-tour='nav-settings']", placement: "right" },
  { id: "chat",             title: "Mitarbeiterchat",          text: "Sollten Fragen egal welcher Art auftreten, zögern Sie nicht Ihre Teamleitung über den Mitarbeiterchat zu kontaktieren.", target: "[data-tour='chat']", placement: "left" },
  { id: "done",             title: "Tour abgeschlossen!",      text: "Sie kennen jetzt die wichtigsten Bereiche Ihres Arbeitsplatzes. Viel Erfolg bei Ihrer Tätigkeit – Ihre Teamleitung steht Ihnen jederzeit zur Seite.", placement: "center" },
];

const TOTAL = STEPS.length;
const STORAGE_PREFIX = "guided_tour_v2_";
const TOOLTIP_W = 320;
const TOOLTIP_GAP = 14;

function computePosition(rect: DOMRect | null, placement: TourStep["placement"]) {
  if (!rect || placement === "center" || !placement) {
    return { left: window.innerWidth / 2 - TOOLTIP_W / 2, top: window.innerHeight / 2 - 120, placement: "center" as const };
  }
  const tooltipH = 200;
  let left = 0, top = 0;
  switch (placement) {
    case "right":
      left = rect.right + TOOLTIP_GAP;
      top = rect.top + rect.height / 2 - tooltipH / 2;
      break;
    case "left":
      left = rect.left - TOOLTIP_W - TOOLTIP_GAP;
      top = rect.top + rect.height / 2 - tooltipH / 2;
      break;
    case "top":
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
      top = rect.top - tooltipH - TOOLTIP_GAP;
      break;
    case "bottom":
    default:
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
      top = rect.bottom + TOOLTIP_GAP;
      break;
  }
  // Clamp
  left = Math.max(12, Math.min(left, window.innerWidth - TOOLTIP_W - 12));
  top = Math.max(12, Math.min(top, window.innerHeight - tooltipH - 12));
  return { left, top, placement };
}

interface TourViewProps {
  onClose: () => void;
}

function TourView({ onClose }: TourViewProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tick, setTick] = useState(0);
  const [routeReady, setRouteReady] = useState(true);
  const findTimeoutRef = useRef<number | null>(null);

  const step = STEPS[stepIdx];

  // Navigate to required route
  useEffect(() => {
    if (step.route && location.pathname !== step.route) {
      setRouteReady(false);
      setRect(null);
      navigate(step.route);
      return;
    }
    setRouteReady(true);
  }, [stepIdx, step.route, location.pathname, navigate]);

  // Find target element (poll up to 2s for DOM)
  useEffect(() => {
    if (findTimeoutRef.current) window.clearTimeout(findTimeoutRef.current);
    if (!routeReady) return;
    if (!step.target) { setRect(null); return; }

    let attempts = 0;
    const find = () => {
      const el = document.querySelector(step.target!) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        setTimeout(() => {
          const r = el.getBoundingClientRect();
          setRect(r);
        }, 250);
      } else if (attempts < 20) {
        attempts++;
        findTimeoutRef.current = window.setTimeout(find, 100);
      } else {
        setRect(null); // fallback: zentriert
      }
    };
    find();
    return () => { if (findTimeoutRef.current) window.clearTimeout(findTimeoutRef.current); };
  }, [stepIdx, location.pathname, tick, routeReady, step.target]);

  // Recompute on resize/scroll
  useEffect(() => {
    const onResize = () => setTick((t) => t + 1);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, []);

  const next = () => {
    if (stepIdx < TOTAL - 1) setStepIdx(stepIdx + 1);
    else onClose();
  };
  const back = () => { if (stepIdx > 0) setStepIdx(stepIdx - 1); };

  const pos = computePosition(rect, step.placement);
  const progress = ((stepIdx + 1) / TOTAL) * 100;

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {/* Dezente Backdrop – Spotlight ohne harte Abdunkelung */}
      {rect && pos.placement !== "center" ? (
        <div
          className="absolute pointer-events-auto transition-all duration-300 rounded-lg"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.25)",
            outline: "2px solid hsl(var(--primary))",
            outlineOffset: "2px",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/25 pointer-events-auto" />
      )}

      {/* Tooltip card */}
      <div
        className="absolute pointer-events-auto bg-card text-card-foreground rounded-xl shadow-2xl border border-border animate-fade-in"
        style={{ left: pos.left, top: pos.top, width: TOOLTIP_W }}
      >
        {/* Top progress bar */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">Schritt {stepIdx + 1} von {TOTAL}</span>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Schließen">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="px-5 py-3">
          <h3 className="text-base font-heading font-bold text-foreground">{step.title}</h3>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{step.text}</p>
        </div>

        <div className="px-5 pb-4 pt-2 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={back} disabled={stepIdx === 0} className="gap-1 text-muted-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Zurück
          </Button>
          <Button size="sm" onClick={next} className="gap-1">
            {stepIdx === TOTAL - 1 ? "Fertig" : "Weiter"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function GuidedOnboarding() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    const key = `${STORAGE_PREFIX}${user.id}`;
    const done = localStorage.getItem(key);
    if (done) { setReady(true); return; }
    // Tour startet NUR explizit über "Tour starten"-Button (sessionStorage-Flag)
    // oder über den Hilfe-Button im Header. Kein Auto-Start mehr.
    if (sessionStorage.getItem(`start_tour_${user.id}`) === "1") {
      sessionStorage.removeItem(`start_tour_${user.id}`);
      setShow(true);
    }
    setReady(true);
  }, [user]);

  const close = useCallback(() => {
    if (user) localStorage.setItem(`${STORAGE_PREFIX}${user.id}`, "true");
    setShow(false);
  }, [user]);

  if (!ready || !show) return null;
  return <TourView onClose={close} />;
}

export function HelpButton() {
  // Floating help button removed in favor of HeaderHelpButton — kept as no-op for backwards compatibility.
  return null;
}

export function HeaderHelpButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const restart = () => {
    if (user) localStorage.removeItem(`${STORAGE_PREFIX}${user.id}`);
    setOpen(true);
  };

  return (
    <>
      <button
        onClick={restart}
        data-tour="help-button"
        className="h-9 w-9 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
        title="Tour erneut starten"
        aria-label="Hilfe / Tour starten"
      >
        <HelpCircle className="h-[18px] w-[18px] text-muted-foreground" />
      </button>
      {open && <TourView onClose={() => setOpen(false)} />}
    </>
  );
}
