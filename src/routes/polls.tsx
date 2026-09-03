import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatDistanceToNow, isAfter } from "date-fns";
import {
  BarChart3,
  Clock,
  CheckCircle2,
  Circle,
  Plus,
  Vote,
  RefreshCw,
  Search,
  Filter,
  Sparkles,
  Users,
  CheckSquare,
  ShieldCheck,
  TrendingUp,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const POLL_TEMPLATES = [
  { label: "Market Day", question: "Preferred day for Weekly Society Fruit & Vegetable Market?", type: "single", options: "Friday, Saturday, Sunday" },
  { label: "Speed Bumps", question: "Proposal to install electronic speed signs and rubber breakers on Main Boulevard", type: "single", options: "Agree (High Priority), Disagree (Waste of funds), Neutral" },
  { label: "Pool Timings", question: "Proposal to extend Swimming Pool timings to 10:00 PM in Summers", type: "single", options: "Approve 10:00 PM extension, Keep 08:30 PM closing, Weekends only" },
  { label: "AGM Resolution", question: "AGM Resolution 2026: Upgrade CCTV Security Network across all boundary gates", type: "agm", options: "In Favor, Against, Abstain" },
  { label: "Solar Energy", question: "Feasibility Study for Solar Rooftop Net-Metering on Society Clubhouse", type: "single", options: "Strongly Support, Needs More Financial Review, Oppose" },
];

function getDefaultClosesAt() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function PollsPage() {
  const queryClient = useQueryClient();
  const { roles } = useAuth();
  const isAdmin = roles.includes("super_admin") || roles.includes("society_admin");

  const [createOpen, setCreateOpen] = useState(false);
  const [votersOpen, setVotersOpen] = useState(false);
  const [votersPollId, setVotersPollId] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "closed" | "voted">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "single" | "multi" | "agm">("all");

  // Create Form states
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState("Yes, No");
  const [pollType, setPollType] = useState<"single" | "multi" | "agm">("single");
  const [closesAt, setClosesAt] = useState(getDefaultClosesAt());
  const [isAnonymous, setIsAnonymous] = useState(false);

  const { data: polls = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["polls"],
    queryFn: () => getPollsFn(),
  });

  // KPI Calculations
  const totalPolls = polls.length;
  const activeCount = useMemo(
    () => polls.filter((p: any) => isAfter(new Date(p.closes_at), new Date())).length,
    [polls]
  );
  const totalVotesSum = useMemo(() => {
    return polls.reduce((sum: number, p: any) => {
      const votes = Object.values(p.results ?? {}).reduce((a: any, b: any) => a + Number(b), 0) as number;
      return sum + votes;
    }, 0);
  }, [polls]);
  const agmCount = useMemo(() => polls.filter((p: any) => p.type === "agm").length, [polls]);

  // Filtered Polls
  const filteredPolls = useMemo(() => {
    return polls.filter((p: any) => {
      const isClosed = !isAfter(new Date(p.closes_at), new Date());
      if (statusFilter === "active" && isClosed) return false;
      if (statusFilter === "closed" && !isClosed) return false;
      if (statusFilter === "voted" && !p.user_vote) return false;

      if (typeFilter !== "all" && p.type !== typeFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesQ = p.question?.toLowerCase().includes(q);
        const matchesOpts = Array.isArray(p.options) && p.options.some((o: string) => o.toLowerCase().includes(q));
        if (!matchesQ && !matchesOpts) return false;
      }
      return true;
    });
  }, [polls, statusFilter, typeFilter, search]);

  // Pagination
  const POLLS_PER_PAGE = 8;
  const [pollPage, setPollPage] = useState(1);
  const totalPollPages = Math.max(1, Math.ceil(filteredPolls.length / POLLS_PER_PAGE));
  const paginatedPolls = filteredPolls.slice(
    (pollPage - 1) * POLLS_PER_PAGE,
    pollPage * POLLS_PER_PAGE
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
      resetCreateForm();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create poll"),
  });

  const resetCreateForm = () => {
    setQuestion("");
    setOptions("Yes, No");
    setPollType("single");
    setClosesAt(getDefaultClosesAt());
    setIsAnonymous(false);
  };

  const applyTemplate = (tpl: (typeof POLL_TEMPLATES)[0]) => {
    setQuestion(tpl.question);
    setPollType(tpl.type as any);
    setOptions(tpl.options);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const optionsArray = options
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
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
        isAnonymous,
      },
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
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8 pb-16 px-2 sm:px-4">
        {/* Page Header & Action Toolbar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-6 pt-2">
          <div className="flex items-center gap-3.5">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs shrink-0">
              <Vote className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Polls & Community Voting
                </h1>
                <Badge variant="secondary" className="font-mono text-xs px-2.5 py-0.5 font-medium">
                  {totalPolls} Total
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Participate in community decisions, vote on AGM proposals, and monitor democratic voting initiatives.
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
            <PermissionGate moduleKey="polls" action="create" fallback={null}>
              <Button
                onClick={() => {
                  resetCreateForm();
                  setCreateOpen(true);
                }}
                size="sm"
                className="h-9 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer px-4"
              >
                <Plus className="size-4" /> Create Poll
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
                  Total Polls
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-foreground mt-2 truncate">
                  {totalPolls}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 shrink-0">
                <Vote className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Active Voting
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-emerald-600 mt-2 truncate">
                  {activeCount}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                <CheckSquare className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Votes Recorded
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-primary mt-2 truncate">
                  {totalVotesSum}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <BarChart3 className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  AGM Proposals
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-purple-600 mt-2 truncate">
                  {agmCount}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-purple-500/10 text-purple-600 border border-purple-500/20 shrink-0">
                <Award className="size-5.5" />
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
                placeholder="Search voting questions, options, or proposals..."
                className="h-10 pl-9 text-xs"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPollPage(1);
                }}
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as any);
                setPollPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-44 text-xs">
                <Filter className="mr-1.5 size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                <SelectItem value="active" className="text-xs">🟢 Active Voting</SelectItem>
                <SelectItem value="closed" className="text-xs">⚪ Closed / Ended</SelectItem>
                <SelectItem value="voted" className="text-xs">🗳️ Voted by Me</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v as any);
                setPollPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-44 text-xs">
                <TrendingUp className="mr-1.5 size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Poll Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Poll Types</SelectItem>
                <SelectItem value="single" className="text-xs">Single Choice</SelectItem>
                <SelectItem value="multi" className="text-xs">Multiple Choice</SelectItem>
                <SelectItem value="agm" className="text-xs">📜 AGM Vote</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Polls Feed Grid */}
        <div className="space-y-5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-muted-foreground">
              {filteredPolls.length} polls found
            </span>
            <span className="text-xs text-muted-foreground">
              page {pollPage} of {totalPollPages}
            </span>
          </div>

          {isLoading ? (
            <div className="grid gap-5 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-56 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : paginatedPolls.length === 0 ? (
            <Card className="border-border/70 border-dashed p-14 text-center text-muted-foreground rounded-2xl">
              <Vote className="size-12 mx-auto opacity-30 mb-3" />
              <p className="text-base font-medium">No polls found</p>
              <p className="text-xs opacity-60 mt-1.5">
                {search || statusFilter !== "all" || typeFilter !== "all"
                  ? "Try clearing active search filters."
                  : 'Click "Create Poll" to initiate a new community vote.'}
              </p>
            </Card>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {paginatedPolls.map((p: any) => {
                const isClosed = !isAfter(new Date(p.closes_at), new Date());
                const totalVotes = Object.values(p.results ?? {}).reduce(
                  (a: any, b: any) => a + Number(b),
                  0
                ) as number;

                return (
                  <Card
                    key={p.id}
                    className={cn(
                      "flex flex-col justify-between border-border/70 shadow-soft hover:shadow-md hover:border-border transition-all rounded-2xl overflow-hidden bg-card border-l-4",
                      p.type === "agm"
                        ? "border-l-purple-500 bg-purple-500/[0.02]"
                        : isClosed
                        ? "border-l-muted-foreground/40 bg-muted/[0.02]"
                        : "border-l-primary bg-primary/[0.01]"
                    )}
                  >
                    <CardHeader className="p-6 pb-3 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={p.type === "agm" ? "default" : "outline"}
                            className={cn(
                              "text-[10px] uppercase font-bold tracking-wider rounded-md px-2 py-0.5",
                              p.type === "agm"
                                ? "bg-purple-600 text-white"
                                : "bg-primary/10 text-primary border-primary/25"
                            )}
                          >
                            {p.type === "agm" ? "📜 AGM Proposal" : "🗳️ Community Poll"}
                          </Badge>

                          {isClosed ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-muted-foreground/40 text-muted-foreground bg-muted/40 font-medium rounded-md px-2 py-0.5"
                            >
                              ⚪ Closed
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-medium rounded-md px-2 py-0.5"
                            >
                              🟢 Active Voting
                            </Badge>
                          )}

                          {p.is_anonymous && (
                            <Badge variant="outline" className="text-[10px] bg-muted/60 text-muted-foreground rounded-md">
                              Anonymous
                            </Badge>
                          )}
                        </div>

                        <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                          <Clock className="size-3.5 text-muted-foreground" />
                          <span>
                            {isClosed
                              ? `Ended ${formatDistanceToNow(new Date(p.closes_at))} ago`
                              : `Closes in ${formatDistanceToNow(new Date(p.closes_at))}`}
                          </span>
                        </div>
                      </div>

                      <CardTitle className="font-serif text-base font-bold leading-snug text-foreground pt-1">
                        {p.question}
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="px-6 py-2 space-y-2.5">
                      {p.options.map((opt: string) => {
                        const votes = Number(p.results?.[opt] ?? 0);
                        const pct = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                        const isUserChoice = p.user_vote === opt;

                        return (
                          <div key={opt} className="relative">
                            {p.user_vote || isClosed ? (
                              <div
                                className={cn(
                                  "flex flex-col border rounded-xl p-3 bg-muted/30 overflow-hidden relative transition-all",
                                  isUserChoice && "border-primary/50 ring-1 ring-primary/30 bg-primary/[0.04]"
                                )}
                              >
                                <div
                                  className={cn(
                                    "absolute left-0 top-0 bottom-0 transition-all rounded-l-xl opacity-20",
                                    isUserChoice ? "bg-primary" : "bg-foreground"
                                  )}
                                  style={{ width: `${pct}%` }}
                                />
                                <div className="flex items-center justify-between text-xs font-medium z-10 gap-2">
                                  <span className="flex items-center gap-2 min-w-0">
                                    {isUserChoice ? (
                                      <CheckCircle2 className="size-4 text-primary shrink-0" />
                                    ) : (
                                      <Circle className="size-4 text-muted-foreground/40 shrink-0" />
                                    )}
                                    <span className={cn("truncate", isUserChoice && "font-bold text-foreground")}>{opt}</span>
                                  </span>
                                  <span className="font-mono text-[11px] text-muted-foreground shrink-0 font-semibold">
                                    {pct.toFixed(0)}% <span className="text-[10px] font-normal font-sans">({votes})</span>
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleVote(p.id, opt)}
                                className="w-full text-left border border-border/80 rounded-xl p-3 hover:border-primary/60 hover:bg-primary/[0.04] active:scale-[0.99] transition-all text-xs font-medium flex items-center justify-between gap-2 group cursor-pointer"
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  <Circle className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                                  <span className="truncate text-foreground">{opt}</span>
                                </span>
                                <span className="text-[10px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                  Click to Vote
                                </span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>

                    <CardFooter className="px-6 py-3.5 bg-muted/20 border-t border-border/50 text-xs text-muted-foreground font-mono flex flex-wrap items-center justify-between gap-2 mt-2">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <BarChart3 className="size-3.5 text-primary" />
                          <span>
                            <strong>{totalVotes}</strong> vote{totalVotes === 1 ? "" : "s"} cast
                          </span>
                        </div>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] text-primary hover:bg-primary/10 gap-1 rounded-md"
                            onClick={() => {
                              setVotersPollId(p.id);
                              setVotersOpen(true);
                            }}
                          >
                            <Users className="size-3" />
                            <span>Voters</span>
                          </Button>
                        )}
                      </div>

                      {p.user_vote && (
                        <span className="text-[10px] font-sans font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> Voted
                        </span>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPollPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-6 border-t border-border/50">
              <button
                onClick={() => setPollPage((p) => Math.max(1, p - 1))}
                disabled={pollPage === 1}
                className="rounded-lg border border-border/70 px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
              >
                ← Prev
              </button>
              {getPageNums(pollPage, totalPollPages).map((pg, i) =>
                pg === "…" ? (
                  <span key={`e${i}`} className="px-1.5 text-xs text-muted-foreground select-none">
                    …
                  </span>
                ) : (
                  <button
                    key={pg}
                    onClick={() => setPollPage(pg as number)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                      pollPage === pg
                        ? "border-primary bg-primary text-primary-foreground font-bold shadow-xs"
                        : "border-border/70 hover:bg-muted"
                    )}
                  >
                    {pg}
                  </button>
                )
              )}
              <button
                onClick={() => setPollPage((p) => Math.min(totalPollPages, p + 1))}
                disabled={pollPage === totalPollPages}
                className="rounded-lg border border-border/70 px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Poll Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Vote className="size-5" />
              </div>
              <div>
                <DialogTitle className="font-serif text-lg font-bold">Create Community Poll</DialogTitle>
                <DialogDescription className="text-xs">
                  Initiate a new community decision, preference poll, or AGM resolution vote.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Quick Poll Templates */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
              <Sparkles className="size-3 text-amber-500" />
              <span>Quick Poll Starters:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pb-1">
              {POLL_TEMPLATES.map((tpl) => (
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
              <label className="text-xs font-medium">Poll Question / Resolution Title *</label>
              <Input
                required
                placeholder="e.g. Should we install solar street lights on Boulevard?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="h-9 text-xs"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Poll Type</label>
                <Select value={pollType} onValueChange={(v) => setPollType(v as any)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single" className="text-xs">🗳️ Single Choice</SelectItem>
                    <SelectItem value="multi" className="text-xs">☑️ Multiple Choice</SelectItem>
                    <SelectItem value="agm" className="text-xs">📜 AGM Proposal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Closes At *</label>
                <Input
                  required
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Voting Options (Comma-Separated) *</label>
              <Input
                required
                placeholder="e.g. Yes, No, Needs Discussion"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                className="h-9 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">Separate each selectable option with a comma.</span>
            </div>

            <div className="flex items-center justify-between border-t border-border/60 pt-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={isAnonymous}
                  onCheckedChange={setIsAnonymous}
                  id="poll-anon"
                />
                <label htmlFor="poll-anon" className="text-xs font-medium cursor-pointer">
                  🔒 Anonymous Voting (Hide Voter Identities)
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
                {createMutation.isPending ? "Creating…" : "Publish Poll"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Voters Breakdown Dialog */}
      <Dialog open={votersOpen} onOpenChange={setVotersOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-serif">Voter Audit Details</DialogTitle>
            <DialogDescription className="text-xs">
              List of residents who participated in this poll.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
            {isLoadingVoters ? (
              <div className="flex justify-center py-10">
                <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : voters.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-10 border border-dashed rounded-xl">
                No votes have been recorded yet.
              </p>
            ) : (
              <div className="divide-y divide-border/60 border border-border/70 rounded-xl overflow-hidden bg-card">
                {voters.map((v: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-3 text-xs">
                    <div className="space-y-0.5 min-w-0 flex-1 pr-2">
                      <p className="font-semibold text-foreground truncate">
                        {v.voter_name || "Resident"}
                      </p>
                      {v.voter_email && (
                        <p className="text-[10px] text-muted-foreground truncate font-mono">
                          {v.voter_email}
                        </p>
                      )}
                    </div>
                    <div className="text-right space-y-0.5 shrink-0">
                      <Badge variant="outline" className="font-bold text-[10px] bg-primary/10 text-primary border-primary/25">
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
          <DialogFooter className="border-t border-border/60 pt-3">
            <Button size="sm" type="button" onClick={() => setVotersOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
