import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { FormRenderer } from "@/components/form-renderer";
import { MODULES } from "@/lib/modules";
import { getForm, getFormsForModule } from "@/lib/forms-registry";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/forms/$module/$form")({
  // The loader only validates params exist and returns serializable primitives.
  // We intentionally do NOT import forms-registry or MODULES here so that
  // no React component references (LucideIcon) enter the server-side RPC bundle.
  loader: ({ params }) => {
    const { module: moduleKey, form: formKey } = params;
    if (!moduleKey || !formKey) throw notFound();
    return { moduleKey, formKey };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Form — HousingOS" }] };
    // Safe to call here — head runs only on server during SSR, and
    // forms-registry is a plain-data module with no React components.
    const form = getForm(loaderData.moduleKey, loaderData.formKey);
    const mod = MODULES.find((m) => m.key === loaderData.moduleKey);
    if (!form || !mod) return { meta: [{ title: "Form — HousingOS" }] };
    return {
      meta: [
        { title: `${form.title} — ${mod.name} — HousingOS` },
        { name: "description", content: form.description },
      ],
    };
  },
  notFoundComponent: () => (
    <AppShell title="Form not found">
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-serif text-3xl font-bold">We couldn't find that form.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          It may belong to a module that isn't active for your workspace.
        </p>
        <Link
          to="/forms"
          className="mt-6 inline-flex text-sm font-medium text-primary hover:underline"
        >
          Back to forms catalog
        </Link>
      </div>
    </AppShell>
  ),
  component: FormPage,
});

function FormPage() {
  // All registry lookups happen here — purely client-side, no serialization needed.
  const { moduleKey, formKey } = Route.useLoaderData();

  const module = MODULES.find((m) => m.key === moduleKey);
  const form = getForm(moduleKey, formKey);
  const peers = getFormsForModule(moduleKey);

  if (!module || !form) {
    return (
      <AppShell title="Form not found">
        <div className="mx-auto max-w-2xl px-6 py-16 text-center">
          <h1 className="font-serif text-3xl font-bold">We couldn't find that form.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            It may belong to a module that isn't active for your workspace.
          </p>
          <Link
            to="/forms"
            className="mt-6 inline-flex text-sm font-medium text-primary hover:underline"
          >
            Back to forms catalog
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={module.name}
      subtitle={form.title}
      actions={
        peers.length > 1 ? (
          <div className="mr-2 hidden items-center gap-1 md:flex">
            {peers.slice(0, 4).map((p) => (
              <Link
                key={p.key}
                to={`/forms/${module.key}/${p.key}`}
                className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-surface hover:text-foreground aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary"
                aria-current={p.key === form.key ? "page" : undefined}
              >
                {p.title}
              </Link>
            ))}
            {peers.length > 4 && (
              <Badge variant="outline" className="ml-1 text-[10px]">
                +{peers.length - 4}
              </Badge>
            )}
          </div>
        ) : null
      }
    >
      <FormRenderer module={module} form={form} />
    </AppShell>
  );
}
