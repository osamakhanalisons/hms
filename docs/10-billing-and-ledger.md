# Billing and Ledger Management

This module acts as the financial core of the society, handling invoices, charges, and resident statements.

## Core Financial Entities
- **Charge Heads (`charge_heads`)**: Defined monthly or periodic fees (e.g. "Maintenance Fee", "Security Charges").
- **Ledger Entries (`ledger_entries`)**: Double-entry ledger logs. A `type = 'charge'` increases the outstanding balance of a unit, while a `type = 'payment'` decreases it.
- **Resident Wallet (`wallets`)**: A virtual account for each unit storing overpayments and advance balances.

## Recurring Billing Process
1. Finance Head triggers the monthly billing process.
2. The server iterates over all occupied units.
3. For each active charge head, a transaction is written to the ledger, and the unit's current outstanding balance is updated.
4. Notifications are sent automatically to residents.
