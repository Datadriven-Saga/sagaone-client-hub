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
import { useUserColors } from "@/hooks/useUserColors";

// Page imports
import Index from "./pages/Index";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Personas from "./pages/Personas";
import Gatilhos from "./pages/Gatilhos";
import Administracao from "./pages/Administracao";
import Clientes from "./pages/Clientes";
import Notificacoes from "./pages/Notificacoes";
import Prospeccao from "./pages/Prospeccao";
import Resultados from "./pages/Resultados";
import Templates from "./pages/prospeccao/Templates";
import EventoBase from "./pages/prospeccao/EventoBase";
import Relatorios from "./pages/Relatorios";
import Treinamentos from "./pages/Treinamentos";
import Configuracoes from "./pages/Configuracoes";
import MinhaConta from "./pages/MinhaConta";
import Ajuda from "./pages/Ajuda";
import AgentesIA from "./pages/AgentesIA";
import NotFound from "./pages/NotFound";

// Admin page imports
import Empresas from "./pages/admin/Empresas";
import Acessos from "./pages/admin/Acessos";
import CamposObrigatorios from "./pages/admin/CamposObrigatorios";
import APIs from "./pages/admin/APIs";
import TestAPIs from "./pages/admin/TestAPIs";
import AdminAgentes from "./pages/admin/Agentes";
import ControleAgentes from "./pages/admin/ControleAgentes";
import VisaoGeral from "./pages/admin/VisaoGeral";

// Agentes IA page imports
import Instancias from "./pages/agentes-ia/Instancias";

const queryClient = new QueryClient();

const AppRoutes = () => {
  return (
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
      <Route path="/prospeccao/performance" element={<ProtectedRoute><Resultados /></ProtectedRoute>} />
      <Route path="/resultados" element={<ProtectedRoute><Resultados /></ProtectedRoute>} />
      <Route path="/relatorios" element={<AdminProtectedRoute><Relatorios /></AdminProtectedRoute>} />
      <Route path="/treinamentos" element={<AdminProtectedRoute><Treinamentos /></AdminProtectedRoute>} />
      <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
      <Route path="/minha-conta" element={<ProtectedRoute><MinhaConta /></ProtectedRoute>} />
      <Route path="/ajuda" element={<ProtectedRoute><Ajuda /></ProtectedRoute>} />
      <Route path="/gatilhos" element={<ProtectedRoute><Gatilhos /></ProtectedRoute>} />
      
      {/* Agentes IA - apenas TI e Admin */}
      <Route path="/agentes-ia" element={<TIAdminProtectedRoute><AgentesIA /></TIAdminProtectedRoute>} />
      <Route path="/agentes-ia/instancias" element={<TIAdminProtectedRoute><Instancias /></TIAdminProtectedRoute>} />
      <Route path="/agentes-ia/performance" element={<TIAdminProtectedRoute><Resultados /></TIAdminProtectedRoute>} />
      
      <Route path="/administracao" element={<AdminProtectedRoute><Administracao /></AdminProtectedRoute>} />
      <Route path="/admin" element={<AdminProtectedRoute><Administracao /></AdminProtectedRoute>} />
      <Route path="/administracao/empresas" element={<AdminProtectedRoute><Empresas /></AdminProtectedRoute>} />
      <Route path="/administracao/acessos" element={<AdminProtectedRoute><Acessos /></AdminProtectedRoute>} />
      <Route path="/admin/acessos" element={<AdminProtectedRoute><Acessos /></AdminProtectedRoute>} />
      <Route path="/administracao/agentes" element={<TIAdminProtectedRoute><AdminAgentes /></TIAdminProtectedRoute>} />
      <Route path="/administracao/agentes/controle" element={<TIAdminProtectedRoute><ControleAgentes /></TIAdminProtectedRoute>} />
      <Route path="/administracao/agentes/visao-geral" element={<TIAdminProtectedRoute><VisaoGeral /></TIAdminProtectedRoute>} />
      <Route path="/administracao/campos" element={<AdminProtectedRoute><CamposObrigatorios /></AdminProtectedRoute>} />
      <Route path="/administracao/apis" element={<AdminProtectedRoute><APIs /></AdminProtectedRoute>} />
      <Route path="/administracao/test-apis" element={<AdminProtectedRoute><TestAPIs /></AdminProtectedRoute>} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const AppContent = () => {
  // Load user color preferences on app start
  useUserColors();
  
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
