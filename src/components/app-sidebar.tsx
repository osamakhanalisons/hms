import { Link, useRouterState } from "@tanstack/react-router";
import { Building2, ChevronDown, Search, X } from "lucide-react";
import { useMemo, useState, useEffect } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_ORDER, MODULES, PRIMARY_NAV } from "@/lib/modules";
import { getFormsForModule } from "@/lib/forms-registry";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { roleLabel } from "@/lib/role-access";
import { cn } from "@/lib/utils";

import { useModules } from "@/contexts/modules-context";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useRouterState({ select: (r) => r.location });
  const pathname = location.pathname;
  const fullPath = `${location.pathname}${location.searchStr || ""}`;
  const { primaryRole, profile, roles, loading: authLoading } = useAuth();
  const { hasModuleAccess, isLoading: permissionsLoading } = usePermissions();
  const { isModuleActive } = useModules();
  const [query, setQuery] = useState("");
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CATEGORY_ORDER.map((c) => [c, true]))
  );

  const isAdmin = roles.includes("super_admin") || roles.includes("society_admin");
  const isSuperAdmin = roles.includes("super_admin");

  // Admin-only primary nav items
  const ADMIN_ONLY_NAV = ["/analytics", "/audit-log", "/societies"];

  const visiblePrimaryNav = useMemo(
    () =>
      PRIMARY_NAV.filter((item) => {
        if (item.to === "/societies") return isAdmin;
        if (item.superAdminOnly) return isSuperAdmin;
        if (ADMIN_ONLY_NAV.includes(item.to)) return isAdmin;
        return true;
      }),
    [isAdmin, isSuperAdmin],
  );

  const visibleModules = useMemo(
    () =>
      MODULES.filter((m) => {
        if (isAdmin) return isModuleActive(m.key);
        if (permissionsLoading || authLoading) return false;
        return hasModuleAccess(m.key) && isModuleActive(m.key);
      }),
    [isAdmin, hasModuleAccess, isModuleActive, permissionsLoading, authLoading],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visibleModules;
    return visibleModules.filter(
      (m) => m.name.toLowerCase().includes(q) || m.key.toLowerCase().includes(q),
    );
  }, [query, visibleModules]);

  const byCategory = useMemo(() => {
    const map = new Map<string, typeof MODULES>();
    for (const m of filtered) {
      const arr = map.get(m.category) ?? [];
      arr.push(m);
      map.set(m.category, arr);
    }
    return map;
  }, [filtered]);

  // Auto-expand category containing active route.
  useEffect(() => {
    for (const m of MODULES) {
      const href = m.route ?? `/modules/${m.key}`;
      const hasActive = href.includes("?")
        ? fullPath === href || (href === "/security?tab=gates" && pathname === "/security" && !location.searchStr)
        : pathname === href || pathname.startsWith(`/modules/${m.key}`) || pathname.startsWith(`/forms/${m.key}`);
      if (hasActive) {
        setOpenCats((s) => {
          if (s[m.category]) return s;
          return { ...s, [m.category]: true };
        });
      }
    }
  }, [pathname, fullPath]);

  return (
    <Sidebar collapsible="icon" className="border-r border-border/80 bg-sidebar">
      {/* Sidebar Header with App Brand */}
      <SidebarHeader className="border-b border-border/70 p-3 space-y-3">
        <div className="flex items-center gap-2.5 px-1 py-1">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground font-bold shadow-xs">
            <Building2 className="size-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="font-serif text-base font-bold leading-tight tracking-tight text-foreground flex items-center gap-1.5">
                HousingOS
              </div>
              <div className="truncate text-[11px] font-medium text-muted-foreground mt-0.5">
                {profile?.society_name ?? "Askari Housing"} · <span className="text-primary font-semibold">{roleLabel(primaryRole)}</span>
              </div>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="relative px-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search modules…"
              className="h-8 pl-8 pr-7 text-xs bg-muted/40 border-border/70 rounded-lg focus-visible:ring-1 focus-visible:ring-primary"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        )}
      </SidebarHeader>

      {/* Main Sidebar Menu Items */}
      <SidebarContent className="px-2 py-3 space-y-4">
        {/* Workspace Primary Nav */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {visiblePrimaryNav.map((item) => {
                const isActive = pathname === item.to;
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className={cn(
                        "h-8.5 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                        isActive
                          ? "bg-primary/10 text-primary font-bold border-l-[3px] border-primary rounded-l-none shadow-2xs"
                          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                      )}
                    >
                      <Link to={item.to} className="flex items-center gap-2.5">
                        <item.icon className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Categories & Submodules */}
        {CATEGORY_ORDER.map((cat) => {
          const items = byCategory.get(cat);
          if (!items || items.length === 0) return null;
          const open = openCats[cat] ?? true;
          return (
            <SidebarGroup key={cat} className="p-0">
              <button
                type="button"
                onClick={() => setOpenCats((s) => ({ ...s, [cat]: !s[cat] }))}
                className="flex w-full items-center justify-between px-2 py-1 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer group"
              >
                <SidebarGroupLabel className="pointer-events-none p-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 group-hover:text-foreground">
                  {cat}
                </SidebarGroupLabel>
                {!collapsed && (
                  <ChevronDown
                    className={cn(
                      "size-3.5 text-muted-foreground transition-transform duration-200",
                      !open && "-rotate-90"
                    )}
                  />
                )}
              </button>
              {open && (
                <SidebarGroupContent className="pt-1">
                  <SidebarMenu className="space-y-0.5">
                    {items.map((m) => {
                      const forms = getFormsForModule(m.key);
                      const formCount = forms.length;
                      const href = m.route ?? `/modules/${m.key}`;
                      const isAiModule = m.key.startsWith("ai_");
                      const active = href.includes("?")
                        ? fullPath === href || (href === "/security?tab=gates" && pathname === "/security" && !location.searchStr)
                        : (pathname === href || (href !== "/" && pathname.startsWith(href))) ||
                        pathname.startsWith(`/modules/${m.key}`) ||
                        pathname.startsWith(`/forms/${m.key}`);
                      return (
                        <SidebarMenuItem key={m.key}>
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            tooltip={m.name}
                            className={cn(
                              "h-8.5 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer group",
                              active
                                ? "bg-primary/10 text-primary font-bold border-l-[3px] border-primary rounded-l-none shadow-2xs"
                                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                            )}
                          >
                            <Link to={href} className="flex items-center gap-2.5">
                              <m.icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                              {!collapsed && (
                                <>
                                  <span className="flex-1 truncate">{m.name}</span>
                                  {isAiModule ? (
                                    <Badge
                                      variant="outline"
                                      className="ml-auto h-4 px-1.5 text-[8px] font-bold font-mono uppercase bg-primary/10 text-primary border-primary/25 rounded-md"
                                    >
                                      AI
                                    </Badge>
                                  ) : formCount > 0 ? (
                                    <span
                                      className={cn(
                                        "ml-auto inline-flex items-center justify-center h-4 min-w-4 px-1.5 text-[9px] font-mono font-medium rounded-full transition-colors shrink-0",
                                        active
                                          ? "bg-primary/20 text-primary font-bold"
                                          : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/15"
                                      )}
                                    >
                                      {formCount}
                                    </span>
                                  ) : null}
                                </>
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      {/* Sidebar Footer with User Profile */}
      {!collapsed && (
        <SidebarFooter className="border-t border-border/70 p-3 bg-muted/20">
          <div className="flex items-center gap-2.5 px-1">
            <div className="relative shrink-0">
              <div className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20 shadow-2xs">
                {(profile?.full_name ?? "?")
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 ring-2 ring-background" />
            </div>
            <div className="min-w-0 flex-1 text-xs">
              <div className="truncate font-semibold text-foreground leading-tight">
                {profile?.full_name ?? "Account User"}
              </div>
              <div className="truncate text-muted-foreground text-[11px] mt-0.5">
                {roleLabel(primaryRole)}
              </div>
            </div>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
