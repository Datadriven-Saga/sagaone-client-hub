import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Personas from "./pages/Personas";
import Gatilhos from "./pages/Gatilhos";
import Administracao from "./pages/Administracao";
import Clientes from "./pages/Clientes";
import Notificacoes from "./pages/Notificacoes";
import Prospeccao from "./pages/Prospeccao";
import CentralAtendimento from "./pages/CentralAtendimento";
import Loja from "./pages/Loja";
import BuscaResgate from "./pages/BuscaResgate";
import Metas from "./pages/Metas";
import Relatorios from "./pages/Relatorios";
import Treinamentos from "./pages/Treinamentos";
import Configuracoes from "./pages/Configuracoes";
import MinhaConta from "./pages/MinhaConta";
import Ajuda from "./pages/Ajuda";
import Empresas from "./pages/admin/Empresas";
import Acessos from "./pages/admin/Acessos";
import CamposObrigatorios from "./pages/admin/CamposObrigatorios";
import APIs from "./pages/admin/APIs";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
            <Route path="/notificacoes" element={<ProtectedRoute><Notificacoes /></ProtectedRoute>} />
            <Route path="/personas" element={<ProtectedRoute><Personas /></ProtectedRoute>} />
            <Route path="/prospeccao" element={<ProtectedRoute><Prospeccao /></ProtectedRoute>} />
            <Route path="/central-atendimento" element={<ProtectedRoute><CentralAtendimento /></ProtectedRoute>} />
            <Route path="/loja" element={<ProtectedRoute><Loja /></ProtectedRoute>} />
            <Route path="/busca-resgate" element={<ProtectedRoute><BuscaResgate /></ProtectedRoute>} />
            <Route path="/metas" element={<ProtectedRoute><Metas /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
            <Route path="/treinamentos" element={<ProtectedRoute><Treinamentos /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
            <Route path="/minha-conta" element={<ProtectedRoute><MinhaConta /></ProtectedRoute>} />
            <Route path="/ajuda" element={<ProtectedRoute><Ajuda /></ProtectedRoute>} />
            <Route path="/gatilhos" element={<ProtectedRoute><Gatilhos /></ProtectedRoute>} />
            <Route path="/administracao" element={<ProtectedRoute><Administracao /></ProtectedRoute>} />
            <Route path="/administracao/empresas" element={<ProtectedRoute><Empresas /></ProtectedRoute>} />
            <Route path="/administracao/acessos" element={<ProtectedRoute><Acessos /></ProtectedRoute>} />
            <Route path="/administracao/campos" element={<ProtectedRoute><CamposObrigatorios /></ProtectedRoute>} />
            <Route path="/administracao/apis" element={<ProtectedRoute><APIs /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
