import { Link, useRouterState } from "@tanstack/react-router";
import { Building2, ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";

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
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { primaryRole, profile, roles, loading: authLoading } = useAuth();
  const { hasModuleAccess, isLoading: permissionsLoading } = usePermissions();
  const { isModuleActive } = useModules();
  const [query, setQuery] = useState("");
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      CATEGORY_ORDER.map((c) => [
        c,
        c === "Core" ||
          c === "Finance" ||
          c === "Operations" ||
          c === "Security" ||
          c === "Community",
      ]),
    ),
  );

  const isAdmin = roles.includes("super_admin") || roles.includes("society_admin");

  const isSuperAdmin = roles.includes("super_admin");

  // Admin-only primary nav items
  const ADMIN_ONLY_NAV = ["/analytics", "/audit-log", "/settings", "/forms"];

  const visiblePrimaryNav = useMemo(
    () =>
      PRIMARY_NAV.filter((item) => {
        // Super-admin-only items: only show to super_admin
        if (item.superAdminOnly) return isSuperAdmin;
        // Admin-only items: show to any admin (super or society)
        if (ADMIN_ONLY_NAV.includes(item.to)) return isAdmin;
        return true;
      }),
    [isAdmin, isSuperAdmin],
  );

  const visibleModules = useMemo(
    () =>
      MODULES.filter((m) => {
        // Admin ko sab dikhao
        if (isAdmin) return isModuleActive(m.key);
        // If permissions or auth are loading, don't show non-admin modules yet
        if (permissionsLoading || authLoading) return false;
        // Baaki roles ke liye dynamic permissions check karo
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

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-foreground text-background">
            <Building2 className="size-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-serif text-base leading-tight tracking-tight">HousingOS</div>
              <div className="truncate text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {profile?.society_name ?? "Society"} · {roleLabel(primaryRole)}
              </div>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="px-2 pb-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search modules…"
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visiblePrimaryNav.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={pathname === item.to}>
                    <Link to={item.to} className="flex items-center gap-2">
                      <item.icon className="size-4" />
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
          const open = openCats[cat];
          return (
            <SidebarGroup key={cat}>
              <button
                type="button"
                onClick={() => setOpenCats((s) => ({ ...s, [cat]: !s[cat] }))}
                className="flex w-full items-center justify-between px-2"
              >
                <SidebarGroupLabel className="pointer-events-none flex-1 text-left">
                  {cat}
                </SidebarGroupLabel>
                {!collapsed && (
                  <ChevronDown
                    className={cn(
                      "size-3.5 text-muted-foreground transition-transform",
                      !open && "-rotate-90",
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
                      const active =
                        pathname === href ||
                        pathname.startsWith(`/modules/${m.key}`) ||
                        pathname.startsWith(`/forms/${m.key}`);
                      return (
                        <SidebarMenuItem key={m.key}>
                          <SidebarMenuButton asChild isActive={active} tooltip={m.name}>
                            <Link to={href} className="flex items-center gap-2">
                              <m.icon className="size-4 text-muted-foreground" />
                              {!collapsed && (
                                <>
                                  <span className="flex-1 truncate">{m.name}</span>
                                  {forms.length > 0 && (
                                    <Badge
                                      variant="secondary"
                                      className="h-5 px-1.5 text-[10px] font-medium"
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
        <SidebarFooter className="border-t">
          <div className="px-2 py-2">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-full bg-primary-soft text-primary text-xs font-semibold">
                {(profile?.full_name ?? "?")
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="min-w-0 text-xs">
                <div className="truncate font-medium">{profile?.full_name ?? "Account"}</div>
                <div className="truncate text-muted-foreground">{roleLabel(primaryRole)}</div>
              </div>
            </div>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
