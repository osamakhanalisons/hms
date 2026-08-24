import type { ModuleDef } from "./modules";
import { MODULES } from "./modules";

export type FieldType =
  | "text"
  | "email"
  | "password"
  | "tel"
  | "number"
  | "currency"
  | "textarea"
  | "select"
  | "multiselect"
  | "date"
  | "time"
  | "datetime"
  | "switch"
  | "checkbox"
  | "radio"
  | "file"
  | "color";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  help?: string;
  options?: { value: string; label: string }[];
  span?: 1 | 2; // grid span out of 2
  prefix?: string;
  suffix?: string;
  rows?: number;
  defaultValue?: string | boolean;
}

export interface SectionDef {
  title: string;
  description?: string;
  fields: FieldDef[];
}

export interface FormDef {
  key: string;
  title: string;
  description: string;
  submitLabel?: string;
  /** Force wizard/stepper UI. When unset, wizard auto-enables for forms with 3+ sections. */
  wizard?: boolean;
  sections: SectionDef[];
}

const F = (
  name: string,
  label: string,
  type: FieldType,
  extra: Partial<FieldDef> = {},
): FieldDef => ({ name, label, type, ...extra });

const sec = (title: string, fields: FieldDef[], description?: string): SectionDef => ({
  title,
  description,
  fields,
});

