import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  getMeetingsFn,
  createMeetingFn,
  updateMeetingFn,
  getResolutionsFn,
  createResolutionFn,
  voteResolutionFn,
} from "@/lib/api/security-governance";
import { toast } from "sonner";
import {
  Landmark,
  CalendarClock,
  FileText,
  Plus,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/governance")({
  head: () => ({
    meta: [
      { title: "Society Governance — HousingOS" },
      {
        name: "description",
        content: "Committee meetings, resolutions, and governance for your society.",
      },
    ],
  }),
  component: GovernanceRoute,
});

function GovernanceRoute() {
  return (
    <ModuleGate moduleKey="governance">
      <GovernancePage />
    </ModuleGate>
  );
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function MeetingStatusBadge({ status }: { status: string }) {
  const variants: Record<string, any> = {
    scheduled: "secondary",
    completed: "default",
    cancelled: "destructive",
  };
  const icons: Record<string, any> = {
    scheduled: <Clock className="h-3 w-3" />,
    completed: <CheckCircle2 className="h-3 w-3" />,
    cancelled: <XCircle className="h-3 w-3" />,
  };
  return (
    <Badge variant={variants[status] ?? "outline"} className="flex items-center gap-1 capitalize">
      {icons[status]}
      {status}
    </Badge>
  );
}

function ResolutionStatusBadge({ status }: { status: string }) {
  const variants: Record<string, any> = {
    proposed: "secondary",
    passed: "default",
    failed: "destructive",
  };
  return (
    <Badge variant={variants[status] ?? "outline"} className="capitalize">
      {status}
    </Badge>
  );
}

// ─── Meetings Tab ─────────────────────────────────────────────────────────────

function MeetingsTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [minutesOpen, setMinutesOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [minutes, setMinutes] = useState("");
  const [newStatus, setNewStatus] = useState<"scheduled" | "completed" | "cancelled">("completed");

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["governance-meetings"],
    queryFn: () => getMeetingsFn(),
  });

  const create = useMutation({
    mutationFn: createMeetingFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-meetings"] });
      toast.success("Meeting scheduled");
      setOpen(false);
      setTitle("");
      setDescription("");
      setScheduledAt("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to schedule meeting"),
  });

  const update = useMutation({
    mutationFn: updateMeetingFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-meetings"] });
      toast.success("Meeting updated");
      setMinutesOpen(false);
      setSelectedMeeting(null);
      setMinutes("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update meeting"),
  });

  const openMinutes = (meeting: any) => {
    setSelectedMeeting(meeting);
    setMinutes(meeting.meeting_minutes || "");
    setNewStatus(meeting.status);
    setMinutesOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{meetings.length} meeting(s) on record</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Schedule Meeting
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading meetings...</p>
      ) : meetings.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No meetings scheduled yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {meetings.map((m: any) => (
            <Card key={m.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle className="text-base">{m.title}</CardTitle>
                    {m.description && (
                      <CardDescription className="mt-0.5">{m.description}</CardDescription>
                    )}
                  </div>
                  <MeetingStatusBadge status={m.status} />
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-4 items-center">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {new Date(m.scheduled_at).toLocaleString()}
                </p>
                {m.meeting_minutes && (
                  <p className="text-xs text-muted-foreground italic truncate max-w-xs">
                    Minutes: {m.meeting_minutes.substring(0, 60)}…
                  </p>
                )}
                <div className="ml-auto">
                  <Button size="sm" variant="outline" onClick={() => openMinutes(m)}>
                    <FileText className="h-3.5 w-3.5 mr-1" /> Edit Minutes
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Schedule Meeting Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Meeting</DialogTitle>
            <DialogDescription>Add a new committee meeting to the calendar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Meeting title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Agenda / description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Scheduled date & time
              </label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!title.trim() || !scheduledAt || create.isPending}
              onClick={() =>
                create.mutate({
                  data: { title, description: description || undefined, scheduledAt },
                })
              }
            >
              {create.isPending ? "Scheduling..." : "Schedule Meeting"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meeting Minutes Dialog */}
      <Dialog open={minutesOpen} onOpenChange={setMinutesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Meeting Minutes — {selectedMeeting?.title}</DialogTitle>
            <DialogDescription>Update meeting status and record the minutes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={newStatus} onValueChange={(v: any) => setNewStatus(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Write meeting minutes here..."
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              rows={6}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMinutesOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={update.isPending}
              onClick={() =>
                update.mutate({
                  data: {
                    meetingId: selectedMeeting.id,
                    status: newStatus,
                    meetingMinutes: minutes || undefined,
                  },
                })
              }
            >
              {update.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Resolutions Tab ──────────────────────────────────────────────────────────

function ResolutionsTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const { data: resolutions = [], isLoading } = useQuery({
    queryKey: ["governance-resolutions"],
    queryFn: () => getResolutionsFn(),
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["governance-meetings"],
    queryFn: () => getMeetingsFn(),
  });

  const [meetingId, setMeetingId] = useState("none");

  const create = useMutation({
    mutationFn: createResolutionFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-resolutions"] });
      toast.success("Resolution proposed");
      setOpen(false);
      setTitle("");
      setDescription("");
      setMeetingId("none");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create resolution"),
  });

  const vote = useMutation({
    mutationFn: voteResolutionFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-resolutions"] });
      toast.success("Vote recorded");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to record vote"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{resolutions.length} resolution(s)</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Propose Resolution
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading resolutions...</p>
      ) : resolutions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No resolutions proposed yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {resolutions.map((r: any) => {
            const totalVotes = r.votes_for + r.votes_against;
            const forPct = totalVotes > 0 ? Math.round((r.votes_for / totalVotes) * 100) : 0;
            const againstPct = totalVotes > 0 ? 100 - forPct : 0;
            return (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <CardTitle className="text-base">{r.title}</CardTitle>
                      {r.description && (
                        <CardDescription className="mt-0.5">{r.description}</CardDescription>
                      )}
                      {r.meeting_title && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" /> {r.meeting_title}
                        </p>
                      )}
                    </div>
                    <ResolutionStatusBadge status={r.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Vote bar */}
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>For: {r.votes_for}</span>
                      <span>Against: {r.votes_against}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${forPct}%` }}
                      />
                      <div
                        className="h-full bg-red-400 transition-all"
                        style={{ width: `${againstPct}%` }}
                      />
                    </div>
                  </div>
                  {/* Vote buttons (only if proposed) */}
                  {r.status === "proposed" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-300 hover:bg-green-50"
                        onClick={() => vote.mutate({ data: { resolutionId: r.id, vote: "for" } })}
                        disabled={vote.isPending}
                      >
                        <ThumbsUp className="h-3.5 w-3.5 mr-1" /> Vote For
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 border-red-300 hover:bg-red-50"
                        onClick={() =>
                          vote.mutate({ data: { resolutionId: r.id, vote: "against" } })
                        }
                        disabled={vote.isPending}
                      >
                        <ThumbsDown className="h-3.5 w-3.5 mr-1" /> Vote Against
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Propose Resolution</DialogTitle>
            <DialogDescription>Add a new resolution for committee voting.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Resolution title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            <Select value={meetingId} onValueChange={setMeetingId}>
              <SelectTrigger>
                <SelectValue placeholder="Link to a meeting (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No meeting linked</SelectItem>
                {(meetings as any[]).map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!title.trim() || create.isPending}
              onClick={() =>
                create.mutate({
                  data: {
                    title,
                    description: description || undefined,
                    meetingId: meetingId !== "none" ? meetingId : undefined,
                  },
                })
              }
            >
              {create.isPending ? "Proposing..." : "Propose"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Governance Page ─────────────────────────────────────────────────────

function GovernancePage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" />
            Society Governance
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage committee meetings, record minutes, and vote on society resolutions.
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="meetings">
          <TabsList className="mb-4">
            <TabsTrigger value="meetings" className="flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" /> Meetings
            </TabsTrigger>
            <TabsTrigger value="resolutions" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Resolutions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="meetings">
            <MeetingsTab />
          </TabsContent>
          <TabsContent value="resolutions">
            <ResolutionsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
