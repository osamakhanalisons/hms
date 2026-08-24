import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  UserCheck,
  Plus,
  Search,
  RefreshCw,
  ShieldAlert,
  QrCode,
  ArrowRight,
  ArrowLeft,
  Hash,
  ShieldCheck,
  Car,
  Clock,
  Ban,
  Phone,
  Calendar,
  CheckCircle2,
  XCircle,
  Filter,
  Sliders,
  Building,
  Key,
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
  getVisitorOverviewFn,
  createVisitorPassFn,
  recordGatePassVerificationFn,
  cancelVisitorPassFn,
  addToBlacklistFn,
  removeFromBlacklistFn,
  type VisitorPassItem,
  type EntryExitLogItem,
  type BlacklistItem,
} from "@/lib/api/visitor";

export const Route = createFileRoute("/visitor")({
  head: () => ({
    meta: [
      { title: "Visitor Management & Gate Pass — HousingOS" },
      { name: "description", content: "Pre-register visitors, QR gate passes, and entry/exit logs." },
    ],
  }),
  component: VisitorRoute,
});

function VisitorRoute() {
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
      <AppShell title="Access Denied" subtitle="Visitors">
        <div className="mx-auto max-w-md py-16 text-center space-y-4">
          <ShieldAlert className="size-12 mx-auto text-destructive" />
          <h2 className="text-lg font-bold font-serif">Authentication Required</h2>
          <p className="text-sm text-muted-foreground">Please log in to view visitor management.</p>
        </div>
      </AppShell>
    );
  }
  return (
    <ModuleGate moduleKey="visitor">
      <VisitorPage />
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

function PassStatusBadge({ status }: { status: VisitorPassItem["status"] }) {
  const map = {
    active: "bg-emerald-500/10 text-emerald-600 border-transparent font-semibold",
    used: "bg-blue-500/10 text-blue-600 border-transparent",
    expired: "bg-slate-500/10 text-slate-500 border-transparent",
    cancelled: "bg-rose-500/10 text-rose-600 border-transparent line-through",
  } as const;
  const labels = { active: "Active Pass", used: "Checked In (Used)", expired: "Expired", cancelled: "Cancelled" };
  return <Badge variant="outline" className={`text-[10px] ${map[status]}`}>{labels[status]}</Badge>;
}

function VisitorPage() {
  const { roles } = useAuth();
  const isSecurity = roles.some((r) =>
    ["super_admin", "society_admin", "security_head", "guard"].includes(r),
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("passes");

  // Pre-register modal state
  const [addPassOpen, setAddPassOpen] = useState(false);
  const [vName, setVName] = useState("");
  const [vPhone, setVPhone] = useState("");
  const [vExpectedAt, setVExpectedAt] = useState("");
  const [vType, setVType] = useState<VisitorPassItem["visitorType"]>("one_time");
  const [vPlate, setVPlate] = useState("");
  const [vUnitId, setVUnitId] = useState("");
  const [vExpiresAt, setVExpiresAt] = useState("");
  const [vNotes, setVNotes] = useState("");
  const [vError, setVError] = useState<string | null>(null);
  const [isVSubmitting, setIsVSubmitting] = useState(false);
  const [createdPassCode, setCreatedPassCode] = useState<string | null>(null);

  // Gate verification state
  const [gateCode, setGateCode] = useState("");
  const [gateDirection, setGateDirection] = useState<"in" | "out">("in");
  const [gatePlate, setGatePlate] = useState("");
  const [gateResult, setGateResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Blacklist modal state
  const [addBlOpen, setAddBlOpen] = useState(false);
  const [blName, setBlName] = useState("");
  const [blPhone, setBlPhone] = useState("");
  const [blPlate, setBlPlate] = useState("");
  const [blReason, setBlReason] = useState("");
  const [blError, setBlError] = useState<string | null>(null);
  const [isBlSubmitting, setIsBlSubmitting] = useState(false);

  // QR Code preview modal
  const [qrPass, setQrPass] = useState<VisitorPassItem | null>(null);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["visitor-overview", search, statusFilter, typeFilter],
    queryFn: () =>
      getVisitorOverviewFn({ data: { search, status: statusFilter, type: typeFilter } }),
    staleTime: 15_000,
  });

  const handleCreatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    setVError(null);
    if (!vName.trim()) return setVError("Visitor name is required");
    if (!vExpectedAt) return setVError("Expected arrival date/time is required");

    setIsVSubmitting(true);
    try {
      const res = await createVisitorPassFn({
        data: {
          visitorName: vName.trim(),
          visitorPhone: vPhone || undefined,
          expectedAt: vExpectedAt,
          visitorType: vType,
          vehiclePlate: vPlate || undefined,
          unitId: vUnitId || undefined,
          expiresAt: vExpiresAt || undefined,
          notes: vNotes || undefined,
        },
      });
      setCreatedPassCode(res.passCode);
      setVName(""); setVPhone(""); setVExpectedAt(""); setVType("one_time"); setVPlate(""); setVNotes("");
      refetch();
    } catch (err: any) {
      setVError(err.message || "Failed to create visitor pass");
    } finally {
      setIsVSubmitting(false);
    }
  };

  const handleVerifyGatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateResult(null);
    if (!gateCode.trim()) return setGateResult({ success: false, message: "Please enter a 6-digit pass code" });

    setIsVerifying(true);
    try {
      const res = await recordGatePassVerificationFn({
        data: {
          passCode: gateCode.trim(),
          direction: gateDirection,
          vehiclePlate: gatePlate || undefined,
        },
      });
      setGateResult({
        success: true,
        message: `✅ Entry/Exit recorded for visitor: "${res.visitorName}" (${gateDirection.toUpperCase()})`,
      });
      setGateCode(""); setGatePlate("");
      refetch();
    } catch (err: any) {
      setGateResult({ success: false, message: err.message || "Gate verification failed" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCancelPass = async (passId: string) => {
    try {
      await cancelVisitorPassFn({ data: { passId } });
      refetch();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleAddBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlError(null);
    if (!blName.trim()) return setBlError("Name is required");
    if (!blReason.trim()) return setBlError("Reason is required");

    setIsBlSubmitting(true);
    try {
      await addToBlacklistFn({
        data: {
          name: blName.trim(),
          phone: blPhone || undefined,
          vehiclePlate: blPlate || undefined,
          reason: blReason.trim(),
        },
      });
      setAddBlOpen(false);
      setBlName(""); setBlPhone(""); setBlPlate(""); setBlReason("");
      refetch();
    } catch (err: any) {
      setBlError(err.message || "Failed to add to blacklist");
    } finally {
      setIsBlSubmitting(false);
    }
  };

  const handleRemoveBlacklist = async (blacklistId: string) => {
    try {
      await removeFromBlacklistFn({ data: { blacklistId } });
      refetch();
    } catch (err: any) {
      console.error(err);
    }
  };

  const summary = data?.summary;
  const passes = data?.visitorPasses ?? [];
  const logs = data?.entryExitLogs ?? [];
  const blacklist = data?.blacklist ?? [];
  const unitsList = data?.unitsList ?? [];

  return (
    <AppShell
      title="Visitor Management & Gate Passes"
      subtitle="Pre-register guests, verify 6-digit gate passes and monitor entry/exit logs"
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => { setCreatedPassCode(null); setAddPassOpen(true); }}>
            <Plus className="size-3.5" /> Pre-Register Guest
          </Button>
          {isSecurity && (
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => setAddBlOpen(true)}>
              <Ban className="size-3.5 text-rose-600" /> Blacklist Person
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
        {/* Header */}
        <header className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-md bg-surface border border-border/60">
            <UserCheck className="size-5 text-primary" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Security · Access Control
            </div>
            <h1 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
              Visitor Gate Pass System
            </h1>
          </div>
        </header>

        {/* Error banner */}
        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-4 shrink-0" />
              <p className="text-sm font-medium">
                {error instanceof Error ? error.message : "Failed to load visitor records"}
              </p>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="Total Passes" value={String(summary?.totalPasses ?? 0)} icon={UserCheck} loading={isLoading} />
          <KpiCard label="Active Passes" value={String(summary?.activePasses ?? 0)} icon={CheckCircle2} tone="success" loading={isLoading} />
          <KpiCard label="Checked In Today" value={String(summary?.todayCheckedIn ?? 0)} icon={ArrowRight} tone="info" loading={isLoading} />
          <KpiCard label="Checked Out Today" value={String(summary?.todayCheckedOut ?? 0)} icon={ArrowLeft} tone="warning" loading={isLoading} />
          <KpiCard label="Blacklisted Items" value={String(summary?.blacklistedCount ?? 0)} icon={Ban} tone={(summary?.blacklistedCount ?? 0) > 0 ? "destructive" : "default"} loading={isLoading} />
        </section>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-surface border border-border/60">
            <TabsTrigger value="passes" className="text-xs gap-1.5">
              <UserCheck className="size-3.5" /> Visitor Passes ({passes.length})
            </TabsTrigger>
            <TabsTrigger value="gate-terminal" className="text-xs gap-1.5">
              <ShieldCheck className="size-3.5 text-primary" /> Security Gate Terminal
            </TabsTrigger>
            <TabsTrigger value="logs" className="text-xs gap-1.5">
              <Clock className="size-3.5" /> Entry / Exit Logs ({logs.length})
            </TabsTrigger>
            <TabsTrigger value="blacklist" className="text-xs gap-1.5">
              <Ban className="size-3.5 text-rose-600" /> Blacklist Register ({blacklist.length})
            </TabsTrigger>
          </TabsList>

          {/* VISITOR PASSES TAB */}
          <TabsContent value="passes" className="space-y-6">
            {/* Filter Bar */}
            <Card className="border-border/70 shadow-soft p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search visitor, phone, OTP, vehicle..."
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
                    <SelectItem value="active" className="text-xs">Active</SelectItem>
                    <SelectItem value="used" className="text-xs">Used / Checked In</SelectItem>
                    <SelectItem value="expired" className="text-xs">Expired</SelectItem>
                    <SelectItem value="cancelled" className="text-xs">Cancelled</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-9 w-36 text-xs">
                    <Sliders className="mr-1.5 size-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Types</SelectItem>
                    <SelectItem value="one_time" className="text-xs">One-Time Guest</SelectItem>
                    <SelectItem value="recurring" className="text-xs">Recurring Vendor/Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {/* Visitor Passes Grid */}
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : !passes.length ? (
              <Card className="border-border/70 border-dashed p-12 text-center text-muted-foreground">
                <UserCheck className="size-10 mx-auto opacity-30 mb-2" />
                <p className="text-sm font-medium">No visitor passes found</p>
                <p className="text-[11px] opacity-60 mt-1">Click "Pre-Register Guest" to issue a 6-digit gate OTP pass.</p>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {passes.map((pass) => (
                  <Card key={pass.id} className="border-border/70 shadow-soft hover:border-border transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs bg-primary/10 text-primary border-transparent font-bold">
                              OTP: {pass.passCode}
                            </Badge>
                            <PassStatusBadge status={pass.status} />
                          </div>
                          <CardTitle className="font-serif text-sm font-bold truncate">
                            {pass.visitorName}
                          </CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs pt-0">
                      {/* Metadata */}
                      <div className="space-y-1 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
                        {pass.visitorPhone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="size-3 shrink-0" />
                            <span>{pass.visitorPhone}</span>
                          </div>
                        )}
                        {pass.vehiclePlate && (
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <Car className="size-3 shrink-0 text-primary" />
                            <span className="font-mono">{pass.vehiclePlate}</span>
                          </div>
                        )}
                        {pass.residentName && (
                          <div className="flex items-center gap-1.5">
                            <Building className="size-3 shrink-0" />
                            <span>Unit: {pass.unitNumber || "N/A"} ({pass.residentName})</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-muted-foreground pt-0.5">
                          <Calendar className="size-3 shrink-0" />
                          <span>Expected: {pass.expectedAt}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] flex-1 gap-1"
                          onClick={() => setQrPass(pass)}
                        >
                          <QrCode className="size-3" /> Show Pass
                        </Button>
                        {pass.status === "active" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] text-rose-600 hover:text-rose-700 gap-1"
                            onClick={() => handleCancelPass(pass.id)}
                          >
                            <XCircle className="size-3" /> Cancel
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* GATE TERMINAL VERIFICATION TAB */}
          <TabsContent value="gate-terminal" className="space-y-6">
            <Card className="border-border/70 shadow-soft max-w-xl mx-auto">
              <CardHeader className="text-center pb-3">
                <div className="mx-auto size-12 grid place-items-center rounded-full bg-primary/10 text-primary mb-2">
                  <ShieldCheck className="size-6" />
                </div>
                <CardTitle className="font-serif text-lg font-bold">Security Gate Verification</CardTitle>
                <CardDescription className="text-xs">Enter the 6-digit visitor pass code to grant entry/exit access</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {gateResult && (
                  <div
                    className={`rounded-lg p-3 text-xs border ${
                      gateResult.success
                        ? "bg-emerald-500/10 border-emerald-300 text-emerald-700 dark:text-emerald-300"
                        : "bg-rose-500/10 border-rose-300 text-rose-700 dark:text-rose-300"
                    }`}
                  >
                    <p className="font-medium">{gateResult.message}</p>
                  </div>
                )}

                <form onSubmit={handleVerifyGatePass} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Direction</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={gateDirection === "in" ? "default" : "outline"}
                        className={`h-9 text-xs gap-1.5 ${gateDirection === "in" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                        onClick={() => setGateDirection("in")}
                      >
                        <ArrowRight className="size-3.5" /> ENTRY (CHECK-IN)
                      </Button>
                      <Button
                        type="button"
                        variant={gateDirection === "out" ? "default" : "outline"}
                        className={`h-9 text-xs gap-1.5 ${gateDirection === "out" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
                        onClick={() => setGateDirection("out")}
                      >
                        <ArrowLeft className="size-3.5" /> EXIT (CHECK-OUT)
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">6-Digit Pass Code / OTP *</Label>
                    <div className="relative">
                      <Key className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="e.g. 482910"
                        className="h-11 pl-9 text-lg font-mono font-bold tracking-widest text-center"
                        value={gateCode}
                        maxLength={6}
                        onChange={(e) => setGateCode(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Vehicle Plate Number (Optional)</Label>
                    <div className="relative">
                      <Car className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="e.g. LE-9922, LZA-4471"
                        className="h-9 pl-9 text-xs font-mono uppercase"
                        value={gatePlate}
                        onChange={(e) => setGatePlate(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-10 text-xs font-semibold gap-1.5" disabled={isVerifying}>
                    {isVerifying ? "Verifying..." : "Verify Pass & Record Gate Entry"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ENTRY / EXIT LOGS TAB */}
          <TabsContent value="logs" className="space-y-6">
            <Card className="border-border/70 shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="font-serif text-base font-bold">Gate Movement Logs</CardTitle>
                <CardDescription className="text-xs">Timestamped entry and exit history recorded at gate terminals</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-14 animate-pulse bg-muted rounded" />
                    ))}
                  </div>
                ) : !logs.length ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <Clock className="size-10 mx-auto opacity-30 mb-2" />
                    <p className="text-sm font-medium">No gate movement logged yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {logs.map((log) => (
                      <div key={log.id} className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-muted/20 transition-colors text-xs">
                        <div className="flex items-center gap-3 min-w-0 max-w-lg">
                          <div className={`p-2 rounded-full ${log.direction === "in" ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"}`}>
                            {log.direction === "in" ? <ArrowRight className="size-4" /> : <ArrowLeft className="size-4" />}
                          </div>
                          <div>
                            <div className="font-bold text-foreground text-sm">{log.visitorName}</div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                              {log.vehiclePlate && <span className="font-mono text-foreground font-semibold">[{log.vehiclePlate}]</span>}
                              {log.unitNumber && <span>Unit: {log.unitNumber}</span>}
                              {log.verifiedByName && <span>Verified by: {log.verifiedByName}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <Badge variant="outline" className={`text-[10px] uppercase font-bold ${log.direction === "in" ? "bg-emerald-500/10 text-emerald-600 border-transparent" : "bg-blue-500/10 text-blue-600 border-transparent"}`}>
                            {log.direction === "in" ? "CHECKED IN" : "CHECKED OUT"}
                          </Badge>
                          <div className="text-[10px] text-muted-foreground mt-1 font-mono">{log.timestamp}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BLACKLIST REGISTER TAB */}
          <TabsContent value="blacklist" className="space-y-6">
            <Card className="border-border/70 shadow-soft border-rose-200 dark:border-rose-950">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-serif text-base font-bold text-rose-600">Restricted Persons & Vehicle Blacklist</CardTitle>
                    <CardDescription className="text-xs">Visitors and vehicles barred from entering society premises</CardDescription>
                  </div>
                  {isSecurity && (
                    <Button size="sm" variant="destructive" className="gap-1 text-xs h-8" onClick={() => setAddBlOpen(true)}>
                      <Ban className="size-3.5" /> Blacklist Person / Vehicle
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!blacklist.length ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <CheckCircle2 className="size-10 mx-auto opacity-30 text-emerald-600 mb-2" />
                    <p className="text-sm font-medium">No persons or vehicles currently blacklisted</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {blacklist.map((b) => (
                      <div key={b.id} className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-muted/20 transition-colors text-xs">
                        <div className="space-y-1 min-w-0 max-w-lg">
                          <div className="flex items-center gap-2 font-bold text-foreground text-sm">
                            <Ban className="size-3.5 text-rose-600 shrink-0" />
                            <span>{b.name}</span>
                            {b.vehiclePlate && <span className="font-mono text-xs text-rose-600 bg-rose-500/10 px-1.5 py-0.5 rounded">[{b.vehiclePlate}]</span>}
                          </div>
                          <p className="text-xs text-destructive font-medium">Reason: {b.reason}</p>
                          <div className="text-[10px] text-muted-foreground">
                            {b.phone && <span>Phone: {b.phone} · </span>}
                            <span>Added: {b.createdAt}</span>
                            {b.addedByName && <span> by {b.addedByName}</span>}
                          </div>
                        </div>

                        {isSecurity && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={() => handleRemoveBlacklist(b.id)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Pre-Register Visitor Modal */}
      <Dialog open={addPassOpen} onOpenChange={setAddPassOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Pre-Register Guest / Visitor</DialogTitle>
            <DialogDescription className="text-xs">Issue a 6-digit gate OTP pass for guests or contractors.</DialogDescription>
          </DialogHeader>

          {createdPassCode ? (
            <div className="py-6 text-center space-y-3">
              <div className="size-12 mx-auto rounded-full bg-emerald-500/10 grid place-items-center text-emerald-600">
                <CheckCircle2 className="size-6" />
              </div>
              <h3 className="font-serif font-bold text-lg">Visitor Pass Created!</h3>
              <p className="text-xs text-muted-foreground">Share this 6-digit OTP code with your guest for gate entry:</p>
              <div className="py-3 px-6 rounded-lg bg-primary/10 border border-primary/20 inline-block font-mono text-3xl font-bold tracking-widest text-primary">
                {createdPassCode}
              </div>
              <div>
                <Button size="sm" className="w-full text-xs" onClick={() => { setCreatedPassCode(null); setAddPassOpen(false); }}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreatePass} className="space-y-4">
              {vError && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{vError}</div>}

              <div className="space-y-1.5">
                <Label className="text-xs">Visitor Full Name *</Label>
                <Input placeholder="Guest or contractor name" className="h-9 text-xs" value={vName} onChange={(e) => setVName(e.target.value)} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone Number</Label>
                  <Input placeholder="+92 300 0000000" className="h-9 text-xs" value={vPhone} onChange={(e) => setVPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Vehicle Plate</Label>
                  <Input placeholder="e.g. LE-9922" className="h-9 text-xs font-mono uppercase" value={vPlate} onChange={(e) => setVPlate(e.target.value)} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Expected Arrival *</Label>
                  <Input type="datetime-local" className="h-9 text-xs" value={vExpectedAt} onChange={(e) => setVExpectedAt(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Visitor Type</Label>
                  <Select value={vType} onValueChange={(v) => setVType(v as VisitorPassItem["visitorType"])}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one_time" className="text-xs">One-Time Guest</SelectItem>
                      <SelectItem value="recurring" className="text-xs">Recurring Delivery/Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {unitsList.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Destination Unit (Optional)</Label>
                  <Select value={vUnitId} onValueChange={setVUnitId}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Unit" /></SelectTrigger>
                    <SelectContent>
                      {unitsList.map((u: { id: string; unitNumber: string; residentName: string | null; fullPath: string | null }) => (
                        <SelectItem key={u.id} value={u.id} className="text-xs">
                          {u.fullPath || `Unit ${u.unitNumber}`} {u.residentName ? `(${u.residentName})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => setAddPassOpen(false)} disabled={isVSubmitting}>Cancel</Button>
                <Button type="submit" size="sm" disabled={isVSubmitting}>{isVSubmitting ? "Generating..." : "Generate Pass OTP"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Show Pass / QR Code Modal */}
      <Dialog open={!!qrPass} onOpenChange={(o) => !o && setQrPass(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Visitor Gate Pass</DialogTitle>
            <DialogDescription className="text-xs">Present this OTP at the gate terminal for verification.</DialogDescription>
          </DialogHeader>
          {qrPass && (
            <div className="py-4 space-y-4">
              <div className="mx-auto size-32 border-4 border-foreground/10 rounded-xl grid place-items-center bg-white p-2">
                <QrCode className="size-24 text-foreground" />
              </div>

              <div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-widest">Gate Pass Code</div>
                <div className="font-mono text-3xl font-bold tracking-widest text-primary mt-1">{qrPass.passCode}</div>
              </div>

              <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1 text-left">
                <div>Visitor: <strong className="text-foreground">{qrPass.visitorName}</strong></div>
                {qrPass.vehiclePlate && <div>Vehicle: <strong className="font-mono">{qrPass.vehiclePlate}</strong></div>}
                {qrPass.unitNumber && <div>Unit: <strong className="text-foreground">{qrPass.unitNumber}</strong></div>}
                <div>Expected: <span>{qrPass.expectedAt}</span></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button size="sm" className="w-full" onClick={() => setQrPass(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Blacklist Modal */}
      <Dialog open={addBlOpen} onOpenChange={setAddBlOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-rose-600">Blacklist Visitor or Vehicle</DialogTitle>
            <DialogDescription className="text-xs">Bar a person or vehicle plate from entering society gates.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddBlacklist} className="space-y-4">
            {blError && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{blError}</div>}

            <div className="space-y-1.5">
              <Label className="text-xs">Name *</Label>
              <Input placeholder="Full name of restricted person" className="h-9 text-xs" value={blName} onChange={(e) => setBlName(e.target.value)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Phone Number</Label>
                <Input placeholder="+92 300 0000000" className="h-9 text-xs" value={blPhone} onChange={(e) => setBlPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vehicle Plate</Label>
                <Input placeholder="e.g. LZA-4471" className="h-9 text-xs font-mono uppercase" value={blPlate} onChange={(e) => setBlPlate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Reason for Blacklisting *</Label>
              <Textarea placeholder="e.g. Unauthorized entry, security violation, unpaid damages..." className="text-xs min-h-[70px]" value={blReason} onChange={(e) => setBlReason(e.target.value)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setAddBlOpen(false)} disabled={isBlSubmitting}>Cancel</Button>
              <Button type="submit" variant="destructive" size="sm" disabled={isBlSubmitting}>{isBlSubmitting ? "Blacklisting..." : "Blacklist Person"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
