import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
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
import {
  getMeterReadingsFn,
  recordMeterReadingFn,
  getMeterRatesFn,
  upsertMeterRateFn,
  getUnitsForMetersFn,
} from "@/lib/api/utility-meters";
import { toast } from "sonner";
import {
  Gauge,
  Plus,
  Zap,
  Droplets,
  Flame,
  Settings,
  ArrowUpRight,
  Calculator,
} from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/utility-meters")({
  head: () => ({
    meta: [
      { title: "Utility Meters — HousingOS" },
      {
        name: "description",
        content:
          "Track electricity, gas, and water meter readings and generate charges automatically.",
      },
    ],
  }),
  component: UtilityMetersRoute,
});

function UtilityMetersRoute() {
  return (
    <ModuleGate moduleKey="utility_meters">
      <UtilityMetersPage />
    </ModuleGate>
  );
}

const METER_ICONS: Record<string, React.ElementType> = {
  electricity: Zap,
  gas: Flame,
  water: Droplets,
};

const METER_COLORS: Record<string, string> = {
  electricity: "bg-amber-100 text-amber-600",
  gas: "bg-orange-100 text-orange-600",
  water: "bg-blue-100 text-blue-600",
};

function UtilityMetersPage() {
  const queryClient = useQueryClient();
  const [readingOpen, setReadingOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"readings" | "rates">("readings");

  // Reading form
  const [unitId, setUnitId] = useState("");
  const [meterType, setMeterType] = useState<"electricity" | "gas" | "water">("electricity");
  const [readingDate, setReadingDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [currentReading, setCurrentReading] = useState("");

  // Rate form
  const [rateType, setRateType] = useState<"electricity" | "gas" | "water">("electricity");
  const [ratePerUnit, setRatePerUnit] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: readings = [] } = useQuery({
    queryKey: ["meter-readings"],
    queryFn: () => getMeterReadingsFn(),
  });
  const { data: rates = [] } = useQuery({
    queryKey: ["meter-rates"],
    queryFn: () => getMeterRatesFn(),
  });
  const { data: units = [] } = useQuery({
    queryKey: ["units-for-meters"],
    queryFn: () => getUnitsForMetersFn(),
  });

  const recordReading = useMutation({
    mutationFn: recordMeterReadingFn,
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["meter-readings"] });
      toast.success(
        res.chargedAmount > 0
          ? `Reading recorded — ₨${Number(res.chargedAmount).toLocaleString()} charged (${Number(res.consumption).toFixed(1)} units consumed)`
          : "Reading recorded — no charge generated (no rate configured)",
      );
      setReadingOpen(false);
      setCurrentReading("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to record reading"),
  });

  const saveRate = useMutation({
    mutationFn: upsertMeterRateFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meter-rates"] });
      toast.success("Rate saved successfully");
      setRateOpen(false);
      setRatePerUnit("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save rate"),
  });

  const handleRecordReading = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitId) return toast.error("Please select a unit");
    recordReading.mutate({
      data: {
        unitId,
        meterType,
        readingDate,
        currentReading: Number(currentReading),
        createLedgerEntry: true,
      },
    });
  };

  const handleSaveRate = (e: React.FormEvent) => {
    e.preventDefault();
    saveRate.mutate({
      data: { meterType: rateType, ratePerUnit: Number(ratePerUnit), effectiveFrom },
    });
  };

  return (
    <AppShell
      title="Utility Meters"
      subtitle="Track readings, calculate consumption and auto-generate ledger charges"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10 space-y-8">
        {/* Header */}
        <section className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
              <Gauge className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Total Readings</p>
              <p className="text-2xl font-bold font-mono">{(readings as any[]).length}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setRateOpen(true)} variant="outline" size="sm" className="gap-1">
              <Settings className="size-4" /> Configure Rates
            </Button>
            <Button onClick={() => setReadingOpen(true)} size="sm" className="gap-1">
              <Plus className="size-4" /> Record Reading
            </Button>
          </div>
        </section>

        {/* Tabs */}
        <div className="flex gap-1 border-b">
          {(["readings", "rates"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "readings" ? "Meter Readings" : "Tariff Rates"}
            </button>
          ))}
        </div>

        {/* Readings Tab */}
        {activeTab === "readings" && (
          <Card className="border-border/70 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base font-bold">Reading History</CardTitle>
              <CardDescription className="text-xs">All meter readings across units</CardDescription>
            </CardHeader>
            <CardContent>
              {(readings as any[]).length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <Gauge className="size-10 mx-auto text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No readings recorded yet</p>
                  <Button
                    onClick={() => setReadingOpen(true)}
                    variant="outline"
                    size="sm"
                    className="gap-1"
                  >
                    <Plus className="size-4" /> Record First Reading
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {(readings as any[]).map((r) => {
                    const Icon = METER_ICONS[r.meter_type] ?? Gauge;
                    const colors = METER_COLORS[r.meter_type] ?? "bg-muted text-muted-foreground";
                    return (
                      <div key={r.id} className="py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`grid size-9 place-items-center rounded shrink-0 ${colors}`}
                          >
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm">
                              {r.block_name} — Unit {r.unit_number}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {r.meter_type} · {format(new Date(r.reading_date), "dd MMM yyyy")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-right shrink-0">
                          <div>
                            <p className="text-xs text-muted-foreground">Reading</p>
                            <p className="font-mono text-sm font-bold">
                              {Number(r.current_reading).toFixed(1)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Consumed</p>
                            <div className="flex items-center gap-0.5 font-mono text-sm font-bold text-primary">
                              <ArrowUpRight className="size-3" />
                              {Number(r.consumption ?? 0).toFixed(1)}
                            </div>
                          </div>
                          {r.charged_amount && (
                            <div>
                              <p className="text-xs text-muted-foreground">Charged</p>
                              <p className="font-mono text-sm font-bold text-emerald-600">
                                ₨{Number(r.charged_amount).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Rates Tab */}
        {activeTab === "rates" && (
          <div className="grid gap-4 sm:grid-cols-3">
            {(["electricity", "gas", "water"] as const).map((type) => {
              const Icon = METER_ICONS[type];
              const colors = METER_COLORS[type];
              const currentRate = (rates as any[]).find((r) => r.meter_type === type);
              return (
                <Card key={type} className="border-border/70 shadow-soft">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={`grid size-10 place-items-center rounded-lg ${colors}`}>
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <p className="font-bold capitalize">{type}</p>
                        <p className="text-xs text-muted-foreground">Current tariff</p>
                      </div>
                    </div>
                    <div className="text-3xl font-bold font-mono">
                      {currentRate ? `₨${Number(currentRate.rate_per_unit).toFixed(2)}` : "—"}
                      {currentRate && (
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                          /unit
                        </span>
                      )}
                    </div>
                    {currentRate && (
                      <p className="text-xs text-muted-foreground">
                        Effective from {format(new Date(currentRate.effective_from), "dd MMM yyyy")}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1"
                      onClick={() => {
                        setRateType(type);
                        setRateOpen(true);
                      }}
                    >
                      <Calculator className="size-3.5" /> {currentRate ? "Update Rate" : "Set Rate"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Record Reading Dialog */}
      <Dialog open={readingOpen} onOpenChange={setReadingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Record Meter Reading</DialogTitle>
            <DialogDescription>
              Enter the current meter reading — consumption and charges are calculated automatically
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRecordReading} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Unit *</label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit…" />
                </SelectTrigger>
                <SelectContent>
                  {(units as any[]).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.block_name} — Unit {u.unit_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Meter Type *</label>
                <Select value={meterType} onValueChange={(v) => setMeterType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electricity">⚡ Electricity</SelectItem>
                    <SelectItem value="gas">🔥 Gas</SelectItem>
                    <SelectItem value="water">💧 Water</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Reading Date *
                </label>
                <Input
                  type="date"
                  value={readingDate}
                  onChange={(e) => setReadingDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Current Reading (units) *
              </label>
              <Input
                required
                type="number"
                step="0.01"
                min="0"
                value={currentReading}
                onChange={(e) => setCurrentReading(e.target.value)}
                placeholder="e.g. 4520"
              />
              <p className="text-[10px] text-muted-foreground">
                Previous reading will be looked up automatically
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReadingOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={recordReading.isPending}>
                {recordReading.isPending ? "Saving…" : "Record & Charge"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Configure Rate Dialog */}
      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Set Tariff Rate</DialogTitle>
            <DialogDescription>
              Configure the per-unit rate for billing consumption
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveRate} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Meter Type</label>
              <Select value={rateType} onValueChange={(v) => setRateType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="electricity">⚡ Electricity</SelectItem>
                  <SelectItem value="gas">🔥 Gas</SelectItem>
                  <SelectItem value="water">💧 Water</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Rate per Unit (₨) *
              </label>
              <Input
                required
                type="number"
                step="0.01"
                min="0.01"
                value={ratePerUnit}
                onChange={(e) => setRatePerUnit(e.target.value)}
                placeholder="e.g. 24.50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Effective From *
              </label>
              <Input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveRate.isPending}>
                {saveRate.isPending ? "Saving…" : "Save Rate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
