import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Lock,
  Search,
  Sparkles,
  Loader2,
  User,
  Building,
  Settings,
  Bell,
  Link2,
  Plus,
  Trash2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CATEGORY_ORDER, MODULES } from "@/lib/modules";
import { getFormsForModule } from "@/lib/forms-registry";
import { useAuth } from "@/hooks/use-auth";
import { updateProfileFn, changePasswordFn } from "@/lib/api/db-functions";
import { roleLabel } from "@/lib/role-access";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTenantUsersFn, assignUserRoleFn, removeUserRoleFn, getCustomRolesFn, createCustomRoleFn, deleteCustomRoleFn, createTenantUserFn, updateTenantUserFn, deleteTenantUserFn, updateCustomRoleFn, type CustomRole } from "@/lib/api/roles";
import {
  getRolePermissionsFn,
  updateRolePermissionsFn,
  PERMISSION_ROLES,
  PERMISSION_MODULES,
  type PermissionRole,
} from "@/lib/api/permissions";
import { SYSTEM_ROLES, TENANT_ASSIGNABLE_ROLES, getRoleLabel, type SystemRoleDef } from "@/lib/roles-constants";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

type RoleOption = {
  name: string;
  label: string;
  isCustom: boolean;
  /** Present only for custom roles */
  id?: string;
  /** Society name — shown in Super Admin all-societies mode to disambiguate
   *  custom roles that happen to share the same name across tenants. */
  societyLabel?: string;
};

/**
 * Build the role dropdown option list.
 *
 * @param customRoles    Tenant-scoped custom roles fetched from the server.
 * @param isSuperAdmin   When true, include platform-only roles (super_admin).
 *                       Society Admins must pass false so super_admin is
 *                       never visible in the tenant-level dialog.
 */
function getRoleOptions(
  customRoles: CustomRole[],
  isSuperAdmin: boolean,
): RoleOption[] {
  // Derive system options from the single canonical source.
  const systemOptions: RoleOption[] = (isSuperAdmin ? SYSTEM_ROLES : TENANT_ASSIGNABLE_ROLES).map(
    (role: SystemRoleDef) => ({
      name: role.name,
      label: role.label,
      isCustom: false,
    }),
  );

  const customOptions: RoleOption[] = customRoles.map((role) => ({
    name: role.name,
    label: role.label || role.name,
    isCustom: true,
    id: role.id,
    // Expose tenant_id for display — consumers can resolve the society name.
    societyLabel: role.tenant_id ?? undefined,
  }));

  return [...systemOptions, ...customOptions];
}

/** Returns the display label for a role name, checking custom roles first. */
function getRoleLabelFromOptions(role: string, customRoles: CustomRole[]): string {
  const custom = customRoles.find((item) => item.name === role);
  if (custom) return custom.label;
  return getRoleLabel(role);
}

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — HousingOS" },
      {
        name: "description",
        content: "Update your profile, activate modules and configure your society workspace.",
      },
    ],
  }),
  component: SettingsPage,
});

const DEFAULT_ENABLED = new Set(
  MODULES.filter((m) => m.plan === "Core" || m.plan === "Starter" || m.plan === "Growth").map(
    (m) => m.key,
  ),
);

