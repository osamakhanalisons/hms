import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { getNoticesFn, createNoticeFn, markNoticeReadFn } from "@/lib/api/notices";
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
import {
  Megaphone,
  Pin,
  Plus,
  AlertOctagon,
  CheckCircle2,
  Eye,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/notices")({
  head: () => ({
    meta: [
      { title: "Notice Board — HousingOS" },
      {
        name: "description",
        content:
          "Broadcast society announcements, pinned notices and target specific resident groups.",
      },
    ],
  }),
  component: NoticesRoute,
});

function NoticesRoute() {
  return (
    <ModuleGate moduleKey="notice_board">
      <NoticesPage />
    </ModuleGate>
  );
}

function NoticesPage() {
  const { primaryRole } = useAuth();
  const queryClient = useQueryClient();
  const [composeOpen, setComposeOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"board" | "compose">("board");

  const isAdmin = primaryRole === "super_admin" || primaryRole === "society_admin";

  // Form states
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [priority, setPriority] = useState<"info" | "warning" | "urgent">("info");
  const [targetScope, setTargetScope] = useState<"all" | "block" | "building">("all");
  const [targetId, setTargetId] = useState("");

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ["notices"],
    queryFn: async () => getNoticesFn(),
  });

  const composeNotice = useMutation({
    mutationFn: createNoticeFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notices"] });
      toast.success("Notice broadcasted successfully!");
      setComposeOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to publish notice"),
  });

  const markRead = useMutation({
    mutationFn: markNoticeReadFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notices"] });
    },
  });

  const resetForm = () => {
    setTitle("");
    setBody("");
    setIsPinned(false);
    setIsEmergency(false);
    setPriority("info");
    setTargetScope("all");
    setTargetId("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    composeNotice.mutate({
      data: {
        title,
        body,
        isPinned,
        isEmergency,
        targetScope,
        targetId: targetScope !== "all" ? targetId : undefined,
      },
    });
  };

  const priorityBadge = (pri: string) => {
    const tones: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      urgent: "destructive",
      warning: "default",
      info: "secondary",
    };
    return (
      <Badge variant={tones[pri] ?? "secondary"} className="text-[10px] uppercase font-bold">
        {pri}
      </Badge>
    );
  };

  return (
    <AppShell
      title="Notice Board"
      subtitle="Broadcast announcements and targeting updates to society residents"
      actions={
        isAdmin && (
          <Button onClick={() => setComposeOpen(true)} size="sm" className="gap-1.5">
            <Plus className="size-4" /> Broadcast Notice
          </Button>
        )
      }
    >
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-10 space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4">
            {notices.map((n: any) => (
              <Card
                key={n.id}
                className={`border-border/70 shadow-soft transition-all ${
                  n.is_emergency ? "border-l-4 border-l-destructive bg-destructive/5" : ""
                } ${n.is_pinned ? "border-l-4 border-l-primary" : ""}`}
              >
                <CardContent className="p-5 space-y-4">
                  <header className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {n.is_pinned && (
                          <Pin className="size-3.5 text-primary rotate-45 shrink-0" />
                        )}
                        {n.is_emergency && (
                          <AlertOctagon className="size-3.5 text-destructive shrink-0" />
                        )}
                        <h3 className="font-serif text-base font-bold leading-tight">{n.title}</h3>
                        {priorityBadge(n.priority ?? "info")}
                        {n.target_scope !== "all" && (
                          <Badge variant="outline" className="text-[9px] capitalize">
                            Target: {n.target_scope} {n.target_id}
                          </Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        Posted by {n.author_name || "Admin"} ·{" "}
                        {formatDistanceToNow(new Date(n.created_at))} ago
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                          <Eye className="size-3.5" /> {n.read_count ?? 0} read
                        </div>
                      )}
                      {!n.is_read && (
                        <Button
                          onClick={() => markRead.mutate({ data: { noticeId: n.id } })}
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-primary gap-1 px-2 hover:bg-primary-soft"
                        >
                          <CheckCircle2 className="size-3.5" /> Mark Read
                        </Button>
                      )}
                    </div>
                  </header>

                  <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                    {n.body}
                  </p>
                </CardContent>
              </Card>
            ))}

            {notices.length === 0 && (
              <div className="py-20 text-center text-muted-foreground text-sm border rounded-lg border-dashed border-border/70">
                No active announcements on the notice board.
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Compose Announcement</DialogTitle>
            <DialogDescription>
              Broadcast a targeted notice or emergency alert to society residents
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Notice Title *</label>
              <Input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Scheduled Water Outage"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Notice Body *</label>
              <Textarea
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Write details here..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Audience Scope
                </label>
                <Select value={targetScope} onValueChange={(v) => setTargetScope(v as any)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">📢 All Residents</SelectItem>
                    <SelectItem value="block">🏢 Specific Block</SelectItem>
                    <SelectItem value="building">🏡 Specific Unit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {targetScope !== "all" && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Target Selector (Name/ID) *
                  </label>
                  <Input
                    required
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    placeholder="e.g. Block A, or Unit-102"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-2">
                <Switch checked={isPinned} onCheckedChange={setIsPinned} id="pin-announce" />
                <label htmlFor="pin-announce" className="text-xs font-medium cursor-pointer">
                  Pin to top
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={isEmergency}
                  onCheckedChange={setIsEmergency}
                  id="emerge-announce"
                />
                <label
                  htmlFor="emerge-announce"
                  className="text-xs font-medium text-destructive cursor-pointer"
                >
                  Emergency Warning
                </label>
              </div>
            </div>

            <DialogFooter className="border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setComposeOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={composeNotice.isPending}>
                {composeNotice.isPending ? "Broadcasting…" : "Broadcast Notice"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
