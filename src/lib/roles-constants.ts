export type SystemRoleName =
  | "super_admin"
  | "society_admin"
  | "finance_head"
  | "maintenance_head"
  | "security_head"
  | "resident"
  | "tenant"
  | "guard"
  | "technician";

export interface SystemRoleDef {
  name: SystemRoleName;
  label: string;
  platformOnly: boolean;
}

export const SYSTEM_ROLES: readonly SystemRoleDef[] = [
  { name: "super_admin",      label: "Super Admin",       platformOnly: true  },
  { name: "society_admin",    label: "Society Admin",     platformOnly: false },
  { name: "finance_head",     label: "Finance Head",      platformOnly: false },
  { name: "maintenance_head", label: "Maintenance Head",  platformOnly: false },
  { name: "security_head",    label: "Security Head",     platformOnly: false },
  { name: "resident",         label: "Resident",          platformOnly: false },
  { name: "tenant",           label: "Tenant",            platformOnly: false },
  { name: "guard",            label: "Guard",             platformOnly: false },
  { name: "technician",       label: "Technician",        platformOnly: false },
] as const;

export const SYSTEM_ROLE_NAMES: readonly SystemRoleName[] = SYSTEM_ROLES.map(
  (r) => r.name,
);

export const TENANT_ASSIGNABLE_ROLES: readonly SystemRoleDef[] =
  SYSTEM_ROLES.filter((r) => !r.platformOnly);

export function getRoleLabel(roleName: string): string {
  const found = SYSTEM_ROLES.find((r) => r.name === roleName);
  if (found) return found.label;
  return roleName
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
