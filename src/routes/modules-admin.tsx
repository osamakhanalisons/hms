import { createFileRoute } from "@tanstack/react-router";
import { useState, useTransition } from "react";
import { useModules } from "@/contexts/modules-context";
import { AppShell } from "@/components/app-shell";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { toggleModuleFn } from "@/lib/api/tenants";
import { CATEGORY_ORDER } from "@/lib/modules";

export const Route = createFileRoute("/modules-admin")({
  head: () => ({
    meta: [
      { title: "Module Administration — HousingOS" },
      { name: "description", content: "Activate and configure society modules." },
    ],
  }),
  component: ModulesAdmin,
});

function ModulesAdmin() {
  const { allModules, refreshModules } = useModules();
  const [isPending, startTransition] = useTransition();

  const handleToggle = (moduleKey: string, currentActive: boolean) => {
    startTransition(async () => {
      try {
        await toggleModuleFn({ data: { moduleKey, active: !currentActive } });
        toast.success(`Module ${currentActive ? "deactivated" : "activated"} successfully`);
        await refreshModules();
      } catch (err: any) {
        toast.error(err?.message || "Failed to update module state");
      }
    });
  };

  // Group modules by category
  const groups = CATEGORY_ORDER.reduce(
    (acc, cat) => {
      acc[cat] = allModules.filter((m) => m.category === cat);
      return acc;
    },
    {} as Record<string, typeof allModules>,
  );

  return (
    <AppShell
      title="Module Control Panel"
      subtitle="Activate or deactivate features for your housing society"
    >
      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
        {CATEGORY_ORDER.map((cat) => {
          const items = groups[cat] ?? [];
          if (items.length === 0) return null;

          return (
            <section key={cat} className="space-y-4">
              <h2 className="font-serif text-xl font-bold tracking-tight border-b pb-2">{cat}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((m) => (
                  <Card
                    key={m.module_key}
                    className={m.is_active ? "border-primary/50 shadow-sm" : "opacity-75"}
                  >
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          {m.display_name}
                          {m.is_core && (
                            <Badge
                              variant="secondary"
                              className="text-[9px] uppercase tracking-wider h-4 px-1"
                            >
                              Core
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs font-mono">
                          {m.module_key}
                        </CardDescription>
                      </div>
                      {!m.is_core && (
                        <Switch
                          checked={m.is_active}
                          disabled={isPending}
                          onCheckedChange={() => handleToggle(m.module_key, m.is_active)}
                        />
                      )}
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        {m.description || "No description provided."}
                      </p>
                      {m.dependencies.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                          <span>Requires:</span>
                          {m.dependencies.map((d) => (
                            <Badge
                              key={d}
                              variant="outline"
                              className="text-[9px] font-mono py-0 px-1"
                            >
                              {d}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