const REGISTRY: Record<string, FormDef[]> = {
  platform: [
    {
      key: "login",
      title: "Sign in",
      description: "Access your HousingOS workspace.",
      submitLabel: "Sign in",
      sections: [
        sec("Credentials", [
          F("email", "Work email", "email", {
            required: true,
            placeholder: "you@society.com",
            span: 2,
          }),
          F("password", "Password", "password", { required: true, span: 2 }),
          F("remember", "Keep me signed in for 30 days", "switch", { span: 2 }),
        ]),
      ],
    },
    {
      key: "signup",
      title: "Create your society workspace",
      description: "Start your 30-day Professional trial.",
      submitLabel: "Create workspace",
      sections: [
        sec("Society", [
          F("societyName", "Society name", "text", {
            required: true,
            span: 2,
            placeholder: "Green Pines Residency",
          }),
          F("subdomain", "Subdomain", "text", {
            required: true,
            span: 2,
            suffix: ".housingos.com",
            placeholder: "greenpines",
          }),
          F("country", "Country", "select", {
            span: 1,
            options: [
              { value: "in", label: "India" },
              { value: "ae", label: "UAE" },
              { value: "us", label: "United States" },
              { value: "uk", label: "United Kingdom" },
            ],
          }),
          F("units", "Unit count", "number", { span: 1, placeholder: "120" }),
        ]),
        sec("Admin", [
          F("fullName", "Your name", "text", { required: true, span: 1 }),
          F("phone", "Phone", "tel", { span: 1 }),
          F("email", "Work email", "email", { required: true, span: 1 }),
          F("password", "Password", "password", { required: true, span: 1 }),
        ]),
      ],
    },
    {
      key: "forgot-password",
      title: "Forgot password",
      description: "We'll email a secure reset link.",
      submitLabel: "Send reset link",
      sections: [sec("Account", [F("email", "Email", "email", { required: true, span: 2 })])],
    },
    {
      key: "mfa-setup",
      title: "Enable two-factor authentication",
      description: "Use an authenticator app or SMS OTP.",
      submitLabel: "Verify & enable",
      sections: [
        sec("Method", [
          F("method", "MFA method", "radio", {
            span: 2,
            options: [
              { value: "totp", label: "Authenticator app (TOTP)" },
              { value: "sms", label: "SMS one-time code" },
            ],
          }),
        ]),
        sec("Verification", [
          F("code", "6-digit code", "text", { required: true, span: 1, placeholder: "123 456" }),
          F("backup", "Email me backup codes", "switch", { span: 1 }),
        ]),
      ],
    },
    {
      key: "user-profile",
      title: "User profile",
      description: "Update your account details and preferences.",
      sections: [
        sec("Identity", [
          F("avatar", "Profile photo", "file", { span: 2 }),
          F("firstName", "First name", "text", { span: 1 }),
          F("lastName", "Last name", "text", { span: 1 }),
          F("email", "Email", "email", { span: 1 }),
          F("phone", "Phone", "tel", { span: 1 }),
        ]),
        sec("Preferences", [
          F("timezone", "Time zone", "select", {
            span: 1,
            options: [
              { value: "ist", label: "Asia/Kolkata (IST)" },
              { value: "gst", label: "Asia/Dubai (GST)" },
              { value: "utc", label: "UTC" },
            ],
          }),
          F("language", "Language", "select", {
            span: 1,
            options: [
              { value: "en", label: "English" },
              { value: "hi", label: "Hindi" },
              { value: "ar", label: "Arabic" },
            ],
          }),
        ]),
      ],
    },
    {
      key: "create-tenant",
      title: "Provision new tenant",
      description: "Super admin: spin up a new society workspace.",
      submitLabel: "Provision tenant",
      sections: [
        sec("Tenant", [
          F("name", "Society name", "text", { required: true, span: 1 }),
          F("subdomain", "Subdomain", "text", {
            required: true,
            span: 1,
            suffix: ".housingos.com",
          }),
          F("plan", "Subscription tier", "select", {
            span: 1,
            options: [
              { value: "starter", label: "Starter" },
              { value: "growth", label: "Growth" },
              { value: "professional", label: "Professional" },
              { value: "enterprise", label: "Enterprise" },
            ],
          }),
          F("seats", "Unit allowance", "number", { span: 1 }),
        ]),
        sec("Modules", [
          F("bundle", "Apply bundle", "select", {
            span: 2,
            options: [
              { value: "starter", label: "Starter bundle" },
              { value: "security", label: "Security bundle" },
              { value: "full", label: "Full suite" },
            ],
          }),
        ]),
      ],
    },
    {
      key: "tenant-settings",
      title: "Tenant settings",
      description: "Currency, timezone, branding for this society.",
      sections: [
        sec("Locale", [
          F("currency", "Currency", "select", {
            span: 1,
            options: [
              { value: "pkr", label: "PKR — ₨" },
              { value: "aed", label: "AED — د.إ" },
              { value: "usd", label: "USD — $" },
            ],
          }),
          F("dateFmt", "Date format", "select", {
            span: 1,
            options: [
              { value: "dmy", label: "DD/MM/YYYY" },
              { value: "mdy", label: "MM/DD/YYYY" },
              { value: "iso", label: "YYYY-MM-DD" },
            ],
          }),
        ]),
        sec("Branding", [
          F("logo", "Society logo", "file", { span: 2 }),
          F("primaryColor", "Brand color", "color", { span: 1 }),
          F("whiteLabel", "Enable white-label", "switch", {
            span: 1,
            help: "Enterprise plan only",
          }),
        ]),
      ],
    },
    {
      key: "create-role",
      title: "Create role",
      description: "Define a role with granular permissions.",
      sections: [
        sec("Role", [
          F("name", "Role name", "text", { required: true, span: 1, placeholder: "Treasurer" }),
          F("scope", "Scope", "select", {
            span: 1,
            options: [
              { value: "society", label: "Society-wide" },
              { value: "block", label: "Block" },
              { value: "unit", label: "Unit" },
            ],
          }),
          F("description", "Description", "textarea", { span: 2, rows: 2 }),
        ]),
        sec("Permissions", [
          F("modules", "Modules accessible", "multiselect", {
            span: 2,
            options: MODULES.map((m) => ({ value: m.key, label: m.name })),
          }),
        ]),
      ],
    },
  ],

  property: [
    {
      key: "create-society",
      title: "Create society",
      description: "Top-level container for blocks and units.",
      sections: [
        sec("Basics", [
          F("name", "Society name", "text", { required: true, span: 2 }),
          F("type", "Type", "select", {
            span: 1,
            options: [
              { value: "residential", label: "Residential" },
              { value: "commercial", label: "Commercial" },
              { value: "mixed", label: "Mixed-use" },
            ],
          }),
          F("registered", "Registration number", "text", { span: 1 }),
        ]),
        sec("Address", [
          F("address1", "Address line 1", "text", { span: 2 }),
          F("address2", "Address line 2", "text", { span: 2 }),
          F("city", "City", "text", { span: 1 }),
          F("state", "State / Region", "text", { span: 1 }),
          F("postal", "Postal code", "text", { span: 1 }),
          F("country", "Country", "text", { span: 1 }),
        ]),
      ],
    },
    {
      key: "create-block",
      title: "Create block",
      description: "A wing or block within a society.",
      sections: [
        sec("Block", [
          F("society", "Society", "select", {
            span: 1,
            options: [{ value: "1", label: "Green Pines Residency" }],
          }),
          F("name", "Block name", "text", { required: true, span: 1, placeholder: "A Wing" }),
          F("code", "Short code", "text", { span: 1, placeholder: "A" }),
          F("floors", "Number of floors", "number", { span: 1 }),
        ]),
      ],
    },
    {
      key: "create-building",
      title: "Create building",
      description: "Standalone building in a block.",
      sections: [
        sec("Building", [
          F("block", "Block", "select", { span: 1, options: [{ value: "a", label: "A Wing" }] }),
          F("name", "Building name", "text", { span: 1, required: true }),
          F("yearBuilt", "Year built", "number", { span: 1 }),
          F("liftCount", "Lifts", "number", { span: 1 }),
        ]),
      ],
    },
    {
      key: "create-unit",
      title: "Create unit",
      description: "Individual flat, villa, shop, office or penthouse.",
      sections: [
        sec("Location", [
          F("building", "Building", "select", {
            span: 1,
            options: [{ value: "1", label: "A Wing" }],
          }),
          F("floor", "Floor", "number", { span: 1 }),
          F("unitNumber", "Unit number", "text", {
            required: true,
            span: 1,
            placeholder: "A-1204",
          }),
          F("type", "Unit type", "select", {
            span: 1,
            options: [
              { value: "flat", label: "Flat" },
              { value: "villa", label: "Villa" },
              { value: "shop", label: "Shop" },
              { value: "office", label: "Office" },
              { value: "penthouse", label: "Penthouse" },
            ],
          }),
        ]),
        sec("Specs", [
          F("bedrooms", "Bedrooms", "number", { span: 1 }),
          F("carpetArea", "Carpet area (sq ft)", "number", { span: 1 }),
          F("status", "Occupancy status", "select", {
            span: 1,
            options: [
              { value: "occupied", label: "Occupied" },
              { value: "vacant", label: "Vacant" },
              { value: "renovation", label: "Under renovation" },
              { value: "locked", label: "Locked" },
            ],
          }),
          F("parkingSlots", "Parking slots", "number", { span: 1 }),
        ]),
      ],
    },
    {
      key: "import-units",
      title: "Bulk import units",
      description: "Upload a CSV of units. We'll validate before import.",
      submitLabel: "Validate & preview",
      sections: [
        sec("Import", [
          F("file", "CSV file", "file", {
            span: 2,
            help: "Columns: building, floor, unit_number, type, bedrooms, area, status",
          }),
          F("dryRun", "Dry run (validate only)", "switch", { span: 2, defaultValue: true }),
        ]),
      ],
    },
    {
      key: "assign-occupancy",
      title: "Assign occupancy",
      description: "Owner or tenant assignment with dates.",
      sections: [
        sec("Assignment", [
          F("unit", "Unit", "select", { span: 1, options: [{ value: "1", label: "A-1204" }] }),
          F("role", "Role", "radio", {
            span: 1,
            options: [
              { value: "owner", label: "Owner" },
              { value: "tenant", label: "Tenant" },
            ],
          }),
          F("resident", "Resident", "select", {
            span: 2,
            options: [{ value: "1", label: "Search residents…" }],
          }),
          F("startDate", "Start date", "date", { span: 1 }),
          F("endDate", "End date", "date", { span: 1 }),
          F("agreement", "Tenancy agreement", "file", { span: 2 }),
        ]),
      ],
    },
  ],

  residents: [
    {
      key: "add-resident",
      title: "Add resident",
      description: "Create a resident profile.",
      sections: [
        sec("Identity", [
          F("photo", "Photo", "file", { span: 2 }),
          F("firstName", "First name", "text", { required: true, span: 1 }),
          F("lastName", "Last name", "text", { required: true, span: 1 }),
          F("dob", "Date of birth", "date", { span: 1 }),
          F("gender", "Gender", "select", {
            span: 1,
            options: [
              { value: "f", label: "Female" },
              { value: "m", label: "Male" },
              { value: "x", label: "Prefer not to say" },
            ],
          }),
        ]),
        sec("Contact", [
          F("email", "Email", "email", { span: 1 }),
          F("phone", "Phone", "tel", { span: 1 }),
          F("emergencyName", "Emergency contact name", "text", { span: 1 }),
          F("emergencyPhone", "Emergency contact phone", "tel", { span: 1 }),
        ]),
        sec("Unit", [
          F("unit", "Unit", "select", { span: 1, options: [{ value: "1", label: "A-1204" }] }),
          F("relationship", "Relationship to unit", "select", {
            span: 1,
            options: [
              { value: "primary", label: "Primary resident" },
              { value: "family", label: "Family member" },
              { value: "tenant", label: "Tenant" },
            ],
          }),
        ]),
      ],
    },
    {
      key: "move-in",
      title: "Record move-in",
      description: "Log a new occupancy event.",
      sections: [
        sec("Move-in", [
          F("unit", "Unit", "select", { span: 1, options: [{ value: "1", label: "A-1204" }] }),
          F("resident", "Resident", "select", {
            span: 1,
            options: [{ value: "1", label: "Asha Iyer" }],
          }),
          F("date", "Move-in date", "date", { span: 1, required: true }),
          F("meterReading", "Initial meter reading", "number", { span: 1 }),
          F("notes", "Notes", "textarea", { span: 2, rows: 3 }),
        ]),
      ],
    },
    {
      key: "move-out",
      title: "Record move-out",
      description: "Close occupancy & trigger final settlement.",
      sections: [
        sec("Move-out", [
          F("unit", "Unit", "select", { span: 1, options: [{ value: "1", label: "A-1204" }] }),
          F("date", "Move-out date", "date", { span: 1, required: true }),
          F("forwardingAddress", "Forwarding address", "textarea", { span: 2, rows: 2 }),
          F("deposit", "Refund deposit amount", "currency", { span: 1 }),
          F("dues", "Outstanding dues amount", "currency", { span: 1 }),
        ]),
      ],
    },
  ],

  notifications: [
    {
      key: "compose",
      title: "Compose notification",
      description: "Send across email, SMS, push or WhatsApp.",
      submitLabel: "Send notification",
      sections: [
        sec("Audience", [
          F("audience", "Recipients", "select", {
            span: 1,
            options: [
              { value: "all", label: "All residents" },
              { value: "block", label: "Specific block" },
              { value: "unit", label: "Specific unit" },
              { value: "role", label: "By role" },
            ],
          }),
          F("scope", "Scope filter", "text", { span: 1, placeholder: "A Wing, B Wing" }),
        ]),
        sec("Channels", [
          F("channels", "Channels", "multiselect", {
            span: 2,
            options: [
              { value: "email", label: "Email" },
              { value: "sms", label: "SMS" },
              { value: "push", label: "Push" },
              { value: "whatsapp", label: "WhatsApp" },
            ],
          }),
          F("priority", "Priority", "radio", {
            span: 2,
            options: [
              { value: "low", label: "Low" },
              { value: "normal", label: "Normal" },
              { value: "high", label: "High" },
              { value: "urgent", label: "Urgent" },
            ],
          }),
        ]),
        sec("Message", [
          F("subject", "Subject", "text", { span: 2, required: true }),
          F("body", "Message", "textarea", { span: 2, rows: 6 }),
          F("attachment", "Attachment", "file", { span: 2 }),
          F("schedule", "Send at", "datetime", { span: 1 }),
        ]),
      ],
    },
    {
      key: "template",
      title: "Notification template",
      description: "Reusable message template with merge fields.",
      sections: [
        sec("Template", [
          F("name", "Template name", "text", { required: true, span: 1 }),
          F("category", "Category", "select", {
            span: 1,
            options: [
              { value: "billing", label: "Billing" },
              { value: "complaints", label: "Complaints" },
              { value: "events", label: "Events" },
              { value: "security", label: "Security" },
            ],
          }),
          F("subject", "Subject", "text", { span: 2 }),
          F("body", "Body (supports {{merge_fields}})", "textarea", { span: 2, rows: 6 }),
        ]),
      ],
    },
    {
      key: "channel-settings",
      title: "Channel settings",
      description: "Configure provider credentials per channel.",
      sections: [
        sec("Email", [
          F("emailProvider", "Provider", "select", {
            span: 1,
            options: [
              { value: "sendgrid", label: "SendGrid" },
              { value: "ses", label: "AWS SES" },
            ],
          }),
          F("emailFrom", "From address", "email", { span: 1 }),
        ]),
        sec("SMS / WhatsApp", [
          F("smsProvider", "Provider", "select", {
            span: 1,
            options: [
              { value: "twilio", label: "Twilio" },
              { value: "msg91", label: "MSG91" },
            ],
          }),
          F("smsKey", "API key", "password", { span: 1 }),
          F("whatsappEnabled", "Enable WhatsApp", "switch", { span: 2 }),
        ]),
      ],
    },
  ],

  documents: [
    {
      key: "upload",
      title: "Upload document",
      description: "Store a versioned document with access control.",
      sections: [
        sec("File", [
          F("file", "File", "file", { required: true, span: 2 }),
          F("title", "Title", "text", { span: 2, required: true }),
          F("folder", "Folder", "select", {
            span: 1,
            options: [
              { value: "legal", label: "Legal" },
              { value: "financial", label: "Financial" },
              { value: "minutes", label: "AGM minutes" },
              { value: "policies", label: "Policies" },
            ],
          }),
          F("expiresOn", "Expires on", "date", { span: 1 }),
        ]),
        sec("Access", [
          F("visibility", "Visibility", "radio", {
            span: 2,
            options: [
              { value: "all", label: "All residents" },
              { value: "committee", label: "Committee only" },
              { value: "admins", label: "Admins only" },
            ],
          }),
          F("description", "Description", "textarea", { span: 2, rows: 3 }),
        ]),
      ],
    },
    {
      key: "folder",
      title: "Create folder",
      description: "Organize documents by topic or year.",
      sections: [
        sec("Folder", [
          F("name", "Folder name", "text", { required: true, span: 1 }),
          F("parent", "Parent folder", "select", {
            span: 1,
            options: [{ value: "root", label: "Root" }],
          }),
        ]),
      ],
    },
    {
      key: "share",
      title: "Share document",
      description: "Generate a time-limited share link.",
      sections: [
        sec("Share", [
          F("document", "Document", "select", {
            span: 2,
            options: [{ value: "1", label: "Society bye-laws.pdf" }],
          }),
          F("expires", "Link expires", "datetime", { span: 1 }),
          F("password", "Protect with password", "password", { span: 1 }),
          F("emails", "Send to emails", "textarea", {
            span: 2,
            rows: 3,
            placeholder: "one@example.com, two@example.com",
          }),
        ]),
      ],
    },
  ],

  reports: [
    {
      key: "generate",
      title: "Generate report",
      description: "Run a report and export to PDF or Excel.",
      submitLabel: "Run report",
      sections: [
        sec("Report", [
          F("type", "Report type", "select", {
            span: 2,
            options: [
              { value: "collection", label: "Collection summary" },
              { value: "ledger", label: "Resident ledger" },
              { value: "complaints", label: "Complaints aging" },
              { value: "occupancy", label: "Occupancy" },
              { value: "budget", label: "Budget vs actuals" },
            ],
          }),
          F("from", "From", "date", { span: 1 }),
          F("to", "To", "date", { span: 1 }),
          F("format", "Output", "radio", {
            span: 2,
            options: [
              { value: "pdf", label: "PDF" },
              { value: "xlsx", label: "Excel" },
              { value: "csv", label: "CSV" },
            ],
          }),
        ]),
      ],
    },
    {
      key: "schedule",
      title: "Schedule report",
      description: "Email a report on a recurring schedule.",
      sections: [
        sec("Schedule", [
          F("type", "Report", "select", {
            span: 1,
            options: [{ value: "collection", label: "Collection summary" }],
          }),
          F("frequency", "Frequency", "select", {
            span: 1,
            options: [
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
            ],
          }),
          F("recipients", "Recipients", "textarea", {
            span: 2,
            rows: 2,
            placeholder: "treasurer@society.com",
          }),
        ]),
      ],
    },
  ],

  ledger: [
    {
      key: "create-charge",
      title: "Create charge",
      description: "Post a charge to one or more unit ledgers.",
      sections: [
        sec("Charge", [
          F("name", "Charge name", "text", {
            required: true,
            span: 1,
            placeholder: "October maintenance",
          }),
          F("category", "Category", "select", {
            span: 1,
            options: [
              { value: "maint", label: "Maintenance" },
              { value: "amenity", label: "Amenity" },
              { value: "utility", label: "Utility" },
              { value: "penalty", label: "Penalty" },
            ],
          }),
          F("amount", "Amount", "currency", { required: true, span: 1 }),
          F("dueDate", "Due date", "date", { span: 1 }),
        ]),
        sec("Apply to", [
          F("scope", "Scope", "radio", {
            span: 2,
            options: [
              { value: "all", label: "All units" },
              { value: "block", label: "By block" },
              { value: "unit", label: "Specific unit" },
              { value: "type", label: "By unit type" },
            ],
          }),
          F("notes", "Notes (visible on invoice)", "textarea", { span: 2, rows: 2 }),
        ]),
      ],
    },
    {
      key: "adjustment",
      title: "Ledger adjustment",
      description: "Credit or debit a unit ledger with reason.",
      sections: [
        sec("Adjustment", [
          F("unit", "Unit", "select", { span: 1, options: [{ value: "1", label: "A-1204" }] }),
          F("type", "Type", "radio", {
            span: 1,
            options: [
              { value: "credit", label: "Credit" },
              { value: "debit", label: "Debit" },
            ],
          }),
          F("amount", "Amount", "currency", { span: 1, required: true }),
          F("date", "Date", "date", { span: 1 }),
          F("reason", "Reason", "textarea", { span: 2, rows: 3, required: true }),
        ]),
      ],
    },
    {
      key: "opening-balance",
      title: "Set opening balance",
      description: "Initialize a unit ledger from prior records.",
      sections: [
        sec("Opening balance", [
          F("unit", "Unit", "select", { span: 1, options: [{ value: "1", label: "A-1204" }] }),
          F("asOf", "As of", "date", { span: 1 }),
          F("balance", "Balance", "currency", { span: 1 }),
          F("type", "Dr / Cr", "radio", {
            span: 1,
            options: [
              { value: "dr", label: "Debit (owed)" },
              { value: "cr", label: "Credit (advance)" },
            ],
          }),
        ]),
      ],
    },
  ],

  payments: [
    {
      key: "record-payment",
      title: "Record payment",
      description: "Log a manual or online payment receipt.",
      submitLabel: "Record receipt",
      sections: [
        sec("Payer", [
          F("unit", "Unit", "select", { span: 1, options: [{ value: "1", label: "A-1204" }] }),
          F("payer", "Paid by", "text", { span: 1 }),
        ]),
        sec("Payment", [
          F("amount", "Amount", "currency", { required: true, span: 1 }),
          F("date", "Payment date", "date", { span: 1, required: true }),
          F("method", "Method", "select", {
            span: 1,
            options: [
              { value: "cash", label: "Cash" },
              { value: "cheque", label: "Cheque" },
              { value: "neft", label: "Bank transfer" },
              { value: "upi", label: "UPI" },
              { value: "card", label: "Card" },
              { value: "online", label: "Online gateway" },
            ],
          }),
          F("reference", "Reference / Cheque #", "text", { span: 1 }),
          F("allocate", "Auto-allocate to oldest dues", "switch", { span: 2, defaultValue: true }),
          F("notes", "Notes", "textarea", { span: 2, rows: 2 }),
        ]),
      ],
    },
    {
      key: "refund",
      title: "Issue refund",
      description: "Refund all or part of a previous payment.",
      sections: [
        sec("Refund", [
          F("payment", "Original payment", "select", {
            span: 2,
            options: [{ value: "1", label: "Receipt #2025-1142" }],
          }),
          F("amount", "Refund amount", "currency", { span: 1, required: true }),
          F("method", "Refund method", "select", {
            span: 1,
            options: [
              { value: "original", label: "Original method" },
              { value: "bank", label: "Bank transfer" },
              { value: "cheque", label: "Cheque" },
            ],
          }),
          F("reason", "Reason", "textarea", { span: 2, rows: 2 }),
        ]),
      ],
    },
    {
      key: "allocation",
      title: "Allocate payment",
      description: "Manually allocate a payment across invoices.",
      sections: [
        sec("Allocation", [
          F("payment", "Payment", "select", {
            span: 2,
            options: [{ value: "1", label: "Receipt #2025-1142 — ₨12,000" }],
          }),
          F("invoice1", "Invoice INV-3301 — ₨8,000", "currency", { span: 1, prefix: "Allocate" }),
          F("invoice2", "Invoice INV-3322 — ₨4,000", "currency", { span: 1, prefix: "Allocate" }),
        ]),
      ],
    },
  ],

  financial_transparency: [
    {
      key: "publish-statement",
      title: "Publish financial statement",
      description: "Make a statement visible to residents.",
      sections: [
        sec("Statement", [
          F("period", "Period", "select", {
            span: 1,
            options: [{ value: "q3-2026", label: "Q3 2026" }],
          }),
          F("type", "Statement type", "select", {
            span: 1,
            options: [
              { value: "income", label: "Income & expense" },
              { value: "voucher", label: "Voucher register" },
              { value: "bank", label: "Bank reconciliation" },
            ],
          }),
          F("file", "Attach signed PDF", "file", { span: 2 }),
          F("notes", "Notes for residents", "textarea", { span: 2, rows: 3 }),
          F("visible", "Visible to residents", "switch", { span: 2, defaultValue: true }),
        ]),
      ],
    },
  ],

  budget: [
    {
      key: "create-budget",
      title: "Create annual budget",
      description: "Forecast income and expenses for the year.",
      sections: [
        sec("Period", [
          F("year", "Financial year", "text", { span: 1, placeholder: "FY 2026-27" }),
          F("currency", "Currency", "select", {
            span: 1,
            options: [{ value: "pkr", label: "PKR" }],
          }),
          F("status", "Status", "select", {
            span: 2,
            options: [
              { value: "draft", label: "Draft" },
              { value: "approved", label: "Approved" },
            ],
          }),
        ]),
        sec("Notes", [F("notes", "Notes", "textarea", { span: 2, rows: 4 })]),
      ],
    },
    {
      key: "line-item",
      title: "Budget line item",
      description: "Add a category line to a budget.",
      sections: [
        sec("Line item", [
          F("budget", "Budget", "select", {
            span: 1,
            options: [{ value: "1", label: "FY 2026-27" }],
          }),
          F("category", "Category", "select", {
            span: 1,
            options: [
              { value: "income", label: "Income" },
              { value: "expense", label: "Expense" },
              { value: "reserve", label: "Reserve fund" },
            ],
          }),
          F("head", "Line head", "text", { span: 1, placeholder: "Lift AMC" }),
          F("amount", "Budgeted amount", "currency", { span: 1 }),
          F("notes", "Notes", "textarea", { span: 2, rows: 2 }),
        ]),
      ],
    },
  ],

  vendor_finance: [
    {
      key: "create-po",
      title: "Create purchase order",
      description: "Issue a PO to an empanelled vendor.",
      sections: [
        sec("PO", [
          F("vendor", "Vendor", "select", {
            span: 1,
            options: [{ value: "1", label: "Acme Lift Services" }],
          }),
          F("number", "PO number", "text", { span: 1, placeholder: "Auto" }),
          F("date", "PO date", "date", { span: 1 }),
          F("expected", "Expected delivery", "date", { span: 1 }),
        ]),
        sec("Items", [
          F("description", "Description", "textarea", { span: 2, rows: 3 }),
          F("amount", "Total amount", "currency", { span: 1 }),
          F("gst", "Tax %", "number", { span: 1, suffix: "%" }),
        ]),
      ],
    },
    {
      key: "vendor-invoice",
      title: "Record vendor invoice",
      description: "Capture an invoice received against a PO.",
      sections: [
        sec("Invoice", [
          F("po", "Linked PO", "select", {
            span: 1,
            options: [{ value: "1", label: "PO-2025-441" }],
          }),
          F("number", "Invoice #", "text", { span: 1, required: true }),
          F("date", "Invoice date", "date", { span: 1 }),
          F("due", "Due date", "date", { span: 1 }),
          F("amount", "Amount", "currency", { span: 1 }),
          F("tax", "Tax", "currency", { span: 1 }),
          F("file", "Upload invoice copy", "file", { span: 2 }),
        ]),
      ],
    },
    {
      key: "vendor-payment",
      title: "Pay vendor",
      description: "Release a payment against a vendor invoice.",
      sections: [
        sec("Payment", [
          F("invoice", "Invoice", "select", {
            span: 2,
            options: [{ value: "1", label: "Acme Lift — INV-9911 — ₨84,000" }],
          }),
          F("amount", "Amount", "currency", { span: 1, required: true }),
          F("date", "Payment date", "date", { span: 1 }),
          F("mode", "Mode", "select", {
            span: 1,
            options: [
              { value: "neft", label: "NEFT" },
              { value: "cheque", label: "Cheque" },
              { value: "upi", label: "UPI" },
            ],
          }),
          F("reference", "Reference", "text", { span: 1 }),
          F("tds", "Deduct TDS", "switch", { span: 2 }),
        ]),
      ],
    },
  ],

  complaints: [
    {
      key: "raise",
      title: "Raise complaint",
      description: "Submit a new complaint or request.",
      submitLabel: "Submit complaint",
      sections: [
        sec("Issue", [
          F("category", "Category", "select", {
            span: 1,
            options: [
              { value: "plumbing", label: "Plumbing" },
              { value: "electrical", label: "Electrical" },
              { value: "housekeeping", label: "Housekeeping" },
              { value: "security", label: "Security" },
              { value: "other", label: "Other" },
            ],
          }),
          F("priority", "Priority", "select", {
            span: 1,
            options: [
              { value: "low", label: "Low" },
              { value: "normal", label: "Normal" },
              { value: "high", label: "High" },
              { value: "urgent", label: "Urgent" },
            ],
          }),
          F("title", "Title", "text", {
            span: 2,
            required: true,
            placeholder: "Leak in kitchen sink",
          }),
          F("description", "Describe the issue", "textarea", { span: 2, rows: 5, required: true }),
          F("location", "Location", "text", { span: 1, placeholder: "Kitchen" }),
          F("photo", "Attach photos", "file", { span: 1 }),
        ]),
        sec("Access", [
          F("access", "Preferred visit slot", "datetime", { span: 1 }),
          F("permission", "Permission to enter if absent", "switch", { span: 1 }),
        ]),
      ],
    },
    {
      key: "assign",
      title: "Assign complaint",
      description: "Route the complaint to a staff member or vendor.",
      sections: [
        sec("Assignment", [
          F("complaint", "Complaint", "select", {
            span: 2,
            options: [{ value: "1", label: "#CMP-1093 — Leak in kitchen sink" }],
          }),
          F("assignee", "Assign to", "select", {
            span: 1,
            options: [
              { value: "ops", label: "Maintenance team" },
              { value: "vendor", label: "External vendor" },
            ],
          }),
          F("staff", "Staff / Vendor", "select", {
            span: 1,
            options: [{ value: "1", label: "Ravi (plumber)" }],
          }),
          F("dueBy", "Due by", "datetime", { span: 1 }),
          F("notes", "Internal notes", "textarea", { span: 2, rows: 3 }),
        ]),
      ],
    },
    {
      key: "resolve",
      title: "Resolve complaint",
      description: "Close a complaint with resolution notes.",
      sections: [
        sec("Resolution", [
          F("complaint", "Complaint", "select", {
            span: 2,
            options: [{ value: "1", label: "#CMP-1093" }],
          }),
          F("outcome", "Outcome", "radio", {
            span: 2,
            options: [
              { value: "resolved", label: "Resolved" },
              { value: "wontfix", label: "Won't fix" },
              { value: "duplicate", label: "Duplicate" },
            ],
          }),
          F("summary", "Resolution summary", "textarea", { span: 2, rows: 4 }),
          F("cost", "Cost incurred", "currency", { span: 1 }),
          F("photo", "Proof photo", "file", { span: 1 }),
        ]),
      ],
    },
    {
      key: "comment",
      title: "Add comment",
      description: "Reply on a complaint thread.",
      sections: [
        sec("Comment", [
          F("complaint", "Complaint", "select", {
            span: 2,
            options: [{ value: "1", label: "#CMP-1093" }],
          }),
          F("body", "Comment", "textarea", { span: 2, rows: 4, required: true }),
          F("internal", "Internal only (hide from resident)", "switch", { span: 2 }),
        ]),
      ],
    },
  ],

  maintenance: [
    {
      key: "schedule",
      title: "Schedule maintenance",
      description: "Preventive maintenance schedule for an asset.",
      sections: [
        sec("Schedule", [
          F("asset", "Asset", "select", { span: 1, options: [{ value: "1", label: "Lift A1" }] }),
          F("frequency", "Frequency", "select", {
            span: 1,
            options: [
              { value: "monthly", label: "Monthly" },
              { value: "quarterly", label: "Quarterly" },
              { value: "halfyearly", label: "Half-yearly" },
              { value: "yearly", label: "Yearly" },
            ],
          }),
          F("nextDue", "Next due", "date", { span: 1 }),
          F("assignee", "Assigned vendor", "select", {
            span: 1,
            options: [{ value: "1", label: "Acme Lift Services" }],
          }),
          F("checklist", "Checklist", "textarea", {
            span: 2,
            rows: 4,
            placeholder: "One item per line",
          }),
        ]),
      ],
    },
    {
      key: "work-order",
      title: "Create work order",
      description: "Dispatch a maintenance work order.",
      sections: [
        sec("Work order", [
          F("title", "Title", "text", { span: 2, required: true }),
          F("asset", "Asset", "select", { span: 1, options: [{ value: "1", label: "Lift A1" }] }),
          F("priority", "Priority", "select", {
            span: 1,
            options: [
              { value: "low", label: "Low" },
              { value: "normal", label: "Normal" },
              { value: "high", label: "High" },
            ],
          }),
          F("assignee", "Assign to", "select", {
            span: 1,
            options: [{ value: "1", label: "Ravi (technician)" }],
          }),
          F("dueDate", "Due date", "date", { span: 1 }),
          F("description", "Description", "textarea", { span: 2, rows: 4 }),
        ]),
      ],
    },
    {
      key: "service-log",
      title: "Log service",
      description: "Record a completed maintenance service.",
      sections: [
        sec("Service", [
          F("asset", "Asset", "select", { span: 1, options: [{ value: "1", label: "Lift A1" }] }),
          F("date", "Service date", "date", { span: 1 }),
          F("technician", "Technician", "text", { span: 1 }),
          F("cost", "Cost", "currency", { span: 1 }),
          F("partsUsed", "Parts used", "textarea", { span: 2, rows: 3 }),
          F("nextDue", "Next due", "date", { span: 1 }),
          F("report", "Service report", "file", { span: 1 }),
        ]),
      ],
    },
  ],

  inventory: [
    {
      key: "add-part",
      title: "Add spare part",
      description: "Register a new SKU in the parts inventory.",
      sections: [
        sec("Part", [
          F("name", "Part name", "text", { span: 1, required: true }),
          F("sku", "SKU", "text", { span: 1 }),
          F("category", "Category", "select", {
            span: 1,
            options: [
              { value: "electrical", label: "Electrical" },
              { value: "plumbing", label: "Plumbing" },
              { value: "lift", label: "Lift" },
              { value: "general", label: "General" },
            ],
          }),
          F("unit", "Unit of measure", "select", {
            span: 1,
            options: [
              { value: "pcs", label: "Pieces" },
              { value: "m", label: "Meter" },
              { value: "kg", label: "Kilogram" },
              { value: "l", label: "Litre" },
            ],
          }),
          F("opening", "Opening stock", "number", { span: 1 }),
          F("reorder", "Reorder level", "number", { span: 1 }),
          F("location", "Storage location", "text", { span: 2 }),
        ]),
      ],
    },
    {
      key: "stock-movement",
      title: "Stock movement",
      description: "Record an issue or receipt of stock.",
      sections: [
        sec("Movement", [
          F("part", "Part", "select", {
            span: 1,
            options: [{ value: "1", label: "LED Tube 20W" }],
          }),
          F("type", "Type", "radio", {
            span: 1,
            options: [
              { value: "in", label: "Receipt (in)" },
              { value: "out", label: "Issue (out)" },
              { value: "adjust", label: "Adjustment" },
            ],
          }),
          F("quantity", "Quantity", "number", { span: 1, required: true }),
          F("date", "Date", "date", { span: 1 }),
          F("reference", "Reference / Work order", "text", { span: 2 }),
          F("notes", "Notes", "textarea", { span: 2, rows: 2 }),
        ]),
      ],
    },
    {
      key: "reorder",
      title: "Reorder settings",
      description: "Auto-alert when stock drops below threshold.",
      sections: [
        sec("Reorder", [
          F("part", "Part", "select", {
            span: 1,
            options: [{ value: "1", label: "LED Tube 20W" }],
          }),
          F("threshold", "Threshold", "number", { span: 1 }),
          F("preferredVendor", "Preferred vendor", "select", {
            span: 1,
            options: [{ value: "1", label: "Sunrise Electricals" }],
          }),
          F("autoPO", "Auto-create PO when triggered", "switch", { span: 1 }),
        ]),
      ],
    },
  ],

  vendors: [
    {
      key: "add-vendor",
      title: "Add vendor",
      description: "Add a vendor to the empanelled list.",
      sections: [
        sec("Vendor", [
          F("name", "Vendor name", "text", { span: 2, required: true }),
          F("category", "Category", "select", {
            span: 1,
            options: [
              { value: "lift", label: "Lift" },
              { value: "security", label: "Security" },
              { value: "housekeeping", label: "Housekeeping" },
              { value: "garden", label: "Garden" },
            ],
          }),
          F("rating", "Initial rating", "select", {
            span: 1,
            options: [
              { value: "1", label: "1" },
              { value: "2", label: "2" },
              { value: "3", label: "3" },
              { value: "4", label: "4" },
              { value: "5", label: "5" },
            ],
          }),
        ]),
        sec("Contact", [
          F("contact", "Primary contact", "text", { span: 1 }),
          F("phone", "Phone", "tel", { span: 1 }),
          F("email", "Email", "email", { span: 1 }),
          F("gst", "GST / Tax ID", "text", { span: 1 }),
          F("address", "Address", "textarea", { span: 2, rows: 2 }),
        ]),
        sec("Banking", [
          F("bank", "Bank account", "text", { span: 1 }),
          F("ifsc", "IFSC / SWIFT", "text", { span: 1 }),
        ]),
      ],
    },
    {
      key: "rfq",
      title: "Request for quotation",
      description: "Send an RFQ to multiple vendors.",
      sections: [
        sec("RFQ", [
          F("subject", "Subject", "text", { span: 2, required: true }),
          F("vendors", "Vendors", "multiselect", {
            span: 2,
            options: [
              { value: "1", label: "Acme Lift Services" },
              { value: "2", label: "Sunrise Electricals" },
              { value: "3", label: "Greenscape Gardens" },
            ],
          }),
          F("scope", "Scope of work", "textarea", { span: 2, rows: 5 }),
          F("dueDate", "Quotations due by", "date", { span: 1 }),
          F("attachment", "Attachment", "file", { span: 1 }),
        ]),
      ],
    },
    {
      key: "quotation",
      title: "Record quotation",
      description: "Capture a vendor quotation against an RFQ.",
      sections: [
        sec("Quotation", [
          F("rfq", "RFQ", "select", { span: 1, options: [{ value: "1", label: "RFQ-2025-12" }] }),
          F("vendor", "Vendor", "select", {
            span: 1,
            options: [{ value: "1", label: "Acme Lift Services" }],
          }),
          F("amount", "Quoted amount", "currency", { span: 1 }),
          F("validity", "Valid till", "date", { span: 1 }),
          F("file", "Quotation file", "file", { span: 2 }),
          F("notes", "Notes", "textarea", { span: 2, rows: 3 }),
        ]),
      ],
    },
    {
      key: "rating",
      title: "Rate vendor",
      description: "Submit a post-engagement vendor rating.",
      sections: [
        sec("Rating", [
          F("vendor", "Vendor", "select", {
            span: 1,
            options: [{ value: "1", label: "Acme Lift Services" }],
          }),
          F("score", "Score", "select", {
            span: 1,
            options: [
              { value: "1", label: "1 ★" },
              { value: "2", label: "2 ★" },
              { value: "3", label: "3 ★" },
              { value: "4", label: "4 ★" },
              { value: "5", label: "5 ★" },
            ],
          }),
          F("comments", "Comments", "textarea", { span: 2, rows: 4 }),
        ]),
      ],
    },
  ],

  projects: [
    {
      key: "create-project",
      title: "Create project",
      description: "Plan a capex or improvement project.",
      sections: [
        sec("Project", [
          F("name", "Project name", "text", { span: 2, required: true }),
          F("start", "Start date", "date", { span: 1 }),
          F("end", "Target end", "date", { span: 1 }),
          F("budget", "Budget", "currency", { span: 1 }),
          F("owner", "Project owner", "select", {
            span: 1,
            options: [{ value: "1", label: "Asha Iyer (Committee)" }],
          }),
        ]),
        sec("Visibility", [
          F("residentVisible", "Visible to residents", "switch", { span: 1, defaultValue: true }),
          F("description", "Description", "textarea", { span: 2, rows: 4 }),
        ]),
      ],
    },
    {
      key: "milestone",
      title: "Add milestone",
      description: "Break the project into milestones.",
      sections: [
        sec("Milestone", [
          F("project", "Project", "select", {
            span: 2,
            options: [{ value: "1", label: "Lobby renovation" }],
          }),
          F("name", "Milestone", "text", { span: 2, required: true }),
          F("due", "Due", "date", { span: 1 }),
          F("status", "Status", "select", {
            span: 1,
            options: [
              { value: "planned", label: "Planned" },
              { value: "inprogress", label: "In progress" },
              { value: "done", label: "Done" },
            ],
          }),
        ]),
      ],
    },
    {
      key: "expense",
      title: "Project expense",
      description: "Log an expense against a project budget.",
      sections: [
        sec("Expense", [
          F("project", "Project", "select", {
            span: 1,
            options: [{ value: "1", label: "Lobby renovation" }],
          }),
          F("vendor", "Vendor", "select", {
            span: 1,
            options: [{ value: "1", label: "Acme Lift Services" }],
          }),
          F("amount", "Amount", "currency", { span: 1 }),
          F("date", "Date", "date", { span: 1 }),
          F("invoice", "Invoice", "file", { span: 2 }),
          F("notes", "Notes", "textarea", { span: 2, rows: 2 }),
        ]),
      ],
    },
  ],

  assets: [
    {
      key: "add-asset",
      title: "Add asset",
      description: "Register a society asset.",
      sections: [
        sec("Asset", [
          F("name", "Asset name", "text", { span: 2, required: true }),
          F("category", "Category", "select", {
            span: 1,
            options: [
              { value: "lift", label: "Lift" },
              { value: "pump", label: "Pump" },
              { value: "dg", label: "Diesel generator" },
              { value: "stp", label: "STP" },
              { value: "cctv", label: "CCTV" },
            ],
          }),
          F("location", "Location", "text", { span: 1 }),
          F("serial", "Serial number", "text", { span: 1 }),
          F("purchaseDate", "Purchase date", "date", { span: 1 }),
          F("cost", "Purchase cost", "currency", { span: 1 }),
        ]),
      ],
    },
    {
      key: "amc",
      title: "Add AMC / warranty",
      description: "Track AMCs and warranties for an asset.",
      sections: [
        sec("AMC", [
          F("asset", "Asset", "select", { span: 1, options: [{ value: "1", label: "Lift A1" }] }),
          F("vendor", "Vendor", "select", {
            span: 1,
            options: [{ value: "1", label: "Acme Lift Services" }],
          }),
          F("from", "From", "date", { span: 1 }),
          F("to", "To", "date", { span: 1 }),
          F("value", "Contract value", "currency", { span: 1 }),
          F("reminderDays", "Renewal reminder (days)", "number", { span: 1, defaultValue: "30" }),
          F("document", "Contract document", "file", { span: 2 }),
        ]),
      ],
    },
    {
      key: "depreciation",
      title: "Depreciation settings",
      description: "Set depreciation method and rate.",
      sections: [
        sec("Depreciation", [
          F("asset", "Asset", "select", { span: 1, options: [{ value: "1", label: "Lift A1" }] }),
          F("method", "Method", "select", {
            span: 1,
            options: [
              { value: "sl", label: "Straight line" },
              { value: "wdv", label: "Written down value" },
            ],
          }),
          F("rate", "Annual rate %", "number", { span: 1, suffix: "%" }),
          F("usefulLife", "Useful life (years)", "number", { span: 1 }),
        ]),
      ],
    },
  ],

  visitor: [
    {
      key: "pre-register",
      title: "Pre-register visitor",
      description: "Notify the gate of an expected visitor.",
      submitLabel: "Generate QR pass",
      sections: [
        sec("Visitor", [
          F("name", "Visitor name", "text", { span: 1, required: true }),
          F("phone", "Phone", "tel", { span: 1 }),
          F("purpose", "Purpose", "select", {
            span: 1,
            options: [
              { value: "guest", label: "Guest" },
              { value: "delivery", label: "Delivery" },
              { value: "service", label: "Service" },
              { value: "cab", label: "Cab pickup" },
            ],
          }),
          F("companions", "Number of companions", "number", { span: 1, defaultValue: "0" }),
        ]),
        sec("Visit", [
          F("from", "Valid from", "datetime", { span: 1 }),
          F("to", "Valid till", "datetime", { span: 1 }),
          F("vehicle", "Vehicle number", "text", { span: 1 }),
          F("notes", "Notes for guard", "textarea", { span: 1, rows: 2 }),
        ]),
      ],
    },
    {
      key: "qr-pass",
      title: "Generate one-time QR pass",
      description: "Single-use entry pass for instant visitors.",
      sections: [
        sec("Pass", [
          F("name", "Visitor name", "text", { span: 1 }),
          F("phone", "Phone", "tel", { span: 1 }),
          F("validFor", "Valid for (hours)", "number", { span: 1, defaultValue: "4" }),
          F("share", "Send pass via", "multiselect", {
            span: 1,
            options: [
              { value: "sms", label: "SMS" },
              { value: "whatsapp", label: "WhatsApp" },
              { value: "email", label: "Email" },
            ],
          }),
        ]),
      ],
    },
  ],

  gate: [
    {
      key: "entry",
      title: "Log visitor entry",
      description: "Guard records an arriving visitor.",
      sections: [
        sec("Visitor", [
          F("photo", "Capture photo", "file", { span: 2 }),
          F("name", "Name", "text", { span: 1, required: true }),
          F("phone", "Phone", "tel", { span: 1 }),
          F("idType", "ID type", "select", {
            span: 1,
            options: [
              { value: "aadhaar", label: "Aadhaar" },
              { value: "pan", label: "PAN" },
              { value: "driving", label: "Driving licence" },
              { value: "passport", label: "Passport" },
            ],
          }),
          F("idNumber", "ID number", "text", { span: 1 }),
        ]),
        sec("Visit", [
          F("unit", "Visiting unit", "select", {
            span: 1,
            options: [{ value: "1", label: "A-1204" }],
          }),
          F("purpose", "Purpose", "text", { span: 1 }),
          F("vehicle", "Vehicle number", "text", { span: 1 }),
          F("entryTime", "Entry time", "datetime", { span: 1 }),
        ]),
      ],
    },
    {
      key: "exit",
      title: "Log visitor exit",
      description: "Record exit time for an open visitor entry.",
      sections: [
        sec("Exit", [
          F("visitor", "Open entry", "select", {
            span: 2,
            options: [{ value: "1", label: "Rahul Sharma → A-1204 (entered 10:42)" }],
          }),
          F("exitTime", "Exit time", "datetime", { span: 1 }),
          F("notes", "Notes", "textarea", { span: 2, rows: 2 }),
        ]),
      ],
    },
    {
      key: "vehicle-entry",
      title: "Log vehicle entry",
      description: "Capture non-resident vehicle entry.",
      sections: [
        sec("Vehicle", [
          F("plate", "License plate", "text", { span: 1, required: true }),
          F("type", "Vehicle type", "select", {
            span: 1,
            options: [
              { value: "car", label: "Car" },
              { value: "two", label: "Two-wheeler" },
              { value: "truck", label: "Truck" },
              { value: "cab", label: "Cab" },
            ],
          }),
          F("driver", "Driver name", "text", { span: 1 }),
          F("purpose", "Purpose", "text", { span: 1 }),
        ]),
      ],
    },
  ],

  parking: [
    {
      key: "allocate",
      title: "Allocate parking slot",
      description: "Assign a parking slot to a unit.",
      sections: [
        sec("Allocation", [
          F("slot", "Slot", "select", { span: 1, options: [{ value: "1", label: "B1-042" }] }),
          F("unit", "Unit", "select", { span: 1, options: [{ value: "1", label: "A-1204" }] }),
          F("vehicle", "Vehicle plate", "text", { span: 1 }),
          F("from", "From", "date", { span: 1 }),
          F("monthly", "Monthly charge", "currency", { span: 1 }),
        ]),
      ],
    },
    {
      key: "book-visitor-parking",
      title: "Book visitor parking",
      description: "Reserve a visitor parking slot.",
      sections: [
        sec("Booking", [
          F("date", "Date", "date", { span: 1 }),
          F("slot", "Preferred slot", "select", {
            span: 1,
            options: [{ value: "v1", label: "Visitor-12" }],
          }),
          F("from", "From", "time", { span: 1 }),
          F("to", "To", "time", { span: 1 }),
          F("vehicle", "Vehicle plate", "text", { span: 2 }),
        ]),
      ],
    },
    {
      key: "violation",
      title: "Report parking violation",
      description: "Log a parking rule violation.",
      sections: [
        sec("Violation", [
          F("plate", "Vehicle plate", "text", { span: 1, required: true }),
          F("slot", "Slot / Location", "text", { span: 1 }),
          F("rule", "Rule violated", "select", {
            span: 2,
            options: [
              { value: "wrong", label: "Wrong slot" },
              { value: "double", label: "Double parking" },
              { value: "fire", label: "Blocking fire lane" },
              { value: "expired", label: "Expired pass" },
            ],
          }),
          F("photo", "Photo evidence", "file", { span: 2 }),
          F("fine", "Fine amount", "currency", { span: 1 }),
        ]),
      ],
    },
  ],

  guard_patrol: [
    {
      key: "create-shift",
      title: "Create guard shift",
      description: "Assign guards to shifts.",
      sections: [
        sec("Shift", [
          F("guard", "Guard", "select", {
            span: 1,
            options: [{ value: "1", label: "Suresh Kumar" }],
          }),
          F("post", "Post / Gate", "select", {
            span: 1,
            options: [{ value: "1", label: "Main gate" }],
          }),
          F("date", "Date", "date", { span: 1 }),
          F("startTime", "Start time", "time", { span: 1 }),
          F("endTime", "End time", "time", { span: 1 }),
          F("supervisor", "Supervisor", "select", {
            span: 1,
            options: [{ value: "1", label: "Head guard" }],
          }),
        ]),
      ],
    },
    {
      key: "patrol-log",
      title: "Patrol checkpoint log",
      description: "Log a checkpoint scan during patrol.",
      sections: [
        sec("Checkpoint", [
          F("checkpoint", "Checkpoint", "select", {
            span: 1,
            options: [{ value: "1", label: "Block A — basement" }],
          }),
          F("time", "Scanned at", "datetime", { span: 1 }),
          F("status", "Status", "select", {
            span: 1,
            options: [
              { value: "ok", label: "All clear" },
              { value: "issue", label: "Issue found" },
            ],
          }),
          F("notes", "Notes", "textarea", { span: 2, rows: 3 }),
          F("photo", "Photo", "file", { span: 1 }),
        ]),
      ],
    },
    {
      key: "incident",
      title: "Report incident",
      description: "Record a security incident.",
      sections: [
        sec("Incident", [
          F("type", "Type", "select", {
            span: 1,
            options: [
              { value: "theft", label: "Theft" },
              { value: "trespass", label: "Trespass" },
              { value: "fire", label: "Fire" },
              { value: "medical", label: "Medical" },
              { value: "other", label: "Other" },
            ],
          }),
          F("severity", "Severity", "select", {
            span: 1,
            options: [
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
              { value: "critical", label: "Critical" },
            ],
          }),
          F("when", "When", "datetime", { span: 1 }),
          F("where", "Where", "text", { span: 1 }),
          F("description", "Description", "textarea", { span: 2, rows: 5, required: true }),
          F("photos", "Photos / Evidence", "file", { span: 2 }),
        ]),
      ],
    },
  ],

  blacklist: [
    {
      key: "add",
      title: "Add to blacklist",
      description: "Block a visitor, vehicle or contractor from entry.",
      sections: [
        sec("Entry", [
          F("subjectType", "Subject", "radio", {
            span: 2,
            options: [
              { value: "person", label: "Person" },
              { value: "vehicle", label: "Vehicle" },
              { value: "vendor", label: "Vendor" },
            ],
          }),
          F("identifier", "Name / Plate / ID", "text", { span: 1, required: true }),
          F("idProof", "ID number (if known)", "text", { span: 1 }),
          F("reason", "Reason", "textarea", { span: 2, rows: 4, required: true }),
          F("until", "Blocked until (leave blank for permanent)", "date", { span: 1 }),
          F("evidence", "Evidence", "file", { span: 1 }),
        ]),
      ],
    },
  ],

  notice_board: [
    {
      key: "post",
      title: "Post notice",
      description: "Broadcast a notice to residents.",
      submitLabel: "Publish notice",
      sections: [
        sec("Notice", [
          F("title", "Title", "text", { span: 2, required: true }),
          F("body", "Body", "textarea", { span: 2, rows: 8, required: true }),
          F("attachment", "Attachment", "file", { span: 1 }),
          F("pin", "Pin to top", "switch", { span: 1 }),
        ]),
        sec("Audience", [
          F("audience", "Audience", "select", {
            span: 1,
            options: [
              { value: "all", label: "All residents" },
              { value: "block", label: "Specific block" },
              { value: "owners", label: "Owners only" },
              { value: "tenants", label: "Tenants only" },
            ],
          }),
          F("expiresOn", "Auto-expire on", "date", { span: 1 }),
          F("notify", "Push notification", "switch", { span: 1, defaultValue: true }),
        ]),
      ],
    },
  ],

  community_forum: [
    {
      key: "new-thread",
      title: "Start a thread",
      description: "Open a new discussion in the community forum.",
      sections: [
        sec("Thread", [
          F("category", "Category", "select", {
            span: 1,
            options: [
              { value: "general", label: "General" },
              { value: "buysell", label: "Buy / sell" },
              { value: "lostfound", label: "Lost & found" },
              { value: "help", label: "Ask for help" },
            ],
          }),
          F("title", "Title", "text", { span: 1, required: true }),
          F("body", "Message", "textarea", { span: 2, rows: 8, required: true }),
          F("photo", "Photo", "file", { span: 1 }),
          F("allowComments", "Allow comments", "switch", { span: 1, defaultValue: true }),
        ]),
      ],
    },
    {
      key: "reply",
      title: "Reply",
      description: "Reply to a forum thread.",
      sections: [
        sec("Reply", [
          F("thread", "Thread", "select", {
            span: 2,
            options: [{ value: "1", label: "Lift A1 noise — anyone else?" }],
          }),
          F("body", "Reply", "textarea", { span: 2, rows: 5, required: true }),
        ]),
      ],
    },
  ],

  polls: [
    {
      key: "create-poll",
      title: "Create poll",
      description: "Launch a poll or AGM vote.",
      sections: [
        sec("Poll", [
          F("question", "Question", "text", { span: 2, required: true }),
          F("type", "Type", "radio", {
            span: 2,
            options: [
              { value: "single", label: "Single choice" },
              { value: "multi", label: "Multiple choice" },
              { value: "agm", label: "AGM resolution" },
            ],
          }),
          F("options", "Options (one per line)", "textarea", { span: 2, rows: 5, required: true }),
        ]),
        sec("Voting", [
          F("opens", "Opens", "datetime", { span: 1 }),
          F("closes", "Closes", "datetime", { span: 1 }),
          F("anonymous", "Anonymous voting", "switch", { span: 1 }),
          F("eligible", "Eligible voters", "select", {
            span: 1,
            options: [
              { value: "owners", label: "Owners only" },
              { value: "all", label: "All residents" },
            ],
          }),
        ]),
      ],
    },
    {
      key: "cast-vote",
      title: "Cast vote",
      description: "Vote on an open poll.",
      sections: [
        sec("Vote", [
          F("poll", "Poll", "select", {
            span: 2,
            options: [{ value: "1", label: "Lobby renovation budget" }],
          }),
          F("choice", "Your choice", "radio", {
            span: 2,
            options: [
              { value: "y", label: "Approve" },
              { value: "n", label: "Reject" },
              { value: "a", label: "Abstain" },
            ],
          }),
        ]),
      ],
    },
  ],

  events: [
    {
      key: "create-event",
      title: "Create event",
      description: "Add an event to the society calendar.",
      sections: [
        sec("Event", [
          F("title", "Title", "text", { span: 2, required: true }),
          F("cover", "Cover image", "file", { span: 2 }),
          F("start", "Starts", "datetime", { span: 1 }),
          F("end", "Ends", "datetime", { span: 1 }),
          F("venue", "Venue", "text", { span: 2 }),
          F("rsvp", "Enable RSVP", "switch", { span: 1, defaultValue: true }),
          F("capacity", "Capacity", "number", { span: 1 }),
        ]),
        sec("Details", [F("description", "Description", "textarea", { span: 2, rows: 6 })]),
      ],
    },
    {
      key: "rsvp",
      title: "RSVP",
      description: "Confirm attendance for an event.",
      sections: [
        sec("RSVP", [
          F("event", "Event", "select", {
            span: 2,
            options: [{ value: "1", label: "Diwali celebrations 2026" }],
          }),
          F("attending", "Attending?", "radio", {
            span: 1,
            options: [
              { value: "y", label: "Yes" },
              { value: "n", label: "No" },
              { value: "maybe", label: "Maybe" },
            ],
          }),
          F("guests", "Number of guests", "number", { span: 1 }),
          F("notes", "Note for organizer", "textarea", { span: 2, rows: 2 }),
        ]),
      ],
    },
  ],

  amenities: [
    {
      key: "add-amenity",
      title: "Add amenity",
      description: "Register a bookable amenity.",
      sections: [
        sec("Amenity", [
          F("name", "Name", "text", { span: 2, required: true, placeholder: "Banquet hall" }),
          F("category", "Category", "select", {
            span: 1,
            options: [
              { value: "hall", label: "Hall" },
              { value: "gym", label: "Gym" },
              { value: "pool", label: "Pool" },
              { value: "court", label: "Court" },
            ],
          }),
          F("capacity", "Capacity", "number", { span: 1 }),
        ]),
        sec("Rules", [
          F("slotMinutes", "Slot length (minutes)", "number", { span: 1, defaultValue: "60" }),
          F("openTime", "Opens", "time", { span: 1 }),
          F("closeTime", "Closes", "time", { span: 1 }),
          F("charge", "Charge per slot", "currency", { span: 1 }),
          F("deposit", "Refundable deposit", "currency", { span: 1 }),
          F("rules", "Booking rules", "textarea", { span: 2, rows: 4 }),
        ]),
      ],
    },
    {
      key: "book-slot",
      title: "Book amenity slot",
      description: "Reserve a time slot at an amenity.",
      submitLabel: "Confirm booking",
      sections: [
        sec("Booking", [
          F("amenity", "Amenity", "select", {
            span: 1,
            options: [{ value: "1", label: "Banquet hall" }],
          }),
          F("date", "Date", "date", { span: 1 }),
          F("from", "From", "time", { span: 1 }),
          F("to", "To", "time", { span: 1 }),
          F("guests", "Guests", "number", { span: 1 }),
          F("purpose", "Purpose", "text", { span: 1 }),
          F("payDeposit", "Pay refundable deposit", "switch", { span: 2, defaultValue: true }),
        ]),
      ],
    },
    {
      key: "deposit-refund",
      title: "Refund deposit",
      description: "Process a deposit refund after use.",
      sections: [
        sec("Refund", [
          F("booking", "Booking", "select", {
            span: 2,
            options: [{ value: "1", label: "Banquet hall — 12 Oct 2026" }],
          }),
          F("damages", "Deduct damages", "currency", { span: 1 }),
          F("refund", "Refund amount", "currency", { span: 1 }),
          F("notes", "Notes", "textarea", { span: 2, rows: 3 }),
        ]),
      ],
    },
  ],

  governance: [
    {
      key: "committee-member",
      title: "Add committee member",
      description: "Manage the managing committee roster.",
      sections: [
        sec("Member", [
          F("resident", "Resident", "select", {
            span: 1,
            options: [{ value: "1", label: "Asha Iyer" }],
          }),
          F("role", "Role", "select", {
            span: 1,
            options: [
              { value: "chair", label: "Chairperson" },
              { value: "secretary", label: "Secretary" },
              { value: "treasurer", label: "Treasurer" },
              { value: "member", label: "Member" },
            ],
          }),
          F("from", "Term from", "date", { span: 1 }),
          F("to", "Term to", "date", { span: 1 }),
        ]),
      ],
    },
    {
      key: "schedule-agm",
      title: "Schedule AGM",
      description: "Set up an Annual General Meeting.",
      sections: [
        sec("Meeting", [
          F("title", "Title", "text", { span: 2, required: true, placeholder: "AGM FY 2026-27" }),
          F("when", "Date & time", "datetime", { span: 1 }),
          F("venue", "Venue / Link", "text", { span: 1 }),
          F("quorum", "Quorum required", "number", { span: 1, suffix: "%" }),
        ]),
        sec("Agenda", [
          F("agenda", "Agenda items (one per line)", "textarea", { span: 2, rows: 6 }),
          F("notice", "Notice document", "file", { span: 2 }),
        ]),
      ],
    },
    {
      key: "resolution",
      title: "Create resolution",
      description: "Draft a resolution for committee voting.",
      sections: [
        sec("Resolution", [
          F("title", "Title", "text", { span: 2, required: true }),
          F("body", "Resolution text", "textarea", { span: 2, rows: 8 }),
          F("votingOpens", "Voting opens", "datetime", { span: 1 }),
          F("votingCloses", "Voting closes", "datetime", { span: 1 }),
        ]),
      ],
    },
  ],

  utility_meters: [
    {
      key: "add-meter",
      title: "Add utility meter",
      description: "Register a meter attached to a unit or common area.",
      sections: [
        sec("Meter", [
          F("type", "Type", "select", {
            span: 1,
            options: [
              { value: "water", label: "Water" },
              { value: "electricity", label: "Electricity" },
              { value: "gas", label: "Gas" },
            ],
          }),
          F("scope", "Scope", "select", {
            span: 1,
            options: [
              { value: "unit", label: "Per unit" },
              { value: "common", label: "Common area" },
            ],
          }),
          F("unit", "Unit", "select", { span: 1, options: [{ value: "1", label: "A-1204" }] }),
          F("serial", "Meter serial", "text", { span: 1 }),
          F("rate", "Rate per unit", "currency", { span: 1, suffix: "/ unit" }),
          F("opening", "Opening reading", "number", { span: 1 }),
        ]),
      ],
    },
    {
      key: "submit-reading",
      title: "Submit meter reading",
      description: "Capture a periodic meter reading.",
      sections: [
        sec("Reading", [
          F("meter", "Meter", "select", {
            span: 1,
            options: [{ value: "1", label: "Water — A-1204" }],
          }),
          F("date", "Reading date", "date", { span: 1, required: true }),
          F("reading", "Current reading", "number", { span: 1, required: true }),
          F("photo", "Meter photo", "file", { span: 1 }),
          F("autoCharge", "Auto-post charge to ledger", "switch", { span: 2, defaultValue: true }),
        ]),
      ],
    },
  ],

  ai_complaints: [
    {
      key: "settings",
      title: "AI complaint settings",
      description: "Tune auto-categorization & priority.",
      sections: [
        sec("AI", [
          F("autoCategorize", "Auto-categorize new complaints", "switch", {
            span: 1,
            defaultValue: true,
          }),
          F("autoPriority", "Suggest priority", "switch", { span: 1, defaultValue: true }),
          F("dupThreshold", "Duplicate similarity threshold", "number", {
            span: 1,
            suffix: "%",
            defaultValue: "85",
          }),
          F("escalationDays", "Auto-escalate after (days)", "number", {
            span: 1,
            defaultValue: "3",
          }),
        ]),
      ],
    },
  ],

  ai_finance: [
    {
      key: "settings",
      title: "AI finance settings",
      description: "Anomaly detection & forecasting.",
      sections: [
        sec("AI", [
          F("anomalies", "Detect expense anomalies", "switch", { span: 1, defaultValue: true }),
          F("sensitivity", "Anomaly sensitivity", "select", {
            span: 1,
            options: [
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ],
          }),
          F("forecast", "Forecast horizon (months)", "number", { span: 1, defaultValue: "6" }),
          F("notify", "Notify treasurer on anomaly", "switch", { span: 1, defaultValue: true }),
        ]),
      ],
    },
  ],

  ai_maintenance: [
    {
      key: "settings",
      title: "AI predictive maintenance",
      description: "Health scoring & failure prediction.",
      sections: [
        sec("AI", [
          F("healthScoring", "Enable health scoring", "switch", { span: 1, defaultValue: true }),
          F("predictWindow", "Failure prediction window (days)", "number", {
            span: 1,
            defaultValue: "30",
          }),
          F("autoWorkOrder", "Auto-create work order on high risk", "switch", { span: 2 }),
        ]),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Role-based extras — completes coverage for Super Admin, Society/Market/
// Apartment Admin, Owner-Resident, and Tenant flows.
// ---------------------------------------------------------------------------
const EXTRAS: Record<string, FormDef[]> = {
  platform: [
    {
      key: "create-plan",
      title: "Create subscription plan",
      description: "Super admin: define a billing plan for tenants.",
      submitLabel: "Create plan",
      sections: [
        sec("Plan", [
          F("name", "Plan name", "text", { required: true, span: 1, placeholder: "Professional" }),
          F("code", "Plan code", "text", { span: 1, placeholder: "pro" }),
          F("pricePerUnit", "Price per unit", "currency", { span: 1 }),
          F("billingCycle", "Billing cycle", "select", {
            span: 1,
            options: [
              { value: "monthly", label: "Monthly" },
              { value: "quarterly", label: "Quarterly" },
              { value: "yearly", label: "Yearly" },
            ],
          }),
          F("modules", "Bundled modules", "multiselect", {
            span: 2,
            options: MODULES.map((m) => ({ value: m.key, label: m.name })),
          }),
        ]),
        sec("Trial & limits", [
          F("trialDays", "Trial length (days)", "number", { span: 1, defaultValue: "30" }),
          F("maxUnits", "Max units", "number", { span: 1 }),
        ]),
      ],
    },
    {
      key: "assign-plan",
      title: "Assign plan to tenant",
      description: "Attach or upgrade a tenant's subscription.",
      sections: [
        sec("Assignment", [
          F("tenant", "Tenant", "select", {
            span: 1,
            required: true,
            options: [{ value: "1", label: "Green Pines Residency" }],
          }),
          F("plan", "Plan", "select", {
            span: 1,
            required: true,
            options: [
              { value: "starter", label: "Starter" },
              { value: "growth", label: "Growth" },
              { value: "professional", label: "Professional" },
              { value: "enterprise", label: "Enterprise" },
            ],
          }),
          F("startsOn", "Starts on", "date", { span: 1 }),
          F("proration", "Prorate first cycle", "switch", { span: 1, defaultValue: true }),
        ]),
      ],
    },
    {
      key: "suspend-tenant",
      title: "Suspend tenant",
      description: "Temporarily disable tenant access.",
      sections: [
        sec("Suspension", [
          F("tenant", "Tenant", "select", {
            span: 2,
            required: true,
            options: [{ value: "1", label: "Green Pines Residency" }],
          }),
          F("reason", "Reason", "select", {
            span: 1,
            options: [
              { value: "overdue", label: "Payment overdue" },
              { value: "abuse", label: "Terms violation" },
              { value: "request", label: "Owner request" },
            ],
          }),
          F("until", "Reactivate on", "date", { span: 1 }),
          F("notes", "Internal notes", "textarea", { span: 2, rows: 3 }),
        ]),
      ],
    },
    {
      key: "feature-flag",
      title: "Feature flag",
      description: "Enable an experimental capability for selected tenants.",
      sections: [
        sec("Flag", [
          F("key", "Flag key", "text", { span: 1, required: true, placeholder: "ai_forecast_v2" }),
          F("rollout", "Rollout %", "number", { span: 1, suffix: "%" }),
          F("tenants", "Limit to tenants", "multiselect", {
            span: 2,
            options: [{ value: "1", label: "Green Pines Residency" }],
          }),
          F("description", "Description", "textarea", { span: 2, rows: 2 }),
        ]),
      ],
    },
    {
      key: "platform-announcement",
      title: "Platform announcement",
      description: "Broadcast to every tenant workspace.",
      sections: [
        sec("Announcement", [
          F("title", "Title", "text", { span: 2, required: true }),
          F("body", "Message", "textarea", { span: 2, rows: 5 }),
          F("severity", "Severity", "radio", {
            span: 2,
            options: [
              { value: "info", label: "Info" },
              { value: "warning", label: "Warning" },
              { value: "critical", label: "Critical" },
            ],
          }),
          F("publishAt", "Publish at", "datetime", { span: 1 }),
        ]),
      ],
    },
    {
      key: "support-ticket",
      title: "Contact platform support",
      description: "Raise a ticket with HousingOS support.",
      sections: [
        sec("Ticket", [
          F("subject", "Subject", "text", { span: 2, required: true }),
          F("category", "Category", "select", {
            span: 1,
            options: [
              { value: "bug", label: "Bug" },
              { value: "billing", label: "Billing" },
              { value: "howto", label: "How-to" },
              { value: "feature", label: "Feature request" },
            ],
          }),
          F("priority", "Priority", "select", {
            span: 1,
            options: [
              { value: "low", label: "Low" },
              { value: "normal", label: "Normal" },
              { value: "high", label: "High" },
            ],
          }),
          F("description", "Describe the issue", "textarea", { span: 2, rows: 6 }),
          F("attachment", "Screenshot / log", "file", { span: 2 }),
        ]),
      ],
    },
  ],

  property: [
    {
      key: "bank-account",
      title: "Society bank account",
      description: "Bank account for collections and payouts.",
      sections: [
        sec("Bank", [
          F("accountName", "Account title", "text", { span: 2, required: true }),
          F("bank", "Bank", "text", { span: 1 }),
          F("branch", "Branch", "text", { span: 1 }),
          F("iban", "IBAN / Account number", "text", { span: 1, required: true }),
          F("swift", "SWIFT / IFSC", "text", { span: 1 }),
          F("primary", "Set as primary payout account", "switch", { span: 2 }),
        ]),
      ],
    },
    {
      key: "payment-gateway",
      title: "Payment gateway",
      description: "Connect an online payment provider.",
      sections: [
        sec("Gateway", [
          F("provider", "Provider", "select", {
            span: 1,
            required: true,
            options: [
              { value: "jazzcash", label: "JazzCash" },
              { value: "easypaisa", label: "Easypaisa" },
              { value: "stripe", label: "Stripe" },
              { value: "razorpay", label: "Razorpay" },
            ],
          }),
          F("mode", "Mode", "radio", {
            span: 1,
            options: [
              { value: "test", label: "Test" },
              { value: "live", label: "Live" },
            ],
          }),
          F("merchantId", "Merchant ID", "text", { span: 1 }),
          F("apiKey", "API key", "password", { span: 1 }),
          F("secret", "API secret", "password", { span: 2 }),
        ]),
      ],
    },
    {
      key: "tax-profile",
      title: "Tax profile",
      description: "GST / VAT registration details for invoices.",
      sections: [
        sec("Tax", [
          F("regime", "Tax regime", "select", {
            span: 1,
            options: [
              { value: "gst", label: "India GST" },
              { value: "vat", label: "UAE VAT" },
              { value: "none", label: "None" },
            ],
          }),
          F("number", "Registration number", "text", { span: 1 }),
          F("rate", "Default rate", "number", { span: 1, suffix: "%" }),
          F("hsn", "Default HSN / SAC", "text", { span: 1 }),
        ]),
      ],
    },
    {
      key: "late-fee-rule",
      title: "Late fee rule",
      description: "Automatic penalty on overdue charges.",
      sections: [
        sec("Rule", [
          F("name", "Rule name", "text", {
            span: 2,
            required: true,
            placeholder: "Maintenance late fee",
          }),
          F("graceDays", "Grace period (days)", "number", { span: 1, defaultValue: "7" }),
          F("mode", "Charge mode", "radio", {
            span: 1,
            options: [
              { value: "flat", label: "Flat amount" },
              { value: "percent", label: "% of overdue" },
            ],
          }),
          F("amount", "Amount / percent", "number", { span: 1, required: true }),
          F("compounding", "Recur monthly until paid", "switch", { span: 1, defaultValue: true }),
        ]),
      ],
    },
    {
      key: "holiday-calendar",
      title: "Holiday calendar",
      description: "Non-working days for the society office.",
      sections: [
        sec("Holiday", [
          F("name", "Holiday name", "text", { span: 2, required: true }),
          F("date", "Date", "date", { span: 1, required: true }),
          F("recurring", "Repeat every year", "switch", { span: 1 }),
        ]),
      ],
    },
    {
      key: "register-shop",
      title: "Register shop / stall",
      description: "Commercial unit for markets and mixed-use societies.",
      sections: [
        sec("Shop", [
          F("shopNo", "Shop number", "text", { span: 1, required: true, placeholder: "M-14" }),
          F("floor", "Floor", "text", { span: 1 }),
          F("category", "Category", "select", {
            span: 1,
            options: [
              { value: "grocery", label: "Grocery" },
              { value: "food", label: "Food & beverage" },
              { value: "services", label: "Services" },
              { value: "retail", label: "Retail" },
              { value: "other", label: "Other" },
            ],
          }),
          F("area", "Area (sq ft)", "number", { span: 1 }),
        ]),
        sec("Tenancy", [
          F("owner", "Owner", "select", { span: 1, options: [{ value: "1", label: "Search…" }] }),
          F("tradeLicence", "Trade licence no.", "text", { span: 1 }),
          F("rentAmount", "Monthly rent", "currency", { span: 1 }),
          F("deposit", "Security deposit", "currency", { span: 1 }),
        ]),
      ],
    },
    {
      key: "lease-agreement",
      title: "Lease / rent agreement",
      description: "Upload a lease for an apartment or shop.",
      sections: [
        sec("Lease", [
          F("unit", "Unit / shop", "select", {
            span: 1,
            required: true,
            options: [{ value: "1", label: "A-1204" }],
          }),
          F("tenant", "Tenant", "select", {
            span: 1,
            required: true,
            options: [{ value: "1", label: "Search…" }],
          }),
          F("startDate", "Start date", "date", { span: 1, required: true }),
          F("endDate", "End date", "date", { span: 1 }),
          F("rent", "Rent amount", "currency", { span: 1 }),
          F("deposit", "Security deposit", "currency", { span: 1 }),
          F("document", "Signed agreement PDF", "file", { span: 2 }),
        ]),
      ],
    },
  ],

  residents: [
    {
      key: "household-member",
      title: "Add household member",
      description: "Family members living in the unit.",
      sections: [
        sec("Member", [
          F("unit", "Unit", "select", { span: 1, options: [{ value: "1", label: "A-1204" }] }),
          F("name", "Full name", "text", { span: 1, required: true }),
          F("relation", "Relationship", "select", {
            span: 1,
            options: [
              { value: "spouse", label: "Spouse" },
              { value: "child", label: "Child" },
              { value: "parent", label: "Parent" },
              { value: "sibling", label: "Sibling" },
              { value: "other", label: "Other" },
            ],
          }),
          F("dob", "Date of birth", "date", { span: 1 }),
          F("phone", "Phone", "tel", { span: 1 }),
          F("idCard", "CNIC / ID (optional)", "text", { span: 1 }),
        ]),
      ],
    },
    {
      key: "pet-registration",
      title: "Register a pet",
      description: "Society pet registry.",
      sections: [
        sec("Pet", [
          F("unit", "Unit", "select", { span: 1, options: [{ value: "1", label: "A-1204" }] }),
          F("name", "Pet name", "text", { span: 1, required: true }),
          F("species", "Species", "select", {
            span: 1,
            options: [
              { value: "dog", label: "Dog" },
              { value: "cat", label: "Cat" },
              { value: "bird", label: "Bird" },
              { value: "other", label: "Other" },
            ],
          }),
          F("breed", "Breed", "text", { span: 1 }),
          F("vaccination", "Vaccination certificate", "file", { span: 2 }),
        ]),
      ],
    },
    {
      key: "resident-vehicle",
      title: "Register vehicle",
      description: "Personal vehicle linked to a unit.",
      sections: [
        sec("Vehicle", [
          F("unit", "Unit", "select", { span: 1, options: [{ value: "1", label: "A-1204" }] }),
          F("regNo", "Registration number", "text", {
            span: 1,
            required: true,
            placeholder: "ABC-123",
          }),
          F("type", "Type", "select", {
            span: 1,
            options: [
              { value: "car", label: "Car" },
              { value: "bike", label: "Motorbike" },
              { value: "suv", label: "SUV" },
              { value: "cycle", label: "Bicycle" },
            ],
          }),
          F("colorMake", "Colour & make", "text", { span: 1, placeholder: "White Honda City" }),
          F("stickerNo", "Society sticker no.", "text", { span: 1 }),
          F("photo", "Photo", "file", { span: 1 }),
        ]),
      ],
    },
    {
      key: "domestic-staff",
      title: "Domestic help / staff pass",
      description: "Maid, driver, cook or nanny working for a unit.",
      sections: [
        sec("Staff", [
          F("name", "Full name", "text", { span: 1, required: true }),
          F("role", "Role", "select", {
            span: 1,
            options: [
              { value: "maid", label: "Maid" },
              { value: "driver", label: "Driver" },
              { value: "cook", label: "Cook" },
              { value: "nanny", label: "Nanny" },
              { value: "other", label: "Other" },
            ],
          }),
          F("phone", "Phone", "tel", { span: 1 }),
          F("idCard", "CNIC / ID number", "text", { span: 1 }),
          F("photo", "Photo", "file", { span: 1 }),
        ]),
        sec("Access", [
          F("unit", "Serving unit", "select", {
            span: 1,
            options: [{ value: "1", label: "A-1204" }],
          }),
          F("timings", "Timings", "text", { span: 1, placeholder: "8 AM – 12 PM" }),
          F("policeVerified", "Police verified", "switch", { span: 2 }),
        ]),
      ],
    },
    {
      key: "tenant-kyc",
      title: "Tenant onboarding & KYC",
      description: "Verify a new tenant with ID and lease documents.",
      wizard: true,
      sections: [
        sec("Tenant details", [
          F("firstName", "First name", "text", { span: 1, required: true }),
          F("lastName", "Last name", "text", { span: 1, required: true }),
          F("email", "Email", "email", { span: 1 }),
          F("phone", "Phone", "tel", { span: 1, required: true }),
        ]),
        sec("KYC documents", [
          F("idType", "ID type", "select", {
            span: 1,
            options: [
              { value: "cnic", label: "CNIC" },
              { value: "passport", label: "Passport" },
              { value: "aadhaar", label: "Aadhaar" },
            ],
          }),
          F("idNumber", "ID number", "text", { span: 1, required: true }),
          F("idFront", "ID front", "file", { span: 1 }),
          F("idBack", "ID back", "file", { span: 1 }),
        ]),
        sec("Lease", [
          F("unit", "Unit", "select", {
            span: 1,
            required: true,
            options: [{ value: "1", label: "A-1204" }],
          }),
          F("moveIn", "Move-in date", "date", { span: 1, required: true }),
          F("leaseEnd", "Lease end date", "date", { span: 1 }),
          F("rent", "Monthly rent", "currency", { span: 1 }),
          F("agreement", "Signed lease PDF", "file", { span: 2 }),
        ]),
      ],
    },
    {
      key: "notice-to-vacate",
      title: "Notice to vacate",
      description: "Tenant intent to move out.",
      sections: [
        sec("Notice", [
          F("unit", "Unit", "select", { span: 1, options: [{ value: "1", label: "A-1204" }] }),
          F("moveOutDate", "Intended move-out date", "date", { span: 1, required: true }),
          F("reason", "Reason", "select", {
            span: 1,
            options: [
              { value: "relocation", label: "Relocation" },
              { value: "purchase", label: "Bought own home" },
              { value: "personal", label: "Personal" },
              { value: "other", label: "Other" },
            ],
          }),
          F("forwarding", "Forwarding address", "textarea", { span: 2, rows: 3 }),
          F("acknowledge", "I understand the 30-day notice policy", "checkbox", { span: 2 }),
        ]),
      ],
    },
    {
      key: "lease-renewal",
      title: "Request lease renewal",
      description: "Tenant asks to extend the current lease.",
      sections: [
        sec("Renewal", [
          F("unit", "Unit", "select", { span: 1, options: [{ value: "1", label: "A-1204" }] }),
          F("newEnd", "Requested new end date", "date", { span: 1, required: true }),
          F("proposedRent", "Proposed rent", "currency", { span: 1 }),
          F("comments", "Comments to owner", "textarea", { span: 2, rows: 3 }),
        ]),
      ],
    },
    {
      key: "move-out-inspection",
      title: "Move-out inspection",
      description: "Checklist filled at handover.",
      sections: [
        sec("Condition", [
          F("walls", "Walls & paint OK", "switch", { span: 1, defaultValue: true }),
          F("plumbing", "Plumbing OK", "switch", { span: 1, defaultValue: true }),
          F("electrical", "Electrical OK", "switch", { span: 1, defaultValue: true }),
          F("appliances", "Appliances working", "switch", { span: 1, defaultValue: true }),
        ]),
        sec("Deductions", [
          F("deductions", "Deduction description", "textarea", { span: 2, rows: 3 }),
          F("deductionAmount", "Total deduction", "currency", { span: 1 }),
          F("photos", "Inspection photos", "file", { span: 1 }),
        ]),
      ],
    },
    {
      key: "resident-feedback",
      title: "Feedback / rating",
      description: "Rate a service or share suggestions.",
      sections: [
        sec("Feedback", [
          F("area", "Area", "select", {
            span: 1,
            options: [
              { value: "security", label: "Security" },
              { value: "cleaning", label: "Cleaning" },
              { value: "maintenance", label: "Maintenance" },
              { value: "office", label: "Society office" },
            ],
          }),
          F("rating", "Rating", "radio", {
            span: 1,
            options: [
              { value: "1", label: "1" },
              { value: "2", label: "2" },
              { value: "3", label: "3" },
              { value: "4", label: "4" },
              { value: "5", label: "5" },
            ],
          }),
          F("comments", "Comments", "textarea", { span: 2, rows: 4 }),
        ]),
      ],
    },
  ],

  payments: [
    {
      key: "pay-bill",
      title: "Pay a bill",
      description: "Resident checkout for outstanding charges.",
      submitLabel: "Pay now",
      sections: [
        sec("Bill", [
          F("unit", "Unit", "select", { span: 1, options: [{ value: "1", label: "A-1204" }] }),
          F("invoice", "Invoice / charge", "select", {
            span: 1,
            options: [{ value: "1", label: "INV-2026-004 · ₨12,500" }],
          }),
          F("amount", "Amount", "currency", { span: 1, required: true }),
        ]),
        sec("Method", [
          F("method", "Payment method", "radio", {
            span: 2,
            options: [
              { value: "card", label: "Card" },
              { value: "jazzcash", label: "JazzCash" },
              { value: "easypaisa", label: "Easypaisa" },
              { value: "bank", label: "Bank transfer" },
            ],
          }),
          F("saveMethod", "Save method for next time", "switch", { span: 2 }),
        ]),
      ],
    },
    {
      key: "receipt-request",
      title: "Request receipt / statement",
      description: "Email a receipt or a ledger statement.",
      sections: [
        sec("Request", [
          F("unit", "Unit", "select", { span: 1, options: [{ value: "1", label: "A-1204" }] }),
          F("type", "Document type", "select", {
            span: 1,
            options: [
              { value: "receipt", label: "Payment receipt" },
              { value: "statement", label: "Ledger statement" },
              { value: "noc", label: "No-dues certificate" },
            ],
          }),
          F("from", "From", "date", { span: 1 }),
          F("to", "To", "date", { span: 1 }),
          F("email", "Send to email", "email", { span: 2 }),
        ]),
      ],
    },
  ],

  amenities: [
    {
      key: "cancel-booking",
      title: "Cancel amenity booking",
      description: "Cancel an existing slot with optional refund.",
      sections: [
        sec("Cancellation", [
          F("booking", "Booking", "select", {
            span: 2,
            required: true,
            options: [{ value: "1", label: "Community hall · 12 Jul, 6 PM" }],
          }),
          F("reason", "Reason", "select", {
            span: 1,
            options: [
              { value: "personal", label: "Personal" },
              { value: "conflict", label: "Time conflict" },
              { value: "weather", label: "Weather" },
              { value: "other", label: "Other" },
            ],
          }),
          F("refund", "Refund deposit", "switch", { span: 1, defaultValue: true }),
          F("notes", "Notes", "textarea", { span: 2, rows: 2 }),
        ]),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Final coverage pass — fills gaps across gate, governance, vendors, meters,
// notifications, financial transparency, notice board, documents, and more.
// ---------------------------------------------------------------------------
const EXTRAS2: Record<string, FormDef[]> = {
  gate: [
    {
      key: "shift-handover",
      title: "Guard shift handover",
      description: "Log-out summary passed to the next shift.",
      sections: [
        sec("Handover", [
          F("outgoingGuard", "Outgoing guard", "text", { span: 1, required: true }),
          F("incomingGuard", "Incoming guard", "text", { span: 1, required: true }),
          F("openVisitors", "Visitors still inside", "number", { span: 1 }),
          F("keysHanded", "Keys handed over", "number", { span: 1 }),
          F("notes", "Notes & pending items", "textarea", { span: 2, rows: 4 }),
        ]),
      ],
    },
    {
      key: "gate-incident",
      title: "Gate incident report",
      description: "Report an unusual event at the gate.",
      sections: [
        sec("Incident", [
          F("occurredAt", "Occurred at", "datetime", { span: 1, required: true }),
          F("severity", "Severity", "select", {
            span: 1,
            options: [
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ],
          }),
          F("category", "Category", "select", {
            span: 1,
            options: [
              { value: "trespass", label: "Trespass" },
              { value: "vehicle", label: "Vehicle issue" },
              { value: "altercation", label: "Altercation" },
              { value: "other", label: "Other" },
            ],
          }),
          F("involved", "Persons / vehicles involved", "text", { span: 1 }),
          F("description", "Description", "textarea", { span: 2, rows: 5, required: true }),
          F("attachment", "Photo / CCTV clip", "file", { span: 2 }),
        ]),
      ],
    },
  ],

  governance: [
    {
      key: "agm-minutes",
      title: "Record AGM minutes",
      description: "Publish minutes of the Annual General Meeting.",
      wizard: true,
      sections: [
        sec("Meeting", [
          F("title", "Meeting title", "text", { span: 2, required: true }),
          F("date", "Date", "date", { span: 1, required: true }),
          F("chair", "Chair", "text", { span: 1 }),
          F("attendance", "Attendance count", "number", { span: 1 }),
          F("quorum", "Quorum met", "switch", { span: 1, defaultValue: true }),
        ]),
        sec("Minutes", [
          F("agenda", "Agenda covered", "textarea", { span: 2, rows: 4 }),
          F("decisions", "Decisions & resolutions", "textarea", { span: 2, rows: 6 }),
          F("actions", "Action items", "textarea", { span: 2, rows: 4 }),
        ]),
        sec("Attachments", [
          F("attendanceSheet", "Attendance sheet", "file", { span: 1 }),
          F("signedMinutes", "Signed minutes PDF", "file", { span: 1 }),
        ]),
      ],
    },
    {
      key: "election-nomination",
      title: "Committee election nomination",
      description: "Nominate a resident for a committee post.",
      sections: [
        sec("Nomination", [
          F("post", "Post", "select", {
            span: 1,
            required: true,
            options: [
              { value: "president", label: "President" },
              { value: "secretary", label: "Secretary" },
              { value: "treasurer", label: "Treasurer" },
              { value: "member", label: "Member" },
            ],
          }),
          F("nominee", "Nominee", "text", { span: 1, required: true }),
          F("proposer", "Proposer", "text", { span: 1 }),
          F("seconder", "Seconder", "text", { span: 1 }),
          F("statement", "Candidate statement", "textarea", { span: 2, rows: 4 }),
        ]),
      ],
    },
  ],

  vendors: [
    {
      key: "vendor-self-onboarding",
      title: "Vendor self-onboarding",
      description: "Public form for vendors to apply for empanelment.",
      wizard: true,
      sections: [
        sec("Company", [
          F("companyName", "Company name", "text", { span: 2, required: true }),
          F("category", "Service category", "select", {
            span: 1,
            required: true,
            options: [
              { value: "plumbing", label: "Plumbing" },
              { value: "electrical", label: "Electrical" },
              { value: "cleaning", label: "Cleaning" },
              { value: "security", label: "Security" },
              { value: "landscaping", label: "Landscaping" },
              { value: "other", label: "Other" },
            ],
          }),
          F("yearsInBusiness", "Years in business", "number", { span: 1 }),
        ]),
        sec("Contact", [
          F("contactName", "Contact person", "text", { span: 1, required: true }),
          F("phone", "Phone", "tel", { span: 1, required: true }),
          F("email", "Email", "email", { span: 2, required: true }),
          F("address", "Office address", "textarea", { span: 2, rows: 2 }),
        ]),
        sec("Compliance", [
          F("taxNumber", "Tax registration no.", "text", { span: 1 }),
          F("tradeLicence", "Trade licence", "file", { span: 1 }),
          F("insurance", "Insurance certificate", "file", { span: 1 }),
          F("references", "Client references", "textarea", { span: 2, rows: 3 }),
        ]),
      ],
    },
  ],

  utility_meters: [
    {
      key: "generate-bills",
      title: "Generate utility bills",
      description: "Batch-generate bills from meter readings.",
      sections: [
        sec("Batch", [
          F("period", "Billing period", "text", {
            span: 1,
            required: true,
            placeholder: "Jul 2026",
          }),
          F("meterType", "Meter type", "select", {
            span: 1,
            options: [
              { value: "electricity", label: "Electricity" },
              { value: "water", label: "Water" },
              { value: "gas", label: "Gas" },
            ],
          }),
          F("ratePerUnit", "Rate per unit", "currency", { span: 1, required: true }),
          F("fixedCharge", "Fixed charge", "currency", { span: 1 }),
          F("dueDate", "Due date", "date", { span: 1 }),
          F("notify", "Email residents on generation", "switch", { span: 2, defaultValue: true }),
        ]),
      ],
    },
    {
      key: "meter-dispute",
      title: "Meter reading dispute",
      description: "Resident challenges a reading or bill.",
      sections: [
        sec("Dispute", [
          F("unit", "Unit", "select", { span: 1, options: [{ value: "1", label: "A-1204" }] }),
          F("period", "Billing period", "text", { span: 1, required: true }),
          F("claimedReading", "Claimed correct reading", "number", { span: 1 }),
          F("evidence", "Meter photo", "file", { span: 1 }),
          F("notes", "Explanation", "textarea", { span: 2, rows: 4, required: true }),
        ]),
      ],
    },
  ],

  notifications: [
    {
      key: "broadcast-schedule",
      title: "Schedule broadcast",
      description: "Queue a broadcast for a future date and time.",
      sections: [
        sec("Schedule", [
          F("title", "Title", "text", { span: 2, required: true }),
          F("channels", "Channels", "multiselect", {
            span: 2,
            required: true,
            options: [
              { value: "email", label: "Email" },
              { value: "sms", label: "SMS" },
              { value: "push", label: "Push" },
              { value: "whatsapp", label: "WhatsApp" },
            ],
          }),
          F("audience", "Audience", "select", {
            span: 1,
            options: [
              { value: "all", label: "All residents" },
              { value: "owners", label: "Owners only" },
              { value: "tenants", label: "Tenants only" },
              { value: "committee", label: "Committee" },
            ],
          }),
          F("sendAt", "Send at", "datetime", { span: 1, required: true }),
          F("body", "Message", "textarea", { span: 2, rows: 5, required: true }),
        ]),
      ],
    },
    {
      key: "subscription-preferences",
      title: "Notification preferences",
      description: "Choose which notifications you receive.",
      sections: [
        sec("Preferences", [
          F("billing", "Billing & payments", "switch", { span: 1, defaultValue: true }),
          F("maintenance", "Maintenance updates", "switch", { span: 1, defaultValue: true }),
          F("events", "Events & bookings", "switch", { span: 1, defaultValue: true }),
          F("notices", "Notices & announcements", "switch", { span: 1, defaultValue: true }),
          F("marketing", "Offers from partners", "switch", { span: 1 }),
          F("quietFrom", "Quiet hours from", "time", { span: 1 }),
          F("quietTo", "Quiet hours to", "time", { span: 1 }),
        ]),
      ],
    },
  ],

  financial_transparency: [
    {
      key: "expense-disclosure",
      title: "Publish expense disclosure",
      description: "Line-item expense visible to all residents.",
      sections: [
        sec("Expense", [
          F("category", "Category", "select", {
            span: 1,
            required: true,
            options: [
              { value: "security", label: "Security" },
              { value: "cleaning", label: "Cleaning" },
              { value: "utilities", label: "Utilities" },
              { value: "repairs", label: "Repairs" },
              { value: "office", label: "Office" },
              { value: "other", label: "Other" },
            ],
          }),
          F("amount", "Amount", "currency", { span: 1, required: true }),
          F("paidTo", "Paid to", "text", { span: 1 }),
          F("date", "Date", "date", { span: 1 }),
          F("description", "Description", "textarea", { span: 2, rows: 3 }),
          F("receipt", "Attach receipt", "file", { span: 2 }),
        ]),
      ],
    },
    {
      key: "donation-record",
      title: "Record donation",
      description: "Log a donation received from a resident or sponsor.",
      sections: [
        sec("Donation", [
          F("donor", "Donor name", "text", { span: 1, required: true }),
          F("amount", "Amount", "currency", { span: 1, required: true }),
          F("purpose", "Purpose", "text", { span: 2 }),
          F("date", "Date received", "date", { span: 1 }),
          F("mode", "Mode", "select", {
            span: 1,
            options: [
              { value: "cash", label: "Cash" },
              { value: "bank", label: "Bank transfer" },
              { value: "cheque", label: "Cheque" },
            ],
          }),
          F("receipt", "Receipt PDF", "file", { span: 2 }),
        ]),
      ],
    },
  ],

  documents: [
    {
      key: "request-document",
      title: "Request a document",
      description: "Ask the society office for a document.",
      sections: [
        sec("Request", [
          F("unit", "Unit", "select", { span: 1, options: [{ value: "1", label: "A-1204" }] }),
          F("type", "Document type", "select", {
            span: 1,
            required: true,
            options: [
              { value: "noc", label: "No-objection certificate" },
              { value: "resale", label: "Resale certificate" },
              { value: "bylaws", label: "Society by-laws" },
              { value: "other", label: "Other" },
            ],
          }),
          F("purpose", "Purpose", "text", { span: 2 }),
          F("urgency", "Urgency", "select", {
            span: 1,
            options: [
              { value: "normal", label: "Normal" },
              { value: "urgent", label: "Urgent" },
            ],
          }),
          F("email", "Deliver to email", "email", { span: 1 }),
        ]),
      ],
    },
  ],

  notice_board: [
    {
      key: "archive-notice",
      title: "Archive notice",
      description: "Move an active notice to the archive.",
      sections: [
        sec("Archive", [
          F("notice", "Notice", "select", {
            span: 2,
            required: true,
            options: [{ value: "1", label: "Water shutdown — 12 Jul" }],
          }),
          F("reason", "Reason", "textarea", { span: 2, rows: 3 }),
        ]),
      ],
    },
  ],

  payments: [
    {
      key: "auto-debit-setup",
      title: "Set up auto-debit",
      description: "Automatically settle monthly charges from a saved method.",
      sections: [
        sec("Auto-debit", [
          F("unit", "Unit", "select", { span: 1, options: [{ value: "1", label: "A-1204" }] }),
          F("method", "Saved method", "select", {
            span: 1,
            required: true,
            options: [
              { value: "card1", label: "Visa •• 4242" },
              { value: "bank1", label: "HBL •• 1234" },
            ],
          }),
          F("dayOfMonth", "Charge on day of month", "number", { span: 1, defaultValue: "5" }),
          F("cap", "Max amount per cycle", "currency", { span: 1 }),
          F("consent", "I authorise recurring debits", "checkbox", { span: 2, required: true }),
        ]),
      ],
    },
    {
      key: "rent-receipt",
      title: "Issue rent receipt",
      description: "Owner issues a rent receipt to a tenant.",
      sections: [
        sec("Receipt", [
          F("unit", "Unit", "select", { span: 1, options: [{ value: "1", label: "A-1204" }] }),
          F("tenant", "Tenant", "text", { span: 1, required: true }),
          F("period", "Rent period", "text", { span: 1, required: true, placeholder: "Jul 2026" }),
          F("amount", "Amount received", "currency", { span: 1, required: true }),
          F("mode", "Payment mode", "select", {
            span: 1,
            options: [
              { value: "cash", label: "Cash" },
              { value: "bank", label: "Bank transfer" },
              { value: "cheque", label: "Cheque" },
              { value: "online", label: "Online" },
            ],
          }),
          F("date", "Received on", "date", { span: 1 }),
          F("notes", "Notes", "textarea", { span: 2, rows: 2 }),
        ]),
      ],
    },
  ],

  property: [
    {
      key: "bulk-import-residents",
      title: "Bulk import residents",
      description: "Upload a CSV of residents. Validated before import.",
      sections: [
        sec("Upload", [
          F("file", "Residents CSV", "file", { span: 2, required: true }),
          F("dedupe", "Skip duplicates by email", "switch", { span: 2, defaultValue: true }),
          F("notify", "Send welcome email on import", "switch", { span: 2 }),
        ]),
      ],
    },
  ],

  complaints: [
    {
      key: "escalate",
      title: "Escalate complaint",
      description: "Escalate to committee or vendor SLA breach.",
      sections: [
        sec("Escalation", [
          F("complaint", "Complaint", "select", {
            span: 2,
            required: true,
            options: [{ value: "1", label: "#4821 — Lift stuck on 4th floor" }],
          }),
          F("to", "Escalate to", "select", {
            span: 1,
            options: [
              { value: "committee", label: "Committee" },
              { value: "vendor", label: "Vendor manager" },
              { value: "president", label: "President" },
            ],
          }),
          F("reason", "Reason", "textarea", { span: 2, rows: 4, required: true }),
        ]),
      ],
    },
  ],
};

for (const [k, arr] of Object.entries(EXTRAS)) {
  (REGISTRY[k] ??= []).push(...arr);
}
for (const [k, arr] of Object.entries(EXTRAS2)) {
  (REGISTRY[k] ??= []).push(...arr);
}

export function getFormsForModule(moduleKey: string): FormDef[] {
  return REGISTRY[moduleKey] ?? [];
}

export function getForm(moduleKey: string, formKey: string): FormDef | undefined {
  return REGISTRY[moduleKey]?.find((f) => f.key === formKey);
}

export function getModuleWithForms(): { module: ModuleDef; forms: FormDef[] }[] {
  return MODULES.map((m) => ({ module: m, forms: getFormsForModule(m.key) })).filter(
    (x) => x.forms.length > 0,
  );
}

export function totalFormCount(): number {
  return Object.values(REGISTRY).reduce((n, arr) => n + arr.length, 0);
}
