import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAuditLogsFn } from "@/lib/api/db-functions";
import { format } from "date-fns";
import { ShieldAlert, RefreshCw, Calendar, Tag, ShieldCheck, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ModuleGate } from "@/components/module-gate";

export const Route = createFileRoute("/audit-log")({
  head: () => ({
    meta: [
      { title: "Audit Log Timeline — HousingOS" },
      { name: "description", content: "Review historical platform activity and user operations." },
    ],
  }),
  component: AuditLogRoute,
});

function AuditLogRoute() {
  const { primaryRole } = useAuth();
  const isSuperAdmin = primaryRole === "super_admin" || primaryRole === "society_admin";

  if (!isSuperAdmin) {
    return (
      <AppShell title="Access Denied" subtitle="Security Restrictive Gate">
        <div className="mx-auto max-w-md py-16 text-center space-y-4">
          <ShieldAlert className="size-12 mx-auto text-destructive" />
          <h2 className="text-lg font-bold font-serif">Unauthorized Area</h2>
          <p className="text-xs text-muted-foreground">
            Only Super Admins or Society Admins can inspect the system audit timeline.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <ModuleGate moduleKey="platform">
      <AuditLogPage />
    </ModuleGate>
  );
}

function AuditLogPage() {
  const [moduleKey, setModuleKey] = useState<string>("all");
  const [actionType, setActionType] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");

  const {
    data: logs = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["audit-logs", moduleKey, actionType, fromDate],
    queryFn: () =>
      getAuditLogsFn({
        data: {
          moduleKey: moduleKey === "all" ? undefined : moduleKey,
          actionType: actionType === "all" ? undefined : actionType,
          fromDate: fromDate || undefined,
        },
      }),
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case "create":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "update":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "delete":
        return "bg-rose-100 text-rose-700 border-rose-200";
      case "auth":
        return "bg-amber-100 text-amber-700 border-amber-200";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(logs.length / itemsPerPage) || 1;
  const paginatedLogs = logs.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <AppShell
      title="Audit Log Viewer"
      subtitle="Track all modifications, role elevations, and active module state transitions"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10 space-y-6">
        {/* Filters */}
        <Card className="border-border/70 shadow-soft">
          <CardContent className="p-4 grid gap-4 sm:grid-cols-4 items-end">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">
                Module Scope
              </label>
              <Select value={moduleKey} onValueChange={(val) => { setModuleKey(val); setPage(1); }}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="all">All Modules</SelectItem>
                  <SelectItem value="platform">Platform Core</SelectItem>
                  <SelectItem value="property">Property</SelectItem>
                  <SelectItem value="residents">Residents</SelectItem>
                  <SelectItem value="ledger">Ledger</SelectItem>
                  <SelectItem value="payments">Payments</SelectItem>
                  <SelectItem value="visitor">Visitors</SelectItem>
                  <SelectItem value="parking">Parking</SelectItem>
                  <SelectItem value="complaints">Complaints</SelectItem>
                  <SelectItem value="notice_board">Notice Board</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">
                Action Type
              </label>
              <Select value={actionType} onValueChange={(val) => { setActionType(val); setPage(1); }}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="auth">Auth / Security</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">
                Since Date
              </label>
              <Input
                type="date"
                className="h-9 text-xs"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              />
            </div>
            <Button
              variant="outline"
              className="h-9 text-xs gap-1.5 w-full"
              onClick={() => refetch()}
            >
              <RefreshCw className="size-3.5" /> Refresh Timeline
            </Button>
          </CardContent>
        </Card>

        {/* Timeline Feed */}
        <Card className="border-border/70 shadow-soft">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">System Timeline</CardTitle>
              <CardDescription className="text-xs">
                Security audit feed for platform events
              </CardDescription>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              Total: {logs.length} logs
            </span>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <ShieldCheck className="size-10 mx-auto text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  No events match the selected filter criteria
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="relative border-l border-border/80 pl-6 ml-3 space-y-6">
                  {(paginatedLogs as any[]).map((log) => (
                    <div key={log.id} className="relative">
                      {/* Circle Node */}
                      <span className="absolute -left-[35px] top-1 grid size-5 place-items-center rounded-full bg-background border border-border ring-4 ring-background">
                        <Tag className="size-2.5 text-muted-foreground" />
                      </span>
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${getActionColor(log.action)}`}
                        >
                          {log.action}
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {log.description}
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                          <Calendar className="size-3" />
                          {format(new Date(log.created_at), "dd MMM yyyy, hh:mm:ss a")}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="size-3" /> Actor:{" "}
                          <span className="font-mono">{log.actor_email || "System/Cron"}</span>
                        </span>
                        {log.module_key && (
                          <span>
                            Module:{" "}
                            <Badge variant="outline" className="text-[10px] capitalize px-1 py-0">
                              {log.module_key}
                            </Badge>
                          </span>
                        )}
                        {log.record_id && (
                          <span className="font-mono text-[10px]">ID: {log.record_id}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                {logs.length > itemsPerPage && (
                  <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
                    <div>
                      Showing {(page - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(page * itemsPerPage, logs.length)} of {logs.length} entries
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                        className="h-8 text-xs px-3"
                      >
                        Previous
                      </Button>
                      <span className="font-medium text-foreground">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                        className="h-8 text-xs px-3"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
