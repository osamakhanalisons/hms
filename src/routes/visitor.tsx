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
  getVisitorPassesFn,
  createVisitorPassFn,
  getEntryExitLogsFn,
  recordGatePassVerificationFn,
} from "@/lib/api/visitor";
import { toast } from "sonner";
import {
  UserCheck,
  Plus,
  Clock,
  QrCode,
  ArrowRight,
  ArrowLeft,
  Hash,
  ShieldCheck,
  Car,
} from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/visitor")({
  head: () => ({
    meta: [
      { title: "Visitor Management — HousingOS" },
      {
        name: "description",
        content: "Pre-register visitors, manage QR passes, and log gate entry/exit.",
      },
    ],
  }),
  component: VisitorRoute,
});

function VisitorRoute() {
  return (
    <ModuleGate moduleKey="visitor">
      <VisitorPage />
    </ModuleGate>
  );
}

function VisitorPage() {
  const queryClient = useQueryClient();
  const [passOpen, setPassOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"passes" | "log">("passes");

  // Pass form
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [visitorType, setVisitorType] = useState<"one_time" | "recurring">("one_time");
  const [passVehiclePlate, setPassVehiclePlate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  // Gate verification form
  const [passCode, setPassCode] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [vehiclePlate, setVehiclePlate] = useState("");

  const { data: passes = [], isLoading: loadingPasses } = useQuery({
    queryKey: ["visitor-passes"],
    queryFn: async () => getVisitorPassesFn(),
  });

  const { data: logs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ["entry-exit-logs"],
    queryFn: async () => getEntryExitLogsFn(),
  });

  const createPass = useMutation({
    mutationFn: createVisitorPassFn,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["visitor-passes"] });
      toast.success(`Visitor pass created! Code: ${(result as any).passCode}`, { duration: 8000 });
      setPassOpen(false);
      setVisitorName("");
      setVisitorPhone("");
      setExpectedAt("");
      setVisitorType("one_time");
      setPassVehiclePlate("");
      setExpiresAt("");
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to create pass"),
  });

  const verifyPass = useMutation({
    mutationFn: recordGatePassVerificationFn,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["visitor-passes"] });
      queryClient.invalidateQueries({ queryKey: ["entry-exit-logs"] });
      toast.success(
        `✅ ${(result as any).visitorName} — gate ${direction === "in" ? "entry" : "exit"} logged`,
      );
      setGateOpen(false);
      setPassCode("");
      setVehiclePlate("");
    },
    onError: (err: any) => toast.error(err.message ?? "Invalid or expired pass code"),
  });

  const handleCreatePass = (e: React.FormEvent) => {
    e.preventDefault();
    createPass.mutate({
      data: {
        visitorName,
        visitorPhone: visitorPhone || undefined,
        expectedAt,
        visitorType,
        vehiclePlate: passVehiclePlate || undefined,
        expiresAt: expiresAt || undefined,
      },
    });
  };

  const handleVerifyPass = (e: React.FormEvent) => {
    e.preventDefault();
    verifyPass.mutate({ data: { passCode, direction, vehiclePlate: vehiclePlate || undefined } });
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      used: "secondary",
      expired: "destructive",
      cancelled: "outline",
    };
    return (
      <Badge variant={variants[status] ?? "secondary"} className="text-[10px]">
        {status}
      </Badge>
    );
  };

  return (
    <AppShell
      title="Visitor Management"
      subtitle="Pre-register visitors, verify QR passes, and track gate entries"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10 space-y-8">
        {/* Header */}
        <section className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
              <UserCheck className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Active Passes</p>
              <p className="text-2xl font-bold font-mono">
                {(passes as any[]).filter((p) => p.status === "active").length}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setGateOpen(true)} variant="outline" size="sm" className="gap-1">
              <ShieldCheck className="size-4" /> Verify Pass (Gate)
            </Button>
            <Button onClick={() => setPassOpen(true)} size="sm" className="gap-1">
              <Plus className="size-4" /> Pre-register Visitor
            </Button>
          </div>
        </section>

        {/* Tab navigation */}
        <div className="flex gap-1 border-b">
          {(["passes", "log"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "passes" ? "Visitor Passes" : "Entry/Exit Log"}
            </button>
          ))}
        </div>

        {/* Visitor Passes Tab */}
        {activeTab === "passes" && (
          <Card className="border-border/70 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base font-bold">Visitor Passes</CardTitle>
              <CardDescription className="text-xs">
                QR-based pre-registered visitor entries
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPasses ? (
                <div className="flex justify-center py-10">
                  <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : (passes as any[]).length === 0 ? (
                <div className="text-center py-12 text-xs text-muted-foreground">
                  No visitor passes yet.
                </div>
              ) : (
                <div className="divide-y">
                  {(passes as any[]).map((pass) => (
                    <div key={pass.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="grid size-9 place-items-center rounded bg-primary-soft text-primary shrink-0">
                          <QrCode className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm truncate">{pass.visitor_name}</p>
                            <Badge
                              variant={pass.visitor_type === "recurring" ? "default" : "outline"}
                              className="text-[8px] uppercase tracking-wider h-4 py-0 scale-90 origin-left"
                            >
                              {pass.visitor_type === "recurring" ? "Recurring" : "One-time"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Host: {pass.resident_name} · Unit {pass.unit_number}
                          </p>
                          {pass.vehicle_plate && (
                            <p className="text-xs font-mono font-semibold text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Car className="size-3 text-muted-foreground/80" />
                              <span>{pass.vehicle_plate.toUpperCase()}</span>
                            </p>
                          )}
                          {pass.expected_at && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="size-3" />
                              {format(new Date(pass.expected_at), "dd MMM yyyy, hh:mm a")}
                              {pass.expires_at &&
                                ` (Expires: ${format(new Date(pass.expires_at), "dd MMM yyyy")})`}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {statusBadge(pass.status)}
                        <p className="font-mono text-xs font-bold tracking-wider text-primary">
                          {pass.pass_code}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Entry/Exit Log Tab */}
        {activeTab === "log" && (
          <Card className="border-border/70 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base font-bold">Entry / Exit Log</CardTitle>
              <CardDescription className="text-xs">Real-time gate access records</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <div className="flex justify-center py-10">
                  <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : (logs as any[]).length === 0 ? (
                <div className="text-center py-12 text-xs text-muted-foreground">
                  No gate entries logged yet.
                </div>
              ) : (
                <div className="divide-y">
                  {(logs as any[]).map((log) => (
                    <div key={log.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`grid size-8 place-items-center rounded ${
                            log.direction === "in"
                              ? "bg-emerald-100 text-emerald-600"
                              : "bg-amber-100 text-amber-600"
                          }`}
                        >
                          {log.direction === "in" ? (
                            <ArrowRight className="size-4" />
                          ) : (
                            <ArrowLeft className="size-4" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{log.visitor_name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span
                              className={
                                log.direction === "in"
                                  ? "text-emerald-600 font-medium"
                                  : "text-amber-600 font-medium"
                              }
                            >
                              {log.direction === "in" ? "Entry" : "Exit"}
                            </span>
                            {log.vehicle_plate && (
                              <>
                                <span>·</span>
                                <span className="font-mono">{log.vehicle_plate}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {format(new Date(log.timestamp), "dd MMM, hh:mm a")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pre-register Visitor Dialog */}
      <Dialog open={passOpen} onOpenChange={setPassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Pre-register Visitor</DialogTitle>
            <DialogDescription>Generate a QR pass code for an expected visitor</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePass} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Visitor Name *</label>
              <Input
                required
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Visitor Phone</label>
              <Input
                value={visitorPhone}
                onChange={(e) => setVisitorPhone(e.target.value)}
                placeholder="+92 300 0000000"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Expected Arrival *
              </label>
              <Input
                required
                type="datetime-local"
                value={expectedAt}
                onChange={(e) => setExpectedAt(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Pass Type</label>
                <Select value={visitorType} onValueChange={(val: any) => setVisitorType(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One-time Pass</SelectItem>
                    <SelectItem value="recurring">Recurring Pass</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Vehicle Plate (optional)
                </label>
                <Input
                  value={passVehiclePlate}
                  onChange={(e) => setPassVehiclePlate(e.target.value)}
                  placeholder="e.g. LZA-4471"
                  className="font-mono uppercase"
                />
              </div>
            </div>
            {visitorType === "recurring" && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Pass Expiration Date *
                </label>
                <Input
                  required
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPassOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createPass.isPending}>
                {createPass.isPending ? "Creating…" : "Generate Pass"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Gate Verify Dialog */}
      <Dialog open={gateOpen} onOpenChange={setGateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Gate Pass Verification</DialogTitle>
            <DialogDescription>
              Enter the 6-digit pass code to log gate entry or exit
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleVerifyPass} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Pass Code *</label>
              <Input
                required
                value={passCode}
                onChange={(e) => setPassCode(e.target.value)}
                placeholder="6-digit code"
                className="font-mono text-lg tracking-widest text-center"
                maxLength={6}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Direction</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={direction === "in" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={() => setDirection("in")}
                >
                  <ArrowRight className="size-4" /> Entry
                </Button>
                <Button
                  type="button"
                  variant={direction === "out" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={() => setDirection("out")}
                >
                  <ArrowLeft className="size-4" /> Exit
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Vehicle Plate (optional)
              </label>
              <Input
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                placeholder="e.g. ABC-123"
                className="font-mono uppercase"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={verifyPass.isPending}>
                {verifyPass.isPending ? "Verifying…" : "Log Gate Access"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
