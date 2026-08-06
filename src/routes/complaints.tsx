import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { KanbanBoard, KanbanItem, KanbanColumn } from "@/components/kanban-board";
import {
  getComplaintsFn,
  createComplaintFn,
  assignComplaintFn,
  updateComplaintStatusFn,
} from "@/lib/api/complaints";
import { getUnitsFn } from "@/lib/api/property";
import { getResidentsFn } from "@/lib/api/residents";
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
import { AlertCircle, ClipboardList, Plus, UserCheck } from "lucide-react";

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

function ComplaintsPage() {
  const queryClient = useQueryClient();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);

  // Submit Form state
  const [unitId, setUnitId] = useState("");
  const [category, setCategory] = useState<any>("other");
  const [priority, setPriority] = useState<any>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Action state
  const [assigneeId, setAssigneeId] = useState("");
  const [notes, setNotes] = useState("");

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ["complaints"],
    queryFn: async () => getComplaintsFn(),
  });

  const { data: units = [] } = useQuery({
    queryKey: ["units"],
    queryFn: async () => getUnitsFn(),
  });

  // Fetch staff users (simulated by fetching society admins/residents for simplicity)
  const { data: residents = [] } = useQuery({
    queryKey: ["residents"],
    queryFn: async () => getResidentsFn(),
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

  const kanbanItems: KanbanItem[] = complaints.map((c: any) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    meta: `Unit ${c.unit_number || "Global"} · ${format(new Date(c.created_at), "dd MMM")}`,
    badge: c.priority,
    badgeTone:
      c.priority === "critical" ? "destructive" : c.priority === "high" ? "default" : "outline",
  }));

  const itemColumnMap = complaints.reduce((acc: any, c: any) => {
    acc[c.id] = c.status;
    return acc;
  }, {});

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
      actions={
        <Button onClick={() => setSubmitOpen(true)} className="gap-1.5 size-sm">
          <Plus className="size-4" /> Raise Complaint
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-[95rem] px-4 py-6 sm:px-8 sm:py-10">
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
                        Unit {u.unit_number}
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
              Raised by {selectedTicket?.submitter_name || "Resident"} for Unit{" "}
              {selectedTicket?.unit_number || "Global"}
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
                      {residents.map((res: any) => (
                        <SelectItem key={res.person_id} value={res.person_id}>
                          {res.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAssign} disabled={!assigneeId} size="sm" className="gap-1">
                    <UserCheck className="size-4" /> Assign
                  </Button>
                </div>
              </div>

              {/* Workflow Actions */}
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
