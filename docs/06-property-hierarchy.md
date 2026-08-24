# Property Hierarchy Validation

The platform models physical infrastructure using a structured parent-child hierarchy to ensure data integrity:

```
Society (Tenant)
  └── Block (Phase 1, Block A)
        └── Building (Tower A, Building C)
              └── Floor (Ground Floor, 1st Floor)
                    └── Unit (Apt 101, Villa 5)
```

## Validation Rules
- **Parent Isolation**: A Block must belong to the active `society_id` and `tenant_id`.
- **No Orphan Units**: A Unit cannot exist without being mapped to a Floor, Building, and Block.
- **Duplicate Prevention**: Unit numbers must be unique within their respective building context.
- **Cascading Constraints**: Deleting a block will trigger database checks to ensure all child buildings, floors, and units are either safe-removed or reassigned, preventing dangling pointers.
