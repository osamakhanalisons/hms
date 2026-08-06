import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  getWorkOrdersFn,
  createWorkOrderFn,
  updateWorkOrderStatusFn,
  getMaintenanceSchedulesFn,
  createMaintenanceScheduleFn,
} from "@/lib/api/maintenance";
import { getAssetsFn } from "@/lib/api/assets";
import { getVendorsFn } from "@/lib/api/vendors";
import { toast } from "sonner";
import { Wrench, Calendar, Plus, User, Play, Check, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/maintenance")({
  head: () => ({
    meta: [
      { title: "Maintenance Schedules — HousingOS" },
      {
        name: "description",
        content: "Create work orders and check recurring maintenance schedules.",
      },
    ],
  }),
  component: MaintenanceRoute,
});

function MaintenanceRoute() {
  return (
    <ModuleGate moduleKey="maintenance">
      <MaintenancePage />
    </ModuleGate>
  );
}

function MaintenancePage() {
  const queryClient = useQueryClient();
  const [orderOpen, setOrderOpen] = useState(false);
  const [schedOpen, setSchedOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveWoId, setResolveWoId] = useState<string | null>(null);

  // Forms
  const [assetId, setAssetId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "critical">("normal");
  const [assignedVendorId, setAssignedVendorId] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [slaDueAt, setSlaDueAt] = useState("");
  const [actualCost, setActualCost] = useState("");

  const [frequency, setFrequency] = useState<any>("monthly");
  const [taskDesc, setTaskDesc] = useState("");
  const [nextDue, setNextDue] = useState("");

  const { data: workOrders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["workOrders"],
    queryFn: async () => getWorkOrdersFn(),
  });

  const { data: schedules = [], isLoading: loadingSchedules } = useQuery({
    queryKey: ["maintenanceSchedules"],
    queryFn: async () => getMaintenanceSchedulesFn(),
  });

  const { data: assets = [] } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => getAssetsFn(),
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => getVendorsFn(),
  });

  const createOrder = useMutation({
    mutationFn: createWorkOrderFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workOrders"] });
      toast.success("Corrective work order dispatched");
      setOrderOpen(false);
      setAssetId("");
      setTitle("");
      setDescription("");
      setCost("");
      setPriority("normal");
      setAssignedVendorId("");
      setEstimatedCost("");
      setSlaDueAt("");
    },
  });

  const createSchedule = useMutation({
    mutationFn: createMaintenanceScheduleFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenanceSchedules"] });
      toast.success("Preventive schedule recurring task registered");
      setSchedOpen(false);
      setAssetId("");
      setTaskDesc("");
      setNextDue("");
    },
  });

  const updateOrder = useMutation({
    mutationFn: updateWorkOrderStatusFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workOrders"] });
      toast.success("Work order state transitioned");
    },
  });

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    createOrder.mutate({
      data: {
        assetId: assetId || undefined,
        title,
        description,
        cost: cost ? parseFloat(cost) : undefined,
        priority,
        assignedVendorId: assignedVendorId || undefined,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
        slaDueAt: slaDueAt || undefined,
      },
    });
  };

  const handleResolveOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveWoId) return;
    updateOrder.mutate({
      data: {
        workOrderId: resolveWoId,
        status: "completed",
        actualCost: actualCost ? parseFloat(actualCost) : undefined,
      },
    });
    setResolveOpen(false);
    setResolveWoId(null);
    setActualCost("");
  };

  const handleSubmitSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    createSchedule.mutate({
      data: { assetId, frequency, taskDescription: taskDesc, nextDueDate: nextDue },
    });
  };

  return (
    <AppShell
      title="Maintenance & Work Orders"
      subtitle="Track preventive asset schedules and technician work orders"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10 space-y-8">
        {/* Actions header */}
        <section className="flex flex-wrap items-center justify-end gap-3 border-b pb-4">
          <Button onClick={() => setSchedOpen(true)} variant="outline" size="sm" className="gap-1">
            <Calendar className="size-4" /> Add Schedule Task
          </Button>
          <Button onClick={() => setOrderOpen(true)} size="sm" className="gap-1">
            <Wrench className="size-4" /> Dispatch Work Order
          </Button>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Work orders */}
          <Card className="border-border/70 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base font-bold">Active Work Orders</CardTitle>
              <CardDescription className="text-xs">
                Corrective tasks tracked per asset
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingOrders ? (
                <div className="flex justify-center py-10">
                  <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : workOrders.length === 0 ? (
                <div className="text-center py-10 text-xs text-muted-foreground">
                  No work orders dispatched.
                </div>
              ) : (
                <div className="space-y-4">
                  {workOrders.map((wo: any) => {
                    const priorityColor =
                      wo.priority === "critical"
                        ? "destructive"
                        : wo.priority === "high"
                          ? "default" // shadcn default (primary color, usually dark)
                          : wo.priority === "low"
                            ? "outline"
                            : "secondary";
                    return (
                      <div
                        key={wo.id}
                        className="p-3 border rounded-lg bg-card flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-semibold text-sm truncate flex-1">{wo.title}</h4>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge
                              variant={priorityColor}
                              className="text-[9px] font-mono scale-90"
                            >
                              {wo.priority}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                              {wo.status}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {wo.description}
                        </p>
                        <div className="flex flex-col gap-1 text-[10px] text-muted-foreground border-t pt-2 mt-1">
                          {wo.asset_name && (
                            <div>
                              <span className="font-semibold">Asset:</span> {wo.asset_name}
                            </div>
                          )}
                          {wo.vendor_name && (
                            <div>
                              <span className="font-semibold">Vendor:</span> {wo.vendor_name}
                            </div>
                          )}
                          {wo.sla_due_at && (
                            <div className="flex items-center gap-1 font-mono text-destructive">
                              <AlertTriangle className="size-3" />
                              <span>
                                SLA Due: {format(new Date(wo.sla_due_at), "dd MMM, hh:mm a")}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between font-mono mt-1">
                            <span>
                              Est: ₨
                              {Number(wo.estimated_cost || wo.cost || 0).toLocaleString("en-PK")}
                            </span>
                            {Number(wo.actual_cost) > 0 && (
                              <span className="text-success font-semibold">
                                Actual: ₨{Number(wo.actual_cost).toLocaleString("en-PK")}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* State transitions */}
                        <div className="flex items-center justify-end pt-2 border-t mt-1">
                          <div className="flex gap-1.5">
                            {wo.status === "open" && (
                              <Button
                                onClick={() =>
                                  updateOrder.mutate({
                                    data: { workOrderId: wo.id, status: "in_progress" },
                                  })
                                }
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] gap-1 py-1"
                              >
                                <Play className="size-3" /> Start
                              </Button>
                            )}
                            {wo.status === "in_progress" && (
                              <Button
                                onClick={() => {
                                  setResolveWoId(wo.id);
                                  setResolveOpen(true);
                                }}
                                size="sm"
                                className="h-7 text-[10px] gap-1 py-1 bg-success text-success-foreground hover:bg-success/90"
                              >
                                <Check className="size-3" /> Resolve
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schedules */}
          <Card className="border-border/70 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base font-bold">
                Preventive Maintenance Schedules
              </CardTitle>
              <CardDescription className="text-xs">
                Periodic recurring service routines
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingSchedules ? (
                <div className="flex justify-center py-10">
                  <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : schedules.length === 0 ? (
                <div className="text-center py-10 text-xs text-muted-foreground">
                  No recurring service schedules created.
                </div>
              ) : (
                <div className="divide-y">
                  {schedules.map((s: any) => (
                    <div key={s.id} className="py-3 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">{s.asset_name}</h4>
                        <Badge
                          variant="outline"
                          className="text-[9px] uppercase tracking-wider font-mono"
                        >
                          {s.frequency}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {s.task_description}
                      </p>
                      <div className="text-[10px] text-destructive font-semibold font-mono">
                        Next Due: {new Date(s.next_due_date).toLocaleDateString("en-PK")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dispatch Work Order Dialog */}
      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Dispatch Corrective Work Order</DialogTitle>
            <DialogDescription>Assign a repair ticket details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitOrder} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Asset Associated (Optional)
              </label>
              <Select value={assetId} onValueChange={setAssetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Asset..." />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Order Title</label>
              <Input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Lift elevator cabin grease leak"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Scope Description
              </label>
              <Input
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe work required..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Priority</label>
                <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Assign Vendor (Optional)
                </label>
                <Select value={assignedVendorId} onValueChange={setAssignedVendorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Vendor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Est. Cost (₨)</label>
                <Input
                  type="number"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  SLA Resolution Deadline
                </label>
                <Input
                  type="datetime-local"
                  value={slaDueAt}
                  onChange={(e) => setSlaDueAt(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOrderOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Dispatch Work</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Setup Schedule Dialog */}
      <Dialog open={schedOpen} onOpenChange={setSchedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Add Schedule Task</DialogTitle>
            <DialogDescription>Register a recurring service task routine</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitSchedule} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Target Asset</label>
              <Select value={assetId} onValueChange={setAssetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Asset..." />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Frequency Period
              </label>
              <Select value={frequency} onValueChange={(val: any) => setFrequency(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily Checkup</SelectItem>
                  <SelectItem value="weekly">Weekly Routine</SelectItem>
                  <SelectItem value="monthly">Monthly Audit</SelectItem>
                  <SelectItem value="quarterly">Quarterly Overhaul</SelectItem>
                  <SelectItem value="annual">Annual Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Task Instruction Details
              </label>
              <Input
                required
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="e.g. Inspect wire tension and check emergency brake pads"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                First Service Due Date
              </label>
              <Input
                required
                type="date"
                value={nextDue}
                onChange={(e) => setNextDue(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSchedOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Schedule</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Resolve Work Order Dialog */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Resolve Work Order</DialogTitle>
            <DialogDescription>
              Input the actual repair cost to complete this work order
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResolveOrder} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Actual Final Cost (₨)
              </label>
              <Input
                type="number"
                required
                value={actualCost}
                onChange={(e) => setActualCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setResolveOpen(false);
                  setResolveWoId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Complete & Verify</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
