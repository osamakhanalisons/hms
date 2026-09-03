import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { PermissionGate } from "@/components/permission-gate";
import { getThreadsFn, createThreadFn, getRepliesFn, addReplyFn, ForumThread } from "@/lib/api/community";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  MessageSquare,
  Plus,
  Send,
  Filter,
  RefreshCw,
  Search,
  Sparkles,
  ShoppingBag,
  HelpCircle,
  Megaphone,
  MessagesSquare,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/forum")({
  head: () => ({
    meta: [
      { title: "Community Forum — HousingOS" },
      {
        name: "description",
        content: "Discuss, share updates, and communicate with other residents.",
      },
    ],
  }),
  component: ForumRoute,
});

function ForumRoute() {
  return (
    <ModuleGate moduleKey="community_forum">
      <ForumPage />
    </ModuleGate>
  );
}

const FORUM_TEMPLATES = [
  { label: "Local Recommendation", category: "help", title: "Recommendation for reliable home AC technician?", body: "Looking for trusted technician recommendations who can visit Block C for regular AC cleaning and gas refill." },
  { label: "Buy & Sell Item", category: "buy-sell", title: "Baby Stroller & Car Seat for sale (Barely Used)", body: "Selling Graco baby stroller and car seat in excellent condition. Available for immediate pickup in Block B." },
  { label: "Lost & Found", category: "general", title: "Found Honda car key near Central Park play area", body: "Found a Honda smart key with a red lanyard near the jogging track. Please message me to claim." },
  { label: "Sports / Activity", category: "general", title: "Weekend Badminton / Table Tennis group", body: "Looking to connect with fellow residents for casual weekend badminton matches at the community sports complex." },
  { label: "Internet & ISP Query", category: "help", title: "High Speed Fiber Optic Provider in Askari", body: "Which fiber optic ISP offers the most stable ping and bandwidth for remote work in our block?" },
];

