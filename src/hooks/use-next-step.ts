import { useMemo } from "react";
import {
  FileText, GraduationCap, CalendarDays, ClipboardList, Timer,
} from "lucide-react";

export interface NextStepInfo {
  id: string;
  label: string;
  desc: string;
  cta: string;
  path: string;
  icon: any;
  chatHint: string;
}

interface StepInput {
  kycStatus: string;
  hasPersonalData: boolean;
  contractSigned: boolean;
  onboardingDone: boolean;
  hasAppointment: boolean;
  hasOpenTasks: boolean;
  hasScheduledTask?: boolean;
}

const STEPS: (NextStepInfo & { check: (s: StepInput) => boolean })[] = [
  {
    id: "contract",
    label: "Arbeitsvertrag unterschreiben",
    desc: "Digitale Unterschrift für deinen Vertrag",
    cta: "Vertrag öffnen",
    path: "/contract",
    icon: FileText,
    chatHint: "Vertrag",
    check: (s) => !s.contractSigned,
  },
  {
    id: "onboarding",
    label: "Einführung abschließen",
    desc: "Lerne die wichtigsten Abläufe kennen",
    cta: "Einführung starten",
    path: "/onboarding",
    icon: GraduationCap,
    chatHint: "Einführung",
    check: (s) => !s.onboardingDone,
  },
  {
    id: "appointment",
    label: "Termin buchen",
    desc: "Buche deinen Termin, um deine erste Aufgabe zu erhalten",
    cta: "Termin buchen",
    path: "/appointments",
    icon: CalendarDays,
    chatHint: "Termin",
    check: (s) => !s.hasAppointment,
  },
  {
    id: "scheduled",
    label: "Aufgabe wird vorbereitet",
    desc: "Deine Aufgabe wird zum Terminzeitpunkt freigeschaltet",
    cta: "Termin ansehen",
    path: "/appointments",
    icon: Timer,
    chatHint: "Aufgabe",
    check: (s) => !!s.hasScheduledTask && !s.hasOpenTasks,
  },
  {
    id: "task",
    label: "Auftrag bearbeiten",
    desc: "Starte mit deinem nächsten Auftrag",
    cta: "Zum Auftrag",
    path: "/tasks",
    icon: ClipboardList,
    chatHint: "Aufträge",
    check: (s) => s.hasOpenTasks,
  },
];

export function useNextStep(input: StepInput): NextStepInfo | null {
  return useMemo(() => {
    for (const step of STEPS) {
      if (step.check(input)) {
        const { check, ...info } = step;
        return info;
      }
    }
    return null;
  }, [
    input.contractSigned,
    input.onboardingDone,
    input.hasAppointment,
    input.hasOpenTasks,
    input.hasScheduledTask,
  ]);
}

/** Extract action routes from system messages for rendering as buttons */
export function extractChatActions(message: string): { label: string; path: string }[] {
  const actions: { label: string; path: string }[] = [];
  
  const patterns: { match: RegExp; label: string; path: string }[] = [
    { match: /[Vv]ertrag/i, label: "Zum Vertrag", path: "/contract" },
    { match: /[Tt]ermin/i, label: "Termine ansehen", path: "/appointments" },
    { match: /[Aa]uftrag|[Aa]ufträge|[Aa]ufgabe/i, label: "Zu den Aufträgen", path: "/tasks" },
    { match: /[Ee]inführung|[Oo]nboarding/i, label: "Zur Einführung", path: "/onboarding" },
    { match: /[Ee]innahmen|[Vv]ergütung/i, label: "Einnahmen ansehen", path: "/earnings" },
  ];

  for (const p of patterns) {
    if (p.match.test(message)) {
      if (!actions.some((a) => a.path === p.path)) {
        actions.push({ label: p.label, path: p.path });
      }
    }
  }

  return actions.slice(0, 2);
}
