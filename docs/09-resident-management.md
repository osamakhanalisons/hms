# Resident Management

Resident Management handles the occupants living inside the society units.

## Onboarding Residents
- Residents are linked to specific unit records in the `residents` table.
- They are classified as either:
  - **Owner**: Holds legal ownership of the property unit.
  - **Tenant**: Rents the property unit from the owner.
- An occupant's vehicle plates are mapped in the `resident_vehicles` table to allow automated matching in the gate security logs.

## Move-Out Workflow
1. User requests a move-out check.
2. System checks the ledger to verify that the unit's balance is zero.
3. Once approved, the `is_current` flag on the `residents` link is set to `FALSE`.
4. The unit status in `units` is set back to `vacant`.
