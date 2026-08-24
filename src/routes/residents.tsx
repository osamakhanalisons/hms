import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { PermissionGate } from "@/components/permission-gate";
import { useAuth } from "@/hooks/use-auth";
import {
  getResidentsFn,
  createResidentFn,
  addVehicleFn,
  moveOutResidentFn,
  createResidentAccountFn,
} from "@/lib/api/residents";
import { getUnitsFn } from "@/lib/api/property";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Search,
  UserPlus,
  Car,
  LogOut,
  User,
  CheckCircle2,
  XCircle,
  Copy,
  MapPin,
  KeyRound,
  AlertCircle,
} from "lucide-react";

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

  // Credentials modal state — shown after admin creates a resident with a new account
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    tempPassword: string;
  } | null>(null);

  // Create account modal state
  const [creatingAccountFor, setCreatingAccountFor] = useState<any | null>(null);
  const [accountEmail, setAccountEmail] = useState("");

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
    queryKey: ["units", { vacantOnly: true }],
    queryFn: async () => getUnitsFn({ data: { vacantOnly: true } }),
  });

  const uniqueUnits = useMemo(() => {
    return units.filter(
      (unit: any, index: number, self: any[]) =>
        index === self.findIndex((u: any) => u.id === unit.id)
    );
  }, [units]);

  const createResident = useMutation({
    mutationFn: createResidentFn,
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["residents"] });
      queryClient.invalidateQueries({ queryKey: ["propertyTree"] });

      if (result?.accountCreated && result?.tempPassword) {
        // Show credentials modal — do NOT close add dialog immediately
        setCreatedCredentials({
          email: result.loginEmail,
          tempPassword: result.tempPassword,
        });
        toast.success("Resident added & login account created!");
      } else {
        toast.success(
          result?.accountCreated === false && result?.message
            ? result.message
            : "Resident profile created successfully",
        );
      }
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

  const handleCreateAccount = async () => {
    if (!creatingAccountFor || !accountEmail) return;
    try {
      const result = await createResidentAccountFn({
        data: {
          personId: creatingAccountFor.person_id,
          email: accountEmail,
        },
      });

      if (result.accountCreated && result.tempPassword) {
        setCreatedCredentials({
          email: result.loginEmail,
          tempPassword: result.tempPassword,
        });
        toast.success("Account created successfully!");
      } else {
        toast.success(result.message || "Account linked successfully!");
      }

      setCreatingAccountFor(null);
      setAccountEmail("");
      queryClient.invalidateQueries({ queryKey: ["residents"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to create account");
    }
  };

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    navigator.clipboard.writeText(
      `Email: ${createdCredentials.email}\nPassword: ${createdCredentials.tempPassword}`,
    );
    toast.success("Credentials copied to clipboard!");
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
          <PermissionGate moduleKey="residents" action="create" fallback={null}>
            <Button
              onClick={() => {
                createResident.reset();
                setAddDialogOpen(true);
              }}
              className="gap-1.5 size-sm"
            >
              <UserPlus className="size-4" /> Add Resident
            </Button>
          </PermissionGate>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {residents.map((r: any) => (
              <Card key={r.id} className="border-border/70 shadow-soft">
                <CardContent className="p-5 space-y-3">
                  {/* Header row: avatar + name + type badge */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary">
                        <User className="size-5" />
                      </div>
                      <div>
                        <h4 className="font-serif text-sm font-bold leading-tight">{r.full_name}</h4>
                        <p className="text-xs text-muted-foreground">Unit {r.unit_number}</p>
                      </div>
                    </div>
                    <Badge
                      variant={r.type === "owner" ? "default" : "outline"}
                      className="text-[10px] uppercase shrink-0"
                    >
                      {r.type}
                    </Badge>
                  </div>

                  {/* Location info — hierarchy */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                    <MapPin className="size-3 shrink-0" />
                    <span>
                      {[
                        r.society_name,
                        r.block_name && `Block ${r.block_name}`,
                        r.building_name,
                      ]
                        .filter(Boolean)
                        .join(" › ")}
                    </span>
                  </div>

                  {/* Account linked / not linked badge */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {r.user_id ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="size-3" /> Account Linked
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 border border-red-200">
                          <XCircle className="size-3" /> No Login Account
                        </span>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-[10px] h-6 px-2 py-0"
                            onClick={() => {
                              setCreatingAccountFor(r);
                              setAccountEmail(r.email || "");
                            }}
                          >
                            + Create Account
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Contact info */}
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

                  {/* Vehicles */}
                  {r.vehicles && r.vehicles.length > 0 && (
                    <div className="border-t pt-3 space-y-1.5">
                      <div className="text-xs font-semibold text-foreground flex items-center gap-1">
                        <Car className="size-3.5 text-muted-foreground" />
                        <span>Registered Vehicles ({r.vehicles.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {r.vehicles.map((v: any) => (
                          <span
                            key={v.id}
                            className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground border font-mono"
                          >
                            <span className="font-sans uppercase text-[9px] text-muted-foreground">{v.vehicle_type}:</span> {v.plate_number} {v.make && `(${v.make}${v.model ? ` ${v.model}` : ""})`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action buttons (admin only) */}
                  <PermissionGate moduleKey="residents" action="create" fallback={null}>
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
                      <PermissionGate moduleKey="residents" action="edit" fallback={null}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-xs text-destructive hover:bg-destructive/10 px-2 h-7"
                          onClick={() => handleMoveOut(r.id)}
                        >
                          <LogOut className="size-3.5" /> Move Out
                        </Button>
                      </PermissionGate>
                    </div>
                  </PermissionGate>
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

      {/* ─── Add Resident Dialog ──────────────────────────────────────────── */}
      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) {
            createResident.reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Add Resident Profile</DialogTitle>
            <DialogDescription>
              Assign a resident profile to a specific housing unit. A login account will be
              auto-created if you provide an email address.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitResident} className="space-y-4 py-2">
            {createResident.isError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive flex items-start gap-2 text-xs">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block mb-0.5">Error Adding Resident</span>
                  {createResident.error?.message}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Select Unit</label>
                <Select value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueUnits.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_path || `Unit ${u.unit_number} (${u.building_name || "Villa"})`}
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
                <label className="text-xs font-semibold text-muted-foreground">
                  Email{" "}
                  <span className="font-normal text-muted-foreground">(creates login account)</span>
                </label>
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
              <Button type="submit" disabled={createResident.isPending}>
                {createResident.isPending ? "Adding..." : "Add Profile"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Temp Password / Credentials Modal ───────────────────────────── */}
      {createdCredentials && (
        <Dialog open={true} onOpenChange={() => setCreatedCredentials(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-serif">
                <CheckCircle2 className="size-5 text-emerald-600" />
                Resident Added Successfully
              </DialogTitle>
              <DialogDescription>
                A login account has been created. Share these credentials with the resident.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 uppercase tracking-wide">
                <KeyRound className="size-3.5" />
                Login Credentials
              </div>
              <div className="space-y-2 font-mono text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">Email</span>
                  <span className="font-semibold text-foreground">{createdCredentials.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">Password</span>
                  <span className="text-lg font-bold tracking-widest text-foreground">
                    {createdCredentials.tempPassword}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-amber-700 mt-1">
                ⚠️ Save this password now — it will not be shown again.
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={handleCopyCredentials}
              >
                <Copy className="size-3.5" /> Copy Credentials
              </Button>
              <Button onClick={() => setCreatedCredentials(null)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── Add Vehicle Dialog ───────────────────────────────────────────── */}
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

      {/* ─── Create Login Account Dialog ───────────────────────────────────── */}
      <Dialog open={!!creatingAccountFor} onOpenChange={() => setCreatingAccountFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Create Login Account</DialogTitle>
            <DialogDescription>
              Create a login account for {creatingAccountFor?.full_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="accountEmailInput">Email Address</Label>
              <Input
                id="accountEmailInput"
                type="email"
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                placeholder="resident@example.com"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatingAccountFor(null)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAccount} disabled={!accountEmail}>
              Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
