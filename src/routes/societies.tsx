import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Building2,
  Plus,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Eye,
  ToggleLeft,
  ToggleRight,
  Loader2,
  X,
  AlertTriangle,
  Users,
  Vote,
  CalendarDays,
  Wrench,
  Dumbbell,
  DoorOpen,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { format, parseISO } from "date-fns";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  listAllSocietiesFn,
  createSocietyWithAdminFn,
  toggleSocietyStatusFn,
  getSocietyDetailFn,
  listSocietyAdminsFn,
  getAdminAssignmentsFn,
  saveAdminAssignmentsFn,
} from "@/lib/api/societies";

// ── Date helper ───────────────────────────────────────────────────────────
function safeFormatDate(dateInput: any) {
  if (!dateInput) return "—";
  try {
    const date = typeof dateInput === "string" ? parseISO(dateInput) : new Date(dateInput);
    if (isNaN(date.getTime())) return "—";
    return format(date, "dd MMM yyyy");
  } catch (e) {
    return "—";
  }
}

// ── Route definition ──────────────────────────────────────────────────────

export const Route = createFileRoute("/societies")({
  head: () => ({
    meta: [
      { title: "Societies — HousingOS Platform" },
      {
        name: "description",
        content: "Super Admin: manage all societies on the HousingOS platform.",
      },
    ],
  }),
  component: SocietiesPage,
});

// ── Types ─────────────────────────────────────────────────────────────────

interface Society {
  id: string;
  name: string;
  code: string | null;
  slug: string;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  plan: string;
  created_at: string;
  admin_name: string | null;
  admin_email: string | null;
  admin_user_id: string | null;
  resident_count: number;
  complaint_count: number;
  poll_count: number;
  event_count: number;
  visitor_count: number;
  booking_count: number;
  maintenance_count: number;
  user_count: number;
}

// ── Empty form state ──────────────────────────────────────────────────────

const emptyForm = {
  name: "",
  code: "",
  address: "",
  contact_email: "",
  contact_phone: "",
  admin_full_name: "",
  admin_email: "",
  admin_password: "",
};

// ── Main component ────────────────────────────────────────────────────────

