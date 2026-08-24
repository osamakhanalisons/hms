import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  KanbanSquare,
  Plus,
  Search,
  RefreshCw,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Filter,
  Sliders,
  UserCheck,
  Building,
  Layers,
  Receipt,
  Eye,
  EyeOff,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { useAuth } from "@/hooks/use-auth";
import { ModuleGate } from "@/components/module-gate";
import {
  getProjectsOverviewFn,
  createProjectFn,
  updateProjectStatusFn,
  addProjectMilestoneFn,
  updateMilestoneStatusFn,
  addProjectExpenseFn,
  type ProjectItem,
} from "@/lib/api/projects";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects — HousingOS" },
      { name: "description", content: "Capex planning, milestones, and expense tracking for society projects." },
    ],
  }),
  component: ProjectsRoute,
});

function ProjectsRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <AppShell title="Loading">
        <div className="flex h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppShell>
    );
  }
  if (!user) {
    return (
      <AppShell title="Access Denied" subtitle="Projects">
        <div className="mx-auto max-w-md py-16 text-center space-y-4">
          <ShieldAlert className="size-12 mx-auto text-destructive" />
          <h2 className="text-lg font-bold font-serif">Authentication Required</h2>
          <p className="text-sm text-muted-foreground">Please log in to access project management.</p>
        </div>
      </AppShell>
    );
  }
  return (
    <ModuleGate moduleKey="projects">
      <ProjectsPage />
    </ModuleGate>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  loading = false,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  tone?: "default" | "success" | "destructive" | "warning" | "info";
  loading?: boolean;
}) {
  const toneClass = {
    default: "text-primary bg-primary/10",
    success: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
    destructive: "text-rose-600 bg-rose-50 dark:bg-rose-950/30",
    warning: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
    info: "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
  }[tone];

  return (
    <Card className="border-border/70 shadow-soft">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            {loading ? (
              <div className="mt-2 h-7 w-28 animate-pulse rounded-md bg-muted" />
            ) : (
              <p className="mt-1 font-serif text-2xl font-bold tracking-tight">{value}</p>
            )}
          </div>
          <div className={`rounded-lg p-2.5 ${toneClass}`}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatCurrency(v: number) {
  return "₨" + Math.round(v).toLocaleString("en-PK");
}

function ProjectsPage() {
  const { roles } = useAuth();
  const canManage = roles.some((r) =>
    ["super_admin", "society_admin", "treasurer", "committee_member", "maintenance_head"].includes(r),
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create Project modal state
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [residentVisible, setResidentVisible] = useState(true);
  const [addError, setAddError] = useState<string | null>(null);
  const [isAddSubmitting, setIsAddSubmitting] = useState(false);

  // Add Milestone modal state
  const [milestoneProject, setMilestoneProject] = useState<ProjectItem | null>(null);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDueDate, setMilestoneDueDate] = useState("");
  const [milestoneNotes, setMilestoneNotes] = useState("");
  const [milestoneError, setMilestoneError] = useState<string | null>(null);
  const [isMilestoneSubmitting, setIsMilestoneSubmitting] = useState(false);

  // Add Expense modal state
  const [expenseProject, setExpenseProject] = useState<ProjectItem | null>(null);
  const [expenseVendorId, setExpenseVendorId] = useState("");
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [expenseInvoice, setExpenseInvoice] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [isExpenseSubmitting, setIsExpenseSubmitting] = useState(false);

  // Details Modal
  const [detailsProject, setDetailsProject] = useState<ProjectItem | null>(null);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["projects", statusFilter, search],
    queryFn: () => getProjectsOverviewFn({ data: { status: statusFilter, search } }),
    staleTime: 15_000,
  });

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!name.trim()) return setAddError("Project name is required");

    setIsAddSubmitting(true);
    try {
      await createProjectFn({
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          budgetAmount: budget ? Number(budget) : 0,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          ownerId: ownerId || undefined,
          residentVisible,
        },
      });
      setAddOpen(false);
      setName(""); setDescription(""); setBudget(""); setStartDate(""); setEndDate(""); setOwnerId("");
      refetch();
    } catch (err: any) {
      setAddError(err.message || "Failed to create project");
    } finally {
      setIsAddSubmitting(false);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneProject) return;
    setMilestoneError(null);
    if (!milestoneTitle.trim()) return setMilestoneError("Milestone title is required");

    setIsMilestoneSubmitting(true);
    try {
      await addProjectMilestoneFn({
        data: {
          projectId: milestoneProject.id,
          title: milestoneTitle.trim(),
          dueDate: milestoneDueDate || undefined,
          notes: milestoneNotes.trim() || undefined,
        },
      });
      setMilestoneProject(null);
      setMilestoneTitle(""); setMilestoneDueDate(""); setMilestoneNotes("");
      refetch();
    } catch (err: any) {
      setMilestoneError(err.message || "Failed to add milestone");
    } finally {
      setIsMilestoneSubmitting(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseProject) return;
    setExpenseError(null);
    if (!expenseTitle.trim()) return setExpenseError("Expense title is required");
    const amt = Number(expenseAmount);
    if (isNaN(amt) || amt <= 0) return setExpenseError("Amount must be greater than zero");

    setIsExpenseSubmitting(true);
    try {
      await addProjectExpenseFn({
        data: {
          projectId: expenseProject.id,
          vendorId: expenseVendorId || undefined,
          title: expenseTitle.trim(),
          amount: amt,
          expenseDate,
          invoiceNumber: expenseInvoice.trim() || undefined,
          notes: expenseNotes.trim() || undefined,
        },
      });
      setExpenseProject(null);
      setExpenseVendorId(""); setExpenseTitle(""); setExpenseAmount(""); setExpenseInvoice(""); setExpenseNotes("");
      refetch();
    } catch (err: any) {
      setExpenseError(err.message || "Failed to record expense");
    } finally {
      setIsExpenseSubmitting(false);
    }
  };

  const handleStatusChange = async (projectId: string, newStatus: any) => {
    try {
      await updateProjectStatusFn({ data: { projectId, status: newStatus } });
      refetch();
    } catch (err: any) {
      alert(err.message || "Failed to update project status");
    }
  };

  const handleMilestoneStatusChange = async (milestoneId: string, newStatus: any) => {
    try {
      await updateMilestoneStatusFn({ data: { milestoneId, status: newStatus } });
      refetch();
    } catch (err: any) {
      alert(err.message || "Failed to update milestone status");
    }
  };

  const summary = data?.summary;
  const projects = data?.projects ?? [];
  const milestones = data?.milestones ?? [];
  const expenses = data?.expenses ?? [];
  const vendors = data?.vendorsList ?? [];
  const users = data?.usersList ?? [];

  return (
    <AppShell
      title="Projects"
      subtitle="Capex planning, milestones, and expense tracking"
      actions={
        <div className="flex items-center gap-2">
          {canManage && (
            <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" /> Create Project
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`size-3 text-muted-foreground ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
        {/* Page header */}
        <header className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-md bg-surface border border-border/60">
            <KanbanSquare className="size-5 text-primary" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Operations · Capex
            </div>
            <h1 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
              Capital Projects & Milestones
            </h1>
          </div>
        </header>

        {/* Error banner */}
        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-4 shrink-0" />
              <p className="text-sm font-medium">
                {error instanceof Error ? error.message : "Failed to load projects"}
              </p>
            </div>
          </div>
        )}

        {/* KPI cards */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="Total Projects" value={String(summary?.totalProjects ?? 0)} icon={KanbanSquare} loading={isLoading} />
          <KpiCard label="Active Projects" value={String(summary?.activeProjects ?? 0)} icon={TrendingUp} tone="info" loading={isLoading} />
          <KpiCard label="Allocated Budget" value={formatCurrency(summary?.totalBudget ?? 0)} icon={DollarSign} loading={isLoading} />
          <KpiCard label="Total Spent" value={formatCurrency(summary?.totalSpent ?? 0)} icon={Receipt} tone="warning" loading={isLoading} />
          <KpiCard label="Remaining Budget" value={formatCurrency(summary?.remainingBudget ?? 0)} icon={CheckCircle2} tone="success" loading={isLoading} />
        </section>

        {/* Search & Filter */}
        <Card className="border-border/70 shadow-soft p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search project name or description..." className="h-9 pl-9 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-40 text-xs">
                <Sliders className="mr-1.5 size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                <SelectItem value="planning" className="text-xs">Planning</SelectItem>
                <SelectItem value="in_progress" className="text-xs">In Progress</SelectItem>
                <SelectItem value="on_hold" className="text-xs">On Hold</SelectItem>
                <SelectItem value="completed" className="text-xs">Completed</SelectItem>
                <SelectItem value="cancelled" className="text-xs">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Projects Cards Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-bold">Society Projects</h2>
            <span className="text-xs text-muted-foreground">{projects.length} projects listed</span>
          </div>

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-56 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : !projects.length ? (
            <Card className="border-border/70 p-12 text-center text-muted-foreground">
              <KanbanSquare className="size-10 mx-auto opacity-30 mb-2" />
              <p className="text-sm font-medium">No projects found</p>
              {canManage && <p className="text-xs text-muted-foreground mt-1">Click "Create Project" to add your first capex project.</p>}
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((proj) => (
                <Card key={proj.id} className="border-border/70 shadow-soft flex flex-col justify-between hover:border-border transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="font-serif text-base font-bold line-clamp-1">{proj.name}</CardTitle>
                        <CardDescription className="text-xs line-clamp-2 mt-1">{proj.description || "No description provided."}</CardDescription>
                      </div>
                      {canManage ? (
                        <Select value={proj.status} onValueChange={(val) => handleStatusChange(proj.id, val)}>
                          <SelectTrigger className="h-7 w-28 text-[11px] font-medium border-border/80">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="planning" className="text-xs">Planning</SelectItem>
                            <SelectItem value="in_progress" className="text-xs">In Progress</SelectItem>
                            <SelectItem value="on_hold" className="text-xs">On Hold</SelectItem>
                            <SelectItem value="completed" className="text-xs">Completed</SelectItem>
                            <SelectItem value="cancelled" className="text-xs">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="capitalize text-[11px]">
                          {proj.status.replace("_", " ")}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 text-xs pt-0 flex-1 flex flex-col justify-end">
                    {/* Budget & Progress */}
                    <div className="space-y-1.5 rounded-lg bg-muted/40 p-3">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Budget Allocated</span>
                        <span className="font-bold">{formatCurrency(proj.budgetAmount)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Spent to Date</span>
                        <span className={`font-bold ${proj.isOverBudget ? "text-rose-600" : ""}`}>
                          {formatCurrency(proj.spentAmount)}
                        </span>
                      </div>
                      <Progress value={proj.progressPercent} className={`h-1.5 mt-1 ${proj.isOverBudget ? "[&>div]:bg-rose-600" : ""}`} />
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                        <span>{proj.progressPercent}% utilized</span>
                        {proj.isOverBudget ? (
                          <span className="text-rose-600 font-semibold flex items-center gap-1">
                            <AlertTriangle className="size-3" /> Over Budget
                          </span>
                        ) : (
                          <span>Rem: {formatCurrency(proj.remainingBudget)}</span>
                        )}
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <UserCheck className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{proj.ownerName || "Unassigned"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                        <span>{proj.endDate || "No target date"}</span>
                      </div>
                    </div>

                    {/* Milestones count */}
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/50">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Layers className="size-3.5" /> Milestones:
                      </span>
                      <span className="font-semibold">{proj.completedMilestonesCount} / {proj.milestonesCount} done</span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 pt-2">
                      {canManage && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] flex-1 gap-1"
                            onClick={() => setMilestoneProject(proj)}
                          >
                            <Plus className="size-3" /> Milestone
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] flex-1 gap-1"
                            onClick={() => setExpenseProject(proj)}
                          >
                            <Receipt className="size-3" /> Expense
                          </Button>
                        </>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-7 text-[11px] gap-1"
                        onClick={() => setDetailsProject(proj)}
                      >
                        <Eye className="size-3" /> Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recent Expenses & Milestones Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Milestones Table */}
          <Card className="border-border/70 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-base font-bold">Project Milestones</CardTitle>
              <CardDescription className="text-[11px]">Tracked deliverables and key target dates</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!milestones.length ? (
                <div className="p-8 text-center text-xs text-muted-foreground">No milestones recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Milestone / Project</th>
                        <th className="px-4 py-3">Due Date</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {milestones.slice(0, 10).map((m) => (
                        <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="font-medium">{m.title}</div>
                            <div className="text-[10px] text-muted-foreground">{m.projectName}</div>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{m.dueDate || "—"}</td>
                          <td className="px-4 py-2.5">
                            {canManage ? (
                              <Select value={m.status} onValueChange={(val) => handleMilestoneStatusChange(m.id, val)}>
                                <SelectTrigger className="h-6 w-24 text-[10px] border-border/80">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="planned" className="text-xs">Planned</SelectItem>
                                  <SelectItem value="in_progress" className="text-xs">In Progress</SelectItem>
                                  <SelectItem value="completed" className="text-xs">Completed</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="outline" className="capitalize text-[10px]">
                                {m.status.replace("_", " ")}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expenses Table */}
          <Card className="border-border/70 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-base font-bold">Project Expenses Log</CardTitle>
              <CardDescription className="text-[11px]">Recent vendor invoices and costs logged against projects</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!expenses.length ? (
                <div className="p-8 text-center text-xs text-muted-foreground">No project expenses logged yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Title / Project</th>
                        <th className="px-4 py-3">Vendor</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {expenses.slice(0, 10).map((exp) => (
                        <tr key={exp.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="font-medium">{exp.title}</div>
                            <div className="text-[10px] text-muted-foreground">{exp.projectName}</div>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{exp.vendorName || "—"}</td>
                          <td className="px-4 py-2.5 text-right font-bold">{formatCurrency(exp.amount)}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{exp.expenseDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Project Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Create Capital Project</DialogTitle>
            <DialogDescription className="text-xs">Register a new capex or improvement project.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-3">
            {addError && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{addError}</div>}
            <div className="space-y-1.5">
              <Label className="text-xs">Project Name *</Label>
              <Input placeholder="e.g. Lobby Renovation Phase 1" className="h-9 text-xs" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input placeholder="Brief details about the project goals" className="h-9 text-xs" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Budget Allocated (₹)</Label>
                <Input type="number" placeholder="500000" className="h-9 text-xs font-mono" value={budget} onChange={(e) => setBudget(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Project Owner / Lead</Label>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date</Label>
                <Input type="date" className="h-9 text-xs" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Target End Date</Label>
                <Input type="date" className="h-9 text-xs" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="resVis"
                checked={residentVisible}
                onChange={(e) => setResidentVisible(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="resVis" className="text-xs text-muted-foreground">Visible to residents in portal</label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(false)} disabled={isAddSubmitting}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isAddSubmitting}>{isAddSubmitting ? "Creating..." : "Create Project"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Milestone Dialog */}
      <Dialog open={!!milestoneProject} onOpenChange={(o) => !o && setMilestoneProject(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Add Project Milestone</DialogTitle>
            <DialogDescription className="text-xs">Project: <span className="font-semibold">{milestoneProject?.name}</span></DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMilestone} className="space-y-3">
            {milestoneError && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{milestoneError}</div>}
            <div className="space-y-1.5">
              <Label className="text-xs">Milestone Title *</Label>
              <Input placeholder="e.g. Civil Work Completion" className="h-9 text-xs" value={milestoneTitle} onChange={(e) => setMilestoneTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Target Due Date</Label>
              <Input type="date" className="h-9 text-xs" value={milestoneDueDate} onChange={(e) => setMilestoneDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes / Details</Label>
              <Input placeholder="Optional milestone details" className="h-9 text-xs" value={milestoneNotes} onChange={(e) => setMilestoneNotes(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setMilestoneProject(null)} disabled={isMilestoneSubmitting}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isMilestoneSubmitting}>{isMilestoneSubmitting ? "Saving..." : "Add Milestone"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={!!expenseProject} onOpenChange={(o) => !o && setExpenseProject(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Record Project Expense</DialogTitle>
            <DialogDescription className="text-xs">Log cost against: <span className="font-semibold">{expenseProject?.name}</span></DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddExpense} className="space-y-3">
            {expenseError && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{expenseError}</div>}
            <div className="space-y-1.5">
              <Label className="text-xs">Expense Title *</Label>
              <Input placeholder="e.g. Marble Tile Procurement" className="h-9 text-xs" value={expenseTitle} onChange={(e) => setExpenseTitle(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Amount (₹) *</Label>
                <Input type="number" placeholder="50000" className="h-9 text-xs font-mono" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Expense Date *</Label>
                <Input type="date" className="h-9 text-xs" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vendor (Optional)</Label>
              <Select value={expenseVendorId} onValueChange={setExpenseVendorId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select Vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="text-xs">{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Invoice Ref # (Optional)</Label>
              <Input placeholder="INV-2026-001" className="h-9 text-xs font-mono" value={expenseInvoice} onChange={(e) => setExpenseInvoice(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setExpenseProject(null)} disabled={isExpenseSubmitting}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isExpenseSubmitting}>{isExpenseSubmitting ? "Recording..." : "Record Expense"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={!!detailsProject} onOpenChange={(o) => !o && setDetailsProject(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">{detailsProject?.name}</DialogTitle>
            <DialogDescription className="text-xs">{detailsProject?.description || "No description provided."}</DialogDescription>
          </DialogHeader>
          {detailsProject && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Budget</div>
                  <div className="font-bold text-sm">{formatCurrency(detailsProject.budgetAmount)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Total Spent</div>
                  <div className={`font-bold text-sm ${detailsProject.isOverBudget ? "text-rose-600" : ""}`}>{formatCurrency(detailsProject.spentAmount)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Remaining</div>
                  <div className="font-bold text-sm">{formatCurrency(detailsProject.remainingBudget)}</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-1">Associated Milestones</h4>
                {milestones.filter((m) => m.projectId === detailsProject.id).length === 0 ? (
                  <p className="text-muted-foreground italic text-[11px]">No milestones for this project.</p>
                ) : (
                  <ul className="space-y-1 text-[11px]">
                    {milestones.filter((m) => m.projectId === detailsProject.id).map((m) => (
                      <li key={m.id} className="flex items-center justify-between border-b border-border/40 py-1">
                        <span>{m.title}</span>
                        <Badge variant="outline" className="capitalize text-[10px]">{m.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4 className="font-semibold mb-1">Logged Expenses</h4>
                {expenses.filter((e) => e.projectId === detailsProject.id).length === 0 ? (
                  <p className="text-muted-foreground italic text-[11px]">No expenses logged for this project.</p>
                ) : (
                  <ul className="space-y-1 text-[11px]">
                    {expenses.filter((e) => e.projectId === detailsProject.id).map((e) => (
                      <li key={e.id} className="flex items-center justify-between border-b border-border/40 py-1">
                        <span>{e.title} {e.vendorName ? `(${e.vendorName})` : ""}</span>
                        <span className="font-bold">{formatCurrency(e.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
