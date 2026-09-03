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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  AlertTriangle,
  Copy,
  Clock,
  TrendingUp,
  Search,
  CheckCircle2,
  XCircle,
  Building,
  Loader2,
  ShieldAlert,
  ArrowRight,
  Flame,
  Check,
  RotateCcw,
  BrainCircuit,
  RefreshCw,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAIComplaintInsightsFn,
  getAIComplaintSettingsFn,
  updateAIComplaintSettingsFn,
  runAutoEscalationCheckFn,
  resolveDuplicateComplaintFn,
  analyzeComplaintTextFn,
  type AIComplaintSettings,
  DEFAULT_AI_COMPLAINT_SETTINGS,
} from "@/lib/api/ai-complaints";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ai-complaints")({
  head: () => ({
    meta: [
      { title: "AI Complaint Intelligence — HousingOS" },
      {
        name: "description",
        content: "Automated complaint categorization, duplicate detection, and SLA escalation.",
      },
    ],
  }),
  component: AIComplaintsRoute,
});

function getCookieVal(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]*)"));
  return match ? match[2] : "";
}

function AIComplaintsRoute() {
  return (
    <ModuleGate moduleKey="ai_complaints">
      <AIComplaintsDashboard />
    </ModuleGate>
  );
}

const SANDBOX_TEST_CASES = [
  {
    label: "Stuck Lift",
    title: "Lift cabin is making loud grinding noise and stuck on 3rd floor",
    desc: "Resident is inside, emergency alarm pressed, power light blinking.",
  },
  {
    label: "Water Leakage",
    title: "Main water supply pipe burst in basement parking",
    desc: "Severe water leakage near parking slot B-14, flooding the corridor floor.",
  },
  {
    label: "Gate Barrier",
    title: "RFID Boom barrier sensor not opening at Gate 2",
    desc: "Vehicles are piling up during rush hours, manual gate override required.",
  },
  {
    label: "Power Surge",
    title: "Sudden high voltage fluctuation tripping air conditioners",
    desc: "Multiple flats in Block C reported voltage spike and breaker tripping.",
  },
];

