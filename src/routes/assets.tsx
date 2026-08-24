import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Package,
  Plus,
  Search,
  RefreshCw,
  ShieldAlert,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Filter,
  Sliders,
  Calendar,
  MapPin,
  Hash,
  FileEdit,
  Settings2,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  getAssetsOverviewFn,
  createAssetFn,
  updateAssetStatusFn,
  updateAssetAmcFn,
  type AssetItem,
} from "@/lib/api/assets";

export const Route = createFileRoute("/assets")({
  head: () => ({
    meta: [
      { title: "Asset Register — HousingOS" },
      { name: "description", content: "Track society assets, equipment, warranty and AMC contracts." },
    ],
  }),
  component: AssetsRoute,
});

function AssetsRoute() {
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
      <AppShell title="Access Denied" subtitle="Assets">
        <div className="mx-auto max-w-md py-16 text-center space-y-4">
          <ShieldAlert className="size-12 mx-auto text-destructive" />
          <h2 className="text-lg font-bold font-serif">Authentication Required</h2>
          <p className="text-sm text-muted-foreground">Please log in to view the asset register.</p>
        </div>
      </AppShell>
    );
  }
  return (
    <ModuleGate moduleKey="assets">
      <AssetsPage />
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
              <div className="mt-2 h-7 w-24 animate-pulse rounded-md bg-muted" />
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

const CATEGORIES = [
  { value: "electrical", label: "Electrical" },
  { value: "plumbing", label: "Plumbing" },
  { value: "elevator", label: "Elevator" },
  { value: "generator", label: "Generator" },
  { value: "security_cctv", label: "Security / CCTV" },
  { value: "fire_safety", label: "Fire Safety" },
  { value: "gym_recreation", label: "Gym & Recreation" },
  { value: "general", label: "General" },
];

function AmcBadge({ asset }: { asset: AssetItem }) {
  if (!asset.hasAmc) {
    return <Badge variant="outline" className="text-[10px] text-muted-foreground">No AMC</Badge>;
  }
  if (asset.isAmcExpired) {
    return <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-600 border-transparent">AMC Expired</Badge>;
  }
  if (asset.isAmcExpiringSoon) {
    return <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-transparent">Expiring Soon</Badge>;
  }
  return <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-transparent">AMC Active</Badge>;
}

function StatusBadge({ status }: { status: AssetItem["status"] }) {
  const map = {
    active: "bg-emerald-500/10 text-emerald-600",
    under_maintenance: "bg-amber-500/10 text-amber-600",
    decommissioned: "bg-slate-500/10 text-slate-500",
    scrapped: "bg-rose-500/10 text-rose-600",
  } as const;
  const labels = {
    active: "Active",
    under_maintenance: "Under Maintenance",
    decommissioned: "Decommissioned",
    scrapped: "Scrapped",
  };
  return (
    <Badge variant="outline" className={`text-[10px] border-transparent ${map[status]}`}>
      {labels[status]}
    </Badge>
  );
}

function AssetsPage() {
  const { roles } = useAuth();
  const canManage = roles.some((r) =>
    ["super_admin", "society_admin", "maintenance_head", "treasurer", "committee_member"].includes(r),
  );

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [amcFilter, setAmcFilter] = useState("all");

  // Register Asset modal
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCategory, setAddCategory] = useState("general");
  const [addLocation, setAddLocation] = useState("");
  const [addSerial, setAddSerial] = useState("");
  const [addPurchaseDate, setAddPurchaseDate] = useState("");
  const [addPurchaseCost, setAddPurchaseCost] = useState("");
  const [addCurrentVal, setAddCurrentVal] = useState("");
  const [addWarrantyExpiry, setAddWarrantyExpiry] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addHasAmc, setAddHasAmc] = useState(false);
  const [addAmcVendorId, setAddAmcVendorId] = useState("");
  const [addAmcCost, setAddAmcCost] = useState("");
  const [addAmcStartDate, setAddAmcStartDate] = useState("");
  const [addAmcExpiresAt, setAddAmcExpiresAt] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAddSubmitting, setIsAddSubmitting] = useState(false);

  // Change Status modal
  const [statusAsset, setStatusAsset] = useState<AssetItem | null>(null);
  const [newStatus, setNewStatus] = useState<AssetItem["status"]>("active");
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Manage AMC modal
  const [amcAsset, setAmcAsset] = useState<AssetItem | null>(null);
  const [amcEnabled, setAmcEnabled] = useState(false);
  const [amcVendorId, setAmcVendorId] = useState("");
  const [amcCost, setAmcCost] = useState("");
  const [amcStartDate, setAmcStartDate] = useState("");
  const [amcExpiresAt, setAmcExpiresAt] = useState("");
  const [isAmcSubmitting, setIsAmcSubmitting] = useState(false);
  const [amcError, setAmcError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["assets-overview", search, categoryFilter, statusFilter, amcFilter],
    queryFn: () =>
      getAssetsOverviewFn({ data: { search, category: categoryFilter, status: statusFilter, amcStatus: amcFilter } }),
    staleTime: 15_000,
  });

  const handleRegisterAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!addName.trim()) return setAddError("Asset name is required");
    setIsAddSubmitting(true);
    try {
      await createAssetFn({
        data: {
          name: addName.trim(),
          category: addCategory,
          location: addLocation || undefined,
          serialNumber: addSerial || undefined,
          purchaseDate: addPurchaseDate || undefined,
          purchaseCost: addPurchaseCost ? Number(addPurchaseCost) : 0,
          currentValuation: addCurrentVal ? Number(addCurrentVal) : undefined,
          warrantyExpiresAt: addWarrantyExpiry || undefined,
          hasAmc: addHasAmc,
          amcVendorId: addHasAmc && addAmcVendorId ? addAmcVendorId : undefined,
          amcCost: addHasAmc && addAmcCost ? Number(addAmcCost) : undefined,
          amcStartDate: addHasAmc && addAmcStartDate ? addAmcStartDate : undefined,
          amcExpiresAt: addHasAmc && addAmcExpiresAt ? addAmcExpiresAt : undefined,
          notes: addNotes || undefined,
        },
      });
      setAddOpen(false);
      setAddName(""); setAddCategory("general"); setAddLocation(""); setAddSerial("");
      setAddPurchaseDate(""); setAddPurchaseCost(""); setAddCurrentVal(""); setAddWarrantyExpiry("");
      setAddNotes(""); setAddHasAmc(false); setAddAmcVendorId(""); setAddAmcCost("");
      setAddAmcStartDate(""); setAddAmcExpiresAt("");
      refetch();
    } catch (err: any) {
      setAddError(err.message || "Failed to register asset");
    } finally {
      setIsAddSubmitting(false);
    }
  };

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusAsset) return;
    setStatusError(null);
    setIsStatusSubmitting(true);
    try {
      await updateAssetStatusFn({ data: { assetId: statusAsset.id, status: newStatus } });
      setStatusAsset(null);
      refetch();
    } catch (err: any) {
      setStatusError(err.message || "Failed to update status");
    } finally {
      setIsStatusSubmitting(false);
    }
  };

  const handleAmcUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amcAsset) return;
    setAmcError(null);
    setIsAmcSubmitting(true);
    try {
      await updateAssetAmcFn({
        data: {
          assetId: amcAsset.id,
          hasAmc: amcEnabled,
          amcVendorId: amcEnabled && amcVendorId ? amcVendorId : undefined,
          amcCost: amcEnabled && amcCost ? Number(amcCost) : undefined,
          amcStartDate: amcEnabled && amcStartDate ? amcStartDate : undefined,
          amcExpiresAt: amcEnabled && amcExpiresAt ? amcExpiresAt : undefined,
        },
      });
      setAmcAsset(null);
      refetch();
    } catch (err: any) {
      setAmcError(err.message || "Failed to update AMC");
    } finally {
      setIsAmcSubmitting(false);
    }
  };

  const openAmcModal = (asset: AssetItem) => {
    setAmcAsset(asset);
    setAmcEnabled(asset.hasAmc);
    setAmcVendorId(asset.amcVendorId ?? "");
    setAmcCost(asset.amcCost ? String(asset.amcCost) : "");
    setAmcStartDate(asset.amcStartDate ?? "");
    setAmcExpiresAt(asset.amcExpiresAt ?? "");
    setAmcError(null);
  };

  const openStatusModal = (asset: AssetItem) => {
    setStatusAsset(asset);
    setNewStatus(asset.status);
    setStatusError(null);
  };

  const summary = data?.summary;
  const assets = data?.assets ?? [];
  const vendors = data?.vendorsList ?? [];

  return (
    <AppShell
      title="Asset Register"
      subtitle="Equipment, warranty tracking and AMC contract management"
      actions={
        <div className="flex items-center gap-2">
          {canManage && (
            <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" /> Register Asset
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
            <Package className="size-5 text-primary" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Operations · Equipment
            </div>
            <h1 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
              Society Asset Register
            </h1>
          </div>
        </header>

        {/* Error banner */}
        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-4 shrink-0" />
              <p className="text-sm font-medium">
                {error instanceof Error ? error.message : "Failed to load assets"}
              </p>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="Total Assets" value={String(summary?.totalAssets ?? 0)} icon={Package} loading={isLoading} />
          <KpiCard label="Active Equipment" value={String(summary?.activeAssets ?? 0)} icon={CheckCircle2} tone="success" loading={isLoading} />
          <KpiCard label="Under Maintenance" value={String(summary?.underMaintenanceAssets ?? 0)} icon={Wrench} tone={(summary?.underMaintenanceAssets ?? 0) > 0 ? "warning" : "default"} loading={isLoading} />
          <KpiCard label="AMC Expiring (60d)" value={String(summary?.amcExpiringSoon ?? 0)} icon={AlertTriangle} tone={(summary?.amcExpiringSoon ?? 0) > 0 ? "destructive" : "default"} loading={isLoading} />
          <KpiCard label="Total Valuation" value={formatCurrency(summary?.totalValuation ?? 0)} icon={DollarSign} tone="info" loading={isLoading} />
        </section>

        {/* Filters */}
        <Card className="border-border/70 shadow-soft p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search asset name, serial, location..."
                className="h-9 pl-9 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-44 text-xs">
                <Filter className="mr-1.5 size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-40 text-xs">
                <Sliders className="mr-1.5 size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                <SelectItem value="active" className="text-xs">Active</SelectItem>
                <SelectItem value="under_maintenance" className="text-xs">Under Maintenance</SelectItem>
                <SelectItem value="decommissioned" className="text-xs">Decommissioned</SelectItem>
                <SelectItem value="scrapped" className="text-xs">Scrapped</SelectItem>
              </SelectContent>
            </Select>

            <Select value={amcFilter} onValueChange={setAmcFilter}>
              <SelectTrigger className="h-9 w-40 text-xs">
                <Settings2 className="mr-1.5 size-3.5 text-muted-foreground" />
                <SelectValue placeholder="AMC Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All AMC</SelectItem>
                <SelectItem value="active" className="text-xs">AMC Active</SelectItem>
                <SelectItem value="expiring_soon" className="text-xs">Expiring Soon</SelectItem>
                <SelectItem value="expired" className="text-xs">Expired</SelectItem>
                <SelectItem value="no_amc" className="text-xs">No AMC</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Assets Grid */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : !assets.length ? (
          <Card className="border-border/70 border-dashed p-12 text-center text-muted-foreground">
            <Package className="size-10 mx-auto opacity-30 mb-2" />
            <p className="text-sm font-medium">No assets found</p>
            {canManage && (
              <p className="text-[11px] opacity-60 mt-1">Click "Register Asset" to add the first equipment item.</p>
            )}
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => (
              <Card key={asset.id} className="border-border/70 shadow-soft hover:border-border transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="grid size-8 shrink-0 place-items-center rounded bg-primary/10">
                        <Package className="size-4 text-primary" />
                      </div>
                      <CardTitle className="font-serif text-sm font-bold leading-tight truncate">
                        {asset.name}
                      </CardTitle>
                    </div>
                    <StatusBadge status={asset.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-xs pt-0">
                  {/* Category + AMC row */}
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-[10px]">
                      {CATEGORIES.find((c) => c.value === asset.category)?.label ?? asset.category}
                    </Badge>
                    <AmcBadge asset={asset} />
                  </div>

                  {/* Meta info */}
                  <div className="space-y-1.5 text-[11px] text-muted-foreground">
                    {asset.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">{asset.location}</span>
                      </div>
                    )}
                    {asset.serialNumber && (
                      <div className="flex items-center gap-1.5">
                        <Hash className="size-3.5 shrink-0" />
                        <span className="font-mono">{asset.serialNumber}</span>
                      </div>
                    )}
                    {asset.warrantyExpiresAt && (
                      <div className={`flex items-center gap-1.5 ${asset.isWarrantyExpired ? "text-rose-600" : ""}`}>
                        <Calendar className="size-3.5 shrink-0" />
                        <span>Warranty: {asset.warrantyExpiresAt} {asset.isWarrantyExpired ? "(Expired)" : ""}</span>
                      </div>
                    )}
                  </div>

                  {/* Financial */}
                  <div className="rounded-md bg-muted/40 px-3 py-2 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Purchase Cost</span>
                      <span className="font-medium">{formatCurrency(asset.purchaseCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Value</span>
                      <span className="font-bold">{formatCurrency(asset.currentValuation)}</span>
                    </div>
                    {asset.hasAmc && asset.amcVendorName && (
                      <div className="flex justify-between border-t border-border/40 pt-1">
                        <span className="text-muted-foreground">AMC Vendor</span>
                        <span className="truncate max-w-[120px] text-right">{asset.amcVendorName}</span>
                      </div>
                    )}
                    {asset.hasAmc && asset.amcCost > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">AMC Cost/yr</span>
                        <span>{formatCurrency(asset.amcCost)}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {canManage && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] flex-1 gap-1"
                        onClick={() => openStatusModal(asset)}
                      >
                        <FileEdit className="size-3" /> Status
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] flex-1 gap-1"
                        onClick={() => openAmcModal(asset)}
                      >
                        <Settings2 className="size-3" /> Manage AMC
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Register Asset Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Register Society Asset</DialogTitle>
            <DialogDescription className="text-xs">Add equipment to the asset register with warranty and AMC details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegisterAsset} className="space-y-4">
            {addError && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{addError}</div>}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Asset Name *</Label>
                <Input placeholder="e.g. Generator Unit 1, Elevator Motor" className="h-9 text-xs" value={addName} onChange={(e) => setAddName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={addCategory} onValueChange={setAddCategory}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Location</Label>
                <Input placeholder="e.g. Basement, Rooftop" className="h-9 text-xs" value={addLocation} onChange={(e) => setAddLocation(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Serial Number</Label>
                <Input placeholder="Manufacturer serial" className="h-9 text-xs font-mono" value={addSerial} onChange={(e) => setAddSerial(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Purchase Date</Label>
                <Input type="date" className="h-9 text-xs" value={addPurchaseDate} onChange={(e) => setAddPurchaseDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Purchase Cost (₹)</Label>
                <Input type="number" step="0.01" className="h-9 text-xs font-mono" value={addPurchaseCost} onChange={(e) => setAddPurchaseCost(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Current Valuation (₹)</Label>
                <Input type="number" step="0.01" className="h-9 text-xs font-mono" value={addCurrentVal} onChange={(e) => setAddCurrentVal(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Warranty Expiry Date</Label>
              <Input type="date" className="h-9 text-xs" value={addWarrantyExpiry} onChange={(e) => setAddWarrantyExpiry(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Input placeholder="Optional notes about this asset" className="h-9 text-xs" value={addNotes} onChange={(e) => setAddNotes(e.target.value)} />
            </div>

            {/* AMC Section */}
            <div className="rounded-lg border border-border/60 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="addHasAmc"
                  checked={addHasAmc}
                  onChange={(e) => setAddHasAmc(e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="addHasAmc" className="text-sm font-semibold">Annual Maintenance Contract (AMC)</label>
              </div>
              {addHasAmc && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">AMC Vendor</Label>
                    <Select value={addAmcVendorId} onValueChange={setAddAmcVendorId}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                      <SelectContent>
                        {vendors.map((v) => <SelectItem key={v.id} value={v.id} className="text-xs">{v.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Annual AMC Cost (₹)</Label>
                    <Input type="number" step="0.01" className="h-9 text-xs font-mono" value={addAmcCost} onChange={(e) => setAddAmcCost(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">AMC Start Date</Label>
                    <Input type="date" className="h-9 text-xs" value={addAmcStartDate} onChange={(e) => setAddAmcStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">AMC Expiry Date</Label>
                    <Input type="date" className="h-9 text-xs" value={addAmcExpiresAt} onChange={(e) => setAddAmcExpiresAt(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(false)} disabled={isAddSubmitting}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isAddSubmitting}>{isAddSubmitting ? "Registering..." : "Register Asset"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Status Dialog */}
      <Dialog open={!!statusAsset} onOpenChange={(o) => !o && setStatusAsset(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Change Equipment Status</DialogTitle>
            <DialogDescription className="text-xs">Asset: <span className="font-semibold">{statusAsset?.name}</span></DialogDescription>
          </DialogHeader>
          <form onSubmit={handleStatusUpdate} className="space-y-4">
            {statusError && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{statusError}</div>}
            <div className="space-y-1.5">
              <Label className="text-xs">New Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as AssetItem["status"])}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active" className="text-xs">✅ Active</SelectItem>
                  <SelectItem value="under_maintenance" className="text-xs">🔧 Under Maintenance</SelectItem>
                  <SelectItem value="decommissioned" className="text-xs">📦 Decommissioned</SelectItem>
                  <SelectItem value="scrapped" className="text-xs">🗑️ Scrapped</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setStatusAsset(null)} disabled={isStatusSubmitting}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isStatusSubmitting}>{isStatusSubmitting ? "Updating..." : "Update Status"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage AMC Dialog */}
      <Dialog open={!!amcAsset} onOpenChange={(o) => !o && setAmcAsset(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Manage AMC Contract</DialogTitle>
            <DialogDescription className="text-xs">Asset: <span className="font-semibold">{amcAsset?.name}</span></DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAmcUpdate} className="space-y-3">
            {amcError && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{amcError}</div>}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="amcEnabled"
                checked={amcEnabled}
                onChange={(e) => setAmcEnabled(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="amcEnabled" className="text-sm font-semibold">AMC Contract Active</label>
            </div>
            {amcEnabled && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">AMC Vendor</Label>
                  <Select value={amcVendorId} onValueChange={setAmcVendorId}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                    <SelectContent>
                      {vendors.map((v) => <SelectItem key={v.id} value={v.id} className="text-xs">{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Annual AMC Cost (₹)</Label>
                  <Input type="number" step="0.01" className="h-9 text-xs font-mono" value={amcCost} onChange={(e) => setAmcCost(e.target.value)} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">AMC Start Date</Label>
                    <Input type="date" className="h-9 text-xs" value={amcStartDate} onChange={(e) => setAmcStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">AMC Expiry Date</Label>
                    <Input type="date" className="h-9 text-xs" value={amcExpiresAt} onChange={(e) => setAmcExpiresAt(e.target.value)} />
                  </div>
                </div>
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setAmcAsset(null)} disabled={isAmcSubmitting}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isAmcSubmitting}>{isAmcSubmitting ? "Saving..." : "Save AMC"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
