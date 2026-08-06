import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { getAmenitiesFn, getBookingsFn, createBookingFn, createAmenityFn } from "@/lib/api/community";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar, Clock, DollarSign, ShieldAlert, Sparkles, User, Info, Plus } from "lucide-react";

export const Route = createFileRoute("/amenities")({
  head: () => ({
    meta: [
      { title: "Amenity Bookings — HousingOS" },
      {
        name: "description",
        content: "Reserve society amenities like swimming pools, banquet halls, and tennis courts.",
      },
    ],
  }),
  component: AmenitiesRoute,
});

function AmenitiesRoute() {
  return (
    <ModuleGate moduleKey="amenities">
      <AmenitiesPage />
    </ModuleGate>
  );
}

function AmenitiesPage() {
  const queryClient = useQueryClient();
  const { roles } = useAuth();
  const isAdmin = roles.includes("super_admin") || roles.includes("society_admin");

  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedAmenity, setSelectedAmenity] = useState<any | null>(null);

  // Form Booking States
  const [bookingDate, setBookingDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [guestsCount, setGuestsCount] = useState("0");
  const [purpose, setPurpose] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<any>("hall");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [rules, setRules] = useState("");

  const { data: amenities = [], isLoading } = useQuery({
    queryKey: ["amenities"],
    queryFn: () => getAmenitiesFn(),
  });

  const { data: bookings = [], isLoading: isLoadingBookings } = useQuery({
    queryKey: ["amenity-bookings"],
    queryFn: () => getBookingsFn({ data: { myOnly: false } }),
  });

  const createBookingMutation = useMutation({
    mutationFn: createBookingFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["amenity-bookings"] });
      toast.success("Booking request submitted! Pending approval.");
      setBookingDialogOpen(false);
      resetBookingForm();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create booking"),
  });

  const createAmenityMutation = useMutation({
    mutationFn: createAmenityFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["amenities"] });
      toast.success("Amenity created successfully!");
      setCreateOpen(false);
      setName("");
      setDescription("");
      setCapacity("");
      setHourlyRate("");
      setRules("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create amenity"),
  });

  const resetBookingForm = () => {
    setBookingDate("");
    setStartTime("");
    setEndTime("");
    setGuestsCount("0");
    setPurpose("");
  };

  const handleOpenBooking = (amenity: any) => {
    setSelectedAmenity(amenity);
    setBookingDialogOpen(true);
  };

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAmenity) return;

    createBookingMutation.mutate({
      data: {
        amenityId: selectedAmenity.id,
        bookingDate,
        startTime: `${startTime}:00`,
        endTime: `${endTime}:00`,
        guestsCount: parseInt(guestsCount, 10),
        purpose,
      },
    });
  };

  const handleCreateAmenity = (e: React.FormEvent) => {
    e.preventDefault();
    createAmenityMutation.mutate({
      data: {
        name,
        category,
        description: description || undefined,
        capacity: capacity ? parseInt(capacity, 10) : undefined,
        chargePerSlot: hourlyRate ? parseFloat(hourlyRate) : 0,
        rules: rules || undefined,
      }
    });
  };

  const formatCategory = (cat: string) => {
    const labels: Record<string, string> = {
      hall: "🏛️ Banquet Hall",
      gym: "💪 Fitness Gym",
      pool: "🏊 Swimming Pool",
      court: "🎾 Sports Court",
    };
    return labels[cat] ?? cat;
  };

  return (
    <AppShell
      title="Amenities & Bookings"
      subtitle="Reserve society facilities for your events and personal use"
      actions={
        isAdmin ? (
          <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Add Amenity
          </Button>
        ) : undefined
      }
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10 space-y-10">
        {/* Amenities grid */}
        <section className="space-y-4">
          <h3 className="font-serif text-xl font-bold tracking-tight">Communal Amenities</h3>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {amenities.map((a: any) => (
                <Card
                  key={a.id}
                  className="border-border/70 shadow-soft overflow-hidden flex flex-col justify-between"
                >
                  <div className="p-5 space-y-4">
                    <div>
                      <Badge
                        variant="secondary"
                        className="text-[9px] uppercase font-bold tracking-wider mb-2"
                      >
                        {formatCategory(a.category)}
                      </Badge>
                      <CardTitle className="font-serif text-lg font-bold leading-tight">
                        {a.name}
                      </CardTitle>
                    </div>

                    <div className="space-y-2 text-xs text-foreground/80 font-medium">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-muted-foreground">Hours</span>
                        <span className="font-mono">
                          {a.open_time ? a.open_time.slice(0, 5) : "N/A"} - {a.close_time ? a.close_time.slice(0, 5) : "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-muted-foreground">Rate</span>
                        <span>₨{Number(a.charge_per_slot ?? a.hourlyRate ?? 0).toLocaleString()} / hr</span>
                      </div>
                      {Number(a.refundable_deposit ?? 0) > 0 && (
                        <div className="flex items-center justify-between border-b pb-2">
                          <span className="text-muted-foreground">Security Deposit</span>
                          <span>₨{Number(a.refundable_deposit).toLocaleString()}</span>
                        </div>
                      )}
                      {a.capacity && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Max Capacity</span>
                          <span>{a.capacity} guests</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <CardFooter className="bg-surface/30 border-t p-4">
                    <Button
                      onClick={() => handleOpenBooking(a)}
                      className="w-full text-xs"
                      size="sm"
                    >
                      Reserve Facility
                    </Button>
                  </CardFooter>
                </Card>
              ))}

              {amenities.length === 0 && (
                <div className="py-10 text-center text-muted-foreground text-xs border rounded-lg border-dashed border-border/70 sm:col-span-3">
                  No public amenities available at this moment.
                </div>
              )}
            </div>
          )}
        </section>

        {/* Existing reservations table */}
        <section className="space-y-4">
          <h3 className="font-serif text-xl font-bold tracking-tight">Recent Reservations</h3>
          <Card className="border-border/70 shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface border-b border-border/60 text-muted-foreground font-mono uppercase text-[10px] tracking-wider">
                    <th className="p-4 font-semibold">Amenity</th>
                    <th className="p-4 font-semibold">Reserved By</th>
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold">Time Slot</th>
                    <th className="p-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoadingBookings ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center">
                        <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
                      </td>
                    </tr>
                  ) : (
                    bookings.map((b: any) => {
                      const statusColors: Record<string, string> = {
                        pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
                        approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                        cancelled: "bg-destructive/10 text-destructive border-destructive/20",
                        completed: "bg-primary/10 text-primary border-primary/20",
                      };

                      return (
                        <tr key={b.id} className="hover:bg-primary-soft/10 transition-colors">
                          <td className="p-4 font-semibold text-foreground/90">{b.amenity_name}</td>
                          <td className="p-4 text-muted-foreground flex items-center gap-1.5">
                            <User className="size-3.5" /> {b.user_name || "Resident"}
                          </td>
                          <td className="p-4 font-mono">
                            {format(new Date(b.booking_date), "dd/MM/yyyy")}
                          </td>
                          <td className="p-4 font-mono">
                            {b.start_time.slice(0, 5)} - {b.end_time.slice(0, 5)}
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-0.5 rounded border text-[9px] uppercase font-bold tracking-wider ${statusColors[b.status] ?? ""}`}
                            >
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {bookings.length === 0 && !isLoadingBookings && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        No reservation records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </div>

      {/* Book Slot Dialog */}
      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Reserve: {selectedAmenity?.name}</DialogTitle>
            <DialogDescription>
              Submit booking details. Subject to society approval and payment.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateBooking} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Booking Date *</label>
              <Input
                required
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Start Time *</label>
                <Input
                  required
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">End Time *</label>
                <Input
                  required
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Expected Guests Count
              </label>
              <Input
                type="number"
                min="0"
                value={guestsCount}
                onChange={(e) => setGuestsCount(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Purpose/Notes</label>
              <Textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={3}
                placeholder="Describe booking purpose (e.g. Birthday Party)"
              />
            </div>

            {selectedAmenity && Number(selectedAmenity.charge_per_slot ?? selectedAmenity.hourlyRate ?? 0) > 0 && (
              <div className="bg-primary-soft/30 border rounded-lg p-3 text-xs flex items-start gap-2 text-foreground/80">
                <DollarSign className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">Booking Fee Notice:</span> A
                  charge of ₨{Number(selectedAmenity.charge_per_slot ?? selectedAmenity.hourlyRate ?? 0).toLocaleString()} per hour
                  will be added to your ledger invoice.
                </div>
              </div>
            )}

            <DialogFooter className="border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setBookingDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createBookingMutation.isPending}>
                {createBookingMutation.isPending ? "Submitting…" : "Request Booking"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {isAdmin && (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Amenity</DialogTitle>
              <DialogDescription>Create a new society facility available for booking.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateAmenity} className="space-y-4 py-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Amenity Name</label>
                <Input
                  required
                  placeholder="e.g. Swimming Pool"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hall">Banquet Hall</SelectItem>
                    <SelectItem value="gym">Fitness Gym</SelectItem>
                    <SelectItem value="pool">Swimming Pool</SelectItem>
                    <SelectItem value="court">Sports Court</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Description</label>
                <Textarea
                  placeholder="Facility details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Capacity</label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="e.g. 50"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Hourly Rate</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 100.00"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Rules / Guidelines</label>
                <Textarea
                  placeholder="Any specific rules for usage..."
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createAmenityMutation.isPending}>
                  {createAmenityMutation.isPending ? "Saving..." : "Add Amenity"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </AppShell>
  );
}
