# Utility Meters

Handles sub-meter management for gas, water, and electricity consumption.

## Configuration
- **Meter Rates**: Set per unit type (domestic/commercial) and utility type.
- **Readings Log**: Records monthly values: `previous_reading`, `current_reading`, and calculates consumed units.

## Billing Generation
Once a monthly reading is saved, the system computes the amount using the active rate table and pushes a debit item directly to the unit's ledger statement.
