import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Calendar,
  CheckCircle2,
  XCircle,
  Building,
  Loader2,
  Receipt,
  PieChart,
  BarChart3,
  RotateCcw,
  Check,
  RefreshCw,
  BrainCircuit,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAIFinanceInsightsFn,
  getAIFinanceSettingsFn,
  updateAIFinanceSettingsFn,
  runExpenseAnomalyScanFn,
  reviewAnomalyStatusFn,
  generateCashflowForecastFn,
  type SensitivityLevel,
  DEFAULT_AI_FINANCE_SETTINGS,
} from "@/lib/api/ai-finance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ai-finance")({
  head: () => ({
    meta: [
      { title: "AI Finance Intelligence — HousingOS" },
      {
        name: "description",
        content: "Deterministic statistical outlier detection, budget variance, and WMA cashflow forecasting.",
      },
    ],
  }),
  component: AIFinanceRoute,
});

function getCookieVal(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]*)"));
  return match ? match[2] : "";
}

function AIFinanceRoute() {
  return (
    <ModuleGate moduleKey="ai_finance">
      <AIFinanceDashboard />
    </ModuleGate>
  );
}

function AIFinanceDashboard() {
  const queryClient = useQueryClient();
  const selectedTenantId = getCookieVal("selected_tenant_id");
  const [activeTab, setActiveTab] = useState<string>("overview");

  // Query AI insights
  const {
    data: insightsData,
    isLoading: loadingInsights,
    refetch: refetchInsights,
    isRefetching: isRefetchingInsights,
  } = useQuery({
    queryKey: ["ai-finance-insights", selectedTenantId],
    queryFn: () => getAIFinanceInsightsFn({ data: { tenantId: selectedTenantId || undefined } }),
  });

  // Query Settings
  const {
    data: settingsData,
    isLoading: loadingSettings,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ["ai-finance-settings", selectedTenantId],
    queryFn: () => getAIFinanceSettingsFn({ data: { tenantId: selectedTenantId || undefined } }),
  });

  // Form State
  const [detectAnomalies, setDetectAnomalies] = useState(true);
  const [sensitivity, setSensitivity] = useState<SensitivityLevel>("medium");
  const [horizonMonths, setHorizonMonths] = useState(6);
  const [notifyTreasurer, setNotifyTreasurer] = useState(true);

  // Sync settings when loaded
  useEffect(() => {
    if (settingsData?.settings) {
      setDetectAnomalies(settingsData.settings.detectExpenseAnomalies);
      setSensitivity(settingsData.settings.anomalySensitivity);
      setHorizonMonths(settingsData.settings.cashflowForecastHorizonMonths);
      setNotifyTreasurer(settingsData.settings.notifyTreasurer);
    }
  }, [settingsData]);

  // Run Anomaly Scan Mutation
  const anomalyScanMutation = useMutation({
    mutationFn: runExpenseAnomalyScanFn,
    onSuccess: (res: any) => {
      if (res.flaggedCount > 0) {
        toast.success(`Scan Complete: ${res.flaggedCount} transaction(s) flagged for statistical variance!`);
      } else {
        toast.info("Scan Complete: No anomalous expenses detected across current ledger.");
      }
      refetchInsights();
    },
    onError: (err: any) => {
      toast.error(err instanceof Error ? err.message : "Scan failed");
    },
  });

  // Review Anomaly Mutation
  const reviewMutation = useMutation({
    mutationFn: reviewAnomalyStatusFn,
    onSuccess: () => {
      toast.success("Anomaly status updated");
      refetchInsights();
    },
    onError: (err: any) => {
      toast.error(err instanceof Error ? err.message : "Action failed");
    },
  });

  // Save Settings Mutation
  const saveSettingsMutation = useMutation({
    mutationFn: updateAIFinanceSettingsFn,
    onSuccess: () => {
      toast.success("AI Finance settings saved successfully");
      queryClient.invalidateQueries({ queryKey: ["ai-finance-settings"] });
      refetchSettings();
    },
    onError: (err: any) => {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    },
  });

  // Forecast Snapshot Mutation
  const forecastSnapshotMutation = useMutation({
    mutationFn: generateCashflowForecastFn,
    onSuccess: () => {
      toast.success("Cashflow forecast generated and saved");
      refetchInsights();
    },
    onError: (err: any) => {
      toast.error(err instanceof Error ? err.message : "Forecast failed");
    },
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsData || settingsData.isAllSocieties || !settingsData.tenantId) {
      toast.error("Please select a specific society to configure settings.");
      return;
    }
    saveSettingsMutation.mutate({
      data: {
        tenantId: settingsData.tenantId,
        detectExpenseAnomalies: detectAnomalies,
        anomalySensitivity: sensitivity,
        cashflowForecastHorizonMonths: horizonMonths,
        notifyTreasurer: notifyTreasurer,
      },
    });
  };

  const stats = insightsData?.stats;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8 pb-16 px-2 sm:px-4">
        {/* Page Header & Action Toolbar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-6 pt-2">
          <div className="flex items-center gap-3.5">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs shrink-0">
              <BrainCircuit className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  AI Finance Intelligence
                </h1>
                <Badge variant="secondary" className="font-mono text-xs px-2.5 py-0.5 font-medium">
                  Predictive Engine
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Deterministic statistical anomaly detection, budget variance, and WMA cashflow forecasting.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs border-border/80 hover:bg-muted cursor-pointer"
              onClick={() => {
                refetchInsights();
                refetchSettings();
              }}
              disabled={isRefetchingInsights || loadingInsights}
            >
              <RefreshCw className={cn("size-3.5 text-muted-foreground", (isRefetchingInsights || loadingInsights) && "animate-spin")} />
              Refresh
            </Button>

            <Button
              size="sm"
              disabled={anomalyScanMutation.isPending || insightsData?.isAllSocieties}
              onClick={() => {
                if (insightsData?.tenantId) {
                  anomalyScanMutation.mutate({ data: { tenantId: insightsData.tenantId } });
                } else {
                  toast.info("Please select a specific society to run expense anomaly scan.");
                }
              }}
              className="h-9 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer px-4"
            >
              {anomalyScanMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Zap className="size-3.5 text-amber-300" />
              )}
              Run Expense Anomaly Scan
            </Button>
          </div>
        </div>

        {insightsData?.isAllSocieties && (
          <Card className="border-amber-500/30 bg-amber-500/5 shadow-soft rounded-2xl">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600 border border-amber-500/20 shrink-0">
                <Building className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif font-bold text-foreground text-sm">
                  Platform-Wide Financial Mode
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Showing aggregate financial projections across all managed societies. To customize sensitivity levels or perform society-specific outlier audits, select a specific society from the dropdown at the top.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 4 KPI Summary Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Financial Health
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-emerald-600 mt-2 truncate">
                  {stats?.financialHealthScore ?? 100} <span className="text-sm font-sans font-normal text-muted-foreground">/ 100</span>
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                <Sparkles className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Flagged Anomalies
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-amber-600 mt-2 truncate">
                  {stats?.activeAnomaliesCount ?? 0}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0">
                <AlertTriangle className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Budget Overrun Alerts
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-destructive mt-2 truncate">
                  {stats?.overBudgetCount ?? 0}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
                <Receipt className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Next Month Surplus
                </p>
                <p className={cn(
                  "font-serif text-2xl font-bold tracking-tight mt-2 truncate",
                  (stats?.nextMonthProjectedCashflow ?? 0) >= 0 ? "text-emerald-600" : "text-destructive"
                )}>
                  ₨ {(stats?.nextMonthProjectedCashflow ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                {(stats?.nextMonthProjectedCashflow ?? 0) >= 0 ? (
                  <TrendingUp className="size-5.5 text-emerald-600" />
                ) : (
                  <TrendingDown className="size-5.5 text-destructive" />
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/60 p-1 rounded-xl border border-border/70 h-auto flex flex-wrap">
            <TabsTrigger value="overview" className="gap-2 text-xs py-2 px-3.5 rounded-lg cursor-pointer">
              <Sparkles className="size-3.5" /> Executive Dashboard
            </TabsTrigger>
            <TabsTrigger value="anomalies" className="gap-2 text-xs py-2 px-3.5 rounded-lg cursor-pointer">
              <AlertTriangle className="size-3.5" /> Expense Anomalies
              {stats?.activeAnomaliesCount ? (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 font-mono text-amber-600 bg-amber-500/10">
                  {stats.activeAnomaliesCount}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="budget" className="gap-2 text-xs py-2 px-3.5 rounded-lg cursor-pointer">
              <PieChart className="size-3.5" /> Budget Variance
            </TabsTrigger>
            <TabsTrigger value="forecasts" className="gap-2 text-xs py-2 px-3.5 rounded-lg cursor-pointer">
              <BarChart3 className="size-3.5" /> Cashflow Forecasts
            </TabsTrigger>
            <TabsTrigger value="configuration" className="gap-2 text-xs py-2 px-3.5 rounded-lg cursor-pointer">
              <RotateCcw className="size-3.5" /> Engine Configuration
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: EXECUTIVE DASHBOARD */}
          <TabsContent value="overview" className="space-y-6 pt-2">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Monthly Burn Rate & Reserves */}
              <Card className="border-border/70 shadow-soft rounded-2xl bg-card">
                <CardHeader className="p-6 pb-4">
                  <CardTitle className="text-base font-serif font-bold text-foreground">
                    Monthly Burn Rate & Reserves
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Historical 3-month expense velocity and operational burn rate
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4">
                  <div className="rounded-xl border border-border/70 p-4 bg-muted/20">
                    <div className="text-xs text-muted-foreground">Average Monthly Operating Expense</div>
                    <div className="text-2xl font-serif font-bold text-foreground mt-1">
                      ₨ {(stats?.monthlyBurnRate ?? 0).toLocaleString()}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span>Budget Health Breakdown</span>
                      <span className="text-muted-foreground font-mono text-[11px]">
                        {stats?.budgetVariances?.length ?? 0} active categories
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-center">
                        <div className="text-base font-bold text-emerald-600">
                          {stats?.budgetVariances?.filter((b: any) => b.status === "normal").length ?? 0}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Within Budget</div>
                      </div>
                      <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-center">
                        <div className="text-base font-bold text-amber-600">
                          {stats?.warningBudgetCount ?? 0}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Warning (80-99%)</div>
                      </div>
                      <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-center">
                        <div className="text-base font-bold text-destructive">
                          {stats?.overBudgetCount ?? 0}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Over-budget (≥100%)</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Outliers Snapshot */}
              <Card className="border-border/70 shadow-soft rounded-2xl bg-card">
                <CardHeader className="p-6 pb-4">
                  <CardTitle className="text-base font-serif font-bold text-foreground">
                    Active Outliers Snapshot
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Latest vendor invoices and ledger entries flagged for anomalous amounts
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  {stats?.anomalies && stats.anomalies.length > 0 ? (
                    <div className="divide-y divide-border/60 border border-border/70 rounded-xl overflow-hidden bg-card">
                      {stats.anomalies.slice(0, 4).map((a: any) => (
                        <div key={a.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors">
                          <div className="space-y-0.5">
                            <div className="font-semibold text-foreground">{a.vendor_name || a.category}</div>
                            <div className="text-muted-foreground text-[11px] font-mono">
                              Expected: ₨ {Number(a.expected_range_min).toLocaleString()} - ₨ {Number(a.expected_range_max).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-right space-y-0.5">
                            <div className="font-bold text-destructive font-mono">₨ {Number(a.amount).toLocaleString()}</div>
                            <Badge variant="outline" className="text-[9px] font-mono bg-destructive/5 text-destructive border-destructive/20">
                              Score: {a.anomaly_score}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                      <Check className="mx-auto size-7 text-emerald-500 mb-1.5" />
                      No active expense anomalies detected. All spending aligns with baseline.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: EXPENSE ANOMALIES */}
          <TabsContent value="anomalies" className="space-y-6 pt-2">
            <Card className="border-border/70 shadow-soft rounded-2xl bg-card">
              <CardHeader className="p-6 pb-4">
                <CardTitle className="text-base font-serif font-bold text-foreground">
                  Flagged Expense Anomalies
                </CardTitle>
                <CardDescription className="text-xs">
                  Vendor invoices and ledger entries analyzed using deterministic sample standard deviation (Z-score)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                {stats?.anomalies && stats.anomalies.length > 0 ? (
                  <div className="divide-y divide-border/60 border border-border/70 rounded-xl overflow-hidden bg-card">
                    {stats.anomalies.map((anom: any) => (
                      <div
                        key={anom.id}
                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/30 transition-colors"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1 pr-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-serif text-sm font-bold text-foreground">{anom.vendor_name || "Invoice"}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {anom.category || "General"}
                            </Badge>
                            <Badge
                              variant={anom.anomaly_score >= 80 ? "destructive" : "secondary"}
                              className="text-[10px] font-mono font-bold"
                            >
                              Score: {anom.anomaly_score}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] capitalize font-medium",
                                anom.status === "reviewed"
                                  ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/5"
                                  : anom.status === "dismissed"
                                  ? "text-muted-foreground"
                                  : "text-amber-600 border-amber-500/30 bg-amber-500/5"
                              )}
                            >
                              {anom.status}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            Amount: <span className="font-bold text-foreground">₨ {Number(anom.amount).toLocaleString()}</span> • Expected: ₨ {Number(anom.expected_range_min).toLocaleString()} - ₨ {Number(anom.expected_range_max).toLocaleString()} • Deviation: <span className="text-destructive font-bold">+₨ {Number(anom.deviation_amount).toLocaleString()}</span>
                          </div>
                          <div className="text-xs text-muted-foreground italic leading-relaxed">
                            {anom.explanation}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {anom.status === "flagged" && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs gap-1 h-8 cursor-pointer"
                                disabled={reviewMutation.isPending}
                                onClick={() =>
                                  reviewMutation.mutate({
                                    data: { anomalyId: anom.id, action: "dismissed" },
                                  })
                                }
                              >
                                <XCircle className="size-3.5 text-muted-foreground" /> Dismiss
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs gap-1 h-8 text-emerald-600 hover:bg-emerald-50 border-emerald-500/30 cursor-pointer"
                                disabled={reviewMutation.isPending}
                                onClick={() =>
                                  reviewMutation.mutate({
                                    data: { anomalyId: anom.id, action: "reviewed" },
                                  })
                                }
                              >
                                <CheckCircle2 className="size-3.5" /> Mark Reviewed
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-14 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                    <Check className="mx-auto size-8 text-emerald-500 mb-2" />
                    No anomalous transactions currently flagged for this society.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: BUDGET VARIANCE */}
          <TabsContent value="budget" className="space-y-6 pt-2">
            <Card className="border-border/70 shadow-soft rounded-2xl bg-card">
              <CardHeader className="p-6 pb-4">
                <CardTitle className="text-base font-serif font-bold text-foreground">
                  Budget Variance Intelligence
                </CardTitle>
                <CardDescription className="text-xs">
                  Category utilization thresholds (&lt;80% Normal, 80-99% Warning, &ge;100% Critical)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                {stats?.budgetVariances && stats.budgetVariances.length > 0 ? (
                  <div className="space-y-4">
                    {stats.budgetVariances.map((item: any) => {
                      const isCritical = item.status === "critical";
                      const isWarning = item.status === "warning";

                      return (
                        <div key={item.id} className="rounded-xl border border-border/70 p-4 space-y-2.5 bg-muted/20">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                              <span className="font-serif text-sm font-bold capitalize text-foreground">{item.category}</span>
                              <Badge
                                variant={isCritical ? "destructive" : isWarning ? "secondary" : "outline"}
                                className="ml-2 text-[10px] capitalize font-mono font-bold"
                              >
                                {item.status} ({item.utilizationPercentage}%)
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              Planned: <span className="font-semibold text-foreground">₨ {item.plannedAmount.toLocaleString()}</span> • Actual: <span className="font-semibold text-foreground">₨ {item.actualAmount.toLocaleString()}</span> • Variance: <span className={item.variance > 0 ? "text-destructive font-bold" : "text-emerald-600 font-bold"}>{item.variance > 0 ? `+₨ ${item.variance.toLocaleString()}` : `₨ ${item.variance.toLocaleString()}`}</span>
                            </div>
                          </div>

                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-300",
                                isCritical ? "bg-destructive" : isWarning ? "bg-amber-500" : "bg-emerald-500"
                              )}
                              style={{ width: `${Math.min(100, item.utilizationPercentage)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-14 text-center border border-dashed rounded-xl">
                    No active budget line items found for the current fiscal year.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: FORECASTS */}
          <TabsContent value="forecasts" className="space-y-6 pt-2">
            <Card className="border-border/70 shadow-soft rounded-2xl bg-card">
              <CardHeader className="p-6 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-serif font-bold text-foreground">
                    Deterministic Cashflow Forecasting
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Weighted Moving Average (WMA) with dampened linear trend projections
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={forecastSnapshotMutation.isPending}
                  onClick={() => {
                    if (insightsData?.tenantId) {
                      forecastSnapshotMutation.mutate({ data: { tenantId: insightsData.tenantId } });
                    }
                  }}
                  className="gap-2 text-xs h-8 rounded-xl cursor-pointer"
                >
                  {forecastSnapshotMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Calendar className="size-3.5" />
                  )}
                  Save Forecast Snapshot
                </Button>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                {stats?.forecasts && stats.forecasts.length > 0 ? (
                  <div className="divide-y divide-border/60 border border-border/70 rounded-xl overflow-hidden bg-card">
                    {stats.forecasts.map((fc: any) => (
                      <div key={fc.month} className="p-4 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors">
                        <div>
                          <div className="font-serif text-sm font-bold text-foreground">{fc.month}</div>
                          <div className="text-muted-foreground text-[11px] font-mono">
                            Confidence Band: ₨ {fc.confidenceLow.toLocaleString()} - ₨ {fc.confidenceHigh.toLocaleString()}
                          </div>
                        </div>
                        <div className="flex gap-6 text-right font-mono">
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase font-sans">Projected Income</div>
                            <div className="font-semibold text-emerald-600">₨ {fc.predictedIncome.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase font-sans">Projected Expense</div>
                            <div className="font-semibold text-foreground">₨ {fc.predictedExpense.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase font-sans">Net Cashflow</div>
                            <div className={cn("font-bold", fc.netCashflow >= 0 ? "text-emerald-600" : "text-destructive")}>
                              ₨ {fc.netCashflow.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-14 text-center border border-dashed rounded-xl">
                    Insufficient historical collections to model cashflow projection.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: CONFIGURATION */}
          <TabsContent value="configuration" className="space-y-6 pt-2">
            <Card className="border-border/70 shadow-soft rounded-2xl bg-card">
              <CardHeader className="p-6 pb-4">
                <CardTitle className="text-base font-serif font-bold text-foreground">
                  AI Finance Rules & Anomaly Sensitivity
                </CardTitle>
                <CardDescription className="text-xs">
                  Customize statistical outlier sensitivity and forecasting parameters for this society
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <form onSubmit={handleSaveSettings} className="space-y-6 max-w-xl">
                  <div className="flex items-center justify-between py-3 border-b border-border/60">
                    <div>
                      <Label className="text-xs font-bold text-foreground">Detect Expense Anomalies</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Automatically screen vendor invoices and expense ledger entries against statistical baselines
                      </p>
                    </div>
                    <Switch checked={detectAnomalies} onCheckedChange={setDetectAnomalies} />
                  </div>

                  <div className="space-y-2 py-3 border-b border-border/60">
                    <Label className="text-xs font-bold text-foreground">Anomaly Sensitivity</Label>
                    <p className="text-xs text-muted-foreground">
                      Lower sensitivity requires larger statistical deviation (3.0σ) before flagging; High flags moderate variance (1.5σ)
                    </p>
                    <Select
                      value={sensitivity}
                      onValueChange={(val: any) => setSensitivity(val as SensitivityLevel)}
                    >
                      <SelectTrigger className="w-56 text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low" className="text-xs">Low Sensitivity (3.0σ)</SelectItem>
                        <SelectItem value="medium" className="text-xs">Medium Sensitivity (2.0σ)</SelectItem>
                        <SelectItem value="high" className="text-xs">High Sensitivity (1.5σ)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 py-3 border-b border-border/60">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-bold text-foreground">Forecast Horizon (Months)</Label>
                      <span className="font-mono text-xs font-bold text-primary">{horizonMonths} months</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Number of future months to project cashflow using Weighted Moving Average
                    </p>
                    <Input
                      type="number"
                      min={3}
                      max={12}
                      value={horizonMonths}
                      onChange={(e) => setHorizonMonths(Number(e.target.value))}
                      className="w-32 text-xs h-9 font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-border/60">
                    <div>
                      <Label className="text-xs font-bold text-foreground">Notify Treasurer on High Severity Anomaly</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Dispatch in-app notifications to users with the Treasurer role when critical outliers are detected
                      </p>
                    </div>
                    <Switch checked={notifyTreasurer} onCheckedChange={setNotifyTreasurer} />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="submit"
                      disabled={saveSettingsMutation.isPending}
                      className="gap-2 h-9 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl cursor-pointer"
                    >
                      {saveSettingsMutation.isPending && (
                        <Loader2 className="size-3.5 animate-spin" />
                      )}
                      Save Configuration
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
