import { useAuth } from "@/contexts/AuthContext";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";

const REDIRECT_KEY = 'auth_redirect_path';

interface PermissionProtectedRouteProps {
  children: ReactNode;
  /** 
   * Permission key(s) from useUserAccessType. 
   * If an array is provided, access is granted if ANY of them is true (OR logic). 
   */
  permissionKey: string | string[];
  /** Where to redirect if permission denied. Defaults to "/" */
  redirectTo?: string;
}

/**
 * Generic protected route that checks dynamic permission flags from PermissionRegistry.
 * Respects overrides from departamento_permissoes table.
 */
export function PermissionProtectedRoute({ 
  children, 
  permissionKey, 
  redirectTo = "/" 
}: PermissionProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { permissions, loading: accessLoading } = useUserAccessType();
  const location = useLocation();

  const loading = authLoading || accessLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const intendedPath = location.pathname + location.search;
    if (intendedPath && intendedPath !== '/' && intendedPath !== '/login') {
      localStorage.setItem(REDIRECT_KEY, intendedPath);
    }
    return <Navigate to="/login" replace />;
  }

  const keys = Array.isArray(permissionKey) ? permissionKey : [permissionKey];
  const hasPermission = keys.some(key => permissions[key] === true);

  if (!hasPermission) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
