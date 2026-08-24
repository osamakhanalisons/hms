import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  Users,
  Building2,
  LayoutGrid,
  LayoutGridIcon,
  DoorOpen,
  Wrench,
  MessageSquareWarning,
  ShieldAlert,
  Activity,
  RefreshCw,
  Shield,
  Clock,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ModuleGate } from "@/components/module-gate";
import { getPlatformOverviewFn } from "@/lib/api/platform";

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
  tone?: "default" | "warning" | "destructive" | "success";
  loading?: boolean;
}) {
  const iconClass = {
    default: "text-primary",
    warning: "text-warning-foreground",
    destructive: "text-destructive",
    success: "text-success",
  }[tone];

  return (
    <Card className="border-border/70">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            {loading ? (
              <div className="mt-2 h-7 w-20 animate-pulse rounded-md bg-muted" />
            ) : (
              <p className="mt-1 font-serif text-2xl font-bold tracking-tight">
                {value ?? "—"}
              </p>
            )}
          </div>
          <div className={`rounded-md bg-muted/50 p-2 ${iconClass}`}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Action badge colour ────────────────────────────────────────────────────────
function actionTone(
  action: string,
): "success" | "warning" | "destructive" | "info" | undefined {
  const a = action.toLowerCase();
  if (a.includes("create") || a.includes("insert")) return "success";
  if (a.includes("update") || a.includes("edit")) return "info";
  if (a.includes("delete") || a.includes("remove")) return "destructive";
  if (a.includes("login") || a.includes("signup")) return "warning";
  return undefined;
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

  const planBadgeVariant = (plan: string | null) => {
    switch (plan) {
      case "enterprise":
        return "bg-violet-500/15 text-violet-600 border-violet-300/40";
      case "professional":
        return "bg-blue-500/15 text-blue-600 border-blue-300/40";
      case "growth":
        return "bg-emerald-500/15 text-emerald-600 border-emerald-300/40";
      default:
        return "bg-muted text-muted-foreground border-border/50";
    }
  };

  return (
    <AppShell
      title="Platform Core"
      subtitle={
        data?.tenantName
          ? `${data.tenantName} — ${(data.tenantPlan ?? "starter").toUpperCase()}`
          : "Auth · RBAC · Tenants · Audit"
      }
      actions={
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={`size-3.5 ${isRefetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
        {/* Header breadcrumb */}
        <header className="flex flex-wrap items-end gap-3">
          <div className="grid size-11 place-items-center rounded-md bg-surface">
            <Shield className="size-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Core · Intelligence
            </div>
            <h1 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
              Platform Core
            </h1>
          </div>
          {data?.tenantPlan && (
            <Badge
              variant="outline"
              className={`ml-2 self-center text-[10px] uppercase ${planBadgeVariant(data.tenantPlan)}`}
            >
              {data.tenantPlan}
            </Badge>
          )}
        </header>

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

        {/* KPI cards */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Users"
            value={data?.totalUsers}
            icon={Users}
            loading={isLoading}
          />
          <KpiCard
            label={data?.totalTenants === 1 ? "Your Society" : "Active Tenants"}
            value={data?.totalTenants}
            icon={Building2}
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
            loading={isLoading}
          />
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
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
            tone={data?.pendingWorkOrders ? "warning" : "default"}
            loading={isLoading}
          />
        </section>

        {/* Recent audit activity */}
        <Card className="border-border/70 shadow-soft">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 font-serif text-base font-bold">
                  <Activity className="size-4 text-muted-foreground" />
                  Recent Activity
                </CardTitle>
                <CardDescription className="mt-0.5 text-[11px]">
                  Last 15 platform-level events from the audit log
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-0 divide-y divide-border/60">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <div className="h-4 w-4 animate-pulse rounded-full bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                      <div className="h-2.5 w-24 animate-pulse rounded bg-muted/60" />
                    </div>
                    <div className="h-2.5 w-16 animate-pulse rounded bg-muted/40" />
                  </div>
                ))}
              </div>
            ) : !data?.recentAuditLogs?.length ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center gap-3 py-14 text-muted-foreground">
                <Clock className="size-8 opacity-40" />
                <p className="text-sm">No audit events recorded yet.</p>
                <p className="text-[11px] text-muted-foreground/70">
                  System events will appear here as users perform actions.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {data.recentAuditLogs.map((log) => {
                  const tone = actionTone(log.action);
                  const toneClass = {
                    success: "bg-success/10 text-success border-transparent",
                    warning: "bg-warning/15 text-warning-foreground border-transparent",
                    destructive: "bg-destructive/10 text-destructive border-transparent",
                    info: "bg-primary-soft text-primary border-transparent",
                  }[tone ?? "info"] ?? "bg-primary-soft text-primary border-transparent";

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
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
                    >
                      <Badge variant="outline" className={`shrink-0 text-[10px] ${toneClass}`}>
                        {log.action}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {log.entity_type}
                          {log.entity_id && (
                            <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                              #{log.entity_id.slice(0, 8)}
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {log.actor_email ?? "System"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tenant info footer */}
        {data?.tenantCreatedAt && (
          <p className="text-center text-[11px] text-muted-foreground/60">
            Tenant created{" "}
            {(() => {
              try {
                // MySQL may return a Date object or an ISO string — handle both
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