function SocietiesPage() {
  const { roles, loading: authLoading } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");

  // Route guard: render denied screen while loading or if not super_admin
  if (authLoading) {
    return (
      <AppShell title="Societies" subtitle="Platform administration">
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!isSuperAdmin) {
    return (
      <AppShell title="Access Denied" subtitle="Societies">
        <div className="mx-auto max-w-md py-24 text-center space-y-4">
          <ShieldAlert className="size-14 mx-auto text-destructive" />
          <h2 className="text-xl font-bold font-serif">Unauthorized</h2>
          <p className="text-muted-foreground text-sm">
            Only <strong>Super Admins</strong> can manage societies. You do not have
            permission to access this page.
          </p>
        </div>
      </AppShell>
    );
  }

  return <SocietiesAdmin />;
}

// ── Admin view ────────────────────────────────────────────────────────────

function SocietiesAdmin() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailSocietyId, setDetailSocietyId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Pagination
  const SOCIETIES_PER_PAGE = 9;
  const [societyPage, setSocietyPage] = useState(1);

  // Assignment dialog states
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [assignedTenantIds, setAssignedTenantIds] = useState<string[]>([]);
  const [comboOpen, setComboOpen] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────

  // Fetch admins list
  const { data: adminsList = [] } = useQuery({
    queryKey: ["all-society-admins"],
    queryFn: () => listSocietyAdminsFn(),
    enabled: assignmentOpen,
  });

  // Fetch assignments when selectedAdminId changes
  useQuery({
    queryKey: ["admin-assignments", selectedAdminId],
    queryFn: async () => {
      if (!selectedAdminId) return [];
      const res = await getAdminAssignmentsFn({ data: { adminUserId: selectedAdminId } });
      setAssignedTenantIds(res);
      return res;
    },
    enabled: assignmentOpen && !!selectedAdminId,
  });

  const {
    data: societies = [],
    isLoading,
    error: listError,
    refetch,
  } = useQuery<Society[]>({
    queryKey: ["all-societies"],
    queryFn: () => listAllSocietiesFn(),
    retry: 1,
  });

  const totalPages = Math.max(1, Math.ceil(societies.length / SOCIETIES_PER_PAGE));
  const paginatedSocieties = societies.slice(
    (societyPage - 1) * SOCIETIES_PER_PAGE,
    societyPage * SOCIETIES_PER_PAGE
  );

  function getPageNumbers(current: number, total: number): (number | "…")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1];
    if (current > 3) pages.push("…");
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push("…");
    pages.push(total);
    return pages;
  }

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["society-detail", detailSocietyId],
    queryFn: () => getSocietyDetailFn({ data: { tenantId: detailSocietyId! } }),
    enabled: !!detailSocietyId,
  });

  // ── Mutations ──────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (d: typeof emptyForm) => createSocietyWithAdminFn({ data: d }),
    onSuccess: (res) => {
      setSuccessMsg(res.message ?? "Society created successfully.");
      setCreateOpen(false);
      setForm(emptyForm);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["all-societies"] });
    },
    onError: (err: any) => {
      const msg: string = err?.message ?? "Failed to create society.";
      // Strip leading "CONFLICT:" prefix used for user-friendly errors
      setFormError(msg.replace(/^(CONFLICT:|NOT_FOUND:)/, ""));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (d: { tenantId: string; is_active: boolean }) =>
      toggleSocietyStatusFn({ data: d }),
    onMutate: async ({ tenantId, is_active }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["all-societies"] });
      // Snapshot the current cache
      const previousSocieties = queryClient.getQueryData<Society[]>(["all-societies"]);
      // Optimistically flip the is_active in the local cache immediately
      queryClient.setQueryData<Society[]>(["all-societies"], (old) =>
        (old ?? []).map((s) =>
          s.id === tenantId ? { ...s, is_active } : s
        )
      );
      return { previousSocieties };
    },
    onError: (err: any, _vars, context) => {
      // Rollback to the previous state if the server call fails
      if (context?.previousSocieties) {
        queryClient.setQueryData(["all-societies"], context.previousSocieties);
      }
      toast.error(err?.message ?? "Failed to update status.");
    },
    onSettled: () => {
      // Always refetch to confirm the server's true state
      queryClient.invalidateQueries({ queryKey: ["all-societies"] });
      queryClient.invalidateQueries({ queryKey: ["all-societies-list"] });
    },
  });

  const saveAssignmentsMutation = useMutation({
    mutationFn: (d: { adminUserId: string; tenantIds: string[] }) =>
      saveAdminAssignmentsFn({ data: d }),
    onSuccess: () => {
      toast.success("Assignments updated successfully!");
      setAssignmentOpen(false);
      setSelectedAdminId("");
      setAssignedTenantIds([]);
      queryClient.invalidateQueries({ queryKey: ["all-societies"] });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to save assignments.");
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    // Basic client-side check (server also validates)
    if (!form.name.trim() || !form.code.trim() || !form.admin_full_name.trim() || !form.admin_email.trim() || !form.admin_password.trim()) {
      setFormError("Please fill in all required fields.");
      return;
    }
    createMutation.mutate(form);
  };

  const handleFieldChange = (field: keyof typeof emptyForm, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setFormError(null);
  };

  const handleToggleStatus = (society: Society) => {
    const action = society.is_active ? "deactivate" : "activate";
    if (!confirm(`Are you sure you want to ${action} "${society.name}"?`)) return;
    toggleMutation.mutate({ tenantId: society.id, is_active: !society.is_active });
  };

  const handleOpenSociety = (id: string) => {
    document.cookie = `selected_tenant_id=${id}; path=/; max-age=31536000; SameSite=Strict`;
    window.location.href = "/";
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <AppShell
      title="Societies"
      subtitle="Manage all societies on the platform"
      actions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedAdminId("");
              setAssignedTenantIds([]);
              setAssignmentOpen(true);
            }}
            className="gap-1 h-9"
          >
            <Users className="size-4" />
            Manage Assignments
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setForm(emptyForm);
              setFormError(null);
              setCreateOpen(true);
            }}
            className="gap-1 h-9 bg-primary text-primary-foreground hover:bg-primary/95"
          >
            <Plus className="size-4" />
            Create Society
          </Button>
        </div>
      }
    >
      {/* Success toast */}
      {successMsg && (
        <div className="mx-6 mt-4 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
          <span className="flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* Header stats (computed platform-wide aggregates) */}
        {(() => {
          const totalResidents = societies.reduce((acc, s) => acc + (s.resident_count || 0), 0);
          const totalUsers = societies.reduce((acc, s) => acc + (s.user_count || 0), 0);
          const totalComplaints = societies.reduce((acc, s) => acc + (s.complaint_count || 0), 0);
          const totalPolls = societies.reduce((acc, s) => acc + (s.poll_count || 0), 0);
          const totalEvents = societies.reduce((acc, s) => acc + (s.event_count || 0), 0);
          const totalVisitors = societies.reduce((acc, s) => acc + (s.visitor_count || 0), 0);
          const totalBookings = societies.reduce((acc, s) => acc + (s.booking_count || 0), 0);
          const totalMaintenance = societies.reduce((acc, s) => acc + (s.maintenance_count || 0), 0);

          return (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard
                label="Total Societies"
                value={societies.length}
                icon={<Building2 className="size-5 text-primary" />}
              />
              <StatCard
                label="Active Societies"
                value={societies.filter((s) => s.is_active).length}
                icon={<CheckCircle2 className="size-5 text-green-600" />}
              />
              <StatCard
                label="Total Users"
                value={totalUsers}
                icon={<Users className="size-5 text-sky-500" />}
              />
              <StatCard
                label="Total Residents"
                value={totalResidents}
                icon={<Users className="size-5 text-emerald-500" />}
              />
              <StatCard
                label="Total Complaints"
                value={totalComplaints}
                icon={<AlertTriangle className="size-5 text-amber-500" />}
              />
              <StatCard
                label="Total Polls"
                value={totalPolls}
                icon={<Vote className="size-5 text-indigo-500" />}
              />
              <StatCard
                label="Total Events"
                value={totalEvents}
                icon={<CalendarDays className="size-5 text-rose-500" />}
              />
              <StatCard
                label="Total Visitors"
                value={totalVisitors}
                icon={<DoorOpen className="size-5 text-teal-500" />}
              />
              <StatCard
                label="Total Bookings"
                value={totalBookings}
                icon={<Dumbbell className="size-5 text-violet-500" />}
              />
              <StatCard
                label="Total Maintenance"
                value={totalMaintenance}
                icon={<Wrench className="size-5 text-purple-500" />}
              />
            </div>
          );
        })()}

        {/* Section title & reload */}
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="font-serif text-lg font-bold">All Societies</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            aria-label="Refresh"
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : listError ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-destructive">
            <AlertTriangle className="size-6" />
            <p className="text-sm">Failed to load societies.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : societies.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Building2 className="size-8" />
            <p className="text-sm">No societies yet. Create the first one.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedSocieties.map((society) => (
                <Card key={society.id} className="overflow-hidden hover:shadow-md transition-shadow border-border/70 bg-card">
                  <CardContent className="p-5 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
                          {society.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm leading-tight">{society.name}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <code className="rounded bg-muted px-1.5 py-0.2 text-[9px] font-mono text-muted-foreground">
                              {society.code ?? "no-code"}
                            </code>
                            <span className="text-muted-foreground text-[9px]">·</span>
                            <span className="text-muted-foreground text-[9px] truncate max-w-[80px]">{society.slug}</span>
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={society.is_active ? "default" : "secondary"}
                        className={
                          society.is_active
                            ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border-green-200/50 hover:bg-green-50"
                            : "text-muted-foreground"
                        }
                      >
                        {society.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    {/* Admin info */}
                    <div className="rounded-md bg-muted/30 p-2.5 text-xs space-y-0.5 border border-border/40">
                      <div className="font-semibold text-muted-foreground text-[9px] uppercase tracking-wide">
                        Society Admin
                      </div>
                      {society.admin_name ? (
                        <>
                          <div className="font-medium text-foreground">{society.admin_name}</div>
                          <div className="text-muted-foreground text-[10px]">{society.admin_email}</div>
                        </>
                      ) : (
                        <div className="text-muted-foreground text-[10px] italic">No admin assigned</div>
                      )}
                    </div>

                    {/* Module Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded border bg-card/50 p-1.5">
                        <div className="font-bold text-foreground">{society.resident_count}</div>
                        <div className="text-[8px] text-muted-foreground uppercase tracking-wide">Residents</div>
                      </div>
                      <div className="rounded border bg-card/50 p-1.5">
                        <div className="font-bold text-foreground">{society.complaint_count}</div>
                        <div className="text-[8px] text-muted-foreground uppercase tracking-wide">Complaints</div>
                      </div>
                      <div className="rounded border bg-card/50 p-1.5">
                        <div className="font-bold text-foreground">{society.maintenance_count}</div>
                        <div className="text-[8px] text-muted-foreground uppercase tracking-wide">Maint. Jobs</div>
                      </div>
                      <div className="rounded border bg-card/50 p-1.5">
                        <div className="font-bold text-foreground">{society.poll_count}</div>
                        <div className="text-[8px] text-muted-foreground uppercase tracking-wide">Polls</div>
                      </div>
                      <div className="rounded border bg-card/50 p-1.5">
                        <div className="font-bold text-foreground">{society.event_count}</div>
                        <div className="text-[8px] text-muted-foreground uppercase tracking-wide">Events</div>
                      </div>
                      <div className="rounded border bg-card/50 p-1.5">
                        <div className="font-bold text-foreground">{society.visitor_count}</div>
                        <div className="text-[8px] text-muted-foreground uppercase tracking-wide">Visitors</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t text-xs">
                      <span className="text-muted-foreground text-[9px]">
                        Created {safeFormatDate(society.created_at)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="default"
                          size="sm"
                          className="h-8 px-2.5 text-[11px] gap-1 bg-primary text-primary-foreground hover:bg-primary/95"
                          onClick={() => handleOpenSociety(society.id)}
                        >
                          <Building2 className="size-3" />
                          Open Society
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-[11px]"
                          onClick={() => setDetailSocietyId(society.id)}
                          title="View Details Summary"
                        >
                          <Eye className="size-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-[11px]"
                          onClick={() => handleToggleStatus(society)}
                          disabled={toggleMutation.isPending}
                        >
                          {society.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4">
                <span className="text-xs text-muted-foreground">
                  Showing {paginatedSocieties.length} of {societies.length} societies &mdash; page {societyPage} of {totalPages}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSocietyPage((p) => Math.max(1, p - 1))}
                    disabled={societyPage === 1}
                    className="h-8 px-3 text-[11px]"
                  >
                    ← Prev
                  </Button>
                  {getPageNumbers(societyPage, totalPages).map((pg, idx) =>
                    pg === "…" ? (
                      <span key={`dots-${idx}`} className="px-2 text-muted-foreground text-xs select-none">
                        …
                      </span>
                    ) : (
                      <Button
                        key={`page-${pg}`}
                        variant={societyPage === pg ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSocietyPage(pg as number)}
                        className={cn(
                          "h-8 w-8 p-0 text-[11px]",
                          societyPage === pg
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        )}
                      >
                        {pg}
                      </Button>
                    )
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSocietyPage((p) => Math.min(totalPages, p + 1))}
                    disabled={societyPage === totalPages}
                    className="h-8 px-3 text-[11px]"
                  >
                    Next →
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Create Society Dialog ──────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Building2 className="size-5" />
              Create New Society
            </DialogTitle>
            <DialogDescription>
              A society admin account will be created and linked to this society. The admin can
              log in immediately using the credentials you provide.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitCreate} className="space-y-5 py-1">
            {/* Section 1: Society Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                Section 1 — Society Information
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="soc-name">
                    Society Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="soc-name"
                    placeholder="e.g. Palm Heights Society"
                    value={form.name}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="soc-code">
                    Society Code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="soc-code"
                    placeholder="e.g. PHS-001"
                    value={form.code}
                    onChange={(e) => handleFieldChange("code", e.target.value.toUpperCase())}
                    required
                    className="font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Alphanumeric, unique identifier for this society.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="soc-phone">Contact Phone</Label>
                  <Input
                    id="soc-phone"
                    placeholder="+92 300 1234567"
                    value={form.contact_phone}
                    onChange={(e) => handleFieldChange("contact_phone", e.target.value)}
                  />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="soc-email">Contact Email</Label>
                  <Input
                    id="soc-email"
                    type="email"
                    placeholder="info@society.com"
                    value={form.contact_email}
                    onChange={(e) => handleFieldChange("contact_email", e.target.value)}
                  />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="soc-address">Address</Label>
                  <Input
                    id="soc-address"
                    placeholder="Block A, Lahore, Pakistan"
                    value={form.address}
                    onChange={(e) => handleFieldChange("address", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Society Admin */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                Section 2 — Society Admin
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="admin-name">
                    Admin Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="admin-name"
                    placeholder="e.g. Ahmed Khan"
                    value={form.admin_full_name}
                    onChange={(e) => handleFieldChange("admin_full_name", e.target.value)}
                    required
                  />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="admin-email">
                    Admin Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@society.com"
                    value={form.admin_email}
                    onChange={(e) => handleFieldChange("admin_email", e.target.value)}
                    required
                  />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="admin-pass">
                    Temporary Password <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="admin-pass"
                    type="password"
                    placeholder="Min. 8 characters"
                    value={form.admin_password}
                    onChange={(e) => handleFieldChange("admin_password", e.target.value)}
                    required
                    minLength={8}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    The admin should change this password after first login.
                  </p>
                </div>
              </div>
            </div>

            {/* Error */}
            {formError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                {formError}
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="gap-2">
                {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Create Society
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Society Detail Dialog ──────────────────────────────────────── */}
      <Dialog open={!!detailSocietyId} onOpenChange={(o) => !o && setDetailSocietyId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Building2 className="size-5" />
              Society Details
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : detailData ? (
            <div className="space-y-4 text-sm">
              <DetailRow label="Name" value={detailData.name} />
              <DetailRow label="Code" value={detailData.code ?? "—"} mono />
              <DetailRow label="Slug" value={detailData.slug} mono />
              <DetailRow label="Address" value={detailData.address ?? "—"} />
              <DetailRow label="Contact Email" value={detailData.contact_email ?? "—"} />
              <DetailRow label="Contact Phone" value={detailData.contact_phone ?? "—"} />
              <DetailRow
                label="Status"
                value={
                  <Badge
                    variant={detailData.is_active ? "default" : "secondary"}
                    className={
                      detailData.is_active
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : ""
                    }
                  >
                    {detailData.is_active ? "Active" : "Inactive"}
                  </Badge>
                }
              />
              <DetailRow label="Plan" value={detailData.plan} />
              <DetailRow label="Total Units" value={String(detailData.unit_count)} />
              <DetailRow label="Total Residents" value={String(detailData.resident_count)} />
              <DetailRow label="Complaints Filed" value={String(detailData.complaint_count ?? 0)} />
              <DetailRow label="Active Polls" value={String(detailData.poll_count ?? 0)} />
              <DetailRow label="Scheduled Events" value={String(detailData.event_count ?? 0)} />
              <DetailRow label="Visitor Passes Issued" value={String(detailData.visitor_count ?? 0)} />
              <DetailRow label="Amenity Bookings" value={String(detailData.booking_count ?? 0)} />
              <DetailRow label="Maintenance Jobs" value={String(detailData.maintenance_count ?? 0)} />
              {detailData.admin && (
                <>
                  <div className="border-t pt-3 font-semibold text-muted-foreground text-xs uppercase tracking-widest">
                    Society Admin
                  </div>
                  <DetailRow label="Name" value={detailData.admin.full_name ?? "—"} />
                  <DetailRow label="Email" value={detailData.admin.email} />
                  <DetailRow label="Phone" value={detailData.admin.phone ?? "—"} />
                </>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailSocietyId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Manage Assignments Dialog ───────────────────────────────────── */}
      <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Users className="size-5" />
              Manage Admin Assignments
            </DialogTitle>
            <DialogDescription>
              Assign a Society Admin to one or multiple societies on the platform.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5 flex flex-col">
              <Label htmlFor="admin-select">Select Society Admin</Label>
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="admin-select"
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    className="w-full h-10 justify-between font-normal text-left text-sm border border-input bg-background hover:bg-accent hover:text-accent-foreground px-3 py-2"
                  >
                    {selectedAdminId
                      ? (() => {
                          const admin = adminsList.find((a: any) => a.id === selectedAdminId);
                          return admin
                            ? `${admin.full_name || admin.email} (${admin.email})`
                            : "-- Choose Admin --";
                        })()
                      : "-- Choose Admin --"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search admin..." />
                    <CommandList>
                      <CommandEmpty>No admin found.</CommandEmpty>
                      <CommandGroup>
                        {adminsList.map((a: any) => (
                          <CommandItem
                            key={a.id}
                            value={`${a.full_name || ""} ${a.email}`}
                            onSelect={() => {
                              setSelectedAdminId(a.id);
                              setComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                selectedAdminId === a.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="truncate">
                              {a.full_name || a.email} <span className="text-muted-foreground text-xs">({a.email})</span>
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {selectedAdminId && (
              <div className="space-y-2">
                <Label>Assigned Societies</Label>
                <div className="rounded-md border p-3 space-y-2.5 max-h-60 overflow-y-auto">
                  {societies.map((s: any) => {
                    const isChecked = assignedTenantIds.includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAssignedTenantIds((prev) => [...prev, s.id]);
                            } else {
                              setAssignedTenantIds((prev) => prev.filter((id) => id !== s.id));
                            }
                          }}
                          className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span>
                          {s.name} <span className="text-muted-foreground font-mono text-[10px]">({s.code})</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAssignmentOpen(false);
                setSelectedAdminId("");
                setAssignedTenantIds([]);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!selectedAdminId || saveAssignmentsMutation.isPending}
              onClick={() => {
                saveAssignmentsMutation.mutate({
                  adminUserId: selectedAdminId,
                  tenantIds: assignedTenantIds,
                });
              }}
            >
              {saveAssignmentsMutation.isPending && (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              )}
              Save Assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// ── Small helper components ───────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        {icon}
        <div>
          <div className="text-2xl font-bold font-serif">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      {typeof value === "string" ? (
        <span className={`text-right font-medium ${mono ? "font-mono text-xs" : ""}`}>
          {value}
        </span>
      ) : (
        value
      )}
    </div>
  );
}
