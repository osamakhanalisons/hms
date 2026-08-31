import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { PermissionGate } from "@/components/permission-gate";
import { getThreadsFn, createThreadFn, getRepliesFn, addReplyFn } from "@/lib/api/community";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { MessageSquare, Plus, User, Send, Filter } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

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

function ForumPage() {
  const queryClient = useQueryClient();
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [selectedThread, setSelectedThread] = useState<any | null>(null);
  const [repliesOpen, setRepliesOpen] = useState(false);

  // Filter category
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Form thread states
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [allowComments, setAllowComments] = useState(true);

  // Reply state
  const [replyBody, setReplyBody] = useState("");

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["forum-threads"],
    queryFn: () => getThreadsFn(),
  });

  const { data: replies = [], isLoading: isLoadingReplies } = useQuery({
    queryKey: ["forum-replies", selectedThread?.id],
    queryFn: () => getRepliesFn({ data: { threadId: selectedThread!.id } }),
    enabled: !!selectedThread,
  });

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
    if (!replyBody.trim()) return;
    addReplyMutation.mutate({
      data: {
        threadId: selectedThread.id,
        body: replyBody,
      },
    });
  };

  const filteredThreads =
    categoryFilter === "all" ? threads : threads.filter((t: any) => t.category === categoryFilter);

  // Pagination — reset to page 1 when category changes
  const THREADS_PER_PAGE = 10;
  const [threadPage, setThreadPage] = useState(1);
  const totalThreadPages = Math.max(1, Math.ceil(filteredThreads.length / THREADS_PER_PAGE));
  const paginatedThreads = filteredThreads.slice(
    (threadPage - 1) * THREADS_PER_PAGE,
    threadPage * THREADS_PER_PAGE,
  );

  function getPageNums(cur: number, tot: number): (number | "…")[] {
    if (tot <= 7) return Array.from({ length: tot }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1];
    if (cur > 3) pages.push("…");
    const s = Math.max(2, cur - 1), e = Math.min(tot - 1, cur + 1);
    for (let i = s; i <= e; i++) pages.push(i);
    if (cur < tot - 2) pages.push("…");
    pages.push(tot);
    return pages;
  }

  const categories = [
    { key: "all", label: "All Topics" },
    { key: "general", label: "General" },
    { key: "announcements", label: "Announcements" },
    { key: "buy-sell", label: "Buy & Sell" },
    { key: "help", label: "Help & Services" },
  ];

  return (
    <AppShell
      title="Community Forum"
      subtitle="Engage in community discussions, share notices, and connect with neighbors"
      actions={
        <PermissionGate moduleKey="community_forum" action="create" fallback={null}>
          <Button onClick={() => setNewThreadOpen(true)} size="sm" className="gap-1.5">
            <Plus className="size-4" /> Start Discussion
          </Button>
        </PermissionGate>
      }
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-10 space-y-6">
        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 border-b pb-4">
          {categories.map((c) => (
            <Button
              key={c.key}
              variant={categoryFilter === c.key ? "default" : "outline"}
              size="sm"
              onClick={() => { setCategoryFilter(c.key); setThreadPage(1); }}
              className="text-xs"
            >
              {c.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-4">
            {paginatedThreads.map((t: any) => (
              <Card
                key={t.id}
                className="border-border/70 shadow-soft cursor-pointer hover:border-primary/40 hover:bg-primary-soft/10 transition-all"
                onClick={() => {
                  setSelectedThread(t);
                  setRepliesOpen(true);
                }}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase font-bold tracking-wider"
                    >
                      {t.category}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {formatDistanceToNow(new Date(t.created_at))} ago
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-serif text-lg font-bold leading-snug">{t.title}</h3>
                    <p className="text-sm text-foreground/80 line-clamp-2 leading-relaxed">
                      {t.body}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <User className="size-3.5" />
                      <span>{t.author_name || "Resident"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="size-3.5" />
                      <span>View comments & replies</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {paginatedThreads.length === 0 && (
              <div className="py-20 text-center text-muted-foreground text-sm border rounded-lg border-dashed border-border/70">
                No discussion threads found in this category.
              </div>
            )}

            {/* Pagination */}
            {totalThreadPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 pt-2">
                <button
                  onClick={() => setThreadPage((p) => Math.max(1, p - 1))}
                  disabled={threadPage === 1}
                  className="rounded-md border border-border/70 px-3 py-1.5 text-[11px] font-medium hover:bg-muted disabled:pointer-events-none disabled:opacity-40 transition-colors"
                >
                  ← Prev
                </button>
                {getPageNums(threadPage, totalThreadPages).map((pg, i) =>
                  pg === "…" ? (
                    <span key={`e${i}`} className="px-1.5 text-[11px] text-muted-foreground select-none">…</span>
                  ) : (
                    <button
                      key={pg}
                      onClick={() => setThreadPage(pg as number)}
                      className={`rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                        threadPage === pg
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/70 hover:bg-muted"
                      }`}
                    >
                      {pg}
                    </button>
                  )
                )}
                <button
                  onClick={() => setThreadPage((p) => Math.min(totalThreadPages, p + 1))}
                  disabled={threadPage === totalThreadPages}
                  className="rounded-md border border-border/70 px-3 py-1.5 text-[11px] font-medium hover:bg-muted disabled:pointer-events-none disabled:opacity-40 transition-colors"
                >
                  Next →
                </button>
              </div>
            )}

            <div className="text-center text-[11px] text-muted-foreground">
              {filteredThreads.length} threads &mdash; page {threadPage} of {totalThreadPages}
            </div>
          </div>
        )}
      </div>

      {/* Start Thread Dialog */}
      <Dialog open={newThreadOpen} onOpenChange={setNewThreadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Start a Discussion</DialogTitle>
            <DialogDescription>
              Create a new topic thread for neighbors to view and comment on
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateThread} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Topic Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">💬 General</SelectItem>
                  <SelectItem value="announcements">📢 Announcements</SelectItem>
                  <SelectItem value="buy-sell">🏷️ Buy & Sell</SelectItem>
                  <SelectItem value="help">🤝 Help & Services</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Title *</label>
              <Input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Recommendations for car cleaner?"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Body/Message *</label>
              <Textarea
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Describe the topic in detail..."
              />
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={allowComments}
                  onCheckedChange={setAllowComments}
                  id="allow-replies"
                />
                <label htmlFor="allow-replies" className="text-xs font-medium cursor-pointer">
                  Allow replies & comments
                </label>
              </div>
            </div>

            <DialogFooter className="border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setNewThreadOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createThreadMutation.isPending}>
                {createThreadMutation.isPending ? "Posting…" : "Post Thread"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Discussion & Replies Slide-Over / Dialog */}
      <Dialog open={repliesOpen} onOpenChange={setRepliesOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-serif leading-snug">{selectedThread?.title}</DialogTitle>
            <DialogDescription className="text-xs font-mono">
              Posted by {selectedThread?.author_name || "Resident"} ·{" "}
              {selectedThread?.created_at &&
                formatDistanceToNow(new Date(selectedThread.created_at))}{" "}
              ago
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 my-4 space-y-6">
            <div className="bg-surface rounded-lg p-4 text-sm text-foreground/90 border leading-relaxed whitespace-pre-line">
              {selectedThread?.body}
            </div>

            <div className="space-y-4">
              <h4 className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-2">
                <MessageSquare className="size-4" /> Comments ({replies.length})
              </h4>

              {isLoadingReplies ? (
                <div className="flex justify-center py-6">
                  <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : (
                <div className="space-y-3">
                  {replies.map((reply: any) => (
                    <div key={reply.id} className="border rounded-lg p-3 space-y-1.5 bg-background">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {reply.author_name || "Resident"}
                        </span>
                        <span className="font-mono">
                          {formatDistanceToNow(new Date(reply.created_at))} ago
                        </span>
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-line">
                        {reply.body}
                      </p>
                    </div>
                  ))}

                  {replies.length === 0 && (
                    <div className="py-6 text-center text-xs text-muted-foreground border rounded-lg border-dashed">
                      No comments yet. Start the conversation!
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {selectedThread?.allow_comments ? (
            <form onSubmit={handlePostReply} className="flex gap-2 border-t pt-4">
              <Input
                required
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Write a reply..."
                className="text-xs"
              />
              <Button type="submit" size="sm" disabled={addReplyMutation.isPending}>
                <Send className="size-4" />
              </Button>
            </form>
          ) : (
            <div className="text-center text-xs text-muted-foreground border-t pt-4 py-2">
              Replies are disabled for this thread.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
