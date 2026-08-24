import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, HelpCircle, LogOut, Loader2, Building2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { listAllSocietiesFn, getAssignedSocietiesFn } from "@/lib/api/societies";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "./app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { roleLabel } from "@/lib/role-access";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNotificationsFn, markAsReadFn } from "@/lib/api/notifications";

interface AppShellProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

function getCookieVal(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]*)'));
  return match ? match[2] : "";
}

export function AppShell({ title, subtitle, actions, children }: AppShellProps) {
  const { loading, session, user, profile, primaryRole, roles, signOut } = useAuth();
  const navigate = useNavigate();

  const isSuperAdmin = roles?.includes("super_admin") ?? false;
  const isSocietyAdmin = roles?.includes("society_admin") ?? false;
  const [selectedTenantId, setSelectedTenantId] = useState(() => getCookieVal("selected_tenant_id"));

  const { data: societies = [] } = useQuery({
    queryKey: ["all-societies-list"],
    queryFn: () => listAllSocietiesFn(),
    enabled: !!session && isSuperAdmin,
  });

  const { data: assignedSocieties = [] } = useQuery({
    queryKey: ["assigned-societies-list"],
    queryFn: () => getAssignedSocietiesFn(),
    enabled: !!session && isSocietyAdmin,
  });

  useEffect(() => {
    if (session && isSocietyAdmin && assignedSocieties.length > 0) {
      const assignedIds = assignedSocieties.map((s: any) => s.id);
      if (!selectedTenantId || !assignedIds.includes(selectedTenantId)) {
        document.cookie = `selected_tenant_id=${assignedSocieties[0].id}; path=/; max-age=31536000; SameSite=Strict`;
        setSelectedTenantId(assignedSocieties[0].id);
        window.location.reload();
      }
    }
  }, [session, isSocietyAdmin, assignedSocieties, selectedTenantId]);

  const handleTenantChange = (id: string) => {
    if (id === "all") {
      document.cookie = "selected_tenant_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict";
    } else {
      document.cookie = `selected_tenant_id=${id}; path=/; max-age=31536000; SameSite=Strict`;
    }
    setSelectedTenantId(id === "all" ? "" : id);
    window.location.reload();
  };

  const { data: notifications = [], refetch } = useQuery({
    queryKey: ["header-notifications"],
    queryFn: async () => getNotificationsFn(),
    enabled: !!session,
  });

  const markReadMutation = useMutation({
    mutationFn: markAsReadFn,
    onSuccess: () => {
      refetch();
    },
  });

  const unreadCount = notifications.filter((n: any) => n.readStatus === "unread").length;

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const displayName = profile?.full_name ?? user?.email ?? "Account";
  const initials =
    displayName
      .split(" ")
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-3 backdrop-blur sm:px-6">
            <SidebarTrigger className="-ml-1" />
            <div className="hidden h-5 w-px bg-border sm:block" />
            <div className="min-w-0 flex-1">
              {title && (
                <div className="flex items-baseline gap-2">
                  <h1 className="truncate font-serif text-base font-bold sm:text-lg">{title}</h1>
                  {subtitle && (
                    <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                      · {subtitle}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isSuperAdmin ? (
                <div className="flex items-center gap-1.5 mr-2">
                  <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                  <select
                    value={selectedTenantId || "all"}
                    onChange={(e) => handleTenantChange(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="all">All Societies (Platform-wide)</option>
                    {societies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code ?? "no-code"})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (isSocietyAdmin && assignedSocieties.length > 1) ? (
                <div className="flex items-center gap-1.5 mr-2">
                  <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                  <select
                    value={selectedTenantId || (assignedSocieties[0]?.id || "")}
                    onChange={(e) => handleTenantChange(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {assignedSocieties.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code ?? "no-code"})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {actions}
              <Button variant="ghost" size="icon" aria-label="Help">
                <HelpCircle className="size-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    aria-label="Notifications"
                  >
                    <Bell className="size-4" />
                    {unreadCount > 0 && (
                      <span className="absolute right-1.5 top-1.5 flex size-2 rounded-full bg-destructive" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markReadMutation.mutate({})}
                        className="text-[10px] text-primary hover:underline font-normal"
                      >
                        Mark all read
                      </button>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-4 text-center text-xs text-muted-foreground">
                        No notifications.
                      </div>
                    ) : (
                      notifications.slice(0, 5).map((n: any) => (
                        <DropdownMenuItem
                          key={n.id}
                          className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                          onClick={() => {
                            markReadMutation.mutate({ notificationId: n.id });
                            navigate({ to: "/notifications" });
                          }}
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <span
                              className={`font-semibold text-xs truncate ${n.readStatus === "unread" ? "text-foreground" : "text-muted-foreground"}`}
                            >
                              {n.title}
                            </span>
                            {n.readStatus === "unread" && (
                              <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground line-clamp-2 leading-normal">
                            {n.message}
                          </span>
                        </DropdownMenuItem>
                      ))
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-center w-full justify-center text-xs font-semibold text-primary"
                    onClick={() => navigate({ to: "/notifications" })}
                  >
                    View all notifications
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="ml-1 gap-2 pl-1.5 pr-2">
                    <span className="grid size-7 place-items-center rounded-full bg-primary-soft text-primary text-[11px] font-semibold">
                      {initials}
                    </span>
                    <span className="hidden text-xs font-medium sm:inline">
                      {displayName.split(" ")[0]}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="text-sm font-medium truncate">{displayName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {roleLabel(primaryRole)}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      await signOut();
                      navigate({ to: "/auth", replace: true });
                    }}
                  >
                    <LogOut className="mr-2 size-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
