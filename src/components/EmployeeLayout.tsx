import { Outlet, useNavigate, useLocation } from "@/lib/router-compat";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { NavLink } from "@/components/NavLink";
import { GuidedOnboarding, HelpButton, HeaderHelpButton } from "@/components/GuidedOnboarding";
import { OnboardingPopup } from "@/components/OnboardingPopup";
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
import {
  LayoutDashboard,
  Bell,
  ShieldCheck,
  FileSignature,
  CalendarDays,
  ClipboardList,
  UploadCloud,
  Wallet,
  MessageSquare,
  Settings,
  LogOut,
  Lock,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { FloatingChat } from "@/components/FloatingChat";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { EmployeeStatus } from "@/lib/status";
import { hasFullAccess } from "@/lib/employee-utils";
import { cn } from "@/lib/utils";

const ALWAYS_ALLOWED_PATHS = ["/dashboard", "/verification", "/contract", "/onboarding", "/personal-data", "/payroll-data", "/settings", "/documents"];

// Mitbewerber-Navigation (1:1) – mit farbigen Icons
type NavItem = {
  title: string;
  url: string;
  icon: any;
  requiresActive: boolean;
  dot?: "orange" | "blue" | null;
};

function buildNavItems(opts: {
  kycPending: boolean;
  kycRejected: boolean;
  contractPending: boolean;
}): NavItem[] {
  const items: NavItem[] = [
    { title: "Übersicht", url: "/dashboard", icon: LayoutDashboard, requiresActive: false },
    { title: "Mitteilungen", url: "/notifications", icon: Bell, requiresActive: false },
  ];

  if (opts.kycPending || opts.kycRejected) {
    items.push({
      title: "Verifizierung",
      url: "/verification",
      icon: ShieldCheck,
      requiresActive: false,
      dot: "orange",
    });
  }

  if (opts.contractPending) {
    items.push({
      title: "Arbeitsvertrag",
      url: "/contract",
      icon: FileSignature,
      requiresActive: false,
      dot: "blue",
    });
  }

  items.push(
    { title: "Termin buchen", url: "/appointments", icon: CalendarDays, requiresActive: true },
    { title: "Aufträge", url: "/tasks", icon: ClipboardList, requiresActive: true },
    { title: "Upload Center", url: "/documents", icon: UploadCloud, requiresActive: false },
    { title: "Einstellungen", url: "/settings", icon: Settings, requiresActive: false },
  );

  return items;
}

function EmployeeSidebar({
  employeeStatus,
  kycPending,
  kycRejected,
  contractPending,
}: {
  employeeStatus: EmployeeStatus | null;
  kycPending: boolean;
  kycRejected: boolean;
  contractPending: boolean;
}) {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();
  const { tenant } = useTenant();
  const isActive = hasFullAccess(employeeStatus);
  const items = buildNavItems({ kycPending, kycRejected, contractPending });

  const brandName = "Mitarbeiter-Portal";
  const brandInitial = "M";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar" data-tour="sidebar">
      <SidebarContent className="flex flex-col h-full">
        {/* Brand */}
        <div className="px-4 py-5">
          {!collapsed ? (
            <div className="flex items-center gap-2.5">
              {tenant?.logo_url ? (
                <img src={tenant.logo_url} alt={brandName} className="h-7 w-7 rounded-md object-contain" />
              ) : (
                <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
                  <span className="text-xs font-bold text-primary-foreground">{brandInitial}</span>
                </div>
              )}
              <div className="flex flex-col leading-tight min-w-0">
                <span className="text-sm font-heading font-bold text-sidebar-foreground tracking-tight truncate">{brandName}</span>
              </div>
            </div>
          ) : (
            tenant?.logo_url ? (
              <img src={tenant.logo_url} alt={brandName} className="h-7 w-7 rounded-md object-contain mx-auto" />
            ) : (
              <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center mx-auto">
                <span className="text-xs font-bold text-primary-foreground">{brandInitial}</span>
              </div>
            )
          )}
        </div>

        {/* Navigation */}
        <SidebarGroup className="flex-1 px-2">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {items.map((item) => {
                const locked = item.requiresActive && !isActive;
                return (
                  <SidebarMenuItem key={item.title} data-tour={`nav-${item.url.replace("/", "")}`}>
                    <SidebarMenuButton asChild className="h-auto py-0">
                      <NavLink
                        to={locked ? "#" : item.url}
                        end
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm",
                          locked
                            ? "text-sidebar-foreground/30 pointer-events-none cursor-not-allowed"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        )}
                        activeClassName={locked ? "" : "!bg-blue-600 !text-white font-semibold shadow-[0_2px_8px_-2px_rgba(37,99,235,0.45)] hover:!bg-blue-600"}
                        onClick={(e: React.MouseEvent) => { if (locked) e.preventDefault(); }}
                      >
                        {locked ? (
                          <Lock className="h-[18px] w-[18px] shrink-0" />
                        ) : (
                          <item.icon className="h-[18px] w-[18px] shrink-0 text-sidebar-foreground/70" strokeWidth={2} />
                        )}
                        {!collapsed && <span className="flex-1">{item.title}</span>}
                        {!collapsed && item.dot && (
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full shrink-0",
                              item.dot === "orange" && "bg-orange-500",
                              item.dot === "blue" && "bg-blue-500"
                            )}
                          />
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Footer: Logout + Einklappen */}
        <div className="border-t border-sidebar-border p-2 space-y-0.5">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={signOut}
                className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <LogOut className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="text-sm">Abmelden</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={toggleSidebar}
                className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              >
                {collapsed ? (
                  <ChevronsRight className="h-[18px] w-[18px] shrink-0" />
                ) : (
                  <ChevronsLeft className="h-[18px] w-[18px] shrink-0" />
                )}
                {!collapsed && <span className="text-sm">Einklappen</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

export default function EmployeeLayout() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [employeeStatus, setEmployeeStatus] = useState<EmployeeStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [kycPending, setKycPending] = useState(false);
  const [kycRejected, setKycRejected] = useState(false);
  const [contractPending, setContractPending] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
    if (!loading && user && isAdmin) navigate("/admin");
  }, [user, loading, isAdmin, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("profiles").select("status, contract_signed_at").eq("user_id", user.id).maybeSingle(),
      supabase.from("kyc_verifications").select("status").eq("user_id", user.id).maybeSingle(),
    ]).then(([profileRes, kycRes]) => {
      setEmployeeStatus((profileRes.data?.status as EmployeeStatus) ?? null);
      setContractPending(!profileRes.data?.contract_signed_at);
      const kycStatus = kycRes.data?.status;
      setKycRejected(kycStatus === "abgelehnt");
      setKycPending(!kycStatus || kycStatus === "nicht_gestartet" || kycStatus === "in_pruefung");
      setStatusLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (statusLoading || !employeeStatus) return;
    if (employeeStatus === "deaktiviert") navigate("/login");
  }, [employeeStatus, statusLoading, navigate]);

  useEffect(() => {
    if (statusLoading || !employeeStatus) return;
    if (hasFullAccess(employeeStatus)) return;
    const isAllowed = ALWAYS_ALLOWED_PATHS.some((p) => location.pathname.startsWith(p));
    if (!isAllowed) navigate("/dashboard");
  }, [location.pathname, employeeStatus, statusLoading, navigate]);

  if (loading || statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/20 animate-pulse" />
          <p className="text-sm text-muted-foreground">Laden…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <EmployeeSidebar
          employeeStatus={employeeStatus}
          kycPending={kycPending}
          kycRejected={kycRejected}
          contractPending={contractPending}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border bg-card px-5 shrink-0">
            <SidebarTrigger className="md:hidden" />
            <div className="flex-1" />
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <HeaderHelpButton />
              <div data-tour="notifications"><NotificationBell /></div>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <OnboardingPopup />
            <GuidedOnboarding />
            <Outlet />
          </main>
          <FloatingChat />
        </div>
      </div>
    </SidebarProvider>
  );
}