function AIComplaintsDashboard() {
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
    queryKey: ["ai-complaint-insights", selectedTenantId],
    queryFn: () => getAIComplaintInsightsFn({ data: { tenantId: selectedTenantId || undefined } }),
    staleTime: 1000 * 60 * 2,
  });

  // Query Settings
  const {
    data: settingsData,
    isLoading: loadingSettings,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ["ai-complaint-settings", selectedTenantId],
    queryFn: () => getAIComplaintSettingsFn({ data: { tenantId: selectedTenantId || undefined } }),
    staleTime: 1000 * 60 * 5,
  });

  // Local settings form state
  const [autoCat, setAutoCat] = useState(true);
  const [autoPri, setAutoPri] = useState(true);
  const [dupThresh, setDupThresh] = useState(85);
  const [escDays, setEscDays] = useState(3);

  // Live Sandbox state
  const [sandboxTitle, setSandboxTitle] = useState(SANDBOX_TEST_CASES[0].title);
  const [sandboxDesc, setSandboxDesc] = useState(SANDBOX_TEST_CASES[0].desc);
  const [sandboxResult, setSandboxResult] = useState<{
    suggestedCategory: string;
    suggestedPriority: string;
    confidence: number;
    explanation: string;
  } | null>(null);

  // Sync settings when loaded
  useEffect(() => {
    if (settingsData?.settings) {
      setAutoCat(settingsData.settings.autoCategorize);
      setAutoPri(settingsData.settings.autoPriority);
      setDupThresh(settingsData.settings.dupThreshold);
      setEscDays(settingsData.settings.escalationDays);
    }
  }, [settingsData]);

  // SLA Escalation Mutation
  const escalationMutation = useMutation({
    mutationFn: runAutoEscalationCheckFn,
    onSuccess: (res: any) => {
      if (res.escalatedCount > 0) {
        toast.success(`SLA Scan Complete: ${res.escalatedCount} ticket(s) automatically escalated!`);
      } else {
        toast.info("SLA Scan Complete: No tickets breached resolution thresholds.");
      }
      refetchInsights();
    },
    onError: (err: any) => {
      toast.error(err instanceof Error ? err.message : "Escalation scan failed");
    },
  });

  // Analyze text in sandbox
  const analyzeSandboxMutation = useMutation({
    mutationFn: analyzeComplaintTextFn,
    onSuccess: (res) => {
      setSandboxResult(res);
      toast.success("Intelligence analysis completed");
    },
    onError: (err: any) => {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    },
  });

  const handleTestSandbox = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sandboxTitle.trim()) {
      toast.error("Please enter a complaint title");
      return;
    }
    analyzeSandboxMutation.mutate({
      data: { title: sandboxTitle, description: sandboxDesc },
    });
  };

  const applyTestCase = (tc: (typeof SANDBOX_TEST_CASES)[0]) => {
    setSandboxTitle(tc.title);
    setSandboxDesc(tc.desc);
    analyzeSandboxMutation.mutate({
      data: { title: tc.title, description: tc.desc },
    });
  };

  // Save Settings Mutation
  const saveSettingsMutation = useMutation({
    mutationFn: updateAIComplaintSettingsFn,
    onSuccess: () => {
      toast.success("AI Complaint settings saved successfully");
      queryClient.invalidateQueries({ queryKey: ["ai-complaint-settings"] });
      refetchSettings();
    },
    onError: (err: any) => {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
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
        autoCategorize: autoCat,
        autoPriority: autoPri,
        dupThreshold: dupThresh,
        escalationDays: escDays,
      },
    });
  };

  // Resolve duplicate mutation
  const resolveDupMutation = useMutation({
    mutationFn: resolveDuplicateComplaintFn,
    onSuccess: () => {
      toast.success("Duplicate status updated");
      refetchInsights();
    },
    onError: (err: any) => {
      toast.error(err instanceof Error ? err.message : "Action failed");
    },
  });

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
                  AI Complaint Intelligence
                </h1>
                <Badge variant="secondary" className="font-mono text-xs px-2.5 py-0.5 font-medium">
                  Autonomous Engine
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Deterministic text triage, duplicate detection, and automated SLA escalation engine.
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
              disabled={escalationMutation.isPending || insightsData?.isAllSocieties}
              onClick={() => {
                if (insightsData?.tenantId) {
                  escalationMutation.mutate({ data: { tenantId: insightsData.tenantId } });
                } else {
                  toast.info("Please select a specific society to run escalation scan.");
                }
              }}
              className="h-9 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer px-4"
            >
              {escalationMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Zap className="size-3.5 text-amber-300" />
              )}
              Run SLA Escalation Scan
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
                  Platform-Wide Mode Active
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Showing aggregate overview across all managed societies. To customize rule engine thresholds or perform specific SLA escalation scans, select a specific society from the top dropdown.
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
                  Total Analyzed
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-foreground mt-2 truncate">
                  {stats?.totalComplaints ?? 0}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 shrink-0">
                <Sparkles className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Suspected Duplicates
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-amber-600 mt-2 truncate">
                  {stats?.duplicateCount ?? 0}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0">
                <Copy className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Auto-Escalated
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-destructive mt-2 truncate">
                  {stats?.escalatedCount ?? 0}
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
                  Triage Accuracy
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-emerald-600 mt-2 truncate">
                  {stats?.categorizationAccuracy ?? 88}%
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                <TrendingUp className="size-5.5" />
              </div>
            </div>
          </Card>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/60 p-1 rounded-xl border border-border/70 h-auto flex flex-wrap">
            <TabsTrigger value="overview" className="gap-2 text-xs py-2 px-3.5 rounded-lg cursor-pointer">
              <Sparkles className="size-3.5" /> Overview & Live Sandbox
            </TabsTrigger>
            <TabsTrigger value="duplicates" className="gap-2 text-xs py-2 px-3.5 rounded-lg cursor-pointer">
              <Copy className="size-3.5" /> Duplicate Detector
              {stats?.duplicateCount ? (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 font-mono">
                  {stats.duplicateCount}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="hotspots" className="gap-2 text-xs py-2 px-3.5 rounded-lg cursor-pointer">
              <Building className="size-3.5" /> Hotspots & Patterns
            </TabsTrigger>
            <TabsTrigger value="configuration" className="gap-2 text-xs py-2 px-3.5 rounded-lg cursor-pointer">
              <RotateCcw className="size-3.5" /> Engine Configuration
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: OVERVIEW & SANDBOX */}
          <TabsContent value="overview" className="space-y-6 pt-2">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Category Breakdown */}
              <Card className="border-border/70 shadow-soft rounded-2xl bg-card">
                <CardHeader className="p-6 pb-4">
                  <CardTitle className="text-base font-serif font-bold text-foreground">
                    Category Distribution
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Complaint volume classified across technical domains
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4">
                  {stats?.categoryDistribution && stats.categoryDistribution.length > 0 ? (
                    stats.categoryDistribution.map((item: any) => {
                      const total = stats.totalComplaints || 1;
                      const pct = Math.round((item.count / total) * 100);
                      return (
                        <div key={item.category} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="capitalize font-semibold text-foreground">{item.category}</span>
                            <span className="text-muted-foreground font-mono text-[11px]">
                              {item.count} tickets ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted-foreground py-8 text-center border border-dashed rounded-xl">
                      No complaints classified yet.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Live Interactive Triage Sandbox */}
              <Card className="border-border/70 shadow-soft rounded-2xl bg-card">
                <CardHeader className="p-6 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <CardTitle className="text-base font-serif font-bold text-foreground">
                      Live Triage Sandbox
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Test the deterministic categorization and priority suggestion rules in real time
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4">
                  {/* Quick Test Scenarios */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground">Try Sample Scenarios:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {SANDBOX_TEST_CASES.map((tc) => (
                        <button
                          key={tc.label}
                          type="button"
                          onClick={() => applyTestCase(tc)}
                          className="text-[10px] px-2.5 py-1 rounded-lg border border-border/80 bg-muted/50 hover:bg-muted font-medium text-foreground transition-colors cursor-pointer"
                        >
                          {tc.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleTestSandbox} className="space-y-3.5 pt-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="sb_title" className="text-xs font-medium">
                        Complaint Title
                      </Label>
                      <Input
                        id="sb_title"
                        value={sandboxTitle}
                        onChange={(e) => setSandboxTitle(e.target.value)}
                        placeholder="e.g. Lift cabin is stuck on 3rd floor"
                        className="text-xs h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sb_desc" className="text-xs font-medium">
                        Description / Observations
                      </Label>
                      <Input
                        id="sb_desc"
                        value={sandboxDesc}
                        onChange={(e) => setSandboxDesc(e.target.value)}
                        placeholder="e.g. Loud grinding noise, passenger inside"
                        className="text-xs h-9"
                      />
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={analyzeSandboxMutation.isPending}
                      className="w-full gap-2 h-9 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl cursor-pointer"
                    >
                      {analyzeSandboxMutation.isPending && (
                        <Loader2 className="size-3.5 animate-spin" />
                      )}
                      Analyze Text with Intelligence Rules
                    </Button>
                  </form>

                  {sandboxResult && (
                    <div className="rounded-xl border border-primary/25 bg-primary/[0.03] p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">
                          Suggested Category:
                        </span>
                        <Badge variant="outline" className="capitalize font-mono text-xs bg-primary/10 text-primary border-primary/20">
                          {sandboxResult.suggestedCategory}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">
                          Suggested Priority:
                        </span>
                        <Badge
                          variant={
                            sandboxResult.suggestedPriority === "critical"
                              ? "destructive"
                              : sandboxResult.suggestedPriority === "high"
                              ? "secondary"
                              : "outline"
                          }
                          className="capitalize font-mono font-bold text-xs"
                        >
                          {sandboxResult.suggestedPriority}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">
                          Confidence Level:
                        </span>
                        <span className="font-mono text-xs font-bold text-primary">
                          {sandboxResult.confidence}%
                        </span>
                      </div>
                      <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground leading-relaxed">
                        <p className="font-semibold text-foreground">Matched Cues:</p>
                        <p>{sandboxResult.explanation}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: DUPLICATE DETECTOR */}
          <TabsContent value="duplicates" className="space-y-6 pt-2">
            <Card className="border-border/70 shadow-soft rounded-2xl bg-card">
              <CardHeader className="p-6 pb-4">
                <CardTitle className="text-base font-serif font-bold text-foreground">
                  Suspected Duplicate Tickets
                </CardTitle>
                <CardDescription className="text-xs">
                  Active complaints flagged for high textual similarity or unit overlap with open issues
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                {stats?.duplicatePairs && stats.duplicatePairs.length > 0 ? (
                  <div className="divide-y divide-border/60 border border-border/70 rounded-xl overflow-hidden bg-card">
                    {stats.duplicatePairs.map((dup: any) => (
                      <div
                        key={dup.id}
                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/30 transition-colors"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1 pr-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-serif text-sm font-bold text-foreground">{dup.title}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {dup.unit}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className="text-[10px] text-amber-600 bg-amber-500/10 border-amber-500/20 font-mono font-bold"
                            >
                              {dup.similarityScore}% Match
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Similar to:{" "}
                            <span className="font-semibold text-foreground">
                              &ldquo;{dup.originalTitle}&rdquo;
                            </span>{" "}
                            ({dup.originalUnit})
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs gap-1 h-8 cursor-pointer"
                            disabled={resolveDupMutation.isPending}
                            onClick={() =>
                              resolveDupMutation.mutate({
                                data: { complaintId: dup.id, action: "keep_separate" },
                              })
                            }
                          >
                            <XCircle className="size-3.5 text-muted-foreground" /> Keep Separate
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs gap-1 h-8 text-destructive hover:bg-destructive/10 border-destructive/30 cursor-pointer"
                            disabled={resolveDupMutation.isPending}
                            onClick={() =>
                              resolveDupMutation.mutate({
                                data: { complaintId: dup.id, action: "confirm_duplicate" },
                              })
                            }
                          >
                            <CheckCircle2 className="size-3.5" /> Confirm Duplicate & Close
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-14 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                    <Check className="mx-auto size-8 text-emerald-500 mb-2" />
                    No duplicate complaints currently detected. Your queue is clean.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: HOTSPOTS */}
          <TabsContent value="hotspots" className="space-y-6 pt-2">
            <Card className="border-border/70 shadow-soft rounded-2xl bg-card">
              <CardHeader className="p-6 pb-4">
                <CardTitle className="text-base font-serif font-bold text-foreground">
                  Infrastructure Breakdown Hotspots
                </CardTitle>
                <CardDescription className="text-xs">
                  Blocks and units with recurring maintenance and complaint velocity
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                {stats?.hotspots && stats.hotspots.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {stats.hotspots.map((h: any) => (
                      <div
                        key={h.location}
                        className="rounded-xl border border-border/70 p-4 space-y-2 bg-muted/20"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-serif text-sm font-bold text-foreground">{h.location}</div>
                          <Badge variant="outline" className="text-xs font-mono bg-background">
                            {h.count} tickets
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {h.categories.map((c: string) => (
                            <Badge
                              key={c}
                              variant="secondary"
                              className="text-[9px] capitalize"
                            >
                              {c}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-14 text-center border border-dashed rounded-xl">
                    Not enough ticket history to form repeat hotspots.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: CONFIGURATION */}
          <TabsContent value="configuration" className="space-y-6 pt-2">
            <Card className="border-border/70 shadow-soft rounded-2xl bg-card">
              <CardHeader className="p-6 pb-4">
                <CardTitle className="text-base font-serif font-bold text-foreground">
                  AI Complaint Rules & SLA Thresholds
                </CardTitle>
                <CardDescription className="text-xs">
                  Customize auto-triage behaviors and automatic SLA escalation policies for this society
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <form onSubmit={handleSaveSettings} className="space-y-6 max-w-xl">
                  <div className="flex items-center justify-between py-3 border-b border-border/60">
                    <div>
                      <Label className="text-xs font-bold text-foreground">Auto-Categorize New Complaints</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Automatically scan text for technical keywords and suggest the category
                      </p>
                    </div>
                    <Switch checked={autoCat} onCheckedChange={setAutoCat} />
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-border/60">
                    <div>
                      <Label className="text-xs font-bold text-foreground">Auto-Suggest Priority</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Flag critical emergency signals (smoke, gas leak, stuck lift) automatically
                      </p>
                    </div>
                    <Switch checked={autoPri} onCheckedChange={setAutoPri} />
                  </div>

                  <div className="space-y-2 py-3 border-b border-border/60">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-bold text-foreground">Duplicate Similarity Threshold</Label>
                      <span className="font-mono text-xs font-bold text-primary">{dupThresh}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Complaints with textual and unit overlap exceeding this percentage are flagged as potential duplicates
                    </p>
                    <Input
                      type="number"
                      min={50}
                      max={100}
                      value={dupThresh}
                      onChange={(e) => setDupThresh(Number(e.target.value))}
                      className="w-32 text-xs h-9 font-mono"
                    />
                  </div>

                  <div className="space-y-2 py-3 border-b border-border/60">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-bold text-foreground">Auto-Escalate After (Days)</Label>
                      <span className="font-mono text-xs font-bold text-destructive">
                        {escDays} days
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Unresolved tickets open longer than this duration will be marked as escalated and alert supervisors
                    </p>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={escDays}
                      onChange={(e) => setEscDays(Number(e.target.value))}
                      className="w-32 text-xs h-9 font-mono"
                    />
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
