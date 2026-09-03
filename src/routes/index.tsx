import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  TrendingUp,
  ArrowUpRight,
  ArrowRight,
  Plus,
  FileCheck2,
  Layers,
  Activity,
  Clock,
  Sparkles,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useEffect } from "react";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MODULES } from "@/lib/modules";
import { getFormsForModule, totalFormCount } from "@/lib/forms-registry";
import { getSubmissionsFn, getDashboardKpisFn, getRealCollectionsFn } from "@/lib/api/db-functions";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { roleLabel } from "@/lib/role-access";
import { formatDistanceToNow, parseISO } from "date-fns";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    // Note: Authentication is handled by useAuth hook in component
    // Server-side auth is enforced at API level via getSessionUser
  },
  head: () => ({
    meta: [
      { title: "Dashboard — HousingOS" },
      {
        name: "description",
        content: "Your society workspace — real-time submissions, quick actions and modules.",
      },
    ],
  }),
  component: Dashboard,
});

const MODULE_NAME = Object.fromEntries(MODULES.map((m) => [m.key, m.name]));

function Dashboard() {
  // ✅ STEP 1: ALL HOOKS AT THE TOP (before any conditional returns)
  const { profile, primaryRole, session, loading, roles } = useAuth();
  const { hasModuleAccess } = usePermissions();
  const navigate = useNavigate();
  
  // All data fetching hooks MUST be at top
  const { data: submissions = [] } = useQuery({
    queryKey: ["submissions", "recent"],
    queryFn: async () => {
      const data = await getSubmissionsFn({ data: { limit: 200 } });
      return data ?? [];
    },
    enabled: !!session, // Only fetch when authenticated
  });

  const {
    data: kpis = { openComplaints: 0, overdueUnits: 0, pendingWorkOrders: 0, visitorsToday: 0 },
  } = useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: () => getDashboardKpisFn(),
    enabled: !!session, // Only fetch when authenticated
  });

  const { data: chartData = [] } = useQuery({
    queryKey: ["dashboard-collections"],
    queryFn: () => getRealCollectionsFn(),
    enabled: !!session, // Only fetch when authenticated
  });

  const stats = useMemo(() => {
    const now = Date.now();
    const dayMs = 86400000;
    const last7 = submissions.filter(
      (r) => {
        if (!r.created_at) return false;
        const date = typeof r.created_at === 'string' ? new Date(r.created_at) : r.created_at;
        return now - date.getTime() < 7 * dayMs;
      }
    ).length;
    const last24 = submissions.filter((r) => {
      if (!r.created_at) return false;
      const date = typeof r.created_at === 'string' ? new Date(r.created_at) : r.created_at;
      return now - date.getTime() < dayMs;
    }).length;
    const modulesUsed = new Set(submissions.map((r) => r.module_key)).size;
    return { total: submissions.length, last7, last24, modulesUsed };
  }, [submissions]);
  
  // Check if user is admin
  const isAdmin = roles.includes("super_admin") || roles.includes("society_admin");
  
  // Computed values (these are fine after hooks)
  const active = MODULES.filter((m) => isAdmin || hasModuleAccess(m.key)).length;
  const formCount = totalFormCount();
  const sample = MODULES.filter((m) => isAdmin || hasModuleAccess(m.key)).slice(0, 8);
  const submissionCount = stats.total;
  const recent = submissions.slice(0, 6);
  
  // ✅ STEP 2: Auth redirect logic in useEffect (not before hooks!)
  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/auth" });
    }
  }, [loading, session, navigate]);
  
  // ✅ STEP 3: Conditional renders AFTER all hooks
  if (loading) {
    return (
      <AppShell title="Loading">
        <div className="flex h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppShell>
    );
  }
  
  // Don't render if not authenticated (useEffect will redirect)
  if (!session) return null;

  const KPIS = [
    {
      label: "Open Complaints",
      value: kpis.openComplaints.toString(),
      delta: "needs resolution",
      icon: AlertCircle,
      tone: kpis.openComplaints > 0 ? ("destructive" as const) : ("neutral" as const),
    },
    {
      label: "Overdue Balance Units",
      value: kpis.overdueUnits.toString(),
      delta: "defaulter list",
      icon: ShieldAlert,
      tone: kpis.overdueUnits > 0 ? ("destructive" as const) : ("neutral" as const),
    },
    {
      label: "Pending Work Orders",
      value: kpis.pendingWorkOrders.toString(),
      delta: "ops backlog",
      icon: Activity,
      tone: "neutral" as const,
    },
    {
      label: "Visitors Expected Today",
      value: kpis.visitorsToday.toString(),
      delta: "expected entries",
      icon: Clock,
      tone: "positive" as const,
    },
  ];

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <AppShell
      title={profile?.society_name ?? "HousingOS"}
      subtitle={roleLabel(primaryRole)}
      /* actions={
        <Button asChild size="sm" className="ml-2 gap-1.5">
          <Link to="/forms">
            <Plus className="size-4" /> New record
          </Link>
        </Button>
      } */
    >
      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
        {/* Hero strip */}
        <section className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {new Date().toLocaleDateString("en-PK", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              · PKT
            </div>
            <h2 className="mt-2 font-serif text-2xl font-bold tracking-tight sm:text-4xl">
              Welcome back, {firstName}.
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {submissionCount} record{submissionCount === 1 ? "" : "s"} submitted so far. Pick up
              where you left off below.
            </p>
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <ModulePill label={`${active} modules active`} />
            <ModulePill label={`${formCount} forms`} subtle />
          </div>
        </section>

        {/* KPI row */}
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {KPIS.map((k) => (
            <Card key={k.label} className="overflow-hidden border-border/70 shadow-soft">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {k.label}
                  </div>
                  <div
                    className={[
                      "grid size-8 place-items-center rounded-full",
                      k.tone === "destructive"
                        ? "bg-destructive/10 text-destructive"
                        : k.tone === "positive"
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-primary-soft text-primary",
                    ].join(" ")}
                  >
                    <k.icon className="size-4" />
                  </div>
                </div>
                <div className="mt-3 font-serif text-3xl font-bold tracking-tight">{k.value}</div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <TrendingUp className="size-3" /> {k.delta}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Main grid */}
        <section className="grid gap-6 lg:grid-cols-3">
          {/* Collections chart */}
          <Card className="border-border/70 shadow-soft lg:col-span-2">
            <CardContent className="space-y-4 p-6">
              <header className="flex items-end justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Last 6 months
                  </div>
                  <h3 className="mt-1 font-serif text-lg font-bold">Collections</h3>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  FY 2026-27
                </Badge>
              </header>
              <Sparkbar data={chartData} />
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card className="border-border/70 shadow-soft">
            <CardContent className="space-y-3 p-6">
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Quick actions
                </div>
                <h3 className="mt-1 font-serif text-lg font-bold">Workspace actions</h3>
              </div>
              <div className="space-y-2">
                <QuickAction to="/payments" label="Record payment" hint="Finance" />
                <QuickAction to="/complaints" label="Triage complaints" hint="Operations" />
                <QuickAction to="/notices" label="Broadcast notice" hint="Community" />
                <QuickAction to="/property" label="Configure property" hint="Core" />
                <QuickAction to="/residents" label="Residents directory" hint="Core" />
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          {/* Recent submissions */}
          <Card className="border-border/70 shadow-soft lg:col-span-2">
            <CardContent className="p-6">
              <header className="mb-4 flex items-center justify-between">
                <h3 className="font-serif text-lg font-bold">Recent submissions</h3>
                <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
                  <Link to="/analytics">
                    Analytics <ArrowUpRight className="size-3" />
                  </Link>
                </Button>
              </header>
              {recent.length === 0 ? (
                <div className="grid place-items-center rounded-md border border-dashed border-border/70 py-10 text-center">
                  <div className="text-sm font-medium">No submissions yet</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Submit a form or log an entry to get started.
                  </div>
                  <Button asChild size="sm" className="mt-4 gap-1.5">
                    <Link to="/forms">
                      <Plus className="size-4" /> Browse forms
                    </Link>
                  </Button>
                </div>
              ) : (
                <ol className="relative space-y-4 border-l pl-5">
                  {recent.map((r) => (
                    <li key={r.id} className="relative">
                      <span className="absolute -left-[26px] top-1 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground ring-4 ring-background">
                        <FileCheck2 className="size-2.5" />
                      </span>
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-medium">{r.form_title ?? r.form_key}</span>
                        <span className="text-[11px] text-muted-foreground">
                          <Clock className="mr-0.5 inline size-3 -translate-y-0.5" />
                          {r.created_at ? formatDistanceToNow(
                            typeof r.created_at === 'string' ? parseISO(r.created_at) : new Date(r.created_at), 
                            { addSuffix: true }
                          ) : 'Just now'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {MODULE_NAME[r.module_key] ?? r.module_key}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Role summary */}
          <Card className="border-border/70 shadow-soft">
            <CardContent className="p-6">
              <header className="mb-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Your access
                </div>
                <h3 className="mt-1 font-serif text-lg font-bold">{roleLabel(primaryRole)}</h3>
              </header>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between">
                  <span className="text-muted-foreground">Modules visible</span>
                  <span className="font-mono">{active}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-muted-foreground">Forms available</span>
                  <span className="font-mono">{formCount}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-muted-foreground">Your submissions</span>
                  <span className="font-mono">{submissionCount}</span>
                </li>
              </ul>
              <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                <Link to="/modules-admin">Manage modules</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Modules */}
        <section>
          <header className="mb-4 flex items-end justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Active modules
              </div>
              <h3 className="mt-1 font-serif text-lg font-bold">Your enabled capabilities</h3>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
              <Link to="/forms">
                Open forms catalog <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </header>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {sample.map((m) => {
              const forms = getFormsForModule(m.key);
              const first = forms[0];
              const pageLink = m.route ?? (first ? `/forms/${m.key}/${first.key}` : "/forms");

              return (
                <Link
                  key={m.key}
                  to={pageLink}
                  className="group flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary-soft/30"
                >
                  <div className="grid size-9 shrink-0 place-items-center rounded-md bg-surface text-foreground group-hover:bg-primary group-hover:text-primary-foreground">
                    <m.icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{m.name}</span>
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {m.description}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function ModulePill({ label, subtle }: { label: string; subtle?: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px]",
        subtle
          ? "border-border text-muted-foreground"
          : "border-primary/20 bg-primary-soft text-primary",
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function QuickAction({ to, label, hint }: { to: string; label: string; hint: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between rounded-md border bg-background px-3 py-2.5 text-sm transition-colors hover:border-primary/40 hover:bg-primary-soft/40"
    >
      <span>
        <span className="font-medium">{label}</span>
        <span className="ml-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {hint}
        </span>
      </span>
      <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}

function Sparkbar({ data = [] }: { data?: any[] }) {
  const chartPoints =
    data.length > 0
      ? data
      : [
          { label: "Apr", amount_lakh: 12.1 },
          { label: "May", amount_lakh: 14.3 },
          { label: "Jun", amount_lakh: 13.6 },
          { label: "Jul", amount_lakh: 15.9 },
          { label: "Aug", amount_lakh: 17.2 },
          { label: "Sep", amount_lakh: 18.4 },
        ];
  const max = Math.max(...chartPoints.map((x) => Number(x.amount_lakh)));
  return (
    <div className="grid grid-cols-6 items-end gap-3 sm:gap-5">
      {chartPoints.map((v, i) => {
        const amt = Number(v.amount_lakh);
        const h = max > 0 ? (amt / max) * 100 : 0;
        const isLast = i === chartPoints.length - 1;
        return (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="flex h-40 w-full items-end">
              <div
                className={["w-full rounded-t-md", isLast ? "bg-primary" : "bg-primary/25"].join(
                  " ",
                )}
                style={{ height: `${h}%` }}
              />
            </div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {v.label}
            </div>
            <div className="-mt-1 font-mono text-[10px] text-foreground/70">₨{amt.toFixed(1)}L</div>
          </div>
        );
      })}
    </div>
  );
}
