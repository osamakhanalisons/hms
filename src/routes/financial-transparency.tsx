import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo, Fragment } from "react";
import { formatDistanceToNow, parseISO, format } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Wallet,
  PieChart,
  Calendar,
  RefreshCw,
  Eye,
  ShieldAlert,
  CheckCircle2,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { ModuleGate } from "@/components/module-gate";
import { getFinancialTransparencyFn } from "@/lib/api/financial-transparency";

export const Route = createFileRoute("/financial-transparency")({
  head: () => ({
    meta: [
      { title: "Financial Transparency — HousingOS" },
      {
        name: "description",
        content: "Public financial transparency statement, income, expenses, and budget variance.",
      },
    ],
  }),
  component: FinancialTransparencyRoute,
});

function FinancialTransparencyRoute() {
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
      <AppShell title="Access Denied" subtitle="Financial Transparency">
        <div className="mx-auto max-w-md py-16 text-center space-y-4">
          <ShieldAlert className="size-12 mx-auto text-destructive" />
          <h2 className="text-lg font-bold font-serif">Authentication Required</h2>
          <p className="text-sm text-muted-foreground">
            Please log in to access your society's financial statements.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <ModuleGate moduleKey="financial_transparency">
      <FinancialTransparencyPage />
    </ModuleGate>
  );
}

