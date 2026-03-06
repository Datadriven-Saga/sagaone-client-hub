import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminProtectedRoute } from "@/components/AdminProtectedRoute";
import { TIAdminProtectedRoute } from "@/components/TIAdminProtectedRoute";
import { GestorProtectedRoute } from "@/components/GestorProtectedRoute";

// Critical pages - eagerly loaded
import Login from "./pages/Login";
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
const Treinamentos = lazy(() => import("./pages/Treinamentos"));
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
const Instancias = lazy(() => import("./pages/agentes-ia/Instancias"));

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
        <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
        <Route path="/clientes" element={<AdminProtectedRoute><Clientes /></AdminProtectedRoute>} />
        <Route path="/notificacoes" element={<ProtectedRoute><Notificacoes /></ProtectedRoute>} />
        <Route path="/personas" element={<ProtectedRoute><Personas /></ProtectedRoute>} />
        <Route path="/prospeccao" element={<ProtectedRoute><Prospeccao /></ProtectedRoute>} />
        <Route path="/prospeccao/eventos" element={<ProtectedRoute><Prospeccao defaultTab="eventos" /></ProtectedRoute>} />
        <Route path="/prospeccao/atendimento" element={<ProtectedRoute><Prospeccao defaultTab="atendimento" /></ProtectedRoute>} />
        <Route path="/prospeccao/recepcao" element={<ProtectedRoute><Prospeccao defaultTab="recepcao" /></ProtectedRoute>} />
        <Route path="/prospeccao/vendas" element={<ProtectedRoute><Prospeccao defaultTab="vendas" /></ProtectedRoute>} />
        <Route path="/prospeccao/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
        <Route path="/prospeccao/eventos/:eventoId/base" element={<ProtectedRoute><EventoBase /></ProtectedRoute>} />
        <Route path="/resultados" element={<ProtectedRoute><Resultados /></ProtectedRoute>} />
        <Route path="/resultados/whatsapp" element={<ProtectedRoute><Resultados /></ProtectedRoute>} />
        <Route path="/resultados/ligacao" element={<ProtectedRoute><Resultados /></ProtectedRoute>} />
        <Route path="/resultados/ranking" element={<ProtectedRoute><Resultados /></ProtectedRoute>} />
        <Route path="/resultados/produtos" element={<ProtectedRoute><Resultados /></ProtectedRoute>} />
        <Route path="/resultados/desempenho" element={<ProtectedRoute><Resultados /></ProtectedRoute>} />
        <Route path="/resultados/individual" element={<ProtectedRoute><Resultados /></ProtectedRoute>} />
        <Route path="/resultados/premiacoes" element={<ProtectedRoute><Resultados /></ProtectedRoute>} />
        <Route path="/resultados/relatorios" element={<ProtectedRoute><Resultados /></ProtectedRoute>} />
        <Route path="/relatorios" element={<AdminProtectedRoute><Relatorios /></AdminProtectedRoute>} />
        <Route path="/treinamentos" element={<ProtectedRoute><Treinamentos /></ProtectedRoute>} />
        <Route path="/treinamentos/simulacoes" element={<ProtectedRoute><Treinamentos /></ProtectedRoute>} />
        <Route path="/treinamentos/simulacoes-voz" element={<ProtectedRoute><Treinamentos /></ProtectedRoute>} />
        <Route path="/treinamentos/simulacoes-texto" element={<ProtectedRoute><Treinamentos /></ProtectedRoute>} />
        <Route path="/treinamentos/historico" element={<ProtectedRoute><Treinamentos /></ProtectedRoute>} />
        <Route path="/treinamentos/historico/:id" element={<ProtectedRoute><Treinamentos /></ProtectedRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
        <Route path="/minha-conta" element={<ProtectedRoute><MinhaConta /></ProtectedRoute>} />
        <Route path="/ajuda" element={<ProtectedRoute><Ajuda /></ProtectedRoute>} />
        <Route path="/gatilhos" element={<ProtectedRoute><Gatilhos /></ProtectedRoute>} />
        
        {/* Agentes IA */}
        <Route path="/agentes-ia" element={<TIAdminProtectedRoute><AgentesIA /></TIAdminProtectedRoute>} />
        <Route path="/agentes-ia/instancias" element={<TIAdminProtectedRoute><Instancias /></TIAdminProtectedRoute>} />
        <Route path="/agentes-ia/performance" element={<TIAdminProtectedRoute><Resultados /></TIAdminProtectedRoute>} />
        
        <Route path="/administracao" element={<GestorProtectedRoute><Administracao /></GestorProtectedRoute>} />
        <Route path="/admin" element={<GestorProtectedRoute><Administracao /></GestorProtectedRoute>} />
        <Route path="/administracao/empresas" element={<AdminProtectedRoute><Empresas /></AdminProtectedRoute>} />
        <Route path="/administracao/acessos" element={<GestorProtectedRoute><Acessos /></GestorProtectedRoute>} />
        <Route path="/admin/acessos" element={<GestorProtectedRoute><Acessos /></GestorProtectedRoute>} />
        <Route path="/administracao/agentes" element={<TIAdminProtectedRoute><AdminAgentes /></TIAdminProtectedRoute>} />
        <Route path="/administracao/agentes/controle" element={<TIAdminProtectedRoute><ControleAgentes /></TIAdminProtectedRoute>} />
        <Route path="/administracao/agentes/visao-geral" element={<TIAdminProtectedRoute><VisaoGeral /></TIAdminProtectedRoute>} />
        <Route path="/administracao/campos" element={<AdminProtectedRoute><CamposObrigatorios /></AdminProtectedRoute>} />
        <Route path="/administracao/apis" element={<AdminProtectedRoute><APIs /></AdminProtectedRoute>} />
        <Route path="/administracao/test-apis" element={<AdminProtectedRoute><TestAPIs /></AdminProtectedRoute>} />
        <Route path="/administracao/treinamentos" element={<TIAdminProtectedRoute><Treinamentos adminMode /></TIAdminProtectedRoute>} />
        <Route path="/administracao/controle-acessos" element={<AdminProtectedRoute><ControleAcessos /></AdminProtectedRoute>} />
        <Route path="/administracao/mfa-master" element={<ProtectedRoute><MFAMasterDashboard /></ProtectedRoute>} />
        <Route path="/administracao/logs-disparos" element={<AdminProtectedRoute><LogsDisparos /></AdminProtectedRoute>} />
        <Route path="/administracao/gastos-ligacao" element={<AdminProtectedRoute><ControleGastosLigacao /></AdminProtectedRoute>} />
        <Route path="/administracao/feature-flags" element={<AdminProtectedRoute><FeatureFlags /></AdminProtectedRoute>} />
        <Route path="/administracao/quarentena" element={<ProtectedRoute><Quarentena /></ProtectedRoute>} />
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
