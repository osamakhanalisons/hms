import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, Filter, Plus, Search, MoreHorizontal } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MODULES } from "@/lib/modules";
import { getFormsForModule } from "@/lib/forms-registry";

export const Route = createFileRoute("/modules/$module")({
  head: ({ params }) => {
    const m = MODULES.find((x) => x.key === params.module);
    return {
      meta: [
        { title: `${m?.name ?? "Module"} — HousingOS` },
        { name: "description", content: m?.description ?? "Module records and forms." },
      ],
    };
  },
  component: ModuleList,
  notFoundComponent: () => (
    <AppShell title="Not found">
      <div className="p-10 text-sm text-muted-foreground">Module not found.</div>
    </AppShell>
  ),
});

import { ModuleGate } from "@/components/module-gate";

function ModuleList() {
  const { module: key } = Route.useParams();
  const m = MODULES.find((x) => x.key === key);
  if (!m) throw notFound();
  const forms = getFormsForModule(key);
  const rows = mockRows(key);

  return (
    <ModuleGate moduleKey={key}>
      <AppShell
        title={m.name}
        subtitle={m.description}
        actions={
          forms[0] && (
            <Button asChild size="sm" className="gap-1.5">
              <Link to={`/forms/${m.key}/${forms[0].key}`}>
                <Plus className="size-4" /> New {forms[0].title.toLowerCase()}
              </Link>
            </Button>
          )
        }
      >
        <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-8 sm:py-10">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-md bg-surface">
                <m.icon className="size-5" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {m.category}
                </div>
                <h1 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
                  {m.name}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder={`Search ${m.name.toLowerCase()}…`} className="h-9 w-64 pl-9" />
              </div>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Filter className="size-4" /> Filter
              </Button>
            </div>
          </header>

          <section className="grid gap-3 sm:grid-cols-4">
            {stats(key).map((s) => (
              <Card key={s.label} className="border-border/70">
                <CardContent className="p-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {s.label}
                  </div>
                  <div className="mt-1 font-serif text-2xl font-bold tracking-tight">{s.value}</div>
                </CardContent>
              </Card>
            ))}
          </section>

          <Card className="border-border/70 shadow-soft">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    <tr className="border-b">
                      {rows.columns.map((c) => (
                        <th key={c} className="px-4 py-3 text-left font-medium">
                          {c}
                        </th>
                      ))}
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.data.map((r, i) => (
                      <tr
                        key={i}
                        className="border-b transition-colors last:border-0 hover:bg-primary-soft/30"
                      >
                        {r.map((cell, j) => (
                          <td
                            key={j}
                            className={["px-4 py-3", j === 0 && "font-medium"]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            {renderCell(cell)}
                          </td>
                        ))}
                        <td className="px-2 py-3 text-right">
                          <Button variant="ghost" size="icon" className="size-7">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <section>
            <div className="mb-3 flex items-end justify-between">
              <h3 className="font-serif text-lg font-bold">Forms in this module</h3>
              <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
                <Link to="/forms">
                  Open catalog <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {forms.map((f) => (
                <Link key={f.key} to={`/forms/${m.key}/${f.key}`} className="group">
                  <Card className="h-full border-border/70 transition-all hover:border-primary/40 hover:shadow-elevated">
                    <CardContent className="flex items-start justify-between gap-2 p-4">
                      <div className="min-w-0">
                        <div className="font-serif text-sm font-bold">{f.title}</div>
                        <div className="mt-1 truncate text-[11px] text-muted-foreground">
                          {f.description}
                        </div>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </AppShell>
    </ModuleGate>
  );
}

type Cell = string | { badge: string; tone?: "success" | "warning" | "destructive" | "info" };

function renderCell(c: Cell) {
  if (typeof c === "string") return c;
  const tone = c.tone ?? "info";
  const cls = {
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    destructive: "bg-destructive/10 text-destructive",
    info: "bg-primary-soft text-primary",
  }[tone];
  return (
    <Badge variant="outline" className={["border-transparent", cls].join(" ")}>
      {c.badge}
    </Badge>
  );
}

function stats(key: string) {
  const map: Record<string, { label: string; value: string }[]> = {
    residents: [
      { label: "Total residents", value: "1,824" },
      { label: "Owners", value: "1,102" },
      { label: "Tenants", value: "722" },
      { label: "Pending KYC", value: "18" },
    ],
    complaints: [
      { label: "Open", value: "14" },
      { label: "Overdue", value: "3" },
      { label: "Avg resolution", value: "18h" },
      { label: "This month", value: "68" },
    ],
    payments: [
      { label: "October collection", value: "₨18.42L" },
      { label: "Outstanding", value: "₨2.18L" },
      { label: "Receipts", value: "212" },
      { label: "Failed", value: "4" },
    ],
    visitor: [
      { label: "Today", value: "42" },
      { label: "Inside", value: "9" },
      { label: "Pre-registered", value: "16" },
      { label: "Blacklisted", value: "0" },
    ],
  };
  return (
    map[key] ?? [
      { label: "Records", value: "128" },
      { label: "This month", value: "24" },
      { label: "Pending", value: "6" },
      { label: "Archived", value: "48" },
    ]
  );
}

function mockRows(key: string): { columns: string[]; data: Cell[][] } {
  const presets: Record<string, { columns: string[]; data: Cell[][] }> = {
    residents: {
      columns: ["Name", "Unit", "Role", "Contact", "Status"],
      data: [
        ["Asha Iyer", "A-1204", "Owner", "+91 98••• 12345", { badge: "Active", tone: "success" }],
        [
          "Rohan Mehta",
          "B-0801",
          "Tenant",
          "+91 98••• 67890",
          { badge: "Active", tone: "success" },
        ],
        [
          "Priya Nair",
          "C-1502",
          "Owner",
          "+91 98••• 22110",
          { badge: "KYC pending", tone: "warning" },
        ],
        ["Karan Shah", "A-0203", "Owner", "+91 98••• 55621", { badge: "Active", tone: "success" }],
        [
          "Meera Rao",
          "B-1101",
          "Tenant",
          "+91 98••• 71234",
          { badge: "Dues", tone: "destructive" },
        ],
      ],
    },
    complaints: {
      columns: ["Ref", "Title", "Unit", "Priority", "Status"],
      data: [
        [
          "CMP-1093",
          "Leak in kitchen sink",
          "A-1204",
          { badge: "High", tone: "warning" },
          { badge: "Assigned", tone: "info" },
        ],
        [
          "CMP-1092",
          "Lobby light not working",
          "B-0301",
          { badge: "Normal" },
          { badge: "In progress", tone: "info" },
        ],
        [
          "CMP-1087",
          "Lift A1 screeching",
          "—",
          { badge: "Urgent", tone: "destructive" },
          { badge: "Overdue", tone: "destructive" },
        ],
        [
          "CMP-1085",
          "Water pressure low",
          "C-1201",
          { badge: "Normal" },
          { badge: "Resolved", tone: "success" },
        ],
      ],
    },
    payments: {
      columns: ["Receipt", "Unit", "Amount", "Method", "Status"],
      data: [
        ["RCT-8821", "A-1204", "₨24,500", "UPI", { badge: "Cleared", tone: "success" }],
        ["RCT-8820", "B-0807", "₨18,900", "NEFT", { badge: "Cleared", tone: "success" }],
        ["RCT-8819", "C-1502", "₨32,100", "Cheque", { badge: "Pending", tone: "warning" }],
        ["RCT-8818", "A-0605", "₨12,400", "UPI", { badge: "Failed", tone: "destructive" }],
      ],
    },
    visitor: {
      columns: ["Name", "Visiting", "Purpose", "In-time", "Status"],
      data: [
        ["Rahul Sharma", "A-1204", "Guest", "10:24", { badge: "Inside", tone: "info" }],
        ["Blue Dart", "B-0801", "Delivery", "10:12", { badge: "Left", tone: "success" }],
        ["Swiggy — Ayan", "C-0303", "Delivery", "10:02", { badge: "Left", tone: "success" }],
        ["Dr. Kapoor", "A-0605", "Home visit", "09:44", { badge: "Inside", tone: "info" }],
      ],
    },
  };
  return (
    presets[key] ?? {
      columns: ["Reference", "Title", "Owner", "Updated", "Status"],
      data: Array.from({ length: 5 }, (_, i) => [
        `${key.slice(0, 3).toUpperCase()}-${1000 + i}`,
        "Sample record " + (i + 1),
        ["Asha Iyer", "Rohan Mehta", "Priya Nair", "Karan Shah", "Meera Rao"][i],
        ["2 min ago", "1 hr ago", "Today", "Yesterday", "3 days ago"][i],
        {
          badge: ["Active", "Pending", "Draft", "Active", "Closed"][i],
          tone: (["success", "warning", "info", "success", "destructive"] as const)[i],
        },
      ]),
    }
  );
}
