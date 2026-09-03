import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, parseISO } from "date-fns";
import { useState, useMemo } from "react";
import {
  Users,
  Building2,
  LayoutGrid,
  DoorOpen,
  Wrench,
  MessageSquareWarning,
  ShieldAlert,
  Activity,
  RefreshCw,
  Shield,
  Clock,
  Search,
  User,
  CheckCircle2,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { ModuleGate } from "@/components/module-gate";
import { getPlatformOverviewFn } from "@/lib/api/platform";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/platform")({
  head: () => ({
    meta: [
      { title: "Platform Core — HousingOS" },
      {
        name: "description",
        content: "Platform-level statistics, tenant overview, module status, and recent activity.",
      },
    ],
  }),
  component: PlatformRoute,
});

// ── Access guard ──────────────────────────────────────────────────────────────
function PlatformRoute() {
  const { primaryRole, loading } = useAuth();

  if (loading) {
    return (
      <AppShell title="Loading">
        <div className="flex h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  const isAdmin = primaryRole === "super_admin" || primaryRole === "society_admin";
  if (!isAdmin) {
    return (
      <AppShell title="Access Denied" subtitle="Platform Core">
        <div className="mx-auto max-w-md py-16 text-center space-y-4">
          <ShieldAlert className="size-12 mx-auto text-destructive" />
          <h2 className="text-lg font-bold font-serif">Unauthorized</h2>
          <p className="text-sm text-muted-foreground">
            Only Society Admins or Super Admins can access the Platform Core dashboard.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <ModuleGate moduleKey="platform">
      <PlatformPage />
    </ModuleGate>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  loading = false,
}: {
  label: string;
  value: number | string | null | undefined;
  icon: React.ElementType;
  tone?: "default" | "warning" | "destructive" | "success" | "sky" | "purple";
  loading?: boolean;
}) {
  const toneStyles = {
    default: "bg-primary/10 text-primary border-primary/20",
    success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    destructive: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    sky: "bg-sky-500/10 text-sky-600 border-sky-500/20",
    purple: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  }[tone];

  return (
    <Card className="border-border/70 hover:shadow-md transition-shadow bg-card">
      <CardContent className="p-5 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <div className="h-7 w-20 animate-pulse rounded-md bg-muted mt-1" />
          ) : (
            <p className="font-serif text-2xl font-bold tracking-tight text-foreground">
              {value ?? "—"}
            </p>
          )}
        </div>
        <div className={cn("grid size-10 place-items-center rounded-lg border shrink-0", toneStyles)}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Action badge colour ────────────────────────────────────────────────────────
function actionTone(
  action: string,
): "success" | "warning" | "destructive" | "info" | "purple" | undefined {
  const a = action.toLowerCase();
  if (a.includes("create") || a.includes("insert") || a.includes("active")) return "success";
  if (a.includes("update") || a.includes("edit") || a.includes("setting")) return "info";
  if (a.includes("delete") || a.includes("remove") || a.includes("deact")) return "destructive";
  if (a.includes("login") || a.includes("signup") || a.includes("auth")) return "warning";
  if (a.includes("module")) return "purple";
  return undefined;
}

function formatActionLabel(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  if (current > 3) pages.push("…");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

// ── Main platform page ────────────────────────────────────────────────────────
function PlatformPage() {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["platform-overview"],
    queryFn: () => getPlatformOverviewFn(),
    staleTime: 30_000,
    retry: 1,
  });

  // Search & Pagination for recent activity
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;

  const planBadgeVariant = (plan: string | null) => {
    switch (plan?.toLowerCase()) {
      case "enterprise":
        return "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200/60";
      case "professional":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200/60";
      case "growth":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/60";
      default:
        return "bg-muted text-muted-foreground border-border/50";
    }
  };

  const filteredLogs = useMemo(() => {
    const logs = data?.recentAuditLogs ?? [];
    if (!search.trim()) return logs;
    const q = search.toLowerCase().trim();
    return logs.filter(
      (log) =>
        log.action.toLowerCase().includes(q) ||
        log.entity_type.toLowerCase().includes(q) ||
        (log.actor_email && log.actor_email.toLowerCase().includes(q)) ||
        (log.entity_id && log.entity_id.toLowerCase().includes(q))
    );
  }, [data?.recentAuditLogs, search]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, page, itemsPerPage]);

  return (
    <AppShell
      title="Platform Core"
      subtitle={
        data?.tenantName
          ? `${data.tenantName} — ${(data.tenantPlan ?? "starter").toUpperCase()}`
          : "Auth · RBAC · Tenants · Audit"
      }
    >
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        {/* Page Header & Action Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Shield className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
                  Platform Core
                </h1>
                {data?.tenantPlan && (
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] uppercase font-semibold", planBadgeVariant(data.tenantPlan))}
                  >
                    {data.tenantPlan}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Platform-level statistics, tenant overview, module status, and system activity
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-9"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={cn("size-3.5", isRefetching && "animate-spin")} />
              <span>Refresh Data</span>
            </Button>
          </div>
        </div>

        {/* Error state */}
        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-4 shrink-0" />
              <p className="text-sm font-medium">
                Failed to load platform data:{" "}
                {error instanceof Error ? error.message : "Unknown error"}
              </p>
            </div>
          </div>
        )}

        {/* KPI metrics cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Total Users"
            value={data?.totalUsers}
            icon={Users}
            tone="sky"
            loading={isLoading}
          />
          <KpiCard
            label={data?.totalTenants === 1 ? "Your Society" : "Active Tenants"}
            value={data?.totalTenants}
            icon={Building2}
            tone="default"
            loading={isLoading}
          />
          <KpiCard
            label="Active Modules"
            value={data?.activeModules}
            icon={LayoutGrid}
            tone="success"
            loading={isLoading}
          />
          <KpiCard
            label="Total Units"
            value={data?.totalUnits}
            icon={DoorOpen}
            tone="purple"
            loading={isLoading}
          />
          <KpiCard
            label="Open Complaints"
            value={data?.openComplaints}
            icon={MessageSquareWarning}
            tone={data?.openComplaints ? "warning" : "default"}
            loading={isLoading}
          />
          <KpiCard
            label="Pending Work Orders"
            value={data?.pendingWorkOrders}
            icon={Wrench}
            tone={data?.pendingWorkOrders ? "destructive" : "default"}
            loading={isLoading}
          />
        </section>

        {/* Recent audit activity */}
        <Card className="border-border/70 shadow-sm overflow-hidden bg-card">
          <CardHeader className="p-5 border-b bg-muted/15">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <CardTitle className="flex items-center gap-2 font-serif text-base font-bold">
                  <Activity className="size-4 text-primary" />
                  Recent Activity
                  <Badge variant="secondary" className="font-mono text-xs font-normal ml-1">
                    {filteredLogs.length}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Real-time event timeline and security audit logs across the platform
                </CardDescription>
              </div>

              {/* Search filter */}
              <div className="w-full sm:w-64">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Filter activity..."
                    className="h-8 pl-8 text-xs bg-background"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-0 divide-y divide-border/60">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="h-4 w-4 animate-pulse rounded-full bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                      <div className="h-2.5 w-24 animate-pulse rounded bg-muted/60" />
                    </div>
                    <div className="h-2.5 w-16 animate-pulse rounded bg-muted/40" />
                  </div>
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-muted-foreground">
                <Clock className="size-8 opacity-40" />
                <p className="text-sm font-medium">No activity found</p>
                <p className="text-xs text-muted-foreground">
                  {search ? "No events matched your filter." : "System events will appear here as users perform actions."}
                </p>
              </div>
            ) : (
              <div>
                <div className="divide-y divide-border/50">
                  {paginatedLogs.map((log) => {
                    const tone = actionTone(log.action);
                    const toneClass = {
                      success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/50",
                      warning: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/50",
                      destructive: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200/50",
                      info: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200/50",
                      purple: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200/50",
                    }[tone ?? "info"] ?? "bg-primary/10 text-primary border-primary/20";

                    let timeAgo = "";
                    try {
                      timeAgo = formatDistanceToNow(parseISO(log.created_at), {
                        addSuffix: true,
                      });
                    } catch {
                      timeAgo = log.created_at;
                    }

                    return (
                      <div
                        key={log.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-5 py-3.5 transition-colors hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Badge variant="outline" className={cn("shrink-0 text-[10px] font-mono", toneClass)}>
                            {formatActionLabel(log.action)}
                          </Badge>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-foreground capitalize">
                                {log.entity_type}
                              </span>
                              {log.entity_id && (
                                <code className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
                                  #{log.entity_id.length > 8 ? log.entity_id.slice(0, 8) : log.entity_id}
                                </code>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                              <User className="size-3 shrink-0" />
                              <span className="truncate">{log.actor_email ?? "System"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0 sm:self-center pl-10 sm:pl-0">
                          <Clock className="size-3 shrink-0" />
                          <span>{timeAgo}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t p-4 bg-muted/10">
                    <span className="text-xs text-muted-foreground">
                      Showing {(page - 1) * itemsPerPage + 1} &ndash;{" "}
                      {Math.min(page * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} events
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="h-8 px-2.5 text-xs"
                      >
                        &larr; Prev
                      </Button>
                      {getPageNumbers(page, totalPages).map((pg, idx) =>
                        pg === "…" ? (
                          <span key={`dots-${idx}`} className="px-2 text-muted-foreground text-xs select-none">
                            …
                          </span>
                        ) : (
                          <Button
                            key={`page-${pg}`}
                            variant={page === pg ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPage(pg as number)}
                            className={cn(
                              "h-8 w-8 p-0 text-xs",
                              page === pg
                                ? "bg-primary text-primary-foreground font-semibold"
                                : "hover:bg-muted"
                            )}
                          >
                            {pg}
                          </Button>
                        )
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="h-8 px-2.5 text-xs"
                      >
                        Next &rarr;
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tenant info footer */}
        {data?.tenantCreatedAt && (
          <p className="text-center text-[11px] text-muted-foreground/60">
            Tenant initialized{" "}
            {(() => {
              try {
                const raw = data.tenantCreatedAt;
                const d = raw instanceof Date ? raw : new Date(raw);
                return formatDistanceToNow(d, { addSuffix: true });
              } catch {
                return String(data.tenantCreatedAt);
              }
            })()}
          </p>
        )}
      </div>
    </AppShell>
  );
}
