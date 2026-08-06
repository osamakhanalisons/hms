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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { getAssetsFn, createAssetFn } from "@/lib/api/assets";
import { toast } from "sonner";
import { Package, Plus, Calendar, MapPin, Hash } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/assets")({
  head: () => ({
    meta: [
      { title: "Asset Register — HousingOS" },
      { name: "description", content: "Track society assets, equipment, and AMC contracts." },
    ],
  }),
  component: AssetsRoute,
});

function AssetsRoute() {
  return (
    <ModuleGate moduleKey="assets">
      <AssetsPage />
    </ModuleGate>
  );
}

function AssetsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [warrantyExpiresAt, setWarrantyExpiresAt] = useState("");

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => getAssetsFn(),
  });

  const createAsset = useMutation({
    mutationFn: createAssetFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Asset registered successfully");
      setOpen(false);
      setName("");
      setLocation("");
      setSerialNumber("");
      setWarrantyExpiresAt("");
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to create asset"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAsset.mutate({
      data: {
        name,
        location: location || undefined,
        serialNumber: serialNumber || undefined,
        warrantyExpiresAt: warrantyExpiresAt || undefined,
      },
    });
  };

  const isWarrantyExpired = (date: string | null) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  const isWarrantyExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const d = new Date(date);
    const in60days = new Date();
    in60days.setDate(in60days.getDate() + 60);
    return d > new Date() && d <= in60days;
  };

  return (
    <AppShell
      title="Asset Register"
      subtitle="Track society equipment, AMC contracts, and warranty status"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10 space-y-8">
        {/* Header actions */}
        <section className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
              <Package className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Total Assets</p>
              <p className="text-2xl font-bold font-mono">{assets.length}</p>
            </div>
          </div>
          <Button onClick={() => setOpen(true)} size="sm" className="gap-1">
            <Plus className="size-4" /> Register Asset
          </Button>
        </section>

        {/* Asset grid */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="size-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : assets.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Package className="size-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">No assets registered yet</p>
              <p className="text-xs text-muted-foreground">
                Register generators, lifts, pumps, CCTV equipment and more
              </p>
              <Button
                onClick={() => setOpen(true)}
                size="sm"
                variant="outline"
                className="mt-2 gap-1"
              >
                <Plus className="size-4" /> Register First Asset
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(assets as any[]).map((asset) => {
              const expired = isWarrantyExpired(asset.warranty_expires_at);
              const expiringSoon = isWarrantyExpiringSoon(asset.warranty_expires_at);
              return (
                <Card
                  key={asset.id}
                  className="border-border/70 shadow-soft hover:shadow-md transition-shadow"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="grid size-8 place-items-center rounded bg-primary-soft text-primary shrink-0">
                          <Package className="size-4" />
                        </div>
                        <CardTitle className="text-sm font-bold leading-tight">
                          {asset.name}
                        </CardTitle>
                      </div>
                      {asset.warranty_expires_at && (
                        <Badge
                          variant={expired ? "destructive" : expiringSoon ? "outline" : "secondary"}
                          className="text-[10px] shrink-0"
                        >
                          {expired ? "Expired" : expiringSoon ? "Expiring Soon" : "Warranty OK"}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs text-muted-foreground">
                    {asset.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 shrink-0" />
                        <span>{asset.location}</span>
                      </div>
                    )}
                    {asset.serial_number && (
                      <div className="flex items-center gap-1.5">
                        <Hash className="size-3.5 shrink-0" />
                        <span className="font-mono">{asset.serial_number}</span>
                      </div>
                    )}
                    {asset.warranty_expires_at && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3.5 shrink-0" />
                        <span>
                          Warranty: {format(new Date(asset.warranty_expires_at), "dd MMM yyyy")}
                        </span>
                      </div>
                    )}
                    <div className="pt-1 text-[10px] text-muted-foreground/60">
                      Added {format(new Date(asset.created_at), "dd MMM yyyy")}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Asset Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Register Asset</DialogTitle>
            <DialogDescription>
              Add a society asset to the register with AMC / warranty tracking
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Asset Name *</label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Generator Unit 1, CCTV DVR, Elevator Motor"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Location</label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Basement, Rooftop, Main Gate"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Serial Number</label>
              <Input
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="Manufacturer serial number"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Warranty Expiry Date
              </label>
              <Input
                type="date"
                value={warrantyExpiresAt}
                onChange={(e) => setWarrantyExpiresAt(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createAsset.isPending}>
                {createAsset.isPending ? "Saving…" : "Register Asset"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
