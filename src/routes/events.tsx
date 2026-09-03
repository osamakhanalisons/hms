import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { PermissionGate } from "@/components/permission-gate";
import { getEventsFn, rsvpEventFn, createEventFn, EventItem } from "@/lib/api/community";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format, isAfter } from "date-fns";
import {
  Calendar,
  MapPin,
  Users,
  Check,
  X,
  HelpCircle,
  Plus,
  CalendarDays,
  RefreshCw,
  Search,
  Filter,
  Sparkles,
  PartyPopper,
  MapPinned,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Event Calendar — HousingOS" },
      {
        name: "description",
        content: "Explore upcoming society events, festival programs, and RSVP to attend.",
      },
    ],
  }),
  component: EventsRoute,
});

function EventsRoute() {
  return (
    <ModuleGate moduleKey="events">
      <EventsPage />
    </ModuleGate>
  );
}

const EVENT_TEMPLATES = [
  {
    label: "Independence Gala",
    title: "Askari Annual Independence Gala & High Tea",
    venue: "Central Lawns & Officers Club",
    capacity: "350",
    description: "Flag hoisting ceremony, kids sports gala, patriotic musical performance, and lavish evening high tea buffet for all families.",
  },
  {
    label: "Eid Milan Party",
    title: "Community Eid Milan Party & Dinner",
    venue: "Community Hall & Banquet Area",
    capacity: "250",
    description: "Annual Eid celebration and dinner buffet. Live BBQ, children's game stalls, and social networking with society neighbors.",
  },
  {
    label: "Summer Sports Gala",
    title: "Inter-Block Summer Sports Tournament",
    venue: "Askari Sports Complex & Badminton Courts",
    capacity: "150",
    description: "Badminton, table tennis, and futsal championship for junior and senior residents. Trophies and refreshment distribution.",
  },
  {
    label: "Tree Plantation Drive",
    title: "Clean & Green Society Tree Plantation Campaign",
    venue: "Central Park Perimeter Track",
    capacity: "100",
    description: "Annual monsoon green drive. Plants and saplings will be provided to all participating families and youth volunteers.",
  },
  {
    label: "Health Camp",
    title: "Free Executive Health Screening & Blood Donation Camp",
    venue: "Society Medical Center / Club Annex",
    capacity: "200",
    description: "Free general physician consultation, blood pressure, sugar screening, and voluntary Red Crescent blood donation drive.",
  },
];

function getDefaultStartEndDates() {
  const s = new Date();
  s.setDate(s.getDate() + 7);
  s.setHours(16, 30, 0, 0);

  const e = new Date(s);
  e.setHours(20, 0, 0, 0);

  const pad = (n: number) => n.toString().padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  return { start: fmt(s), end: fmt(e) };
}

