import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, Fragment } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getFinancialSummaryReportFn,
  getOccupancyReportFn,
  getComplaintResolutionReportFn,
} from "@/lib/api/reports";
import { BarChart3, Users, Landmark, Wrench, Download, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

interface OccupancyReportItem {
  block_name: string;
  unit_number: string;
  occupancy_status: string;
  unit_type: string;
}

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports Center — HousingOS" },
      {
        name: "description",
        content: "View operational reports, financial metrics, and occupancy details.",
      },
    ],
  }),
  component: ReportsRoute,
});

function ReportsRoute() {
  return (
    <ModuleGate moduleKey="reports">
      <ReportsPage />
    </ModuleGate>
  );
}

function ReportsPage() {
  const { roles, loading } = useAuth();
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const canAccess = roles.some((r) => ["super_admin", "society_admin", "finance_head"].includes(r));

  const { data: finances, isLoading: loadingFinances } = useQuery({
    queryKey: ["reports", "finances"],
    queryFn: () => getFinancialSummaryReportFn(),
    enabled: canAccess,
  });

  const { data: occupancy = [], isLoading: loadingOccupancy } = useQuery({
    queryKey: ["reports", "occupancy"],
    queryFn: () => getOccupancyReportFn(),
    enabled: canAccess,
  });

  const { data: complaints, isLoading: loadingComplaints } = useQuery({
    queryKey: ["reports", "complaints"],
    queryFn: () => getComplaintResolutionReportFn(),
    enabled: canAccess,
  });

  const totalItems = occupancy.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  const paginatedOccupancy = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return occupancy.slice(start, start + itemsPerPage);
  }, [occupancy, page]);

  if (!loading && !canAccess) {
    return (
      <AppShell title="Access Denied" subtitle="Finance access required">
        <div className="mx-auto max-w-md py-16 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-lg font-bold font-serif">Restricted Area</h2>
          <p className="text-xs text-muted-foreground">
            Finance or Admin access required to view reports.
          </p>
          <Button onClick={() => window.history.back()} variant="outline" className="mt-4">
            Go Back
          </Button>
        </div>
      </AppShell>
    );
  }

  const downloadCSV = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) {
      toast.error("No data available to download");
      return;
    }
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) =>
      Object.values(row)
        .map((value) => `"${value}"`)
        .join(","),
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV file downloaded successfully");
  };

  return (
    <AppShell
      title="Reports Center"
      subtitle="Comprehensive reports and raw exports for accounting and audit."
    >
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-8 sm:py-10">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Financial Accounts</CardTitle>
              <Landmark className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingFinances ? (
                <div className="text-xs text-muted-foreground">Loading...</div>
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    PKR {(finances?.totalCollected || 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Outstanding: PKR {(finances?.outstanding || 0).toLocaleString()}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
              <Users className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingOccupancy ? (
                <div className="text-xs text-muted-foreground">Loading...</div>
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {occupancy.length > 0
                      ? Math.round(
                          (occupancy.filter(
                            (u: OccupancyReportItem) => u.occupancy_status === "occupied",
                          ).length /
                            occupancy.length) *
                            100,
                        )
                      : 0}
                    %
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {
                      occupancy.filter(
                        (u: OccupancyReportItem) => u.occupancy_status === "occupied",
                      ).length
                    }{" "}
                    occupied units out of {occupancy.length}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Complaint Resolutions</CardTitle>
              <Wrench className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingComplaints ? (
                <div className="text-xs text-muted-foreground">Loading...</div>
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {complaints && complaints.total > 0
                      ? Math.round((complaints.resolved / complaints.total) * 100)
                      : 0}
                    %
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {complaints ? complaints.resolved : 0} resolved out of{" "}
                    {complaints ? complaints.total : 0} total complaints
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Unit Occupancy Report</CardTitle>
              <CardDescription>
                A block-by-block breakdown of all building units and current occupancy status.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCSV(occupancy, "occupancy_report.csv")}
              className="gap-1"
            >
              <Download className="size-4" /> Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            {loadingOccupancy ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Loading report data...
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Block</TableHead>
                      <TableHead>Unit Number</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOccupancy.map((u: OccupancyReportItem, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{u.block_name}</TableCell>
                        <TableCell>{u.unit_number}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                              u.occupancy_status === "occupied"
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {u.occupancy_status}
                          </span>
                        </TableCell>
                        <TableCell>{u.unit_type}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination Controls */}
                {totalItems > itemsPerPage && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/70 pt-4 mt-4 text-xs text-muted-foreground">
                    <div>
                      Showing{" "}
                      <span className="font-semibold text-foreground">
                        {(page - 1) * itemsPerPage + 1}
                      </span>{" "}
                      to{" "}
                      <span className="font-semibold text-foreground">
                        {Math.min(page * itemsPerPage, totalItems)}
                      </span>{" "}
                      of{" "}
                      <span className="font-semibold text-foreground">
                        {totalItems.toLocaleString()}
                      </span>{" "}
                      units
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                        className="h-8 text-xs px-2.5 border-border/70 bg-background"
                      >
                        Previous
                      </Button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                        .map((p, idx, arr) => {
                          const prev = arr[idx - 1];
                          return (
                            <Fragment key={p}>
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
                            </Fragment>
                          );
                        })}

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === totalPages}
                        onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                        className="h-8 text-xs px-2.5 border-border/70 bg-background"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
