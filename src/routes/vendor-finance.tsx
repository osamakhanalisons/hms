import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import {
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  RefreshCw,
  ShieldAlert,
  CreditCard,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building2,
  FileText,
  Calendar,
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
  getVendorFinanceFn,
  createVendorInvoiceFn,
  recordVendorPaymentFn,
  type VendorInvoiceItem,
} from "@/lib/api/vendor-finance";

export const Route = createFileRoute("/vendor-finance")({
  head: () => ({
    meta: [
      { title: "Vendor Finance — HousingOS" },
      {
        name: "description",
        content: "Manage vendor invoices, purchase orders, payments, and outstanding balances.",
      },
    ],
  }),
  component: VendorFinanceRoute,
});

function VendorFinanceRoute() {
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
      <AppShell title="Access Denied" subtitle="Vendor Finance">
        <div className="mx-auto max-w-md py-16 text-center space-y-4">
          <ShieldAlert className="size-12 mx-auto text-destructive" />
          <h2 className="text-lg font-bold font-serif">Authentication Required</h2>
          <p className="text-sm text-muted-foreground">
            Please log in to manage vendor invoices and payments.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <ModuleGate moduleKey="vendor_finance">
      <VendorFinancePage />
    </ModuleGate>
  );
}

function formatCurrency(amount: number) {
  return "₨" + Math.round(amount).toLocaleString("en-PK");
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
  const toneClasses = {
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
              <div className="mt-2 h-7 w-28 animate-pulse rounded-md bg-muted" />
            ) : (
              <p className="mt-1 font-serif text-2xl font-bold tracking-tight">{value}</p>
            )}
          </div>
          <div className={`rounded-lg p-2.5 ${toneClasses}`}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VendorFinancePage() {
  const { roles } = useAuth();
  const isAdminOrFinance = roles.some((r) =>
    ["super_admin", "society_admin", "finance_head"].includes(r),
  );

  const [selectedVendor, setSelectedVendor] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Create Invoice Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createVendorId, setCreateVendorId] = useState("");
  const [createPoId, setCreatePoId] = useState("");
  const [createInvNum, setCreateInvNum] = useState("");
  const [createInvDate, setCreateInvDate] = useState(new Date().toISOString().split("T")[0]);
  const [createDueDate, setCreateDueDate] = useState("");
  const [createAmount, setCreateAmount] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Record Payment Modal State
  const [payInvoice, setPayInvoice] = useState<VendorInvoiceItem | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payError, setPayError] = useState<string | null>(null);
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["vendor-finance", selectedVendor, selectedStatus, searchQuery],
    queryFn: () =>
      getVendorFinanceFn({
        data: {
          vendorId: selectedVendor,
          status: selectedStatus,
          search: searchQuery,
        },
      }),
    staleTime: 15_000,
  });

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!createVendorId) return setCreateError("Please select a vendor");
    if (!createInvNum.trim()) return setCreateError("Invoice number is required");
    if (!createDueDate) return setCreateError("Due date is required");
    const numAmt = Number(createAmount);
    if (isNaN(numAmt) || numAmt <= 0) return setCreateError("Amount must be a positive number");

    setIsSubmittingCreate(true);
    try {
      await createVendorInvoiceFn({
        data: {
          vendorId: createVendorId,
          purchaseOrderId: createPoId || undefined,
          invoiceNumber: createInvNum.trim(),
          invoiceDate: createInvDate,
          dueDate: createDueDate,
          amount: numAmt,
          notes: createNotes || undefined,
        },
      });

      setIsCreateOpen(false);
      // Reset form
      setCreateVendorId("");
      setCreatePoId("");
      setCreateInvNum("");
      setCreateAmount("");
      setCreateNotes("");
      refetch();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create invoice");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payInvoice) return;
    setPayError(null);

    const numAmt = Number(payAmount);
    if (isNaN(numAmt) || numAmt <= 0) {
      return setPayError("Payment amount must be greater than 0");
    }
    if (numAmt > payInvoice.outstandingAmount + 0.01) {
      return setPayError(`Payment cannot exceed outstanding ₹${payInvoice.outstandingAmount}`);
    }

    setIsSubmittingPay(true);
    try {
      await recordVendorPaymentFn({
        data: {
          invoiceId: payInvoice.id,
          paymentAmount: numAmt,
          notes: payNotes || undefined,
        },
      });

      setPayInvoice(null);
      setPayAmount("");
      setPayNotes("");
      refetch();
    } catch (err: any) {
      setPayError(err.message || "Failed to record payment");
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const summary = data?.summary;
  const invoices = data?.invoices ?? [];
  const vendorsList = data?.vendorsList ?? [];
  const purchaseOrdersList = data?.purchaseOrdersList ?? [];

  // Filter purchase orders matching selected vendor in creation modal
  const filteredPos = createVendorId
    ? purchaseOrdersList.filter((p) => p.vendorId === createVendorId)
    : purchaseOrdersList;

  return (
    <AppShell
      title="Vendor Finance"
      subtitle="Manage vendor bills, purchase order payments, and payables"
      actions={
        <div className="flex items-center gap-2">
          {isAdminOrFinance && (
            <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setIsCreateOpen(true)}>
              <Plus className="size-3.5" /> Create Invoice
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
        {/* Header Title */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-md bg-surface border border-border/60">
              <FileSpreadsheet className="size-5 text-primary" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Finance · Accounts Payable
              </div>
              <h1 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
                Vendor Invoices & Payables
              </h1>
            </div>
          </div>
        </header>

        {/* Error Banner */}
        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-4 shrink-0" />
              <p className="text-sm font-medium">
                Failed to load vendor invoices:{" "}
                {error instanceof Error ? error.message : "Unknown error"}
              </p>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Invoiced"
            value={formatCurrency(summary?.totalInvoiced ?? 0)}
            icon={FileText}
            loading={isLoading}
          />
          <KpiCard
            label="Total Paid"
            value={formatCurrency(summary?.totalPaid ?? 0)}
            icon={CheckCircle2}
            tone="success"
            loading={isLoading}
          />
          <KpiCard
            label="Total Outstanding"
            value={formatCurrency(summary?.totalOutstanding ?? 0)}
            icon={DollarSign}
            tone={(summary?.totalOutstanding ?? 0) > 0 ? "warning" : "default"}
            loading={isLoading}
          />
          <KpiCard
            label="Overdue Invoices"
            value={String(summary?.overdueCount ?? 0)}
            icon={AlertTriangle}
            tone={(summary?.overdueCount ?? 0) > 0 ? "destructive" : "default"}
            loading={isLoading}
          />
        </section>

        {/* Filters & Search */}
        <Card className="border-border/70 shadow-soft p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search invoice # or vendor..."
                  className="h-9 pl-9 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Vendor Filter */}
              <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                <SelectTrigger className="h-9 w-48 text-xs">
                  <Building2 className="mr-1.5 size-3.5 text-muted-foreground" />
                  <SelectValue placeholder="All Vendors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Vendors
                  </SelectItem>
                  {vendorsList.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="text-xs">
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-9 w-40 text-xs">
                  <Filter className="mr-1.5 size-3.5 text-muted-foreground" />
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Statuses
                  </SelectItem>
                  <SelectItem value="pending" className="text-xs">
                    Pending
                  </SelectItem>
                  <SelectItem value="partially_paid" className="text-xs">
                    Partially Paid
                  </SelectItem>
                  <SelectItem value="paid" className="text-xs">
                    Paid
                  </SelectItem>
                  <SelectItem value="overdue" className="text-xs">
                    Overdue
                  </SelectItem>
                  <SelectItem value="cancelled" className="text-xs">
                    Cancelled
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Invoices List Table */}
        <Card className="border-border/70 shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base font-bold">Vendor Invoices</CardTitle>
            <CardDescription className="text-[11px]">
              Review recorded bills, track payment status, and process payouts
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="divide-y divide-border/60 p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : !invoices.length ? (
              <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                <FileText className="size-8 opacity-40 mb-2" />
                <p className="text-sm">No vendor invoices found</p>
                <p className="text-[11px] text-muted-foreground/70">
                  {isAdminOrFinance
                    ? "Click 'Create Invoice' to record a new vendor bill."
                    : "No invoices match your selected filter criteria."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Invoice #</th>
                      <th className="px-4 py-3">Vendor</th>
                      <th className="px-4 py-3">Dates</th>
                      <th className="px-4 py-3">PO Link</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-right">Paid</th>
                      <th className="px-4 py-3 text-right">Outstanding</th>
                      <th className="px-4 py-3">Status</th>
                      {isAdminOrFinance && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {invoices.map((inv) => {
                      const isOverdue = inv.status === "overdue";
                      return (
                        <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold">{inv.invoiceNumber}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{inv.vendorName}</div>
                            {inv.vendorCategory && (
                              <div className="text-[10px] text-muted-foreground">
                                {inv.vendorCategory}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            <div>Inv: {inv.invoiceDate}</div>
                            <div className={isOverdue ? "font-bold text-rose-600" : ""}>
                              Due: {inv.dueDate}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                            {inv.purchaseOrderId ? (
                              <span title={`PO #${inv.purchaseOrderId}`}>
                                PO-{inv.purchaseOrderId.slice(0, 6)}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {formatCurrency(inv.amount)}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                            {formatCurrency(inv.paidAmount)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-foreground">
                            {formatCurrency(inv.outstandingAmount)}
                          </td>
                          <td className="px-4 py-3">
                            {inv.status === "paid" && (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-transparent">
                                Paid
                              </Badge>
                            )}
                            {inv.status === "partially_paid" && (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-transparent">
                                Partial
                              </Badge>
                            )}
                            {inv.status === "pending" && (
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-transparent">
                                Pending
                              </Badge>
                            )}
                            {inv.status === "overdue" && (
                              <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-transparent">
                                Overdue
                              </Badge>
                            )}
                            {inv.status === "cancelled" && (
                              <Badge variant="outline" className="bg-muted text-muted-foreground border-transparent">
                                Cancelled
                              </Badge>
                            )}
                          </td>
                          {isAdminOrFinance && (
                            <td className="px-4 py-3 text-right">
                              {inv.outstandingAmount > 0 && inv.status !== "cancelled" ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[11px] gap-1"
                                  onClick={() => {
                                    setPayInvoice(inv);
                                    setPayAmount(String(inv.outstandingAmount));
                                  }}
                                >
                                  <CreditCard className="size-3" /> Record Payment
                                </Button>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Invoice Dialog Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Create Vendor Invoice</DialogTitle>
            <DialogDescription className="text-xs">
              Record a bill received from a vendor or contractor for work completed.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateInvoice} className="space-y-4">
            {createError && (
              <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
                {createError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Vendor *</Label>
              <Select value={createVendorId} onValueChange={setCreateVendorId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select Vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendorsList.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="text-xs">
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Linked Purchase Order (Optional)</Label>
              <Select value={createPoId} onValueChange={setCreatePoId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select Purchase Order (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="text-xs">
                    None (Direct Invoice)
                  </SelectItem>
                  {filteredPos.map((po) => (
                    <SelectItem key={po.id} value={po.id} className="text-xs font-mono">
                      PO-{po.id.slice(0, 8)} ({formatCurrency(po.amount)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Invoice Number *</Label>
                <Input
                  placeholder="e.g. INV-2026-001"
                  className="h-9 text-xs font-mono"
                  value={createInvNum}
                  onChange={(e) => setCreateInvNum(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Amount (₹) *</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  className="h-9 text-xs font-mono"
                  value={createAmount}
                  onChange={(e) => setCreateAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Invoice Date *</Label>
                <Input
                  type="date"
                  className="h-9 text-xs"
                  value={createInvDate}
                  onChange={(e) => setCreateInvDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Due Date *</Label>
                <Input
                  type="date"
                  className="h-9 text-xs"
                  value={createDueDate}
                  onChange={(e) => setCreateDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes / Details</Label>
              <Input
                placeholder="Optional notes or description..."
                className="h-9 text-xs"
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmittingCreate}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmittingCreate}>
                {isSubmittingCreate ? "Saving..." : "Create Invoice"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog Modal */}
      <Dialog open={!!payInvoice} onOpenChange={(open) => !open && setPayInvoice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Record Vendor Payment</DialogTitle>
            <DialogDescription className="text-xs">
              Record a payment made against invoice #{payInvoice?.invoiceNumber} ({payInvoice?.vendorName}).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRecordPayment} className="space-y-4">
            {payError && (
              <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
                {payError}
              </div>
            )}

            <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Invoice Amount:</span>
                <span className="font-medium">{formatCurrency(payInvoice?.amount ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already Paid:</span>
                <span className="font-medium text-emerald-600">{formatCurrency(payInvoice?.paidAmount ?? 0)}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-border/60 pt-1 mt-1">
                <span>Outstanding Balance:</span>
                <span className="text-foreground">{formatCurrency(payInvoice?.outstandingAmount ?? 0)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Payment Amount (₹) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Amount to pay"
                className="h-9 text-xs font-mono"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Payment Reference / Notes</Label>
              <Input
                placeholder="e.g. UTR / Cheque number / Bank reference..."
                className="h-9 text-xs"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPayInvoice(null)}
                disabled={isSubmittingPay}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmittingPay}>
                {isSubmittingPay ? "Processing..." : "Record Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
