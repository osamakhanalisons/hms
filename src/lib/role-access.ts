import type { AppRole } from "@/hooks/use-auth";

// Which module keys each role should see in the sidebar / catalog.
const ROLE_MODULES: Record<AppRole, string[] | "*"> = {
  super_admin: "*",
  society_admin: "*",
  finance_head: ["ledger", "payments", "budget", "reports", "notifications", "documents"],
  maintenance_head: ["maintenance", "complaints", "vendors", "assets", "notifications", "documents"],
  security_head: ["gate", "visitor", "parking", "notifications", "documents"],
  resident: [
    "residents",
    "notifications",
    "documents",
    "ledger",
    "payments",
    "financial_transparency",
    "complaints",
    "visitor",
    "parking",
    "notice_board",
    "community_forum",
    "polls",
    "events",
    "amenities",
    "utility_meters",
  ],
  tenant: [
    "notifications",
    "documents",
    "ledger",
    "payments",
    "complaints",
    "visitor",
    "parking",
    "notice_board",
    "events",
    "amenities",
    "utility_meters",
  ],
  guard: ["gate", "visitor", "parking"],
  technician: ["maintenance"],
};

export function canAccessModule(role: AppRole | null, moduleKey: string): boolean {
  if (!role) return true; // no role yet = show all (safe fallback pre-load)
  const allowed = ROLE_MODULES[role];
  return allowed === "*" || allowed.includes(moduleKey);
}

export function roleLabel(role: AppRole | null): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "society_admin":
      return "Society Admin";
    case "finance_head":
      return "Finance Head";
    case "maintenance_head":
      return "Maintenance Head";
    case "security_head":
      return "Security Head";
    case "resident":
      return "Resident";
    case "tenant":
      return "Tenant";
    case "guard":
      return "Guard";
    case "technician":
      return "Technician";
    default:
      return "Member";
  }
}
