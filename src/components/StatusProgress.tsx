import { STATUS_ORDER, STATUS_CONFIG, type EmployeeStatus, type KycStatus, type OnboardingStatus } from "@/lib/status";
import { CheckCircle2, Circle } from "lucide-react";

interface StatusProgressProps {
  currentStatus: EmployeeStatus;
  kycStatus?: KycStatus;
  contractSigned?: boolean;
  onboardingStatus?: OnboardingStatus;
}

export function StatusProgress({ currentStatus, kycStatus, contractSigned, onboardingStatus }: StatusProgressProps) {
  const currentStep = STATUS_CONFIG[currentStatus].step;

  return (
    <div className="space-y-3">
      {STATUS_ORDER.map((status) => {
        const config = STATUS_CONFIG[status];
        const isComplete = config.step < currentStep;
        const isCurrent = status === currentStatus;

        return (
          <div key={status}>
            <div className="flex items-center gap-3">
              {isComplete ? (
                <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
              ) : isCurrent ? (
                <div className="h-5 w-5 rounded-full border-2 border-primary bg-primary/20 shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
              )}
              <span className={`text-sm ${isCurrent ? "font-semibold text-foreground" : isComplete ? "text-muted-foreground line-through" : "text-muted-foreground/60"}`}>
                {config.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
