// Content block types for structured task steps

export type BlockType =
  | "text"
  | "info"
  | "hint"
  | "warning"
  | "success"
  | "upload"
  | "question"
  | "yes_no"
  | "input"
  | "image"
  | "qr"
  | "checkpoint";

export interface ContentBlock {
  id: string;
  type: BlockType;
  content: string;       // Main text content
  label?: string;        // Label for inputs/questions
  required?: boolean;    // Whether this block requires user action
  placeholder?: string;  // Placeholder for inputs
  imageUrl?: string;     // URL for image blocks
}

export interface TaskStep {
  id: string;
  task_template_id: string;
  step_number: number;
  title: string;
  description: string;
  content_blocks: ContentBlock[];
  is_required: boolean;
  button_label: string;
}

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  text: "Text",
  info: "Info-Box",
  hint: "Hinweis-Box",
  warning: "Warn-Box",
  success: "Erfolg-Box",
  upload: "Datei-Upload",
  question: "Freitext-Frage",
  yes_no: "Ja/Nein-Frage",
  input: "Eingabefeld",
  image: "Bild",
  qr: "QR-Code",
  checkpoint: "Kontrollpunkt",
};

export const BLOCK_TYPE_ICONS: Record<BlockType, string> = {
  text: "📝",
  info: "ℹ️",
  hint: "💡",
  warning: "⚠️",
  success: "✅",
  upload: "📎",
  question: "❓",
  yes_no: "✋",
  input: "✏️",
  image: "🖼️",
  qr: "📱",
  checkpoint: "🔒",
};

export function createBlock(type: BlockType): ContentBlock {
  return {
    id: crypto.randomUUID(),
    type,
    content: "",
    label: type === "question" || type === "yes_no" || type === "input" ? "" : undefined,
    required: type === "upload" || type === "question" || type === "input" || type === "yes_no" || type === "checkpoint",
    placeholder: type === "input" || type === "question" ? "Antwort eingeben…" : undefined,
  };
}

export function createStep(templateId: string, stepNumber: number): Omit<TaskStep, "id"> {
  return {
    task_template_id: templateId,
    step_number: stepNumber,
    title: `Schritt ${stepNumber}`,
    description: "",
    content_blocks: [],
    is_required: true,
    button_label: "Weiter",
  };
}
