import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { PermissionGate } from "@/components/permission-gate";
import { getNoticesFn, createNoticeFn, markNoticeReadFn } from "@/lib/api/notices";
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
  Megaphone,
  Pin,
  Plus,
  AlertOctagon,
  CheckCircle2,
  Eye,
  Search,
  Filter,
  RefreshCw,
  Bell,
  Users,
  Radio,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

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

const NOTICE_TEMPLATES = [
  { label: "Water Maintenance", title: "Scheduled Water Tank Maintenance & Outage", body: "Please be informed that routine water overhead reservoir desilting is scheduled. Water supply will remain paused during work hours.", emergency: false, pinned: true },
  { label: "Emergency Notice", title: "URGENT: Standby Generator Power Line Repair", body: "Main society standby power generator is undergoing critical electrical overhaul. Please minimize heavy power usage.", emergency: true, pinned: true },
  { label: "AGM Meeting", title: "Annual General Body Meeting (AGM) Notice", body: "All property owners and registered occupants are cordially invited to participate in the Annual General Meeting at the Community Hall.", emergency: false, pinned: false },
  { label: "Security & RFID", title: "Mandatory Vehicle RFID Sticker Verification", body: "Residents are kindly requested to visit the security gate office to renew vehicle windshield barcode stickers.", emergency: false, pinned: false },
  { label: "Monthly Maintenance", title: "Monthly Society Dues & Service Charges Update", body: "Maintenance billing invoices for the current billing cycle have been generated. Kindly clear dues before the grace due date.", emergency: false, pinned: false },
];