function SettingsPage() {
  // ✅ STEP 1: ALL HOOKS AT THE TOP (before any conditional returns)
  const { user, profile, primaryRole, roles, refresh, session, loading } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<
    "profile" | "workspace" | "modules" | "notifications" | "integrations" | "users" | "permissions"
  >("profile");

  const isAdmin = roles.includes("super_admin") || roles.includes("society_admin");

  // All useState hooks MUST be at top
  const [enabled, setEnabled] = useState<Set<string>>(new Set(DEFAULT_ENABLED));
  const [q, setQ] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [societyName, setSocietyName] = useState("");
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Notification Preferences states
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [whatsappAlerts, setWhatsappAlerts] = useState(false);
  const [visitorNotify, setVisitorNotify] = useState(true);
  const [maintenanceNotify, setMaintenanceNotify] = useState(true);
  const [billReminders, setBillReminders] = useState(true);

  // Integration states
  const [stripeConnected, setStripeConnected] = useState(true);
  const [twilioConnected, setTwilioConnected] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);

  // All useEffect and useMemo hooks at top
  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
    setSocietyName(profile?.society_name ?? "");
  }, [profile]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return MODULES;
    return MODULES.filter(
      (m) => m.name.toLowerCase().includes(term) || m.description.toLowerCase().includes(term),
    );
  }, [q]);

  // ✅ STEP 2: Auth redirect logic in useEffect
  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/auth" });
    }
  }, [loading, session, navigate]);

  // Auto-redirect if non-admin tries to access admin-only tab
  useEffect(() => {
    const adminOnlyTabs = ["workspace", "modules", "integrations", "permissions", "users"];
    if (!isAdmin && adminOnlyTabs.includes(activeTab)) {
      setActiveTab("profile");
      toast.info("That section is admin-only. Showing your profile instead.");
    }
  }, [isAdmin, activeTab]);

  // ✅ STEP 3: Conditional renders AFTER all hooks
  if (loading) {
    return (
      <AppShell title="Loading">
        <div className="flex h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  // Don't render if not authenticated (useEffect will redirect)
  if (!session) return null;

  // Regular functions (not hooks) can be after conditional returns
  const toggle = (key: string) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateProfileFn({ data: { fullName, phone, societyName } });
      toast.success("Profile details updated successfully");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setChangingPassword(true);
    try {
      await changePasswordFn({ data: { currentPassword, newPassword } });
      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const totalEnabled = enabled.size;

  return (
    <AppShell title="Settings" subtitle="Profile & workspace settings configuration">
      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
        <header>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {roleLabel(primaryRole)}
          </div>
          <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            Settings
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {isAdmin
              ? "Configure your personal profile details, society preferences, active module keys, notifications and integration tokens."
              : "Manage your profile, notification preferences and account settings."
            }
          </p>
        </header>

        {/* Tab Navigation header */}
        <div className="flex gap-1 border-b overflow-x-auto whitespace-nowrap scrollbar-none">
          {(
            [
              { id: "profile", label: "Profile", icon: User, adminOnly: false },
              { id: "workspace", label: "Workspace", icon: Building, adminOnly: true },
              { id: "modules", label: "Modules", icon: Settings, adminOnly: true },
              { id: "notifications", label: "Notifications", icon: Bell, adminOnly: false },
              { id: "integrations", label: "Integrations", icon: Link2, adminOnly: true },
              { id: "permissions", label: "Role Permissions", icon: Lock, adminOnly: true },
              { id: "users", label: "Users & Roles", icon: User, adminOnly: true },
            ] as const
          ).filter((tab) => {
            // Show tab only if: not admin-only OR user is admin
            return !tab.adminOnly || isAdmin;
          }).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all flex items-center gap-2 -mb-[2px] ${activeTab === tab.id
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
              >
                <Icon className="size-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div className="space-y-6">
          {activeTab === "profile" && (
            <div className="space-y-6">
              <Card className="border-border/70 shadow-soft">
                <CardHeader>
                  <CardTitle className="text-base font-bold font-serif">Account Profile</CardTitle>
                  <CardDescription className="text-xs">
                    Manage public identity credentials linked with your portal login
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="full_name">Full Name</Label>
                      <Input
                        id="full_name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+92 300 1234567"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Account Login Email</Label>
                      <Input
                        value={user?.email ?? ""}
                        disabled
                        className="bg-muted text-muted-foreground"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-2 border-t mt-4">
                    <Button size="sm" onClick={saveProfile} disabled={saving} className="gap-2">
                      {saving && <Loader2 className="size-3.5 animate-spin" />} Save Profile
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 shadow-soft">
                <CardHeader>
                  <CardTitle className="text-base font-bold font-serif">Change Password</CardTitle>
                  <CardDescription className="text-xs">
                    Update your account security password
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="current_password">Current Password</Label>
                        <Input
                          id="current_password"
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="new_password">New Password</Label>
                        <Input
                          id="new_password"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          minLength={6}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="confirm_password">Confirm New Password</Label>
                        <Input
                          id="confirm_password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          minLength={6}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-2 border-t mt-4">
                      <Button type="submit" size="sm" disabled={changingPassword} className="gap-2">
                        {changingPassword && <Loader2 className="size-3.5 animate-spin" />} Update Password
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "workspace" && (
            <div className="space-y-6">
              <Card className="border-border/70 shadow-soft">
                <CardHeader>
                  <CardTitle className="text-base font-bold font-serif">
                    Workspace Details
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Configure information for this society tenant instance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="society_name">Society / Apartment Association Name</Label>
                    <Input
                      id="society_name"
                      value={societyName}
                      onChange={(e) => setSocietyName(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end pt-2 border-t mt-4">
                    <Button size="sm" onClick={saveProfile} disabled={saving} className="gap-2">
                      {saving && <Loader2 className="size-3.5 animate-spin" />} Save Workspace
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <section className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Modules Enabled" value={`${totalEnabled} / ${MODULES.length}`} />
                <StatCard
                  label="Current Plan"
                  value="Enterprise"
                  hint="SLA, RFC, Quotes & Recurrent passes active"
                />
                <StatCard
                  label="Society"
                  value={profile?.society_name ?? "—"}
                  hint={roleLabel(primaryRole)}
                />
              </section>
            </div>
          )}

          {activeTab === "modules" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                <div className="relative w-full max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search modules…"
                    className="h-10 pl-9"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.success("Module configuration updated")}
                >
                  Save Changes
                </Button>
              </div>

              <div className="space-y-8">
                {CATEGORY_ORDER.map((cat) => {
                  const items = filtered.filter((m) => m.category === cat);
                  if (items.length === 0) return null;
                  return (
                    <section key={cat}>
                      <div className="mb-3 flex items-center gap-3">
                        <span className="hairline flex-1" />
                        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {cat}
                        </h2>
                        <span className="hairline flex-1" />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {items.map((m) => {
                          const on = enabled.has(m.key);
                          const forms = getFormsForModule(m.key);
                          const locked = m.plan === "Enterprise";
                          return (
                            <Card key={m.key} className="border-border/70">
                              <CardContent className="flex items-start gap-3 p-4">
                                <div
                                  className={[
                                    "grid size-10 shrink-0 place-items-center rounded-md",
                                    on
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-surface text-muted-foreground",
                                  ].join(" ")}
                                >
                                  <m.icon className="size-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <div className="truncate font-serif text-sm font-bold">
                                      {m.name}
                                    </div>
                                    <Badge variant="outline" className="shrink-0 text-[9px]">
                                      {m.plan}
                                    </Badge>
                                    {m.category === "Intelligence" && (
                                      <Sparkles className="size-3 text-primary" />
                                    )}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {m.description}
                                  </div>
                                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                                    <Link to="/forms" className="hover:text-foreground">
                                      {forms.length} {forms.length === 1 ? "form" : "forms"}
                                    </Link>
                                    {on && (
                                      <span className="inline-flex items-center gap-1 text-success">
                                        <Check className="size-3" /> Active
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {locked ? (
                                  <Lock className="size-4 shrink-0 text-muted-foreground" />
                                ) : (
                                  <Switch checked={on} onCheckedChange={() => toggle(m.key)} />
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <Card className="border-border/70 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base font-bold font-serif">
                  Notification Dispatch Preferences
                </CardTitle>
                <CardDescription className="text-xs">
                  Adjust how and when you receive message alerts from the association portal
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="divide-y space-y-4">
                  <div className="flex items-center justify-between pt-3">
                    <div>
                      <Label className="text-sm font-bold">Email Alerts</Label>
                      <p className="text-xs text-muted-foreground">
                        Send daily digests of bills, notices and visitor reports to registered email
                      </p>
                    </div>
                    <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
                  </div>
                  <div className="flex items-center justify-between pt-3">
                    <div>
                      <Label className="text-sm font-bold">WhatsApp Direct Message Alerts</Label>
                      <p className="text-xs text-muted-foreground">
                        Receive real-time visitor alerts and security check notifications on
                        WhatsApp
                      </p>
                    </div>
                    <Switch checked={whatsappAlerts} onCheckedChange={setWhatsappAlerts} />
                  </div>
                  <div className="flex items-center justify-between pt-3">
                    <div>
                      <Label className="text-sm font-bold">Visitor Arrival Notifications</Label>
                      <p className="text-xs text-muted-foreground">
                        Pop up alerts in panel immediately when gatekeeper scans visitor pass code
                      </p>
                    </div>
                    <Switch checked={visitorNotify} onCheckedChange={setVisitorNotify} />
                  </div>
                  <div className="flex items-center justify-between pt-3">
                    <div>
                      <Label className="text-sm font-bold">Maintenance Ticket Updates</Label>
                      <p className="text-xs text-muted-foreground">
                        Notify when dispatched corrective work orders are started or completed by
                        vendors
                      </p>
                    </div>
                    <Switch checked={maintenanceNotify} onCheckedChange={setMaintenanceNotify} />
                  </div>
                  <div className="flex items-center justify-between pt-3">
                    <div>
                      <Label className="text-sm font-bold">Monthly Billing Reminders</Label>
                      <p className="text-xs text-muted-foreground">
                        Get alerted 5 days before utility or maintenance invoice is due
                      </p>
                    </div>
                    <Switch checked={billReminders} onCheckedChange={setBillReminders} />
                  </div>
                </div>
                <div className="flex justify-end pt-4 border-t mt-4">
                  <Button
                    size="sm"
                    onClick={() => {
                      toast.success("Notification preferences updated successfully");
                    }}
                  >
                    Save Preferences
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "permissions" && (
            <Card className="border-border/70 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base font-bold font-serif">Role Permissions</CardTitle>
                <CardDescription className="text-xs">
                  Configure module access rights for tenant roles.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RolePermissionsEditor />
              </CardContent>
            </Card>
          )}
          {activeTab === "users" && (
            <Card className="border-border/70 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base font-bold font-serif">Users & Roles</CardTitle>
                <CardDescription className="text-xs">Manage users and assign roles within this tenant.</CardDescription>
              </CardHeader>
              <CardContent>
                <UserRolesTable />
              </CardContent>
            </Card>
          )}
          {activeTab === "integrations" && (
            <Card className="border-border/70 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base font-bold font-serif">
                  Workspace Integrations
                </CardTitle>
                <CardDescription className="text-xs">
                  Connect external API services and gateways to expand capabilities
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="border">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">Stripe Payments</span>
                        <Badge
                          variant={stripeConnected ? "default" : "outline"}
                          className="text-[9px]"
                        >
                          {stripeConnected ? "Connected" : "Disconnected"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Process maintenance dues and booking fee collections online.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-[10px]"
                        onClick={() => setStripeConnected(!stripeConnected)}
                      >
                        {stripeConnected ? "Disconnect" : "Configure Stripe"}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">Twilio SMS Gateway</span>
                        <Badge
                          variant={twilioConnected ? "default" : "outline"}
                          className="text-[9px]"
                        >
                          {twilioConnected ? "Connected" : "Disconnected"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Send auto verification OTPs and notification SMS alerts to residents.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-[10px]"
                        onClick={() => setTwilioConnected(!twilioConnected)}
                      >
                        {twilioConnected ? "Disconnect" : "Configure Twilio"}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">Slack Webhooks</span>
                        <Badge
                          variant={slackConnected ? "default" : "outline"}
                          className="text-[9px]"
                        >
                          {slackConnected ? "Connected" : "Disconnected"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Relay visitor notifications or emergency alarms directly to a Slack channel.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-[10px]"
                        onClick={() => setSlackConnected(!slackConnected)}
                      >
                        {slackConnected ? "Disconnect" : "Configure Webhook"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

/* Users & Roles components */
interface TenantUser { id: string; full_name: string; email: string; roles: string[] }

function UserRolesTable() {
  const queryClient = useQueryClient();
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");
  const [searchTerm, setSearchTerm] = useState("");
  const { data: users = [], isLoading, error } = useQuery<TenantUser[], Error>({ queryKey: ["tenant-users"], queryFn: getTenantUsersFn });
  const { data: customRoles = [] } = useQuery<CustomRole[], Error>({ queryKey: ["custom-roles"], queryFn: getCustomRolesFn });

  // Pagination state
  const USERS_PER_PAGE = 10;
  const [userPage, setUserPage] = useState(1);

  // Reset page on search term change
  useEffect(() => {
    setUserPage(1);
  }, [searchTerm]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      user.full_name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term),
    );
  }, [searchTerm, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const paginatedUsers = useMemo(() => {
    return filteredUsers.slice((userPage - 1) * USERS_PER_PAGE, userPage * USERS_PER_PAGE);
  }, [filteredUsers, userPage]);

  function getPageNumbers(current: number, total: number): (number | "…")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1];
    if (current > 3) pages.push("…");
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push("…");
    pages.push(total);
    return pages;
  }

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading users...</div>;
  if (error) return <div className="py-8 text-center text-sm text-destructive">Error: {error?.message ?? "Failed to load users"}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users…"
            className="h-10 pl-10"
          />
        </div>
        <AddUserDialog
          customRoles={customRoles}
          isSuperAdmin={isSuperAdmin}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["tenant-users"] })}
        />
      </div>

      {filteredUsers.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No users match your search.</div>
      ) : (
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="text-right">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.full_name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    {u.roles.map((r) => (
                      <Badge key={r} variant="secondary" className="mr-1 capitalize">
                        {getRoleLabelFromOptions(r, customRoles)}
                      </Badge>
                    ))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <EditUserDialog
                        user={u}
                        customRoles={customRoles}
                        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["tenant-users"] })}
                      />
                      <DeleteUserDialog
                        user={u}
                        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["tenant-users"] })}
                        disabled={u.roles.includes("super_admin")}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4">
              <span className="text-xs text-muted-foreground">
                Showing {paginatedUsers.length} of {filteredUsers.length} users &mdash; page {userPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                  disabled={userPage === 1}
                  className="h-8 px-3 text-[11px]"
                >
                  ← Prev
                </Button>
                {getPageNumbers(userPage, totalPages).map((pg, idx) =>
                  pg === "…" ? (
                    <span key={`dots-${idx}`} className="px-2 text-muted-foreground text-xs select-none">
                      …
                    </span>
                  ) : (
                    <Button
                      key={`page-${pg}`}
                      variant={userPage === pg ? "default" : "outline"}
                      size="sm"
                      onClick={() => setUserPage(pg as number)}
                      className={`h-8 w-8 p-0 text-[11px] ${
                        userPage === pg
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "hover:bg-muted"
                      }`}
                    >
                      {pg}
                    </Button>
                  )
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUserPage((p) => Math.min(totalPages, p + 1))}
                  disabled={userPage === totalPages}
                  className="h-8 px-3 text-[11px]"
                >
                  Next →
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddUserDialog({ customRoles, isSuperAdmin, onSuccess }: { customRoles: CustomRole[]; isSuperAdmin: boolean; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [showCredentials, setShowCredentials] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  // Super Admin sees ALL system roles (including platform-only super_admin).
  // Society Admin sees only tenant-assignable roles — super_admin is hidden.
  const roleOptions = useMemo(() => getRoleOptions(customRoles, isSuperAdmin), [customRoles, isSuperAdmin]);

  useEffect(() => {
    if (!open) {
      setShowCredentials(false);
      setCreatedCredentials(null);
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: createTenantUserFn,
    onSuccess: () => {
      toast.success("User created successfully");
      setCreatedCredentials({ email, password });
      setFullName("");
      setEmail("");
      setPassword("");
      setSelectedRole("");
      setShowCredentials(true);
      onSuccess();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    },
  });

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
    let generated = "";
    for (let i = 0; i < 10; i += 1) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
  };

  const handleCreate = () => {
    if (!fullName || !email || !password || !selectedRole) return;
    createMutation.mutate({ data: { fullName: fullName.trim(), email: email.trim(), password, role: selectedRole } });
  };

  const handleCopy = async () => {
    const text = createdCredentials ? `${createdCredentials.email} / ${createdCredentials.password}` : `${email} / ${password}`;
    if (!text) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success("Credentials copied to clipboard");
    } catch {
      toast.error("Failed to copy credentials");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm" className="gap-2">
            <Plus className="size-4" /> Add User
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Tenant User</DialogTitle>
            <DialogDescription>Create a new user and assign a role to them.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="user_full_name">Full Name</Label>
                <Input id="user_full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user_email">Email</Label>
                <Input id="user_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-end">
              <div className="space-y-1.5">
                <Label htmlFor="user_password">Password</Label>
                <Input id="user_password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Button variant="outline" onClick={generatePassword} className="w-full">
                  Generate Password
                </Button>
                <Button variant="outline" onClick={handleCopy} className="w-full" disabled={!password || !email}>
                  <Copy className="size-4" /> Copy
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user_role">Assign Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role.name} value={role.name}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {showCredentials && createdCredentials ? (
            <div className="rounded-lg border border-muted/20 bg-muted/10 p-4 text-sm">
              <div className="font-semibold">User created!</div>
              <p className="mt-1">Email: {createdCredentials.email}</p>
              <p className="mt-1">Password: {createdCredentials.password}</p>
              <Button variant="outline" size="sm" onClick={handleCopy} className="mt-3 gap-2">
                <Copy className="size-4" /> Copy credentials
              </Button>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending || !fullName || !email || !selectedRole}>
              {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditUserDialog({ user, customRoles, onSuccess }: { user: TenantUser; customRoles: CustomRole[]; onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(user.full_name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [userRoles, setUserRoles] = useState<string[]>(user.roles);

  useEffect(() => {
    setFullName(user.full_name);
    setEmail(user.email);
    setPassword("");
    setUserRoles(user.roles);
    setSelectedRole("");
  }, [user]);

  // EditUserDialog is only accessible to admins. Super Admin can assign
  // platform-only roles here; society_admins cannot assign super_admin.
  const { roles: authRoles } = useAuth();
  const canAssignSuperAdmin = authRoles.includes("super_admin");

  const allRoles = useMemo(
    () => getRoleOptions(customRoles, canAssignSuperAdmin),
    [customRoles, canAssignSuperAdmin],
  );

  const availableRoles = useMemo(
    () => allRoles.filter((role) => !userRoles.includes(role.name)),
    [allRoles, userRoles],
  );

  const updateMutation = useMutation<unknown, Error, { data: { userId: string; fullName: string; email: string; password?: string } }>({
    mutationFn: updateTenantUserFn,
    onSuccess: () => {
      toast.success("User updated successfully");
      setOpen(false);
      onSuccess();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    },
  });

  const assignMutation = useMutation({
    mutationFn: assignUserRoleFn,
    onSuccess: (_, variables) => {
      const roleToAdd = variables?.data?.role;
      toast.success("Role assigned successfully");
      setSelectedRole("");
      if (roleToAdd) {
        setUserRoles((prev) => [...prev, roleToAdd]);
      }
      queryClient.invalidateQueries({ queryKey: ["tenant-users"] });
      onSuccess();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to assign role");
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeUserRoleFn,
    onSuccess: (_, variables) => {
      toast.success("Role removed successfully");
      setUserRoles((prev) => prev.filter((role) => role !== variables.data.role));
      queryClient.invalidateQueries({ queryKey: ["tenant-users"] });
      onSuccess();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to remove role");
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      data: {
        userId: user.id,
        fullName: fullName.trim(),
        email: email.trim(),
        password: password.trim() || undefined,
      },
    });
  };

  const handleAssignRole = () => {
    if (!selectedRole) return;
    assignMutation.mutate({ data: { userId: user.id, role: selectedRole } });
  };

  const handleRemoveRole = (role: string) => {
    if (userRoles.length <= 1) {
      toast.error("Users must retain at least one role");
      return;
    }
    removeMutation.mutate({ data: { userId: user.id, role } });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Edit</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>Update user details, assign roles, and optionally reset the password.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`edit_user_full_name_${user.id}`}>Full Name</Label>
              <Input id={`edit_user_full_name_${user.id}`} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`edit_user_email_${user.id}`}>Email</Label>
              <Input id={`edit_user_email_${user.id}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`edit_user_password_${user.id}`}>Reset Password</Label>
            <Input
              id={`edit_user_password_${user.id}`}
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
            />
          </div>
          <div className="space-y-4 rounded-lg border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-semibold">Roles</Label>
                <p className="text-xs text-muted-foreground">Assign or remove roles for this user.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {userRoles.map((role) => (
                <Badge key={role} variant="secondary" className="capitalize flex items-center gap-2">
                  {getRoleLabelFromOptions(role, customRoles)}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    disabled={removeMutation.isPending || userRoles.length <= 1 || role === "super_admin"}
                    onClick={() => handleRemoveRole(role)}
                  >
                    ×
                  </Button>
                </Badge>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role to add" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role.name} value={role.name}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAssignRole} disabled={!selectedRole || assignMutation.isPending}>
                {assignMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Add Role"}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending || !fullName || !email}>
            {updateMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({ user, onSuccess, disabled }: { user: TenantUser; onSuccess: () => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const deleteMutation = useMutation<unknown, Error, { data: { userId: string } }>({
    mutationFn: deleteTenantUserFn,
    onSuccess: () => {
      toast.success("User deleted successfully");
      setOpen(false);
      onSuccess();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={disabled} className="gap-2">
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete User</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {user.full_name}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => deleteMutation.mutate({ data: { userId: user.id } })}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditCustomRoleDialog({ role, onSuccess }: { role: CustomRole; onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(role.name);
  const [permissions, setPermissions] = useState<RolePermissionRow[]>(
    buildBlankPermissionRows(),
  );

  const { data: rolePermissions, isFetching } = useQuery<RolePermissionResponse[], Error>({
    queryKey: ["role-permissions", role.name, role.tenant_id],
    queryFn: async () => {
      return await getRolePermissionsFn({ data: { role: role.name, tenantId: role.tenant_id } });
    },
    enabled: open,
  });

  useEffect(() => {
    setName(role.name);
  }, [role]);

  useEffect(() => {
    if (rolePermissions) {
      const merged = ALL_PERMISSION_MODULES.map((module) => {
        const saved = rolePermissions.find((row) => row.module_key === module.key);
        return {
          module_key: module.key,
          label: module.label,
          can_view: saved?.can_view ?? false,
          can_create: saved?.can_create ?? false,
          can_edit: saved?.can_edit ?? false,
          can_delete: saved?.can_delete ?? false,
        };
      });
      setPermissions(merged);
    }
  }, [rolePermissions]);

  const togglePermission = (moduleKey: RolePermissionModuleKey, field: PermissionField) => {
    setPermissions((prev) => togglePermissionField(prev, moduleKey, field));
  };

  const toggleAllPermissions = (field: PermissionField) => {
    setPermissions((prev) => togglePermissionColumn(prev, field));
  };

  const updateMutation = useMutation({
    mutationFn: async (values: { roleId: string; name: string; permissions: RolePermissionRow[] }) => {
      await updateCustomRoleFn({ data: { roleId: values.roleId, name: values.name } });
      await updateRolePermissionsFn({ data: { role: values.name, permissions: values.permissions, tenantId: role.tenant_id } });
    },
    onSuccess: () => {
      toast.success("Role and permissions updated successfully");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      onSuccess();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      roleId: role.id,
      name: name.trim(),
      permissions,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Edit</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Edit Custom Role</DialogTitle>
          <DialogDescription>Update the role name and permissions</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto pr-2 max-h-[calc(80vh-220px)]">
          <div className="space-y-1.5">
            <Label htmlFor={`edit_role_name_${role.id}`}>Role Name</Label>
            <Input id={`edit_role_name_${role.id}`} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="font-semibold">Permissions</div>
              <Button variant="outline" size="sm" onClick={() => setPermissions(buildBlankPermissionRows())}>
                Clear All
              </Button>
            </div>
            {isFetching ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Loader2 className="inline-block size-4 animate-spin" /> Loading permissions...
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-muted/10 text-left text-[11px] uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Module</th>
                      <th className="w-16 px-4 py-3 text-center font-semibold">All</th>
                      <th className="w-16 px-4 py-3 text-center font-semibold">View</th>
                      <th className="w-16 px-4 py-3 text-center font-semibold">Create</th>
                      <th className="w-16 px-4 py-3 text-center font-semibold">Edit</th>
                      <th className="w-16 px-4 py-3 text-center font-semibold">Delete</th>
                    </tr>
                    <tr className="bg-muted/5 text-left text-[11px] uppercase text-muted-foreground">
                      <th className="px-4 py-3 font-semibold">All Modules</th>
                      <th className="w-16 px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={permissions.every(hasFullRowAccess)}
                            onCheckedChange={() => setPermissions((prev) => toggleEveryPermission(prev))}
                          />
                        </div>
                      </th>
                      {PERMISSION_FIELDS.map((field) => (
                        <th key={field} className="w-16 px-4 py-3 text-center">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={permissions.every((row) => row[field])}
                              onCheckedChange={() => toggleAllPermissions(field)}
                            />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {permissions.map((permission) => (
                      <tr
                        key={permission.module_key}
                        className={`border-t border-border/60 ${hasFullRowAccess(permission) ? "bg-primary/5" : ""}`}
                      >
                        <td className="px-4 py-3 font-medium">{permission.label}</td>
                        <td className="w-16 px-4 py-3 text-center">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={hasFullRowAccess(permission)}
                              onCheckedChange={() => setPermissions((prev) => togglePermissionRow(prev, permission.module_key))}
                            />
                          </div>
                        </td>
                        {PERMISSION_FIELDS.map((field) => (
                          <td key={field} className="w-16 px-4 py-3 text-center">
                            <div className="flex justify-center">
                              <Checkbox
                                checked={permission[field]}
                                onCheckedChange={() => togglePermission(permission.module_key, field)}
                              />
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border/70">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending || !name.trim()}>
            {updateMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCustomRoleButton({ role, onSuccess }: { role: CustomRole; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const deleteMutation = useMutation<unknown, Error, { data: { roleId: string } }>({
    mutationFn: deleteCustomRoleFn,
    onSuccess: () => {
      toast.success("Role deleted successfully");
      setOpen(false);
      onSuccess();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete role");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">Delete</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Role</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {role.label}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => deleteMutation.mutate({ data: { roleId: role.id } })}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleCreateDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (open: boolean) => void; onCreate: (values: { name: string; label: string; permissions: RolePermissionRow[] }) => void }) {
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [permissions, setPermissions] = useState<RolePermissionRow[]>(
    buildBlankPermissionRows(),
  );

  useEffect(() => {
    if (!open) {
      setName("");
      setLabel("");
      setPermissions(
        buildBlankPermissionRows(),
      );
    }
  }, [open]);

  const togglePermission = (moduleKey: RolePermissionModuleKey, field: PermissionField) => {
    setPermissions((prev) => togglePermissionField(prev, moduleKey, field));
  };

  const toggleAllPermissions = (field: PermissionField) => {
    setPermissions((prev) => togglePermissionColumn(prev, field));
  };

  const handleSubmit = () => {
    if (!name || !label) return;
    onCreate({ name: name.trim(), label: label.trim(), permissions });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Create New Role</DialogTitle>
          <DialogDescription>Define a custom role with initial permissions.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto pr-2 max-h-[calc(80vh-220px)]">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="custom_role_name">Role Name</Label>
              <Input id="custom_role_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="security_officer" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="custom_role_label">Role Label</Label>
              <Input id="custom_role_label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Security Officer" />
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="font-semibold">Initial Permissions</div>
              <Button variant="outline" size="sm" onClick={() => setPermissions(buildBlankPermissionRows())}>
                Clear All
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-muted/10 text-left text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Module</th>
                    <th className="w-16 px-4 py-3 text-center font-semibold">All</th>
                    <th className="w-16 px-4 py-3 text-center font-semibold">View</th>
                    <th className="w-16 px-4 py-3 text-center font-semibold">Create</th>
                    <th className="w-16 px-4 py-3 text-center font-semibold">Edit</th>
                    <th className="w-16 px-4 py-3 text-center font-semibold">Delete</th>
                  </tr>
                  <tr className="bg-muted/5 text-left text-[11px] uppercase text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">All Modules</th>
                    <th className="w-16 px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={permissions.every(hasFullRowAccess)}
                          onCheckedChange={() => setPermissions((prev) => toggleEveryPermission(prev))}
                        />
                      </div>
                    </th>
                    {PERMISSION_FIELDS.map((field) => (
                      <th key={field} className="w-16 px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={permissions.every((row) => row[field])}
                            onCheckedChange={() => toggleAllPermissions(field)}
                          />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((permission) => (
                    <tr
                      key={permission.module_key}
                      className={`border-t border-border/60 ${hasFullRowAccess(permission) ? "bg-primary/5" : ""}`}
                    >
                      <td className="px-4 py-3 font-medium">{permission.label}</td>
                      <td className="w-16 px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={hasFullRowAccess(permission)}
                            onCheckedChange={() => setPermissions((prev) => togglePermissionRow(prev, permission.module_key))}
                          />
                        </div>
                      </td>
                      {PERMISSION_FIELDS.map((field) => (
                        <td key={field} className="w-16 px-4 py-3 text-center">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={permission[field]}
                              onCheckedChange={() => togglePermission(permission.module_key, field)}
                            />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <DialogFooter className="sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border/70">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name || !label}>Create Role</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



/**
 * Re-use the single canonical list from permissions.ts — do NOT duplicate it here.
 * Previously this file had its own ALL_PERMISSION_MODULES constant; it has been
 * removed and replaced with a local alias that points to the imported source.
 */
const ALL_PERMISSION_MODULES = PERMISSION_MODULES;

type RolePermissionModuleKey = (typeof PERMISSION_MODULES)[number]["key"];

type RolePermissionRow = {
  module_key: RolePermissionModuleKey;
  label: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

const PERMISSION_FIELDS = ["can_view", "can_create", "can_edit", "can_delete"] as const;
type PermissionField = (typeof PERMISSION_FIELDS)[number];

function buildBlankPermissionRows(): RolePermissionRow[] {
  return ALL_PERMISSION_MODULES.map((module) => ({
    module_key: module.key,
    label: module.label,
    can_view: false,
    can_create: false,
    can_edit: false,
    can_delete: false,
  }));
}

function hasFullRowAccess(row: RolePermissionRow) {
  return PERMISSION_FIELDS.every((field) => row[field]);
}

function togglePermissionField(rows: RolePermissionRow[], moduleKey: RolePermissionModuleKey, field: PermissionField) {
  return rows.map((row) => {
    if (row.module_key !== moduleKey) return row;
    const nextValue = !row[field];
    const updated = { ...row, [field]: nextValue };

    if (field === "can_view" && !nextValue) {
      updated.can_create = false;
      updated.can_edit = false;
      updated.can_delete = false;
    } else if ((field === "can_create" || field === "can_edit" || field === "can_delete") && nextValue) {
      updated.can_view = true;
    }
    return updated;
  });
}

function togglePermissionRow(rows: RolePermissionRow[], moduleKey: RolePermissionModuleKey) {
  return rows.map((row) => {
    if (row.module_key !== moduleKey) return row;
    const nextValue = !hasFullRowAccess(row);
    return PERMISSION_FIELDS.reduce((next, field) => ({ ...next, [field]: nextValue }), row);
  });
}

function togglePermissionColumn(rows: RolePermissionRow[], field: PermissionField) {
  const nextValue = !rows.every((row) => row[field]);
  return rows.map((row) => {
    const updated = { ...row, [field]: nextValue };
    if (field === "can_view" && !nextValue) {
      updated.can_create = false;
      updated.can_edit = false;
      updated.can_delete = false;
    } else if ((field === "can_create" || field === "can_edit" || field === "can_delete") && nextValue) {
      updated.can_view = true;
    }
    return updated;
  });
}

function toggleEveryPermission(rows: RolePermissionRow[]) {
  const nextValue = !rows.every(hasFullRowAccess);
  return rows.map((row) =>
    PERMISSION_FIELDS.reduce((next, field) => ({ ...next, [field]: nextValue }), row),
  );
}

type RolePermissionResponse = {
  module_key: RolePermissionModuleKey;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

function RolePermissionsEditor() {
  const queryClient = useQueryClient();
  const { roles: authRoles } = useAuth();
  // The permissions editor is admin-only. Super Admin should see all roles
  // (including super_admin) so they can inspect/document platform-level access.
  const isSuperAdmin = authRoles.includes("super_admin");
  const [selectedRole, setSelectedRole] = useState<PermissionRole>("society_admin");
  const [permissions, setPermissions] = useState<RolePermissionRow[]>(
    buildBlankPermissionRows(),
  );
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);

  const { data: customRoles = [] } = useQuery<CustomRole[], Error>({
    queryKey: ["custom-roles"],
    queryFn: getCustomRolesFn,
  });

  const roleOptions = useMemo(() => getRoleOptions(customRoles, isSuperAdmin), [customRoles, isSuperAdmin]);
  const selectedRoleOption = roleOptions.find((role) => role.name === selectedRole);
  const isCustomRole = customRoles.some((role) => role.name === selectedRole);

  const createRoleMutation = useMutation({
    mutationFn: async (values: { name: string; label: string; permissions: RolePermissionRow[] }) => {
      const role = await createCustomRoleFn({
        data: { name: values.name, label: values.label, description: undefined },
      });
      if (values.permissions.some((permission) => PERMISSION_FIELDS.some((field) => permission[field]))) {
        await updateRolePermissionsFn({ data: { role: role.name, permissions: values.permissions } });
      }
      return role;
    },
    onSuccess: (data: CustomRole) => {
      toast.success(`Role ${data.label} created`);
      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions", data.name] });
      setSelectedRole(data.name);
      setRoleDialogOpen(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create role");
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: deleteCustomRoleFn,
    onSuccess: () => {
      toast.success("Role deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      if (selectedRoleOption?.isCustom) {
        setSelectedRole("society_admin");
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete role");
    },
  });

  const mergePermissions = (rows: Array<{ module_key: RolePermissionModuleKey; can_view: any; can_create: any; can_edit: any; can_delete: any }>) => {
    return ALL_PERMISSION_MODULES.map((module) => {
      const saved = rows.find((row) => row.module_key === module.key);
      return {
        module_key: module.key,
        label: module.label,
        can_view: saved ? Boolean(saved.can_view) : false,
        can_create: saved ? Boolean(saved.can_create) : false,
        can_edit: saved ? Boolean(saved.can_edit) : false,
        can_delete: saved ? Boolean(saved.can_delete) : false,
      };
    });
  };

  const togglePermission = (moduleKey: RolePermissionModuleKey, field: PermissionField) => {
    setPermissions((prev) => togglePermissionField(prev, moduleKey, field));
  };

  const toggleAllPermissions = (field: PermissionField) => {
    setPermissions((prev) => togglePermissionColumn(prev, field));
  };

  const { data: rolePermissions, isFetching, error } = useQuery<RolePermissionResponse[], Error>({
    queryKey: ["role-permissions", selectedRole],
    queryFn: async () => {
      return await getRolePermissionsFn({ data: { role: selectedRole } });
    },
    enabled: Boolean(selectedRole),
  });

  useEffect(() => {
    if (rolePermissions) {
      setPermissions(mergePermissions(rolePermissions));
    } else {
      setPermissions(buildBlankPermissionRows());
    }
  }, [selectedRole, rolePermissions]);

  const saveMutation = useMutation({
    mutationFn: updateRolePermissionsFn,
    onSuccess: () => {
      toast.success(`Permissions updated for ${selectedRoleOption?.label ?? getRoleLabelFromOptions(selectedRole, customRoles)}`);
      queryClient.invalidateQueries({ queryKey: ["role-permissions", selectedRole] });
    },
  });

  const isDirty = useMemo(() => {
    if (!rolePermissions) return false;
    const initial = mergePermissions(rolePermissions);
    return JSON.stringify(permissions) !== JSON.stringify(initial);
  }, [permissions, rolePermissions]);

  // Pagination for permissions
  const [permPage, setPermPage] = useState(1);
  const MODULES_PER_PAGE = 8;
  const totalPermPages = Math.max(1, Math.ceil(permissions.length / MODULES_PER_PAGE));
  const paginatedPermissions = useMemo(() => {
    return permissions.slice((permPage - 1) * MODULES_PER_PAGE, permPage * MODULES_PER_PAGE);
  }, [permissions, permPage]);

  // Pagination for custom roles
  const [rolesPage, setRolesPage] = useState(1);
  const ROLES_PER_PAGE = 5;
  const totalRolesPages = Math.max(1, Math.ceil(customRoles.length / ROLES_PER_PAGE));
  const paginatedCustomRoles = useMemo(() => {
    return customRoles.slice((rolesPage - 1) * ROLES_PER_PAGE, rolesPage * ROLES_PER_PAGE);
  }, [customRoles, rolesPage]);

  // Reset page when role changes
  useEffect(() => {
    setPermPage(1);
  }, [selectedRole]);

  function getPageNumbers(current: number, total: number): (number | "…")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1];
    if (current > 3) pages.push("…");
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push("…");
    pages.push(total);
    return pages;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] items-end">
        <div className="grid gap-2">
          <Label>Select role</Label>
          <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as PermissionRole)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((role) => (
                <SelectItem key={role.name} value={role.name}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-3 justify-end">
          {isDirty && (
            <span className="text-xs text-amber-600 font-semibold animate-pulse mr-1">
              Unsaved changes
            </span>
          )}
          <Button variant="outline" onClick={() => setRoleDialogOpen(true)} className="gap-2">
            <Plus className="size-4" /> Create New Role
          </Button>
          {isCustomRole && selectedRoleOption?.id ? (
            <Button
              variant="destructive"
              onClick={() => deleteRoleMutation.mutate({ data: { roleId: selectedRoleOption.id! } })}
              disabled={deleteRoleMutation.isPending}
              className="gap-2"
            >
              <Trash2 className="size-4" /> Delete Role
            </Button>
          ) : null}
          <Button
            onClick={() => saveMutation.mutate({ data: { role: selectedRole, permissions } })}
            disabled={saveMutation.isPending || isFetching}
          >
            {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save Permissions"}
          </Button>
        </div>
      </div>

      <RoleCreateDialog
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        onCreate={(values) => {
          createRoleMutation.mutate(values);
        }}
      />

      {error ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load permissions: {error.message}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-muted/10 text-left text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Module</th>
                <th className="w-16 px-4 py-3 text-center font-semibold">All</th>
                <th className="w-16 px-4 py-3 text-center font-semibold">View</th>
                <th className="w-16 px-4 py-3 text-center font-semibold">Create</th>
                <th className="w-16 px-4 py-3 text-center font-semibold">Edit</th>
                <th className="w-16 px-4 py-3 text-center font-semibold">Delete</th>
              </tr>
              <tr className="bg-muted/5 text-left text-[11px] uppercase text-muted-foreground">
                <th className="px-4 py-3 font-semibold">All Modules</th>
                <th className="w-16 px-4 py-3 text-center">
                  <div className="flex justify-center">
                    <Checkbox
                      checked={permissions.every(hasFullRowAccess)}
                      onCheckedChange={() => setPermissions((prev) => toggleEveryPermission(prev))}
                    />
                  </div>
                </th>
                {PERMISSION_FIELDS.map((field) => (
                  <th key={field} className="w-16 px-4 py-3 text-center">
                    <div className="flex justify-center">
                      <Checkbox
                        checked={permissions.every((row) => row[field])}
                        onCheckedChange={() => toggleAllPermissions(field)}
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedPermissions.map((permission) => (
                <tr
                  key={permission.module_key}
                  className={`border-t border-border/60 ${hasFullRowAccess(permission) ? "bg-primary/5" : ""}`}
                >
                  <td className="px-4 py-3 font-medium">{permission.label}</td>
                  <td className="w-16 px-4 py-3 text-center">
                    <div className="flex justify-center">
                      <Checkbox
                        checked={hasFullRowAccess(permission)}
                        onCheckedChange={() => setPermissions((prev) => togglePermissionRow(prev, permission.module_key))}
                      />
                    </div>
                  </td>
                  {PERMISSION_FIELDS.map((field) => (
                    <td key={field} className="w-16 px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={permission[field]}
                          onCheckedChange={() => togglePermission(permission.module_key, field)}
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Permissions Table Pagination Controls */}
        {totalPermPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4">
            <span className="text-xs text-muted-foreground">
              Showing {paginatedPermissions.length} of {permissions.length} modules &mdash; page {permPage} of {totalPermPages}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPermPage((p) => Math.max(1, p - 1))}
                disabled={permPage === 1}
                className="h-8 px-3 text-[11px]"
              >
                ← Prev
              </Button>
              {getPageNumbers(permPage, totalPermPages).map((pg, idx) =>
                pg === "…" ? (
                  <span key={`perm-dots-${idx}`} className="px-2 text-muted-foreground text-xs select-none">
                    …
                  </span>
                ) : (
                  <Button
                    key={`perm-page-${pg}`}
                    variant={permPage === pg ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPermPage(pg as number)}
                    className={`h-8 w-8 p-0 text-[11px] ${
                      permPage === pg
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "hover:bg-muted"
                    }`}
                  >
                    {pg}
                  </Button>
                )
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPermPage((p) => Math.min(totalPermPages, p + 1))}
                disabled={permPage === totalPermPages}
                className="h-8 px-3 text-[11px]"
              >
                Next →
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-background">
        <div className="flex flex-col gap-1 px-4 py-4 border-b border-border/70">
          <div className="text-sm font-semibold">Custom Roles</div>
          <div className="text-sm text-muted-foreground">Manage tenant custom roles and descriptions.</div>
        </div>
        {customRoles.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No custom roles created yet.</div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-muted/10 text-left text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Role Name</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCustomRoles.map((role) => (
                    <tr key={role.id} className="border-t border-border/60">
                      <td className="px-4 py-3">{role.label}</td>
                      <td className="px-4 py-3 text-muted-foreground">{role.description || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <EditCustomRoleDialog
                            role={role}
                            onSuccess={() => queryClient.invalidateQueries({ queryKey: ["custom-roles"] })}
                          />
                          <DeleteCustomRoleButton
                            role={role}
                            onSuccess={() => queryClient.invalidateQueries({ queryKey: ["custom-roles"] })}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Custom Roles Table Pagination Controls */}
            {totalRolesPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4 px-4 pb-4">
                <span className="text-xs text-muted-foreground">
                  Showing {paginatedCustomRoles.length} of {customRoles.length} roles &mdash; page {rolesPage} of {totalRolesPages}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRolesPage((p) => Math.max(1, p - 1))}
                    disabled={rolesPage === 1}
                    className="h-8 px-3 text-[11px]"
                  >
                    ← Prev
                  </Button>
                  {getPageNumbers(rolesPage, totalRolesPages).map((pg, idx) =>
                    pg === "…" ? (
                      <span key={`roles-dots-${idx}`} className="px-2 text-muted-foreground text-xs select-none">
                        …
                      </span>
                    ) : (
                      <Button
                        key={`roles-page-${pg}`}
                        variant={rolesPage === pg ? "default" : "outline"}
                        size="sm"
                        onClick={() => setRolesPage(pg as number)}
                        className={`h-8 w-8 p-0 text-[11px] ${
                          rolesPage === pg
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "hover:bg-muted"
                        }`}
                      >
                        {pg}
                      </Button>
                    )
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRolesPage((p) => Math.min(totalRolesPages, p + 1))}
                    disabled={rolesPage === totalRolesPages}
                    className="h-8 px-3 text-[11px]"
                  >
                    Next →
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="border-border/70">
      <CardContent className="p-5">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
        <div className="mt-2 font-serif text-2xl font-bold tracking-tight">{value}</div>
        {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}









