import { createFileRoute } from "@tanstack/react-router";
// import { Link } from "@tanstack/react-router";
// import { useMemo, useState } from "react";
// import { Search, ArrowRight } from "lucide-react";

import { AppShell } from "@/components/app-shell";
// import { Input } from "@/components/ui/input";
// import { Badge } from "@/components/ui/badge";
// import { Card, CardContent } from "@/components/ui/card";
// import { CATEGORY_ORDER, type ModuleCategory } from "@/lib/modules";
// import { getModuleWithForms, totalFormCount } from "@/lib/forms-registry";

export const Route = createFileRoute("/forms/")({
  head: () => ({
    meta: [
      { title: "Forms catalog — HousingOS" },
      {
        name: "description",
        content:
          "Every form across every HousingOS module — auth, finance, operations, security, community and more.",
      },
    ],
  }),
  component: FormsCatalog,
});

function FormsCatalog() {
  /*
  const all = useMemo(() => getModuleWithForms(), []);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all
      .map((g) => ({
        ...g,
        forms: g.forms.filter(
          (f) => f.title.toLowerCase().includes(term) || f.description.toLowerCase().includes(term),
        ),
      }))
      .filter((g) => g.forms.length > 0 || g.module.name.toLowerCase().includes(term));
  }, [all, q]);

  const grouped: Record<ModuleCategory, typeof filtered> = {
    Core: [],
    Finance: [],
    Operations: [],
    Security: [],
    Community: [],
    Utilities: [],
    Intelligence: [],
  };
  for (const g of filtered) grouped[g.module.category].push(g);
  */

  return (
    <AppShell
      title="Forms catalog"
      subtitle="This page is currently disabled"
    >
      <div className="flex h-96 flex-col items-center justify-center gap-2 text-center text-muted-foreground p-6">
        <p className="text-sm font-medium">Forms Catalog page is currently disabled.</p>
      </div>
      {/*
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
        <header className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Design library
            </div>
            <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl">
              Every form, every module.
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Each form is generated from a typed registry, so the experience stays consistent
              across categories. Inactive modules hide their forms automatically.
            </p>
          </div>
          <div className="w-full sm:w-72">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search forms…"
                className="h-10 pl-9"
              />
            </div>
          </div>
        </header>

        <div className="space-y-10">
          {CATEGORY_ORDER.map((cat) => {
            const groups = grouped[cat];
            if (groups.length === 0) return null;
            return (
              <section key={cat}>
                <div className="mb-4 flex items-center gap-3">
                  <span className="hairline flex-1" />
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {cat}
                  </h2>
                  <span className="hairline flex-1" />
                </div>
                <div className="space-y-6">
                  {groups.map(({ module, forms }) => (
                    <div key={module.key}>
                      <div className="mb-3 flex items-end justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="grid size-8 shrink-0 place-items-center rounded-md bg-surface">
                            <module.icon className="size-4 text-foreground" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-serif text-base font-bold">
                              {module.name}
                            </div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {module.description}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {forms.length} {forms.length === 1 ? "form" : "forms"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {forms.map((form) => (
                          <Link
                            key={form.key}
                            to="/forms/$module/$form"
                            params={{ module: module.key, form: form.key }}
                            className="group"
                          >
                            <Card className="h-full border-border/70 transition-all hover:border-primary/40 hover:shadow-elevated">
                              <CardContent className="flex h-full flex-col gap-2 p-5">
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className="font-serif text-base font-bold leading-snug">
                                    {form.title}
                                  </h3>
                                  <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                                </div>
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                  {form.description}
                                </p>
                                <div className="mt-auto flex items-center gap-1.5 pt-2 text-[10px] text-muted-foreground">
                                  <span className="font-mono">
                                    {module.key}/{form.key}
                                  </span>
                                  <span>·</span>
                                  <span>
                                    {form.sections.reduce((n, s) => n + s.fields.length, 0)} fields
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      */}
    </AppShell>
  );
}
