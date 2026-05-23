import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Info, AlertTriangle, Lightbulb,
  Upload, FileText, PartyPopper,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type TaskStep, type ContentBlock } from "@/lib/task-blocks";

interface Props {
  templateTitle: string;
  templateDescription: string;
  compensation: number;
  imageUrl: string | null;
  steps: TaskStep[];
}

function PreviewInfoBox({ variant, children }: { variant: "info" | "hint" | "warning" | "success"; children: React.ReactNode }) {
  const config = {
    info: { bg: "bg-muted/60", border: "border-border", icon: Info, iconColor: "text-muted-foreground" },
    hint: { bg: "bg-primary/5", border: "border-primary/15", icon: Lightbulb, iconColor: "text-primary" },
    warning: { bg: "bg-status-pending/5", border: "border-status-pending/15", icon: AlertTriangle, iconColor: "text-status-pending" },
    success: { bg: "bg-accent/5", border: "border-accent/15", icon: CheckCircle2, iconColor: "text-accent" },
  };
  const c = config[variant];
  const Icon = c.icon;
  return (
    <div className={cn("flex items-start gap-3 p-4 rounded-xl border", c.bg, c.border)}>
      <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", c.iconColor)} />
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function BlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "text":
      return <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{block.content}</p>;
    case "info":
      return <PreviewInfoBox variant="info"><p className="whitespace-pre-wrap">{block.content}</p></PreviewInfoBox>;
    case "hint":
      return <PreviewInfoBox variant="hint"><p className="whitespace-pre-wrap">{block.content}</p></PreviewInfoBox>;
    case "warning":
      return <PreviewInfoBox variant="warning"><p className="whitespace-pre-wrap">{block.content}</p></PreviewInfoBox>;
    case "success":
      return <PreviewInfoBox variant="success"><p className="whitespace-pre-wrap">{block.content}</p></PreviewInfoBox>;
    case "image":
      return block.imageUrl ? (
        <div className="rounded-xl overflow-hidden border border-border">
          <img src={block.imageUrl} alt="" className="w-full h-48 object-cover" />
        </div>
      ) : null;
    case "input":
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">{block.label || "Eingabe"} {block.required && <span className="text-destructive">*</span>}</label>
          <Input placeholder={block.placeholder || "Antwort eingeben…"} disabled />
        </div>
      );
    case "question":
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">{block.label || "Frage"} {block.required && <span className="text-destructive">*</span>}</label>
          <Textarea placeholder={block.placeholder || "Antwort eingeben…"} rows={2} disabled />
        </div>
      );
    case "yes_no":
      return (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{block.label || "Frage"} {block.required && <span className="text-destructive">*</span>}</label>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" disabled>Ja</Button>
            <Button variant="outline" size="sm" disabled>Nein</Button>
          </div>
        </div>
      );
    case "upload":
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            {block.content || "Datei hochladen"} {block.required && <span className="text-destructive">*</span>}
          </label>
          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
            <Upload className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Datei hierhin ziehen oder klicken</p>
          </div>
        </div>
      );
    case "checkpoint":
      return (
        <PreviewInfoBox variant="success">
          <p className="font-medium">{block.content || "Kontrollpunkt erreicht"}</p>
        </PreviewInfoBox>
      );
    default:
      return null;
  }
}

export function TaskStepPreview({ templateTitle, templateDescription, compensation, imageUrl, steps }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = steps.length + 1; // +1 for intro
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-border bg-card flex-col shrink-0">
        <div className="p-5 border-b border-border">
          <h2 className="text-sm font-heading font-bold text-foreground truncate">{templateTitle}</h2>
          <p className="text-xs text-muted-foreground mt-1">{compensation.toFixed(2)} €</p>
        </div>
        <div className="flex-1 p-4 space-y-1">
          {/* Intro step */}
          <div className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
            currentStep === 0 ? "bg-primary/10 text-primary font-medium" : currentStep > 0 ? "text-accent" : "text-foreground",
          )}>
            <div className={cn(
              "h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
              currentStep === 0 ? "bg-primary text-primary-foreground" : "bg-accent/10",
            )}>
              {currentStep > 0 ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-3.5 w-3.5" />}
            </div>
            <span>Einführung</span>
          </div>

          {steps.map((s, i) => {
            const stepIdx = i + 1;
            const isDone = currentStep > stepIdx;
            const isCurrent = currentStep === stepIdx;
            return (
              <div key={s.id} className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                isCurrent && "bg-primary/10 text-primary font-medium",
                isDone && "text-accent",
                !isCurrent && !isDone && "text-muted-foreground/40",
              )}>
                <div className={cn(
                  "h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                  isCurrent && "bg-primary text-primary-foreground",
                  isDone && "bg-accent/10",
                  !isCurrent && !isDone && "bg-muted",
                )}>
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <span className="truncate">{s.title || `Schritt ${i + 1}`}</span>
              </div>
            );
          })}
        </div>
        <div className="p-4 border-t border-border">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Fortschritt</p>
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground mt-1.5">{currentStep + 1} von {totalSteps}</p>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-6 lg:p-8 max-w-3xl mx-auto w-full space-y-6">
          {currentStep === 0 && (
            <div className="space-y-6 animate-fade-in">
              {imageUrl && (
                <div className="h-48 rounded-2xl overflow-hidden bg-muted">
                  <img src={imageUrl} alt={templateTitle} className="w-full h-full object-cover" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-heading font-bold text-foreground">{templateTitle}</h1>
                <p className="text-muted-foreground mt-2">{templateDescription}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <PreviewInfoBox variant="info">
                  <p className="font-medium">Vergütung</p>
                  <p className="text-accent font-bold text-lg mt-1">{compensation.toFixed(2)} €</p>
                </PreviewInfoBox>
                <PreviewInfoBox variant="hint">
                  <p className="font-medium">So funktioniert's</p>
                  <p className="text-muted-foreground mt-1">Folge den {steps.length} Schritten und reiche dein Ergebnis ein.</p>
                </PreviewInfoBox>
              </div>
            </div>
          )}

          {currentStep > 0 && steps[currentStep - 1] && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-xl font-heading font-bold text-foreground">{steps[currentStep - 1].title}</h2>
                {steps[currentStep - 1].description && (
                  <p className="text-muted-foreground mt-1">{steps[currentStep - 1].description}</p>
                )}
              </div>
              {steps[currentStep - 1].content_blocks.map((block) => (
                <BlockRenderer key={block.id} block={block} />
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="border-t border-border bg-card px-6 py-4 shrink-0">
          <div className="max-w-3xl mx-auto flex justify-between items-center">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" /> Zurück
            </Button>
            <div className="hidden sm:flex items-center gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === currentStep ? "w-6 bg-primary" : i < currentStep ? "w-3 bg-accent" : "w-3 bg-muted",
                )} />
              ))}
            </div>
            <Button
              onClick={() => setCurrentStep(Math.min(totalSteps - 1, currentStep + 1))}
              disabled={currentStep >= totalSteps - 1}
              className="gap-1"
            >
              {currentStep < totalSteps - 1
                ? (steps[currentStep]?.button_label || "Weiter")
                : "Fertig"
              }
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
