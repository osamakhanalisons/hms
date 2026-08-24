import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { PermissionGate } from "@/components/permission-gate";
import { getEventsFn, rsvpEventFn, createEventFn } from "@/lib/api/community";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar, MapPin, Users, Check, X, HelpCircle, Plus } from "lucide-react";

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

function EventsPage() {
  const queryClient = useQueryClient();
  const { roles } = useAuth();
  const isAdmin = roles.includes("super_admin") || roles.includes("society_admin");

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [venue, setVenue] = useState("");
  const [capacity, setCapacity] = useState("");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => getEventsFn(),
  });

  const createMutation = useMutation({
    mutationFn: createEventFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event created successfully!");
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      setStartsAt("");
      setEndsAt("");
      setVenue("");
      setCapacity("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create event"),
  });

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
      }
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
    <AppShell
      title="Event Calendar"
      subtitle="Keep track of society events, social gatherings, and recreational programs"
      actions={
        <PermissionGate moduleKey="events" action="create" fallback={null}>
          <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Create Event
          </Button>
        </PermissionGate>
      }
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-10 space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {events.map((e: any) => {
              const start = new Date(e.starts_at);
              const formattedDate = format(start, "eeee, MMMM d, yyyy");
              const formattedTime = `${format(start, "h:mm a")} - ${format(new Date(e.ends_at), "h:mm a")}`;

              return (
                <Card
                  key={e.id}
                  className="border-border/70 shadow-soft overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {/* Event image fallback */}
                    <div className="h-40 w-full bg-primary-soft/40 relative flex items-center justify-center text-primary border-b border-border/60">
                      {e.cover_url ? (
                        <img
                          src={e.cover_url}
                          alt={e.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Calendar className="size-16 stroke-[1.2]" />
                      )}
                      <Badge className="absolute right-3 top-3 uppercase font-mono tracking-wider text-[9px]">
                        Upcoming
                      </Badge>
                    </div>

                    <div className="p-5 space-y-4">
                      <div className="space-y-1.5">
                        <h3 className="font-serif text-lg font-bold leading-snug">{e.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                          {e.description}
                        </p>
                      </div>

                      <div className="space-y-2 border-t pt-3.5 text-xs text-foreground/80 font-medium">
                        <div className="flex items-center gap-2">
                          <Calendar className="size-4 text-primary shrink-0" />
                          <span>
                            {formattedDate} · {formattedTime}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="size-4 text-primary shrink-0" />
                          <span>{e.venue}</span>
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
                    <div className="border-t bg-surface/30 p-4 flex flex-col gap-3">
                      {/* Attendees count indicators */}
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                        <span>🟢 Yes: {e.rsvp_counts?.yes ?? 0}</span>
                        <span>🟡 Maybe: {e.rsvp_counts?.maybe ?? 0}</span>
                        <span>🔴 No: {e.rsvp_counts?.no ?? 0}</span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleRsvp(e.id, "yes")}
                          variant={e.user_rsvp === "yes" ? "default" : "outline"}
                          size="sm"
                          className="flex-1 text-xs gap-1 h-8"
                        >
                          <Check className="size-3.5" /> Going
                        </Button>
                        <Button
                          onClick={() => handleRsvp(e.id, "maybe")}
                          variant={e.user_rsvp === "maybe" ? "default" : "outline"}
                          size="sm"
                          className="flex-1 text-xs gap-1 h-8"
                        >
                          <HelpCircle className="size-3.5" /> Maybe
                        </Button>
                        <Button
                          onClick={() => handleRsvp(e.id, "no")}
                          variant={e.user_rsvp === "no" ? "default" : "outline"}
                          size="sm"
                          className="flex-1 text-xs gap-1 h-8"
                        >
                          <X className="size-3.5" /> Decline
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}

            {events.length === 0 && (
              <div className="py-20 text-center text-muted-foreground text-sm border rounded-lg border-dashed border-border/70 sm:col-span-2">
                No upcoming community events found.
              </div>
            )}
          </div>
        )}
      </div>

      {isAdmin && (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Event</DialogTitle>
              <DialogDescription>Add a new community event to the calendar.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 py-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Title</label>
                <Input
                  required
                  placeholder="e.g. Summer Festival"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Description</label>
                <Textarea
                  placeholder="Event details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Starts At</label>
                  <Input
                    required
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Ends At</label>
                  <Input
                    required
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Venue</label>
                  <Input
                    required
                    placeholder="e.g. Main Garden"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Capacity (Optional)</label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Event"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </AppShell>
  );
}
