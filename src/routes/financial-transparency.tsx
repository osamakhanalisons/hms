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
import { cn } from "@/lib/utils";

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
    default: "text-primary bg-primary/10 border-primary/20",
    success: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
    destructive: "text-rose-600 bg-rose-500/10 border-rose-500/20",
    warning: "text-amber-600 bg-amber-500/10 border-amber-500/20",
    info: "text-sky-600 bg-sky-500/10 border-sky-500/20",
  }[tone];

  return (
    <Card className="border-border/70 shadow-sm hover:shadow-md transition-shadow bg-card">
      <CardContent className="p-5 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <div className="mt-1 h-7 w-28 animate-pulse rounded-md bg-muted" />
          ) : (
            <>
              <p className="font-serif text-2xl font-bold tracking-tight text-foreground">{value}</p>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </>
          )}
        </div>
        <div className={cn("grid size-11 place-items-center rounded-xl border shrink-0", toneClasses)}>
          <Icon className="size-5" />
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
    >
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        {/* Page Header & Action Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Eye className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
                  Income & Expense Statement
                </h1>
                <Badge variant="secondary" className="font-mono text-xs font-semibold px-2 py-0.5">
                  FY {selectedYear}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Public financial transparency statement, income, expenses, and budget variance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Select
              value={String(selectedYear)}
              onValueChange={(val) => setSelectedYear(Number(val))}
            >
              <SelectTrigger className="h-9 w-32 text-xs bg-background">
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
              className="h-9 gap-1.5 text-xs bg-background"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw
                className={cn("size-3.5", isRefetching && "animate-spin")}
              />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

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
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <Card className="border-border/70 shadow-sm bg-card">
            <CardHeader className="p-5 pb-3 border-b bg-muted/15">
              <CardTitle className="flex items-center gap-2 font-serif text-base font-bold">
                <FileSpreadsheet className="size-4 text-primary" />
                Monthly Breakdown ({selectedYear})
              </CardTitle>
              <CardDescription className="text-xs">
                Collections vs Total Charges by month
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
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
                <div className="space-y-2">
                  {data.monthlyTrend.map((m) => {
                    const maxVal = Math.max(
                      ...data.monthlyTrend.map((t) => Math.max(t.income, t.billed, 1)),
                    );
                    const incomePct = Math.min(100, Math.round((m.income / maxVal) * 100));

                    return (
                      <div key={m.monthKey} className="space-y-1.5 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="font-semibold text-foreground">{m.label}</span>
                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="text-emerald-600 font-semibold">
                              Collected: {formatCurrency(m.income)}
                            </span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-muted-foreground">
                              Billed: {formatCurrency(m.billed)}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/70">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
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
          <Card className="border-border/70 shadow-sm bg-card">
            <CardHeader className="p-5 pb-3 border-b bg-muted/15">
              <CardTitle className="flex items-center gap-2 font-serif text-base font-bold">
                <PieChart className="size-4 text-primary" />
                Category Expense Variance
              </CardTitle>
              <CardDescription className="text-xs">
                Budgeted planned amount vs actual spending by category
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
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
                <div className="space-y-2">
                  {data.expenseBreakdown.map((exp) => {
                    const isOverBudget = exp.actual > exp.planned && exp.planned > 0;
                    const percentUsed = exp.planned > 0 ? Math.round((exp.actual / exp.planned) * 100) : (exp.actual > 0 ? 100 : 0);
                    return (
                      <div key={exp.category} className="space-y-1.5 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold capitalize text-foreground">{exp.category}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0",
                                isOverBudget
                                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200/50"
                                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/50"
                              )}
                            >
                              {percentUsed}%
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="text-muted-foreground">
                              Planned: {formatCurrency(exp.planned)}
                            </span>
                            <span className="text-muted-foreground">·</span>
                            <span
                              className={`font-semibold ${isOverBudget ? "text-rose-600" : "text-emerald-600"}`}
                            >
                              Actual: {formatCurrency(exp.actual)}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/70">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              isOverBudget ? "bg-rose-500" : "bg-emerald-500"
                            )}
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
