import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PermissionProtectedRoute } from "@/components/PermissionProtectedRoute";

// Critical pages - eagerly loaded
import Login from "./pages/Login";
import VersionMonitor from "./components/VersionMonitor";
import ResetPassword from "./pages/ResetPassword";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages
const Personas = lazy(() => import("./pages/Personas"));
const Gatilhos = lazy(() => import("./pages/Gatilhos"));
const Administracao = lazy(() => import("./pages/Administracao"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Notificacoes = lazy(() => import("./pages/Notificacoes"));
const Prospeccao = lazy(() => import("./pages/Prospeccao"));
const Resultados = lazy(() => import("./pages/Resultados"));
const Templates = lazy(() => import("./pages/prospeccao/Templates"));
const EventoBase = lazy(() => import("./pages/prospeccao/EventoBase"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const MinhaConta = lazy(() => import("./pages/MinhaConta"));
const Ajuda = lazy(() => import("./pages/Ajuda"));
const AgentesIA = lazy(() => import("./pages/AgentesIA"));

// Admin pages - lazy
const Empresas = lazy(() => import("./pages/admin/Empresas"));
const Acessos = lazy(() => import("./pages/admin/Acessos"));
const CamposObrigatorios = lazy(() => import("./pages/admin/CamposObrigatorios"));
const APIs = lazy(() => import("./pages/admin/APIs"));
const TestAPIs = lazy(() => import("./pages/admin/TestAPIs"));
const AdminAgentes = lazy(() => import("./pages/admin/Agentes"));
const ControleAgentes = lazy(() => import("./pages/admin/ControleAgentes"));
const VisaoGeral = lazy(() => import("./pages/admin/VisaoGeral"));
const ControleAcessos = lazy(() => import("./pages/admin/ControleAcessos"));
const MFAMasterDashboard = lazy(() => import("./pages/admin/MFAMasterDashboard"));
const LogsDisparos = lazy(() => import("./pages/admin/LogsDisparos"));
const ControleGastosLigacao = lazy(() => import("./pages/admin/ControleGastosLigacao"));
const FeatureFlags = lazy(() => import("./pages/admin/FeatureFlags"));
const Quarentena = lazy(() => import("./pages/admin/Quarentena"));
const Integracoes = lazy(() => import("./pages/admin/Integracoes"));
const OptOutGlobal = lazy(() => import("./pages/admin/OptOutGlobal"));
const MFAGeral = lazy(() => import("./pages/admin/MFAGeral"));
const Instancias = lazy(() => import("./pages/agentes-ia/Instancias"));
const ConfirmarPresenca = lazy(() => import("./pages/ConfirmarPresenca"));

// QueryClient with optimized defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,        // 1 min stale
      gcTime: 5 * 60 * 1000,       // 5 min garbage collection
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Minimal loading fallback
const PageFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const AppRoutes = () => {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Rota pública — landing page de confirmação de presença (acessada por clientes finais) */}
        <Route path="/confirmar/:token" element={<ConfirmarPresenca />} />
        <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
        <Route path="/clientes" element={<PermissionProtectedRoute permissionKey="canViewClientes"><Clientes /></PermissionProtectedRoute>} />
        <Route path="/notificacoes" element={<PermissionProtectedRoute permissionKey="canAccessNotificacoes"><Notificacoes /></PermissionProtectedRoute>} />
        <Route path="/personas" element={<PermissionProtectedRoute permissionKey="canAccessPersonas"><Personas /></PermissionProtectedRoute>} />
        <Route path="/prospeccao" element={<PermissionProtectedRoute permissionKey="canViewProspeccao"><Prospeccao /></PermissionProtectedRoute>} />
        <Route path="/prospeccao/eventos" element={<PermissionProtectedRoute permissionKey="canViewProspeccao"><Prospeccao defaultTab="eventos" /></PermissionProtectedRoute>} />
        <Route path="/prospeccao/atendimento" element={<PermissionProtectedRoute permissionKey="canViewProspeccao"><Prospeccao defaultTab="atendimento" /></PermissionProtectedRoute>} />
        <Route path="/prospeccao/recepcao" element={<PermissionProtectedRoute permissionKey="canAccessRecepcao"><Prospeccao defaultTab="recepcao" /></PermissionProtectedRoute>} />
        <Route path="/prospeccao/vendas" element={<PermissionProtectedRoute permissionKey="canViewVendas"><Prospeccao defaultTab="vendas" /></PermissionProtectedRoute>} />
        <Route path="/prospeccao/templates" element={<PermissionProtectedRoute permissionKey="canViewTemplates"><Templates /></PermissionProtectedRoute>} />
        <Route path="/prospeccao/eventos/:eventoId/base" element={<PermissionProtectedRoute permissionKey="canViewProspeccao"><EventoBase /></PermissionProtectedRoute>} />
        <Route path="/resultados" element={<PermissionProtectedRoute permissionKey="canAccessResultados"><Resultados /></PermissionProtectedRoute>} />
        <Route path="/resultados/whatsapp" element={<PermissionProtectedRoute permissionKey="canAccessResultados"><Resultados /></PermissionProtectedRoute>} />
        <Route path="/resultados/ligacao" element={<PermissionProtectedRoute permissionKey="canAccessResultados"><Resultados /></PermissionProtectedRoute>} />
        <Route path="/resultados/ranking" element={<PermissionProtectedRoute permissionKey="canAccessResultados"><Resultados /></PermissionProtectedRoute>} />
        <Route path="/resultados/produtos" element={<PermissionProtectedRoute permissionKey="canAccessResultados"><Resultados /></PermissionProtectedRoute>} />
        <Route path="/resultados/desempenho" element={<PermissionProtectedRoute permissionKey="canAccessResultados"><Resultados /></PermissionProtectedRoute>} />
        <Route path="/resultados/individual" element={<PermissionProtectedRoute permissionKey="canAccessResultados"><Resultados /></PermissionProtectedRoute>} />
        <Route path="/resultados/premiacoes" element={<PermissionProtectedRoute permissionKey="canAccessResultados"><Resultados /></PermissionProtectedRoute>} />
        <Route path="/resultados/relatorios" element={<PermissionProtectedRoute permissionKey="canAccessResultados"><Resultados /></PermissionProtectedRoute>} />
        <Route path="/relatorios" element={<PermissionProtectedRoute permissionKey="canAccessRelatorios"><Relatorios /></PermissionProtectedRoute>} />
        <Route path="/configuracoes" element={<PermissionProtectedRoute permissionKey="canAccessConfiguracoes"><Configuracoes /></PermissionProtectedRoute>} />
        <Route path="/minha-conta" element={<PermissionProtectedRoute permissionKey="canAccessMinhaConta"><MinhaConta /></PermissionProtectedRoute>} />
        <Route path="/ajuda" element={<PermissionProtectedRoute permissionKey="canAccessAjuda"><Ajuda /></PermissionProtectedRoute>} />
        <Route path="/gatilhos" element={<PermissionProtectedRoute permissionKey="canAccessGatilhos"><Gatilhos /></PermissionProtectedRoute>} />
        
        {/* Agentes IA */}
        <Route path="/agentes-ia" element={<PermissionProtectedRoute permissionKey="canAccessAgentesIA"><AgentesIA /></PermissionProtectedRoute>} />
        <Route path="/agentes-ia/instancias" element={<PermissionProtectedRoute permissionKey="canManageInstancias"><Instancias /></PermissionProtectedRoute>} />
        <Route path="/agentes-ia/performance" element={<PermissionProtectedRoute permissionKey="canAccessAgentesIA"><Resultados /></PermissionProtectedRoute>} />
        
        <Route path="/administracao" element={<PermissionProtectedRoute permissionKey={["canAccessAdministracao", "canViewAuthenticator"]}><Administracao /></PermissionProtectedRoute>} />
        <Route path="/admin" element={<PermissionProtectedRoute permissionKey={["canAccessAdministracao", "canViewAuthenticator"]}><Administracao /></PermissionProtectedRoute>} />
        <Route path="/administracao/empresas" element={<PermissionProtectedRoute permissionKey="canManageEmpresas"><Empresas /></PermissionProtectedRoute>} />
        <Route path="/administracao/acessos" element={<PermissionProtectedRoute permissionKey={["canManageUsers", "canCreateUsers", "canEditUsers", "canDeleteUsers"]}><Acessos /></PermissionProtectedRoute>} />
        <Route path="/admin/acessos" element={<PermissionProtectedRoute permissionKey={["canManageUsers", "canCreateUsers", "canEditUsers", "canDeleteUsers"]}><Acessos /></PermissionProtectedRoute>} />
        <Route path="/administracao/agentes" element={<PermissionProtectedRoute permissionKey="canAccessAgentesIA"><AdminAgentes /></PermissionProtectedRoute>} />
        <Route path="/administracao/agentes/controle" element={<PermissionProtectedRoute permissionKey={["canViewControleAgentes", "canAccessAgentesIA"]}><ControleAgentes /></PermissionProtectedRoute>} />
        <Route path="/administracao/agentes/visao-geral" element={<PermissionProtectedRoute permissionKey="canAccessAgentesIA"><VisaoGeral /></PermissionProtectedRoute>} />
        <Route path="/administracao/campos" element={<PermissionProtectedRoute permissionKey="canAccessAdminConfig"><CamposObrigatorios /></PermissionProtectedRoute>} />
        <Route path="/administracao/apis" element={<PermissionProtectedRoute permissionKey="canAccessAPIs"><APIs /></PermissionProtectedRoute>} />
        <Route path="/administracao/test-apis" element={<PermissionProtectedRoute permissionKey="canTestAPIs"><TestAPIs /></PermissionProtectedRoute>} />
        <Route path="/administracao/controle-acessos" element={<PermissionProtectedRoute permissionKey="canAccessControleAcessos"><ControleAcessos /></PermissionProtectedRoute>} />
        <Route path="/administracao/mfa-master" element={<ProtectedRoute><MFAMasterDashboard /></ProtectedRoute>} />
        <Route path="/administracao/logs-disparos" element={<PermissionProtectedRoute permissionKey="canAccessAdminConfig"><LogsDisparos /></PermissionProtectedRoute>} />
        <Route path="/administracao/gastos-ligacao" element={<PermissionProtectedRoute permissionKey="canAccessFinancialReports"><ControleGastosLigacao /></PermissionProtectedRoute>} />
        <Route path="/administracao/feature-flags" element={<PermissionProtectedRoute permissionKey="canAccessAdminConfig"><FeatureFlags /></PermissionProtectedRoute>} />
        <Route path="/administracao/quarentena" element={<PermissionProtectedRoute permissionKey={["canGovernancaDados", "canAccessAdminConfig"]}><Quarentena /></PermissionProtectedRoute>} />
        <Route path="/administracao/integracoes" element={<PermissionProtectedRoute permissionKey="canAccessAgentesIA"><Integracoes /></PermissionProtectedRoute>} />
        <Route path="/administracao/mfa" element={<PermissionProtectedRoute permissionKey={["canAccessAgentesIA", "canViewAuthenticator"]}><MFAGeral /></PermissionProtectedRoute>} />
        <Route path="/administracao/opt-out-global" element={<PermissionProtectedRoute permissionKey="canAccessOptOutGlobal"><OptOutGlobal /></PermissionProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const AppContent = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('userColorConfig');
    const root = document.documentElement;
    const cssVarsToClean = [
      '--foreground', '--card-foreground', '--popover-foreground', '--primary',
      '--secondary-foreground', '--ring', '--sidebar-background', '--sidebar-primary',
      '--sidebar-ring', '--sagaone-primary', '--sagaone-dark', '--sagaone-login-button',
      '--accent', '--sagaone-login-card', '--background', '--secondary', '--muted',
      '--sagaone-bg', '--sagaone-login-bg', '--card', '--popover', '--sagaone-light'
    ];
    cssVarsToClean.forEach(v => root.style.removeProperty(v));
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }

  return (
    <TooltipProvider>
      <VersionMonitor />
      <Toaster />
      <Sonner />
      <AuthProvider>
        <CompanyProvider>
          <AppRoutes />
        </CompanyProvider>
      </AuthProvider>
    </TooltipProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
