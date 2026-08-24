import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { PermissionGate } from "@/components/permission-gate";
import { getPollsFn, castVoteFn, createPollFn, getPollVotersFn } from "@/lib/api/community";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { formatDistanceToNow, isAfter } from "date-fns";
import { BarChart3, Clock, CheckCircle2, Circle, Plus } from "lucide-react";

export const Route = createFileRoute("/polls")({
  head: () => ({
    meta: [
      { title: "Polls & Voting — HousingOS" },
      {
        name: "description",
        content: "Vote on community initiatives, check AGM proposals and track voting status.",
      },
    ],
  }),
  component: PollsRoute,
});

function PollsRoute() {
  return (
    <ModuleGate moduleKey="polls">
      <PollsPage />
    </ModuleGate>
  );
}

function PollsPage() {
  const queryClient = useQueryClient();
  const { roles } = useAuth();
  const isAdmin = roles.includes("super_admin") || roles.includes("society_admin");

  const [createOpen, setCreateOpen] = useState(false);
  const [votersOpen, setVotersOpen] = useState(false);
  const [votersPollId, setVotersPollId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState("Yes, No");
  const [pollType, setPollType] = useState<any>("single");
  const [closesAt, setClosesAt] = useState("");

  const { data: polls = [], isLoading } = useQuery({
    queryKey: ["polls"],
    queryFn: () => getPollsFn(),
  });

  const { data: voters = [], isLoading: isLoadingVoters } = useQuery({
    queryKey: ["poll-voters", votersPollId],
    queryFn: () => getPollVotersFn({ data: { pollId: votersPollId! } }),
    enabled: !!votersPollId && isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: createPollFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polls"] });
      toast.success("Poll created successfully!");
      setCreateOpen(false);
      setQuestion("");
      setOptions("Yes, No");
      setClosesAt("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create poll"),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const optionsArray = options.split(",").map(o => o.trim()).filter(Boolean);
    if (optionsArray.length < 2) {
      toast.error("Please provide at least 2 options separated by commas");
      return;
    }
    createMutation.mutate({
      data: {
        question,
        type: pollType,
        options: optionsArray,
        opensAt: new Date().toISOString(),
        closesAt: new Date(closesAt).toISOString(),
      }
    });
  };

  const voteMutation = useMutation({
    mutationFn: castVoteFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polls"] });
      toast.success("Vote registered successfully!");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to submit vote"),
  });

  const handleVote = (pollId: string, choice: string) => {
    voteMutation.mutate({ data: { pollId, choice } });
  };

  return (
    <AppShell
      title="Polls & Voting"
      subtitle="Participate in community decisions and vote on society governance initiatives"
      actions={
        <PermissionGate moduleKey="polls" action="create" fallback={null}>
          <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Create Poll
          </Button>
        </PermissionGate>
      }
    >
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-10 space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-6">
            {polls.map((p: any) => {
              const isClosed = !isAfter(new Date(p.closes_at), new Date());
              const totalVotes = Object.values(p.results ?? {}).reduce(
                (a: any, b: any) => a + b,
                0,
              ) as number;

              return (
                <Card key={p.id} className="border-border/70 shadow-soft overflow-hidden">
                  <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant={p.type === "agm" ? "destructive" : "secondary"}
                          className="text-[9px] uppercase font-bold tracking-wider"
                        >
                          {p.type === "agm" ? "AGM Proposal" : "Community Poll"}
                        </Badge>
                        {isClosed ? (
                          <Badge
                            variant="outline"
                            className="text-[9px] border-muted-foreground text-muted-foreground"
                          >
                            Closed
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[9px] border-emerald-500 text-emerald-500 bg-emerald-500/5"
                          >
                            Active
                          </Badge>
                        )}
                        {p.is_anonymous && (
                          <Badge variant="outline" className="text-[9px]">
                            Anonymous
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="font-serif text-lg font-bold leading-snug mt-1.5">
                        {p.question}
                      </CardTitle>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Options list */}
                    <div className="space-y-2.5">
                      {p.options.map((opt: string) => {
                        const votes = p.results?.[opt] ?? 0;
                        const pct = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                        const isUserChoice = p.user_vote === opt;

                        return (
                          <div key={opt} className="relative">
                            {/* Result bar */}
                            {p.user_vote || isClosed ? (
                              <div className="flex flex-col border rounded-lg p-3 bg-surface/50 overflow-hidden relative">
                                <div
                                  className="absolute left-0 top-0 bottom-0 bg-primary/10 transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                                <div className="flex items-center justify-between text-xs font-medium z-10">
                                  <span className="flex items-center gap-1.5">
                                    {isUserChoice ? (
                                      <CheckCircle2 className="size-4 text-primary shrink-0" />
                                    ) : (
                                      <Circle className="size-4 text-muted-foreground/55 shrink-0" />
                                    )}
                                    {opt}
                                  </span>
                                  <span className="font-mono text-muted-foreground">
                                    {pct.toFixed(0)}% ({votes})
                                  </span>
                                </div>
                              </div>
                            ) : (
                              /* Interactive vote button */
                              <button
                                onClick={() => handleVote(p.id, opt)}
                                className="w-full text-left border rounded-lg p-3 hover:border-primary/50 hover:bg-primary-soft/10 active:bg-primary-soft/20 transition-all text-xs font-medium flex items-center gap-2"
                              >
                                <Circle className="size-4 text-muted-foreground shrink-0" />
                                {opt}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>

                  <CardFooter className="bg-surface/30 border-t py-2 px-5 text-[10px] text-muted-foreground font-mono flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <BarChart3 className="size-3.5" />
                        <span>
                          {totalVotes} vote{totalVotes === 1 ? "" : "s"} cast
                        </span>
                      </div>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          className="h-5 px-1.5 text-[9px] text-primary hover:bg-primary/5 hover:text-primary gap-0.5"
                          onClick={() => {
                            setVotersPollId(p.id);
                            setVotersOpen(true);
                          }}
                        >
                          View Voters
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      <span>
                        {isClosed
                          ? `Ended ${formatDistanceToNow(new Date(p.closes_at))} ago`
                          : `Closes in ${formatDistanceToNow(new Date(p.closes_at))}`}
                      </span>
                    </div>
                  </CardFooter>
                </Card>
              );
            })}

            {polls.length === 0 && (
              <div className="py-20 text-center text-muted-foreground text-sm border rounded-lg border-dashed border-border/70">
                No active or historical polls found.
              </div>
            )}
          </div>
        )}
      </div>

      {isAdmin && (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Poll</DialogTitle>
              <DialogDescription>Start a new community poll or AGM vote.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 py-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Question</label>
                <Input
                  required
                  placeholder="e.g. Should we upgrade the gym?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Poll Type</label>
                <Select value={pollType} onValueChange={setPollType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single Choice</SelectItem>
                    <SelectItem value="multi">Multiple Choice</SelectItem>
                    <SelectItem value="agm">AGM Vote</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Options (comma separated)</label>
                <Input
                  required
                  placeholder="Yes, No, Maybe"
                  value={options}
                  onChange={(e) => setOptions(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Closes At</label>
                <Input
                  required
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Poll"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {isAdmin && (
        <Dialog open={votersOpen} onOpenChange={setVotersOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Voter Details</DialogTitle>
              <DialogDescription>
                List of users who voted in this poll.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {isLoadingVoters ? (
                <div className="flex justify-center py-10">
                  <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : voters.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-10">
                  No votes have been cast yet.
                </p>
              ) : (
                <div className="divide-y divide-border border rounded-lg">
                  {voters.map((v: any, index: number) => (
                    <div key={index} className="flex justify-between items-center p-3 text-xs">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground">
                          {v.voter_name || "Unknown Resident"}
                        </p>
                        {v.voter_email && (
                          <p className="text-[10px] text-muted-foreground">
                            {v.voter_email}
                          </p>
                        )}
                      </div>
                      <div className="text-right space-y-0.5">
                        <Badge variant="outline" className="font-bold text-[10px]">
                          {v.choice}
                        </Badge>
                        <p className="text-[9px] text-muted-foreground font-mono">
                          {v.created_at ? formatDistanceToNow(new Date(v.created_at)) + " ago" : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => setVotersOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AppShell>
  );
}
