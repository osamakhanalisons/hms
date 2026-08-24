# Asset Registry

Maintains a record of all physical infrastructure assets owned by the society.

## Asset Schema
- **Name**: e.g., Generator DG-1, Lift B2.
- **Location**: Specific block/building location mapping.
- **Serial Number**: For warranty verification.
- **Warranty Expiry**: Date parameter trigger.
- **Status**: `operational`, `under_maintenance`, `decommissioned`.

## Maintenance Linking
Assets are directly linked to work orders, building a complete service history for each physical item.
