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
  DollarSign,
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
} from "lucide-react";
import { format } from "date-fns";

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

function AIMaintenanceRoute() {
  return (
    <ModuleGate moduleKey="ai_maintenance">
      <AIMaintenancePage />
    </ModuleGate>
  );
}

function AIMaintenancePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("overview");

  const { data: insights, isLoading, error } = useQuery({
    queryKey: ["ai-maintenance-insights"],
    queryFn: () => getAIMaintenanceInsightsFn(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["ai-maintenance-insights"] });
    toast.info("Refreshing AI insights...");
  };

  const getRiskBadge = (level: string) => {
    const variants: Record<string, any> = {
      low: "secondary",
      medium: "default",
      high: "destructive",
      critical: "destructive",
    };
    const colors: Record<string, string> = {
      low: "bg-green-100 text-green-700 border-green-300",
      medium: "bg-yellow-100 text-yellow-700 border-yellow-300",
      high: "bg-orange-100 text-orange-700 border-orange-300",
      critical: "bg-red-100 text-red-700 border-red-300",
    };
    return (
      <Badge
        variant="outline"
        className={`text-[10px] font-bold uppercase ${colors[level] || ""}`}
      >
        {level}
      </Badge>
    );
  };

  const getHealthColor = (status: string) => {
    const colors: Record<string, string> = {
      excellent: "text-green-600",
      good: "text-emerald-600",
      fair: "text-yellow-600",
      poor: "text-orange-600",
      critical: "text-red-600",
    };
    return colors[status] || "text-muted-foreground";
  };

  if (isLoading) {
    return (
      <AppShell title="AI Maintenance Intelligence" subtitle="Analyzing maintenance data...">
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="size-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Sparkles className="size-4" />
            AI is analyzing your maintenance data...
          </p>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="AI Maintenance Intelligence" subtitle="Error loading insights">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="grid size-16 place-items-center rounded-full bg-destructive/10 text-destructive">
            <XCircle className="size-8" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-lg">Failed to Load AI Insights</h3>
            <p className="text-sm text-muted-foreground">
              {(error as any)?.message || "Unable to generate maintenance intelligence"}
            </p>
            <Button onClick={handleRefresh} variant="outline" className="mt-4">
              <RefreshCw className="size-4 mr-2" /> Try Again
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!insights) return null;

  return (
    <AppShell
      title="AI Maintenance Intelligence"
      subtitle="Predictive analytics, risk assessment and intelligent maintenance recommendations"
      actions={
        <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-1.5">
          <RefreshCw className="size-4" /> Refresh Insights
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10 space-y-8">
        {/* Overall Health Score */}
        <section className="relative overflow-hidden rounded-xl border border-border/70 bg-gradient-to-br from-primary/5 via-background to-background p-8">
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="size-5" />
                </div>
                <h2 className="font-serif text-2xl font-bold">Maintenance Health Overview</h2>
              </div>
              <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
                {insights.summary}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="size-3" />
                Generated {format(new Date(insights.generatedAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            <div className="text-center">
              <div className={`text-6xl font-bold font-mono ${getHealthColor(insights.overallHealthStatus)}`}>
                {insights.overallHealthScore}
              </div>
              <div className="text-sm font-medium uppercase tracking-wider mt-1">
                Health Score
              </div>
              <Badge variant="outline" className="mt-2 capitalize">
                {insights.overallHealthStatus}
              </Badge>
            </div>
          </div>
        </section>

        {/* Key Statistics Grid */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="size-4 text-muted-foreground" />
                Total Assets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{insights.statistics.totalAssets}</div>
              <p className="text-xs text-muted-foreground mt-1">Under monitoring</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="size-4 text-amber-500" />
                Active Work Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{insights.statistics.activeWorkOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">In progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="size-4 text-destructive" />
                Overdue Work Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">
                {insights.statistics.overdueWorkOrders}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Require attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="size-4 text-emerald-500" />
                SLA Compliance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">
                {insights.statistics.slaComplianceRate}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">On-time completion</p>
            </CardContent>
          </Card>
        </section>

        {/* Tabs for detailed insights */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="risk">High Risk Assets</TabsTrigger>
            <TabsTrigger value="sla">SLA Risk</TabsTrigger>
            <TabsTrigger value="costs">Cost Analysis</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Cost Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="size-5 text-primary" />
                    Total Maintenance Cost
                  </CardTitle>
                  <CardDescription>Completed work orders only</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-4xl font-bold font-mono">
                    ₨{insights.statistics.totalMaintenanceCost.toLocaleString()}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Avg Cost Per WO</p>
                      <p className="font-semibold">
                        ₨{Math.round(insights.costAnalysis.avgCostPerWorkOrder).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Completed WOs</p>
                      <p className="font-semibold">{insights.statistics.completedWorkOrders}</p>
                    </div>
                  </div>
                  {insights.costAnalysis.highestCostAsset && (
                    <div className="border-t pt-3">
                      <p className="text-xs text-muted-foreground mb-1">Most Expensive Asset</p>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {insights.costAnalysis.highestCostAsset.name}
                        </span>
                        <span className="font-mono text-sm font-bold">
                          ₨{insights.costAnalysis.highestCostAsset.cost.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Completion Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-emerald-500" />
                    Completion Metrics
                  </CardTitle>
                  <CardDescription>Average performance indicators</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">SLA Compliance Rate</span>
                      <span className="text-lg font-bold text-emerald-600">
                        {insights.statistics.slaComplianceRate}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${insights.statistics.slaComplianceRate}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Avg Completion Time</p>
                      <p className="font-semibold text-lg">
                        {insights.statistics.avgCompletionDays} days
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Completed This Period</p>
                      <p className="font-semibold text-lg">
                        {insights.statistics.completedWorkOrders}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recurring Patterns Preview */}
            {insights.recurringPatterns.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="size-5 text-amber-500" />
                    Recurring Failure Patterns
                  </CardTitle>
                  <CardDescription>Assets with repeated maintenance issues</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insights.recurringPatterns.slice(0, 3).map((pattern) => (
                      <div
                        key={`${pattern.assetId}-${pattern.failurePattern}`}
                        className="flex items-center justify-between border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="space-y-1">
                          <p className="font-semibold text-sm">{pattern.assetName}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {pattern.failurePattern} · {pattern.occurrenceCount} occurrences
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {pattern.assetCategory}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* High Risk Assets Tab */}
          <TabsContent value="risk" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="size-5 text-destructive" />
                  High Risk Assets Analysis
                </CardTitle>
                <CardDescription>
                  Assets identified as high-risk based on maintenance frequency, cost, and priority
                </CardDescription>
              </CardHeader>
              <CardContent>
                {insights.highRiskAssets.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="size-12 mx-auto mb-3 text-green-500" />
                    <p className="font-medium">No high-risk assets identified</p>
                    <p className="text-xs mt-1">All assets are within acceptable maintenance parameters</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {insights.highRiskAssets.map((asset) => (
                      <div
                        key={asset.assetId}
                        className="border rounded-lg p-4 space-y-3 hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{asset.assetName}</h4>
                              {getRiskBadge(asset.riskLevel)}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="capitalize">{asset.assetCategory}</span>
                              {asset.location && (
                                <>
                                  <span>·</span>
                                  <span>{asset.location}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold font-mono">{asset.riskScore}</div>
                            <div className="text-[10px] text-muted-foreground uppercase">Risk Score</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-xs border-t pt-3">
                          <div>
                            <p className="text-muted-foreground mb-0.5">Maintenance Events</p>
                            <p className="font-semibold">{asset.maintenanceCount}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-0.5">Total Cost</p>
                            <p className="font-semibold">₨{asset.totalCost.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-0.5">Avg Cost</p>
                            <p className="font-semibold">₨{Math.round(asset.avgCost).toLocaleString()}</p>
                          </div>
                        </div>

                        <div className="bg-muted/50 rounded p-2 text-xs space-y-1">
                          <p className="font-semibold text-foreground">Risk Factors:</p>
                          <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
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

          {/* SLA Risk Tab */}
          <TabsContent value="sla" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="size-5 text-amber-500" />
                  SLA Risk Analysis
                </CardTitle>
                <CardDescription>
                  Work orders that are overdue or at risk of missing SLA deadlines
                </CardDescription>
              </CardHeader>
              <CardContent>
                {insights.slaRiskWorkOrders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="size-12 mx-auto mb-3 text-green-500" />
                    <p className="font-medium">All work orders are on track</p>
                    <p className="text-xs mt-1">No SLA violations or risks detected</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {insights.slaRiskWorkOrders.map((wo) => (
                      <div
                        key={wo.id}
                        className={`border rounded-lg p-4 ${
                          wo.daysOverdue > 0
                            ? "border-destructive/50 bg-destructive/5"
                            : "border-amber-500/50 bg-amber-500/5"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="space-y-1 flex-1">
                            <h4 className="font-semibold">{wo.title}</h4>
                            {wo.assetName && (
                              <p className="text-xs text-muted-foreground">Asset: {wo.assetName}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge
                              variant={wo.daysOverdue > 0 ? "destructive" : "default"}
                              className="text-[10px] uppercase font-bold"
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

                        <div className="flex items-center justify-between text-xs border-t pt-3">
                          <div className="space-y-0.5">
                            <p className="text-muted-foreground">SLA Due Date</p>
                            <p className="font-mono font-semibold">
                              {format(new Date(wo.slaDueAt), "MMM d, yyyy")}
                            </p>
                          </div>
                          <div className="space-y-0.5 text-right">
                            <p className="text-muted-foreground">Estimated Cost</p>
                            <p className="font-mono font-semibold">₨{wo.estimatedCost.toLocaleString()}</p>
                          </div>
                          {wo.assignedTo && (
                            <div className="space-y-0.5 text-right">
                              <p className="text-muted-foreground">Assigned To</p>
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

          {/* Cost Analysis Tab */}
          <TabsContent value="costs" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Cost by Category */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="size-5 text-primary" />
                    Cost by Category
                  </CardTitle>
                  <CardDescription>Maintenance costs broken down by asset category</CardDescription>
                </CardHeader>
                <CardContent>
                  {insights.costAnalysis.costByCategory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No cost data available
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {insights.costAnalysis.costByCategory.map((cat) => (
                        <div key={cat.category} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium capitalize">{cat.category}</span>
                            <span className="font-mono font-bold">₨{cat.totalCost.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{cat.workOrderCount} work orders</span>
                            <span>
                              Avg: ₨{Math.round(cat.totalCost / cat.workOrderCount).toLocaleString()}
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (cat.totalCost / insights.statistics.totalMaintenanceCost) * 100,
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
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="size-5 text-primary" />
                    Cost by Vendor
                  </CardTitle>
                  <CardDescription>Top vendors by maintenance spend</CardDescription>
                </CardHeader>
                <CardContent>
                  {insights.costAnalysis.costByVendor.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No vendor cost data available
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {insights.costAnalysis.costByVendor.slice(0, 5).map((vendor) => (
                        <div key={vendor.vendorName} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{vendor.vendorName}</span>
                            <span className="font-mono font-bold">₨{vendor.totalCost.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{vendor.workOrderCount} work orders</span>
                            <span>
                              Avg: ₨
                              {Math.round(vendor.totalCost / vendor.workOrderCount).toLocaleString()}
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-emerald-500"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (vendor.totalCost / insights.statistics.totalMaintenanceCost) * 100,
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

            {/* Monthly Cost Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="size-5 text-primary" />
                  Monthly Cost Trend
                </CardTitle>
                <CardDescription>Last 6 months maintenance expenditure</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between gap-2 h-48">
                  {insights.costAnalysis.monthlyCostTrend.map((month) => {
                    const maxCost = Math.max(
                      ...insights.costAnalysis.monthlyCostTrend.map((m) => m.cost),
                    );
                    const heightPct = maxCost > 0 ? (month.cost / maxCost) * 100 : 0;
                    return (
                      <div key={month.month} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full flex flex-col items-center justify-end h-full">
                          <div className="text-xs font-mono font-semibold mb-1">
                            {month.cost > 0 ? `₨${(month.cost / 1000).toFixed(0)}K` : "—"}
                          </div>
                          <div
                            className="w-full bg-primary rounded-t transition-all"
                            style={{ height: `${heightPct}%`, minHeight: month.cost > 0 ? "4px" : "0" }}
                          />
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {format(new Date(month.month + "-01"), "MMM")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recommendations Tab */}
          <TabsContent value="recommendations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" />
                  AI Preventive Recommendations
                </CardTitle>
                <CardDescription>
                  Intelligent suggestions based on maintenance patterns and risk analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                {insights.preventiveRecommendations.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="size-12 mx-auto mb-3 text-green-500" />
                    <p className="font-medium">No urgent recommendations</p>
                    <p className="text-xs mt-1">All assets are performing within expected parameters</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {insights.preventiveRecommendations.map((rec, idx) => (
                      <div
                        key={`${rec.assetId}-${idx}`}
                        className="border rounded-lg p-4 space-y-3 hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{rec.assetName}</h4>
                              {getRiskBadge(rec.priority)}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="capitalize">{rec.assetCategory}</span>
                              {rec.location && (
                                <>
                                  <span>·</span>
                                  <span>{rec.location}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] uppercase capitalize">
                            {rec.recommendationType}
                          </Badge>
                        </div>

                        <div className="bg-primary-soft/20 rounded-lg p-3 text-sm">
                          <p className="text-foreground/90 leading-relaxed">{rec.reasoning}</p>
                        </div>

                        {rec.estimatedCost && (
                          <div className="flex items-center justify-between text-xs border-t pt-3">
                            <span className="text-muted-foreground">Estimated Preventive Cost</span>
                            <span className="font-mono font-semibold">
                              ₨{Math.round(rec.estimatedCost).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recurring Patterns Card */}
            {insights.recurringPatterns.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="size-5 text-amber-500" />
                    Recurring Failure Patterns
                  </CardTitle>
                  <CardDescription>
                    Assets with repeated maintenance events requiring root cause analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insights.recurringPatterns.map((pattern) => (
                      <div
                        key={`${pattern.assetId}-${pattern.failurePattern}`}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <h4 className="font-semibold">{pattern.assetName}</h4>
                            <p className="text-xs text-muted-foreground capitalize">
                              Pattern: {pattern.failurePattern}
                            </p>
                          </div>
                          <Badge variant="destructive" className="text-[10px]">
                            {pattern.occurrenceCount} occurrences
                          </Badge>
                        </div>

                        {pattern.avgDaysBetweenFailures && (
                          <div className="bg-muted/50 rounded p-2 text-xs">
                            <span className="text-muted-foreground">Avg Days Between Failures: </span>
                            <span className="font-mono font-semibold">
                              {Math.round(pattern.avgDaysBetweenFailures)} days
                            </span>
                          </div>
                        )}

                        <div className="bg-amber-500/10 border border-amber-500/20 rounded p-3 text-sm">
                          <p className="font-semibold text-amber-700 mb-1">Recommended Action:</p>
                          <p className="text-foreground/90">{pattern.recommendedAction}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* AI Disclaimer */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="py-4 flex items-start gap-3">
            <Sparkles className="size-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
              <p>
                <strong className="text-foreground">AI-Powered Analysis:</strong> These insights are
                generated using statistical analysis and pattern detection algorithms applied to your
                historical maintenance data.
              </p>
              <p>
                Recommendations are suggestions based on identified patterns and should be reviewed by
                qualified maintenance professionals before implementation. Risk scores are calculated
                using frequency, cost, and priority metrics.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
