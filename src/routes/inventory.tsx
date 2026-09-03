import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import {
  Boxes,
  Plus,
  Search,
  RefreshCw,
  ShieldAlert,
  Package,
  AlertTriangle,
  TrendingDown,
  DollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
  Filter,
  RotateCcw,
  Sliders,
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
  getInventoryOverviewFn,
  addInventoryItemFn,
  recordStockMovementFn,
  type InventoryItem,
} from "@/lib/api/inventory";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — HousingOS" },
      { name: "description", content: "Spare parts and stock management for society operations." },
    ],
  }),
  component: InventoryRoute,
});

function InventoryRoute() {
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
      <AppShell title="Access Denied" subtitle="Inventory">
        <div className="mx-auto max-w-md py-16 text-center space-y-4">
          <ShieldAlert className="size-12 mx-auto text-destructive" />
          <h2 className="text-lg font-bold font-serif">Authentication Required</h2>
          <p className="text-sm text-muted-foreground">Please log in to manage inventory.</p>
        </div>
      </AppShell>
    );
  }
  return (
    <ModuleGate moduleKey="inventory">
      <InventoryPage />
    </ModuleGate>
  );
}

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
    default: "text-primary bg-primary/10 border-primary/20",
    success: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
    destructive: "text-rose-600 bg-rose-500/10 border-rose-500/20",
    warning: "text-amber-600 bg-amber-500/10 border-amber-500/20",
    info: "text-sky-600 bg-sky-500/10 border-sky-500/20",
  }[tone];

  return (
    <Card className="border-border/70 shadow-sm hover:shadow-md transition-shadow bg-card overflow-hidden">
      <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground truncate" title={label}>{label}</p>
          {loading ? (
            <div className="mt-1 h-7 w-24 animate-pulse rounded-md bg-muted" />
          ) : (
            <p className="font-serif text-lg sm:text-xl lg:text-[1.35rem] font-bold tracking-tight text-foreground truncate" title={value}>
              {value}
            </p>
          )}
        </div>
        <div className={cn("grid size-10 sm:size-11 place-items-center rounded-xl border shrink-0", toneClass)}>
          <Icon className="size-4 sm:size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function formatCurrency(v: number) {
  return "₨" + Math.round(v).toLocaleString("en-PK");
}

