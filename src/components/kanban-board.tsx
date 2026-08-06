import React from "react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";

export interface KanbanColumn {
  id: string;
  title: string;
  tone: "neutral" | "info" | "warning" | "success" | "destructive";
}

export interface KanbanItem {
  id: string;
  title: string;
  description: string;
  meta: string;
  badge?: string;
  badgeTone?: "default" | "secondary" | "destructive" | "outline";
}

interface KanbanBoardProps {
  columns: KanbanColumn[];
  items: KanbanItem[];
  itemColumnMap: Record<string, string>; // item id -> column id
  onItemClick?: (item: KanbanItem) => void;
}

export function KanbanBoard({ columns, items, itemColumnMap, onItemClick }: KanbanBoardProps) {
  // Group items by column
  const grouped = columns.reduce(
    (acc, col) => {
      acc[col.id] = items.filter((item) => itemColumnMap[item.id] === col.id);
      return acc;
    },
    {} as Record<string, KanbanItem[]>,
  );

  const columnHeaders: Record<string, string> = {
    neutral: "border-border/60 bg-muted/40",
    info: "border-primary/20 bg-primary-soft/10",
    warning: "border-warning/20 bg-warning/5",
    success: "border-success/20 bg-success/5",
    destructive: "border-destructive/20 bg-destructive/5",
  };

  const badgeColors: Record<string, string> = {
    neutral: "text-muted-foreground",
    info: "text-primary bg-primary-soft",
    warning: "text-warning-foreground bg-warning/15",
    success: "text-success bg-success/15",
    destructive: "text-destructive bg-destructive/15",
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 items-start">
      {columns.map((col) => {
        const colItems = grouped[col.id] ?? [];
        return (
          <div key={col.id} className="flex flex-col gap-3 h-full min-h-[500px]">
            <header
              className={`flex items-center justify-between p-3 rounded-lg border ${columnHeaders[col.tone]}`}
            >
              <div className="flex items-center gap-2">
                <span className="font-serif text-sm font-bold tracking-tight">{col.title}</span>
                <span className="rounded-full bg-background px-2 py-0.5 font-mono text-[10px] font-semibold shadow-soft">
                  {colItems.length}
                </span>
              </div>
            </header>

            <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto">
              {colItems.map((item) => (
                <Card
                  key={item.id}
                  onClick={() => onItemClick?.(item)}
                  className="border-border/60 hover:border-primary/40 hover:shadow-soft cursor-pointer transition-all active:scale-[0.98]"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="space-y-1">
                      <h4 className="font-sans text-xs font-bold leading-snug tracking-tight text-foreground line-clamp-2">
                        {item.title}
                      </h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {item.meta}
                      </span>
                      {item.badge && (
                        <Badge
                          variant={item.badgeTone || "secondary"}
                          className="text-[9px] uppercase tracking-wider h-4 px-1"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {colItems.length === 0 && (
                <div className="flex-1 rounded-lg border border-dashed border-border/50 flex items-center justify-center p-6 text-center text-xs text-muted-foreground">
                  Empty column
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