const CATEGORY_META: Record<string, { label: string; icon: string; bg: string; text: string; border: string }> = {
  general: { label: "General", icon: "💬", bg: "bg-blue-500/10", text: "text-blue-700 dark:text-blue-400", border: "border-blue-500/20" },
  announcements: { label: "Announcements", icon: "📢", bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", border: "border-amber-500/20" },
  "buy-sell": { label: "Buy & Sell", icon: "🏷️", bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-500/20" },
  help: { label: "Help & Services", icon: "🤝", bg: "bg-purple-500/10", text: "text-purple-700 dark:text-purple-400", border: "border-purple-500/20" },
  security: { label: "Security", icon: "🛡️", bg: "bg-rose-500/10", text: "text-rose-700 dark:text-rose-400", border: "border-rose-500/20" },
};

function ForumPage() {
  const queryClient = useQueryClient();
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [selectedThread, setSelectedThread] = useState<ForumThread | null>(null);
  const [repliesOpen, setRepliesOpen] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "most_replies">("newest");

  // Form thread states
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [allowComments, setAllowComments] = useState(true);

  // Reply state
  const [replyBody, setReplyBody] = useState("");

  const { data: rawThreads = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["forum-threads"],
    queryFn: () => getThreadsFn(),
  });

  const { data: replies = [], isLoading: isLoadingReplies } = useQuery({
    queryKey: ["forum-replies", selectedThread?.id],
    queryFn: () => getRepliesFn({ data: { threadId: selectedThread!.id } }),
    enabled: !!selectedThread,
  });

  // KPI calculations
  const totalThreads = rawThreads.length;
  const generalCount = useMemo(() => rawThreads.filter((t: any) => t.category === "general").length, [rawThreads]);
  const buySellCount = useMemo(() => rawThreads.filter((t: any) => t.category === "buy-sell").length, [rawThreads]);
  const helpCount = useMemo(() => rawThreads.filter((t: any) => t.category === "help" || t.category === "announcements").length, [rawThreads]);

  // Filtered & Sorted Threads
  const filteredThreads = useMemo(() => {
    let list = rawThreads.filter((t: any) => {
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = t.title?.toLowerCase().includes(q);
        const matchesBody = t.body?.toLowerCase().includes(q);
        const matchesAuthor = t.author_name?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesBody && !matchesAuthor) return false;
      }
      return true;
    });

    if (sortBy === "most_replies") {
      list = [...list].sort((a: any, b: any) => Number(b.reply_count ?? 0) - Number(a.reply_count ?? 0));
    }
    return list;
  }, [rawThreads, categoryFilter, search, sortBy]);

  // Pagination
  const THREADS_PER_PAGE = 8;
  const [threadPage, setThreadPage] = useState(1);
  const totalThreadPages = Math.max(1, Math.ceil(filteredThreads.length / THREADS_PER_PAGE));
  const paginatedThreads = filteredThreads.slice(
    (threadPage - 1) * THREADS_PER_PAGE,
    threadPage * THREADS_PER_PAGE
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

  const createThreadMutation = useMutation({
    mutationFn: createThreadFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-threads"] });
      toast.success("Discussion thread started!");
      setNewThreadOpen(false);
      resetThreadForm();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to start thread"),
  });

  const addReplyMutation = useMutation({
    mutationFn: addReplyFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-replies", selectedThread?.id] });
      queryClient.invalidateQueries({ queryKey: ["forum-threads"] });
      toast.success("Reply posted!");
      setReplyBody("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to post reply"),
  });

  const resetThreadForm = () => {
    setTitle("");
    setBody("");
    setCategory("general");
    setAllowComments(true);
  };

  const applyTemplate = (tpl: (typeof FORUM_TEMPLATES)[0]) => {
    setTitle(tpl.title);
    setBody(tpl.body);
    setCategory(tpl.category);
  };

  const handleCreateThread = (e: React.FormEvent) => {
    e.preventDefault();
    createThreadMutation.mutate({
      data: {
        title,
        body,
        category,
        allow_comments: allowComments,
      },
    });
  };

  const handlePostReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim() || !selectedThread) return;
    addReplyMutation.mutate({
      data: {
        threadId: selectedThread.id,
        body: replyBody,
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
              <MessagesSquare className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Community Forum
                </h1>
                <Badge variant="secondary" className="font-mono text-xs px-2.5 py-0.5 font-medium">
                  {totalThreads} Discussions
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Engage in community discussions, share local updates, recommendations, and connect with neighbors.
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
            <PermissionGate moduleKey="community_forum" action="create" fallback={null}>
              <Button
                onClick={() => {
                  resetThreadForm();
                  setNewThreadOpen(true);
                }}
                size="sm"
                className="h-9 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer px-4"
              >
                <Plus className="size-4" /> Start Discussion
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
                  Total Discussions
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-foreground mt-2 truncate">
                  {totalThreads}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 shrink-0">
                <MessageSquare className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  General Topics
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-primary mt-2 truncate">
                  {generalCount}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <MessagesSquare className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Buy & Sell Market
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-emerald-600 mt-2 truncate">
                  {buySellCount}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                <ShoppingBag className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Help & Services
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-purple-600 mt-2 truncate">
                  {helpCount}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-purple-500/10 text-purple-600 border border-purple-500/20 shrink-0">
                <HelpCircle className="size-5.5" />
              </div>
            </div>
          </Card>
        </div>

        {/* Filter Toolbar */}
        <Card className="border-border/70 shadow-soft p-5 rounded-2xl space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search discussion topics, description, or author..."
                className="h-10 pl-9 text-xs"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setThreadPage(1);
                }}
              />
            </div>

            <Select
              value={categoryFilter}
              onValueChange={(v) => {
                setCategoryFilter(v);
                setThreadPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-44 text-xs">
                <Filter className="mr-1.5 size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Categories</SelectItem>
                <SelectItem value="general" className="text-xs">💬 General</SelectItem>
                <SelectItem value="announcements" className="text-xs">📢 Announcements</SelectItem>
                <SelectItem value="buy-sell" className="text-xs">🏷️ Buy & Sell</SelectItem>
                <SelectItem value="help" className="text-xs">🤝 Help & Services</SelectItem>
                <SelectItem value="security" className="text-xs">🛡️ Security</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={(v) => {
                setSortBy(v as any);
                setThreadPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-40 text-xs">
                <TrendingUp className="mr-1.5 size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest" className="text-xs">🕒 Most Recent</SelectItem>
                <SelectItem value="most_replies" className="text-xs">🔥 Most Active (Replies)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quick Category Pills */}
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/50">
            {[
              { key: "all", label: "All Topics" },
              { key: "general", label: "💬 General" },
              { key: "announcements", label: "📢 Announcements" },
              { key: "buy-sell", label: "🏷️ Buy & Sell" },
              { key: "help", label: "🤝 Help & Services" },
            ].map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  setCategoryFilter(c.key);
                  setThreadPage(1);
                }}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer",
                  categoryFilter === c.key
                    ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                    : "border-border/80 bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </Card>

        {/* Discussion Feed Grid */}
        <div className="space-y-5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-muted-foreground">
              {filteredThreads.length} topics found
            </span>
            <span className="text-xs text-muted-foreground">
              page {threadPage} of {totalThreadPages}
            </span>
          </div>

          {isLoading ? (
            <div className="grid gap-5 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : paginatedThreads.length === 0 ? (
            <Card className="border-border/70 border-dashed p-14 text-center text-muted-foreground rounded-2xl">
              <MessagesSquare className="size-12 mx-auto opacity-30 mb-3" />
              <p className="text-base font-medium">No discussions found</p>
              <p className="text-xs opacity-60 mt-1.5">
                {search || categoryFilter !== "all"
                  ? "Try adjusting active search filters."
                  : 'Click "Start Discussion" to initiate a new community conversation.'}
              </p>
            </Card>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {paginatedThreads.map((t: any) => {
                const meta = CATEGORY_META[t.category] || CATEGORY_META.general;
                const replyCount = Number(t.reply_count ?? 0);
                return (
                  <Card
                    key={t.id}
                    onClick={() => {
                      setSelectedThread(t);
                      setRepliesOpen(true);
                    }}
                    className="group flex flex-col justify-between border-border/70 shadow-soft hover:shadow-md hover:border-primary/40 transition-all cursor-pointer rounded-2xl bg-card overflow-hidden"
                  >
                    <CardContent className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-3">
                        {/* Category & Time */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider", meta.bg, meta.text, meta.border)}
                          >
                            {meta.icon} {meta.label}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {t.created_at ? formatDistanceToNow(new Date(t.created_at)) + " ago" : "Recently"}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="font-serif text-base font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                          {t.title}
                        </h3>

                        {/* Body */}
                        <p className="text-xs text-muted-foreground/90 whitespace-pre-line leading-relaxed line-clamp-3">
                          {t.body}
                        </p>
                      </div>

                      {/* Footer Info */}
                      <div className="flex items-center justify-between gap-2 pt-3.5 border-t border-border/50 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground text-[11px] min-w-0">
                          <div className="size-6 rounded-full bg-primary/10 grid place-items-center text-primary font-bold text-[10px] shrink-0">
                            {(t.author_name || "R")[0].toUpperCase()}
                          </div>
                          <span className="font-medium text-foreground truncate">{t.author_name || "Neighbor / Resident"}</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-primary font-medium bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 shrink-0">
                          <MessageSquare className="size-3" />
                          <span>{replyCount} {replyCount === 1 ? "reply" : "replies"}</span>
                          <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalThreadPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-6 border-t border-border/50">
              <button
                onClick={() => setThreadPage((p) => Math.max(1, p - 1))}
                disabled={threadPage === 1}
                className="rounded-lg border border-border/70 px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
              >
                ← Prev
              </button>
              {getPageNums(threadPage, totalThreadPages).map((pg, i) =>
                pg === "…" ? (
                  <span key={`e${i}`} className="px-1.5 text-xs text-muted-foreground select-none">
                    …
                  </span>
                ) : (
                  <button
                    key={pg}
                    onClick={() => setThreadPage(pg as number)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                      threadPage === pg
                        ? "border-primary bg-primary text-primary-foreground font-bold shadow-xs"
                        : "border-border/70 hover:bg-muted"
                    )}
                  >
                    {pg}
                  </button>
                )
              )}
              <button
                onClick={() => setNoticePage((p) => Math.min(totalThreadPages, p + 1))}
                disabled={threadPage === totalThreadPages}
                className="rounded-lg border border-border/70 px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Start Thread Dialog */}
      <Dialog open={newThreadOpen} onOpenChange={setNewThreadOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <MessagesSquare className="size-5" />
              </div>
              <div>
                <DialogTitle className="font-serif text-lg font-bold">Start a Community Discussion</DialogTitle>
                <DialogDescription className="text-xs">
                  Create a new topic thread for neighbors to view, discuss, and reply.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Quick Discussion Templates */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
              <Sparkles className="size-3 text-amber-500" />
              <span>Quick Topic Starters:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pb-1">
              {FORUM_TEMPLATES.map((tpl) => (
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

          <form onSubmit={handleCreateThread} className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general" className="text-xs">💬 General</SelectItem>
                    <SelectItem value="announcements" className="text-xs">📢 Announcements</SelectItem>
                    <SelectItem value="buy-sell" className="text-xs">🏷️ Buy & Sell</SelectItem>
                    <SelectItem value="help" className="text-xs">🤝 Help & Services</SelectItem>
                    <SelectItem value="security" className="text-xs">🛡️ Security</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Topic Title *</label>
                <Input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Recommendations for car cleaner?"
                  className="h-9 text-xs"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Discussion Message / Details *</label>
              <Textarea
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Describe the topic in detail, questions, contact info or instructions..."
                className="text-xs leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-between border-t border-border/60 pt-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={allowComments}
                  onCheckedChange={setAllowComments}
                  id="allow-replies"
                />
                <label htmlFor="allow-replies" className="text-xs font-medium cursor-pointer">
                  💬 Allow Comments & Resident Replies
                </label>
              </div>
            </div>

            <DialogFooter className="border-t border-border/60 pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setNewThreadOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createThreadMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {createThreadMutation.isPending ? "Posting…" : "Post Thread"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Discussion & Replies Modal */}
      <Dialog open={repliesOpen} onOpenChange={setRepliesOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                {selectedThread?.category && (
                  <Badge variant="outline" className="text-[10px] uppercase font-bold px-2 py-0.5">
                    {selectedThread.category}
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground font-mono">
                  {selectedThread?.created_at && formatDistanceToNow(new Date(selectedThread.created_at)) + " ago"}
                </span>
              </div>
              <DialogTitle className="font-serif text-lg leading-snug">
                {selectedThread?.title}
              </DialogTitle>
              <DialogDescription className="text-xs font-mono">
                Started by <strong className="text-foreground">{selectedThread?.author_name || "Resident"}</strong>
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 my-3 space-y-5">
            {/* Original Post Box */}
            <div className="bg-muted/40 rounded-xl p-4 text-xs text-foreground/90 border border-border/70 leading-relaxed whitespace-pre-line">
              {selectedThread?.body}
            </div>

            {/* Replies List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="size-3.5" /> Comments ({replies.length})
                </h4>
              </div>

              {isLoadingReplies ? (
                <div className="flex justify-center py-6">
                  <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : (
                <div className="space-y-2.5">
                  {replies.map((reply: any) => (
                    <div key={reply.id} className="border border-border/70 rounded-xl p-3.5 space-y-1.5 bg-background shadow-xs">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <div className="size-5 rounded-full bg-primary/10 grid place-items-center text-primary font-bold text-[9px]">
                            {(reply.author_name || "R")[0].toUpperCase()}
                          </div>
                          <span className="font-semibold text-foreground">
                            {reply.author_name || "Resident"}
                          </span>
                        </div>
                        <span className="font-mono text-[10px]">
                          {formatDistanceToNow(new Date(reply.created_at))} ago
                        </span>
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-line pl-6">
                        {reply.body}
                      </p>
                    </div>
                  ))}

                  {replies.length === 0 && (
                    <div className="py-8 text-center text-xs text-muted-foreground border rounded-xl border-dashed">
                      No comments yet. Be the first to share your thoughts!
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {selectedThread?.allow_comments ? (
            <form onSubmit={handlePostReply} className="flex gap-2 border-t border-border/70 pt-3">
              <Input
                required
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Write a community comment or reply..."
                className="text-xs h-9"
              />
              <Button type="submit" size="sm" disabled={addReplyMutation.isPending} className="h-9 gap-1 text-xs px-3">
                <Send className="size-3.5" />
                <span>Reply</span>
              </Button>
            </form>
          ) : (
            <div className="text-center text-xs text-muted-foreground border-t border-border/70 pt-3 py-1">
              Comments and replies are disabled for this topic.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