function InventoryPage() {
  const { roles } = useAuth();
  const isAdmin = roles.some((r) => ["super_admin", "society_admin", "maintenance_head"].includes(r));

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Pagination state
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, categoryFilter]);

  // Add Item modal state
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addSku, setAddSku] = useState("");
  const [addCategory, setAddCategory] = useState("");
  const [addUom, setAddUom] = useState("pcs");
  const [addReorder, setAddReorder] = useState("10");
  const [addCost, setAddCost] = useState("");
  const [addLocation, setAddLocation] = useState("");
  const [addOpening, setAddOpening] = useState("0");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAddSubmitting, setIsAddSubmitting] = useState(false);

  // Stock Movement modal state
  const [movItem, setMovItem] = useState<InventoryItem | null>(null);
  const [movType, setMovType] = useState<"in" | "out" | "adjustment" | "return">("in");
  const [movQty, setMovQty] = useState("");
  const [movRef, setMovRef] = useState("");
  const [movNotes, setMovNotes] = useState("");
  const [movError, setMovError] = useState<string | null>(null);
  const [isMovSubmitting, setIsMovSubmitting] = useState(false);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["inventory", statusFilter, categoryFilter, search],
    queryFn: () =>
      getInventoryOverviewFn({ data: { category: categoryFilter, status: statusFilter, search } }),
    staleTime: 15_000,
  });

  // Derive unique categories from the loaded items
  const categories = Array.from(
    new Set((data?.items ?? []).map((i) => i.category)),
  ).sort();

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!addName.trim()) return setAddError("Name is required");
    if (!addSku.trim()) return setAddError("SKU is required");

    setIsAddSubmitting(true);
    try {
      await addInventoryItemFn({
        data: {
          name: addName.trim(),
          sku: addSku.trim(),
          category: addCategory || "General",
          unitOfMeasure: addUom || "pcs",
          reorderLevel: Number(addReorder) || 10,
          unitCost: Number(addCost) || 0,
          location: addLocation || undefined,
          openingStock: Number(addOpening) || 0,
        },
      });
      setAddOpen(false);
      setAddName(""); setAddSku(""); setAddCategory(""); setAddUom("pcs");
      setAddReorder("10"); setAddCost(""); setAddLocation(""); setAddOpening("0");
      refetch();
    } catch (err: any) {
      setAddError(err.message || "Failed to add item");
    } finally {
      setIsAddSubmitting(false);
    }
  };

  const handleMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movItem) return;
    setMovError(null);
    const qty = Number(movQty);
    if (isNaN(qty) || qty <= 0) return setMovError("Quantity must be greater than 0");

    setIsMovSubmitting(true);
    try {
      await recordStockMovementFn({
        data: {
          itemId: movItem.id,
          movementType: movType,
          quantity: qty,
          reference: movRef || undefined,
          notes: movNotes || undefined,
        },
      });
      setMovItem(null);
      setMovQty(""); setMovRef(""); setMovNotes("");
      refetch();
    } catch (err: any) {
      setMovError(err.message || "Failed to record movement");
    } finally {
      setIsMovSubmitting(false);
    }
  };

  const summary = data?.summary;
  const items = data?.items ?? [];
  const movements = data?.movements ?? [];

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  }, [items, page, itemsPerPage]);

  return (
    <AppShell
      title="Inventory"
      subtitle="Spare parts, materials, and stock management"
    >
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        {/* Page Header & Action Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Boxes className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
                  Spare Parts & Inventory
                </h1>
                <Badge variant="secondary" className="font-mono text-xs font-normal">
                  {items.length} items
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Spare parts, materials, and stock management for society operations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs bg-background"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={cn("size-3.5", isRefetching && "animate-spin")} />
              <span>Refresh</span>
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                className="gap-1.5 h-9 text-xs bg-primary text-primary-foreground hover:bg-primary/95 shadow-sm"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="size-4" />
                <span>Add Item</span>
              </Button>
            )}
          </div>
        </div>

        {/* Error banner */}
        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-4 shrink-0" />
              <p className="text-sm font-medium">
                {error instanceof Error ? error.message : "Failed to load inventory"}
              </p>
            </div>
          </div>
        )}

        {/* KPI cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="Total Items" value={String(summary?.totalItems ?? 0)} icon={Package} loading={isLoading} />
          <KpiCard label="Total Units in Stock" value={String(summary?.totalUnits ?? 0)} icon={Boxes} tone="info" loading={isLoading} />
          <KpiCard label="Low Stock Items" value={String(summary?.lowStockCount ?? 0)} icon={AlertTriangle} tone={(summary?.lowStockCount ?? 0) > 0 ? "warning" : "default"} loading={isLoading} />
          <KpiCard label="Out of Stock" value={String(summary?.outOfStockCount ?? 0)} icon={TrendingDown} tone={(summary?.outOfStockCount ?? 0) > 0 ? "destructive" : "default"} loading={isLoading} />
          <KpiCard label="Total Stock Value" value={formatCurrency(summary?.totalStockValue ?? 0)} icon={DollarSign} tone="success" loading={isLoading} />
        </section>

        {/* Filters */}
        <Card className="border-border/70 shadow-sm p-4 bg-card">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, SKU, location..."
                className="h-9 pl-9 text-xs bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-40 text-xs bg-background">
                <Filter className="mr-1.5 size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-40 text-xs bg-background">
                <Sliders className="mr-1.5 size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                <SelectItem value="in_stock" className="text-xs">In Stock</SelectItem>
                <SelectItem value="low_stock" className="text-xs">Low Stock</SelectItem>
                <SelectItem value="out_of_stock" className="text-xs">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Items Table */}
        <Card className="border-border/70 shadow-sm bg-card overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b bg-muted/15">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-serif text-base font-bold">Stock Items</CardTitle>
                <CardDescription className="text-xs">Current stock levels, costs and reorder thresholds</CardDescription>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                {items.length} Total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : !items.length ? (
              <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                <Package className="size-8 opacity-40 mb-2" />
                <p className="text-sm font-medium">No inventory items found</p>
                {isAdmin && (
                  <p className="text-xs text-muted-foreground">Click "Add Item" to create your first inventory item</p>
                )}
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 uppercase tracking-wider text-muted-foreground font-semibold">
                      <tr>
                        <th className="px-4 py-3">Item / SKU</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3 text-right">Qty</th>
                        <th className="px-4 py-3 text-right">Reorder At</th>
                        <th className="px-4 py-3 text-right">Unit Cost</th>
                        <th className="px-4 py-3 text-right">Stock Value</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">Status</th>
                        {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {paginatedItems.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium">{item.name}</div>
                            <div className="text-[10px] font-mono text-muted-foreground">{item.sku}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{item.category}</td>
                          <td className="px-4 py-3 text-right font-bold">
                            {item.quantity} {item.unitOfMeasure}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{item.reorderLevel}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(item.unitCost)}</td>
                          <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.stockValue)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{item.location ?? "—"}</td>
                          <td className="px-4 py-3">
                            {item.status === "in_stock" && (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-transparent">In Stock</Badge>
                            )}
                            {item.status === "low_stock" && (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-transparent">Low Stock</Badge>
                            )}
                            {item.status === "out_of_stock" && (
                              <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-transparent">Out of Stock</Badge>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] gap-1 bg-background shadow-xs hover:bg-muted"
                                onClick={() => { setMovItem(item); setMovType("in"); }}
                              >
                                <Sliders className="size-3" /> Stock Move
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t p-4 bg-muted/10">
                    <span className="text-xs text-muted-foreground">
                      Showing {(page - 1) * itemsPerPage + 1} &ndash;{" "}
                      {Math.min(page * itemsPerPage, items.length)} of {items.length} items
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="h-8 px-2.5 text-xs bg-background"
                      >
                        &larr; Prev
                      </Button>
                      {getPageNumbers(page, totalPages).map((pg, idx) =>
                        pg === "…" ? (
                          <span key={`dots-${idx}`} className="px-2 text-muted-foreground text-xs select-none">
                            …
                          </span>
                        ) : (
                          <Button
                            key={`page-${pg}`}
                            variant={page === pg ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPage(pg as number)}
                            className={cn(
                              "h-8 w-8 p-0 text-xs",
                              page === pg
                                ? "bg-primary text-primary-foreground font-semibold"
                                : "bg-background hover:bg-muted"
                            )}
                          >
                            {pg}
                          </Button>
                        )
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="h-8 px-2.5 text-xs bg-background"
                      >
                        Next &rarr;
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Movements */}
        <Card className="border-border/70 shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base font-bold">Recent Stock Movements</CardTitle>
            <CardDescription className="text-[11px]">Last 20 stock in/out/adjustment records</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : !movements.length ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <RotateCcw className="size-8 opacity-40 mb-2" />
                <p className="text-sm">No stock movements recorded yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3 text-right">Quantity</th>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">Notes</th>
                      <th className="px-4 py-3">Date / Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {movements.map((m) => (
                      <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          {m.movementType === "in" || m.movementType === "return" ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-transparent gap-1">
                              <ArrowDownCircle className="size-3" />
                              {m.movementType === "return" ? "Return" : "Stock In"}
                            </Badge>
                          ) : m.movementType === "out" ? (
                            <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-transparent gap-1">
                              <ArrowUpCircle className="size-3" />
                              Stock Out
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-transparent">
                              Adjustment
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">{m.itemName}</td>
                        <td className="px-4 py-3 text-right font-bold">
                          {m.movementType === "out" ? "-" : "+"}{m.quantity}
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{m.reference ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{m.notes ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {m.createdAt ? new Date(m.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Item Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Add Inventory Item</DialogTitle>
            <DialogDescription className="text-xs">Register a new spare part or material in the inventory.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddItem} className="space-y-3">
            {addError && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{addError}</div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Item Name *</Label>
                <Input placeholder="e.g. LED Bulb 15W" className="h-9 text-xs" value={addName} onChange={(e) => setAddName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">SKU *</Label>
                <Input placeholder="e.g. BULB-15W-LED" className="h-9 text-xs font-mono" value={addSku} onChange={(e) => setAddSku(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Input placeholder="e.g. Electrical" className="h-9 text-xs" value={addCategory} onChange={(e) => setAddCategory(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unit of Measure</Label>
                <Input placeholder="pcs / kg / ltr" className="h-9 text-xs" value={addUom} onChange={(e) => setAddUom(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Reorder Level</Label>
                <Input type="number" className="h-9 text-xs" value={addReorder} onChange={(e) => setAddReorder(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unit Cost (₹)</Label>
                <Input type="number" step="0.01" className="h-9 text-xs" value={addCost} onChange={(e) => setAddCost(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Opening Stock</Label>
                <Input type="number" className="h-9 text-xs" value={addOpening} onChange={(e) => setAddOpening(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Storage Location</Label>
              <Input placeholder="e.g. Store Room A, Shelf 3" className="h-9 text-xs" value={addLocation} onChange={(e) => setAddLocation(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(false)} disabled={isAddSubmitting}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isAddSubmitting}>{isAddSubmitting ? "Saving..." : "Add Item"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock Movement Dialog */}
      <Dialog open={!!movItem} onOpenChange={(o) => !o && setMovItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Record Stock Movement</DialogTitle>
            <DialogDescription className="text-xs">
              Adjust stock for: <span className="font-semibold">{movItem?.name}</span> (Current: {movItem?.quantity} {movItem?.unitOfMeasure})
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMovement} className="space-y-4">
            {movError && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{movError}</div>}
            <div className="space-y-1.5">
              <Label className="text-xs">Movement Type *</Label>
              <Select value={movType} onValueChange={(v) => setMovType(v as any)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in" className="text-xs">📥 Stock In</SelectItem>
                  <SelectItem value="out" className="text-xs">📤 Stock Out</SelectItem>
                  <SelectItem value="return" className="text-xs">🔄 Return</SelectItem>
                  <SelectItem value="adjustment" className="text-xs">⚙️ Adjustment (+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quantity *</Label>
              <Input type="number" step="0.01" placeholder="0" className="h-9 text-xs font-mono" value={movQty} onChange={(e) => setMovQty(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reference (PO / Work Order / etc.)</Label>
              <Input placeholder="Optional reference number" className="h-9 text-xs font-mono" value={movRef} onChange={(e) => setMovRef(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Input placeholder="Optional notes" className="h-9 text-xs" value={movNotes} onChange={(e) => setMovNotes(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setMovItem(null)} disabled={isMovSubmitting}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isMovSubmitting}>{isMovSubmitting ? "Processing..." : "Record Movement"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
