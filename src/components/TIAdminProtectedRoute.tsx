import { useAuth } from "@/contexts/AuthContext";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { Navigate } from "react-router-dom";
import { ReactNode } from "react";

interface TIAdminProtectedRouteProps {
  children: ReactNode;
}

export function TIAdminProtectedRoute({ children }: TIAdminProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { canAccessAgentesIA, loading: accessLoading } = useUserAccessType();

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
    return <Navigate to="/login" replace />;
  }

  // Apenas: departamento TI + tipo de acesso TI/Administrador
  if (!canAccessAgentesIA) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
