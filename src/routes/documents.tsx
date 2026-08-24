import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { PermissionGate } from "@/components/permission-gate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { getDocumentsFn, uploadDocumentFn, deleteDocumentFn } from "@/lib/api/documents";
import { toast } from "sonner";
import { FileText, Plus, Search, Trash2, Calendar, FileDown } from "lucide-react";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: "Document Directory — HousingOS" },
      {
        name: "description",
        content: "Access official NOCs, legal filings, meetings minutes, and certificates.",
      },
    ],
  }),
  component: DocumentsRoute,
});

function DocumentsRoute() {
  return (
    <ModuleGate moduleKey="documents">
      <DocumentsPage />
    </ModuleGate>
  );
}

function DocumentsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<any>("all");

  // Form states
  const [name, setName] = useState("");
  const [docCategory, setDocCategory] = useState<any>("other");
  const [file, setFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState("");

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getDocumentsFn(),
  });

  const uploadDoc = useMutation({
    mutationFn: uploadDocumentFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document uploaded successfully");
      setOpen(false);
      setName("");
      setDocCategory("other");
      setFile(null);
      setExpiryDate("");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to upload document");
    },
  });

  const deleteDoc = useMutation({
    mutationFn: deleteDocumentFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document deleted");
    },
  });

  const filtered = documents.filter((d: any) => {
    const matchesSearch = d.name.toLowerCase().includes(q.toLowerCase());
    const matchesCategory = category === "all" || d.category === category;
    return matchesSearch && matchesCategory;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a file to upload");
      return;
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("category", docCategory);
    if (expiryDate) formData.append("expiryDate", expiryDate);
    formData.append("file", file);

    uploadDoc.mutate({
      data: formData as any,
    });
  };

  return (
    <AppShell title="Document Center" subtitle="Official society documentation and record storage.">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="noc">NOC</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="legal">Legal</SelectItem>
                <SelectItem value="financial">Financial</SelectItem>
                <SelectItem value="minutes">Minutes</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <PermissionGate moduleKey="documents" action="create" fallback={null}>
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="size-4" /> Upload Document
            </Button>
          </PermissionGate>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              A directory of agreements, legal paperwork, certificates and official letters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Loading documents...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto size-12 text-muted-foreground/30" />
                <h3 className="mt-4 text-sm font-semibold">No documents found</h3>
                <p className="mt-2 text-xs text-muted-foreground">
                  Get started by uploading your first document.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map((d: any) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between py-4 first:pt-0 last:pb-0 gap-4"
                  >
                    <div className="flex flex-1 min-w-0 items-start gap-3">
                      <div className="p-2 bg-muted rounded shrink-0">
                        <FileText className="size-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium truncate" title={d.name}>{d.name}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="uppercase text-[10px] font-semibold tracking-wider bg-accent text-accent-foreground px-1.5 py-0.5 rounded">
                            {d.category}
                          </span>
                          <span>·</span>
                          <span>Uploaded by {d.uploader_name || "Admin"}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {format(
                              typeof d.created_at === 'string' ? parseISO(d.created_at) : new Date(d.created_at),
                              "MMM d, yyyy"
                            )}
                          </span>
                          {d.expiry_date && (
                            <>
                              <span>·</span>
                              <span className="text-red-500 font-medium">
                                Expires: {format(
                                  typeof d.expiry_date === 'string' ? parseISO(d.expiry_date) : new Date(d.expiry_date),
                                  "MMM d, yyyy"
                                )}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="icon" asChild>
                        <a href={d.file_url} target="_blank" rel="noreferrer" download>
                          <FileDown className="size-4" />
                        </a>
                      </Button>
                      <PermissionGate moduleKey="documents" action="delete" fallback={null}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this document?")) {
                            deleteDoc.mutate({ id: d.id });
                          }
                        }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </PermissionGate>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Provide metadata to upload a document to the registry.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">File</label>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  required
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    if (selected) {
                      setFile(selected);
                      if (!name) {
                        setName(selected.name.replace(/\.[^/.]+$/, ""));
                      }
                    } else {
                      setFile(null);
                    }
                  }}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Document Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Society Bylaws 2026"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Category</label>
                <Select value={docCategory} onValueChange={setDocCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="noc">NOC</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="legal">Legal</SelectItem>
                    <SelectItem value="financial">Financial</SelectItem>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Expiry Date (Optional)</label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={uploadDoc.isPending}>
                  {uploadDoc.isPending ? "Uploading..." : "Save Document"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
