import { Link, useRouterState } from "@tanstack/react-router";
import { Building2, ChevronDown, Search, FileText } from "lucide-react";
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
import { canAccessModule, roleLabel } from "@/lib/role-access";
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
  const ADMIN_ONLY_NAV = ["/analytics", "/audit-log", "/settings", "/forms", "/societies"];

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
  // Depends only on pathname/fullPath — NOT byCategory — so it never
  // triggers a render cycle even if byCategory reference changes.
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
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground font-bold shadow-sm">
            <Building2 className="size-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-serif text-base font-bold leading-tight tracking-tight">HousingOS</div>
              <div className="truncate text-[11px] font-medium tracking-wider text-muted-foreground">
                {profile?.society_name ?? "Askari Housing"} · {roleLabel(primaryRole)}
              </div>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="px-2 pb-2 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search modules…"
                className="h-8 pl-8 text-xs bg-muted/40"
              />
            </div>
            {/* <a
              href="/user-guide.html"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-[11px] font-semibold transition-colors border border-amber-500/20"
            >
              <span className="flex items-center gap-1.5">
                <FileText className="size-3.5 text-amber-600 dark:text-amber-400" />
                User Operating Guide
              </span>
              <span className="text-[10px] uppercase tracking-wider font-mono">HTML</span>
            </a> */}
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visiblePrimaryNav.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.to}
                    className={cn(
                      "transition-colors",
                      pathname === item.to && "bg-primary/10 text-primary font-medium border-l-2 border-primary rounded-l-none"
                    )}
                  >
                    <Link to={item.to} className="flex items-center gap-2.5">
                      <item.icon className="size-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {CATEGORY_ORDER.map((cat) => {
          const items = byCategory.get(cat);
          if (!items || items.length === 0) return null;
          const open = openCats[cat] ?? true;
          return (
            <SidebarGroup key={cat} className="py-1">
              <button
                type="button"
                onClick={() => setOpenCats((s) => ({ ...s, [cat]: !s[cat] }))}
                className="flex w-full items-center justify-between px-2 py-1 hover:bg-muted/40 rounded transition-colors"
              >
                <SidebarGroupLabel className="pointer-events-none flex-1 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
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
                <SidebarGroupContent>
                  <SidebarMenu>
                    {items.map((m) => {
                      const forms = getFormsForModule(m.key);
                      const href = m.route ?? `/modules/${m.key}`;
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
                              "transition-colors",
                              active && "bg-primary/10 text-primary font-medium border-l-2 border-primary rounded-l-none"
                            )}
                          >
                            <Link to={href} className="flex items-center gap-2.5">
                              <m.icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                              {!collapsed && (
                                <>
                                  <span className="flex-1 truncate">{m.name}</span>
                                  {forms.length > 0 && (
                                    <Badge
                                      variant="secondary"
                                      className="h-4 px-1.5 text-[9px] font-medium"
                                    >
                                      {forms.length}
                                    </Badge>
                                  )}
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

      {!collapsed && (
        <SidebarFooter className="border-t bg-muted/20">
          <div className="px-2 py-2">
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                {(profile?.full_name ?? "?")
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="min-w-0 text-xs">
                <div className="truncate font-semibold text-foreground">{profile?.full_name ?? "Account"}</div>
                <div className="truncate text-muted-foreground text-[11px]">{roleLabel(primaryRole)}</div>
              </div>
            </div>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
