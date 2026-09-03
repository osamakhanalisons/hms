import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { PermissionGate } from "@/components/permission-gate";
import { KanbanBoard, KanbanItem, KanbanColumn } from "@/components/kanban-board";
import {
  getComplaintsFn,
  createComplaintFn,
  assignComplaintFn,
  updateComplaintStatusFn,
} from "@/lib/api/complaints";
import { getUnitsFn } from "@/lib/api/property";
import { getTenantUsersFn } from "@/lib/api/roles";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  AlertCircle,
  ClipboardList,
  Plus,
  UserCheck,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/complaints")({
  head: () => ({
    meta: [
      { title: "Complaint Management — HousingOS" },
      { name: "description", content: "Submit, assign, track and resolve society complaints." },
    ],
  }),
  component: ComplaintsRoute,
});

function ComplaintsRoute() {
  return (
    <ModuleGate moduleKey="complaints">
      <ComplaintsPage />
    </ModuleGate>
  );
}

const COLUMNS: KanbanColumn[] = [
  { id: "open", title: "Open Tickets", tone: "destructive" },
  { id: "assigned", title: "Assigned", tone: "info" },
  { id: "in_progress", title: "In Progress", tone: "warning" },
  { id: "resolved", title: "Resolved", tone: "success" },
  { id: "closed", title: "Closed", tone: "neutral" },
];

