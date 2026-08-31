import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { PermissionGate } from "@/components/permission-gate";
import { useAuth } from "@/hooks/use-auth";
import { getPaymentsFn, recordPaymentFn, getDailySummaryFn } from "@/lib/api/payments";
import { getUnitsFn } from "@/lib/api/property";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { CreditCard, Landmark, CircleDollarSign, Plus, Coins } from "lucide-react";

export const Route = createFileRoute("/payments")({
  head: () => ({
    meta: [
      { title: "Payments & Receipts — HousingOS" },
      {
        name: "description",
        content: "Record resident rent/maintenance payments and check daily collections.",
      },
    ],
  }),
  component: PaymentsRoute,
});

function PaymentsRoute() {
  return (
    <ModuleGate moduleKey="payments">
      <PaymentsPage />
    </ModuleGate>
  );
}

function PaymentsPage() {
  const queryClient = useQueryClient();
  const { roles } = useAuth();
  const isAdmin = roles.includes("super_admin") || roles.includes("society_admin");
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);

  // Form states
  const [unitId, setUnitId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "bank_transfer" | "cheque" | "online"
  >("cash");
  const [paymentDate, setPaymentDate] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => getPaymentsFn(),
  });

  const { data: units = [] } = useQuery({
    queryKey: ["units"],
    queryFn: async () => getUnitsFn(),
  });

  const { data: summary = { todayCollected: 0, count: 0 } } = useQuery({
    queryKey: ["dailySummary"],
    queryFn: async () => getDailySummaryFn(),
    enabled: isAdmin,
  });

  const recordPayment = useMutation({
    mutationFn: recordPaymentFn,
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["dailySummary"] });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      toast.success(`Payment recorded successfully. Receipt #: ${res.receiptNumber}`);
      setRecordDialogOpen(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setUnitId("");
    setAmount("");
    setPaymentMethod("cash");
    setPaymentDate("");
    setReference("");
    setNotes("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    recordPayment.mutate({
      data: {
        unitId,
        amount: parseFloat(amount),
        paymentMethod,
        paymentDate,
        reference: reference || undefined,
        notes: notes || undefined,
      },
    });
  };

  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(payments.length / itemsPerPage) || 1;
  const paginatedPayments = payments.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <AppShell
      title="Payment Collections"
      subtitle="Log receipts, bank transfers and track collection milestones"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10 space-y-6">
        {/* KPI Row */}
        {isAdmin && (
          <section className="grid gap-4 sm:grid-cols-3">
            <Card className="border-border/70 shadow-soft">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Today's Collection
                  </div>
                  <div className="text-2xl font-serif font-bold mt-1">
                    ₨{summary.todayCollected.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="size-10 bg-success/10 text-success rounded-full flex items-center justify-center">
                  <Coins className="size-5" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-soft">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Transactions Logged
                  </div>
                  <div className="text-2xl font-serif font-bold mt-1">{summary.count}</div>
                </div>
                <div className="size-10 bg-primary-soft text-primary rounded-full flex items-center justify-center">
                  <CircleDollarSign className="size-5" />
                </div>
              </CardContent>
            </Card>
            <PermissionGate moduleKey="payments" action="create" fallback={null}>
              <Card className="border-border/70 shadow-soft flex items-center justify-center p-5">
                <Button onClick={() => setRecordDialogOpen(true)} className="w-full gap-1.5 h-10">
                  <Plus className="size-4" /> Record Payment
                </Button>
              </Card>
            </PermissionGate>
          </section>
        )}

        {/* History Grid */}
        <Card className="border-border/70 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">Transaction History</CardTitle>
              <CardDescription className="text-xs">All cleared and logged receipts</CardDescription>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              Total: {payments.length} receipts
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-20">
                <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                      <tr>
                        <th className="px-4 py-3 text-left">Receipt No</th>
                        <th className="px-4 py-3 text-left">Unit</th>
                        <th className="px-4 py-3 text-left">Resident</th>
                        <th className="px-4 py-3 text-left">Method</th>
                        <th className="px-4 py-3 text-left">Ref Code</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(paginatedPayments as any[]).map((p: any) => (
                        <tr key={p.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3.5 font-mono text-xs">{p.receipt_number}</td>
                          <td className="px-4 py-3.5 font-medium">Unit {p.unit_number}</td>
                          <td className="px-4 py-3.5 text-muted-foreground">{p.full_name || "—"}</td>
                          <td className="px-4 py-3.5 text-xs capitalize">
                            {p.payment_method.replace("_", " ")}
                          </td>
                          <td className="px-4 py-3.5 text-xs font-mono text-muted-foreground">
                            {p.reference || "—"}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-semibold text-success">
                            ₨{Number(p.amount).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                      {payments.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-12 text-center text-muted-foreground text-xs"
                          >
                            No receipts recorded today. Click "Record Payment" to post one.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {payments.length > itemsPerPage && (
                  <div className="flex items-center justify-between border-t p-4 text-xs text-muted-foreground">
                    <div>
                      Showing {(page - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(page * itemsPerPage, payments.length)} of {payments.length} receipts
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                        className="h-8 text-xs px-3"
                      >
                        Previous
                      </Button>
                      <span className="font-medium text-foreground">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                        className="h-8 text-xs px-3"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Record Payment Receipt</DialogTitle>
            <DialogDescription>
              Credit a transaction amount directly to a unit account
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Select Unit</label>
                <Select value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_path || `Unit ${u.unit_number} ${u.building_name ? `(${u.building_name})` : ""} ${u.block_name ? (u.block_name.startsWith("Block") ? u.block_name : `Block ${u.block_name}`) : ""}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Amount (₨)</label>
                <Input
                  required
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Payment Date</label>
                <Input
                  required
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Payment Method
                </label>
                <Select value={paymentMethod} onValueChange={(val: any) => setPaymentMethod(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash Payment</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer/wire</SelectItem>
                    <SelectItem value="cheque">Bank Cheque</SelectItem>
                    <SelectItem value="online">Online App Integration</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Reference Code (cheque/TXN)
                </label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Memo/Notes</label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRecordDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Record Receipt</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
