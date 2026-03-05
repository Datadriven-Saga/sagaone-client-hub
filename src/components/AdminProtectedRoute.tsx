import { useAuth } from "@/contexts/AuthContext";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";

const REDIRECT_KEY = 'auth_redirect_to';

interface AdminProtectedRouteProps {
  children: ReactNode;
}

export function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: accessLoading } = useUserAccessType();
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
    const intendedPath = location.pathname + location.search + location.hash;
    if (intendedPath && intendedPath !== '/login') {
      sessionStorage.setItem(REDIRECT_KEY, intendedPath);
    }
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
