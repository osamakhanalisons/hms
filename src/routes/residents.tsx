import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { useAuth } from "@/hooks/use-auth";
import {
  getResidentsFn,
  createResidentFn,
  addVehicleFn,
  moveOutResidentFn,
} from "@/lib/api/residents";
import { getUnitsFn } from "@/lib/api/property";
import { Card, CardContent } from "@/components/ui/card";
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
import { toast } from "sonner";
import { Search, UserPlus, Car, LogOut, User } from "lucide-react";

export const Route = createFileRoute("/residents")({
  head: () => ({
    meta: [
      { title: "Residents Directory — HousingOS" },
      {
        name: "description",
        content: "View profiles, assign occupancies, and manage resident vehicles.",
      },
    ],
  }),
  component: ResidentsRoute,
});

function ResidentsRoute() {
  return (
    <ModuleGate moduleKey="residents">
      <ResidentsPage />
    </ModuleGate>
  );
}

function ResidentsPage() {
  const queryClient = useQueryClient();
  const { roles } = useAuth();
  const isAdmin = roles.includes("super_admin") || roles.includes("society_admin");
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [selectedResident, setSelectedResident] = useState<any | null>(null);

  // Resident form state
  const [unitId, setUnitId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cnic, setCnic] = useState("");
  const [type, setType] = useState<"owner" | "tenant">("owner");
  const [moveInDate, setMoveInDate] = useState("");

  // Vehicle form state
  const [vehicleType, setVehicleType] = useState<"car" | "motorcycle" | "van" | "truck" | "other">(
    "car",
  );
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [color, setColor] = useState("");

  const { data: residents = [], isLoading } = useQuery({
    queryKey: ["residents", search],
    queryFn: async () => getResidentsFn({ data: { search } }),
  });

  const { data: units = [] } = useQuery({
    queryKey: ["units"],
    queryFn: async () => getUnitsFn(),
  });

  const createResident = useMutation({
    mutationFn: createResidentFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["residents"] });
      queryClient.invalidateQueries({ queryKey: ["propertyTree"] });
      toast.success("Resident profile created successfully");
      setAddDialogOpen(false);
      resetResidentForm();
    },
  });

  const recordVehicle = useMutation({
    mutationFn: addVehicleFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["residents"] });
      toast.success("Vehicle registered successfully");
      setVehicleDialogOpen(false);
      resetVehicleForm();
    },
  });

  const moveOutResident = useMutation({
    mutationFn: moveOutResidentFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["residents"] });
      queryClient.invalidateQueries({ queryKey: ["propertyTree"] });
      toast.success("Resident moved out successfully");
    },
  });

  const resetResidentForm = () => {
    setUnitId("");
    setFullName("");
    setEmail("");
    setPhone("");
    setCnic("");
    setType("owner");
    setMoveInDate("");
  };

  const resetVehicleForm = () => {
    setVehicleType("car");
    setMake("");
    setModel("");
    setPlateNumber("");
    setColor("");
  };

  const handleSubmitResident = (e: React.FormEvent) => {
    e.preventDefault();
    createResident.mutate({
      data: {
        unitId,
        fullName,
        email: email || undefined,
        phone: phone || undefined,
        cnic: cnic || undefined,
        type,
        moveInDate: moveInDate || undefined,
      },
    });
  };

  const handleSubmitVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResident) return;
    recordVehicle.mutate({
      data: { residentId: selectedResident.id, vehicleType, make, model, plateNumber, color },
    });
  };

  const handleMoveOut = (residentId: string) => {
    if (confirm("Are you sure you want to log move-out for this resident?")) {
      moveOutResident.mutate({
        data: { residentId, moveOutDate: new Date().toISOString().slice(0, 10) },
      });
    }
  };

  return (
    <AppShell title="Residents Directory" subtitle="Manage homeowner and tenant profiles">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search residents by name, phone..."
              className="h-9 w-64 pl-9 text-sm border-border/70"
            />
          </div>
          {isAdmin && (
            <Button onClick={() => setAddDialogOpen(true)} className="gap-1.5 size-sm">
              <UserPlus className="size-4" /> Add Resident
            </Button>
          )}
        </header>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {residents.map((r: any) => (
              <Card key={r.id} className="border-border/70 shadow-soft">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary">
                        <User className="size-5" />
                      </div>
                      <div>
                        <h4 className="font-serif text-sm font-bold">{r.full_name}</h4>
                        <p className="text-xs text-muted-foreground">Unit {r.unit_number}</p>
                      </div>
                    </div>
                    <Badge
                      variant={r.type === "owner" ? "default" : "outline"}
                      className="text-[10px] uppercase"
                    >
                      {r.type}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground border-t pt-3">
                    {r.phone && (
                      <div>
                        Phone: <span className="text-foreground font-mono">{r.phone}</span>
                      </div>
                    )}
                    {r.email && (
                      <div>
                        Email: <span className="text-foreground font-mono">{r.email}</span>
                      </div>
                    )}
                    {r.cnic && (
                      <div>
                        CNIC: <span className="text-foreground font-mono">{r.cnic}</span>
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex items-center justify-between border-t pt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs px-2 h-7"
                        onClick={() => {
                          setSelectedResident(r);
                          setVehicleDialogOpen(true);
                        }}
                      >
                        <Car className="size-3.5" /> Add Vehicle
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-xs text-destructive hover:bg-destructive/10 px-2 h-7"
                        onClick={() => handleMoveOut(r.id)}
                      >
                        <LogOut className="size-3.5" /> Move Out
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {residents.length === 0 && (
              <div className="col-span-full py-20 text-center text-muted-foreground text-sm border rounded-lg border-dashed border-border/70">
                No residents matched the search filter.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Resident Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Add Resident Profile</DialogTitle>
            <DialogDescription>
              Assign a resident profile to a specific housing unit
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitResident} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Select Unit</label>
                <Select value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        Unit {u.unit_number} ({u.building_name || "Villa"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Full Name</label>
                <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Phone</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  CNIC (National ID)
                </label>
                <Input
                  value={cnic}
                  onChange={(e) => setCnic(e.target.value)}
                  placeholder="e.g. 35202-xxxxxxx-x"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Resident Type</label>
                <Select value={type} onValueChange={(val: any) => setType(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="tenant">Tenant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Profile</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Vehicle Dialog */}
      <Dialog open={vehicleDialogOpen} onOpenChange={setVehicleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Register Vehicle</DialogTitle>
            <DialogDescription>
              Assign vehicle license plate for {selectedResident?.full_name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitVehicle} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Vehicle Type</label>
                <Select value={vehicleType} onValueChange={(val: any) => setVehicleType(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="car">Car/Sedan/SUV</SelectItem>
                    <SelectItem value="motorcycle">Motorcycle/Bike</SelectItem>
                    <SelectItem value="van">Passenger Van</SelectItem>
                    <SelectItem value="truck">Pickup Truck</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Plate Number</label>
                <Input
                  required
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  placeholder="e.g. LE-9922"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Make</label>
                <Input
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  placeholder="e.g. Honda"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Model</label>
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. Civic"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Color</label>
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="e.g. Black"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVehicleDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Register Vehicle</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
