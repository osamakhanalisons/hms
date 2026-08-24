# Payment Gateway and Records

Handles payment collection from residents and record management.

## Supported Channels
1. **Manual Payments**: Cash, Cheques, or direct Bank Transfers recorded by the Finance Head.
2. **Stripe Integration (Planned)**: Secure card checkouts (currently stubbed via mock components in frontend).

## Payment Reconciliation Flow
- When a payment is recorded:
  - An entry is inserted into `payments`.
  - A corresponding credit (`type = 'payment'`) is recorded in the ledger.
  - If the payment amount exceeds the outstanding balance, the surplus is automatically added to the unit's wallet balance.
  - Receipts are generated with a unique transaction reference identifier.
