import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";

const REDIRECT_KEY = 'auth_redirect_path';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

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

  return <>{children}</>;
}