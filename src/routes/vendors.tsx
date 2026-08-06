import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
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
import {
  getVendorsFn,
  createVendorFn,
  getRfqsFn,
  createRfqFn,
  getQuotationsFn,
  submitQuotationFn,
  awardQuotationFn,
} from "@/lib/api/vendors";
import { toast } from "sonner";
import { Truck, Plus, Star, Send, Eye, Award, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/vendors")({
  head: () => ({
    meta: [
      { title: "Vendors & RFQs — HousingOS" },
      { name: "description", content: "Manage society vendors and request quotations." },
    ],
  }),
  component: VendorsRoute,
});

function VendorsRoute() {
  return (
    <ModuleGate moduleKey="vendors">
      <VendorsPage />
    </ModuleGate>
  );
}

function VendorsPage() {
  const queryClient = useQueryClient();
  const [vendorOpen, setVendorOpen] = useState(false);
  const [rfqOpen, setRfqOpen] = useState(false);
  const [bidOpen, setBidOpen] = useState(false);
  const [quotesOpen, setQuotesOpen] = useState(false);
  const [selectedRfqId, setSelectedRfqId] = useState<string | null>(null);

  // Vendor form
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // RFQ form
  const [rfqTitle, setRfqTitle] = useState("");
  const [rfqDesc, setRfqDesc] = useState("");

  // Bid form
  const [bidVendorId, setBidVendorId] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [bidNotes, setBidNotes] = useState("");

  const { data: vendors = [], isLoading: loadingVendors } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => getVendorsFn(),
  });

  const { data: rfqs = [], isLoading: loadingRfqs } = useQuery({
    queryKey: ["rfqs"],
    queryFn: async () => getRfqsFn(),
  });

  const { data: quotations = [], isLoading: loadingQuotes } = useQuery({
    queryKey: ["quotations", selectedRfqId],
    queryFn: async () => {
      if (!selectedRfqId) return [];
      return getQuotationsFn({ data: { rfqId: selectedRfqId } });
    },
    enabled: !!selectedRfqId,
  });

  const createVendor = useMutation({
    mutationFn: createVendorFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor profile added successfully");
      setVendorOpen(false);
      setName("");
      setCategory("");
      setPhone("");
      setEmail("");
    },
  });

  const createRfq = useMutation({
    mutationFn: createRfqFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfqs"] });
      toast.success("RFQ created successfully");
      setRfqOpen(false);
      setRfqTitle("");
      setRfqDesc("");
    },
  });

  const submitBid = useMutation({
    mutationFn: submitQuotationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations", selectedRfqId] });
      toast.success("Quotation submitted successfully");
      setBidOpen(false);
      setBidVendorId("");
      setBidAmount("");
      setBidNotes("");
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to submit quotation"),
  });

  const awardBid = useMutation({
    mutationFn: awardQuotationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfqs"] });
      queryClient.invalidateQueries({ queryKey: ["quotations", selectedRfqId] });
      toast.success("Bid awarded and Purchase Order generated!");
      setQuotesOpen(false);
      setSelectedRfqId(null);
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to award bid"),
  });

  const handleSubmitVendor = (e: React.FormEvent) => {
    e.preventDefault();
    createVendor.mutate({
      data: { name, category, phone: phone || undefined, email: email || undefined },
    });
  };

  const handleSubmitRfq = (e: React.FormEvent) => {
    e.preventDefault();
    createRfq.mutate({
      data: { title: rfqTitle, description: rfqDesc },
    });
  };

  const handleSubmitBid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRfqId) return;
    submitBid.mutate({
      data: {
        rfqId: selectedRfqId,
        vendorId: bidVendorId,
        amount: parseFloat(bidAmount),
        notes: bidNotes || undefined,
      },
    });
  };

  return (
    <AppShell
      title="Vendor Management"
      subtitle="Manage external contractors and bid invitations (RFQs)"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10 space-y-8">
        {/* Actions header */}
        <section className="flex flex-wrap items-center justify-end gap-3 border-b pb-4">
          <Button onClick={() => setRfqOpen(true)} variant="outline" size="sm" className="gap-1">
            <Send className="size-4" /> Create RFQ Bid
          </Button>
          <Button onClick={() => setVendorOpen(true)} size="sm" className="gap-1">
            <Plus className="size-4" /> Add Vendor Profile
          </Button>
        </section>

        {/* Grid layout */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Vendors list */}
          <Card className="border-border/70 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base font-bold">Approved Vendors</CardTitle>
              <CardDescription className="text-xs">
                Contractors available for work orders
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingVendors ? (
                <div className="flex justify-center py-10">
                  <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : vendors.length === 0 ? (
                <div className="text-center py-10 text-xs text-muted-foreground">
                  No vendors added yet.
                </div>
              ) : (
                <div className="divide-y">
                  {vendors.map((v: any) => (
                    <div key={v.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="grid size-9 place-items-center rounded bg-primary-soft text-primary">
                          <Truck className="size-4" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">{v.name}</h4>
                          <p className="text-xs text-muted-foreground capitalize">{v.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-semibold text-warning-foreground font-mono">
                        <Star className="size-3.5 fill-warning stroke-warning" />{" "}
                        {Number(v.rating).toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* RFQs list */}
          <Card className="border-border/70 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base font-bold">
                Active RFQs (Request for Quotations)
              </CardTitle>
              <CardDescription className="text-xs">
                Milestone bids out for contractor quotation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingRfqs ? (
                <div className="flex justify-center py-10">
                  <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : rfqs.length === 0 ? (
                <div className="text-center py-10 text-xs text-muted-foreground">
                  No bid invitations running.
                </div>
              ) : (
                <div className="divide-y">
                  {rfqs.map((r: any) => (
                    <div key={r.id} className="py-3 flex flex-col gap-1.5 border-b last:border-b-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">{r.title}</h4>
                        <Badge variant="outline" className="text-[9px] uppercase tracking-wider">
                          {r.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {r.description}
                      </p>
                      <div className="flex justify-end gap-1.5 pt-2">
                        {r.status !== "closed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] gap-1 px-2"
                            onClick={() => {
                              setSelectedRfqId(r.id);
                              setBidOpen(true);
                            }}
                          >
                            <Send className="size-3" /> Submit Bid
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10px] gap-1 px-2"
                          onClick={() => {
                            setSelectedRfqId(r.id);
                            setQuotesOpen(true);
                          }}
                        >
                          <Eye className="size-3" /> View Bids
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Vendor Dialog */}
      <Dialog open={vendorOpen} onOpenChange={setVendorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Add Vendor Profile</DialogTitle>
            <DialogDescription>
              Register an external contractor or maintenance supplier
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitVendor} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Vendor Name</label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Al-Fatah Electricals"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Trade Category</label>
              <Input
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Plumbing, HVAC, Elevators"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Phone</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVendorOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Profile</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create RFQ Dialog */}
      <Dialog open={rfqOpen} onOpenChange={setRfqOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Launch Bid RFQ</DialogTitle>
            <DialogDescription>
              Create a project scope to receive vendor bid quotes
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitRfq} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">RFQ Title</label>
              <Input
                required
                value={rfqTitle}
                onChange={(e) => setRfqTitle(e.target.value)}
                placeholder="e.g. Society Park Painting Project"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Detailed Scope description
              </label>
              <Input
                required
                value={rfqDesc}
                onChange={(e) => setRfqDesc(e.target.value)}
                placeholder="Provide material guidelines, deadlines..."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRfqOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Issue RFQ</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Submit Bid Dialog */}
      <Dialog open={bidOpen} onOpenChange={setBidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Submit Quotation Bid</DialogTitle>
            <DialogDescription>
              Attach a price bid quote on behalf of a contractor
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitBid} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Select Bidder Vendor
              </label>
              <Select value={bidVendorId} onValueChange={setBidVendorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose Vendor..." />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Quotation Amount (₨)
              </label>
              <Input
                type="number"
                required
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Proposal Notes</label>
              <Input
                value={bidNotes}
                onChange={(e) => setBidNotes(e.target.value)}
                placeholder="e.g. Includes materials and 6 month AMC"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBidOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Submit Quotation</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Bids Dialog */}
      <Dialog open={quotesOpen} onOpenChange={setQuotesOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-serif">Received Quotations</DialogTitle>
            <DialogDescription>Review bidding proposals submitted by vendors</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4 max-h-[400px] overflow-y-auto">
            {loadingQuotes ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : quotations.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No quotations submitted for this RFQ yet.
              </div>
            ) : (
              <div className="space-y-3">
                {quotations.map((q: any) => (
                  <div
                    key={q.id}
                    className="p-3 border rounded-lg bg-card flex items-center justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm">{q.vendor_name}</h4>
                        <Badge variant="outline" className="text-[9px] uppercase tracking-wider">
                          {q.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {q.notes || "No notes attached"}
                      </p>
                      <p className="text-xs font-semibold font-mono text-primary mt-1">
                        ₨{Number(q.amount).toLocaleString("en-PK")}
                      </p>
                    </div>
                    {q.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => awardBid.mutate({ rfqId: q.rfq_id, quotationId: q.id })}
                        className="gap-1 bg-primary text-primary-foreground font-semibold py-1 h-8 shrink-0"
                      >
                        <Award className="size-3.5" /> Award
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setQuotesOpen(false);
                setSelectedRfqId(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
