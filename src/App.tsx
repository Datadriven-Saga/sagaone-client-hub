import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
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
import Empresas from "./pages/admin/Empresas";
import Acessos from "./pages/admin/Acessos";
import CamposObrigatorios from "./pages/admin/CamposObrigatorios";
import APIs from "./pages/admin/APIs";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Index />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/notificacoes" element={<Notificacoes />} />
          <Route path="/personas" element={<Personas />} />
          <Route path="/prospeccao" element={<Prospeccao />} />
          <Route path="/central-atendimento" element={<CentralAtendimento />} />
          <Route path="/loja" element={<Loja />} />
          <Route path="/busca-resgate" element={<BuscaResgate />} />
          <Route path="/metas" element={<Metas />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/treinamentos" element={<Treinamentos />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/gatilhos" element={<Gatilhos />} />
          <Route path="/administracao" element={<Administracao />} />
          <Route path="/administracao/empresas" element={<Empresas />} />
          <Route path="/administracao/acessos" element={<Acessos />} />
          <Route path="/administracao/campos" element={<CamposObrigatorios />} />
          <Route path="/administracao/apis" element={<APIs />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
