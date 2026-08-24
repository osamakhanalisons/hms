# Frontend Navigation Filtering

The sidebar and main dashboard navigation items dynamically filter out based on permissions.

## Sidebar Filter Logic
- Navigation arrays map to feature module keys.
- On render, the sidebar matches entries against the user's permissions:
  - If a user has no view permission for a module, the sidebar hides the link.
  - If the module is deactivated in the society settings, the route is completely omitted from the navigation menu.
