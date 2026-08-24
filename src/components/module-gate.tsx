import React from "react";
import { useModules } from "@/contexts/modules-context";
import { AppShell } from "./app-shell";
import { AlertCircle, ShieldAlert } from "lucide-react";
import { Button } from "./ui/button";

interface ModuleGateProps {
  moduleKey: string;
  children: React.ReactNode;
}

export function ModuleGate({ moduleKey, children }: ModuleGateProps) {
  const { isModuleActive, isLoading } = useModules();

  if (isLoading) {
    return (
      <AppShell title="Loading">
        <div className="flex h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  if (!isModuleActive(moduleKey)) {
    return (
      <AppShell title="Module Inactive">
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="mt-6 font-serif text-2xl font-bold tracking-tight">Module Deactivated</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            The requested module{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{moduleKey}</code> is
            currently disabled for your society.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Button onClick={() => window.history.back()} variant="outline">
              Go Back
            </Button>
            <Button onClick={() => (window.location.href = "/settings")}>Manage Modules</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return <>{children}</>;
}
