import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getNotificationsFn, markAsReadFn } from "@/lib/api/notifications";
import { Bell, CheckCheck, ShieldAlert, Wrench, FileText, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications Central — HousingOS" },
      {
        name: "description",
        content: "Receive and manage critical society bulletins and portal notifications.",
      },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications-page"],
    queryFn: async () => getNotificationsFn(),
  });

  const markAllRead = useMutation({
    mutationFn: markAsReadFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-page"] });
      queryClient.invalidateQueries({ queryKey: ["header-notifications"] });
      toast.success("All notifications marked as read");
    },
  });

  const markSingleRead = useMutation({
    mutationFn: markAsReadFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-page"] });
      queryClient.invalidateQueries({ queryKey: ["header-notifications"] });
    },
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "maintenance":
        return <Wrench className="size-4 text-amber-500" />;
      case "visitor":
        return <ShieldAlert className="size-4 text-emerald-500" />;
      case "document":
        return <FileText className="size-4 text-blue-500" />;
      default:
        return <Bell className="size-4 text-primary" />;
    }
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate({});
  };

  const handleMarkSingleRead = (id: string, currentStatus: string) => {
    if (currentStatus === "read") return;
    markSingleRead.mutate({ notificationId: id });
  };

  return (
    <AppShell
      title="Notifications Central"
      subtitle="Review portal activity logs and alert dispatches"
    >
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-10 space-y-6">
        <section className="flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="font-serif text-2xl font-bold">Notifications</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Stay up to date with the latest society announcements
            </p>
          </div>
          {notifications.some((n: any) => n.readStatus === "unread") && (
            <Button
              onClick={handleMarkAllRead}
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 font-semibold text-xs"
              disabled={markAllRead.isPending}
            >
              {markAllRead.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCheck className="size-3.5" />
              )}
              Mark all as read
            </Button>
          )}
        </section>

        <Card className="border-border/70 shadow-soft">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <Loader2 className="size-6 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground font-medium">
                  Fetching alerts...
                </span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground flex flex-col items-center justify-center gap-3">
                <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Bell className="size-5" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-sm">Inbox is empty</p>
                  <p className="text-xs">
                    We will alert you when something requires your attention.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {notifications.map((n: any) => (
                  <div
                    key={n.id}
                    onClick={() => handleMarkSingleRead(n.id, n.readStatus)}
                    className={`p-4 flex items-start gap-4 transition-colors cursor-pointer hover:bg-muted/40 ${
                      n.readStatus === "unread" ? "bg-primary-soft/10" : ""
                    }`}
                  >
                    <div className="grid size-9 place-items-center rounded-lg bg-card border shrink-0">
                      {getTypeIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <h4
                            className={`text-sm font-semibold truncate ${
                              n.readStatus === "unread"
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {n.title}
                          </h4>
                          {n.readStatus === "unread" && (
                            <Badge
                              variant="default"
                              className="text-[8px] uppercase tracking-wider h-4 py-0 scale-90"
                            >
                              New
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0 font-mono flex items-center gap-1">
                          <Calendar className="size-3" />
                          {format(new Date(n.createdAt), "dd MMM, hh:mm a")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{n.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
