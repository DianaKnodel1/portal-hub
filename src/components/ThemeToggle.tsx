import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant={variant}
      size="sm"
      onClick={toggleTheme}
      className="gap-2"
      title={theme === "dark" ? "Hellen Modus aktivieren" : "Dunklen Modus aktivieren"}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="text-sm">{theme === "dark" ? "Hell" : "Dunkel"}</span>
    </Button>
  );
}
