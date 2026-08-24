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
  getDomesticStaffFn,
  createDomesticStaffFn,
  updateDomesticStaffFn,
  verifyDomesticStaffFn,
  recordStaffMovementFn,
  type VisitorPassItem,
  type EntryExitLogItem,
  type BlacklistItem,
  type DomesticStaffItem,
  type StaffVerificationResult,
} from "@/lib/api/visitor";
import { Users, UserPlus, UserX, Check, Copy } from "lucide-react";

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

  // Gate terminal sub tab
  const [gateTerminalSubTab, setGateTerminalSubTab] = useState<"otp" | "staff">("otp");

  // Domestic Staff states
  const [staffSearch, setStaffSearch] = useState("");
  const { data: staffList = [], refetch: refetchStaff, isLoading: isStaffLoading } = useQuery({
    queryKey: ["domestic-staff", staffSearch],
    queryFn: () => getDomesticStaffFn({ data: { search: staffSearch } }),
    staleTime: 15_000,
  });

  // Register Staff state
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [sName, setSName] = useState("");
  const [sPhone, setSPhone] = useState("");
  const [sStaffType, setSStaffType] = useState<"maid" | "driver" | "gardener" | "cook" | "nanny" | "other">("maid");
  const [sValidFrom, setSValidFrom] = useState("");
  const [sValidUntil, setSValidUntil] = useState("");
  const [sAllowedDays, setSAllowedDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const [sEntryStartTime, setSEntryStartTime] = useState("08:00");
  const [sEntryEndTime, setSEntryEndTime] = useState("17:00");
  const [sVehiclePlate, setSVehiclePlate] = useState("");
  const [sNotes, setSNotes] = useState("");
  const [sResidentId, setSResidentId] = useState(""); // Only for admins
  const [sError, setSError] = useState<string | null>(null);
  const [isStaffSubmitting, setIsStaffSubmitting] = useState(false);
  const [registeredStaffCode, setRegisteredStaffCode] = useState<string | null>(null);

  // Gate Staff verification state
  const [staffGateQuery, setStaffGateQuery] = useState("");
  const [staffVerifyResult, setStaffVerifyResult] = useState<StaffVerificationResult | null>(null);
  const [isStaffVerifying, setIsStaffVerifying] = useState(false);
  const [staffRecordResult, setStaffRecordResult] = useState<{ success: boolean; message: string } | null>(null);

  const openAddStaff = () => {
    setEditingStaffId(null);
    setSName(""); setSPhone(""); setSStaffType("maid");
    setSValidFrom(""); setSValidUntil("");
    setSAllowedDays(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    setSEntryStartTime("08:00"); setSEntryEndTime("17:00");
    setSVehiclePlate(""); setSNotes(""); setSResidentId("");
    setSError(null);
    setAddStaffOpen(true);
  };

  const openEditStaff = (staff: DomesticStaffItem) => {
    setEditingStaffId(staff.id);
    setSName(staff.name);
    setSPhone(staff.phone || "");
    setSStaffType(staff.staffType);
    setSValidFrom(staff.validFrom);
    setSValidUntil(staff.validUntil);
    setSAllowedDays(staff.allowedDays.split(","));
    setSEntryStartTime(staff.entryStartTime ? staff.entryStartTime.slice(0, 5) : "");
    setSEntryEndTime(staff.entryEndTime ? staff.entryEndTime.slice(0, 5) : "");
    setSVehiclePlate(staff.vehiclePlate || "");
    setSNotes(staff.notes || "");
    setSResidentId(staff.residentId);
    setSError(null);
    setAddStaffOpen(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSError(null);
    if (!sName.trim()) return setSError("Staff name is required");
    if (!sValidFrom) return setSError("Valid from date is required");
    if (!sValidUntil) return setSError("Valid until date is required");
    if (sAllowedDays.length === 0) return setSError("At least one allowed day must be selected");

    setIsStaffSubmitting(true);
    try {
      if (editingStaffId) {
        await updateDomesticStaffFn({
          data: {
            id: editingStaffId,
            name: sName.trim(),
            phone: sPhone || null,
            staffType: sStaffType,
            validFrom: sValidFrom,
            validUntil: sValidUntil,
            allowedDays: sAllowedDays.join(","),
            entryStartTime: sEntryStartTime ? `${sEntryStartTime}:00` : null,
            entryEndTime: sEntryEndTime ? `${sEntryEndTime}:00` : null,
            vehiclePlate: sVehiclePlate || null,
            notes: sNotes || null,
            isActive: true,
          },
        });
      } else {
        const res = await createDomesticStaffFn({
          data: {
            name: sName.trim(),
            phone: sPhone || null,
            staffType: sStaffType,
            validFrom: sValidFrom,
            validUntil: sValidUntil,
            allowedDays: sAllowedDays.join(","),
            entryStartTime: sEntryStartTime ? `${sEntryStartTime}:00` : null,
            entryEndTime: sEntryEndTime ? `${sEntryEndTime}:00` : null,
            vehiclePlate: sVehiclePlate || null,
            notes: sNotes || null,
            residentId: sResidentId || undefined,
          },
        });
        if (res && res.staffCode) {
          setRegisteredStaffCode(res.staffCode);
        }
      }
      setAddStaffOpen(false);
      refetchStaff();
    } catch (err: any) {
      setSError(err.message || "Failed to save domestic staff");
    } finally {
      setIsStaffSubmitting(false);
    }
  };

  const handleToggleStaffActive = async (staff: DomesticStaffItem) => {
    try {
      await updateDomesticStaffFn({
        data: {
          id: staff.id,
          name: staff.name,
          phone: staff.phone,
          staffType: staff.staffType,
          validFrom: staff.validFrom,
          validUntil: staff.validUntil,
          allowedDays: staff.allowedDays,
          entryStartTime: staff.entryStartTime,
          entryEndTime: staff.entryEndTime,
          vehiclePlate: staff.vehiclePlate,
          notes: staff.notes,
          isActive: !staff.isActive,
        },
      });
      refetchStaff();
    } catch (err: any) {
      console.error("Failed to toggle staff active state:", err);
    }
  };

  const handleVerifyStaffGate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffVerifyResult(null);
    setStaffRecordResult(null);
    if (!staffGateQuery.trim()) return;

    setIsStaffVerifying(true);
    try {
      const res = await verifyDomesticStaffFn({
        data: { query: staffGateQuery.trim() },
      });
      setStaffVerifyResult(res);
    } catch (err: any) {
      setStaffVerifyResult({
        status: "not_found",
        message: err.message || "Failed to search staff",
        staff: null,
      });
    } finally {
      setIsStaffVerifying(false);
    }
  };

  const handleRecordStaffMovement = async (staffId: string, direction: "in" | "out") => {
    setStaffRecordResult(null);
    try {
      await recordStaffMovementFn({
        data: {
          staffId,
          direction,
        },
      });
      setStaffRecordResult({
        success: true,
        message: `✅ Check-${direction === "in" ? "in" : "out"} recorded successfully for ${staffVerifyResult?.staff?.name}`,
      });
      setStaffVerifyResult(null);
      setStaffGateQuery("");
      refetch();
    } catch (err: any) {
      setStaffRecordResult({
        success: false,
        message: err.message || "Failed to record movement",
      });
    }
  };

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
            <TabsTrigger value="staff" className="text-xs gap-1.5">
              <Users className="size-3.5" /> Domestic Staff ({staffList.length})
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

          {/* DOMESTIC STAFF TAB */}
          <TabsContent value="staff" className="space-y-6">
            <Card className="border-border/70 shadow-soft p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search staff by name, phone, plate..."
                    className="h-9 pl-9 text-xs"
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                  />
                </div>
                <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={openAddStaff}>
                  <UserPlus className="size-3.5" /> Register Domestic Staff
                </Button>
              </div>
            </Card>

            {isStaffLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : !staffList.length ? (
              <Card className="border-border/70 border-dashed p-12 text-center text-muted-foreground">
                <Users className="size-10 mx-auto opacity-30 mb-2" />
                <p className="text-sm font-medium">No domestic staff registered</p>
                <p className="text-[11px] opacity-60 mt-1">Register recurring maids, drivers, or gardeners for your unit.</p>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {staffList.map((staff) => (
                  <Card key={staff.id} className={`border-border/70 shadow-soft transition-colors ${!staff.isActive ? "opacity-60" : ""}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge className={`text-[10px] uppercase font-bold ${
                              staff.isActive ? "bg-emerald-500/10 text-emerald-600 border-transparent" : "bg-rose-500/10 text-rose-600 border-transparent"
                            }`}>
                              {staff.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent capitalize font-semibold">
                              {staff.staffType}
                            </Badge>
                          </div>
                          <CardTitle className="font-serif text-sm font-bold truncate">
                            {staff.name}
                          </CardTitle>
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/30">
                              Staff ID: {staff.staffCode}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-5 text-muted-foreground hover:text-foreground rounded shrink-0"
                              onClick={() => {
                                navigator.clipboard.writeText(staff.staffCode);
                                alert(`Copied Staff ID: ${staff.staffCode}`);
                              }}
                              title="Copy Staff ID"
                            >
                              <Copy className="size-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs pt-0">
                      <div className="space-y-1 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
                        {staff.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="size-3 shrink-0" />
                            <span>{staff.phone}</span>
                          </div>
                        )}
                        {staff.vehiclePlate && (
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <Car className="size-3 shrink-0 text-primary" />
                            <span className="font-mono">{staff.vehiclePlate}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Building className="size-3 shrink-0" />
                          <span>Unit: {staff.unitNumber} ({staff.residentName})</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground pt-0.5">
                          <Calendar className="size-3 shrink-0" />
                          <span>Days: {staff.allowedDays}</span>
                        </div>
                        {(staff.entryStartTime || staff.entryEndTime) && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="size-3 shrink-0" />
                            <span>Hours: {staff.entryStartTime?.slice(0, 5) || "Any"} - {staff.entryEndTime?.slice(0, 5) || "Any"}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/20 mt-1">
                          Valid: {staff.validFrom} to {staff.validUntil}
                        </div>
                        {staff.notes && (
                          <p className="text-[10px] italic mt-1 text-muted-foreground truncate font-sans">"{staff.notes}"</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] flex-1"
                          onClick={() => openEditStaff(staff)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant={staff.isActive ? "destructive" : "default"}
                          size="sm"
                          className="h-7 text-[11px] flex-1"
                          onClick={() => handleToggleStaffActive(staff)}
                        >
                          {staff.isActive ? "Deactivate" : "Activate"}
                        </Button>
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
                <CardDescription className="text-xs">Verify visitor pass codes or authenticate recurring domestic staff</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center mb-4">
                  <div className="bg-muted p-1 rounded-lg inline-flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={gateTerminalSubTab === "otp" ? "secondary" : "ghost"}
                      className="text-xs h-7 px-3"
                      onClick={() => setGateTerminalSubTab("otp")}
                    >
                      Visitor OTP Pass
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={gateTerminalSubTab === "staff" ? "secondary" : "ghost"}
                      className="text-xs h-7 px-3"
                      onClick={() => setGateTerminalSubTab("staff")}
                    >
                      Domestic Staff / Maid
                    </Button>
                  </div>
                </div>

                {gateTerminalSubTab === "otp" ? (
                  <>
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
                  </>
                ) : (
                  <div className="space-y-4">
                    {staffRecordResult && (
                      <div className={`rounded-lg p-3 text-xs border ${
                        staffRecordResult.success ? "bg-emerald-500/10 border-emerald-300 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/10 border-rose-300 text-rose-700 dark:text-rose-300"
                      }`}>
                        <p className="font-medium">{staffRecordResult.message}</p>
                      </div>
                    )}

                    <form onSubmit={handleVerifyStaffGate} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Search Staff ID / Phone / Name</Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="e.g. Shabana Bibi, 03001234567..."
                              className="h-9 pl-9 text-xs"
                              value={staffGateQuery}
                              onChange={(e) => setStaffGateQuery(e.target.value)}
                            />
                          </div>
                          <Button type="submit" size="sm" className="h-9 text-xs" disabled={isStaffVerifying}>
                            {isStaffVerifying ? "Searching..." : "Search & Verify"}
                          </Button>
                        </div>
                      </div>
                    </form>

                    {staffVerifyResult && (
                      <Card className="border-border/60 bg-muted/20">
                        <CardContent className="p-4 space-y-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-serif font-bold text-sm text-foreground">{staffVerifyResult.staff?.name || "Staff Details"}</h4>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{staffVerifyResult.staff?.staffType}</p>
                            </div>
                            <Badge className={`text-[10px] uppercase font-bold ${
                              staffVerifyResult.status === "authorized" ? "bg-emerald-500/10 text-emerald-600 border-transparent" : "bg-rose-500/10 text-rose-600 border-transparent"
                            }`}>
                              {staffVerifyResult.status.replace("_", " ")}
                            </Badge>
                          </div>

                          <div className="text-xs space-y-1 text-muted-foreground border-t border-border/40 pt-2">
                            <div>Staff ID: <strong className="text-foreground font-mono">{staffVerifyResult.staff?.staffCode}</strong></div>
                            <div>Resident: <strong className="text-foreground">{staffVerifyResult.staff?.residentName}</strong> (Unit {staffVerifyResult.staff?.unitNumber})</div>
                            {staffVerifyResult.staff?.phone && <div>Phone: <span className="text-foreground">{staffVerifyResult.staff.phone}</span></div>}
                            {staffVerifyResult.staff?.vehiclePlate && <div>Vehicle: <span className="font-mono text-foreground font-semibold">[{staffVerifyResult.staff.vehiclePlate}]</span></div>}
                            {staffVerifyResult.staff?.notes && <div className="italic mt-1">Notes: "{staffVerifyResult.staff.notes}"</div>}
                          </div>

                          <p className={`text-xs font-bold ${staffVerifyResult.status === "authorized" ? "text-emerald-600" : "text-rose-600"}`}>
                            {staffVerifyResult.message}
                          </p>

                          {staffVerifyResult.status === "authorized" && staffVerifyResult.staff && (
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/20">
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 h-8"
                                onClick={() => handleRecordStaffMovement(staffVerifyResult.staff!.id, "in")}
                              >
                                <ArrowRight className="size-3.5" /> Check In
                              </Button>
                              <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1 h-8"
                                onClick={() => handleRecordStaffMovement(staffVerifyResult.staff!.id, "out")}
                              >
                                <ArrowLeft className="size-3.5" /> Check Out
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
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
      {/* Register / Edit Domestic Staff Modal */}
      <Dialog open={addStaffOpen} onOpenChange={setAddStaffOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">
              {editingStaffId ? "Edit Domestic Staff" : "Register Domestic Staff"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Register recurring cooks, maids, or drivers with long-term gate authorization.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveStaff} className="space-y-4">
            {sError && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{sError}</div>}

            <div className="space-y-1.5">
              <Label className="text-xs">Full Name *</Label>
              <Input placeholder="Staff member name" className="h-9 text-xs" value={sName} onChange={(e) => setSName(e.target.value)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Phone Number</Label>
                <Input placeholder="+92 300 0000000" className="h-9 text-xs" value={sPhone} onChange={(e) => setSPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Staff Type *</Label>
                <Select value={sStaffType} onValueChange={(v) => setSStaffType(v as any)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maid" className="text-xs">Maid</SelectItem>
                    <SelectItem value="driver" className="text-xs">Driver</SelectItem>
                    <SelectItem value="gardener" className="text-xs">Gardener</SelectItem>
                    <SelectItem value="cook" className="text-xs">Cook</SelectItem>
                    <SelectItem value="nanny" className="text-xs">Nanny</SelectItem>
                    <SelectItem value="other" className="text-xs">Other Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Authorized From *</Label>
                <Input type="date" className="h-9 text-xs" value={sValidFrom} onChange={(e) => setSValidFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Authorized Until *</Label>
                <Input type="date" className="h-9 text-xs" value={sValidUntil} onChange={(e) => setSValidUntil(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Allowed Days of Week *</Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => {
                  const selected = sAllowedDays.includes(day);
                  return (
                    <Button
                      key={day}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      className="h-7 text-[10px] px-2.5 font-semibold"
                      onClick={() => {
                        if (selected) {
                          setSAllowedDays(sAllowedDays.filter((d) => d !== day));
                        } else {
                          setSAllowedDays([...sAllowedDays, day]);
                        }
                      }}
                    >
                      {day}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Allowed Entry Start</Label>
                <Input type="time" className="h-9 text-xs" value={sEntryStartTime} onChange={(e) => setSEntryStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Allowed Entry End</Label>
                <Input type="time" className="h-9 text-xs" value={sEntryEndTime} onChange={(e) => setSEntryEndTime(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Vehicle Plate (Optional)</Label>
                <Input placeholder="e.g. LZA-4471" className="h-9 text-xs font-mono uppercase" value={sVehiclePlate} onChange={(e) => setSVehiclePlate(e.target.value)} />
              </div>
              {isSecurity && !editingStaffId && unitsList.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Destination Unit *</Label>
                  <Select value={sResidentId} onValueChange={setSResidentId}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Unit" /></SelectTrigger>
                    <SelectContent>
                      {unitsList.map((u: any) => (
                        <SelectItem key={u.id} value={u.id} className="text-xs">
                          {u.fullPath || `Unit ${u.unitNumber}`} {u.residentName ? `(${u.residentName})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes / Job Details</Label>
              <Textarea placeholder="e.g. Daily apartment cleaning and dishwashing..." className="text-xs min-h-[50px]" value={sNotes} onChange={(e) => setSNotes(e.target.value)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setAddStaffOpen(false)} disabled={isStaffSubmitting}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isStaffSubmitting}>
                {isStaffSubmitting ? "Saving..." : editingStaffId ? "Save Changes" : "Register Staff"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={!!registeredStaffCode} onOpenChange={() => setRegisteredStaffCode(null)}>
        <DialogContent className="max-w-sm text-center p-6">
          <div className="mx-auto size-12 grid place-items-center rounded-full bg-emerald-100 text-emerald-600 mb-3">
            <Check className="size-6" />
          </div>
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-bold text-center">Staff Registered Successfully</DialogTitle>
            <DialogDescription className="text-xs text-center mt-1">
              The domestic staff member has been registered.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 p-3 bg-muted/40 rounded-lg border border-border/40">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Staff ID</p>
            <p className="text-xl font-bold font-mono text-foreground tracking-wide mt-1">{registeredStaffCode}</p>
          </div>
          <Button className="w-full text-xs h-9" onClick={() => setRegisteredStaffCode(null)}>
            Okay, got it
          </Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
