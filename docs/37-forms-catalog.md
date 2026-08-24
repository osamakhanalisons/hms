# Dynamic Forms Catalog

AT-BMS uses a dynamic JSON metadata structure to render administrative forms.

## Form Renderer Configurations
- Form schemas define:
  - Fields (input, select, textarea, date).
  - Validation rules (required, min/max limits, regex parameters).
- This structure allows admins to add custom fields to forms (such as visitor check-in fields) without modifying backend database schemas.
