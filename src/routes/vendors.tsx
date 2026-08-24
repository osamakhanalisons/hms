import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Truck,
  Plus,
  Search,
  RefreshCw,
  ShieldAlert,
  Star,
  FileText,
  Send,
  Award,
  DollarSign,
  Filter,
  Sliders,
  Phone,
  Mail,
  UserCheck,
  Building,
  CheckCircle2,
  Clock,
  XCircle,
  FileSpreadsheet,
  FileCheck,
  MapPin,
  FileEdit,
  Eye,
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
  getVendorsOverviewFn,
  createVendorFn,
  updateVendorFn,
  createRfqFn,
  submitQuotationFn,
  getQuotationsFn,
  awardQuotationFn,
  createPurchaseOrderFn,
  type VendorItem,
  type RfqItem,
  type QuotationItem,
  type PurchaseOrderItem,
} from "@/lib/api/vendors";

export const Route = createFileRoute("/vendors")({
  head: () => ({
    meta: [
      { title: "Vendor Registry & RFQs — HousingOS" },
      { name: "description", content: "Vendor management, quotations and purchase orders." },
    ],
  }),
  component: VendorsRoute,
});

function VendorsRoute() {
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
      <AppShell title="Access Denied" subtitle="Vendors">
        <div className="mx-auto max-w-md py-16 text-center space-y-4">
          <ShieldAlert className="size-12 mx-auto text-destructive" />
          <h2 className="text-lg font-bold font-serif">Authentication Required</h2>
          <p className="text-sm text-muted-foreground">Please log in to view society vendor registry.</p>
        </div>
      </AppShell>
    );
  }
  return (
    <ModuleGate moduleKey="vendors">
      <VendorsPage />
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

const CATEGORIES = [
  { value: "electrical", label: "Electrical Services" },
  { value: "plumbing", label: "Plumbing & Sanitary" },
  { value: "elevator", label: "Elevator AMC & Repairs" },
  { value: "generator", label: "Generator Maintenance" },
  { value: "security", label: "Security & Surveillance" },
  { value: "cleaning", label: "Housekeeping & Janitorial" },
  { value: "painting", label: "Painting & Civil Work" },
  { value: "gardening", label: "Landscape & Gardening" },
  { value: "general", label: "General Contractor" },
];

function RfqStatusBadge({ status }: { status: RfqItem["status"] }) {
  const map = {
    draft: "bg-slate-500/10 text-slate-600 border-slate-200",
    sent: "bg-blue-500/10 text-blue-600 border-blue-200 font-medium",
    awarded: "bg-emerald-500/10 text-emerald-600 border-emerald-200 font-bold",
    closed: "bg-rose-500/10 text-rose-600 border-rose-200",
  } as const;
  const labels = { draft: "Draft", sent: "Sent / Open", awarded: "Awarded", closed: "Closed" };
  return <Badge variant="outline" className={`text-[10px] ${map[status]}`}>{labels[status]}</Badge>;
}

function QuoteStatusBadge({ status }: { status: QuotationItem["status"] }) {
  const map = {
    pending: "bg-amber-500/10 text-amber-600 border-amber-200",
    approved: "bg-emerald-500/10 text-emerald-600 border-emerald-200 font-bold",
    rejected: "bg-rose-500/10 text-rose-600 border-rose-200 line-through",
  } as const;
  const labels = { pending: "Pending Review", approved: "Approved Winner", rejected: "Not Selected" };
  return <Badge variant="outline" className={`text-[10px] ${map[status]}`}>{labels[status]}</Badge>;
}

function VendorsPage() {
  const { roles } = useAuth();
  const canManage = roles.some((r) =>
    ["super_admin", "society_admin", "treasurer", "committee_member", "maintenance_head"].includes(r),
  );

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("directory");

  // Create Vendor modal
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [vName, setVName] = useState("");
  const [vCategory, setVCategory] = useState("general");
  const [vPhone, setVPhone] = useState("");
  const [vEmail, setVEmail] = useState("");
  const [vContactPerson, setVContactPerson] = useState("");
  const [vTaxId, setVTaxId] = useState("");
  const [vAddress, setVAddress] = useState("");
  const [vBankDetails, setVBankDetails] = useState("");
  const [vError, setVError] = useState<string | null>(null);
  const [isVSubmitting, setIsVSubmitting] = useState(false);

  // Edit Vendor modal
  const [editVendor, setEditVendor] = useState<VendorItem | null>(null);
  const [evName, setEvName] = useState("");
  const [evCategory, setEvCategory] = useState("general");
  const [evPhone, setEvPhone] = useState("");
  const [evEmail, setEvEmail] = useState("");
  const [evContactPerson, setEvContactPerson] = useState("");
  const [evTaxId, setEvTaxId] = useState("");
  const [evAddress, setEvAddress] = useState("");
  const [evStatus, setEvStatus] = useState<"active" | "inactive">("active");
  const [evError, setEvError] = useState<string | null>(null);
  const [isEvSubmitting, setIsEvSubmitting] = useState(false);

  // Create RFQ modal
  const [addRfqOpen, setAddRfqOpen] = useState(false);
  const [rfqTitle, setRfqTitle] = useState("");
  const [rfqDesc, setRfqDesc] = useState("");
  const [rfqBudget, setRfqBudget] = useState("");
  const [rfqDueDate, setRfqDueDate] = useState("");
  const [rfqError, setRfqError] = useState<string | null>(null);
  const [isRfqSubmitting, setIsRfqSubmitting] = useState(false);

  // Submit Quote modal
  const [addQuoteOpen, setAddQuoteOpen] = useState(false);
  const [qRfqId, setQRfqId] = useState("");
  const [qVendorId, setQVendorId] = useState("");
  const [qAmount, setQAmount] = useState("");
  const [qTimeline, setQTimeline] = useState("");
  const [qNotes, setQNotes] = useState("");
  const [qError, setQError] = useState<string | null>(null);
  const [isQSubmitting, setIsQSubmitting] = useState(false);

  // View Submissions & Award modal
  const [viewRfq, setViewRfq] = useState<RfqItem | null>(null);
  const [isAwarding, setIsAwarding] = useState(false);
  const [awardError, setAwardError] = useState<string | null>(null);

  // Manual PO modal
  const [addPoOpen, setAddPoOpen] = useState(false);
  const [poVendorId, setPoVendorId] = useState("");
  const [poAmount, setPoAmount] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [poError, setPoError] = useState<string | null>(null);
  const [isPoSubmitting, setIsPoSubmitting] = useState(false);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["vendors-overview", search, categoryFilter, statusFilter],
    queryFn: () =>
      getVendorsOverviewFn({ data: { search, category: categoryFilter, status: statusFilter } }),
    staleTime: 15_000,
  });

  const { data: rfqQuotes = [], isLoading: loadingRfqQuotes } = useQuery({
    queryKey: ["rfq-quotations", viewRfq?.id],
    queryFn: async () => {
      if (!viewRfq) return [];
      return getQuotationsFn({ data: { rfqId: viewRfq.id } });
    },
    enabled: !!viewRfq,
  });

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setVError(null);
    if (!vName.trim()) return setVError("Vendor name is required");
    setIsVSubmitting(true);
    try {
      await createVendorFn({
        data: {
          name: vName.trim(),
          category: vCategory,
          phone: vPhone || undefined,
          email: vEmail || undefined,
          contactPerson: vContactPerson || undefined,
          taxId: vTaxId || undefined,
          address: vAddress || undefined,
          bankDetails: vBankDetails || undefined,
        },
      });
      setAddVendorOpen(false);
      setVName(""); setVCategory("general"); setVPhone(""); setVEmail(""); setVContactPerson(""); setVTaxId(""); setVAddress(""); setVBankDetails("");
      refetch();
    } catch (err: any) {
      setVError(err.message || "Failed to register vendor");
    } finally {
      setIsVSubmitting(false);
    }
  };

  const handleUpdateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVendor) return;
    setEvError(null);
    setIsEvSubmitting(true);
    try {
      await updateVendorFn({
        data: {
          vendorId: editVendor.id,
          name: evName.trim(),
          category: evCategory,
          phone: evPhone || undefined,
          email: evEmail || undefined,
          contactPerson: evContactPerson || undefined,
          taxId: evTaxId || undefined,
          address: evAddress || undefined,
          status: evStatus,
        },
      });
      setEditVendor(null);
      refetch();
    } catch (err: any) {
      setEvError(err.message || "Failed to update vendor");
    } finally {
      setIsEvSubmitting(false);
    }
  };

  const handleCreateRfq = async (e: React.FormEvent) => {
    e.preventDefault();
    setRfqError(null);
    if (!rfqTitle.trim()) return setRfqError("RFQ title is required");
    if (!rfqDesc.trim()) return setRfqError("Description is required");
    setIsRfqSubmitting(true);
    try {
      await createRfqFn({
        data: {
          title: rfqTitle.trim(),
          description: rfqDesc.trim(),
          budgetAmount: rfqBudget ? Number(rfqBudget) : 0,
          dueDate: rfqDueDate || undefined,
        },
      });
      setAddRfqOpen(false);
      setRfqTitle(""); setRfqDesc(""); setRfqBudget(""); setRfqDueDate("");
      refetch();
    } catch (err: any) {
      setRfqError(err.message || "Failed to create RFQ");
    } finally {
      setIsRfqSubmitting(false);
    }
  };

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setQError(null);
    if (!qRfqId) return setQError("Please select an RFQ");
    if (!qVendorId) return setQError("Please select a vendor");
    if (!qAmount || Number(qAmount) <= 0) return setQError("Valid quotation amount is required");
    setIsQSubmitting(true);
    try {
      await submitQuotationFn({
        data: {
          rfqId: qRfqId,
          vendorId: qVendorId,
          amount: Number(qAmount),
          deliveryTimeline: qTimeline || undefined,
          notes: qNotes || undefined,
        },
      });
      setAddQuoteOpen(false);
      setQRfqId(""); setQVendorId(""); setQAmount(""); setQTimeline(""); setQNotes("");
      refetch();
    } catch (err: any) {
      setQError(err.message || "Failed to submit quotation");
    } finally {
      setIsQSubmitting(false);
    }
  };

  const handleAwardQuote = async (quotationId: string) => {
    if (!viewRfq) return;
    setAwardError(null);
    setIsAwarding(true);
    try {
      await awardQuotationFn({
        data: {
          rfqId: viewRfq.id,
          quotationId,
        },
      });
      setViewRfq(null);
      refetch();
    } catch (err: any) {
      setAwardError(err.message || "Failed to award contract");
    } finally {
      setIsAwarding(false);
    }
  };

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    setPoError(null);
    if (!poVendorId) return setPoError("Please select a vendor");
    if (!poAmount || Number(poAmount) <= 0) return setPoError("Valid PO amount is required");
    setIsPoSubmitting(true);
    try {
      await createPurchaseOrderFn({
        data: {
          vendorId: poVendorId,
          amount: Number(poAmount),
          notes: poNotes || undefined,
        },
      });
      setAddPoOpen(false);
      setPoVendorId(""); setPoAmount(""); setPoNotes("");
      refetch();
    } catch (err: any) {
      setPoError(err.message || "Failed to issue purchase order");
    } finally {
      setIsPoSubmitting(false);
    }
  };

  const openEditModal = (v: VendorItem) => {
    setEditVendor(v);
    setEvName(v.name);
    setEvCategory(v.category);
    setEvPhone(v.phone || "");
    setEvEmail(v.email || "");
    setEvContactPerson(v.contactPerson || "");
    setEvTaxId(v.taxId || "");
    setEvAddress(v.address || "");
    setEvStatus(v.status);
    setEvError(null);
  };

  const summary = data?.summary;
  const vendors = data?.vendors ?? [];
  const rfqs = data?.rfqs ?? [];
  const quotations = data?.quotations ?? [];
  const purchaseOrders = data?.purchaseOrders ?? [];

  return (
    <AppShell
      title="Vendor Registry & RFQs"
      subtitle="Manage approved vendors, RFQ tenders and procurement purchase orders"
      actions={
        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => setAddRfqOpen(true)}>
                <FileText className="size-3.5" /> Create RFQ
              </Button>
              <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setAddVendorOpen(true)}>
                <Plus className="size-3.5" /> Add Vendor
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
            <Truck className="size-5 text-primary" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Procurement · Vendor Management
            </div>
            <h1 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
              Society Vendor & RFQ Center
            </h1>
          </div>
        </header>

        {/* Error banner */}
        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-4 shrink-0" />
              <p className="text-sm font-medium">
                {error instanceof Error ? error.message : "Failed to load vendor records"}
              </p>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="Total Vendors" value={String(summary?.totalVendors ?? 0)} icon={Truck} loading={isLoading} />
          <KpiCard label="Active Vendors" value={String(summary?.activeVendors ?? 0)} icon={CheckCircle2} tone="success" loading={isLoading} />
          <KpiCard label="Open RFQs" value={String(summary?.openRfqs ?? 0)} icon={FileText} tone="warning" loading={isLoading} />
          <KpiCard label="Active POs" value={String(summary?.activePurchaseOrders ?? 0)} icon={FileCheck} tone="info" loading={isLoading} />
          <KpiCard label="Total Awarded" value={formatCurrency(summary?.totalAwardedValue ?? 0)} icon={DollarSign} tone="default" loading={isLoading} />
        </section>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-surface border border-border/60">
            <TabsTrigger value="directory" className="text-xs gap-1.5">
              <Truck className="size-3.5" /> Vendor Directory ({vendors.length})
            </TabsTrigger>
            <TabsTrigger value="rfqs" className="text-xs gap-1.5">
              <FileText className="size-3.5" /> RFQ Tenders ({rfqs.length})
            </TabsTrigger>
            <TabsTrigger value="bids" className="text-xs gap-1.5">
              <Send className="size-3.5" /> Submissions / Quotes ({quotations.length})
            </TabsTrigger>
            <TabsTrigger value="pos" className="text-xs gap-1.5">
              <FileCheck className="size-3.5" /> Purchase Orders ({purchaseOrders.length})
            </TabsTrigger>
          </TabsList>

          {/* VENDOR DIRECTORY TAB */}
          <TabsContent value="directory" className="space-y-6">
            {/* Filter Bar */}
            <Card className="border-border/70 shadow-soft p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search vendor, contact, phone..."
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
                  <SelectTrigger className="h-9 w-36 text-xs">
                    <Sliders className="mr-1.5 size-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                    <SelectItem value="active" className="text-xs">Active</SelectItem>
                    <SelectItem value="inactive" className="text-xs">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {/* Vendor Grid */}
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-44 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : !vendors.length ? (
              <Card className="border-border/70 border-dashed p-12 text-center text-muted-foreground">
                <Truck className="size-10 mx-auto opacity-30 mb-2" />
                <p className="text-sm font-medium">No vendors found</p>
                {canManage && (
                  <p className="text-[11px] opacity-60 mt-1">Click "Add Vendor" to register a new service provider.</p>
                )}
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {vendors.map((v) => (
                  <Card key={v.id} className="border-border/70 shadow-soft hover:border-border transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="grid size-8 shrink-0 place-items-center rounded bg-primary/10">
                            <Truck className="size-4 text-primary" />
                          </div>
                          <CardTitle className="font-serif text-sm font-bold truncate">
                            {v.name}
                          </CardTitle>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            v.status === "active"
                              ? "bg-emerald-500/10 text-emerald-600 border-transparent"
                              : "bg-slate-500/10 text-slate-500 border-transparent"
                          }`}
                        >
                          {v.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs pt-0">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {CATEGORIES.find((c) => c.value === v.category)?.label ?? v.category}
                        </Badge>
                        <div className="flex items-center gap-1 text-amber-500 text-[11px] font-bold">
                          <Star className="size-3 fill-amber-500" />
                          <span>{v.rating.toFixed(1)}</span>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="space-y-1 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
                        {v.contactPerson && (
                          <div className="flex items-center gap-1.5 text-foreground font-medium">
                            <UserCheck className="size-3 text-primary shrink-0" />
                            <span className="truncate">{v.contactPerson}</span>
                          </div>
                        )}
                        {v.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="size-3 shrink-0" />
                            <span>{v.phone}</span>
                          </div>
                        )}
                        {v.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="size-3 shrink-0" />
                            <span className="truncate">{v.email}</span>
                          </div>
                        )}
                        {v.address && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="size-3 shrink-0" />
                            <span className="truncate">{v.address}</span>
                          </div>
                        )}
                      </div>

                      {canManage && (
                        <div className="pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-7 text-[11px] gap-1"
                            onClick={() => openEditModal(v)}
                          >
                            <FileEdit className="size-3" /> Edit Profile
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* RFQ TENDERS TAB */}
          <TabsContent value="rfqs" className="space-y-6">
            <Card className="border-border/70 shadow-soft">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-serif text-base font-bold">Requests for Quotation (RFQs)</CardTitle>
                    <CardDescription className="text-xs">Competitive tender requests for society repairs and projects</CardDescription>
                  </div>
                  {canManage && (
                    <Button size="sm" className="gap-1 text-xs h-8" onClick={() => setAddRfqOpen(true)}>
                      <Plus className="size-3.5" /> Create RFQ
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
                ) : !rfqs.length ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <FileText className="size-10 mx-auto opacity-30 mb-2" />
                    <p className="text-sm font-medium">No RFQs created yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {rfqs.map((rfq) => (
                      <div key={rfq.id} className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                        <div className="space-y-1 min-w-0 max-w-lg">
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-bold text-sm">{rfq.title}</span>
                            <RfqStatusBadge status={rfq.status} />
                            <Badge variant="secondary" className="text-[10px]">
                              {rfq.submissionsCount} Quote{rfq.submissionsCount === 1 ? "" : "s"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{rfq.description}</p>
                          {rfq.awardedVendorName && (
                            <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                              <Award className="size-3 shrink-0" /> Awarded to: {rfq.awardedVendorName}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-6 text-xs">
                          {rfq.budgetAmount > 0 && (
                            <div className="text-right">
                              <div className="text-[10px] text-muted-foreground">Budget</div>
                              <div className="font-bold text-foreground">{formatCurrency(rfq.budgetAmount)}</div>
                            </div>
                          )}
                          {rfq.dueDate && (
                            <div className="text-right">
                              <div className="text-[10px] text-muted-foreground">Due Date</div>
                              <div className="font-mono text-muted-foreground">{rfq.dueDate}</div>
                            </div>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] gap-1"
                            onClick={() => setViewRfq(rfq)}
                          >
                            <Eye className="size-3" /> View Submissions
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* QUOTATIONS TAB */}
          <TabsContent value="bids" className="space-y-6">
            <Card className="border-border/70 shadow-soft">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-serif text-base font-bold">Received Vendor Quotations</CardTitle>
                    <CardDescription className="text-xs">Quotations submitted for open society RFQ tenders</CardDescription>
                  </div>
                  {canManage && (
                    <Button size="sm" className="gap-1 text-xs h-8" onClick={() => setAddQuoteOpen(true)}>
                      <Plus className="size-3.5" /> Submit Quote
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
                ) : !quotations.length ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <Send className="size-10 mx-auto opacity-30 mb-2" />
                    <p className="text-sm font-medium">No quotations submitted yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {quotations.map((q) => (
                      <div key={q.id} className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                        <div className="space-y-1 min-w-0 max-w-lg">
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-bold text-sm">{q.vendorName}</span>
                            <QuoteStatusBadge status={q.status} />
                            {q.quotationNumber && (
                              <span className="font-mono text-[10px] text-muted-foreground">{q.quotationNumber}</span>
                            )}
                          </div>
                          {q.rfqTitle && (
                            <div className="text-xs text-muted-foreground">
                              RFQ: <span className="font-medium text-foreground">{q.rfqTitle}</span>
                            </div>
                          )}
                          {q.deliveryTimeline && (
                            <div className="text-[11px] text-muted-foreground">
                              Timeline: {q.deliveryTimeline}
                            </div>
                          )}
                          {q.notes && <p className="text-[11px] text-muted-foreground italic">{q.notes}</p>}
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] text-muted-foreground">Quotation Amount</div>
                          <div className="font-serif font-bold text-lg text-primary">{formatCurrency(q.amount)}</div>
                          <div className="text-[10px] text-muted-foreground">{q.createdAt}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PURCHASE ORDERS TAB */}
          <TabsContent value="pos" className="space-y-6">
            <Card className="border-border/70 shadow-soft">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-serif text-base font-bold">Purchase Orders (POs)</CardTitle>
                    <CardDescription className="text-xs">Issued procurement purchase orders and contracts</CardDescription>
                  </div>
                  {canManage && (
                    <Button size="sm" className="gap-1 text-xs h-8" onClick={() => setAddPoOpen(true)}>
                      <Plus className="size-3.5" /> Issue PO
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
                ) : !purchaseOrders.length ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <FileCheck className="size-10 mx-auto opacity-30 mb-2" />
                    <p className="text-sm font-medium">No purchase orders issued yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {purchaseOrders.map((po) => (
                      <div key={po.id} className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                        <div className="space-y-1 min-w-0 max-w-lg">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-primary">{po.poNumber || po.id.slice(0, 8)}</span>
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-transparent capitalize">
                              {po.status}
                            </Badge>
                          </div>
                          <div className="text-xs font-medium text-foreground">
                            Vendor: {po.vendorName}
                          </div>
                          {po.notes && <p className="text-[11px] text-muted-foreground">{po.notes}</p>}
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] text-muted-foreground">PO Amount</div>
                          <div className="font-serif font-bold text-base">{formatCurrency(po.amount)}</div>
                          <div className="text-[10px] text-muted-foreground">{po.createdAt}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Vendor Modal */}
      <Dialog open={addVendorOpen} onOpenChange={setAddVendorOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Register Society Vendor</DialogTitle>
            <DialogDescription className="text-xs">Add a contractor, service provider or supplier to the approved vendor register.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateVendor} className="space-y-4">
            {vError && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{vError}</div>}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Vendor Business Name *</Label>
                <Input placeholder="e.g. Al-Fatah Electricals, Apex Elevators" className="h-9 text-xs" value={vName} onChange={(e) => setVName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category *</Label>
                <Select value={vCategory} onValueChange={setVCategory}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Contact Person</Label>
                <Input placeholder="Manager / Representative name" className="h-9 text-xs" value={vContactPerson} onChange={(e) => setVContactPerson(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone Number</Label>
                <Input placeholder="+92 300 0000000" className="h-9 text-xs" value={vPhone} onChange={(e) => setVPhone(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Email Address</Label>
                <Input type="email" placeholder="vendor@example.com" className="h-9 text-xs" value={vEmail} onChange={(e) => setVEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tax ID / NTN / GST</Label>
                <Input placeholder="e.g. 1234567-8" className="h-9 text-xs font-mono" value={vTaxId} onChange={(e) => setVTaxId(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Office Address</Label>
              <Input placeholder="Physical business address" className="h-9 text-xs" value={vAddress} onChange={(e) => setVAddress(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Bank Details (Optional)</Label>
              <Input placeholder="Bank Name, IBAN, Account Title" className="h-9 text-xs" value={vBankDetails} onChange={(e) => setVBankDetails(e.target.value)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setAddVendorOpen(false)} disabled={isVSubmitting}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isVSubmitting}>{isVSubmitting ? "Saving..." : "Register Vendor"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Vendor Modal */}
      <Dialog open={!!editVendor} onOpenChange={(o) => !o && setEditVendor(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Edit Vendor Profile</DialogTitle>
            <DialogDescription className="text-xs">Update contractor profile details and status.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateVendor} className="space-y-4">
            {evError && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{evError}</div>}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Business Name *</Label>
                <Input className="h-9 text-xs" value={evName} onChange={(e) => setEvName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category *</Label>
                <Select value={evCategory} onValueChange={setEvCategory}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Contact Person</Label>
                <Input className="h-9 text-xs" value={evContactPerson} onChange={(e) => setEvContactPerson(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input className="h-9 text-xs" value={evPhone} onChange={(e) => setEvPhone(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input className="h-9 text-xs" value={evEmail} onChange={(e) => setEvEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={evStatus} onValueChange={(v) => setEvStatus(v as "active" | "inactive")}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active" className="text-xs">✅ Active</SelectItem>
                    <SelectItem value="inactive" className="text-xs">🚫 Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditVendor(null)} disabled={isEvSubmitting}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isEvSubmitting}>{isEvSubmitting ? "Updating..." : "Update Vendor"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create RFQ Modal */}
      <Dialog open={addRfqOpen} onOpenChange={setAddRfqOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Create Request for Quotation (RFQ)</DialogTitle>
            <DialogDescription className="text-xs">Publish a tender for society repairs, painting, or procurement.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateRfq} className="space-y-4">
            {rfqError && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{rfqError}</div>}

            <div className="space-y-1.5">
              <Label className="text-xs">Tender / RFQ Title *</Label>
              <Input placeholder="e.g. Block C Exterior Painting Tender" className="h-9 text-xs" value={rfqTitle} onChange={(e) => setRfqTitle(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description & Scope of Work *</Label>
              <Textarea placeholder="Provide detailed requirements, guidelines, deadlines..." className="text-xs min-h-[90px]" value={rfqDesc} onChange={(e) => setRfqDesc(e.target.value)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Budget Estimate (₹)</Label>
                <Input type="number" step="0.01" placeholder="0.00" className="h-9 text-xs font-mono" value={rfqBudget} onChange={(e) => setRfqBudget(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Submission Due Date</Label>
                <Input type="date" className="h-9 text-xs" value={rfqDueDate} onChange={(e) => setRfqDueDate(e.target.value)} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setAddRfqOpen(false)} disabled={isRfqSubmitting}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isRfqSubmitting}>{isRfqSubmitting ? "Creating..." : "Publish RFQ"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Submit Quotation Modal */}
      <Dialog open={addQuoteOpen} onOpenChange={setAddQuoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Submit Vendor Quotation</DialogTitle>
            <DialogDescription className="text-xs">Record a formal bid received from a vendor for an open RFQ.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitQuote} className="space-y-4">
            {qError && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{qError}</div>}

            <div className="space-y-1.5">
              <Label className="text-xs">Target RFQ *</Label>
              <Select value={qRfqId} onValueChange={setQRfqId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select RFQ" /></SelectTrigger>
                <SelectContent>
                  {rfqs.filter((r) => r.status === "draft" || r.status === "sent").map((r: { id: string; title: string }) => (
                    <SelectItem key={r.id} value={r.id} className="text-xs">{r.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Bidding Vendor *</Label>
              <Select value={qVendorId} onValueChange={setQVendorId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                <SelectContent>
                  {vendors.map((v: { id: string; name: string }) => (
                    <SelectItem key={v.id} value={v.id} className="text-xs">{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Quotation Amount (₹) *</Label>
                <Input type="number" step="0.01" placeholder="0.00" className="h-9 text-xs font-mono" value={qAmount} onChange={(e) => setQAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Delivery Timeline</Label>
                <Input placeholder="e.g. 14 Days, 2 Weeks" className="h-9 text-xs" value={qTimeline} onChange={(e) => setQTimeline(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes / Warranty / Inclusions</Label>
              <Input placeholder="e.g. Includes materials and 6 month warranty" className="h-9 text-xs" value={qNotes} onChange={(e) => setQNotes(e.target.value)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setAddQuoteOpen(false)} disabled={isQSubmitting}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isQSubmitting}>{isQSubmitting ? "Submitting..." : "Record Quotation"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Submissions & Award Contract Modal */}
      <Dialog open={!!viewRfq} onOpenChange={(o) => !o && setViewRfq(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">RFQ Submissions & Tender Award</DialogTitle>
            <DialogDescription className="text-xs">RFQ: <span className="font-semibold">{viewRfq?.title}</span></DialogDescription>
          </DialogHeader>

          {awardError && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{awardError}</div>}

          <div className="space-y-4">
            <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
              <p className="font-medium text-foreground">{viewRfq?.description}</p>
              <div className="flex items-center gap-4 text-muted-foreground pt-1">
                <span>Budget: <strong className="text-foreground">{formatCurrency(viewRfq?.budgetAmount ?? 0)}</strong></span>
                {viewRfq?.dueDate && <span>Due Date: <strong className="text-foreground">{viewRfq.dueDate}</strong></span>}
                <span>Status: <RfqStatusBadge status={viewRfq?.status ?? "draft"} /></span>
              </div>
            </div>

            <div>
              <h4 className="font-serif font-bold text-sm mb-2">Bids Submitted ({rfqQuotes.length})</h4>
              {loadingRfqQuotes ? (
                <div className="h-24 animate-pulse bg-muted rounded" />
              ) : !rfqQuotes.length ? (
                <div className="p-8 text-center border border-dashed rounded text-xs text-muted-foreground">
                  No vendor quotations received for this RFQ yet.
                </div>
              ) : (
                <div className="divide-y border rounded-lg">
                  {rfqQuotes.map((q: any) => (
                    <div key={q.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="font-bold font-serif flex items-center gap-2">
                          {q.vendor_name}
                          <QuoteStatusBadge status={q.status} />
                        </div>
                        {q.delivery_timeline && <p className="text-[11px] text-muted-foreground">Timeline: {q.delivery_timeline}</p>}
                        {q.notes && <p className="text-[11px] text-muted-foreground italic">{q.notes}</p>}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-bold text-sm font-mono text-primary">{formatCurrency(q.amount)}</div>
                        </div>

                        {canManage && viewRfq?.status !== "awarded" && viewRfq?.status !== "closed" && (
                          <Button
                            size="sm"
                            className="h-7 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={isAwarding}
                            onClick={() => handleAwardQuote(q.id)}
                          >
                            <Award className="size-3" /> Award Tender
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setViewRfq(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Purchase Order Modal */}
      <Dialog open={addPoOpen} onOpenChange={setAddPoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Issue Purchase Order</DialogTitle>
            <DialogDescription className="text-xs">Directly issue a binding purchase order to an approved vendor.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePo} className="space-y-4">
            {poError && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{poError}</div>}

            <div className="space-y-1.5">
              <Label className="text-xs">Vendor *</Label>
              <Select value={poVendorId} onValueChange={setPoVendorId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                <SelectContent>
                  {vendors.map((v: { id: string; name: string }) => (
                    <SelectItem key={v.id} value={v.id} className="text-xs">{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Purchase Amount (₹) *</Label>
              <Input type="number" step="0.01" placeholder="0.00" className="h-9 text-xs font-mono" value={poAmount} onChange={(e) => setPoAmount(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes / Deliverables / Scope</Label>
              <Input placeholder="Optional notes for vendor PO" className="h-9 text-xs" value={poNotes} onChange={(e) => setPoNotes(e.target.value)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setAddPoOpen(false)} disabled={isPoSubmitting}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isPoSubmitting}>{isPoSubmitting ? "Issuing..." : "Issue Purchase Order"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
