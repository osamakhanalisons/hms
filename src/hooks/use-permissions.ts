import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { getMyPermissionsFn } from "@/lib/api/permissions";

interface Permission {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface PermissionsMap {
  [moduleKey: string]: Permission;
}

export function usePermissions() {
  const { session, user, roles } = useAuth();
  const userId = session?.user?.id || user?.id;
  
  const { data: permissionsArray = [], isLoading } = useQuery({
    queryKey: ["my-permissions", userId],
    queryFn: async () => {
      const data = await getMyPermissionsFn();
      return data || [];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Convert array to map for easier access - memoized to keep reference stable
  const permissions = useMemo(() => {
    const map: PermissionsMap = {};
    permissionsArray.forEach((perm: any) => {
      map[perm.module_key] = {
        can_view: perm.can_view,
        can_create: perm.can_create,
        can_edit: perm.can_edit,
        can_delete: perm.can_delete,
      };
    });
    return map;
  }, [permissionsArray]);

  // Helper functions - wrapped in useCallback to keep references stable
  
  const canView = useCallback((moduleKey: string): boolean => {
    // Super admin has full access
    if (roles.includes("super_admin")) return true;
    // Society admin has full access
    if (roles.includes("society_admin")) return true;
    return permissions[moduleKey]?.can_view ?? false;
  }, [roles, permissions]);
  
  const canCreate = useCallback((moduleKey: string): boolean => {
    if (roles.includes("super_admin")) return true;
    if (roles.includes("society_admin")) return true;
    return permissions[moduleKey]?.can_create ?? false;
  }, [roles, permissions]);
  
  const canEdit = useCallback((moduleKey: string): boolean => {
    if (roles.includes("super_admin")) return true;
    if (roles.includes("society_admin")) return true;
    return permissions[moduleKey]?.can_edit ?? false;
  }, [roles, permissions]);
  
  const canDelete = useCallback((moduleKey: string): boolean => {
    if (roles.includes("super_admin")) return true;
    if (roles.includes("society_admin")) return true;
    return permissions[moduleKey]?.can_delete ?? false;
  }, [roles, permissions]);
  
  const hasModuleAccess = useCallback((moduleKey: string): boolean => {
    return canView(moduleKey);
  }, [canView]);
  
  return {
    permissions,
    isLoading,
    canView,
    canCreate,
    canEdit,
    canDelete,
    hasModuleAccess,
  };
}
