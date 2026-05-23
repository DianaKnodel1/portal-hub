// Theme-Registry: hier später weitere Themes (theme-02..theme-06) ergänzen.
// Importiert HTML/CSS/JS als raw Strings, damit sie im Server-Function-Bundle
// (Cloudflare Workers) verfügbar sind — kein FS-Zugriff zur Laufzeit.

import theme01Html from "../landing-themes/theme-01/template.html?raw";
import theme01Css from "../landing-themes/theme-01/style.css?raw";
import theme01Js from "../landing-themes/theme-01/script.js?raw";
import theme01Meta from "../landing-themes/theme-01/meta.json";

export type ThemeFiles = {
  id: string;
  name: string;
  description: string;
  html: string;
  css: string;
  js: string;
};

export const THEMES: ThemeFiles[] = [
  {
    id: theme01Meta.id,
    name: theme01Meta.name,
    description: theme01Meta.description,
    html: theme01Html,
    css: theme01Css,
    js: theme01Js,
  },
];

export function getTheme(id: string): ThemeFiles | undefined {
  return THEMES.find((t) => t.id === id);
}

export const THEME_LIST = THEMES.map((t) => ({
  id: t.id,
  name: t.name,
  description: t.description,
}));