function EventsPage() {
  const queryClient = useQueryClient();
  const { roles } = useAuth();
  const isAdmin = roles.includes("super_admin") || roles.includes("society_admin");

  const [createOpen, setCreateOpen] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "upcoming" | "past" | "going">("all");

  // Form states
  const { start: defaultStart, end: defaultEnd } = getDefaultStartEndDates();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [endsAt, setEndsAt] = useState(defaultEnd);
  const [venue, setVenue] = useState("");
  const [capacity, setCapacity] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [allowRsvp, setAllowRsvp] = useState(true);

  const { data: events = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["events"],
    queryFn: () => getEventsFn(),
  });

  // KPI Calculations
  const totalEvents = events.length;
  const upcomingCount = useMemo(
    () => events.filter((e: any) => isAfter(new Date(e.starts_at), new Date())).length,
    [events]
  );
  const totalRsvpCount = useMemo(() => {
    return events.reduce((sum: number, e: any) => sum + (e.rsvp_counts?.yes ?? 0), 0);
  }, [events]);
  const venuesCount = useMemo(() => {
    const set = new Set(events.map((e: any) => e.venue).filter(Boolean));
    return set.size;
  }, [events]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((e: any) => {
      const isUpcoming = isAfter(new Date(e.starts_at), new Date());
      if (statusFilter === "upcoming" && !isUpcoming) return false;
      if (statusFilter === "past" && isUpcoming) return false;
      if (statusFilter === "going" && e.user_rsvp !== "yes") return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = e.title?.toLowerCase().includes(q);
        const matchesVenue = e.venue?.toLowerCase().includes(q);
        const matchesDesc = e.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesVenue && !matchesDesc) return false;
      }
      return true;
    });
  }, [events, statusFilter, search]);

  // Pagination
  const EVENTS_PER_PAGE = 6;
  const [eventPage, setEventPage] = useState(1);
  const totalEventPages = Math.max(1, Math.ceil(filteredEvents.length / EVENTS_PER_PAGE));
  const paginatedEvents = filteredEvents.slice(
    (eventPage - 1) * EVENTS_PER_PAGE,
    eventPage * EVENTS_PER_PAGE
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

  const createMutation = useMutation({
    mutationFn: createEventFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event scheduled successfully!");
      setCreateOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create event"),
  });

  const resetForm = () => {
    const d = getDefaultStartEndDates();
    setTitle("");
    setDescription("");
    setStartsAt(d.start);
    setEndsAt(d.end);
    setVenue("");
    setCapacity("");
    setCoverUrl("");
    setAllowRsvp(true);
  };

  const applyTemplate = (tpl: (typeof EVENT_TEMPLATES)[0]) => {
    setTitle(tpl.title);
    setVenue(tpl.venue);
    setCapacity(tpl.capacity);
    setDescription(tpl.description);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      data: {
        title,
        description: description || undefined,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        venue,
        capacity: capacity ? parseInt(capacity, 10) : undefined,
      },
    });
  };

  const rsvpMutation = useMutation({
    mutationFn: rsvpEventFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("RSVP updated!");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update RSVP"),
  });

  const handleRsvp = (eventId: string, status: "yes" | "no" | "maybe") => {
    rsvpMutation.mutate({ data: { eventId, status } });
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8 pb-16 px-2 sm:px-4">
        {/* Page Header & Action Toolbar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-6 pt-2">
          <div className="flex items-center gap-3.5">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs shrink-0">
              <CalendarDays className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Society Events & Calendar
                </h1>
                <Badge variant="secondary" className="font-mono text-xs px-2.5 py-0.5 font-medium">
                  {totalEvents} Scheduled
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Keep track of community programs, festival celebrations, sports galas, and RSVP to participate.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs border-border/80 hover:bg-muted cursor-pointer"
              onClick={() => refetch()}
              disabled={isRefetching || isLoading}
            >
              <RefreshCw className={cn("size-3.5 text-muted-foreground", (isRefetching || isLoading) && "animate-spin")} />
              Refresh
            </Button>
            <PermissionGate moduleKey="events" action="create" fallback={null}>
              <Button
                onClick={() => {
                  resetForm();
                  setCreateOpen(true);
                }}
                size="sm"
                className="h-9 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer px-4"
              >
                <Plus className="size-4" /> Create Event
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
                  Total Events
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-foreground mt-2 truncate">
                  {totalEvents}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 shrink-0">
                <CalendarDays className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Upcoming Programs
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-emerald-600 mt-2 truncate">
                  {upcomingCount}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                <PartyPopper className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Total RSVPs
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-primary mt-2 truncate">
                  {totalRsvpCount}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <UserCheck className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Society Venues
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-purple-600 mt-2 truncate">
                  {venuesCount}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-purple-500/10 text-purple-600 border border-purple-500/20 shrink-0">
                <MapPinned className="size-5.5" />
              </div>
            </div>
          </Card>
        </div>

        {/* Filter Toolbar */}
        <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search events by title, venue, or program details..."
                className="h-10 pl-9 text-xs"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setEventPage(1);
                }}
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as any);
                setEventPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-44 text-xs">
                <Filter className="mr-1.5 size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Events</SelectItem>
                <SelectItem value="upcoming" className="text-xs">🎉 Upcoming Only</SelectItem>
                <SelectItem value="past" className="text-xs">⏳ Past / Concluded</SelectItem>
                <SelectItem value="going" className="text-xs">✅ My RSVPs (Going)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Events Feed Grid */}
        <div className="space-y-5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-muted-foreground">
              {filteredEvents.length} events found
            </span>
            <span className="text-xs text-muted-foreground">
              page {eventPage} of {totalEventPages}
            </span>
          </div>

          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-80 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : paginatedEvents.length === 0 ? (
            <Card className="border-border/70 border-dashed p-14 text-center text-muted-foreground rounded-2xl">
              <CalendarDays className="size-12 mx-auto opacity-30 mb-3" />
              <p className="text-base font-medium">No community events found</p>
              <p className="text-xs opacity-60 mt-1.5">
                {search || statusFilter !== "all"
                  ? "Try clearing active search filters."
                  : 'Click "Create Event" to schedule a new community program.'}
              </p>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {paginatedEvents.map((e: any) => {
                const start = new Date(e.starts_at);
                const isUpcoming = isAfter(start, new Date());
                const formattedDate = format(start, "eeee, MMMM d, yyyy");
                const formattedTime = `${format(start, "h:mm a")} - ${format(new Date(e.ends_at), "h:mm a")}`;

                return (
                  <Card
                    key={e.id}
                    className="border-border/70 shadow-soft hover:shadow-md hover:border-border transition-all overflow-hidden flex flex-col justify-between rounded-2xl bg-card"
                  >
                    <div>
                      {/* Event Banner Header */}
                      <div className="h-44 w-full bg-muted/40 relative flex items-center justify-center border-b border-border/70 overflow-hidden">
                        {e.cover_url ? (
                          <img
                            src={e.cover_url}
                            alt={e.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="grid place-items-center text-muted-foreground/40">
                            <CalendarDays className="size-16 stroke-[1.2]" />
                          </div>
                        )}
                        <Badge
                          className={cn(
                            "absolute right-3.5 top-3.5 font-mono tracking-wider text-[10px] uppercase font-bold shadow-xs",
                            isUpcoming
                              ? "bg-emerald-600 text-white"
                              : "bg-muted-foreground/80 text-white"
                          )}
                        >
                          {isUpcoming ? "Upcoming" : "Concluded"}
                        </Badge>
                      </div>

                      {/* Content details */}
                      <div className="p-6 space-y-4">
                        <div className="space-y-1.5">
                          <h3 className="font-serif text-lg font-bold leading-snug text-foreground">
                            {e.title}
                          </h3>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                            {e.description || "No additional description provided."}
                          </p>
                        </div>

                        <div className="space-y-2 border-t border-border/60 pt-3.5 text-xs text-foreground/90 font-medium">
                          <div className="flex items-center gap-2">
                            <Calendar className="size-4 text-primary shrink-0" />
                            <span>
                              {formattedDate} · <strong className="font-semibold text-foreground">{formattedTime}</strong>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="size-4 text-primary shrink-0" />
                            <span className="truncate">{e.venue}</span>
                          </div>
                          {e.capacity && (
                            <div className="flex items-center gap-2">
                              <Users className="size-4 text-primary shrink-0" />
                              <span>Capacity: {e.capacity} attendees max</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {e.allow_rsvp && (
                      <div className="border-t border-border/60 bg-muted/20 p-4 px-6 flex flex-col gap-3">
                        {/* Attendees breakdown */}
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                          <div className="flex items-center gap-3">
                            <span className="text-emerald-600 font-semibold">🟢 Yes: {e.rsvp_counts?.yes ?? 0}</span>
                            <span className="text-amber-600">🟡 Maybe: {e.rsvp_counts?.maybe ?? 0}</span>
                            <span className="text-rose-600">🔴 No: {e.rsvp_counts?.no ?? 0}</span>
                          </div>
                          {e.user_rsvp && (
                            <span className="text-[10px] font-sans font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                              My RSVP: {e.user_rsvp.toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleRsvp(e.id, "yes")}
                            variant={e.user_rsvp === "yes" ? "default" : "outline"}
                            size="sm"
                            className={cn(
                              "flex-1 text-xs gap-1 h-8.5 rounded-xl cursor-pointer font-medium",
                              e.user_rsvp === "yes" && "bg-emerald-600 hover:bg-emerald-700 text-white"
                            )}
                          >
                            <Check className="size-3.5" /> Going
                          </Button>
                          <Button
                            onClick={() => handleRsvp(e.id, "maybe")}
                            variant={e.user_rsvp === "maybe" ? "default" : "outline"}
                            size="sm"
                            className={cn(
                              "flex-1 text-xs gap-1 h-8.5 rounded-xl cursor-pointer font-medium",
                              e.user_rsvp === "maybe" && "bg-amber-600 hover:bg-amber-700 text-white"
                            )}
                          >
                            <HelpCircle className="size-3.5" /> Maybe
                          </Button>
                          <Button
                            onClick={() => handleRsvp(e.id, "no")}
                            variant={e.user_rsvp === "no" ? "default" : "outline"}
                            size="sm"
                            className={cn(
                              "flex-1 text-xs gap-1 h-8.5 rounded-xl cursor-pointer font-medium",
                              e.user_rsvp === "no" && "bg-rose-600 hover:bg-rose-700 text-white"
                            )}
                          >
                            <X className="size-3.5" /> Decline
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalEventPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-6 border-t border-border/50">
              <button
                onClick={() => setEventPage((p) => Math.max(1, p - 1))}
                disabled={eventPage === 1}
                className="rounded-lg border border-border/70 px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
              >
                ← Prev
              </button>
              {getPageNums(eventPage, totalEventPages).map((pg, i) =>
                pg === "…" ? (
                  <span key={`e${i}`} className="px-1.5 text-xs text-muted-foreground select-none">
                    …
                  </span>
                ) : (
                  <button
                    key={pg}
                    onClick={() => setEventPage(pg as number)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                      eventPage === pg
                        ? "border-primary bg-primary text-primary-foreground font-bold shadow-xs"
                        : "border-border/70 hover:bg-muted"
                    )}
                  >
                    {pg}
                  </button>
                )
              )}
              <button
                onClick={() => setEventPage((p) => Math.min(totalEventPages, p + 1))}
                disabled={eventPage === totalEventPages}
                className="rounded-lg border border-border/70 px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Event Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <CalendarDays className="size-5" />
              </div>
              <div>
                <DialogTitle className="font-serif text-lg font-bold">Schedule Society Event</DialogTitle>
                <DialogDescription className="text-xs">
                  Create a new community gathering, festival celebration, or sports program.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Quick Event Templates */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
              <Sparkles className="size-3 text-amber-500" />
              <span>Quick Event Starters:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pb-1">
              {EVENT_TEMPLATES.map((tpl) => (
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

          <form onSubmit={handleCreate} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Event Title *</label>
              <Input
                required
                placeholder="e.g. Annual Independence Gala & High Tea"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-9 text-xs"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Starts At *</label>
                <Input
                  required
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Ends At *</label>
                <Input
                  required
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Venue / Location *</label>
                <Input
                  required
                  placeholder="e.g. Central Lawns & Officers Club"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Capacity (Max Attendees)</label>
                <Input
                  type="number"
                  placeholder="e.g. 350"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Event Description & Program Schedule</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Provide event details, schedule, participation guidelines, and meal arrangements..."
                className="text-xs leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-between border-t border-border/60 pt-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={allowRsvp}
                  onCheckedChange={setAllowRsvp}
                  id="event-rsvp"
                />
                <label htmlFor="event-rsvp" className="text-xs font-medium cursor-pointer">
                  🎟️ Enable Resident RSVP (Attendance Confirmation)
                </label>
              </div>
            </div>

            <DialogFooter className="border-t border-border/60 pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {createMutation.isPending ? "Scheduling…" : "Publish Event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
