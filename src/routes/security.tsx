import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getGateTerminalsFn,
  createGateTerminalFn,
  updateGateTerminalStatusFn,
  getGuardPatrolsFn,
  recordPatrolScanFn,
  getBlacklistFn,
  addBlacklistFn,
  removeBlacklistFn,
} from "@/lib/api/security-governance";
import { toast } from "sonner";
import {
  Shield,
  DoorOpen,
  MapPin,
  ShieldOff,
  Plus,
  Power,
  CheckCircle,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/security")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) || "gates",
  }),
  head: () => ({
    meta: [
      { title: "Security Control — HousingOS" },
      {
        name: "description",
        content: "Manage gate terminals, guard patrols, and blacklists for society security.",
      },
    ],
  }),
  component: SecurityRoute,
});

function SecurityRoute() {
  return (
    <ModuleGate moduleKey="gate">
      <SecurityPage />
    </ModuleGate>
  );
}

// ─── Gate Terminals Tab ───────────────────────────────────────────────────────

function GateTerminalsTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  const { data: terminals = [], isLoading } = useQuery({
    queryKey: ["gate-terminals"],
    queryFn: () => getGateTerminalsFn(),
  });

  const create = useMutation({
    mutationFn: createGateTerminalFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gate-terminals"] });
      toast.success("Gate terminal added");
      setOpen(false);
      setName("");
      setLocation("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to add terminal"),
  });

  const toggleStatus = useMutation({
    mutationFn: updateGateTerminalStatusFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gate-terminals"] });
      toast.success("Status updated");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {terminals.length} gate terminal(s) configured
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Terminal
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading terminals...</p>
      ) : terminals.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No gate terminals configured yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {terminals.map((t: any) => (
            <Card key={t.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <Badge variant={t.status === "active" ? "default" : "secondary"}>
                    {t.status}
                  </Badge>
                </div>
                {t.location && <CardDescription>{t.location}</CardDescription>}
              </CardHeader>
              <CardContent>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    toggleStatus.mutate({
                      data: {
                        terminalId: t.id,
                        status: t.status === "active" ? "inactive" : "active",
                      },
                    })
                  }
                >
                  <Power className="h-3.5 w-3.5 mr-1" />
                  {t.status === "active" ? "Deactivate" : "Activate"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Gate Terminal</DialogTitle>
            <DialogDescription>
              Register a new gate or checkpoint for your society.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Terminal name (e.g. Main Gate)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="Location / description (optional)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!name.trim() || create.isPending}
              onClick={() => create.mutate({ data: { name, location: location || undefined } })}
            >
              {create.isPending ? "Adding..." : "Add Terminal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Guard Patrols Tab ────────────────────────────────────────────────────────

function GuardPatrolsTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [guardName, setGuardName] = useState("");
  const [checkpointName, setCheckpointName] = useState("");
  const [notes, setNotes] = useState("");

  const { data: patrols = [], isLoading } = useQuery({
    queryKey: ["guard-patrols"],
    queryFn: () => getGuardPatrolsFn(),
  });

  const record = useMutation({
    mutationFn: recordPatrolScanFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guard-patrols"] });
      toast.success("Patrol scan recorded");
      setOpen(false);
      setGuardName("");
      setCheckpointName("");
      setNotes("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to record scan"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Recent patrol scans (last 100)</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Record Scan
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading patrol logs...</p>
      ) : patrols.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No patrol scans recorded yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {patrols.map((p: any) => (
            <Card key={p.id}>
              <CardContent className="py-3 flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{p.guard_name}</p>
                  <p className="text-xs text-muted-foreground">@ {p.checkpoint_name}</p>
                  {p.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">{p.notes}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground shrink-0">
                  {new Date(p.scanned_at).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Patrol Scan</DialogTitle>
            <DialogDescription>Log a guard checkpoint scan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Guard name"
              value={guardName}
              onChange={(e) => setGuardName(e.target.value)}
            />
            <Input
              placeholder="Checkpoint name (e.g. Block A Entrance)"
              value={checkpointName}
              onChange={(e) => setCheckpointName(e.target.value)}
            />
            <Input
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!guardName.trim() || !checkpointName.trim() || record.isPending}
              onClick={() =>
                record.mutate({ data: { guardName, checkpointName, notes: notes || undefined } })
              }
            >
              {record.isPending ? "Recording..." : "Record Scan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Blacklist Tab ────────────────────────────────────────────────────────────

function BlacklistTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"visitor" | "vehicle">("visitor");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["blacklist"],
    queryFn: () => getBlacklistFn(),
  });

  const add = useMutation({
    mutationFn: addBlacklistFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blacklist"] });
      toast.success("Added to blacklist");
      setOpen(false);
      setValue("");
      setReason("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to add"),
  });

  const remove = useMutation({
    mutationFn: removeBlacklistFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blacklist"] });
      toast.success("Removed from blacklist");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to remove"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{entries.length} blacklisted entry(s)</p>
        <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add to Blacklist
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading blacklist...</p>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Blacklist is empty.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((e: any) => (
            <Card key={e.id}>
              <CardContent className="py-3 flex flex-wrap gap-4 items-center">
                <Badge variant={e.type === "vehicle" ? "outline" : "secondary"}>{e.type}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{e.value}</p>
                  {e.reason && <p className="text-xs text-muted-foreground">{e.reason}</p>}
                </div>
                <p className="text-xs text-muted-foreground shrink-0">
                  {new Date(e.created_at).toLocaleDateString()}
                </p>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  onClick={() => remove.mutate({ data: { entryId: e.id } })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Blacklist</DialogTitle>
            <DialogDescription>
              Block a visitor or vehicle from entering the society.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="visitor">Visitor (Name / Phone)</SelectItem>
                <SelectItem value="vehicle">Vehicle (Plate Number)</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder={type === "visitor" ? "Name or phone number" : "Vehicle plate number"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <Input
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!value.trim() || add.isPending}
              onClick={() => add.mutate({ data: { type, value, reason: reason || undefined } })}
            >
              {add.isPending ? "Adding..." : "Blacklist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Security Page ───────────────────────────────────────────────────────

function SecurityPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const currentTab = search.tab || "gates";

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Security Control
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Manage gate terminals, guard patrols, and blacklisted visitors/vehicles.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={currentTab} onValueChange={(val) => navigate({ search: { tab: val } })}>
          <TabsList className="mb-4">
            <TabsTrigger value="gates" className="flex items-center gap-1.5">
              Gate Terminals
            </TabsTrigger>
            <TabsTrigger value="patrols" className="flex items-center gap-1.5">
              Guard Patrols
            </TabsTrigger>
            <TabsTrigger value="blacklist" className="flex items-center gap-1.5">
              Blacklist
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gates">
            <GateTerminalsTab />
          </TabsContent>
          <TabsContent value="patrols">
            <GuardPatrolsTab />
          </TabsContent>
          <TabsContent value="blacklist">
            <BlacklistTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
