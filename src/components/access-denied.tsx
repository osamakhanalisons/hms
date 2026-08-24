import { ShieldAlert } from "lucide-react";
import { Button } from "./ui/button";
import { AppShell } from "./app-shell";

interface AccessDeniedProps {
  title?: string;
  message?: string;
  showBackButton?: boolean;
}



export function AccessDenied({ 
  title = "Access Denied", 
  message = "You don't have permission to view this page.",
  showBackButton = true 
}: AccessDeniedProps) {
  return (
    <AppShell title={title} subtitle="Unauthorized">
      <div className="mx-auto max-w-md py-16 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-bold font-serif">{title}</h2>
        <p className="text-xs text-muted-foreground">{message}</p>
        {showBackButton && (
          <Button onClick={() => window.history.back()} variant="outline" className="mt-4">
            Go Back
          </Button>
        )}
      </div>
    </AppShell>
  );
}
