import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
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
import {
  getBudgetsFn,
  createBudgetFn,
  getBudgetLineItemsFn,
  addBudgetLineItemFn,
} from "@/lib/api/budget";
import { toast } from "sonner";
import { DollarSign, Plus, Calculator, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/budget")({
  head: () => ({
    meta: [
      { title: "Budget Planning — HousingOS" },
      { name: "description", content: "Plan society annual budgets and monitor variances." },
    ],
  }),
  component: BudgetRoute,
});

function BudgetRoute() {
  return (
    <ModuleGate moduleKey="budget">
      <BudgetPage />
    </ModuleGate>
  );
}

function BudgetPage() {
  const queryClient = useQueryClient();
  const [selectedBudgetId, setSelectedBudgetId] = useState("");
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);

  // Forms
  const [year, setYear] = useState("");
  const [title, setTitle] = useState("");

  const [category, setCategory] = useState("");
  const [planned, setPlanned] = useState("");
  const [actual, setActual] = useState("");

  const { data: budgets = [], isLoading: loadingBudgets } = useQuery({
    queryKey: ["budgets"],
    queryFn: async () => getBudgetsFn(),
  });

  const { data: lineItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ["lineItems", selectedBudgetId],
    queryFn: async () => getBudgetLineItemsFn({ data: { budgetId: selectedBudgetId } }),
    enabled: !!selectedBudgetId,
  });

  const createBudget = useMutation({
    mutationFn: createBudgetFn,
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Budget plan initiated");
      setBudgetDialogOpen(false);
      setYear("");
      setTitle("");
      setSelectedBudgetId(res.id);
    },
  });

  const createLineItem = useMutation({
    mutationFn: addBudgetLineItemFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lineItems", selectedBudgetId] });
      toast.success("Budget line item added");
      setItemDialogOpen(false);
      setCategory("");
      setPlanned("");
      setActual("");
    },
  });

  const handleSubmitBudget = (e: React.FormEvent) => {
    e.preventDefault();
    createBudget.mutate({
      data: { year: parseInt(year), title },
    });
  };

  const handleSubmitItem = (e: React.FormEvent) => {
    e.preventDefault();
    createLineItem.mutate({
      data: {
        budgetId: selectedBudgetId,
        category,
        plannedAmount: parseFloat(planned),
        actualAmount: actual ? parseFloat(actual) : undefined,
      },
    });
  };

  const totals = lineItems.reduce(
    (acc, curr) => {
      acc.planned += Number(curr.planned_amount);
      acc.actual += Number(curr.actual_amount);
      return acc;
    },
    { planned: 0, actual: 0 },
  );

  return (
    <AppShell
      title="Budget Management"
      subtitle="Create annual allocations and reconcile actual ledger expenses"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Select value={selectedBudgetId} onValueChange={setSelectedBudgetId}>
              <SelectTrigger className="w-64 border-border/70">
                <SelectValue placeholder="Select Budget Plan..." />
              </SelectTrigger>
              <SelectContent>
                {budgets.map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.title} (FY {b.year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBudgetId && (
              <Button
                onClick={() => setItemDialogOpen(true)}
                variant="outline"
                size="sm"
                className="gap-1"
              >
                <Plus className="size-4" /> Add Item Category
              </Button>
            )}
          </div>

          <Button onClick={() => setBudgetDialogOpen(true)} size="sm" className="gap-1">
            <Calculator className="size-4" /> Plan Annual Budget
          </Button>
        </header>

        {selectedBudgetId ? (
          loadingItems ? (
            <div className="flex justify-center py-20">
              <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Financial summary banner */}
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="border-border/70 shadow-soft">
                  <CardContent className="p-5">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Total Budget Allocated
                    </div>
                    <div className="text-2xl font-serif font-bold mt-1">
                      ₨{totals.planned.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/70 shadow-soft">
                  <CardContent className="p-5">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Actual Expenditures
                    </div>
                    <div className="text-2xl font-serif font-bold mt-1">
                      ₨{totals.actual.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/70 shadow-soft">
                  <CardContent className="p-5">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Variance Margin
                    </div>
                    <div
                      className={`text-2xl font-serif font-bold mt-1 ${totals.actual > totals.planned ? "text-destructive" : "text-success"}`}
                    >
                      ₨
                      {(totals.planned - totals.actual).toLocaleString("en-PK", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Main Reconcile Table */}
              <Card className="border-border/70 shadow-soft">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                        <tr>
                          <th className="px-4 py-3 text-left">Category</th>
                          <th className="px-4 py-3 text-right">Planned allocation</th>
                          <th className="px-4 py-3 text-right">Actual Spent</th>
                          <th className="px-4 py-3 text-right">Variance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {lineItems.map((li: any) => {
                          const planAmt = Number(li.planned_amount);
                          const actAmt = Number(li.actual_amount);
                          const pct = planAmt ? (actAmt / planAmt) * 100 : 0;

                          let statusColor = "text-success";
                          if (pct > 115) statusColor = "text-destructive";
                          else if (pct > 105) statusColor = "text-warning-foreground";

                          return (
                            <tr key={li.id} className="hover:bg-muted/30">
                              <td className="px-4 py-3.5 font-medium">{li.category}</td>
                              <td className="px-4 py-3.5 text-right font-mono">
                                ₨{planAmt.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono">
                                ₨{actAmt.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                              </td>
                              <td
                                className={`px-4 py-3.5 text-right font-mono font-semibold ${statusColor}`}
                              >
                                {pct.toFixed(0)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        ) : (
          <div className="py-20 text-center text-muted-foreground text-sm border rounded-lg border-dashed border-border/70 bg-muted/10">
            Select a budget planning folder from the dropdown to run balance forecasts.
          </div>
        )}
      </div>

      {/* Plan Annual Budget Dialog */}
      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Plan Annual Budget</DialogTitle>
            <DialogDescription>Create a financial framework plan folder</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitBudget} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Fiscal Folder Title
              </label>
              <Input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Master Operations Budget"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Financial Year (YYYY)
              </label>
              <Input
                required
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2026"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBudgetDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Folder</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Line Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Add Budget Allocation</DialogTitle>
            <DialogDescription>Add a planned category allocation limits</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitItem} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Allocation Category
              </label>
              <Input
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Landscaping, Security Patrol, Pool Maintenance"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Planned Amount (₨)
                </label>
                <Input
                  required
                  type="number"
                  value={planned}
                  onChange={(e) => setPlanned(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Actual Spent (Optional)
                </label>
                <Input type="number" value={actual} onChange={(e) => setActual(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setItemDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Category</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
