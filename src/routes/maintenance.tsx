import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import {
  Wrench,
  Calendar,
  Plus,
  Search,
  RefreshCw,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Filter,
  Sliders,
  MapPin,
  Tag,
  UserCheck,
  Truck,
  FileEdit,
  Power,
  Layers,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  getMaintenanceOverviewFn,
  createWorkOrderFn,
  updateWorkOrderStatusFn,
  createMaintenanceScheduleFn,
  toggleMaintenanceScheduleStatusFn,
  type WorkOrderItem,
  type MaintenanceScheduleItem,
} from "@/lib/api/maintenance";

export const Route = createFileRoute("/maintenance")({
  head: () => ({
    meta: [
      { title: "Maintenance & Schedules — HousingOS" },
      { name: "description", content: "Preventive asset maintenance, work orders and SLA tracking." },
    ],
  }),
  component: MaintenanceRoute,
});

function MaintenanceRoute() {
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
      <AppShell title="Access Denied" subtitle="Maintenance">
        <div className="mx-auto max-w-md py-16 text-center space-y-4">
          <ShieldAlert className="size-12 mx-auto text-destructive" />
          <h2 className="text-lg font-bold font-serif">Authentication Required</h2>
          <p className="text-sm text-muted-foreground">Please log in to view society maintenance schedules.</p>
        </div>
      </AppShell>
    );
  }
  return (
    <ModuleGate moduleKey="maintenance">
      <MaintenancePage />
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
              <div className="mt-2 h-7 w-20 animate-pulse rounded-md bg-muted" />
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

function PriorityBadge({ priority }: { priority: WorkOrderItem["priority"] }) {
  const map = {
    low: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-transparent",
    normal: "bg-blue-500/10 text-blue-600 border-transparent",
    high: "bg-amber-500/10 text-amber-600 border-transparent",
    critical: "bg-rose-500/10 text-rose-600 border-transparent font-semibold",
  } as const;
  return (
    <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${map[priority]}`}>
      {priority}
    </Badge>
  );
}

function StatusBadge({ status }: { status: WorkOrderItem["status"] }) {
  const map = {
    open: "bg-amber-500/10 text-amber-600 border-amber-200",
    assigned: "bg-blue-500/10 text-blue-600 border-blue-200",
    in_progress: "bg-indigo-500/10 text-indigo-600 border-indigo-200",
    completed: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
    verified: "bg-teal-500/10 text-teal-600 border-teal-200 font-medium",
    cancelled: "bg-slate-500/10 text-slate-500 border-slate-200 line-through",
  } as const;
  const label = {
    open: "Open",
    assigned: "Assigned",
    in_progress: "In Progress",
    completed: "Completed",
    verified: "Verified",
    cancelled: "Cancelled",
  }[status];

  return (
    <Badge variant="outline" className={`text-[10px] ${map[status]}`}>
      {label}
    </Badge>
  );
}

function FrequencyBadge({ frequency }: { frequency: MaintenanceScheduleItem["frequency"] }) {
  return (
    <Badge variant="secondary" className="text-[10px] capitalize">
      {frequency}
    </Badge>
  );
}

function MaintenancePage() {
  const { roles } = useAuth();
  const canManage = roles.some((r) =>
    ["super_admin", "society_admin", "maintenance_head", "treasurer", "committee_member"].includes(r),
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assetFilter, setAssetFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("work-orders");

  // Pagination states
  const [woPage, setWoPage] = useState(1);
  const [schedPage, setSchedPage] = useState(1);
  const woItemsPerPage = 9;
  const schedItemsPerPage = 10;

  useEffect(() => {
    setWoPage(1);
  }, [search, statusFilter, priorityFilter, assetFilter, vendorFilter]);

  useEffect(() => {
    setSchedPage(1);
  }, [search]);

  // Create Work Order modal state
  const [createWoOpen, setCreateWoOpen] = useState(false);
  const [woAssetId, setWoAssetId] = useState("");
  const [woTitle, setWoTitle] = useState("");
  const [woDescription, setWoDescription] = useState("");
  const [woPriority, setWoPriority] = useState<WorkOrderItem["priority"]>("normal");
  const [woVendorId, setWoVendorId] = useState("");
  const [woTechId, setWoTechId] = useState("");
  const [woEstCost, setWoEstCost] = useState("");
  const [woSlaDueAt, setWoSlaDueAt] = useState("");
  const [woNotes, setWoNotes] = useState("");
  const [createWoError, setCreateWoError] = useState<string | null>(null);
  const [isCreatingWo, setIsCreatingWo] = useState(false);

  // Status Update modal state
  const [statusWo, setStatusWo] = useState<WorkOrderItem | null>(null);
  const [newStatus, setNewStatus] = useState<WorkOrderItem["status"]>("in_progress");
  const [actualCost, setActualCost] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [statusTechId, setStatusTechId] = useState("");
  const [statusVendorId, setStatusVendorId] = useState("");
  const [updateStatusError, setUpdateStatusError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Create Schedule modal state
  const [createSchedOpen, setCreateSchedOpen] = useState(false);
  const [schedAssetId, setSchedAssetId] = useState("");
  const [schedTitle, setSchedTitle] = useState("");
  const [schedFrequency, setSchedFrequency] = useState<MaintenanceScheduleItem["frequency"]>("monthly");
  const [schedTaskDesc, setSchedTaskDesc] = useState("");
  const [schedNextDue, setSchedNextDue] = useState("");
  const [schedVendorId, setSchedVendorId] = useState("");
  const [schedNotes, setSchedNotes] = useState("");
  const [createSchedError, setCreateSchedError] = useState<string | null>(null);
  const [isCreatingSched, setIsCreatingSched] = useState(false);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["maintenance-overview", search, statusFilter, priorityFilter, assetFilter, vendorFilter],
    queryFn: () =>
      getMaintenanceOverviewFn({
        data: {
          search,
          status: statusFilter,
          priority: priorityFilter,
          assetId: assetFilter,
          vendorId: vendorFilter,
        },
      }),
    staleTime: 15_000,
  });

  const handleCreateWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateWoError(null);
    if (!woTitle.trim()) return setCreateWoError("Work order title is required");
    if (!woDescription.trim()) return setCreateWoError("Description is required");

    setIsCreatingWo(true);
    try {
      await createWorkOrderFn({
        data: {
          assetId: woAssetId || undefined,
          title: woTitle.trim(),
          description: woDescription.trim(),
          priority: woPriority,
          assignedVendorId: woVendorId || undefined,
          assignedTechnicianId: woTechId || undefined,
          estimatedCost: woEstCost ? Number(woEstCost) : 0,
          cost: woEstCost ? Number(woEstCost) : 0,
          slaDueAt: woSlaDueAt || undefined,
          notes: woNotes || undefined,
        },
      });
      setCreateWoOpen(false);
      setWoAssetId("");
      setWoTitle("");
      setWoDescription("");
      setWoPriority("normal");
      setWoVendorId("");
      setWoTechId("");
      setWoEstCost("");
      setWoSlaDueAt("");
      setWoNotes("");
      refetch();
    } catch (err: any) {
      setCreateWoError(err.message || "Failed to dispatch work order");
    } finally {
      setIsCreatingWo(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusWo) return;
    setUpdateStatusError(null);
    setIsUpdatingStatus(true);
    try {
      await updateWorkOrderStatusFn({
        data: {
          workOrderId: statusWo.id,
          status: newStatus,
          actualCost: actualCost ? Number(actualCost) : undefined,
          notes: statusNotes || undefined,
          assignedTechnicianId: statusTechId || undefined,
          assignedVendorId: statusVendorId || undefined,
        },
      });
      setStatusWo(null);
      refetch();
    } catch (err: any) {
      setUpdateStatusError(err.message || "Failed to update work order status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSchedError(null);
    if (!schedAssetId) return setCreateSchedError("Please select an asset");
    if (!schedTaskDesc.trim()) return setCreateSchedError("Task description is required");
    if (!schedNextDue) return setCreateSchedError("Next due date is required");

    setIsCreatingSched(true);
    try {
      await createMaintenanceScheduleFn({
        data: {
          assetId: schedAssetId,
          title: schedTitle || undefined,
          frequency: schedFrequency,
          taskDescription: schedTaskDesc.trim(),
          nextDueDate: schedNextDue,
          assignedVendorId: schedVendorId || undefined,
          notes: schedNotes || undefined,
        },
      });
      setCreateSchedOpen(false);
      setSchedAssetId("");
      setSchedTitle("");
      setSchedFrequency("monthly");
      setSchedTaskDesc("");
      setSchedNextDue("");
      setSchedVendorId("");
      setSchedNotes("");
      refetch();
    } catch (err: any) {
      setCreateSchedError(err.message || "Failed to create maintenance schedule");
    } finally {
      setIsCreatingSched(false);
    }
  };

  const handleToggleSchedule = async (scheduleId: string, currentActive: boolean) => {
    try {
      await toggleMaintenanceScheduleStatusFn({
        data: { scheduleId, isActive: !currentActive },
      });
      refetch();
    } catch (err: any) {
      console.error(err);
    }
  };

  const openStatusModal = (wo: WorkOrderItem) => {
    setStatusWo(wo);
    setNewStatus(wo.status);
    setActualCost(wo.actualCost ? String(wo.actualCost) : wo.cost ? String(wo.cost) : "");
    setStatusNotes(wo.notes || "");
    setStatusTechId(wo.assignedTechnicianId || "");
    setStatusVendorId(wo.assignedVendorId || "");
    setUpdateStatusError(null);
  };

  const summary = data?.summary;
  const workOrders = data?.workOrders ?? [];
  const schedules = data?.schedules ?? [];
  const assetsList = data?.assetsList ?? [];
  const vendorsList = data?.vendorsList ?? [];
  const techniciansList = data?.techniciansList ?? [];

  const filteredSchedules = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return schedules;
    return schedules.filter((s: any) =>
      (s.title?.toLowerCase() || "").includes(query) ||
      (s.taskDescription?.toLowerCase() || "").includes(query) ||
      (s.assetName?.toLowerCase() || "").includes(query) ||
      (s.assetLocation?.toLowerCase() || "").includes(query) ||
      (s.assignedVendorName?.toLowerCase() || "").includes(query)
    );
  }, [schedules, search]);

  const paginatedWorkOrders = useMemo(() => {
    const start = (woPage - 1) * woItemsPerPage;
    return workOrders.slice(start, start + woItemsPerPage);
  }, [workOrders, woPage]);
  const totalWoPages = Math.ceil(workOrders.length / woItemsPerPage) || 1;

  const paginatedSchedules = useMemo(() => {
    const start = (schedPage - 1) * schedItemsPerPage;
    return filteredSchedules.slice(start, start + schedItemsPerPage);
  }, [filteredSchedules, schedPage]);
  const totalSchedPages = Math.ceil(filteredSchedules.length / schedItemsPerPage) || 1;

  return (
    <AppShell
      title="Maintenance & Work Orders"
      subtitle="Track preventive asset schedules and technician work orders"
      actions={
        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => setCreateSchedOpen(true)}>
                <Calendar className="size-3.5" /> Add Schedule
              </Button>
              <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setCreateWoOpen(true)}>
                <Plus className="size-3.5" /> Dispatch Work Order
              </Button>
            </>
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
        {/* Header */}
        <header className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-md bg-surface border border-border/60">
            <Wrench className="size-5 text-primary" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Operations · Facility Management
            </div>
            <h1 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
              Maintenance & SLA Tracking
            </h1>
          </div>
        </header>

        {/* Error banner */}
        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-4 shrink-0" />
              <p className="text-sm font-medium">
                {error instanceof Error ? error.message : "Failed to load maintenance records"}
              </p>
            </div>
          </div>
        )}

        {/* KPI Summary Cards */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <KpiCard label="Total Orders" value={String(summary?.totalWorkOrders ?? 0)} icon={Wrench} loading={isLoading} />
          <KpiCard label="Open Tasks" value={String(summary?.openWorkOrders ?? 0)} icon={Clock} tone="warning" loading={isLoading} />
          <KpiCard label="In Progress" value={String(summary?.inProgressWorkOrders ?? 0)} icon={Layers} tone="info" loading={isLoading} />
          <KpiCard label="Completed" value={String(summary?.completedWorkOrders ?? 0)} icon={CheckCircle2} tone="success" loading={isLoading} />
          <KpiCard label="Overdue SLA" value={String(summary?.overdueWorkOrders ?? 0)} icon={AlertTriangle} tone={(summary?.overdueWorkOrders ?? 0) > 0 ? "destructive" : "default"} loading={isLoading} />
          <KpiCard label="Total Expenses" value={formatCurrency(summary?.totalMaintenanceCost ?? 0)} icon={DollarSign} tone="default" loading={isLoading} />
        </section>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-surface border border-border/60">
            <TabsTrigger value="work-orders" className="text-xs gap-1.5">
              <Wrench className="size-3.5" /> Work Orders ({workOrders.length})
            </TabsTrigger>
            <TabsTrigger value="schedules" className="text-xs gap-1.5">
              <Calendar className="size-3.5" /> Preventive Schedules ({schedules.length})
            </TabsTrigger>
          </TabsList>

          {/* WORK ORDERS TAB */}
          <TabsContent value="work-orders" className="space-y-6">
            {/* Filter Bar */}
            <Card className="border-border/70 shadow-soft p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search order title, asset, vendor..."
                    className="h-9 pl-9 text-xs"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-36 text-xs">
                    <Filter className="mr-1.5 size-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                    <SelectItem value="open" className="text-xs">Open</SelectItem>
                    <SelectItem value="assigned" className="text-xs">Assigned</SelectItem>
                    <SelectItem value="in_progress" className="text-xs">In Progress</SelectItem>
                    <SelectItem value="completed" className="text-xs">Completed</SelectItem>
                    <SelectItem value="verified" className="text-xs">Verified</SelectItem>
                    <SelectItem value="cancelled" className="text-xs">Cancelled</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="h-9 w-36 text-xs">
                    <Sliders className="mr-1.5 size-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Priorities</SelectItem>
                    <SelectItem value="low" className="text-xs">Low</SelectItem>
                    <SelectItem value="normal" className="text-xs">Normal</SelectItem>
                    <SelectItem value="high" className="text-xs">High</SelectItem>
                    <SelectItem value="critical" className="text-xs">Critical</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={assetFilter} onValueChange={setAssetFilter}>
                  <SelectTrigger className="h-9 w-44 text-xs">
                    <Tag className="mr-1.5 size-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Asset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Assets</SelectItem>
                    {assetsList.map((a: { id: string; name: string }) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs truncate">{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={vendorFilter} onValueChange={setVendorFilter}>
                  <SelectTrigger className="h-9 w-44 text-xs">
                    <Truck className="mr-1.5 size-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Vendors</SelectItem>
                    {vendorsList.map((v: { id: string; name: string }) => (
                      <SelectItem key={v.id} value={v.id} className="text-xs truncate">{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {/* Work Orders List */}
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : !workOrders.length ? (
              <Card className="border-border/70 border-dashed p-12 text-center text-muted-foreground">
                <Wrench className="size-10 mx-auto opacity-30 mb-2" />
                <p className="text-sm font-medium">No work orders found</p>
                {canManage && (
                  <p className="text-[11px] opacity-60 mt-1">Click "Dispatch Work Order" to create a new task.</p>
                )}
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {paginatedWorkOrders.map((wo) => (
                  <Card key={wo.id} className={`border-border/70 shadow-soft hover:border-border transition-colors ${wo.isOverdue ? "border-rose-300 dark:border-rose-900 bg-rose-500/5" : ""}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <PriorityBadge priority={wo.priority} />
                            <StatusBadge status={wo.status} />
                            {wo.isOverdue && (
                              <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Overdue SLA</Badge>
                            )}
                          </div>
                          <CardTitle className="font-serif text-sm font-bold leading-snug line-clamp-2">
                            {wo.title}
                          </CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs pt-0">
                      <p className="text-muted-foreground text-[11px] line-clamp-2">{wo.description}</p>

                      {/* Asset & Location Info */}
                      <div className="space-y-1 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
                        {wo.assetName ? (
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <Wrench className="size-3 text-primary shrink-0" />
                            <span className="truncate">{wo.assetName}</span>
                            {wo.assetCategory && <span className="text-[10px] text-muted-foreground">({wo.assetCategory})</span>}
                          </div>
                        ) : (
                          <div className="text-muted-foreground italic">General Facility Maintenance</div>
                        )}
                        {wo.assetLocation && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="size-3 shrink-0" />
                            <span className="truncate">{wo.assetLocation}</span>
                          </div>
                        )}
                      </div>

                      {/* Vendor / Technician Assignment */}
                      <div className="rounded-md bg-muted/40 px-3 py-2 space-y-1 text-[11px]">
                        {wo.assignedVendorName && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground flex items-center gap-1"><Truck className="size-3" /> Vendor:</span>
                            <span className="font-medium truncate max-w-[130px]">{wo.assignedVendorName}</span>
                          </div>
                        )}
                        {wo.assignedTechnicianName && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground flex items-center gap-1"><UserCheck className="size-3" /> Technician:</span>
                            <span className="font-medium truncate max-w-[130px]">{wo.assignedTechnicianName}</span>
                          </div>
                        )}
                        {wo.slaDueAt && (
                          <div className="flex justify-between items-center pt-0.5 border-t border-border/30">
                            <span className="text-muted-foreground">Due Date:</span>
                            <span className={`font-mono font-medium ${wo.isOverdue ? "text-rose-600 font-bold" : ""}`}>{wo.slaDueAt}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-0.5 border-t border-border/30">
                          <span className="text-muted-foreground">Cost:</span>
                          <span className="font-bold">
                            {wo.actualCost > 0 ? formatCurrency(wo.actualCost) : wo.estimatedCost > 0 ? `${formatCurrency(wo.estimatedCost)} (est)` : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      {canManage && (
                        <div className="pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-7 text-[11px] gap-1"
                            onClick={() => openStatusModal(wo)}
                          >
                            <FileEdit className="size-3" /> Manage Status & Cost
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {totalWoPages > 1 && (
              <div className="flex items-center justify-between border-t p-4 text-xs text-muted-foreground bg-surface border rounded-lg mt-4 shadow-soft">
                <div>
                  Showing {(woPage - 1) * woItemsPerPage + 1} to{" "}
                  {Math.min(woPage * woItemsPerPage, workOrders.length)} of {workOrders.length} work orders
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={woPage === 1}
                    onClick={() => setWoPage((p) => Math.max(p - 1, 1))}
                    className="h-8 text-xs px-3"
                  >
                    Previous
                  </Button>
                  <span className="font-medium text-foreground">
                    Page {woPage} of {totalWoPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={woPage >= totalWoPages}
                    onClick={() => setWoPage((p) => Math.min(p + 1, totalWoPages))}
                    className="h-8 text-xs px-3"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* PREVENTIVE SCHEDULES TAB */}
          <TabsContent value="schedules" className="space-y-6">
            <Card className="border-border/70 shadow-soft">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-serif text-base font-bold">Preventive Maintenance Tasks</CardTitle>
                    <CardDescription className="text-xs">Recurring equipment servicing and inspection schedules</CardDescription>
                  </div>
                  {canManage && (
                    <Button size="sm" className="gap-1 text-xs h-8" onClick={() => setCreateSchedOpen(true)}>
                      <Plus className="size-3.5" /> Add Task
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-16 animate-pulse bg-muted rounded" />
                    ))}
                  </div>
                ) : !filteredSchedules.length ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <Calendar className="size-10 mx-auto opacity-30 mb-2" />
                    <p className="text-sm font-medium">No recurring maintenance schedules configured</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {paginatedSchedules.map((s) => (
                      <div key={s.id} className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                        <div className="space-y-1 min-w-0 max-w-md">
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-bold text-sm">{s.assetName}</span>
                            <FrequencyBadge frequency={s.frequency} />
                            {!s.isActive && (
                              <Badge variant="outline" className="text-[9px] text-muted-foreground">Inactive</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{s.taskDescription}</p>
                          {s.assetLocation && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <MapPin className="size-3" /> {s.assetLocation}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-6 text-xs">
                          {s.assignedVendorName && (
                            <div className="text-right">
                              <div className="text-[10px] text-muted-foreground">Vendor</div>
                              <div className="font-medium text-foreground">{s.assignedVendorName}</div>
                            </div>
                          )}
                          <div className="text-right">
                            <div className="text-[10px] text-muted-foreground">Next Due</div>
                            <div className="font-mono font-bold text-primary">{s.nextDueDate}</div>
                          </div>
                          {canManage && (
                            <Button
                              variant={s.isActive ? "outline" : "secondary"}
                              size="sm"
                              className="h-7 px-2 text-[11px] gap-1"
                              onClick={() => handleToggleSchedule(s.id, s.isActive)}
                            >
                              <Power className={`size-3 ${s.isActive ? "text-emerald-600" : "text-muted-foreground"}`} />
                              {s.isActive ? "Active" : "Paused"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {totalSchedPages > 1 && (
                  <div className="flex items-center justify-between border-t p-4 text-xs text-muted-foreground bg-surface border-t">
                    <div>
                      Showing {(schedPage - 1) * schedItemsPerPage + 1} to{" "}
                      {Math.min(schedPage * schedItemsPerPage, filteredSchedules.length)} of {filteredSchedules.length} schedules
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={schedPage === 1}
                        onClick={() => setSchedPage((p) => Math.max(p - 1, 1))}
                        className="h-8 text-xs px-3"
                      >
                        Previous
                      </Button>
                      <span className="font-medium text-foreground">
                        Page {schedPage} of {totalSchedPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={schedPage >= totalSchedPages}
                        onClick={() => setSchedPage((p) => Math.min(p + 1, totalSchedPages))}
                        className="h-8 text-xs px-3"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dispatch Work Order Modal */}
      <Dialog open={createWoOpen} onOpenChange={setCreateWoOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Dispatch Maintenance Work Order</DialogTitle>
            <DialogDescription className="text-xs">Create a corrective task for equipment, facilities or society infrastructure.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateWorkOrder} className="space-y-4">
            {createWoError && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{createWoError}</div>}

            <div className="space-y-1.5">
              <Label className="text-xs">Work Order Title *</Label>
              <Input placeholder="e.g. Elevator B Noise Inspection, Generator Oil Change" className="h-9 text-xs" value={woTitle} onChange={(e) => setWoTitle(e.target.value)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Target Asset (Optional)</Label>
                <Select value={woAssetId} onValueChange={setWoAssetId}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Asset" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">General Facility (No Asset)</SelectItem>
                    {assetsList.map((a: { id: string; name: string; location: string | null; category: string }) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">{a.name} ({a.location || a.category})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Priority</Label>
                <Select value={woPriority} onValueChange={(v) => setWoPriority(v as WorkOrderItem["priority"])}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low" className="text-xs">Low</SelectItem>
                    <SelectItem value="normal" className="text-xs">Normal</SelectItem>
                    <SelectItem value="high" className="text-xs">High</SelectItem>
                    <SelectItem value="critical" className="text-xs font-bold text-rose-600">Critical / Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Task Description *</Label>
              <Textarea placeholder="Detailed description of issue and work required..." className="text-xs min-h-[80px]" value={woDescription} onChange={(e) => setWoDescription(e.target.value)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Assign Vendor</Label>
                <Select value={woVendorId} onValueChange={setWoVendorId}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Vendor (Optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">Unassigned / In-house</SelectItem>
                    {vendorsList.map((v: { id: string; name: string }) => (
                      <SelectItem key={v.id} value={v.id} className="text-xs">{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Assign Technician / Staff</Label>
                <Select value={woTechId} onValueChange={setWoTechId}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Staff (Optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">Unassigned</SelectItem>
                    {techniciansList.map((t: { id: string; name: string }) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">SLA / Target Completion Date</Label>
                <Input type="date" className="h-9 text-xs" value={woSlaDueAt} onChange={(e) => setWoSlaDueAt(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Estimated Cost (₹)</Label>
                <Input type="number" step="0.01" className="h-9 text-xs font-mono" placeholder="0.00" value={woEstCost} onChange={(e) => setWoEstCost(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes / Special Instructions</Label>
              <Input placeholder="Optional notes for vendor or technician" className="h-9 text-xs" value={woNotes} onChange={(e) => setWoNotes(e.target.value)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateWoOpen(false)} disabled={isCreatingWo}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isCreatingWo}>{isCreatingWo ? "Dispatching..." : "Dispatch Work Order"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Update Work Order Status Modal */}
      <Dialog open={!!statusWo} onOpenChange={(o) => !o && setStatusWo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Manage Work Order Status</DialogTitle>
            <DialogDescription className="text-xs">Order: <span className="font-semibold">{statusWo?.title}</span></DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateStatus} className="space-y-4">
            {updateStatusError && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{updateStatusError}</div>}

            <div className="space-y-1.5">
              <Label className="text-xs">Status Lifecycle</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as WorkOrderItem["status"])}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open" className="text-xs">⏳ Open</SelectItem>
                  <SelectItem value="assigned" className="text-xs">👤 Assigned</SelectItem>
                  <SelectItem value="in_progress" className="text-xs">🔧 In Progress</SelectItem>
                  <SelectItem value="completed" className="text-xs">✅ Completed</SelectItem>
                  <SelectItem value="verified" className="text-xs">🛡️ Verified</SelectItem>
                  <SelectItem value="cancelled" className="text-xs text-rose-600">❌ Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Actual Maintenance Cost (₹)</Label>
              <Input type="number" step="0.01" className="h-9 text-xs font-mono" placeholder="0.00" value={actualCost} onChange={(e) => setActualCost(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Assign Vendor</Label>
              <Select value={statusVendorId} onValueChange={setStatusVendorId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">None / In-house</SelectItem>
                  {vendorsList.map((v: { id: string; name: string }) => (
                    <SelectItem key={v.id} value={v.id} className="text-xs">{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Assign Technician</Label>
              <Select value={statusTechId} onValueChange={setStatusTechId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Technician" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">None</SelectItem>
                  {techniciansList.map((t: { id: string; name: string }) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes / Resolution Remarks</Label>
              <Input placeholder="Remarks on work completed..." className="h-9 text-xs" value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setStatusWo(null)} disabled={isUpdatingStatus}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isUpdatingStatus}>{isUpdatingStatus ? "Updating..." : "Save Changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Maintenance Schedule Modal */}
      <Dialog open={createSchedOpen} onOpenChange={setCreateSchedOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Add Preventive Maintenance Task</DialogTitle>
            <DialogDescription className="text-xs">Schedule recurring inspections or servicing for society equipment.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSchedule} className="space-y-4">
            {createSchedError && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{createSchedError}</div>}

            <div className="space-y-1.5">
              <Label className="text-xs">Select Equipment / Asset *</Label>
              <Select value={schedAssetId} onValueChange={setSchedAssetId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Asset" /></SelectTrigger>
                <SelectContent>
                  {assetsList.map((a: { id: string; name: string; location: string | null; category: string }) => (
                    <SelectItem key={a.id} value={a.id} className="text-xs">{a.name} ({a.location || a.category})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Frequency *</Label>
              <Select value={schedFrequency} onValueChange={(v) => setSchedFrequency(v as MaintenanceScheduleItem["frequency"])}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily" className="text-xs">Daily</SelectItem>
                  <SelectItem value="weekly" className="text-xs">Weekly</SelectItem>
                  <SelectItem value="monthly" className="text-xs">Monthly</SelectItem>
                  <SelectItem value="quarterly" className="text-xs">Quarterly</SelectItem>
                  <SelectItem value="annual" className="text-xs">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Task Description *</Label>
              <Textarea placeholder="e.g. Inspect hydraulic fluid, test emergency brakes, clean air filters" className="text-xs min-h-[70px]" value={schedTaskDesc} onChange={(e) => setSchedTaskDesc(e.target.value)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Next Due Date *</Label>
                <Input type="date" className="h-9 text-xs" value={schedNextDue} onChange={(e) => setSchedNextDue(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Contractor / Vendor</Label>
                <Select value={schedVendorId} onValueChange={setSchedVendorId}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">None</SelectItem>
                    {vendorsList.map((v: { id: string; name: string }) => (
                      <SelectItem key={v.id} value={v.id} className="text-xs">{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateSchedOpen(false)} disabled={isCreatingSched}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isCreatingSched}>{isCreatingSched ? "Creating..." : "Create Schedule"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
