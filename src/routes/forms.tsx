import { createFileRoute, Outlet } from "@tanstack/react-router";

// This file is a LAYOUT route for /forms and all its children.
// The actual /forms catalog lives in forms.index.tsx (index route).
// Child routes like /forms/$module/$form render via <Outlet />.
export const Route = createFileRoute("/forms")({
  component: () => <Outlet />,
});
