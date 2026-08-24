import { ReactNode } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import { AccessDenied } from "./access-denied";

interface PermissionGateProps {
  moduleKey: string;
  action?: "view" | "create" | "edit" | "delete";
  children: ReactNode;
  fallback?: ReactNode;
  showDenied?: boolean;
}

export function PermissionGate({ 
  moduleKey, 
  action = "view", 
  children, 
  fallback,
  showDenied = true,
}: PermissionGateProps) {
  const { canView, canCreate, canEdit, canDelete, isLoading } = usePermissions();
  const { roles } = useAuth();
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  
  // Super admin and society admin always have access
  const isAdmin = roles.some(r => 
    r === "super_admin" || r === "society_admin"
  );
  if (isAdmin) return <>{children}</>;
  
  // Permission check based on action
  const hasAccess = 
    action === "view" ? canView(moduleKey) :
    action === "create" ? canCreate(moduleKey) :
    action === "edit" ? canEdit(moduleKey) :
    action === "delete" ? canDelete(moduleKey) : false;
  
  if (!hasAccess) {
    // If fallback is explicitly provided, use it (can be null for hiding buttons)
    if (fallback !== undefined) {
      return <>{fallback}</>;
    }
    
    // If showDenied is false, return null (hide completely)
    if (!showDenied) {
      return null;
    }
    
    // Default: show access denied message
    return (
      <AccessDenied 
        title="Access Denied" 
        message={`You don't have ${action} permission for this module.`}
      />
    );
  }
  
  return <>{children}</>;
}
