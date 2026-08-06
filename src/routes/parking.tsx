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
  getParkingSlotsFn,
  createParkingSlotFn,
  allocateParkingSlotFn,
  deallocateParkingSlotFn,
  getUnitsForParkingFn,
} from "@/lib/api/parking";
import { toast } from "sonner";
import { ParkingSquare, Plus, CheckCircle, XCircle, Info, User, Car } from "lucide-react";

export const Route = createFileRoute("/parking")({
  head: () => ({
    meta: [
      { title: "Parking Management — HousingOS" },
      {
        name: "description",
        content: "Manage society parking slots, resident allocation, and real-time status.",
      },
    ],
  }),
  component: ParkingRoute,
});

function ParkingRoute() {
  return (
    <ModuleGate moduleKey="parking">
      <ParkingPage />
    </ModuleGate>
  );
}

function ParkingPage() {
  const queryClient = useQueryClient();
  const [slotOpen, setSlotOpen] = useState(false);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  // Slot Form
  const [label, setLabel] = useState("");
  const [block, setBlock] = useState("");
  const [floorNumber, setFloorNumber] = useState("");
  const [slotType, setSlotType] = useState<"covered" | "open" | "bike">("open");

  // Allocation Form
  const [unitId, setUnitId] = useState("");
  const [residentName, setResidentName] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleType, setVehicleType] = useState("");

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ["parking-slots"],
    queryFn: () => getParkingSlotsFn(),
  });

  const { data: units = [] } = useQuery({
    queryKey: ["units-for-parking"],
    queryFn: () => getUnitsForParkingFn(),
  });

  const createSlot = useMutation({
    mutationFn: createParkingSlotFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parking-slots"] });
      toast.success("Parking slot added successfully");
      setSlotOpen(false);
      setLabel("");
      setBlock("");
      setFloorNumber("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to add slot"),
  });

  const allocateSlot = useMutation({
    mutationFn: allocateParkingSlotFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parking-slots"] });
      toast.success("Parking slot allocated successfully");
      setAllocateOpen(false);
      setUnitId("");
      setResidentName("");
      setVehiclePlate("");
      setVehicleType("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to allocate slot"),
  });

  const deallocateSlot = useMutation({
    mutationFn: deallocateParkingSlotFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parking-slots"] });
      toast.success("Parking slot deallocated");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to deallocate slot"),
  });

  const handleCreateSlot = (e: React.FormEvent) => {
    e.preventDefault();
    createSlot.mutate({
      data: {
        label,
        block: block || undefined,
        floorNumber: floorNumber ? Number(floorNumber) : undefined,
        slotType,
      },
    });
  };

  const handleAllocateSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlotId) return;
    if (!unitId) return toast.error("Please select a unit");
    allocateSlot.mutate({
      data: {
        slotId: selectedSlotId,
        unitId,
        residentName: residentName || undefined,
        vehiclePlate: vehiclePlate || undefined,
        vehicleType: vehicleType || undefined,
      },
    });
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      free: "secondary",
      occupied: "default",
      reserved: "outline",
      maintenance: "destructive",
    };
    return (
      <Badge variant={variants[status] ?? "secondary"} className="text-[10px] capitalize">
        {status}
      </Badge>
    );
  };

  return (
    <AppShell
      title="Parking Management"
      subtitle="Manage parking spaces, resident slot allocation, and occupancy logs"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10 space-y-8">
        {/* Header */}
        <section className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
              <ParkingSquare className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Total Spaces</p>
              <p className="text-2xl font-bold font-mono">{(slots as any[]).length}</p>
            </div>
          </div>
          <Button onClick={() => setSlotOpen(true)} size="sm" className="gap-1">
            <Plus className="size-4" /> Add Parking Slot
          </Button>
        </section>

        {/* Live Grid */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="size-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : slots.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <ParkingSquare className="size-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                No parking slots configured yet
              </p>
              <Button
                onClick={() => setSlotOpen(true)}
                size="sm"
                variant="outline"
                className="mt-2 gap-1"
              >
                <Plus className="size-4" /> Add First Slot
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(slots as any[]).map((slot) => (
              <Card
                key={slot.id}
                className="border-border/70 shadow-soft hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="grid size-8 place-items-center rounded bg-primary-soft text-primary shrink-0 font-serif font-bold text-sm">
                        {slot.label}
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold leading-none">
                          Slot {slot.label}
                        </CardTitle>
                        <CardDescription className="text-[10px] mt-0.5 capitalize">
                          {slot.slot_type} {slot.block ? `· Block ${slot.block}` : ""}{" "}
                          {slot.floor_number !== null ? `· Floor ${slot.floor_number}` : ""}
                        </CardDescription>
                      </div>
                    </div>
                    {statusBadge(slot.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-2">
                  {slot.status === "occupied" ? (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="size-3.5 shrink-0" />
                        <span>
                          Allocated: <strong>Unit {slot.unit_number}</strong>{" "}
                          {slot.resident_name ? `(${slot.resident_name})` : ""}
                        </span>
                      </div>
                      {slot.vehicle_plate && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Car className="size-3.5 shrink-0" />
                          <span className="font-mono">
                            {slot.vehicle_plate} {slot.vehicle_type ? `[${slot.vehicle_type}]` : ""}
                          </span>
                        </div>
                      )}
                      <div className="pt-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full h-7 text-[10px] uppercase font-bold"
                          onClick={() => deallocateSlot.mutate({ data: { slotId: slot.id } })}
                        >
                          Deallocate Space
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Info className="size-3.5" />
                        Space is ready to allocate
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-[11px]"
                        onClick={() => {
                          setSelectedSlotId(slot.id);
                          setAllocateOpen(true);
                        }}
                      >
                        Allocate Resident
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Slot Dialog */}
      <Dialog open={slotOpen} onOpenChange={setSlotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Add Parking Slot</DialogTitle>
            <DialogDescription>Add a new parking space to the register</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSlot} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Slot Label / Number *
              </label>
              <Input
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. P-101, B-22"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Block (optional)
                </label>
                <Input
                  value={block}
                  onChange={(e) => setBlock(e.target.value)}
                  placeholder="e.g. A"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Floor Number (optional)
                </label>
                <Input
                  type="number"
                  value={floorNumber}
                  onChange={(e) => setFloorNumber(e.target.value)}
                  placeholder="e.g. 0"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Slot Type</label>
              <Select value={slotType} onValueChange={(v) => setSlotType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">🚙 Open (Car)</SelectItem>
                  <SelectItem value="covered">🏢 Covered (Car)</SelectItem>
                  <SelectItem value="bike">🏍️ Bike</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSlotOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createSlot.isPending}>
                {createSlot.isPending ? "Adding…" : "Add Slot"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Allocate Slot Dialog */}
      <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Allocate Parking Space</DialogTitle>
            <DialogDescription>Assign this parking slot to a resident unit</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAllocateSlot} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Resident Unit *</label>
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
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Resident Name</label>
              <Input
                value={residentName}
                onChange={(e) => setResidentName(e.target.value)}
                placeholder="e.g. Imran Khan"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Vehicle Plate</label>
                <Input
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="e.g. ABC-123"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Vehicle Model / Type
                </label>
                <Input
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  placeholder="e.g. Toyota Corolla"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAllocateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={allocateSlot.isPending}>
                {allocateSlot.isPending ? "Allocating…" : "Allocate Space"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
