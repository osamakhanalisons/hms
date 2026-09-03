import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { PermissionGate } from "@/components/permission-gate";
import { getAmenitiesFn, getBookingsFn, createBookingFn, createAmenityFn } from "@/lib/api/community";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import {
  Calendar,
  Clock,
  User,
  Plus,
  Building2,
  RefreshCw,
  Search,
  Filter,
  Sparkles,
  Dumbbell,
  Landmark,
  ShieldCheck,
  CheckCircle2,
  CalendarCheck,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const AMENITY_TEMPLATES = [
  { label: "Badminton Court", name: "All-Weather Badminton & Tennis Court", category: "court", capacity: "12", rate: "400", rules: "Non-marking court shoes mandatory. Max 2 slots per resident per week." },
  { label: "Swimming Pool", name: "Semi-Olympic Temperature Controlled Pool", category: "pool", capacity: "25", rate: "300", rules: "Proper swimwear mandatory. Children under 12 must be accompanied by adults." },
  { label: "Banquet Hall", name: "Executive Community Banquet Hall", category: "hall", capacity: "150", rate: "5000", rules: "Catering allowed from approved vendor list. Noise curfew at 11:00 PM." },
  { label: "Fitness Gym", name: "Askari Modern Cardio & Strength Gym", category: "gym", capacity: "30", rate: "0", rules: "Residents gym access is free. Please bring clean workout towel." },
  { label: "BBQ Lawn", name: "Open-Air Family BBQ Lawn & Gazebo", category: "hall", capacity: "40", rate: "1500", rules: "Cleaning deposit required. Charcoal and grill equipment provided." },
];

const CATEGORY_META: Record<string, { label: string; icon: string; bg: string; text: string; border: string }> = {
  hall: { label: "Banquet Hall", icon: "🏛️", bg: "bg-purple-500/10", text: "text-purple-700 dark:text-purple-400", border: "border-purple-500/20" },
  gym: { label: "Fitness Gym", icon: "💪", bg: "bg-blue-500/10", text: "text-blue-700 dark:text-blue-400", border: "border-blue-500/20" },
  pool: { label: "Swimming Pool", icon: "🏊", bg: "bg-cyan-500/10", text: "text-cyan-700 dark:text-cyan-400", border: "border-cyan-500/20" },
  court: { label: "Sports Court", icon: "🏸", bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-500/20" },
};

function getDefaultBookingDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function AmenitiesPage() {
  const queryClient = useQueryClient();
  const { roles } = useAuth();
  const isAdmin = roles.includes("super_admin") || roles.includes("society_admin");

  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedAmenity, setSelectedAmenity] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Filter states
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"amenities" | "reservations">("amenities");

  // Form Booking States
  const [bookingDate, setBookingDate] = useState(getDefaultBookingDate());
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("20:00");
  const [guestsCount, setGuestsCount] = useState("2");
  const [purpose, setPurpose] = useState("");

  // Create Amenity States
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"hall" | "gym" | "pool" | "court">("court");
  const [capacity, setCapacity] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [openTime, setOpenTime] = useState("07:00");
  const [closeTime, setCloseTime] = useState("22:00");
  const [rules, setRules] = useState("");

  const { data: amenities = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["amenities"],
    queryFn: () => getAmenitiesFn(),
  });

  const { data: bookings = [], isLoading: isLoadingBookings, refetch: refetchBookings } = useQuery({
    queryKey: ["amenity-bookings"],
    queryFn: () => getBookingsFn({ data: { myOnly: false } }),
  });

  // KPI Calculations
  const totalAmenities = amenities.length;
  const activeBookingsCount = useMemo(
    () => bookings.filter((b: any) => b.status === "approved" || b.status === "pending").length,
    [bookings]
  );
  const sportsCount = useMemo(
    () => amenities.filter((a: any) => a.category === "court" || a.category === "gym" || a.category === "pool").length,
    [amenities]
  );
  const hallCount = useMemo(
    () => amenities.filter((a: any) => a.category === "hall").length,
    [amenities]
  );

  // Filtered Amenities
  const filteredAmenities = useMemo(() => {
    return amenities.filter((a: any) => {
      if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = a.name?.toLowerCase().includes(q);
        const matchesRules = a.rules?.toLowerCase().includes(q);
        if (!matchesName && !matchesRules) return false;
      }
      return true;
    });
  }, [amenities, categoryFilter, search]);

  // Pagination
  const AMENITIES_PER_PAGE = 6;
  const BOOKINGS_PER_PAGE = 8;
  const [amenityPage, setAmenityPage] = useState(1);
  const [bookingPage, setBookingPage] = useState(1);

  const totalAmenityPages = Math.max(1, Math.ceil(filteredAmenities.length / AMENITIES_PER_PAGE));
  const totalBookingPages = Math.max(1, Math.ceil(bookings.length / BOOKINGS_PER_PAGE));

  const paginatedAmenities = filteredAmenities.slice(
    (amenityPage - 1) * AMENITIES_PER_PAGE,
    amenityPage * AMENITIES_PER_PAGE
  );
  const paginatedBookings = bookings.slice(
    (bookingPage - 1) * BOOKINGS_PER_PAGE,
    bookingPage * BOOKINGS_PER_PAGE
  );

  function getPageNums(cur: number, tot: number): (number | "…")[] {
    if (tot <= 7) return Array.from({ length: tot }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1];
    if (cur > 3) pages.push("…");
    const s = Math.max(2, cur - 1),
      e = Math.min(tot - 1, cur + 1);
    for (let i = s; i <= e; i++) pages.push(i);
    if (cur < tot - 2) pages.push("…");
    pages.push(tot);
    return pages;
  }

  const createBookingMutation = useMutation({
    mutationFn: createBookingFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["amenity-bookings"] });
      toast.success("Facility booking request submitted!");
      setBookingDialogOpen(false);
      resetBookingForm();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to reserve facility"),
  });

  const createAmenityMutation = useMutation({
    mutationFn: createAmenityFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["amenities"] });
      toast.success("New amenity registered successfully!");
      setCreateOpen(false);
      resetAmenityForm();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create amenity"),
  });

  const resetBookingForm = () => {
    setBookingDate(getDefaultBookingDate());
    setStartTime("18:00");
    setEndTime("20:00");
    setGuestsCount("2");
    setPurpose("");
  };

  const resetAmenityForm = () => {
    setName("");
    setCategory("court");
    setCapacity("");
    setHourlyRate("");
    setOpenTime("07:00");
    setCloseTime("22:00");
    setRules("");
  };

  const applyTemplate = (tpl: (typeof AMENITY_TEMPLATES)[0]) => {
    setName(tpl.name);
    setCategory(tpl.category as any);
    setCapacity(tpl.capacity);
    setHourlyRate(tpl.rate);
    setRules(tpl.rules);
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
        capacity: capacity ? parseInt(capacity, 10) : undefined,
        chargePerSlot: hourlyRate ? parseFloat(hourlyRate) : 0,
        rules: rules || undefined,
      },
    });
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8 pb-16 px-2 sm:px-4">
        {/* Page Header & Action Toolbar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-6 pt-2">
          <div className="flex items-center gap-3.5">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs shrink-0">
              <Building2 className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Amenities & Facility Bookings
                </h1>
                <Badge variant="secondary" className="font-mono text-xs px-2.5 py-0.5 font-medium">
                  {totalAmenities} Facilities
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Reserve community halls, sports courts, swimming pools, and track reservation schedules.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs border-border/80 hover:bg-muted cursor-pointer"
              onClick={() => {
                refetch();
                refetchBookings();
              }}
              disabled={isRefetching || isLoading}
            >
              <RefreshCw className={cn("size-3.5 text-muted-foreground", (isRefetching || isLoading) && "animate-spin")} />
              Refresh
            </Button>
            <PermissionGate moduleKey="amenities" action="create" fallback={null}>
              <Button
                onClick={() => {
                  resetAmenityForm();
                  setCreateOpen(true);
                }}
                size="sm"
                className="h-9 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer px-4"
              >
                <Plus className="size-4" /> Add Amenity
              </Button>
            </PermissionGate>
          </div>
        </div>

        {/* 4 KPI Summary Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Total Amenities
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-foreground mt-2 truncate">
                  {totalAmenities}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 shrink-0">
                <Building2 className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Active Bookings
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-emerald-600 mt-2 truncate">
                  {activeBookingsCount}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                <CalendarCheck className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Sports & Fitness
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-primary mt-2 truncate">
                  {sportsCount}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Dumbbell className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Halls & Banquets
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-purple-600 mt-2 truncate">
                  {hallCount}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-purple-500/10 text-purple-600 border border-purple-500/20 shrink-0">
                <Landmark className="size-5.5" />
              </div>
            </div>
          </Card>
        </div>

        {/* Filter Toolbar & Tab Selector */}
        <Card className="border-border/70 shadow-soft p-5 rounded-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search facility name, sports type, or rules..."
                  className="h-10 pl-9 text-xs"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setAmenityPage(1);
                  }}
                />
              </div>

              <Select
                value={categoryFilter}
                onValueChange={(v) => {
                  setCategoryFilter(v);
                  setAmenityPage(1);
                }}
              >
                <SelectTrigger className="h-10 w-44 text-xs">
                  <Filter className="mr-1.5 size-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Facilities</SelectItem>
                  <SelectItem value="court" className="text-xs">🏸 Sports Courts</SelectItem>
                  <SelectItem value="pool" className="text-xs">🏊 Swimming Pools</SelectItem>
                  <SelectItem value="gym" className="text-xs">💪 Fitness Gyms</SelectItem>
                  <SelectItem value="hall" className="text-xs">🏛️ Banquet Halls</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* View switcher buttons */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/70">
              <button
                type="button"
                onClick={() => setActiveTab("amenities")}
                className={cn(
                  "text-xs px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer",
                  activeTab === "amenities"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Facilities Catalog ({filteredAmenities.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("reservations")}
                className={cn(
                  "text-xs px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer",
                  activeTab === "reservations"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Recent Reservations ({bookings.length})
              </button>
            </div>
          </div>
        </Card>

        {/* TAB 1: Facilities Catalog Grid */}
        {activeTab === "amenities" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-muted-foreground">
                {filteredAmenities.length} facilities available
              </span>
              <span className="text-xs text-muted-foreground">
                page {amenityPage} of {totalAmenityPages}
              </span>
            </div>

            {isLoading ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : paginatedAmenities.length === 0 ? (
              <Card className="border-border/70 border-dashed p-14 text-center text-muted-foreground rounded-2xl">
                <Building2 className="size-12 mx-auto opacity-30 mb-3" />
                <p className="text-base font-medium">No amenities found</p>
                <p className="text-xs opacity-60 mt-1.5">
                  {search || categoryFilter !== "all"
                    ? "Try adjusting active search filters."
                    : 'Click "Add Amenity" to register a new community facility.'}
                </p>
              </Card>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {paginatedAmenities.map((a: any) => {
                  const meta = CATEGORY_META[a.category] || CATEGORY_META.court;
                  const rate = Number(a.charge_per_slot ?? a.hourlyRate ?? 0);
                  const deposit = Number(a.refundable_deposit ?? 0);

                  return (
                    <Card
                      key={a.id}
                      className="border-border/70 shadow-soft hover:shadow-md hover:border-border transition-all overflow-hidden flex flex-col justify-between rounded-2xl bg-card"
                    >
                      <div className="p-6 space-y-4">
                        <div className="space-y-2">
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider", meta.bg, meta.text, meta.border)}
                          >
                            {meta.icon} {meta.label}
                          </Badge>
                          <CardTitle className="font-serif text-lg font-bold leading-tight text-foreground">
                            {a.name}
                          </CardTitle>
                        </div>

                        {a.rules && (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {a.rules}
                          </p>
                        )}

                        <div className="space-y-2.5 border-t border-border/60 pt-4 text-xs font-medium">
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <Clock className="size-3.5 text-primary" /> Hours
                            </span>
                            <span className="font-mono text-foreground font-semibold">
                              {a.open_time ? a.open_time.slice(0, 5) : "07:00"} - {a.close_time ? a.close_time.slice(0, 5) : "22:00"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <Tag className="size-3.5 text-emerald-600" /> Slot Rate
                            </span>
                            <span className="font-mono text-foreground font-bold text-emerald-600 dark:text-emerald-400">
                              {rate > 0 ? `₨ ${rate.toLocaleString()} / hr` : "Free of Charge"}
                            </span>
                          </div>

                          {deposit > 0 && (
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <ShieldCheck className="size-3.5 text-amber-600" /> Deposit
                              </span>
                              <span className="font-mono text-foreground">₨ {deposit.toLocaleString()}</span>
                            </div>
                          )}

                          {a.capacity && (
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <User className="size-3.5 text-primary" /> Max Capacity
                              </span>
                              <span className="font-mono text-foreground">{a.capacity} guests</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <CardFooter className="bg-muted/20 border-t border-border/60 p-4 px-6">
                        <Button
                          onClick={() => handleOpenBooking(a)}
                          className="w-full text-xs h-9 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-medium cursor-pointer"
                          size="sm"
                        >
                          Reserve Facility
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Amenity Pagination */}
            {totalAmenityPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 pt-6 border-t border-border/50">
                <button
                  onClick={() => setAmenityPage((p) => Math.max(1, p - 1))}
                  disabled={amenityPage === 1}
                  className="rounded-lg border border-border/70 px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
                >
                  ← Prev
                </button>
                {getPageNums(amenityPage, totalAmenityPages).map((pg, i) =>
                  pg === "…" ? (
                    <span key={`e${i}`} className="px-1.5 text-xs text-muted-foreground select-none">
                      …
                    </span>
                  ) : (
                    <button
                      key={pg}
                      onClick={() => setAmenityPage(pg as number)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                        amenityPage === pg
                          ? "border-primary bg-primary text-primary-foreground font-bold shadow-xs"
                          : "border-border/70 hover:bg-muted"
                      )}
                    >
                      {pg}
                    </button>
                  )
                )}
                <button
                  onClick={() => setAmenityPage((p) => Math.min(totalAmenityPages, p + 1))}
                  disabled={amenityPage === totalAmenityPages}
                  className="rounded-lg border border-border/70 px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Recent Reservations Table */}
        {activeTab === "reservations" && (
          <div className="space-y-4">
            <h3 className="font-serif text-lg font-bold tracking-tight text-foreground">Recent Reservations</h3>
            <Card className="border-border/70 shadow-soft overflow-hidden rounded-2xl bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border/70 text-muted-foreground font-mono uppercase text-[10px] tracking-wider">
                      <th className="p-4 font-semibold">Amenity</th>
                      <th className="p-4 font-semibold">Reserved By</th>
                      <th className="p-4 font-semibold">Date</th>
                      <th className="p-4 font-semibold">Time Slot</th>
                      <th className="p-4 font-semibold">Purpose</th>
                      <th className="p-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {isLoadingBookings ? (
                      <tr>
                        <td colSpan={6} className="p-10 text-center">
                          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
                        </td>
                      </tr>
                    ) : (
                      paginatedBookings.map((b: any) => {
                        const statusColors: Record<string, string> = {
                          pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
                          approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
                          cancelled: "bg-destructive/10 text-destructive border-destructive/20",
                          completed: "bg-primary/10 text-primary border-primary/20",
                        };

                        return (
                          <tr key={b.id} className="hover:bg-muted/40 transition-colors">
                            <td className="p-4 font-semibold text-foreground">{b.amenity_name}</td>
                            <td className="p-4 text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <User className="size-3.5 text-primary shrink-0" />
                                <span className="font-medium text-foreground">{b.user_name || "Resident"}</span>
                              </div>
                            </td>
                            <td className="p-4 font-mono font-medium">
                              {b.booking_date ? format(new Date(b.booking_date), "dd/MM/yyyy") : "N/A"}
                            </td>
                            <td className="p-4 font-mono">
                              {b.start_time?.slice(0, 5)} - {b.end_time?.slice(0, 5)}
                            </td>
                            <td className="p-4 text-muted-foreground truncate max-w-[200px]">
                              {b.purpose || "Personal / Family recreation"}
                            </td>
                            <td className="p-4">
                              <span
                                className={cn(
                                  "px-2.5 py-0.5 rounded-md border text-[10px] uppercase font-bold tracking-wider",
                                  statusColors[b.status] ?? "bg-muted text-muted-foreground border-border"
                                )}
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
                        <td colSpan={6} className="p-10 text-center text-muted-foreground">
                          No reservation records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Reservations Pagination */}
              {totalBookingPages > 1 && (
                <div className="border-t border-border/60 px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-xs text-muted-foreground font-mono">
                    {bookings.length} reservations &mdash; page {bookingPage} of {totalBookingPages}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setBookingPage((p) => Math.max(1, p - 1))}
                      disabled={bookingPage === 1}
                      className="rounded-lg border border-border/70 px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      ← Prev
                    </button>
                    {getPageNums(bookingPage, totalBookingPages).map((pg, i) =>
                      pg === "…" ? (
                        <span key={`e${i}`} className="px-1.5 text-xs text-muted-foreground select-none">
                          …
                        </span>
                      ) : (
                        <button
                          key={pg}
                          onClick={() => setBookingPage(pg as number)}
                          className={cn(
                            "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                            bookingPage === pg
                              ? "border-primary bg-primary text-primary-foreground font-bold"
                              : "border-border/70 hover:bg-muted"
                          )}
                        >
                          {pg}
                        </button>
                      )
                    )}
                    <button
                      onClick={() => setBookingPage((p) => Math.min(totalBookingPages, p + 1))}
                      disabled={bookingPage === totalBookingPages}
                      className="rounded-lg border border-border/70 px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Reserve Slot Dialog */}
      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <CalendarCheck className="size-5" />
              </div>
              <div>
                <DialogTitle className="font-serif text-lg font-bold">Reserve: {selectedAmenity?.name}</DialogTitle>
                <DialogDescription className="text-xs">
                  Submit date & time slot for your reservation.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleCreateBooking} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Booking Date *</label>
              <Input
                required
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Start Time *</label>
                <Input
                  required
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">End Time *</label>
                <Input
                  required
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Expected Guests Count</label>
              <Input
                type="number"
                min="0"
                max={selectedAmenity?.capacity || 200}
                value={guestsCount}
                onChange={(e) => setGuestsCount(e.target.value)}
                placeholder="e.g. 2"
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Purpose / Event Remarks</label>
              <Input
                placeholder="e.g. Evening Badminton match, Family dinner..."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="border-t border-border/60 pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setBookingDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createBookingMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {createBookingMutation.isPending ? "Confirming…" : "Submit Reservation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Amenity Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Building2 className="size-5" />
              </div>
              <div>
                <DialogTitle className="font-serif text-lg font-bold">Register Society Amenity</DialogTitle>
                <DialogDescription className="text-xs">
                  Add a new public court, swimming pool, banquet hall, or fitness facility.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Quick Amenity Templates */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
              <Sparkles className="size-3 text-amber-500" />
              <span>Quick Facility Templates:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pb-1">
              {AMENITY_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className="text-[10px] px-2.5 py-1 rounded-lg border border-border/80 bg-muted/50 hover:bg-muted font-medium text-foreground transition-colors cursor-pointer"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleCreateAmenity} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Amenity Name *</label>
              <Input
                required
                placeholder="e.g. All-Weather Badminton Court"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-xs"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Facility Category</label>
                <Select value={category} onValueChange={(v) => setCategory(v as any)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="court" className="text-xs">🏸 Sports Court</SelectItem>
                    <SelectItem value="pool" className="text-xs">🏊 Swimming Pool</SelectItem>
                    <SelectItem value="gym" className="text-xs">💪 Fitness Gym</SelectItem>
                    <SelectItem value="hall" className="text-xs">🏛️ Banquet Hall</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Slot Rate (₨ / hour)</label>
                <Input
                  type="number"
                  placeholder="0 for free"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Opening Time</label>
                <Input
                  type="time"
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Closing Time</label>
                <Input
                  type="time"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Max Capacity (Guests)</label>
              <Input
                type="number"
                placeholder="e.g. 15"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Rules & Guidelines</label>
              <Textarea
                placeholder="Guidelines, dress code, noise curfew, booking policy..."
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                rows={3}
                className="text-xs leading-relaxed"
              />
            </div>

            <DialogFooter className="border-t border-border/60 pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createAmenityMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {createAmenityMutation.isPending ? "Creating…" : "Register Amenity"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
