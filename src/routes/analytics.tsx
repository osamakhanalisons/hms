import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Users, FileCheck2, Layers, Activity, ShieldAlert } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSubmissionsFn } from "@/lib/api/db-functions";
import { useAuth } from "@/hooks/use-auth";
import { MODULES } from "@/lib/modules";
import { roleLabel } from "@/lib/role-access";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — HousingOS" },
      {
        name: "description",
        content: "Live submission volume, module usage and activity across your society.",
      },
    ],
  }),
  component: Analytics,
});

type Row = {
  id: string;
  module_key: string;
  form_key: string;
  form_title: string | null;
  created_at: string;
  user_id: string;
};

const MODULE_NAME = Object.fromEntries(MODULES.map((m) => [m.key, m.name]));

function Analytics() {
  const { primaryRole, roles } = useAuth();
  const isAdmin = roles.some(r => r === "super_admin" || r === "society_admin");

  // Admin-only access check
  if (!isAdmin) {
    return (
      <AppShell title="Access Denied" subtitle="Admin access required">
        <div className="mx-auto max-w-md py-16 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-bold font-serif">Unauthorized Access</h2>
          <p className="text-xs text-muted-foreground">
            Only Super Admins or Society Admins can view society-wide analytics.
          </p>
          <Button onClick={() => window.history.back()} variant="outline" className="mt-4">
            Go Back
          </Button>
        </div>
      </AppShell>
    );
  }

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["analytics", "submissions", primaryRole],
    queryFn: async () => {
      const data = await getSubmissionsFn({ data: { limit: 1000 } });
      return (data ?? []) as Row[];
    },
  });

  const stats = useMemo(() => {
    const now = Date.now();
    const dayMs = 86400000;
    const last7 = rows.filter((r) => {
      if (!r.created_at) return false;
      const date = typeof r.created_at === 'string' ? new Date(r.created_at) : r.created_at;
      return now - date.getTime() < 7 * dayMs;
    }).length;
    const last30 = rows.filter((r) => {
      if (!r.created_at) return false;
      const date = typeof r.created_at === 'string' ? new Date(r.created_at) : r.created_at;
      return now - date.getTime() < 30 * dayMs;
    }).length;
    const users = new Set(rows.map((r) => r.user_id)).size;
    const modulesUsed = new Set(rows.map((r) => r.module_key)).size;

    const byModule = new Map<string, number>();
    rows.forEach((r) => byModule.set(r.module_key, (byModule.get(r.module_key) ?? 0) + 1));
    const moduleMix = [...byModule.entries()]
      .map(([k, v]) => ({ key: k, name: MODULE_NAME[k] ?? k, count: v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const byForm = new Map<string, { title: string; module: string; count: number }>();
    rows.forEach((r) => {
      const id = `${r.module_key}/${r.form_key}`;
      const prev = byForm.get(id);
      byForm.set(id, {
        title: r.form_title ?? r.form_key,
        module: MODULE_NAME[r.module_key] ?? r.module_key,
        count: (prev?.count ?? 0) + 1,
      });
    });
    const topForms = [...byForm.values()].sort((a, b) => b.count - a.count).slice(0, 6);

    // last 14 days trend
    const trend: { day: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * dayMs);
      const key = d.toISOString().slice(0, 10);
      const count = rows.filter((r) => {
        if (!r.created_at) return false;
        const dateStr = typeof r.created_at === 'string' ? r.created_at : r.created_at.toISOString();
        return dateStr.slice(0, 10) === key;
      }).length;
      trend.push({ day: d.toLocaleDateString("en-PK", { day: "numeric", month: "short" }), count });
    }

    return { last7, last30, users, modulesUsed, moduleMix, topForms, trend, total: rows.length };
  }, [rows]);

  const maxTrend = Math.max(1, ...stats.trend.map((t) => t.count));
  const maxMix = Math.max(1, ...stats.moduleMix.map((m) => m.count));

  const KPI = [
    { label: "Total submissions", value: stats.total.toLocaleString("en-PK"), icon: FileCheck2 },
    { label: "Last 7 days", value: stats.last7.toLocaleString("en-PK"), icon: Activity },
    {
      label: isAdmin ? "Active users" : "Modules used",
      value: (isAdmin ? stats.users : stats.modulesUsed).toString(),
      icon: isAdmin ? Users : Layers,
    },
    { label: "Last 30 days", value: stats.last30.toLocaleString("en-PK"), icon: TrendingUp },
  ];

  return (
    <AppShell title="Analytics" subtitle={roleLabel(primaryRole)}>
      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
        <header>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Live · {isAdmin ? "society-wide" : "your submissions"}
          </div>
          <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            Activity intelligence
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {isAdmin
              ? "Aggregate view of every form submitted across your workspace."
              : "Your personal submission history across HousingOS forms."}
          </p>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {KPI.map((k) => (
            <Card key={k.label} className="border-border/70 shadow-soft">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {k.label}
                  </div>
                  <div className="grid size-8 place-items-center rounded-full bg-primary-soft text-primary">
                    <k.icon className="size-4" />
                  </div>
                </div>
                <div className="mt-3 font-serif text-3xl font-bold tracking-tight">
                  {isLoading ? "…" : k.value}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="border-border/70 shadow-soft lg:col-span-2">
            <CardContent className="p-6">
              <header className="mb-4 flex items-end justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Submissions
                  </div>
                  <h3 className="mt-1 font-serif text-lg font-bold">Last 14 days</h3>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  PKT
                </Badge>
              </header>
              {stats.total === 0 ? (
                <EmptyState />
              ) : (
                <div
                  className="grid grid-cols-14 items-end gap-1.5"
                  style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}
                >
                  {stats.trend.map((t, i) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <div className="flex h-40 w-full items-end">
                        <div
                          className={[
                            "w-full rounded-t-md",
                            i === stats.trend.length - 1 ? "bg-primary" : "bg-primary/25",
                          ].join(" ")}
                          style={{
                            height: `${(t.count / maxTrend) * 100}%`,
                            minHeight: t.count ? 4 : 0,
                          }}
                          title={`${t.count} on ${t.day}`}
                        />
                      </div>
                      <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground text-center">
                        {t.day}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-soft">
            <CardContent className="p-6">
              <header className="mb-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  By module
                </div>
                <h3 className="mt-1 font-serif text-lg font-bold">Top usage</h3>
              </header>
              {stats.moduleMix.length === 0 ? (
                <div className="text-xs text-muted-foreground">No submissions yet.</div>
              ) : (
                <ul className="space-y-3 text-sm">
                  {stats.moduleMix.map((m) => (
                    <li key={m.key}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="truncate pr-2">{m.name}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {m.count}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${(m.count / maxMix) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="border-border/70 shadow-soft">
            <CardContent className="p-6">
              <header className="mb-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Popular forms
                </div>
                <h3 className="mt-1 font-serif text-lg font-bold">Most submitted</h3>
              </header>
              {stats.topForms.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 text-left font-medium">Form</th>
                        <th className="py-2 text-left font-medium">Module</th>
                        <th className="py-2 text-right font-medium">Submissions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topForms.map((f, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-3 font-medium">{f.title}</td>
                          <td className="py-3 text-muted-foreground">{f.module}</td>
                          <td className="py-3 text-right font-mono">{f.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center rounded-md border border-dashed border-border/70 py-10 text-center">
      <div className="text-sm font-medium">No data yet</div>
      <div className="mt-1 text-xs text-muted-foreground">
        Submit a form to start seeing analytics.
      </div>
    </div>
  );
}
