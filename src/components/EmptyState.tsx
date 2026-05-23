import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <Card className="border-dashed animate-fade-in border-none shadow-sm">
      <CardContent className="flex flex-col items-center justify-center py-20 px-8">
        <div className="h-16 w-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-6">
          <Icon className="h-7 w-7 text-primary/40" />
        </div>
        <h3 className="text-base font-heading font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">{description}</p>
        {actionLabel && onAction && (
          <Button onClick={onAction} variant="default" size="sm" className="mt-6 gap-1.5 rounded-xl">
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
