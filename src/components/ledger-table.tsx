import React from "react";
import { format } from "date-fns";

export interface LedgerRow {
  id: string;
  type: "charge" | "payment" | "adjustment" | "opening_balance";
  amount: number | string;
  description: string;
  billing_period?: string;
  balance_after: number | string;
  created_at: string;
  charge_head_name?: string;
}

interface LedgerTableProps {
  rows: LedgerRow[];
}

export function LedgerTable({ rows }: LedgerTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/70 shadow-soft">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[10px] uppercase tracking-[0.14em] text-muted-foreground border-b border-border/70">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Date</th>
            <th className="px-4 py-3 text-left font-semibold">Description</th>
            <th className="px-4 py-3 text-left font-semibold">Billing Period</th>
            <th className="px-4 py-3 text-right font-semibold">Amount</th>
            <th className="px-4 py-3 text-right font-semibold">Running Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map((row) => {
            const isCharge = row.type === "charge" || row.type === "opening_balance";
            const amt = Number(row.amount);
            const bal = Number(row.balance_after);

            return (
              <tr key={row.id} className="hover:bg-primary-soft/10 transition-colors">
                <td className="px-4 py-3.5 text-xs text-muted-foreground font-mono">
                  {format(new Date(row.created_at), "dd MMM yyyy")}
                </td>
                <td className="px-4 py-3.5">
                  <div className="font-medium text-foreground">{row.description}</div>
                  {row.charge_head_name && (
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      {row.charge_head_name}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground font-mono">
                  {row.billing_period || "—"}
                </td>
                <td
                  className={`px-4 py-3.5 text-right font-mono font-semibold ${isCharge ? "text-destructive" : "text-success"}`}
                >
                  {isCharge ? "+" : "-"}₨{amt.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3.5 text-right font-mono font-semibold text-foreground">
                  ₨{bal.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-xs">
                No ledger transactions recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