function NoticesPage() {
  const { primaryRole } = useAuth();
  const queryClient = useQueryClient();
  const [composeOpen, setComposeOpen] = useState(false);

  const isAdmin = primaryRole === "super_admin" || primaryRole === "society_admin";

  // Filter states
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Form states
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [targetScope, setTargetScope] = useState<"all" | "block" | "building">("all");
  const [targetId, setTargetId] = useState("");

  const { data: notices = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["notices"],
    queryFn: async () => getNoticesFn(),
  });

  // KPI Calculations
  const totalNotices = notices.length;
  const pinnedCount = useMemo(() => notices.filter((n: any) => n.is_pinned).length, [notices]);
  const emergencyCount = useMemo(
    () => notices.filter((n: any) => n.is_emergency || n.priority === "urgent").length,
    [notices]
  );
  const broadcastCount = useMemo(
    () => notices.filter((n: any) => n.target_scope === "all" || !n.target_scope).length,
    [notices]
  );

  // Filtered notices
  const filteredNotices = useMemo(() => {
    return notices.filter((n: any) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = n.title?.toLowerCase().includes(q);
        const matchesBody = n.body?.toLowerCase().includes(q);
        const matchesAuthor = n.author_name?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesBody && !matchesAuthor) return false;
      }
      if (scopeFilter !== "all") {
        if (scopeFilter === "all_residents" && n.target_scope !== "all" && n.target_scope) return false;
        if (scopeFilter === "block" && n.target_scope !== "block") return false;
        if (scopeFilter === "building" && n.target_scope !== "building") return false;
      }
      if (typeFilter !== "all") {
        if (typeFilter === "pinned" && !n.is_pinned) return false;
        if (typeFilter === "emergency" && !n.is_emergency) return false;
        if (typeFilter === "unread" && n.is_read) return false;
      }
      return true;
    });
  }, [notices, search, scopeFilter, typeFilter]);

  // Pagination
  const NOTICES_PER_PAGE = 8;
  const [noticePage, setNoticePage] = useState(1);
  const totalNoticePages = Math.max(1, Math.ceil(filteredNotices.length / NOTICES_PER_PAGE));
  const paginatedNotices = filteredNotices.slice(
    (noticePage - 1) * NOTICES_PER_PAGE,
    noticePage * NOTICES_PER_PAGE
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
    setTargetScope("all");
    setTargetId("");
  };

  const applyTemplate = (tpl: (typeof NOTICE_TEMPLATES)[0]) => {
    setTitle(tpl.title);
    setBody(tpl.body);
    setIsPinned(tpl.pinned);
    setIsEmergency(tpl.emergency);
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

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8 pb-16 px-2 sm:px-4">
        {/* Page Header & Action Toolbar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-6 pt-2">
          <div className="flex items-center gap-3.5">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs shrink-0">
              <Megaphone className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Society Notice Board
                </h1>
                <Badge variant="secondary" className="font-mono text-xs px-2.5 py-0.5 font-medium">
                  {totalNotices} Total
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Broadcast public announcements, emergency alerts, and targeted updates to residents.
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
            <PermissionGate moduleKey="notice_board" action="create" fallback={null}>
              <Button
                onClick={() => {
                  resetForm();
                  setComposeOpen(true);
                }}
                size="sm"
                className="h-9 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer px-4"
              >
                <Plus className="size-4" /> Broadcast Notice
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
                  Total Notices
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-foreground mt-2 truncate">
                  {totalNotices}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 shrink-0">
                <Bell className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Pinned to Top
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-primary mt-2 truncate">
                  {pinnedCount}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Pin className="size-5.5 rotate-45" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Urgent / Alerts
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-rose-600 mt-2 truncate">
                  {emergencyCount}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-rose-500/10 text-rose-600 border border-rose-500/20 shrink-0">
                <AlertOctagon className="size-5.5" />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-soft p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  General Reach
                </p>
                <p className="font-serif text-3xl font-bold tracking-tight text-emerald-600 mt-2 truncate">
                  {broadcastCount}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                <Radio className="size-5.5" />
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
                placeholder="Search notice title, announcement body, or author..."
                className="h-10 pl-9 text-xs"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setNoticePage(1);
                }}
              />
            </div>

            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v);
                setNoticePage(1);
              }}
            >
              <SelectTrigger className="h-10 w-40 text-xs">
                <Filter className="mr-1.5 size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Notices</SelectItem>
                <SelectItem value="pinned" className="text-xs">📌 Pinned Only</SelectItem>
                <SelectItem value="emergency" className="text-xs">🚨 Emergency Alerts</SelectItem>
                <SelectItem value="unread" className="text-xs">🔔 Unread Only</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={scopeFilter}
              onValueChange={(v) => {
                setScopeFilter(v);
                setNoticePage(1);
              }}
            >
              <SelectTrigger className="h-10 w-44 text-xs">
                <Users className="mr-1.5 size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Audience" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Audiences</SelectItem>
                <SelectItem value="all_residents" className="text-xs">📢 All Residents</SelectItem>
                <SelectItem value="block" className="text-xs">🏢 Block Specific</SelectItem>
                <SelectItem value="building" className="text-xs">🏡 Unit Specific</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Notice Board Feed Grid */}
        <div className="space-y-5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-muted-foreground">
              {filteredNotices.length} notices found
            </span>
            <span className="text-xs text-muted-foreground">
              page {noticePage} of {totalNoticePages}
            </span>
          </div>

          {isLoading ? (
            <div className="grid gap-5 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-44 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : paginatedNotices.length === 0 ? (
            <Card className="border-border/70 border-dashed p-14 text-center text-muted-foreground rounded-2xl">
              <Megaphone className="size-12 mx-auto opacity-30 mb-3" />
              <p className="text-base font-medium">No announcements found</p>
              <p className="text-xs opacity-60 mt-1.5">
                {search || typeFilter !== "all" || scopeFilter !== "all"
                  ? "Try clearing active search filters."
                  : 'Click "Broadcast Notice" to post a new announcement.'}
              </p>
            </Card>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {paginatedNotices.map((n: any) => {
                const isEmergencyNotice = n.is_emergency || n.priority === "urgent";
                return (
                  <Card
                    key={n.id}
                    className={cn(
                      "group flex flex-col justify-between border-border/70 shadow-soft hover:shadow-md hover:border-border transition-all overflow-hidden rounded-2xl border-l-4",
                      isEmergencyNotice
                        ? "border-l-rose-500 bg-rose-50/20 dark:bg-rose-950/10"
                        : n.is_pinned
                        ? "border-l-primary bg-primary/[0.02]"
                        : "border-l-border/60 bg-card"
                    )}
                  >
                    <CardContent className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-3">
                        {/* Top badges & Time */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            {n.is_pinned && (
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/25 text-[10px] font-bold gap-1 px-2 py-0.5 rounded-md">
                                <Pin className="size-3 rotate-45 shrink-0" /> PINNED
                              </Badge>
                            )}
                            {isEmergencyNotice && (
                              <Badge variant="destructive" className="text-[10px] font-bold gap-1 px-2 py-0.5 uppercase shadow-xs rounded-md">
                                <AlertOctagon className="size-3 shrink-0" /> URGENT
                              </Badge>
                            )}
                            {n.target_scope && n.target_scope !== "all" ? (
                              <Badge variant="outline" className="text-[10px] capitalize bg-muted/70 text-muted-foreground border-border/80 rounded-md">
                                🎯 {n.target_scope} {n.target_id || ""}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-medium rounded-md">
                                📢 All Residents
                              </Badge>
                            )}
                          </div>

                          <div className="text-[11px] text-muted-foreground font-mono">
                            {n.created_at ? formatDistanceToNow(new Date(n.created_at)) + " ago" : "Recently"}
                          </div>
                        </div>

                        {/* Notice Title */}
                        <h3 className="font-serif text-base font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                          {n.title}
                        </h3>

                        {/* Notice Body */}
                        <p className="text-xs text-muted-foreground/90 whitespace-pre-line leading-relaxed line-clamp-4">
                          {n.body}
                        </p>
                      </div>

                      {/* Footer Meta & Actions */}
                      <div className="flex items-center justify-between gap-2 pt-3.5 border-t border-border/50 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground text-[11px] min-w-0">
                          <div className="size-6 rounded-full bg-primary/10 grid place-items-center text-primary font-bold text-[10px] shrink-0">
                            {(n.author_name || "A")[0].toUpperCase()}
                          </div>
                          <span className="font-medium text-foreground truncate">{n.author_name || "Society Admin"}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isAdmin && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono bg-muted/60 px-2 py-1 rounded-md border border-border/60">
                              <Eye className="size-3.5" /> {n.read_count ?? 0}
                            </div>
                          )}
                          {!n.is_read && (
                            <Button
                              onClick={() => markRead.mutate({ data: { noticeId: n.id } })}
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-primary gap-1 px-2 hover:bg-primary/10 cursor-pointer rounded-md font-medium"
                            >
                              <CheckCircle2 className="size-3.5" /> Mark Read
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalNoticePages > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-6 border-t border-border/50">
              <button
                onClick={() => setNoticePage((p) => Math.max(1, p - 1))}
                disabled={noticePage === 1}
                className="rounded-lg border border-border/70 px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
              >
                ← Prev
              </button>
              {getPageNums(noticePage, totalNoticePages).map((pg, i) =>
                pg === "…" ? (
                  <span key={`e${i}`} className="px-1.5 text-xs text-muted-foreground select-none">
                    …
                  </span>
                ) : (
                  <button
                    key={pg}
                    onClick={() => setNoticePage(pg as number)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                      noticePage === pg
                        ? "border-primary bg-primary text-primary-foreground font-bold shadow-xs"
                        : "border-border/70 hover:bg-muted"
                    )}
                  >
                    {pg}
                  </button>
                )
              )}
              <button
                onClick={() => setNoticePage((p) => Math.min(totalNoticePages, p + 1))}
                disabled={noticePage === totalNoticePages}
                className="rounded-lg border border-border/70 px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Compose Announcement Modal */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Megaphone className="size-5" />
              </div>
              <div>
                <DialogTitle className="font-serif text-lg font-bold">Broadcast Announcement</DialogTitle>
                <DialogDescription className="text-xs">
                  Publish a public notice or emergency alert to society residents.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Quick Notice Templates */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
              <Sparkles className="size-3 text-amber-500" />
              <span>Quick Announcement Templates:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pb-1">
              {NOTICE_TEMPLATES.map((tpl) => (
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

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Notice Title *</label>
              <Input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Scheduled Water Tank Desilting"
                className="h-9 text-xs"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Notice Announcement Body *</label>
              <Textarea
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Provide complete details, instructions, date/time and resident action items..."
                className="text-xs leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Audience Scope</label>
                <Select value={targetScope} onValueChange={(v) => setTargetScope(v as any)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">📢 All Residents (Public)</SelectItem>
                    <SelectItem value="block" className="text-xs">🏢 Specific Block</SelectItem>
                    <SelectItem value="building" className="text-xs">🏡 Specific Unit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {targetScope !== "all" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Target Identifier *</label>
                  <Input
                    required
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    placeholder="e.g. Block B, Unit-204"
                    className="h-9 text-xs font-mono"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border/60 pt-3">
              <div className="flex items-center gap-2">
                <Switch checked={isPinned} onCheckedChange={setIsPinned} id="pin-announce" />
                <label htmlFor="pin-announce" className="text-xs font-medium cursor-pointer">
                  📌 Pin Notice to Top
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
                  🚨 Emergency Siren
                </label>
              </div>
            </div>

            <DialogFooter className="border-t border-border/60 pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setComposeOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={composeNotice.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {composeNotice.isPending ? "Broadcasting…" : "Broadcast Notice"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
