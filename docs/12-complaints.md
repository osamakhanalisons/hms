# Complaints Management

Allows residents to log complaints, and managers to coordinate resolution workflows.

## Complaint Lifecycle
```
[Open] ──> [Assigned] ──> [In Progress] ──> [Resolved] ──> [Closed]
```

## Key Workflows
- **Raise Complaint**: Residents fill out a form specifying category (lift, plumbing, electrical, security), priority (low, medium, high, critical), description, and attachment.
- **Assign Technician**: Admin updates status to `assigned` and selects a technician profile.
- **Comments Thread**: Both residents and admins can post comments to update progress.
- **Resolution Verification**: The resident has the authority to verify the work and mark the ticket as officially `closed`.
