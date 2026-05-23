import { Progress } from "@/components/ui/progress";
import { CheckCircle2, UserPlus, IdCard, MapPin, Home, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Konto", icon: UserPlus },
  { label: "Person", icon: IdCard },
  { label: "Adresse", icon: MapPin },
  { label: "Wohndauer", icon: Home },
  { label: "Job", icon: Briefcase },
];

interface Props {
  step: number;
}

export default function WizardProgress({ step }: Props) {
  // Done-Screen (step 99): keine Fortschrittsanzeige
  if (step >= STEPS.length) return null;

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Schritt {step + 1} von {STEPS.length}
        </p>
        <p className="text-xs font-bold text-primary">{Math.round(progress)}%</p>
      </div>
      <Progress value={progress} className="h-2" />
      <div className="flex justify-between mt-3">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center transition-all",
                i < step ? "bg-accent/10 text-accent" :
                i === step ? "bg-primary/10 text-primary ring-2 ring-primary/20" :
                "bg-muted text-muted-foreground/40",
              )}>
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className={cn("text-[10px]", i === step ? "text-primary font-semibold" : "text-muted-foreground/50")}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
