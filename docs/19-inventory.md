# Inventory Stock Management

Tracks tools, spare parts, and office materials needed for society operations.

## Stock Movements
- Items are cataloged with fields: `sku`, `name`, `category`, `stock_level`.
- Any material usage on a work order registers a `stock_out` type movement.
- Deliveries from vendors register a `stock_in` type movement.
- Automatic alerts trigger when stock levels fall below specified minimum thresholds.
