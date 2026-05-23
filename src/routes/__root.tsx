import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { AuthProvider } from "@/contexts/AuthContext";

import appCss from "../styles.css?url";

const queryClient = new QueryClient();

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Seite nicht gefunden</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Die angeforderte Seite existiert nicht oder wurde verschoben.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#1e40af" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Portal" },
      { name: "mobile-web-app-capable", content: "yes" },
      { title: "Mitarbeiter-Portal" },
      { name: "description", content: "Sicherer Arbeitsbereich für Mitarbeiter" },
      { property: "og:title", content: "Mitarbeiter-Portal" },
      { name: "twitter:title", content: "Mitarbeiter-Portal" },
      { property: "og:description", content: "Sicherer Arbeitsbereich für Mitarbeiter" },
      { name: "twitter:description", content: "Sicherer Arbeitsbereich für Mitarbeiter" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c9222804-957a-4390-8fd1-24fe878e886a/id-preview-9e569e5d--f14c45d5-3cf8-468d-bcb7-d9cae62a6357.lovable.app-1779244306520.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c9222804-957a-4390-8fd1-24fe878e886a/id-preview-9e569e5d--f14c45d5-3cf8-468d-bcb7-d9cae62a6357.lovable.app-1779244306520.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
      { rel: "icon", type: "image/png", href: "/icon-512.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: GlobalErrorComponent,
});

function GlobalErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Etwas ist schiefgelaufen</h1>
        <p className="text-sm text-muted-foreground">
          Bitte versuche die Seite neu zu laden. Falls das Problem bestehen bleibt, kontaktiere bitte den Support.
        </p>
        {error?.message && (
          <details className="text-left text-xs bg-muted/50 p-3 rounded">
            <summary className="cursor-pointer text-muted-foreground">Technische Details</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words">{error.message}</pre>
          </details>
        )}
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => { reset(); if (typeof window !== "undefined") window.location.reload(); }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Neu laden
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <TenantProvider>
            <AuthProvider>
              <Outlet />
              <Toaster />
              <Sonner />
            </AuthProvider>
          </TenantProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
