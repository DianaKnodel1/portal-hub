import { useNavigate } from "@/lib/router-compat";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatActionButtonsProps {
  actions: { label: string; path: string }[];
  compact?: boolean;
}

export function ChatActionButtons({ actions, compact = false }: ChatActionButtonsProps) {
  const navigate = useNavigate();

  if (actions.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", compact ? "mt-2" : "mt-3")}>
      {actions.map((action) => (
        <button
          key={action.path}
          onClick={(e) => {
            e.stopPropagation();
            navigate(action.path);
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl font-semibold transition-all duration-200",
            "hover:scale-[1.03] active:scale-[0.97] hover:shadow-md",
            compact
              ? "text-[11px] px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20"
              : "text-xs px-3.5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20"
          )}
        >
          {action.label}
          <ArrowRight className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
        </button>
      ))}
    </div>
  );
}