function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  tone = "default",
  loading = false,
}: {
  label: string;
  value: string;
  subtitle?: string;
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
              <>
                <p className="mt-1 font-serif text-2xl font-bold tracking-tight">{value}</p>
                {subtitle && <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>}
              </>
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

function formatCurrency(amount: number) {
  return "₨" + Math.round(amount).toLocaleString("en-PK");
}

function FinancialTransparencyPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["financial-transparency", selectedYear],
    queryFn: () => getFinancialTransparencyFn({ data: { year: selectedYear } }),
    staleTime: 30_000,
  });

  const availableYears = data?.availableYears ?? [currentYear];

  const [txPage, setTxPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setTxPage(1);
  }, [selectedYear]);

  const totalTxItems = data?.recentTransactions?.length ?? 0;
  const totalTxPages = Math.ceil(totalTxItems / itemsPerPage) || 1;

  const paginatedTransactions = useMemo(() => {
    const start = (txPage - 1) * itemsPerPage;
    return (data?.recentTransactions ?? []).slice(start, start + itemsPerPage);
  }, [data?.recentTransactions, txPage]);

  return (
    <AppShell
      title="Financial Transparency"
      subtitle="Public income, expense statements, and budget variance"
      actions={
        <div className="flex items-center gap-2">
          <Select
            value={String(selectedYear)}
            onValueChange={(val) => setSelectedYear(Number(val))}
          >
            <SelectTrigger className="h-8 w-32 text-xs">
              <Calendar className="mr-1.5 size-3.5 text-muted-foreground" />
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((yr) => (
                <SelectItem key={yr} value={String(yr)} className="text-xs">
                  Year {yr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw
              className={`size-3 text-muted-foreground ${isRefetching ? "animate-spin" : ""}`}
            />
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
              <Eye className="size-5 text-primary" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Finance · Transparency
              </div>
              <h1 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
                Income & Expense Statement ({selectedYear})
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
                Failed to load financial records:{" "}
                {error instanceof Error ? error.message : "Unknown error"}
              </p>
            </div>
          </div>
        )}

        {/* KPI Grid */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Collected (Income)"
            value={formatCurrency(data?.totalIncome ?? 0)}
            subtitle={`Billed: ${formatCurrency(data?.totalBilled ?? 0)}`}
            icon={TrendingUp}
            tone="success"
            loading={isLoading}
          />
          <KpiCard
            label="Total Expenses"
            value={formatCurrency(data?.totalExpenses ?? 0)}
            subtitle="Budgets & Purchase Orders"
            icon={TrendingDown}
            tone="destructive"
            loading={isLoading}
          />
          <KpiCard
            label="Net Balance (Surplus)"
            value={formatCurrency(data?.netSurplus ?? 0)}
            subtitle={(data?.netSurplus ?? 0) >= 0 ? "Positive Cash Flow" : "Deficit"}
            icon={Wallet}
            tone={(data?.netSurplus ?? 0) >= 0 ? "info" : "destructive"}
            loading={isLoading}
          />
          <KpiCard
            label="Collection Efficiency"
            value={`${data?.collectionRate ?? 0}%`}
            subtitle="Collections vs Charges"
            icon={Receipt}
            tone="warning"
            loading={isLoading}
          />
        </section>

        {/* Expense Breakdown & Monthly Collections Grid */}
        <section className="grid gap-6 lg:grid-cols-2">
          {/* Monthly Collections Trend */}
          <Card className="border-border/70 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-serif text-base font-bold">
                <FileSpreadsheet className="size-4 text-muted-foreground" />
                Monthly Breakdown ({selectedYear})
              </CardTitle>
              <CardDescription className="text-[11px]">
                Collections vs Total Charges by month
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-8 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              ) : !data?.monthlyTrend?.length ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Clock className="size-8 opacity-40 mb-2" />
                  <p className="text-sm">No monthly data available for {selectedYear}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.monthlyTrend.map((m) => {
                    const maxVal = Math.max(
                      ...data.monthlyTrend.map((t) => Math.max(t.income, t.billed, 1)),
                    );
                    const incomePct = Math.min(100, Math.round((m.income / maxVal) * 100));
                    const billedPct = Math.min(100, Math.round((m.billed / maxVal) * 100));

                    return (
                      <div key={m.monthKey} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span>{m.label}</span>
                          <span className="text-muted-foreground">
                            Collected: {formatCurrency(m.income)} / Billed:{" "}
                            {formatCurrency(m.billed)}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted flex">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-300"
                            style={{ width: `${incomePct}%` }}
                            title={`Collected: ${formatCurrency(m.income)}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expense Breakdown */}
          <Card className="border-border/70 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-serif text-base font-bold">
                <PieChart className="size-4 text-muted-foreground" />
                Category Expense Variance
              </CardTitle>
              <CardDescription className="text-[11px]">
                Budgeted planned amount vs actual spending by category
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-8 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              ) : !data?.expenseBreakdown?.length ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <PieChart className="size-8 opacity-40 mb-2" />
                  <p className="text-sm">No expense categories budgeted for {selectedYear}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.expenseBreakdown.map((exp) => {
                    const isOverBudget = exp.actual > exp.planned && exp.planned > 0;
                    return (
                      <div key={exp.category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium capitalize">{exp.category}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              Planned: {formatCurrency(exp.planned)}
                            </span>
                            <span
                              className={`font-bold ${isOverBudget ? "text-rose-600" : "text-emerald-600"}`}
                            >
                              Actual: {formatCurrency(exp.actual)}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isOverBudget ? "bg-rose-500" : "bg-emerald-500"
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round(
                                  (exp.actual / Math.max(exp.planned, exp.actual, 1)) * 100,
                                ),
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Recent Financial Transactions Table */}
        <Card className="border-border/70 shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base font-bold">
              Recent Financial Activity
            </CardTitle>
            <CardDescription className="text-[11px]">
              Latest collection receipts and maintenance charges logged in the ledger
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="divide-y divide-border/60">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-4">
                    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : !data?.recentTransactions?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Receipt className="size-8 opacity-40 mb-2" />
                <p className="text-sm">No recent transactions recorded</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-border/60 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Unit</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {paginatedTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            {tx.type === "income" ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-500/10 text-emerald-600 border-transparent"
                              >
                                <ArrowUpRight className="mr-1 size-3" /> Income
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-blue-500/10 text-blue-600 border-transparent"
                              >
                                <ArrowDownRight className="mr-1 size-3" /> Charge
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium">{tx.description}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {tx.unitNumber ? `Unit ${tx.unitNumber}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {(() => {
                              try {
                                return format(parseISO(tx.date), "dd MMM yyyy");
                              } catch {
                                return tx.date;
                              }
                            })()}
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            <span
                              className={
                                tx.type === "income" ? "text-emerald-600" : "text-foreground"
                              }
                            >
                              {tx.type === "income" ? "+" : ""}
                              {formatCurrency(tx.amount)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalTxItems > itemsPerPage && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/70 p-4 text-xs text-muted-foreground">
                    <div>
                      Showing{" "}
                      <span className="font-semibold text-foreground">
                        {(txPage - 1) * itemsPerPage + 1}
                      </span>{" "}
                      to{" "}
                      <span className="font-semibold text-foreground">
                        {Math.min(txPage * itemsPerPage, totalTxItems)}
                      </span>{" "}
                      of{" "}
                      <span className="font-semibold text-foreground">
                        {totalTxItems.toLocaleString()}
                      </span>{" "}
                      transactions
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={txPage === 1}
                        onClick={() => setTxPage((p) => Math.max(p - 1, 1))}
                        className="h-8 text-xs px-2.5 border-border/70 bg-background"
                      >
                        Previous
                      </Button>

                      {Array.from({ length: totalTxPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalTxPages || Math.abs(p - txPage) <= 2)
                        .map((p, idx, arr) => {
                          const prev = arr[idx - 1];
                          return (
                            <Fragment key={p}>
                              {prev && p - prev > 1 && (
                                <span className="text-xs text-muted-foreground px-1">...</span>
                              )}
                              <Button
                                variant={p === txPage ? "default" : "outline"}
                                size="sm"
                                onClick={() => setTxPage(p)}
                                className="h-8 w-8 text-xs p-0 font-medium border-border/70"
                              >
                                {p}
                              </Button>
                            </Fragment>
                          );
                        })}

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={txPage === totalTxPages}
                        onClick={() => setTxPage((p) => Math.min(p + 1, totalTxPages))}
                        className="h-8 text-xs px-2.5 border-border/70 bg-background"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
