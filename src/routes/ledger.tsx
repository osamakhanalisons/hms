import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { PermissionGate } from "@/components/permission-gate";
import { LedgerTable } from "@/components/ledger-table";
import {
  getLedgerFn,
  getChargeHeadsFn,
  createChargeHeadFn,
  generateBulkChargesFn,
  createManualChargeFn,
} from "@/lib/api/ledger";
import { getUnitsFn } from "@/lib/api/property";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { FileSpreadsheet, PlusCircle, Search, Settings } from "lucide-react";

export const Route = createFileRoute("/ledger")({
  head: () => ({
    meta: [
      { title: "Resident Ledger — HousingOS" },
      {
        name: "description",
        content: "View unit ledgers, assign charges and perform monthly bulk charge generation.",
      },
    ],
  }),
  component: LedgerRoute,
});

function LedgerRoute() {
  return (
    <ModuleGate moduleKey="ledger">
      <LedgerPage />
    </ModuleGate>
  );
}

function LedgerPage() {
  const queryClient = useQueryClient();
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [headDialogOpen, setHeadDialogOpen] = useState(false);

  // Forms
  const [chargeHeadId, setChargeHeadId] = useState("");
  const [billingPeriod, setBillingPeriod] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const [headName, setHeadName] = useState("");
  const [headDesc, setHeadDesc] = useState("");
  const [headAmt, setHeadAmt] = useState("");

  const { data: units = [] } = useQuery({
    queryKey: ["units"],
    queryFn: async () => getUnitsFn(),
  });

  // Auto-select unit if there is only one unit available (e.g. for a resident)
  useEffect(() => {
    if (units && units.length === 1 && !selectedUnitId) {
      setSelectedUnitId(units[0].id);
    }
  }, [units, selectedUnitId]);

  const { data: chargeHeads = [] } = useQuery({
    queryKey: ["chargeHeads"],
    queryFn: async () => getChargeHeadsFn(),
  });

  const { data: ledgerRows = [], isLoading: loadingLedger } = useQuery({
    queryKey: ["ledger", selectedUnitId],
    queryFn: async () => getLedgerFn({ data: { unitId: selectedUnitId } }),
    enabled: !!selectedUnitId,
  });

  const generateBulk = useMutation({
    mutationFn: generateBulkChargesFn,
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      toast.success(`Generated charges for ${res.count} units`);
      setBulkDialogOpen(false);
      resetBulkForm();
    },
  });

  const generateManual = useMutation({
    mutationFn: createManualChargeFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      toast.success("Manual charge debited to unit ledger successfully");
      setManualDialogOpen(false);
      resetManualForm();
    },
  });

  const createHead = useMutation({
    mutationFn: createChargeHeadFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chargeHeads"] });
      toast.success("Charge category head created successfully");
      setHeadDialogOpen(false);
      setHeadName("");
      setHeadDesc("");
      setHeadAmt("");
    },
  });

  const resetBulkForm = () => {
    setChargeHeadId("");
    setBillingPeriod("");
    setAmount("");
    setDescription("");
  };

  const resetManualForm = () => {
    setChargeHeadId("");
    setAmount("");
    setDescription("");
  };

  const handleSubmitBulk = (e: React.FormEvent) => {
    e.preventDefault();
    generateBulk.mutate({
      data: { chargeHeadId, billingPeriod, amount: parseFloat(amount), description },
    });
  };

  const handleSubmitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnitId) return;
    generateManual.mutate({
      data: { unitId: selectedUnitId, chargeHeadId, amount: parseFloat(amount), description },
    });
  };

  const handleSubmitHead = (e: React.FormEvent) => {
    e.preventDefault();
    createHead.mutate({
      data: {
        name: headName,
        description: headDesc || undefined,
        defaultAmount: headAmt ? parseFloat(headAmt) : undefined,
      },
    });
  };

  return (
    <AppShell
      title="Billing Ledgers"
      subtitle="Manage housing maintenance charges and periodic unit balances"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
              <SelectTrigger className="w-64 border-border/70">
                <SelectValue placeholder="Select Unit Ledger..." />
              </SelectTrigger>
              <SelectContent>
                {units.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_path || `Unit ${u.unit_number} ${u.building_name && `(${u.building_name})`} ${u.block_name && `Block ${u.block_name}`}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedUnitId && (
              <PermissionGate moduleKey="ledger" action="create" fallback={null}>
                <Button
                  onClick={() => setManualDialogOpen(true)}
                  variant="outline"
                  size="sm"
                  className="gap-1"
                >
                  <PlusCircle className="size-4" /> Direct Debit
                </Button>
              </PermissionGate>
            )}
          </div>

          <div className="flex items-center gap-2">
            <PermissionGate moduleKey="ledger" action="create" fallback={null}>
              <Button
                onClick={() => setHeadDialogOpen(true)}
                variant="outline"
                size="sm"
                className="gap-1 border-border/70"
              >
                <Settings className="size-4" /> Setup Charge Heads
              </Button>
            </PermissionGate>
            <PermissionGate moduleKey="ledger" action="create" fallback={null}>
              <Button onClick={() => setBulkDialogOpen(true)} size="sm" className="gap-1">
                <FileSpreadsheet className="size-4" /> Run Monthly Charges
              </Button>
            </PermissionGate>
          </div>
        </header>

        {selectedUnitId ? (
          loadingLedger ? (
            <div className="flex justify-center py-20">
              <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <LedgerTable rows={ledgerRows} />
          )
        ) : (
          <div className="py-20 text-center text-muted-foreground text-sm border rounded-lg border-dashed border-border/70 bg-muted/10">
            Select a specific unit from the selector above to load transaction ledgers.
          </div>
        )}
      </div>

      {/* Setup Charge Heads Dialog */}
      <Dialog open={headDialogOpen} onOpenChange={setHeadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Setup Charge Head Category</DialogTitle>
            <DialogDescription>Define a new line-item billing classification</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitHead} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Category Name</label>
              <Input
                required
                value={headName}
                onChange={(e) => setHeadName(e.target.value)}
                placeholder="e.g. Electricity Surcharge"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Description</label>
              <Input value={headDesc} onChange={(e) => setHeadDesc(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Default Monthly Amount (Optional)
              </label>
              <Input type="number" value={headAmt} onChange={(e) => setHeadAmt(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setHeadDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Head</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Direct Manual Debit Dialog */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Debit Charge to Unit</DialogTitle>
            <DialogDescription>
              Apply a manual bill item to the selected ledger account
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitManual} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Charge Head</label>
                <Select value={chargeHeadId} onValueChange={setChargeHeadId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {chargeHeads.map((ch: any) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        {ch.name}
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
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Memo/Description
                </label>
                <Input
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setManualDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Debit Account</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Charges Cycle Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Run Billing Cycle</DialogTitle>
            <DialogDescription>
              Auto-generate maintenance bills for all units in this society
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitBulk} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Charge Category Head
                </label>
                <Select value={chargeHeadId} onValueChange={setChargeHeadId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {chargeHeads.map((ch: any) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        {ch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Billing Month (YYYY-MM)
                </label>
                <Input
                  required
                  value={billingPeriod}
                  onChange={(e) => setBillingPeriod(e.target.value)}
                  placeholder="e.g. 2026-07"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Cycle Amount (₨)
                </label>
                <Input
                  required
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">General Memo</label>
                <Input
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Monthly Maintenance Assessment"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBulkDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Execute Run</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
