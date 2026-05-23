import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface JourneyStep {
  label: string;
  done: boolean;
  active?: boolean;
}

interface JourneyProgressProps {
  steps: JourneyStep[];
  className?: string;
}

export function JourneyProgress({ steps, className }: JourneyProgressProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            {step.done ? (
              <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
            ) : step.active ? (
              <div className="h-5 w-5 rounded-full border-2 border-primary bg-primary/10 flex items-center justify-center shrink-0">
                <div className="h-2 w-2 rounded-full bg-primary" />
              </div>
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground/30 shrink-0" />
            )}
            {i < steps.length - 1 && (
              <div className={cn("w-0.5 h-6 my-0.5", step.done ? "bg-accent" : "bg-border")} />
            )}
          </div>
          <span
            className={cn(
              "text-sm -mt-0.5",
              step.done
                ? "text-muted-foreground line-through"
                : step.active
                ? "text-foreground font-semibold"
                : "text-muted-foreground/60"
            )}
          >
            {step.label}
          </span>
          {step.active && <ChevronRight className="h-3.5 w-3.5 text-primary -mt-0.5" />}
        </div>
      ))}
    </div>
  );
}
