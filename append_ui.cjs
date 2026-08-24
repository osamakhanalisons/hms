const fs = require('fs');
let code = fs.readFileSync('src/routes/property.tsx', 'utf8');

// 1. Add imports for updates/deletes
code = code.replace(
  /createSocietyFn,[\s\S]*?createUnitFn,/,
  `createSocietyFn,
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
  deleteUnitFn,`
);

// 2. Add Edit/Delete state and hooks
const statesToAdd = `
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
`;

code = code.replace(
  '  const createUnit = useMutation({',
  statesToAdd + '\n\n  const createUnit = useMutation({'
);

// 3. Add Edit/Delete buttons to Node Details
const editButtons = `
              {selectedNode && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleEditNode}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>Delete</Button>
                </div>
              )}
`;

code = code.replace(
  '<CardTitle className="text-lg font-serif">Node Details</CardTitle>',
  '<CardTitle className="text-lg font-serif">Node Details</CardTitle>\n' + editButtons
);

code = code.replace(
  '<CardHeader>',
  '<CardHeader className="flex flex-row items-center justify-between">'
);

// 4. Add Dialogs at the end
const dialogs = `
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
`;

code = code.replace(
  '    </AppShell>',
  dialogs + '\n    </AppShell>'
);

fs.writeFileSync('src/routes/property.tsx', code);
console.log('Appended UI successfully');
