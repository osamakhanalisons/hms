import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { ModuleGate } from "@/components/module-gate";
import { PropertyTree, PropertyNode } from "@/components/property-tree";
import {
  getPropertyTreeFn,
  createSocietyFn,
  createBlockFn,
  createBuildingFn,
  createUnitFn,
  updateSocietyFn,
  deleteSocietyFn,
  updateBlockFn,
  deleteBlockFn,
  updateBuildingFn,
  deleteBuildingFn,
  updateUnitFn,
  deleteUnitFn,
} from "@/lib/api/property";
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
import { toast } from "sonner";
import { Building2, Home, Landmark, Plus } from "lucide-react";

export const Route = createFileRoute("/property")({
  head: () => ({
    meta: [
      { title: "Property Structure — HousingOS" },
      { name: "description", content: "Configure blocks, buildings, floors, and units hierarchy." },
    ],
  }),
  component: PropertyRoute,
});

function PropertyRoute() {
  return (
    <ModuleGate moduleKey="property">
      <PropertyPage />
    </ModuleGate>
  );
}

function PropertyPage() {
  const queryClient = useQueryClient();
  const [selectedNode, setSelectedNode] = useState<PropertyNode | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addType, setAddType] = useState<"society" | "block" | "building" | "unit" | null>(null);
  const [parentRecord, setParentRecord] = useState<PropertyNode | null>(null);

  // Form states
  const [newName, setNewName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [unitType, setUnitType] = useState("flat");
  const [areaSqft, setAreaSqft] = useState("");

  const {
    data: treeData = { societies: [], blocks: [], buildings: [], floors: [], units: [] },
    isLoading,
  } = useQuery({
    queryKey: ["propertyTree"],
    queryFn: async () => getPropertyTreeFn(),
  });

  const structuredTree = useMemo(() => {
    const { societies, blocks, buildings, floors, units } = treeData;

    return societies.map((s: any): PropertyNode => {
      const sBlocks = blocks.filter((b: any) => b.society_id === s.id);
      return {
        id: s.id,
        name: s.name,
        type: "society",
        children: sBlocks.map((bl: any): PropertyNode => {
          const blBuildings = buildings.filter((bu: any) => bu.block_id === bl.id);
          return {
            id: bl.id,
            name: bl.name,
            type: "block",
            children: blBuildings.map((bu: any): PropertyNode => {
              const buUnits = units.filter((u: any) => u.building_id === bu.id);
              return {
                id: bu.id,
                name: bu.name,
                type: "building",
                children: buUnits.map((u: any): PropertyNode => ({
                  id: u.id,
                  name: `Unit ${u.unit_number}`,
                  type: "unit",
                  unitNumber: u.unit_number,
                  unitType: u.unit_type,
                  status: u.status,
                })),
              };
            }),
          };
        }),
      };
    });
  }, [treeData]);

  const createSociety = useMutation({
    mutationFn: createSocietyFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["propertyTree"] });
      toast.success("Society created successfully");
      setAddDialogOpen(false);
      resetForm();
    },
  });

  const createBlock = useMutation({
    mutationFn: createBlockFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["propertyTree"] });
      toast.success("Block created successfully");
      setAddDialogOpen(false);
      resetForm();
    },
  });

  const createBuilding = useMutation({
    mutationFn: createBuildingFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["propertyTree"] });
      toast.success("Building created successfully");
      setAddDialogOpen(false);
      resetForm();
    },
  });


  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Edit mutations
  const updateSociety = useMutation({ mutationFn: updateSocietyFn, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["propertyTree"] }); toast.success("Updated successfully"); setEditDialogOpen(false); } });
  const updateBlock = useMutation({ mutationFn: updateBlockFn, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["propertyTree"] }); toast.success("Updated successfully"); setEditDialogOpen(false); } });
  const updateBuilding = useMutation({ mutationFn: updateBuildingFn, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["propertyTree"] }); toast.success("Updated successfully"); setEditDialogOpen(false); } });
  const updateUnit = useMutation({ mutationFn: updateUnitFn, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["propertyTree"] }); toast.success("Updated successfully"); setEditDialogOpen(false); } });

  // Delete mutations
  const deleteSociety = useMutation({ 
    mutationFn: deleteSocietyFn, 
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["propertyTree"] }); toast.success("Deleted successfully"); setDeleteDialogOpen(false); setSelectedNode(null); },
    onError: (err) => { toast.error(err.message || "Failed to delete"); setDeleteDialogOpen(false); }
  });
  const deleteBlock = useMutation({ 
    mutationFn: deleteBlockFn, 
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["propertyTree"] }); toast.success("Deleted successfully"); setDeleteDialogOpen(false); setSelectedNode(null); },
    onError: (err) => { toast.error(err.message || "Failed to delete"); setDeleteDialogOpen(false); }
  });
  const deleteBuilding = useMutation({ 
    mutationFn: deleteBuildingFn, 
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["propertyTree"] }); toast.success("Deleted successfully"); setDeleteDialogOpen(false); setSelectedNode(null); },
    onError: (err) => { toast.error(err.message || "Failed to delete"); setDeleteDialogOpen(false); }
  });
  const deleteUnit = useMutation({ 
    mutationFn: deleteUnitFn, 
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["propertyTree"] }); toast.success("Deleted successfully"); setDeleteDialogOpen(false); setSelectedNode(null); },
    onError: (err) => { toast.error(err.message || "Failed to delete"); setDeleteDialogOpen(false); }
  });

  const handleEditNode = () => {
    if (!selectedNode) return;
    setNewName(selectedNode.unitNumber || selectedNode.name || "");
    if (selectedNode.type === "society") {
      const soc = treeData.societies.find((s: any) => s.id === selectedNode.id);
      setAddress(soc?.address || "");
      setCity(soc?.city || "");
    }
    if (selectedNode.type === "unit") {
      const un = treeData.units.find((u: any) => u.id === selectedNode.id);
      setUnitType(un?.unit_type || "flat");
      setAreaSqft(un?.area_sqft?.toString() || "");
    }
    setEditDialogOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode) return;
    if (selectedNode.type === "society") {
      updateSociety.mutate({ data: { id: selectedNode.id, name: newName, address, city } });
    } else if (selectedNode.type === "block") {
      updateBlock.mutate({ data: { id: selectedNode.id, name: newName } });
    } else if (selectedNode.type === "building") {
      updateBuilding.mutate({ data: { id: selectedNode.id, name: newName } });
    } else if (selectedNode.type === "unit") {
      updateUnit.mutate({ data: { id: selectedNode.id, unitNumber: newName, unitType: unitType as any, areaSqft: areaSqft ? parseFloat(areaSqft) : undefined } });
    }
  };

  const handleDeleteConfirm = () => {
    if (!selectedNode) return;
    if (selectedNode.type === "society") deleteSociety.mutate({ data: { id: selectedNode.id } });
    else if (selectedNode.type === "block") deleteBlock.mutate({ data: { id: selectedNode.id } });
    else if (selectedNode.type === "building") deleteBuilding.mutate({ data: { id: selectedNode.id } });
    else if (selectedNode.type === "unit") deleteUnit.mutate({ data: { id: selectedNode.id } });
  };


  const createUnit = useMutation({
    mutationFn: createUnitFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["propertyTree"] });
      toast.success("Unit created successfully");
      setAddDialogOpen(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setNewName("");
    setAddress("");
    setCity("");
    setUnitType("flat");
    setAreaSqft("");
  };

  const handleAddChild = (parent: PropertyNode) => {
    setParentRecord(parent);
    if (parent.type === "society") {
      setAddType("block");
    } else if (parent.type === "block") {
      setAddType("building");
    } else if (parent.type === "building") {
      setAddType("unit");
    }
    setAddDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (addType === "society") {
      createSociety.mutate({ data: { name: newName, address, city } });
    } else if (addType === "block" && parentRecord) {
      createBlock.mutate({ data: { societyId: parentRecord.id, name: newName } });
    } else if (addType === "building" && parentRecord) {
      createBuilding.mutate({ data: { blockId: parentRecord.id, name: newName } });
    } else if (addType === "unit" && parentRecord) {
      // Find grandparent block/society
      const building = treeData.buildings.find((b: any) => b.id === parentRecord.id);
      const blockId = building?.block_id;
      const block = treeData.blocks.find((bl: any) => bl.id === blockId);
      const societyId = block?.society_id;

      if (!societyId) {
        toast.error("Hierarchy error: Society not resolved");
        return;
      }

      createUnit.mutate({
        data: {
          societyId,
          blockId,
          buildingId: parentRecord.id,
          unitNumber: newName,
          unitType: unitType as any,
          areaSqft: areaSqft ? parseFloat(areaSqft) : undefined,
        },
      });
    }
  };

  return (
    <AppShell title="Property Layout" subtitle="Manage societies, buildings, and residential units">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-1 border-border/70 shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-bold">Property Structure</CardTitle>
                <CardDescription className="text-xs">Recursive hierarchy layout</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setAddType("society");
                  setAddDialogOpen(true);
                }}
                className="size-7 p-0"
              >
                <Plus className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-2">
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : structuredTree.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-xs">
                  No societies added. Click "+" to create one.
                </div>
              ) : (
                <PropertyTree
                  data={structuredTree}
                  onSelect={setSelectedNode}
                  onAddChild={handleAddChild}
                  selectedId={selectedNode?.id}
                />
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2 border-border/70 shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-serif">Node Details</CardTitle>

              {selectedNode && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleEditNode}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>Delete</Button>
                </div>
              )}

            </CardHeader>
            <CardContent>
              {selectedNode ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-12 place-items-center rounded-lg bg-primary-soft text-primary">
                      {selectedNode.type === "society" ? (
                        <Landmark className="size-6" />
                      ) : selectedNode.type === "unit" ? (
                        <Home className="size-6" />
                      ) : (
                        <Building2 className="size-6" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-serif text-lg font-bold">{selectedNode.name}</h3>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
                        {selectedNode.type} ID: {selectedNode.id}
                      </p>
                    </div>
                  </div>

                  {selectedNode.type === "unit" && (
                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Unit Type</div>
                        <div className="text-sm font-semibold capitalize">
                          {selectedNode.unitType || "flat"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Status</div>
                        <div className="text-sm font-semibold capitalize">
                          {selectedNode.status || "vacant"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-20 text-muted-foreground text-sm">
                  Select a society, block, building or unit node in the tree to inspect details.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize font-serif">Create New {addType}</DialogTitle>
            <DialogDescription>
              {parentRecord
                ? `Adding child node to: ${parentRecord.name}`
                : "Create a new root society"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                {addType === "unit" ? "Unit Number" : "Name"}
              </label>
              <Input
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={addType === "unit" ? "e.g., A-102" : "e.g., Block A, Gulberg Green"}
              />
            </div>

            {addType === "society" && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Address</label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">City</label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
              </>
            )}

            {addType === "unit" && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Unit Type</label>
                  <Select value={unitType} onValueChange={setUnitType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat/Apartment</SelectItem>
                      <SelectItem value="villa">Villa/House</SelectItem>
                      <SelectItem value="shop">Commercial Shop</SelectItem>
                      <SelectItem value="office">Office Suite</SelectItem>
                      <SelectItem value="penthouse">Penthouse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Area (Sqft)</label>
                  <Input
                    type="number"
                    value={areaSqft}
                    onChange={(e) => setAreaSqft(e.target.value)}
                    placeholder="e.g. 1200"
                  />
                </div>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize font-serif">Edit {selectedNode?.type}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                {selectedNode?.type === "unit" ? "Unit Number" : "Name"}
              </label>
              <Input required value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>

            {selectedNode?.type === "society" && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Address</label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">City</label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
              </>
            )}

            {selectedNode?.type === "unit" && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Unit Type</label>
                  <Select value={unitType} onValueChange={setUnitType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat/Apartment</SelectItem>
                      <SelectItem value="villa">Villa/House</SelectItem>
                      <SelectItem value="shop">Commercial Shop</SelectItem>
                      <SelectItem value="office">Office Suite</SelectItem>
                      <SelectItem value="penthouse">Penthouse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Area (Sqft)</label>
                  <Input type="number" value={areaSqft} onChange={(e) => setAreaSqft(e.target.value)} />
                </div>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive font-serif">Delete {selectedNode?.type}?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedNode?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>Delete Node</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppShell>
  );
}