function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  tone = "default",
  loading = false,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  tone?: "default" | "success" | "destructive" | "warning" | "info";
  loading?: boolean;
}) {
  const toneClasses = {
    default: "text-primary bg-primary/10 border-primary/20",
    success: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
    destructive: "text-rose-600 bg-rose-500/10 border-rose-500/20",
    warning: "text-amber-600 bg-amber-500/10 border-amber-500/20",
    info: "text-sky-600 bg-sky-500/10 border-sky-500/20",
  }[tone];

  return (
    <Card className="border-border/70 shadow-sm hover:shadow-md transition-shadow bg-card">
      <CardContent className="p-5 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <div className="mt-1 h-7 w-28 animate-pulse rounded-md bg-muted" />
          ) : (
            <>
              <p className="font-serif text-2xl font-bold tracking-tight text-foreground">{value}</p>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </>
          )}
        </div>
        <div className={cn("grid size-11 place-items-center rounded-xl border shrink-0", toneClasses)}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function ComplaintsPage() {
  const { user, roles } = useAuth();
  const isAdmin =
    roles.includes("super_admin") ||
    roles.includes("society_admin") ||
    roles.includes("maintenance_head");
  const queryClient = useQueryClient();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const isAssignedStaff = selectedTicket && selectedTicket.assigned_to === user?.id;

  // Submit Form state
  const [unitId, setUnitId] = useState("");
  const [category, setCategory] = useState<any>("other");
  const [priority, setPriority] = useState<any>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Action state
  const [assigneeId, setAssigneeId] = useState("");
  const [notes, setNotes] = useState("");

  const {
    data: complaints = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["complaints"],
    queryFn: async () => getComplaintsFn(),
  });

  const { data: units = [] } = useQuery({
    queryKey: ["units"],
    queryFn: async () => getUnitsFn(),
  });

  // Fetch staff users (society admin, technicians, guards, etc.)
  const { data: staffUsers = [] } = useQuery({
    queryKey: ["tenant-users-staff"],
    queryFn: async () => {
      const allUsers = await getTenantUsersFn();
      const excludedRoles = [
        "super_admin",
        "society_admin",
        "finance_head",
        "security_head",
        "guard",
        "resident",
        "tenant",
      ];
      return allUsers.filter(
        (u: { id: string; full_name: string; email: string; roles: string[] }) =>
          u.roles.some((r: string) => !excludedRoles.includes(r)),
      );
    },
  });

  const submitComplaint = useMutation({
    mutationFn: createComplaintFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      toast.success("Complaint submitted successfully");
      setSubmitOpen(false);
      resetForm();
    },
  });

  const assignTicket = useMutation({
    mutationFn: assignComplaintFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      toast.success("Ticket assigned successfully");
      setDetailOpen(false);
    },
  });

  const updateStatus = useMutation({
    mutationFn: updateComplaintStatusFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      toast.success("Ticket status updated");
      setDetailOpen(false);
      setNotes("");
    },
  });

  const resetForm = () => {
    setUnitId("");
    setCategory("other");
    setPriority("medium");
    setTitle("");
    setDescription("");
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    submitComplaint.mutate({
      data: { unitId: unitId || undefined, category, priority, title, description },
    });
  };

  const handleAssign = () => {
    if (!selectedTicket || !assigneeId) return;
    assignTicket.mutate({
      data: { complaintId: selectedTicket.id, assignedTo: assigneeId },
    });
  };

  const handleUpdateStatus = (status: "in_progress" | "resolved" | "closed") => {
    if (!selectedTicket) return;
    updateStatus.mutate({
      data: { complaintId: selectedTicket.id, status, resolutionNotes: notes || undefined },
    });
  };

  // Filter complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c: any) => {
      if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
      if (priorityFilter !== "all" && c.priority !== priorityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = c.title?.toLowerCase().includes(q);
        const matchesDesc = c.description?.toLowerCase().includes(q);
        const matchesUnit = (c.full_path || "").toLowerCase().includes(q);
        const matchesSubmitter = (c.submitter_name || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesUnit && !matchesSubmitter) return false;
      }
      return true;
    });
  }, [complaints, categoryFilter, priorityFilter, searchQuery]);

  // KPI Metrics
  const totalCount = complaints.length;
  const openCount = complaints.filter((c: any) => c.status === "open").length;
  const inProgressCount = complaints.filter(
    (c: any) => c.status === "in_progress" || c.status === "assigned",
  ).length;
  const resolvedCount = complaints.filter(
    (c: any) => c.status === "resolved" || c.status === "closed",
  ).length;

  const kanbanItems: KanbanItem[] = useMemo(() => {
    return filteredComplaints.map((c: any) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      meta: `${c.full_path || "Global"} · ${format(new Date(c.created_at), "dd MMM")}`,
      badge: c.priority,
      badgeTone:
        c.priority === "critical" ? "destructive" : c.priority === "high" ? "default" : "outline",
    }));
  }, [filteredComplaints]);

  const itemColumnMap = useMemo(() => {
    return filteredComplaints.reduce((acc: any, c: any) => {
      acc[c.id] = c.status;
      return acc;
    }, {});
  }, [filteredComplaints]);

  const handleItemClick = (item: KanbanItem) => {
    const rawTicket = complaints.find((c: any) => c.id === item.id);
    setSelectedTicket(rawTicket);
    setAssigneeId(rawTicket?.assigned_to || "");
    setDetailOpen(true);
  };

  return (
    <AppShell
      title="Complaint Management"
      subtitle="Track resident tickets, assign technicians, and monitor SLA breach windows"
    >
      <div className="mx-auto w-full max-w-[95rem] space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        {/* Page Header & Action Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <ClipboardList className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
                  Complaint Management
                </h1>
                <Badge variant="secondary" className="font-mono text-xs font-normal">
                  {complaints.length} tickets
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Track resident tickets, assign technicians, and monitor SLA breach windows
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs bg-background"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={cn("size-3.5", isRefetching && "animate-spin")} />
              <span>Refresh</span>
            </Button>
            <PermissionGate moduleKey="complaints" action="create" fallback={null}>
              <Button
                size="sm"
                onClick={() => setSubmitOpen(true)}
                className="gap-1.5 h-9 text-xs bg-primary text-primary-foreground hover:bg-primary/95 shadow-sm"
              >
                <Plus className="size-4" />
                <span>Raise Complaint</span>
              </Button>
            </PermissionGate>
          </div>
        </div>

        {/* KPI Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Complaints"
            value={totalCount}
            subtitle="All logged tickets"
            icon={ClipboardList}
            tone="info"
            loading={isLoading}
          />
          <KpiCard
            label="Open / Pending"
            value={openCount}
            subtitle="Awaiting triage & assignment"
            icon={AlertCircle}
            tone="destructive"
            loading={isLoading}
          />
          <KpiCard
            label="In Progress / Assigned"
            value={inProgressCount}
            subtitle="Work actively underway"
            icon={Clock}
            tone="warning"
            loading={isLoading}
          />
          <KpiCard
            label="Resolved / Closed"
            value={resolvedCount}
            subtitle="Completed & verified"
            icon={CheckCircle2}
            tone="success"
            loading={isLoading}
          />
        </section>

        {/* Filters & Search */}
        <Card className="border-border/70 shadow-sm p-4 bg-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search tickets, units, residents..."
                  className="h-9 pl-9 text-xs bg-background"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Priority Filter */}
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-9 w-40 text-xs bg-background">
                  <Filter className="mr-1.5 size-3.5 text-muted-foreground" />
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Priorities
                  </SelectItem>
                  <SelectItem value="critical" className="text-xs">
                    Critical
                  </SelectItem>
                  <SelectItem value="high" className="text-xs">
                    High
                  </SelectItem>
                  <SelectItem value="medium" className="text-xs">
                    Medium
                  </SelectItem>
                  <SelectItem value="low" className="text-xs">
                    Low
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-9 w-44 text-xs bg-background">
                  <Wrench className="mr-1.5 size-3.5 text-muted-foreground" />
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Categories
                  </SelectItem>
                  <SelectItem value="electrical" className="text-xs">
                    Electrical
                  </SelectItem>
                  <SelectItem value="plumbing" className="text-xs">
                    Plumbing
                  </SelectItem>
                  <SelectItem value="security" className="text-xs">
                    Security
                  </SelectItem>
                  <SelectItem value="cleaning" className="text-xs">
                    Cleaning
                  </SelectItem>
                  <SelectItem value="lift" className="text-xs">
                    Elevator / Lift
                  </SelectItem>
                  <SelectItem value="water" className="text-xs">
                    Water Supply
                  </SelectItem>
                  <SelectItem value="civil" className="text-xs">
                    Civil / Structural
                  </SelectItem>
                  <SelectItem value="hvac" className="text-xs">
                    HVAC
                  </SelectItem>
                  <SelectItem value="other" className="text-xs">
                    Other
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(searchQuery || categoryFilter !== "all" || priorityFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSearchQuery("");
                  setCategoryFilter("all");
                  setPriorityFilter("all");
                }}
              >
                Reset Filters
              </Button>
            )}
          </div>
        </Card>

        {/* Kanban Board */}
        <div>
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <KanbanBoard
              columns={COLUMNS}
              items={kanbanItems}
              itemColumnMap={itemColumnMap}
              onItemClick={handleItemClick}
            />
          )}
        </div>
      </div>

      {/* Submit Ticket Dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Submit Trouble Ticket</DialogTitle>
            <DialogDescription>Submit maintenance or facility complaints</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Affected Unit (Optional)
                </label>
                <Select value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_path || `Unit ${u.unit_number}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Category</label>
                <Select value={category} onValueChange={(val: any) => setCategory(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electrical">Electrical Work</SelectItem>
                    <SelectItem value="plumbing">Plumbing Work</SelectItem>
                    <SelectItem value="security">Security Issue</SelectItem>
                    <SelectItem value="cleaning">Janitorial/Cleaning</SelectItem>
                    <SelectItem value="lift">Elevator/Lift</SelectItem>
                    <SelectItem value="water">Water Supply</SelectItem>
                    <SelectItem value="civil">Civil/Structural</SelectItem>
                    <SelectItem value="hvac">HVAC/AC Repair</SelectItem>
                    <SelectItem value="other">Other / Miscellaneous</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Ticket Title</label>
                <Input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lobby corridor light bulb fused"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Detailed Description
                </label>
                <Textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Provide details of the problem..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Initial Urgency Priority
                </label>
                <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low (Routine)</SelectItem>
                    <SelectItem value="medium">Medium (Standard)</SelectItem>
                    <SelectItem value="high">High (Urgent)</SelectItem>
                    <SelectItem value="critical">Critical (Emergency)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setSubmitOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Submit Ticket</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ticket Details / Workflow Drawer */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">{selectedTicket?.title}</DialogTitle>
            <DialogDescription>
              Raised by {selectedTicket?.submitter_name || "Resident"} for{" "}
              {selectedTicket?.full_path || "Global"}
            </DialogDescription>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-2">
                <p className="text-foreground/90 leading-relaxed">{selectedTicket.description}</p>
                <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-muted-foreground border-t">
                  <div>
                    Priority:{" "}
                    <span className="text-foreground capitalize font-semibold">
                      {selectedTicket.priority}
                    </span>
                  </div>
                  <div>
                    Category:{" "}
                    <span className="text-foreground capitalize font-semibold">
                      {selectedTicket.category}
                    </span>
                  </div>
                </div>
              </div>

              {/* Assignment actions */}
              {isAdmin ? (
                <div className="space-y-2 border-t pt-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Assign Staff / Operator
                  </h4>
                  <div className="flex gap-2">
                    <Select value={assigneeId} onValueChange={setAssigneeId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select Technician..." />
                      </SelectTrigger>
                      <SelectContent>
                        {staffUsers.map((u: any) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name} (
                            {u.roles.map((r: string) => r.replace("_", " ")).join(", ")})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleAssign}
                      disabled={!assigneeId}
                      size="sm"
                      className="gap-1"
                    >
                      <UserCheck className="size-4" /> Assign
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 border-t pt-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Assigned Operator / Staff
                  </h4>
                  <div className="text-sm font-semibold text-foreground">
                    {selectedTicket.assignee_name ? (
                      <span>{selectedTicket.assignee_name}</span>
                    ) : (
                      <span className="text-muted-foreground font-normal italic">
                        Pending Assignment
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Workflow Actions */}
              {isAdmin || isAssignedStaff ? (
                <div className="space-y-3 border-t pt-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Workflow Transition
                  </h4>

                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground block font-semibold">
                      Resolution Note (Required to resolve)
                    </label>
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Explain repairs carried out..."
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedTicket.status === "assigned" && (
                      <Button
                        onClick={() => handleUpdateStatus("in_progress")}
                        size="sm"
                        variant="outline"
                        className="text-warning-foreground border-warning/30 bg-warning/5"
                      >
                        Start Progress
                      </Button>
                    )}
                    {(selectedTicket.status === "assigned" ||
                      selectedTicket.status === "in_progress") && (
                      <Button
                        onClick={() => handleUpdateStatus("resolved")}
                        size="sm"
                        disabled={!notes}
                        className="bg-success text-success-foreground hover:bg-success/90"
                      >
                        Mark Resolved
                      </Button>
                    )}
                    {selectedTicket.status === "resolved" && (
                      <Button
                        onClick={() => handleUpdateStatus("closed")}
                        size="sm"
                        variant="secondary"
                      >
                        Close Ticket
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                selectedTicket.resolution_notes && (
                  <div className="space-y-2 border-t pt-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Resolution Note
                    </h4>
                    <p className="text-sm text-foreground bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-200 p-2.5 rounded-lg">
                      {selectedTicket.resolution_notes}
                    </p>
                  </div>
                )
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
