import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAIMaintenanceInsightsFn } from "@/lib/api/ai-maintenance";
import { toast } from "sonner";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Calendar,
  RefreshCw,
  Package,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Target,
  BarChart3,
  Wrench,
  ShieldAlert,
  Building,
  Zap,
  DollarSign,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ai-maintenance")({
  head: () => ({
    meta: [
      { title: "AI Maintenance Intelligence — HousingOS" },
      {
        name: "description",
        content: "AI-powered maintenance analytics, risk assessment and preventive recommendations.",
      },
    ],
  }),
  component: AIMaintenanceRoute,
});

function getCookieVal(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]*)"));
  return match ? match[2] : "";
}

function safeFormatDate(dateVal: any, formatStr: string, fallback = "—"): string {
  if (!dateVal) return fallback;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return fallback;
    return format(d, formatStr);
  } catch {
    return fallback;
  }
}

function AIMaintenanceRoute() {
  return (
    <ModuleGate moduleKey="ai_maintenance">
      <AIMaintenancePage />
    </ModuleGate>
  );
}

function AIMaintenancePage() {
  const queryClient = useQueryClient();
  const selectedTenantId = getCookieVal("selected_tenant_id");
  const [activeTab, setActiveTab] = useState<string>("overview");

  const { data: insights, isLoading, error, isFetching, refetch } = useQuery({
    queryKey: ["ai-maintenance-insights", selectedTenantId],
    queryFn: () =>
      getAIMaintenanceInsightsFn({ data: { tenantId: selectedTenantId || undefined } }),
  });

  const handleRefresh = async () => {
    toast.info("Running fresh AI maintenance analysis...");
    try {
      await getAIMaintenanceInsightsFn({
        data: { tenantId: selectedTenantId || undefined, refresh: true },
      });
      queryClient.invalidateQueries({ queryKey: ["ai-maintenance-insights", selectedTenantId] });
      toast.success("Analysis updated and cached!");
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    }
  };

  const getRiskBadge = (level: string) => {
    const colors: Record<string, string> = {
      low: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
      medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
      high: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
      critical: "bg-destructive/10 text-destructive border-destructive/20",
    };
    return (
      <Badge
        variant="outline"
        className={cn("text-[10px] font-bold uppercase font-mono px-2 py-0.5", colors[level] || "")}
      >
        {level}
      </Badge>
    );
  };

  const getHealthColor = (status: string) => {
    const colors: Record<string, string> = {
      excellent: "text-emerald-600 dark:text-emerald-400",
      good: "text-emerald-500",
      fair: "text-amber-500",
      poor: "text-orange-500",
      critical: "text-destructive",
    };
    return colors[status] || "text-muted-foreground";
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="max-w-7xl mx-auto space-y-8 pb-16 px-2 sm:px-4">
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="size-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              AI is analyzing your maintenance data...
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (insights?.isAllSocieties) {
    return (
      <AppShell>
        <div className="max-w-7xl mx-auto space-y-8 pb-16 px-2 sm:px-4">
          <div className="border-b border-border/80 pb-6 pt-2">
            <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              AI Maintenance Intelligence
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Predictive asset health analytics, SLA breach risk assessment, and automated preventive recommendations.
            </p>
          </div>
          <Card className="border-amber-500/30 bg-amber-500/5 shadow-soft rounded-2xl">
            <CardContent className="flex items-start gap-4 p-6">
              <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600 border border-amber-500/20 shrink-0">
                <Building className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif font-bold text-foreground text-sm">
                  All Societies (Platform-wide) Mode
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You currently have &ldquo;All Societies&rdquo; selected. Predictive asset maintenance analysis is computed per-society. Please choose a specific society from the dropdown at the top of the screen.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="max-w-7xl mx-auto space-y-8 pb-16 px-2 sm:px-4">
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="grid size-16 place-items-center rounded-2xl bg-destructive/10 text-destructive">
              <XCircle className="size-8" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-serif font-semibold text-lg text-foreground">Failed to Load AI Insights</h3>
              <p className="text-xs text-muted-foreground">
                {(error as any)?.message || "Unable to generate maintenance intelligence"}
              </p>
              <Button onClick={handleRefresh} variant="outline" size="sm" className="mt-4 gap-2">
                <RefreshCw className="size-3.5" /> Try Again
              </Button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!insights) return null;

  const stats = insights.statistics || {
    totalAssets: 0,
    activeWorkOrders: 0,
    overdueWorkOrders: 0,
    completedWorkOrders: 0,
    avgCompletionDays: 0,
    slaComplianceRate: 100,
    totalMaintenanceCost: 0,
  };
  const highRiskAssets = Array.isArray(insights.highRiskAssets) ? insights.highRiskAssets : [];
  const slaRiskWorkOrders = Array.isArray(insights.slaRiskWorkOrders) ? insights.slaRiskWorkOrders : [];
  const costAnalysis = insights.costAnalysis || {
    totalMaintenanceCost: 0,
    avgCostPerWorkOrder: 0,
    highestCostAsset: null,
    costByCategory: [],
    costByVendor: [],
    monthlyCostTrend: [],
  };
  const recurringPatterns = Array.isArray(insights.recurringPatterns) ? insights.recurringPatterns : [];
  const preventiveRecommendations = Array.isArray(insights.preventiveRecommendations)
    ? insights.preventiveRecommendations
    : [];

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8 pb-16 px-2 sm:px-4">
        {/* Page Header & Action Toolbar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-6 pt-2">
          <div className="flex items-center gap-3.5">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs shrink-0">
              <Wrench className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  AI Maintenance Intelligence
                </h1>
                <Badge variant="secondary" className="font-mono text-xs px-2.5 py-0.5 font-medium">
                  Predictive Diagnostics
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Predictive asset health analytics, SLA breach risk assessment, and automated preventive recommendations.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs border-border/80 hover:bg-muted cursor-pointer"
              onClick={handleRefresh}
              disabled={isFetching}
            >
              <RefreshCw className={cn("size-3.5 text-muted-foreground", isFetching && "animate-spin")} />
              Refresh
            </Button>

            <Button
              size="sm"
              disabled={isFetching}
              onClick={handleRefresh}
              className="h-9 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer px-4"
            >
              <Zap className="size-3.5 text-amber-300" />
              Run Diagnostics Scan
            </Button>
          </div>
        </div>

        {/* Overall Health Score Card */}
        <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 via-background to-background p-6 sm:p-8 shadow-soft">
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                  <Sparkles className="size-5" />
                </div>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-foreground">Maintenance Health Overview</h2>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
                {insights.summary || "No summary available"}
              </p>
              <p className="text-[11px] text-muted-foreground font-mono flex items-center gap-1.5">
                <Clock className="size-3.5 text-primary" />
                Generated {safeFormatDate(insights.generatedAt, "MMM d, yyyy 'at' h:mm a", "recently")}
              </p>
            </div>
            <div className="text-center bg-card border border-border/70 p-5 rounded-2xl shadow-soft min-w-[140px]">
              <div className={`text-5xl font-bold font-mono ${getHealthColor(insights.overallHealthStatus || "good")}`}>
                {insights.overallHealthScore ?? 100}
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                Health Score
              </div>
              <Badge variant="outline" className="mt-2 capitalize font-mono text-[10px] px-2.5">
                {insights.overallHealthStatus || "good"}
              </Badge>
            </div>
          </div>
        </section>

        {/* 4 KPI Summary Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Monitored Assets
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-foreground mt-2 truncate">
                  {stats.totalAssets}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 shrink-0">
                <Package className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Active Work Orders
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-amber-600 mt-2 truncate">
                  {stats.activeWorkOrders}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0">
                <Activity className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Overdue Work Orders
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-destructive mt-2 truncate">
                  {stats.overdueWorkOrders}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
                <AlertTriangle className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  SLA Compliance
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-emerald-600 mt-2 truncate">
                  {stats.slaComplianceRate}%
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                <Target className="size-5.5" />
              </div>
            </div>
          </Card>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/60 p-1 rounded-xl border border-border/70 h-auto flex flex-wrap">
            <TabsTrigger value="overview" className="gap-2 text-xs py-2 px-3.5 rounded-lg cursor-pointer">
              <Sparkles className="size-3.5" /> Overview & Metrics
            </TabsTrigger>
            <TabsTrigger value="risk" className="gap-2 text-xs py-2 px-3.5 rounded-lg cursor-pointer">
              <ShieldAlert className="size-3.5" /> High Risk Assets
              {highRiskAssets.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 font-mono text-destructive bg-destructive/10">
                  {highRiskAssets.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sla" className="gap-2 text-xs py-2 px-3.5 rounded-lg cursor-pointer">
              <Calendar className="size-3.5" /> SLA Risk
            </TabsTrigger>
            <TabsTrigger value="costs" className="gap-2 text-xs py-2 px-3.5 rounded-lg cursor-pointer">
              <BarChart3 className="size-3.5" /> Cost Analysis
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="gap-2 text-xs py-2 px-3.5 rounded-lg cursor-pointer">
              <TrendingUp className="size-3.5" /> Recommendations
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: OVERVIEW */}
          <TabsContent value="overview" className="space-y-6 pt-2">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Cost Summary */}
              <Card className="border-border/70 shadow-soft rounded-2xl bg-card">
                <CardHeader className="p-6 pb-4">
                  <CardTitle className="text-base font-serif font-bold text-foreground flex items-center gap-2">
                    <DollarSign className="size-5 text-primary" /> Total Maintenance Cost
                  </CardTitle>
                  <CardDescription className="text-xs">Completed work orders cumulative total</CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4">
                  <div className="text-3xl font-bold font-mono text-foreground">
                    ₨ {Number(stats.totalMaintenanceCost || 0).toLocaleString()}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="rounded-xl border border-border/70 p-3 bg-muted/20">
                      <p className="text-muted-foreground text-[11px]">Avg Cost Per WO</p>
                      <p className="font-semibold text-foreground text-sm font-mono mt-0.5">
                        ₨ {Math.round(costAnalysis.avgCostPerWorkOrder || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 p-3 bg-muted/20">
                      <p className="text-muted-foreground text-[11px]">Completed WOs</p>
                      <p className="font-semibold text-foreground text-sm font-mono mt-0.5">{stats.completedWorkOrders || 0}</p>
                    </div>
                  </div>
                  {costAnalysis.highestCostAsset && (
                    <div className="border-t border-border/60 pt-3">
                      <p className="text-xs text-muted-foreground mb-1">Most Expensive Asset</p>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-xs text-foreground">
                          {costAnalysis.highestCostAsset.name}
                        </span>
                        <span className="font-mono text-xs font-bold text-primary">
                          ₨ {Number(costAnalysis.highestCostAsset.cost || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Completion Metrics */}
              <Card className="border-border/70 shadow-soft rounded-2xl bg-card">
                <CardHeader className="p-6 pb-4">
                  <CardTitle className="text-base font-serif font-bold text-foreground flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-emerald-500" /> Completion Metrics
                  </CardTitle>
                  <CardDescription className="text-xs">Average operational turnaround times</CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-foreground">SLA Compliance Rate</span>
                      <span className="text-base font-bold font-mono text-emerald-600">
                        {stats.slaComplianceRate ?? 100}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${stats.slaComplianceRate ?? 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="rounded-xl border border-border/70 p-3 bg-muted/20">
                      <p className="text-muted-foreground text-[11px]">Avg Completion Time</p>
                      <p className="font-semibold text-base font-mono text-foreground mt-0.5">
                        {stats.avgCompletionDays || 0} days
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 p-3 bg-muted/20">
                      <p className="text-muted-foreground text-[11px]">Completed This Period</p>
                      <p className="font-semibold text-base font-mono text-foreground mt-0.5">
                        {stats.completedWorkOrders || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recurring Patterns Preview */}
            {recurringPatterns.length > 0 && (
              <Card className="border-border/70 shadow-soft rounded-2xl bg-card">
                <CardHeader className="p-6 pb-4">
                  <CardTitle className="text-base font-serif font-bold text-foreground flex items-center gap-2">
                    <TrendingUp className="size-5 text-amber-500" /> Recurring Failure Patterns
                  </CardTitle>
                  <CardDescription className="text-xs">Assets with repeated maintenance breakdowns</CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {recurringPatterns.map((pattern) => (
                      <div
                        key={`${pattern.assetId}-${pattern.failurePattern}`}
                        className="flex items-center justify-between border border-border/70 rounded-xl p-3.5 bg-muted/20 hover:bg-muted/40 transition-colors"
                      >
                        <div className="space-y-1">
                          <p className="font-semibold text-xs text-foreground">{pattern.assetName}</p>
                          <p className="text-[11px] text-muted-foreground capitalize">
                            {pattern.failurePattern} · <strong className="text-foreground">{pattern.occurrenceCount} occurrences</strong>
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[9px] uppercase font-mono">
                          {pattern.assetCategory}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TAB 2: HIGH RISK ASSETS */}
          <TabsContent value="risk" className="space-y-4 pt-2">
            <Card className="border-border/70 shadow-soft rounded-2xl bg-card">
              <CardHeader className="p-6 pb-4">
                <CardTitle className="text-base font-serif font-bold text-foreground flex items-center gap-2">
                  <ShieldAlert className="size-5 text-destructive" /> High Risk Assets Analysis
                </CardTitle>
                <CardDescription className="text-xs">
                  Assets identified as high-risk based on maintenance frequency, expense, and failure velocity
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                {highRiskAssets.length === 0 ? (
                  <div className="text-center py-14 text-muted-foreground border border-dashed rounded-xl">
                    <CheckCircle2 className="size-10 mx-auto mb-2 text-emerald-500" />
                    <p className="font-semibold text-sm text-foreground">No high-risk assets identified</p>
                    <p className="text-xs text-muted-foreground mt-0.5">All monitored assets are operating within safe parameters.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {highRiskAssets.map((asset) => (
                      <div
                        key={asset.assetId}
                        className="border border-border/70 rounded-xl p-5 space-y-3 bg-muted/10 hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-serif font-bold text-sm text-foreground truncate">{asset.assetName}</h4>
                              {getRiskBadge(asset.riskLevel)}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="capitalize">{asset.assetCategory}</span>
                              {asset.location && (
                                <>
                                  <span>·</span>
                                  <span>{asset.location}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-2xl font-bold font-mono text-destructive">{asset.riskScore}</div>
                            <div className="text-[9px] text-muted-foreground uppercase font-semibold">Risk Score</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs border-t border-border/60 pt-3 font-mono">
                          <div>
                            <p className="text-muted-foreground text-[10px] uppercase font-sans">Events</p>
                            <p className="font-semibold text-foreground">{asset.maintenanceCount || 0}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[10px] uppercase font-sans">Total Cost</p>
                            <p className="font-semibold text-foreground">₨ {Number(asset.totalCost || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[10px] uppercase font-sans">Avg Cost</p>
                            <p className="font-semibold text-foreground">₨ {Math.round(asset.avgCost || 0).toLocaleString()}</p>
                          </div>
                        </div>

                        <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1 border border-border/60">
                          <p className="font-semibold text-foreground text-[11px]">Risk Factors:</p>
                          <ul className="list-disc list-inside space-y-0.5 text-muted-foreground text-[11px]">
                            {asset.reasons.map((reason, idx) => (
                              <li key={idx}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: SLA RISK */}
          <TabsContent value="sla" className="space-y-4 pt-2">
            <Card className="border-border/70 shadow-soft rounded-2xl bg-card">
              <CardHeader className="p-6 pb-4">
                <CardTitle className="text-base font-serif font-bold text-foreground flex items-center gap-2">
                  <Calendar className="size-5 text-amber-500" /> SLA Risk Analysis
                </CardTitle>
                <CardDescription className="text-xs">
                  Work orders that are overdue or at imminent risk of missing SLA deadlines
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                {slaRiskWorkOrders.length === 0 ? (
                  <div className="text-center py-14 text-muted-foreground border border-dashed rounded-xl">
                    <CheckCircle2 className="size-10 mx-auto mb-2 text-emerald-500" />
                    <p className="font-semibold text-sm text-foreground">All work orders are on track</p>
                    <p className="text-xs text-muted-foreground mt-0.5">No SLA violations or critical delay risks detected.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {slaRiskWorkOrders.map((wo) => (
                      <div
                        key={wo.id}
                        className={cn(
                          "border rounded-xl p-4 transition-colors",
                          wo.daysOverdue > 0
                            ? "border-destructive/40 bg-destructive/5"
                            : "border-amber-500/40 bg-amber-500/5"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="space-y-1 flex-1 min-w-0">
                            <h4 className="font-serif font-bold text-sm text-foreground">{wo.title}</h4>
                            {wo.assetName && (
                              <p className="text-xs text-muted-foreground">Asset: <span className="font-medium text-foreground">{wo.assetName}</span></p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge
                              variant={wo.daysOverdue > 0 ? "destructive" : "default"}
                              className="text-[10px] uppercase font-bold font-mono"
                            >
                              {wo.daysOverdue > 0
                                ? `${wo.daysOverdue}d Overdue`
                                : `Due in ${Math.abs(wo.daysOverdue)}d`}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {wo.priority}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs border-t border-border/60 pt-3">
                          <div className="space-y-0.5">
                            <p className="text-muted-foreground text-[10px] uppercase">SLA Due Date</p>
                            <p className="font-mono font-semibold">
                              {safeFormatDate(wo.slaDueAt, "MMM d, yyyy")}
                            </p>
                          </div>
                          <div className="space-y-0.5 text-right">
                            <p className="text-muted-foreground text-[10px] uppercase">Estimated Cost</p>
                            <p className="font-mono font-semibold">₨ {Number(wo.estimatedCost || 0).toLocaleString()}</p>
                          </div>
                          {wo.assignedTo && (
                            <div className="space-y-0.5 text-right">
                              <p className="text-muted-foreground text-[10px] uppercase">Assigned To</p>
                              <p className="font-semibold">{wo.assignedTo}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: COST ANALYSIS */}
          <TabsContent value="costs" className="space-y-6 pt-2">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Cost by Category */}
              <Card className="border-border/70 shadow-soft rounded-2xl bg-card">
                <CardHeader className="p-6 pb-4">
                  <CardTitle className="text-base font-serif font-bold text-foreground flex items-center gap-2">
                    <BarChart3 className="size-5 text-primary" /> Cost by Category
                  </CardTitle>
                  <CardDescription className="text-xs">Maintenance spending segmented by asset category</CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  {costAnalysis.costByCategory.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-10 border border-dashed rounded-xl">
                      No cost data available.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {costAnalysis.costByCategory.map((cat) => (
                        <div key={cat.category} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold capitalize text-foreground">{cat.category}</span>
                            <span className="font-mono font-bold text-foreground">₨ {Number(cat.totalCost || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{cat.workOrderCount} work orders</span>
                            <span className="font-mono">
                              Avg: ₨ {Math.round((cat.totalCost || 0) / (cat.workOrderCount || 1)).toLocaleString()}
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (cat.totalCost / (stats.totalMaintenanceCost || 1)) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Cost by Vendor */}
              <Card className="border-border/70 shadow-soft rounded-2xl bg-card">
                <CardHeader className="p-6 pb-4">
                  <CardTitle className="text-base font-serif font-bold text-foreground flex items-center gap-2">
                    <Wrench className="size-5 text-primary" /> Cost by Vendor
                  </CardTitle>
                  <CardDescription className="text-xs">Contractor & vendor maintenance expenditure</CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  {costAnalysis.costByVendor.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-10 border border-dashed rounded-xl">
                      No vendor billing records available.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {costAnalysis.costByVendor.map((v) => (
                        <div key={v.vendorName} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-foreground">{v.vendorName}</span>
                            <span className="font-mono font-bold text-foreground">₨ {Number(v.totalCost || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{v.workOrderCount} jobs</span>
                            <span className="font-mono">Avg: ₨ {Math.round((v.totalCost || 0) / (v.workOrderCount || 1)).toLocaleString()}</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (v.totalCost / (stats.totalMaintenanceCost || 1)) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 5: RECOMMENDATIONS */}
          <TabsContent value="recommendations" className="space-y-4 pt-2">
            <Card className="border-border/70 shadow-soft rounded-2xl bg-card">
              <CardHeader className="p-6 pb-4">
                <CardTitle className="text-base font-serif font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" /> Preventive Maintenance Recommendations
                </CardTitle>
                <CardDescription className="text-xs">
                  Automated maintenance plans generated to reduce breakdown risk and optimize asset lifetime
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                {preventiveRecommendations.length === 0 ? (
                  <div className="text-center py-14 text-muted-foreground border border-dashed rounded-xl">
                    <CheckCircle2 className="size-10 mx-auto mb-2 text-emerald-500" />
                    <p className="font-semibold text-sm text-foreground">No recommendations at this time</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Asset schedules are currently aligned with manufacturer recommendations.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {preventiveRecommendations.map((rec, idx) => (
                      <div
                        key={idx}
                        className="border border-border/70 rounded-xl p-5 space-y-3 bg-muted/10 hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <h4 className="font-serif font-bold text-sm text-foreground">{rec.title}</h4>
                            <p className="text-xs text-muted-foreground">Asset: <span className="font-medium text-foreground">{rec.assetName}</span></p>
                          </div>
                          <Badge variant="outline" className="text-[10px] font-mono capitalize">
                            {rec.priority} Priority
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed">{rec.description}</p>

                        <div className="grid grid-cols-2 gap-2 text-xs border-t border-border/60 pt-3 font-mono">
                          <div>
                            <p className="text-muted-foreground text-[10px] uppercase font-sans">Recommended Date</p>
                            <p className="font-semibold text-foreground">{safeFormatDate(rec.recommendedDate, "MMM d, yyyy")}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-muted-foreground text-[10px] uppercase font-sans">Estimated Cost</p>
                            <p className="font-semibold text-emerald-600">₨ {Number(rec.estimatedCost ?? 0).toLocaleString()}</p>
                          </div>
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
    </AppShell>
  );
}
