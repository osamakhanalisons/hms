import React, { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

export interface LedgerRow {
  id: string;
  type: "charge" | "payment" | "adjustment" | "opening_balance";
  amount: number | string;
  description: string;
  billing_period?: string;
  balance_after: number | string;
  created_at: string;
  charge_head_name?: string;
}

interface LedgerTableProps {
  rows: LedgerRow[];
}

export function LedgerTable({ rows }: LedgerTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc"); // Newest first by default
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // Default 10 rows

  // Filter rows
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // 1. Search Query filter
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        row.description.toLowerCase().includes(query) ||
        (row.charge_head_name && row.charge_head_name.toLowerCase().includes(query)) ||
        (row.billing_period && row.billing_period.toLowerCase().includes(query)) ||
        row.amount.toString().includes(query) ||
        row.balance_after.toString().includes(query);

      // 2. Type filter
      let matchesType = true;
      if (typeFilter === "debits") {
        matchesType = row.type === "charge" || row.type === "opening_balance";
      } else if (typeFilter === "credits") {
        matchesType = row.type === "payment" || row.type === "adjustment";
      }

      return matchesSearch && matchesType;
    });
  }, [rows, searchQuery, typeFilter]);

  // Sort rows
  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });
    return sorted;
  }, [filteredRows, sortOrder]);

  // Reset page when sorting, type filter, or search query changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, typeFilter, sortOrder]);

  // Pagination bounds
  const totalItems = sortedRows.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  return (
    <div className="space-y-4">
      {/* Search and Filters Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/10 p-3 rounded-lg border border-border/70 shadow-soft">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ledger entries..."
              className="h-9 w-full pl-9 text-sm border-border/70 bg-background"
            />
          </div>

          {/* Type Filter */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-full sm:w-44 border-border/70 bg-background">
              <SelectValue placeholder="All Transactions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Transactions</SelectItem>
              <SelectItem value="debits">Charges / Debits</SelectItem>
              <SelectItem value="credits">Payments / Credits</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto sm:ml-auto">
          {/* Sort Order Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 border-border/70 w-full sm:w-auto bg-background"
            onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
          >
            <ArrowUpDown className="size-3.5" />
            <span>{sortOrder === "desc" ? "Newest First" : "Oldest First"}</span>
          </Button>

          {/* Page Size Select */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground w-full sm:w-auto justify-end sm:justify-start">
            <span>Rows per page:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                setPageSize(Number(val));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-20 border-border/70 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-lg border border-border/70 shadow-soft bg-background">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-[0.14em] text-muted-foreground border-b border-border/70">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Date</th>
              <th className="px-4 py-3 text-left font-semibold">Description</th>
              <th className="px-4 py-3 text-left font-semibold">Billing Period</th>
              <th className="px-4 py-3 text-right font-semibold">Amount</th>
              <th className="px-4 py-3 text-right font-semibold">Running Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {paginatedRows.map((row) => {
              const isCharge = row.type === "charge" || row.type === "opening_balance";
              const amt = Number(row.amount);
              const bal = Number(row.balance_after);

              return (
                <tr key={row.id} className="hover:bg-primary-soft/10 transition-colors">
                  <td className="px-4 py-3.5 text-xs text-muted-foreground font-mono">
                    {format(new Date(row.created_at), "dd MMM yyyy")}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-foreground">{row.description}</div>
                    {row.charge_head_name && (
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {row.charge_head_name}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground font-mono">
                    {row.billing_period || "—"}
                  </td>
                  <td
                    className={`px-4 py-3.5 text-right font-mono font-semibold ${isCharge ? "text-destructive" : "text-success"}`}
                  >
                    {isCharge ? "+" : "-"}₨
                    {amt.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono font-semibold text-foreground">
                    ₨{bal.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
            {paginatedRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-xs">
                  {rows.length === 0
                    ? "No ledger transactions recorded yet."
                    : "No transactions match your search/filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls Toolbar */}
      {totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/70 pt-4 px-1">
          <div className="text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">{(page - 1) * pageSize + 1}</span> to{" "}
            <span className="font-semibold text-foreground">
              {Math.min(page * pageSize, totalItems)}
            </span>{" "}
            of <span className="font-semibold text-foreground">{totalItems.toLocaleString()}</span>{" "}
            transactions
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 text-xs px-2.5 border-border/70"
              >
                <ChevronLeft className="size-3.5 mr-1" /> Previous
              </Button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  return (
                    <React.Fragment key={p}>
                      {prev && p - prev > 1 && (
                        <span className="text-xs text-muted-foreground px-1">...</span>
                      )}
                      <Button
                        variant={p === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(p)}
                        className="h-8 w-8 text-xs p-0 font-medium border-border/70"
                      >
                        {p}
                      </Button>
                    </React.Fragment>
                  );
                })}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 text-xs px-2.5 border-border/70"
              >
                Next <ChevronRight className="size-3.5 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
