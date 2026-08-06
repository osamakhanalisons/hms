import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createSubmissionFn } from "@/lib/api/db-functions";
import { useAuth } from "@/hooks/use-auth";

import type { FieldDef, FormDef, SectionDef } from "@/lib/forms-registry";
import type { ModuleDef } from "@/lib/modules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  module: ModuleDef;
  form: FormDef;
}

export function FormRenderer({ module, form }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (name: string, v: unknown) => setValues((s) => ({ ...s, [name]: v }));

  // Wizard when explicitly opted-in or when the form has 2+ sections.
  const isWizard = form.wizard ?? form.sections.length >= 2;
  const steps = useMemo(
    () => [
      ...form.sections.map((s, i) => ({
        kind: "section" as const,
        index: i,
        title: s.title,
        section: s,
      })),
      ...(isWizard
        ? [
            {
              kind: "review" as const,
              index: form.sections.length,
              title: "Review & submit",
              section: null,
            },
          ]
        : []),
    ],
    [form, isWizard],
  );

  const [stepIndex, setStepIndex] = useState(0);
  const current = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const sectionAnchors = useMemo(
    () => form.sections.map((s) => ({ id: slug(s.title), title: s.title })),
    [form],
  );

  if (submitted) {
    return (
      <SuccessScreen
        module={module}
        form={form}
        onReset={() => {
          setSubmitted(false);
          setValues({});
          setStepIndex(0);
        }}
        onBack={() => navigate({ to: "/forms" })}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <button onClick={() => navigate({ to: "/forms" })} className="hover:text-foreground">
          Forms catalog
        </button>
        <ChevronRight className="size-3" />
        <span>{module.name}</span>
        <ChevronRight className="size-3" />
        <span className="text-foreground">{form.title}</span>
      </nav>

      {/* Header */}
      <header className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5 text-[10px] uppercase tracking-[0.12em]">
              <module.icon className="size-3" /> {module.category} · {module.name}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {module.plan} plan
            </Badge>
            {isWizard && (
              <Badge className="bg-primary-soft text-primary text-[10px]">
                Step {stepIndex + 1} of {steps.length}
              </Badge>
            )}
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">{form.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {form.description}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/forms" })}
          className="shrink-0"
        >
          <ArrowLeft className="mr-1.5 size-3.5" /> Back
        </Button>
      </header>

      {/* Stepper (wizard mode) */}
      {isWizard && (
        <Stepper
          steps={steps.map((s) => s.title)}
          current={stepIndex}
          onJump={(i) => i <= stepIndex && setStepIndex(i)}
        />
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_220px]">
        {/* Form */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (isWizard && !isLast) {
              setStepIndex((i) => Math.min(i + 1, steps.length - 1));
              return;
            }
            if (!user) {
              toast.error("Please sign in first");
              return;
            }
            setSaving(true);
            try {
              await createSubmissionFn({
                data: {
                  moduleKey: module.key,
                  formKey: form.key,
                  formTitle: form.title,
                  payload: values,
                },
              });
              toast.success(`${form.title} submitted`);
              setSubmitted(true);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Submission failed");
            } finally {
              setSaving(false);
            }
          }}
          className="min-w-0 space-y-6"
        >
          {isWizard ? (
            current.kind === "section" ? (
              <SectionCard section={current.section!} values={values} set={set} />
            ) : (
              <ReviewCard form={form} values={values} onEdit={(i) => setStepIndex(i)} />
            )
          ) : (
            form.sections.map((section) => (
              <SectionCard key={section.title} section={section} values={values} set={set} />
            ))
          )}

          <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur sm:-mx-0 sm:rounded-lg sm:border sm:px-4">
            <div className="flex items-center gap-2">
              {isWizard && stepIndex > 0 && (
                <Button variant="ghost" type="button" onClick={() => setStepIndex((i) => i - 1)}>
                  <ArrowLeft className="mr-1 size-4" /> Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" type="button">
                Cancel
              </Button>
              <Button variant="outline" type="button">
                Save as draft
              </Button>
              {isWizard && !isLast ? (
                <Button type="submit" className="gap-1.5">
                  Next <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button type="submit" className="gap-1.5" disabled={saving}>
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  {form.submitLabel ?? "Save"}
                </Button>
              )}
            </div>
          </div>
        </form>

        {/* Right rail */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-6">
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {isWizard ? "Steps" : "On this form"}
              </div>
              {isWizard ? (
                <ol className="space-y-1.5">
                  {steps.map((s, i) => {
                    const done = i < stepIndex;
                    const active = i === stepIndex;
                    return (
                      <li key={s.title}>
                        <button
                          type="button"
                          onClick={() => i <= stepIndex && setStepIndex(i)}
                          disabled={i > stepIndex}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                            active && "bg-primary-soft text-primary font-medium",
                            !active && done && "text-foreground hover:bg-surface",
                            !active && !done && "text-muted-foreground",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-5 shrink-0 place-items-center rounded-full border text-[10px]",
                              active && "border-primary bg-primary text-primary-foreground",
                              done &&
                                !active &&
                                "border-primary bg-primary text-primary-foreground",
                              !active && !done && "border-border",
                            )}
                          >
                            {done ? <Check className="size-3" /> : i + 1}
                          </span>
                          <span className="truncate">{s.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <ul className="space-y-1.5 border-l">
                  {sectionAnchors.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="-ml-px block border-l border-transparent pl-3 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Card className="border-dashed bg-surface/50">
              <CardContent className="p-4 text-xs leading-relaxed text-muted-foreground">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground">
                  Module gate
                </div>
                If the <span className="font-mono text-foreground">{module.key}</span> module is
                deactivated, this form, its API and audit hooks are hidden across web, mobile and
                the API.
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stepper({
  steps,
  current,
  onJump,
}: {
  steps: string[];
  current: number;
  onJump: (i: number) => void;
}) {
  return (
    <div className="mb-8 hidden md:block">
      <ol className="flex items-center gap-2">
        {steps.map((title, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={title} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => i <= current && onJump(i)}
                disabled={i > current}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                  active && "border-primary bg-primary-soft",
                  done && !active && "border-primary/40 bg-background",
                  !active && !done && "border-border bg-background opacity-70",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold",
                    active || done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className="min-w-0 truncate text-xs font-medium">{title}</span>
              </button>
              {i < steps.length - 1 && (
                <div
                  className={cn("h-px w-4 shrink-0", i < current ? "bg-primary" : "bg-border")}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SectionCard({
  section,
  values,
  set,
}: {
  section: SectionDef;
  values: Record<string, unknown>;
  set: (name: string, v: unknown) => void;
}) {
  return (
    <Card id={slug(section.title)} className="border-border/70 shadow-soft">
      <CardContent className="space-y-5 p-6 sm:p-7">
        <div className="border-b pb-4">
          <h2 className="font-serif text-base font-bold tracking-tight">{section.title}</h2>
          {section.description && (
            <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          {section.fields.map((field) => (
            <FieldControl
              key={field.name}
              field={field}
              value={values[field.name]}
              onChange={(v) => set(field.name, v)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewCard({
  form,
  values,
  onEdit,
}: {
  form: FormDef;
  values: Record<string, unknown>;
  onEdit: (stepIndex: number) => void;
}) {
  return (
    <Card className="border-border/70 shadow-soft">
      <CardContent className="space-y-6 p-6 sm:p-7">
        <div className="border-b pb-4">
          <h2 className="font-serif text-base font-bold tracking-tight">Review & submit</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Confirm the details below. Nothing is saved until you submit.
          </p>
        </div>
        {form.sections.map((section, i) => (
          <div key={section.title} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {section.title}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => onEdit(i)}
                className="h-7 text-xs"
              >
                Edit
              </Button>
            </div>
            <dl className="grid gap-x-6 gap-y-2 rounded-md border bg-surface/40 p-4 sm:grid-cols-2">
              {section.fields.map((field) => {
                const raw = values[field.name];
                const display = formatValue(field, raw);
                return (
                  <div key={field.name} className="flex flex-col gap-0.5">
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {field.label}
                    </dt>
                    <dd
                      className={cn(
                        "text-xs",
                        display ? "text-foreground" : "text-muted-foreground italic",
                      )}
                    >
                      {display || "—"}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SuccessScreen({
  module,
  form,
  onReset,
  onBack,
}: {
  module: ModuleDef;
  form: FormDef;
  onReset: () => void;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-6 grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
        <Check className="size-7" />
      </div>
      <Badge variant="outline" className="mb-3 text-[10px] uppercase tracking-[0.12em]">
        <module.icon className="mr-1 size-3" /> {module.name}
      </Badge>
      <h1 className="font-serif text-3xl font-bold tracking-tight">Submitted</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        <span className="text-foreground">{form.title}</span> was queued for processing. Audit trail
        and downstream automations have been triggered.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" onClick={onReset}>
          Submit another
        </Button>
        <Button onClick={onBack}>Back to catalog</Button>
      </div>
    </div>
  );
}

function formatValue(field: FieldDef, raw: unknown): string {
  if (raw === undefined || raw === null || raw === "") return "";
  if (Array.isArray(raw)) {
    const labels = raw.map((v) => field.options?.find((o) => o.value === v)?.label ?? String(v));
    return labels.join(", ");
  }
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  if (field.type === "select" || field.type === "radio") {
    return field.options?.find((o) => o.value === raw)?.label ?? String(raw);
  }
  if (field.type === "currency") {
    return `${field.prefix ?? "₨"}${raw}`;
  }
  return String(raw);
}

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface FieldProps {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}

function FieldControl({ field, value, onChange }: FieldProps) {
  const spanClass = field.span === 2 ? "sm:col-span-2" : "sm:col-span-1";
  const id = `f-${field.name}`;

  const labelEl = (
    <Label htmlFor={id} className="mb-1.5 flex items-center gap-1 text-xs font-medium">
      {field.label}
      {field.required && <span className="text-destructive">*</span>}
    </Label>
  );

  const help = field.help && (
    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{field.help}</p>
  );

  switch (field.type) {
    case "textarea":
      return (
        <div className={spanClass}>
          {labelEl}
          <Textarea
            id={id}
            rows={field.rows ?? 4}
            placeholder={field.placeholder}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="resize-y"
          />
          {help}
        </div>
      );

    case "select":
      return (
        <div className={spanClass}>
          {labelEl}
          <Select value={(value as string) ?? ""} onValueChange={onChange}>
            <SelectTrigger id={id}>
              <SelectValue placeholder={field.placeholder ?? "Select…"} />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {help}
        </div>
      );

    case "multiselect": {
      const arr = (value as string[]) ?? [];
      return (
        <div className={spanClass}>
          {labelEl}
          <div className="flex flex-wrap gap-1.5 rounded-md border bg-background p-2">
            {(field.options ?? []).map((o) => {
              const active = arr.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() =>
                    onChange(active ? arr.filter((x) => x !== o.value) : [...arr, o.value])
                  }
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          {help}
        </div>
      );
    }

    case "radio":
      return (
        <div className={spanClass}>
          {labelEl}
          <RadioGroup
            value={(value as string) ?? ""}
            onValueChange={onChange}
            className="grid gap-1.5 sm:grid-cols-2"
          >
            {(field.options ?? []).map((o) => (
              <label
                key={o.value}
                htmlFor={`${id}-${o.value}`}
                className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs hover:border-foreground/30 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft has-[[data-state=checked]]:text-primary"
              >
                <RadioGroupItem id={`${id}-${o.value}`} value={o.value} />
                <span>{o.label}</span>
              </label>
            ))}
          </RadioGroup>
          {help}
        </div>
      );

    case "switch":
      return (
        <div className={cn(spanClass)}>
          <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2.5">
            <Label htmlFor={id} className="text-xs font-medium">
              {field.label}
            </Label>
            <Switch
              id={id}
              checked={(value as boolean | undefined) ?? Boolean(field.defaultValue)}
              onCheckedChange={onChange}
            />
          </div>
          {help}
        </div>
      );

    case "checkbox":
      return (
        <div className={spanClass}>
          <div className="flex items-start gap-2">
            <Checkbox
              id={id}
              checked={Boolean(value)}
              onCheckedChange={(c) => onChange(Boolean(c))}
            />
            <Label htmlFor={id} className="text-xs font-medium leading-snug">
              {field.label}
            </Label>
          </div>
          {help}
        </div>
      );

    case "file":
      return (
        <div className={spanClass}>
          {labelEl}
          <label
            htmlFor={id}
            className="flex cursor-pointer items-center justify-center rounded-md border border-dashed bg-surface/50 px-3 py-5 text-center text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft/40 hover:text-foreground"
          >
            <span>
              <span className="font-medium text-foreground">Click to upload</span> or drag & drop
            </span>
          </label>
          <input id={id} type="file" className="sr-only" />
          {help}
        </div>
      );

    case "currency":
      return (
        <div className={spanClass}>
          {labelEl}
          <InputWithAffix
            id={id}
            type="number"
            prefix={field.prefix ?? "₨"}
            suffix={field.suffix}
            value={(value as string) ?? ""}
            onChange={(v) => onChange(v)}
            placeholder={field.placeholder ?? "0.00"}
          />
          {help}
        </div>
      );

    case "color":
      return (
        <div className={spanClass}>
          {labelEl}
          <div className="flex items-center gap-2">
            <input
              id={id}
              type="color"
              defaultValue="#3b82f6"
              className="h-9 w-12 cursor-pointer rounded-md border bg-background"
            />
            <Input defaultValue="#3b82f6" className="font-mono text-xs" />
          </div>
          {help}
        </div>
      );

    default: {
      const type = field.type === "datetime" ? "datetime-local" : field.type;
      const hasAffix = field.prefix || field.suffix;
      if (hasAffix) {
        return (
          <div className={spanClass}>
            {labelEl}
            <InputWithAffix
              id={id}
              type={type}
              prefix={field.prefix}
              suffix={field.suffix}
              value={(value as string) ?? ""}
              onChange={(v) => onChange(v)}
              placeholder={field.placeholder}
            />
            {help}
          </div>
        );
      }
      return (
        <div className={spanClass}>
          {labelEl}
          <Input
            id={id}
            type={type}
            placeholder={field.placeholder}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
          {help}
        </div>
      );
    }
  }
}

function InputWithAffix({
  id,
  type,
  prefix,
  suffix,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  type: string;
  prefix?: string;
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring/40">
      {prefix && (
        <span className="grid place-items-center border-r bg-surface px-2.5 text-xs text-muted-foreground">
          {prefix}
        </span>
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
      />
      {suffix && (
        <span className="grid place-items-center border-l bg-surface px-2.5 text-xs text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}
