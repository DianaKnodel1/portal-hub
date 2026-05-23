import { Outlet, useNavigate } from "@/lib/router-compat";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { LayoutGrid, FileText, Users, ClipboardList, CheckSquare, CalendarDays, Wallet, LogOut, MessageCircle, RotateCcw, History, Settings, Phone, Mail, Mailbox, Search, ShieldCheck, LayoutDashboard, Globe, Upload } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdminCommandPalette } from "@/components/AdminCommandPalette";
import { useAdminBadges } from "@/hooks/use-admin-badges";
import { useEffect } from "react";

// Schlanke operative Navigation. Setup-Bereiche (Domains, KI, Teamleiter, E-Mail-Vorlagen,
// Standard-Aufträge, Buchungslimits, Passwort) liegen unter /admin/settings.
const navItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard, end: true },
  { title: "Bewerbungen", url: "/admin/applications", icon: FileText, badgeKey: "newApplications" as const },
  { title: "Mitarbeiter", url: "/admin/employees", icon: Users },
  { title: "KYC", url: "/admin/kyc", icon: ShieldCheck, badgeKey: "pendingKyc" as const },
  { title: "Aufträge", url: "/admin/tasks", icon: ClipboardList },
  { title: "Prüfungen", url: "/admin/reviews", icon: CheckSquare },
  { title: "Nachbesserungen", url: "/admin/revisions", icon: RotateCcw },
  { title: "Uploads", url: "/admin/uploads", icon: Upload },
  { title: "Termine", url: "/admin/appointments", icon: CalendarDays },
  { title: "Chat", url: "/admin/chat", icon: MessageCircle, badgeKey: "unreadChat" as const },
  { title: "SMS", url: "/admin/sms", icon: Phone },
  { title: "Post", url: "/admin/post", icon: Mailbox },
  { title: "Transaktionen", url: "/admin/transactions", icon: Wallet },
  { title: "E-Mail-Logs", url: "/admin/email-logs", icon: Mail },
  { title: "Verträge", url: "/admin/contracts", icon: FileText },
  { title: "Landing Pages", url: "/admin/landing-generator", icon: Globe },
  { title: "Protokoll", url: "/admin/activity", icon: History },
  { title: "Einstellungen", url: "/admin/settings", icon: Settings },
];

type BadgeKey = "unreadChat" | "pendingKyc" | "newApplications";
type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutGrid;
  end?: boolean;
  badgeKey?: BadgeKey;
};

function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();
  const badges = useAdminBadges();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarContent className="flex flex-col h-full">
        {/* Brand */}
        <div className={collapsed ? "px-2 py-4 flex justify-center" : "px-4 py-4 flex items-center gap-2.5"}>
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 grid place-items-center text-white text-sm font-bold shadow-sm shrink-0">
            A
          </div>
          {!collapsed && (
            <span className="text-[15px] font-bold text-sidebar-foreground tracking-tight">ADMIN</span>
          )}
        </div>

        {/* Flache Navigation */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <SidebarGroup className="py-0">
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {navItems.map((item) => {
                  const count = (item as any).badgeKey ? badges[(item as any).badgeKey as BadgeKey] : 0;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end={(item as any).end}
                          className="relative flex! flex-row! flex-nowrap! items-center! gap-2.5 px-2.5 h-auto! min-h-9 rounded-lg text-[12.5px] font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors overflow-hidden whitespace-nowrap"
                          activeClassName="bg-blue-600! text-white! shadow-[0_2px_8px_-2px_rgba(37,99,235,0.45)] hover:bg-blue-600!"
                        >
                          <item.icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.75} />
                          {!collapsed && <span className="truncate min-w-0">{item.title}</span>}
                          {count > 0 && (
                            <span
                              className={
                                collapsed
                                  ? "absolute top-1 right-1 inline-flex h-3.5 min-w-[14px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-medium items-center justify-center leading-none"
                                  : "ml-auto inline-flex h-[18px] min-w-[18px] w-auto px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-semibold items-center justify-center leading-none shrink-0"
                              }
                            >
                              {count > 99 ? "99+" : count}
                            </span>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>

        {/* Logout */}
        <div className="border-t border-sidebar-border p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={signOut}
                className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent text-[12.5px] font-medium gap-3 py-2"
              >
                <LogOut className="h-[17px] w-[17px] shrink-0" strokeWidth={1.75} />
                {!collapsed && <span>Abmelden</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

export default function AdminLayout() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/login");
    if (!loading && user && !isAdmin) navigate("/dashboard");
  }, [user, isAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/20 animate-pulse" />
          <p className="text-sm text-muted-foreground">Laden…</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full admin-layout">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0 bg-background">
          <header className="h-12 flex items-center border-b border-border bg-card px-5 gap-3 shrink-0">
            <SidebarTrigger />
            <div className="h-4 w-px bg-border" />
            <span className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider">Admin Panel</span>
            <button
              onClick={() => {
                // Synthetic Cmd+K
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
              }}
              className="ml-4 hidden sm:flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1 transition-colors"
              title="Schnellsuche"
            >
              <Search className="h-3.5 w-3.5" /> Suchen…
              <kbd className="ml-2 text-[10px] bg-muted px-1 py-0.5 rounded">⌘K</kbd>
            </button>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
          <AdminCommandPalette />
        </div>
      </div>
    </SidebarProvider>
  );
}
