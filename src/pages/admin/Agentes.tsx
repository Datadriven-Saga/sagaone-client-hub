import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ControleAgentesContent } from "@/components/admin/ControleAgentesContent";
import { 
  Bot, 
  RefreshCw, 
  Building2, 
  Server, 
  Search, 
  Eye, 
  EyeOff, 
  Copy, 
  Edit, 
  X, 
  Save,
  Store,
  Phone,
  Plus,
  MapPin,
  Upload,
  Power,
  PowerOff,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AgenteFollowups } from "@/components/AgenteFollowups";
import { AgenteCadencia } from "@/components/AgenteCadencia";
import { AgenteIntegracao } from "@/components/AgenteIntegracao";
import AgenteVariaveis from "@/components/AgenteVariaveis";
import { AgenteCadenciasNova } from "@/components/AgenteCadenciasNova";
import { AgenteEventos } from "@/components/AgenteEventos";

interface AgenteWebhook {
  id?: string;
  nome: string;
  telefone: string;
  marca?: string;
  loja?: string;
  empresa_id?: string;
  ativo?: boolean;
  instancia?: string;
  evo_token?: string;
  cw_token_maia?: string;
  num_maia?: string;
  uf?: string;
  [key: string]: any;
}

interface Empresa {
  id: string;
  nome_empresa: string;
  marca?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

interface InstanciaData {
  num_maia: string;
  marca: string;
  uf: string;
  instancia: string;
  evo_token: string;
  id_numero_meta: string | null;
  criado_em: string;
  tb_histories: string | null;
  cw_inbox: string | null;
  waba: string | null;
  meta_app_id: string | null;
  agente: string | null;
  cw_token_maia: string | null;
  [key: string]: any;
}

interface NovaInstanciaData {
  num_maia: string;
  marca: string;
  uf: string;
  instancia: string;
  evo_token: string;
  id_numero_meta: string;
  tb_histories: string;
  cw_inbox: string;
  waba: string;
  meta_app_id: string;
  agente: string;
  cw_token_maia: string;
}

const UF_LIST = ["DF", "GO", "MG", "MT", "RO"];

interface AgenteLocal {
  id: string;
  nome: string;
  persona: string | null;
  cerebro: string | null;
  telefone: string | null;
  dealer_id?: string | null;
  foto_url?: string | null;
  ativo: boolean;
}

export default function AdminAgentes() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isDepartamentoTI, isAdminOrTI, loading: accessLoading } = useUserAccessType();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [agentes, setAgentes] = useState<AgenteWebhook[]>([]);
  const [filteredAgentes, setFilteredAgentes] = useState<AgenteWebhook[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEmpresa, setFilterEmpresa] = useState<string>("all");
  const [filterMarca, setFilterMarca] = useState<string>("all");
  const [filterUF, setFilterUF] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterNumero, setFilterNumero] = useState<string>("");
  const [filterNomeAgente, setFilterNomeAgente] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Modal de detalhes/edição do agente
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [selectedAgente, setSelectedAgente] = useState<AgenteWebhook | null>(null);
  const [agenteLocal, setAgenteLocal] = useState<AgenteLocal | null>(null);
  const [instanciaData, setInstanciaData] = useState<InstanciaData | null>(null);
  const [loadingInstancia, setLoadingInstancia] = useState(false);
  const [showEvoToken, setShowEvoToken] = useState(false);
  const [showCwToken, setShowCwToken] = useState(false);
  const [editInstancia, setEditInstancia] = useState(false);
  const [editedInstancia, setEditedInstancia] = useState<InstanciaData | null>(null);
  const [savingInstancia, setSavingInstancia] = useState(false);
  const [lojasAtribuidas, setLojasAtribuidas] = useState<Empresa[]>([]);
  const [loadingLojas, setLoadingLojas] = useState(false);
  const [selectedLojasToRemove, setSelectedLojasToRemove] = useState<string[]>([]);
  const [removingLojas, setRemovingLojas] = useState(false);
  // Filtros para lojas atribuídas
  const [filterLojaMarca, setFilterLojaMarca] = useState<string>("all");
  const [filterLojaUF, setFilterLojaUF] = useState<string>("all");
  const [filterLojaCidade, setFilterLojaCidade] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("dados-gerais");
  const [mainTab, setMainTab] = useState("agentes");
  const [isNewAgente, setIsNewAgente] = useState(false);
  const [creatingInstancia, setCreatingInstancia] = useState(false);
  const [novaInstancia, setNovaInstancia] = useState<NovaInstanciaData>({
    num_maia: "",
    marca: "",
    uf: "",
    instancia: "",
    evo_token: "",
    id_numero_meta: "",
    tb_histories: "",
    cw_inbox: "",
    waba: "",
    meta_app_id: "",
    agente: "",
    cw_token_maia: ""
  });

  // Formulário do agente local (banco de dados)
  const [formData, setFormData] = useState({
    nome: "",
    persona: "",
    cerebro: "",
    telefone: "",
    dealer_id: "",
    foto_url: "",
    ativo: true
  });
  const [savingAgente, setSavingAgente] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Modal para atribuir agente a empresa
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [agenteToAssign, setAgenteToAssign] = useState<AgenteWebhook | null>(null);
  const [selectedEmpresaIds, setSelectedEmpresaIds] = useState<string[]>([]);
  const [assignFilterMarca, setAssignFilterMarca] = useState<string>("all");
  const [assignFilterNome, setAssignFilterNome] = useState<string>("");
  const [assignFilterUF, setAssignFilterUF] = useState<string>("all");
  const [loadingAssignedEmpresas, setLoadingAssignedEmpresas] = useState(false);

  const canAccess = isDepartamentoTI && isAdminOrTI;

  const getAgenteTipo = (agente: AgenteWebhook | null | undefined): string => {
    if (!agente) return "Outro";
    const nome = (agente.nome || "").toLowerCase();
    return nome.includes("maia") ? "Maia" : "Outro";
  };

  // Verificar se é agente Pri (Ligação) - verifica selectedAgente, agenteLocal e instanciaData
  const isPriLigacao = (): boolean => {
    // Verifica no selectedAgente
    if (selectedAgente) {
      const nome = (selectedAgente.nome || "").toLowerCase();
      if (nome.includes("pri") || nome.includes("ligação") || nome.includes("ligacao")) return true;
    }
    // Verifica no agenteLocal
    if (agenteLocal) {
      const nome = (agenteLocal.nome || "").toLowerCase();
      if (nome.includes("pri") || nome.includes("ligação") || nome.includes("ligacao")) return true;
    }
    // Verifica no instanciaData.agente
    if (instanciaData?.agente) {
      const agente = instanciaData.agente.toLowerCase();
      if (agente.includes("pri") || agente.includes("ligação") || agente.includes("ligacao")) return true;
    }
    return false;
  };

  const getAgenteNumero = (agente: AgenteWebhook | null | undefined): string => {
    if (!agente) return "N/A";
    const tipo = getAgenteTipo(agente);
    if (tipo === "Maia") {
      return agente.num_maia || agente.telefone || "N/A";
    }
    return agente.telefone || "N/A";
  };

  const carregarAgentes = async () => {
    try {
      setLoading(true);
      
      // Usar edge function para buscar agentes com token SAGA_ONE
      const { data, error } = await supabase.functions.invoke('external-webhook-proxy', {
        body: { endpoint: 'busca-dados-agentes' },
      });

      if (error) {
        throw new Error(`Erro na requisição: ${error.message}`);
      }

      console.log('Agentes do webhook:', data);
      
      const agentesArray = (Array.isArray(data) ? data : [data]).filter(
        (item): item is AgenteWebhook => item !== null && item !== undefined
      );
      setAgentes(agentesArray);
      setFilteredAgentes(agentesArray);
    } catch (error) {
      console.error('Erro ao carregar agentes:', error);
      toast({
        title: "Erro ao carregar agentes",
        description: "Não foi possível carregar a lista de agentes do webhook",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const carregarEmpresas = async () => {
    try {
      const { data, error } = await supabase
        .from('empresas')
        .select('id, nome_empresa, marca, cidade, uf')
        .order('nome_empresa');

      if (error) throw error;
      setEmpresas(data || []);
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
    }
  };

  // Buscar empresas já atribuídas ao agente
  const carregarEmpresasAtribuidas = async (agenteId: string) => {
    try {
      setLoadingAssignedEmpresas(true);
      const { data, error } = await supabase
        .from('agente_empresas')
        .select('empresa_id')
        .eq('agente_id', agenteId);

      if (error) throw error;
      setSelectedEmpresaIds(data?.map(d => d.empresa_id) || []);
    } catch (error) {
      console.error('Erro ao carregar empresas atribuídas:', error);
      setSelectedEmpresaIds([]);
    } finally {
      setLoadingAssignedEmpresas(false);
    }
  };

  // Buscar lojas atribuídas ao agente (para exibir no modal)
  const carregarLojasAtribuidas = async (agenteId: string) => {
    try {
      setLoadingLojas(true);
      const { data, error } = await supabase
        .from('agente_empresas')
        .select(`
          empresa_id,
          empresas (
            id,
            nome_empresa,
            marca,
            cidade,
            uf
          )
        `)
        .eq('agente_id', agenteId);

      if (error) throw error;
      
      const lojas = data?.map(d => d.empresas).filter(Boolean) as Empresa[] || [];
      setLojasAtribuidas(lojas);
    } catch (error) {
      console.error('Erro ao carregar lojas atribuídas:', error);
      setLojasAtribuidas([]);
    } finally {
      setLoadingLojas(false);
    }
  };

  // Remover lojas atribuídas
  const handleRemoveLojas = async (lojaIds: string[]) => {
    if (!agenteLocal?.id || lojaIds.length === 0) return;
    
    try {
      setRemovingLojas(true);
      
      const { error } = await supabase
        .from('agente_empresas')
        .delete()
        .eq('agente_id', agenteLocal.id)
        .in('empresa_id', lojaIds);

      if (error) throw error;

      toast({
        title: "Lojas removidas",
        description: `${lojaIds.length} loja${lojaIds.length > 1 ? 's removidas' : ' removida'} com sucesso`,
      });

      // Recarregar lojas atribuídas
      await carregarLojasAtribuidas(agenteLocal.id);
      setSelectedLojasToRemove([]);
    } catch (error) {
      console.error('Erro ao remover lojas:', error);
      toast({
        title: "Erro ao remover lojas",
        description: "Não foi possível remover as lojas selecionadas",
        variant: "destructive"
      });
    } finally {
      setRemovingLojas(false);
    }
  };

  const toggleLojaSelection = (lojaId: string) => {
    setSelectedLojasToRemove(prev => 
      prev.includes(lojaId) 
        ? prev.filter(id => id !== lojaId)
        : [...prev, lojaId]
    );
  };

  // Filtrar lojas atribuídas com base nos filtros - comparação case-insensitive
  const filteredLojasAtribuidas = lojasAtribuidas.filter(loja => {
    if (filterLojaMarca !== "all" && loja.marca?.toLowerCase() !== filterLojaMarca.toLowerCase()) return false;
    if (filterLojaUF !== "all" && loja.uf?.toUpperCase() !== filterLojaUF.toUpperCase()) return false;
    if (filterLojaCidade !== "all" && loja.cidade?.toLowerCase() !== filterLojaCidade.toLowerCase()) return false;
    return true;
  });

  // Extrair opções únicas para os filtros de lojas atribuídas - normalizado
  const uniqueLojasMarcas = (() => {
    const marcasMap = new Map<string, string>();
    lojasAtribuidas.forEach(l => {
      if (l.marca) {
        const key = l.marca.toLowerCase();
        if (!marcasMap.has(key)) {
          marcasMap.set(key, l.marca.charAt(0).toUpperCase() + l.marca.slice(1).toLowerCase());
        }
      }
    });
    return [...marcasMap.values()].sort();
  })();
  
  const uniqueLojasUFs = (() => {
    const ufsSet = new Set<string>();
    lojasAtribuidas.forEach(l => {
      if (l.uf) {
        ufsSet.add(l.uf.toUpperCase());
      }
    });
    return [...ufsSet].sort();
  })();
  
  const uniqueLojasCidades = (() => {
    const cidadesMap = new Map<string, string>();
    lojasAtribuidas.forEach(l => {
      if (l.cidade) {
        const key = l.cidade.toLowerCase();
        if (!cidadesMap.has(key)) {
          // Capitaliza cada palavra da cidade
          const capitalizado = l.cidade
            .split(' ')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          cidadesMap.set(key, capitalizado);
        }
      }
    });
    return [...cidadesMap.values()].sort();
  })();

  // Resetar filtros de lojas quando muda o agente
  const resetLojaFilters = () => {
    setFilterLojaMarca("all");
    setFilterLojaUF("all");
    setFilterLojaCidade("all");
  };

  // Toggle para selecionar todas as lojas filtradas
  const toggleSelectAllLojasFiltered = () => {
    const filteredIds = filteredLojasAtribuidas.map(l => l.id);
    const allSelected = filteredIds.every(id => selectedLojasToRemove.includes(id));
    if (allSelected) {
      setSelectedLojasToRemove(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedLojasToRemove(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const toggleSelectAllLojas = () => {
    if (selectedLojasToRemove.length === lojasAtribuidas.length) {
      setSelectedLojasToRemove([]);
    } else {
      setSelectedLojasToRemove(lojasAtribuidas.map(l => l.id));
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    applyFilters(term, filterEmpresa, filterMarca, filterUF, filterStatus, filterNumero, filterNomeAgente);
  };

  const handleFilterEmpresa = (empresaId: string) => {
    setFilterEmpresa(empresaId);
    applyFilters(searchTerm, empresaId, filterMarca, filterUF, filterStatus, filterNumero, filterNomeAgente);
  };

  const handleFilterMarca = (marca: string) => {
    setFilterMarca(marca);
    applyFilters(searchTerm, filterEmpresa, marca, filterUF, filterStatus, filterNumero, filterNomeAgente);
  };

  const handleFilterUF = (uf: string) => {
    setFilterUF(uf);
    applyFilters(searchTerm, filterEmpresa, filterMarca, uf, filterStatus, filterNumero, filterNomeAgente);
  };

  const handleFilterStatus = (status: string) => {
    setFilterStatus(status);
    applyFilters(searchTerm, filterEmpresa, filterMarca, filterUF, status, filterNumero, filterNomeAgente);
  };

  const handleFilterNumero = (numero: string) => {
    setFilterNumero(numero);
    applyFilters(searchTerm, filterEmpresa, filterMarca, filterUF, filterStatus, numero, filterNomeAgente);
  };

  const handleFilterNomeAgente = (nome: string) => {
    setFilterNomeAgente(nome);
    applyFilters(searchTerm, filterEmpresa, filterMarca, filterUF, filterStatus, filterNumero, nome);
  };

  // Extrair opções únicas para os filtros - normalizado para case-insensitive
  // Para marcas: agrupa case-insensitive e usa a versão capitalizada
  const uniqueMarcas = (() => {
    const marcasMap = new Map<string, string>();
    agentes.forEach(a => {
      if (a.marca) {
        const key = a.marca.toLowerCase();
        if (!marcasMap.has(key)) {
          // Capitaliza: primeira letra maiúscula, resto minúsculo
          marcasMap.set(key, a.marca.charAt(0).toUpperCase() + a.marca.slice(1).toLowerCase());
        }
      }
    });
    return [...marcasMap.values()].sort();
  })();

  // Para UFs: sempre maiúsculo
  const uniqueUFs = (() => {
    const ufsSet = new Set<string>();
    agentes.forEach(a => {
      if (a.uf) {
        ufsSet.add(a.uf.toUpperCase());
      }
    });
    return [...ufsSet].sort();
  })();

  // Para nomes de agentes: agrupa case-insensitive e usa a versão capitalizada
  const uniqueAgentesNomes = (() => {
    const nomesMap = new Map<string, string>();
    agentes.forEach(a => {
      const nome = (a as any).agente || a.nome;
      if (nome) {
        const key = nome.toLowerCase();
        if (!nomesMap.has(key)) {
          // Capitaliza cada palavra
          const capitalizado = nome
            .split(/[\s-]+/)
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          nomesMap.set(key, capitalizado);
        }
      }
    });
    return [...nomesMap.values()].sort();
  })();

  const applyFilters = (term: string, empresaId: string, marca: string, uf: string, status: string, numero: string, nomeAgente: string) => {
    let filtered = [...agentes];
    
    // Filtro por termo de busca (busca livre em múltiplos campos)
    if (term) {
      const lowerTerm = term.toLowerCase();
      filtered = filtered.filter(a => 
        // Campo 'agente' do webhook (nome real do agente)
        (a as any).agente?.toLowerCase().includes(lowerTerm) ||
        // Campo 'nome' fallback
        a.nome?.toLowerCase().includes(lowerTerm) ||
        // Instância completa
        a.instancia?.toLowerCase().includes(lowerTerm) ||
        // Marca
        a.marca?.toLowerCase().includes(lowerTerm) ||
        // UF
        a.uf?.toLowerCase().includes(lowerTerm) ||
        // Telefone/Número
        a.telefone?.includes(lowerTerm) ||
        a.num_maia?.includes(lowerTerm)
      );
    }

    // Filtro por nome do agente (dropdown) - comparação exata case-insensitive
    if (nomeAgente && nomeAgente !== "all") {
      filtered = filtered.filter(a => {
        const agenteNome = ((a as any).agente || a.nome || "");
        // Comparação case-insensitive
        return agenteNome.toLowerCase() === nomeAgente.toLowerCase();
      });
    }
    
    // Filtro por empresa
    if (empresaId && empresaId !== "all") {
      filtered = filtered.filter(a => a.empresa_id === empresaId);
    }

    // Filtro por marca - comparação case-insensitive
    if (marca && marca !== "all") {
      filtered = filtered.filter(a => 
        a.marca?.toLowerCase() === marca.toLowerCase()
      );
    }

    // Filtro por UF - comparação case-insensitive
    if (uf && uf !== "all") {
      filtered = filtered.filter(a => 
        a.uf?.toUpperCase() === uf.toUpperCase()
      );
    }

    // Filtro por status
    if (status && status !== "all") {
      if (status === "ativo") {
        filtered = filtered.filter(a => a.ativo !== false);
      } else if (status === "inativo") {
        filtered = filtered.filter(a => a.ativo === false);
      }
    }

    // Filtro por número - busca parcial
    if (numero) {
      const numeroLimpo = numero.replace(/\D/g, ''); // Remove caracteres não numéricos
      filtered = filtered.filter(a => {
        const numMaia = (a.num_maia || '').replace(/\D/g, '');
        const telefone = (a.telefone || '').replace(/\D/g, '');
        return numMaia.includes(numeroLimpo) || telefone.includes(numeroLimpo);
      });
    }
    
    setFilteredAgentes(filtered);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setFilterEmpresa("all");
    setFilterMarca("all");
    setFilterUF("all");
    setFilterStatus("all");
    setFilterNumero("");
    setFilterNomeAgente("all");
    setFilteredAgentes(agentes);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredAgentes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAgentes = filteredAgentes.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleCopyToClipboard = async (e: React.MouseEvent, text: string, label: string) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copiado!",
        description: `${label} copiado para a área de transferência`,
      });
    } catch (err) {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      toast({
        title: "Copiado!",
        description: `${label} copiado para a área de transferência`,
      });
    }
  };

  const buscarInstancia = async (telefone: string) => {
    try {
      setLoadingInstancia(true);
      
      const { data, error } = await supabase.functions.invoke('external-webhook-proxy', {
        body: { 
          endpoint: 'verifica-instancias_evo',
          telefone 
        }
      });

      if (error) {
        throw new Error(`Erro na requisição: ${error.message}`);
      }
      
      if (data && Object.keys(data).length > 0 && data.num_maia) {
        setInstanciaData(data);
      } else {
        setInstanciaData(null);
      }
    } catch (error) {
      console.error('Erro ao buscar instância:', error);
      setInstanciaData(null);
    } finally {
      setLoadingInstancia(false);
    }
  };

  const buscarAgenteLocal = async (telefone: string, agenteWebhook?: AgenteWebhook | null): Promise<AgenteLocal | null> => {
    try {
      const { data, error } = await supabase
        .from('agentes_ia')
        .select('*')
        .eq('telefone', telefone)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setAgenteLocal(data as AgenteLocal);
        setFormData({
          nome: data.nome || "",
          persona: data.persona || "",
          cerebro: data.cerebro || "",
          telefone: data.telefone || "",
          dealer_id: data.dealer_id || "",
          foto_url: data.foto_url || "",
          ativo: data.ativo ?? true
        });
        return data as AgenteLocal;
      } else if (agenteWebhook) {
        // Se o agente existe no webhook mas não no banco local, criar automaticamente
        const { data: newAgent, error: insertError } = await supabase
          .from('agentes_ia')
          .insert({
            nome: agenteWebhook.nome || "Novo Agente",
            telefone: telefone,
            ativo: agenteWebhook.ativo !== false,
            criado_por: user?.id
          })
          .select()
          .single();

        if (insertError) {
          console.error('Erro ao criar agente local:', insertError);
          setAgenteLocal(null);
          return null;
        } else if (newAgent) {
          setAgenteLocal(newAgent as AgenteLocal);
          setFormData({
            nome: newAgent.nome || "",
            persona: newAgent.persona || "",
            cerebro: newAgent.cerebro || "",
            telefone: newAgent.telefone || "",
            dealer_id: newAgent.dealer_id || "",
            foto_url: newAgent.foto_url || "",
            ativo: newAgent.ativo ?? true
          });
          return newAgent as AgenteLocal;
        }
      } else {
        setAgenteLocal(null);
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar agente local:', error);
      setAgenteLocal(null);
      return null;
    }
  };

  const handleOpenAgentModal = async (agente: AgenteWebhook) => {
    setSelectedAgente(agente);
    setInstanciaData(null);
    setAgenteLocal(null);
    setEditInstancia(false);
    setEditedInstancia(null);
    setShowEvoToken(false);
    setShowCwToken(false);
    setActiveTab("dados-gerais");
    setIsNewAgente(false);
    setLojasAtribuidas([]);
    
    // Reset form with webhook data
    setFormData({
      nome: agente.nome || "",
      persona: "",
      cerebro: "",
      telefone: agente.telefone || agente.num_maia || "",
      dealer_id: "",
      foto_url: "",
      ativo: agente.ativo !== false
    });

    setShowAgentModal(true);

    // Buscar dados da instância e agente local
    if (agente.telefone || agente.num_maia) {
      const tel = agente.telefone || agente.num_maia || "";
      await buscarInstancia(tel);
      const agenteLocalData = await buscarAgenteLocal(tel, agente);
      
      // Buscar lojas atribuídas se o agente existe no banco local
      if (agenteLocalData?.id) {
        await carregarLojasAtribuidas(agenteLocalData.id);
      }
    }
  };

  const handleCreateNewAgent = () => {
    setSelectedAgente(null);
    setInstanciaData(null);
    setAgenteLocal(null);
    setEditInstancia(false);
    setEditedInstancia(null);
    setShowEvoToken(false);
    setShowCwToken(false);
    setActiveTab("instancias"); // Ir direto para a aba de instâncias
    setIsNewAgente(true);
    
    setFormData({
      nome: "",
      persona: "",
      cerebro: "",
      telefone: "",
      dealer_id: "",
      foto_url: "",
      ativo: true
    });

    // Resetar o formulário de nova instância
    setNovaInstancia({
      num_maia: "",
      marca: "",
      uf: "",
      instancia: "",
      evo_token: "",
      id_numero_meta: "",
      tb_histories: "",
      cw_inbox: "",
      waba: "",
      meta_app_id: "",
      agente: "",
      cw_token_maia: ""
    });

    setShowAgentModal(true);
  };

  const handleCloseAgentModal = () => {
    setShowAgentModal(false);
    setSelectedAgente(null);
    setAgenteLocal(null);
    setInstanciaData(null);
    setEditInstancia(false);
    setEditedInstancia(null);
    setIsNewAgente(false);
    setLojasAtribuidas([]);
    setSelectedLojasToRemove([]);
    resetLojaFilters();
    setNovaInstancia({
      num_maia: "",
      marca: "",
      uf: "",
      instancia: "",
      evo_token: "",
      id_numero_meta: "",
      tb_histories: "",
      cw_inbox: "",
      waba: "",
      meta_app_id: "",
      agente: "",
      cw_token_maia: ""
    });
  };

  // File upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione apenas arquivos de imagem",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Erro", 
        description: "A imagem deve ter no máximo 5MB",
        variant: "destructive"
      });
      return;
    }

    try {
      setUploading(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `agents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('agent-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('agent-photos')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, foto_url: publicUrl }));

      toast({
        title: "Sucesso",
        description: "Foto carregada com sucesso"
      });
    } catch (error) {
      console.error('Erro no upload:', error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível carregar a imagem",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  // Save agent to local database
  const handleSaveAgente = async () => {
    if (!formData.nome.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do agente é obrigatório",
        variant: "destructive"
      });
      return;
    }
    if (!formData.telefone.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O telefone do agente é obrigatório",
        variant: "destructive"
      });
      return;
    }

    const buildAtualizaAgentePayload = () => {
      // Prioridade: editedInstancia > instanciaData > selectedAgente (do webhook busca-dados-agentes)
      const instanciaFonte = (editInstancia && editedInstancia) ? editedInstancia : instanciaData;
      
      // Usar selectedAgente como fallback para os dados de instância
      const numeroAgente = formData.telefone.trim() || instanciaFonte?.num_maia || selectedAgente?.num_maia || selectedAgente?.telefone || "";
      const nomeAgente = formData.nome.trim() || instanciaFonte?.agente || selectedAgente?.nome || "";

      // Combinar dados: instanciaFonte tem prioridade, depois selectedAgente
      return {
        // Campos de Instâncias - usar instanciaFonte, fallback para selectedAgente
        num_maia: numeroAgente,
        marca: instanciaFonte?.marca ?? selectedAgente?.marca ?? null,
        uf: instanciaFonte?.uf ?? selectedAgente?.uf ?? null,
        instancia: instanciaFonte?.instancia ?? selectedAgente?.instancia ?? null,
        evo_token: instanciaFonte?.evo_token ?? selectedAgente?.evo_token ?? null,
        id_numero_meta: instanciaFonte?.id_numero_meta ?? (selectedAgente as any)?.id_numero_meta ?? null,
        criado_em: instanciaFonte?.criado_em ?? (selectedAgente as any)?.criado_em ?? null,
        tb_histories: instanciaFonte?.tb_histories ?? (selectedAgente as any)?.tb_histories ?? null,
        cw_inbox: instanciaFonte?.cw_inbox ?? (selectedAgente as any)?.cw_inbox ?? null,
        waba: instanciaFonte?.waba ?? (selectedAgente as any)?.waba ?? null,
        meta_app_id: instanciaFonte?.meta_app_id ?? (selectedAgente as any)?.meta_app_id ?? null,
        agente: nomeAgente || instanciaFonte?.agente || null,
        cw_token_maia: instanciaFonte?.cw_token_maia ?? selectedAgente?.cw_token_maia ?? null,

        // Campos de Dados Gerais
        nome_agente: nomeAgente,
        telefone: numeroAgente,
        dealer_id: formData.dealer_id.trim() || agenteLocal?.dealer_id || null,
        foto_url: formData.foto_url.trim() || agenteLocal?.foto_url || null,
        ativo: formData.ativo,
        persona: formData.persona.trim() || agenteLocal?.persona || null,
        cerebro: formData.cerebro.trim() || agenteLocal?.cerebro || null,

        // Auditoria
        atualizado_em: new Date().toISOString(),
      };
    };

    try {
      setSavingAgente(true);

      if (agenteLocal) {
        // Update existing
        const { error: updateError } = await supabase
          .from('agentes_ia')
          .update({
            nome: formData.nome,
            persona: formData.persona,
            cerebro: formData.cerebro,
            telefone: formData.telefone,
            dealer_id: formData.dealer_id,
            foto_url: formData.foto_url,
            ativo: formData.ativo
          })
          .eq('id', agenteLocal.id);

        if (updateError) throw updateError;

        // Reload agent data after update
        const { data: updatedAgent } = await supabase
          .from('agentes_ia')
          .select('*')
          .eq('id', agenteLocal.id)
          .single();

        if (updatedAgent) {
          setAgenteLocal(updatedAgent as AgenteLocal);
        }
      } else {
        // Create new
        const { data: newAgent, error: insertError } = await supabase
          .from('agentes_ia')
          .insert({
            nome: formData.nome,
            persona: formData.persona,
            cerebro: formData.cerebro,
            telefone: formData.telefone,
            dealer_id: formData.dealer_id,
            foto_url: formData.foto_url,
            ativo: formData.ativo,
            criado_por: user?.id
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Set the newly created agent as agenteLocal to enable other tabs
        if (newAgent) {
          setAgenteLocal(newAgent as AgenteLocal);
          setIsNewAgente(false);
        }
      }

      // Sempre chamar o webhook de atualização ao salvar
      const webhookPayload = buildAtualizaAgentePayload();
      console.log('Enviando para webhook atualiza-agente:', webhookPayload);

      try {
        const { error: webhookError } = await supabase.functions.invoke('external-webhook-proxy', {
          body: {
            endpoint: 'atualiza-agente',
            ...webhookPayload
          }
        });

        if (webhookError) {
          console.error('Webhook atualiza-agente retornou erro:', webhookError);
          toast({
            title: "Atenção",
            description: "Salvo no sistema, mas falhou ao atualizar no webhook (atualiza-agente).",
            variant: "destructive"
          });
        }
      } catch (webhookError) {
        console.error('Erro ao chamar webhook atualiza-agente:', webhookError);
        toast({
          title: "Atenção",
          description: "Salvo no sistema, mas não foi possível chamar o webhook (atualiza-agente).",
          variant: "destructive"
        });
      }

      toast({
        title: agenteLocal ? "Agente atualizado" : "Agente criado",
        description: agenteLocal ? "O agente foi atualizado com sucesso" : "O agente foi criado com sucesso"
      });

      // Refresh data
      if (formData.telefone) {
        await buscarInstancia(formData.telefone);
      }
      carregarAgentes();
    } catch (saveError) {
      console.error('Erro ao salvar agente:', saveError);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o agente",
        variant: "destructive"
      });
    } finally {
      setSavingAgente(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!agenteLocal) return;
    
    try {
      const newStatus = !formData.ativo;
      
      const { error } = await supabase
        .from('agentes_ia')
        .update({ ativo: newStatus })
        .eq('id', agenteLocal.id);

      if (error) throw error;

      setFormData(prev => ({ ...prev, ativo: newStatus }));

      toast({
        title: newStatus ? "Agente ativado" : "Agente inativado",
        description: `O agente foi ${newStatus ? 'ativado' : 'inativado'} com sucesso`
      });
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast({
        title: "Erro ao alterar status",
        description: "Não foi possível alterar o status do agente",
        variant: "destructive"
      });
    }
  };

  const handleDeleteAgente = async () => {
    if (!agenteLocal) return;
    
    if (!confirm(`Tem certeza que deseja excluir o agente "${formData.nome}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('agentes_ia')
        .delete()
        .eq('id', agenteLocal.id);

      if (error) throw error;

      toast({
        title: "Agente excluído",
        description: "O agente foi excluído com sucesso"
      });

      handleCloseAgentModal();
      carregarAgentes();
    } catch (error) {
      console.error('Erro ao excluir agente:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o agente",
        variant: "destructive"
      });
    }
  };

  // Instancia edit handlers
  const handleEditInstancia = () => {
    if (instanciaData) {
      setEditedInstancia({ ...instanciaData });
      setEditInstancia(true);
    }
  };

  const handleCancelInstanciaEdit = () => {
    setEditInstancia(false);
    setEditedInstancia(null);
  };

  const handleInstanciaFieldChange = (field: keyof InstanciaData, value: string) => {
    if (editedInstancia) {
      setEditedInstancia({
        ...editedInstancia,
        [field]: value
      });

      // Sincronizar campos comuns com Dados Gerais
      if (field === 'num_maia') {
        setFormData(prev => ({ ...prev, telefone: value }));
      }
      if (field === 'agente') {
        setFormData(prev => ({ ...prev, nome: value }));
      }
    }
  };

  const handleSaveInstancia = async () => {
    if (!editedInstancia || !selectedAgente?.telefone) return;

    try {
      setSavingInstancia(true);

      const { error: instanciaError } = await supabase.functions.invoke('external-webhook-proxy', {
        body: {
          endpoint: 'atualiza-instancias_evo',
          telefone: selectedAgente.telefone,
          ...editedInstancia
        }
      });

      if (instanciaError) {
        throw new Error(`Erro na requisição: ${instanciaError.message}`);
      }

      toast({
        title: "Instância atualizada",
        description: "Os dados da instância foram salvos com sucesso"
      });

      setInstanciaData(editedInstancia);
      setEditInstancia(false);
      setEditedInstancia(null);
      carregarAgentes();
    } catch (saveInstanciaError) {
      console.error('Erro ao salvar instância:', saveInstanciaError);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as alterações da instância",
        variant: "destructive"
      });
    } finally {
      setSavingInstancia(false);
    }
  };

  // Nova instância handlers - sincroniza dados entre abas
  const handleNovaInstanciaChange = (field: keyof NovaInstanciaData, value: string) => {
    setNovaInstancia(prev => ({
      ...prev,
      [field]: value
    }));
    // Sincronizar número do agente com telefone em dados gerais
    if (field === 'num_maia') {
      setFormData(prev => ({ ...prev, telefone: value }));
    }
    // Sincronizar nome do agente com dados gerais
    if (field === 'agente') {
      setFormData(prev => ({ ...prev, nome: value }));
    }
  };

  // Sincronizar telefone de dados gerais com instância
  const handleTelefoneChange = (value: string) => {
    setFormData(prev => ({ ...prev, telefone: value }));
    setNovaInstancia(prev => ({ ...prev, num_maia: value }));

    // Se já existe instância carregada/edição, sincronizar também
    if (instanciaData) {
      setInstanciaData(prev => prev ? ({ ...prev, num_maia: value }) : prev);
    }
    if (editedInstancia) {
      setEditedInstancia(prev => prev ? ({ ...prev, num_maia: value }) : prev);
    }
  };

  // Sincronizar nome de dados gerais com instância
  const handleNomeChange = (value: string) => {
    setFormData(prev => ({ ...prev, nome: value }));
    setNovaInstancia(prev => ({ ...prev, agente: value }));

    // Se já existe instância carregada/edição, sincronizar também
    if (instanciaData) {
      setInstanciaData(prev => prev ? ({ ...prev, agente: value }) : prev);
    }
    if (editedInstancia) {
      setEditedInstancia(prev => prev ? ({ ...prev, agente: value }) : prev);
    }
  };

  // Gerar instância automaticamente
  const gerarInstancia = (agente: string, marca: string, uf: string, num_maia: string) => {
    if (!marca || !uf || !num_maia) return "";
    return `${agente || 'maia'}${marca.toLowerCase()}${uf.toLowerCase()}+55${num_maia}`;
  };

  // Criar nova instância via webhook e salvar no Supabase
  const handleCriarInstancia = async () => {
    // Validar campos obrigatórios
    if (!novaInstancia.num_maia.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O número do agente é obrigatório",
        variant: "destructive"
      });
      return;
    }
    if (!novaInstancia.uf.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "A UF é obrigatória",
        variant: "destructive"
      });
      return;
    }
    if (!novaInstancia.agente.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do agente é obrigatório",
        variant: "destructive"
      });
      return;
    }

    try {
      setCreatingInstancia(true);

      // Gerar instância automaticamente
      const instanciaGerada = gerarInstancia(
        novaInstancia.agente.trim() || 'maia',
        novaInstancia.marca.trim(),
        novaInstancia.uf.trim(),
        novaInstancia.num_maia.trim()
      );

      // Combinar dados de Dados Gerais e Instâncias
      const payload = {
        num_maia: novaInstancia.num_maia.trim() || formData.telefone.trim(),
        marca: novaInstancia.marca.trim().toLowerCase(),
        uf: novaInstancia.uf.trim(),
        instancia: instanciaGerada,
        evo_token: novaInstancia.evo_token.trim() || "",
        id_numero_meta: novaInstancia.id_numero_meta.trim() || null,
        criado_em: new Date().toISOString(),
        tb_histories: novaInstancia.tb_histories.trim() || null,
        cw_inbox: novaInstancia.cw_inbox.trim() || null,
        waba: novaInstancia.waba.trim() || null,
        meta_app_id: novaInstancia.meta_app_id.trim() || null,
        agente: novaInstancia.agente.trim() || formData.nome.trim() || null,
        cw_token_maia: novaInstancia.cw_token_maia.trim() || null,
        // Dados adicionais de Dados Gerais
        nome_agente: formData.nome.trim() || novaInstancia.agente.trim(),
        telefone: formData.telefone.trim() || novaInstancia.num_maia.trim(),
        dealer_id: formData.dealer_id.trim() || null,
        foto_url: formData.foto_url.trim() || null,
        ativo: formData.ativo
      };

      console.log('Enviando para webhook cria-agente:', payload);

      // Enviar para o webhook via edge function
      const { data: result, error: webhookError } = await supabase.functions.invoke('external-webhook-proxy', {
        body: {
          endpoint: 'cria-agente',
          ...payload
        }
      });

      if (webhookError) {
        throw new Error(`Erro na requisição do webhook: ${webhookError.message}`);
      }

      console.log('Resposta do webhook cria-agente:', result);

      // Determinar o nome do agente para salvar no banco
      const nomeAgente = formData.nome.trim() || novaInstancia.agente.trim() || `${novaInstancia.agente.trim() || 'Maia'} ${novaInstancia.marca.trim()} ${novaInstancia.uf.trim()}`;

      // Salvar no banco Supabase
      const { data: newAgent, error: insertError } = await supabase
        .from('agentes_ia')
        .insert({
          nome: nomeAgente,
          telefone: novaInstancia.num_maia.trim() || formData.telefone.trim(),
          dealer_id: formData.dealer_id.trim() || null,
          foto_url: formData.foto_url.trim() || null,
          ativo: formData.ativo,
          criado_por: user?.id
        })
        .select()
        .single();

      if (insertError) {
        console.error('Erro ao salvar no Supabase:', insertError);
        throw insertError;
      }

      // Atualizar estado local
      if (newAgent) {
        setAgenteLocal(newAgent as AgenteLocal);
        setFormData({
          nome: newAgent.nome || "",
          persona: newAgent.persona || "",
          cerebro: newAgent.cerebro || "",
          telefone: newAgent.telefone || "",
          dealer_id: newAgent.dealer_id || "",
          foto_url: newAgent.foto_url || "",
          ativo: newAgent.ativo ?? true
        });
        setIsNewAgente(false);
      }

      // Atualizar instanciaData com os dados criados
      setInstanciaData(payload as InstanciaData);

      toast({
        title: "Agente criado com sucesso!",
        description: `O agente foi criado no webhook e salvo no banco de dados.`
      });

      // Resetar formulário
      setNovaInstancia({
        num_maia: "",
        marca: "",
        uf: "",
        instancia: "",
        evo_token: "",
        id_numero_meta: "",
        tb_histories: "",
        cw_inbox: "",
        waba: "",
        meta_app_id: "",
        agente: "",
        cw_token_maia: ""
      });

      // Recarregar lista de agentes
      carregarAgentes();

    } catch (error: any) {
      console.error('Erro ao criar agente:', error);
      
      // Construir mensagem de erro detalhada
      let errorMessage = "";
      
      if (error?.message?.includes('webhook')) {
        errorMessage = `Erro no webhook: ${error.message}`;
      } else if (error?.code) {
        // Erro do Supabase
        switch (error.code) {
          case '23505':
            errorMessage = "Já existe um agente com este telefone.";
            break;
          case '23503':
            errorMessage = "Referência inválida: empresa ou usuário não encontrado.";
            break;
          case '23502':
            errorMessage = `Campo obrigatório faltando: ${error.details || error.message}`;
            break;
          default:
            errorMessage = `Erro no banco de dados: ${error.message || error.code}`;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      } else {
        errorMessage = "Erro desconhecido ao criar agente.";
      }
      
      toast({
        title: "Erro ao criar agente",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setCreatingInstancia(false);
    }
  };

  // Preview da instância gerada
  const instanciaPreview = gerarInstancia(
    novaInstancia.agente,
    novaInstancia.marca,
    novaInstancia.uf,
    novaInstancia.num_maia
  );

  const handleOpenAssignModal = async (e: React.MouseEvent, agente: AgenteWebhook) => {
    e.stopPropagation();
    setAgenteToAssign(agente);
    setAssignFilterMarca("all");
    setAssignFilterNome("");
    setAssignFilterUF("all");
    setShowAssignModal(true);
    
    // Buscar o agente local e suas empresas atribuídas
    const telefone = agente.telefone || agente.num_maia;
    if (telefone) {
      const { data: existingAgent } = await supabase
        .from('agentes_ia')
        .select('id')
        .eq('telefone', telefone)
        .maybeSingle();

      if (existingAgent) {
        await carregarEmpresasAtribuidas(existingAgent.id);
      } else {
        setSelectedEmpresaIds([]);
      }
    } else {
      setSelectedEmpresaIds([]);
    }
  };

  const handleToggleEmpresa = (empresaId: string) => {
    setSelectedEmpresaIds(prev => 
      prev.includes(empresaId) 
        ? prev.filter(id => id !== empresaId)
        : [...prev, empresaId]
    );
  };

  const handleAssignAgente = async () => {
    if (!agenteToAssign) return;

    try {
      const telefone = agenteToAssign.telefone || agenteToAssign.num_maia;
      
      if (!telefone) {
        toast({
          title: "Erro",
          description: "Agente não possui telefone definido",
          variant: "destructive"
        });
        return;
      }

      // Verificar se já existe um agente com esse telefone
      let agenteId: string;
      const { data: existingAgent } = await supabase
        .from('agentes_ia')
        .select('id')
        .eq('telefone', telefone)
        .maybeSingle();

      if (existingAgent) {
        agenteId = existingAgent.id;
      } else {
        // Criar um novo agente
        const { data: newAgent, error: insertError } = await supabase
          .from('agentes_ia')
          .insert({
            nome: agenteToAssign.nome || `Agente ${agenteToAssign.marca} ${agenteToAssign.uf}`,
            telefone: telefone,
            ativo: true,
            criado_por: user?.id
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        agenteId = newAgent.id;
      }

      // Remover todas as atribuições atuais
      await supabase
        .from('agente_empresas')
        .delete()
        .eq('agente_id', agenteId);

      // Adicionar novas atribuições
      if (selectedEmpresaIds.length > 0) {
        const atribuicoes = selectedEmpresaIds.map(empresaId => ({
          agente_id: agenteId,
          empresa_id: empresaId,
          created_by: user?.id
        }));

        const { error: assignError } = await supabase
          .from('agente_empresas')
          .insert(atribuicoes);

        if (assignError) throw assignError;
      }
      
      toast({
        title: "Atribuições atualizadas",
        description: `Agente ${agenteToAssign.nome || agenteToAssign.marca} foi atribuído a ${selectedEmpresaIds.length} empresa(s)`
      });
      
      setShowAssignModal(false);
      setAgenteToAssign(null);
      setSelectedEmpresaIds([]);
      carregarAgentes();
    } catch (error) {
      console.error('Erro ao atribuir agente:', error);
      toast({
        title: "Erro ao atribuir",
        description: "Não foi possível atribuir o agente às empresas",
        variant: "destructive"
      });
    }
  };

  // Filtrar empresas para o modal de atribuição
  const filteredEmpresasModal = empresas.filter(empresa => {
    if (assignFilterMarca !== "all" && empresa.marca !== assignFilterMarca) return false;
    if (assignFilterUF !== "all" && empresa.uf !== assignFilterUF) return false;
    if (assignFilterNome && !empresa.nome_empresa.toLowerCase().includes(assignFilterNome.toLowerCase())) return false;
    return true;
  });

  // Extrair opções únicas para os filtros do modal
  const uniqueEmpresaMarcas = [...new Set(empresas.map(e => e.marca).filter(Boolean))].sort() as string[];
  const uniqueEmpresaUFs = [...new Set(empresas.map(e => e.uf).filter(Boolean))].sort() as string[];

  useEffect(() => {
    if (canAccess) {
      carregarAgentes();
      carregarEmpresas();
    }
  }, [canAccess]);

  if (accessLoading) {
    return (
      <DashboardLayout title="Agentes - Administração">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!canAccess) {
    return (
      <DashboardLayout title="Agentes - Administração">
        <Alert variant="destructive">
          <AlertDescription>
            Acesso restrito. Apenas usuários do departamento TI com tipo de acesso TI ou Administrador podem acessar esta página.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Agentes - Administração">
      <ScrollIndicator className="flex-1 h-full">
        <div className="space-y-6 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Agentes</h1>
            <p className="text-muted-foreground">
              Gerencie agentes de IA e controle de implantação
            </p>
          </div>

          {/* Tabs Principais */}
          <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="agentes">Agentes de IA</TabsTrigger>
              <TabsTrigger value="controle">Controle de Agentes</TabsTrigger>
            </TabsList>

            {/* Tab Agentes de IA */}
            <TabsContent value="agentes" className="space-y-6 mt-6">
              <div className="flex items-center justify-end gap-2">
                <Button onClick={handleCreateNewAgent}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Agente
                </Button>
                <Button onClick={carregarAgentes} disabled={loading} variant="outline">
                  {loading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Atualizar
                </Button>
              </div>

          {/* Filtros */}
          <Card className="border-muted">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col gap-3">
                {/* Linha principal de filtros */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Filtro por Nome do Agente (dropdown) */}
                  <Select value={filterNomeAgente} onValueChange={handleFilterNomeAgente}>
                    <SelectTrigger className="w-[140px] h-9">
                      <Bot className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                      <SelectValue placeholder="Agente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {uniqueAgentesNomes.map((nome) => (
                        <SelectItem key={nome} value={nome}>
                          {nome.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Busca livre */}
                  <div className="relative flex-1 min-w-[180px] max-w-[240px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-8 h-9 text-sm"
                    />
                  </div>

                  {/* Filtro por Número */}
                  <div className="relative min-w-[140px] max-w-[160px]">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Número..."
                      value={filterNumero}
                      onChange={(e) => handleFilterNumero(e.target.value)}
                      className="pl-8 h-9 text-sm"
                    />
                  </div>

                  {/* Filtro por UF */}
                  <Select value={filterUF} onValueChange={handleFilterUF}>
                    <SelectTrigger className="w-[100px] h-9">
                      <MapPin className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {uniqueUFs.map((uf) => (
                        <SelectItem key={uf} value={uf!}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Filtro por Marca */}
                  <Select value={filterMarca} onValueChange={handleFilterMarca}>
                    <SelectTrigger className="w-[160px] h-9">
                      <Store className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                      <SelectValue placeholder="Marca" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {uniqueMarcas.map((marca) => (
                        <SelectItem key={marca} value={marca!}>
                          {marca}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Filtro por Status */}
                  <Select value={filterStatus} onValueChange={handleFilterStatus}>
                    <SelectTrigger className="w-[130px] h-9">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="ativo">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                          Ativo
                        </span>
                      </SelectItem>
                      <SelectItem value="inativo">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-red-500" />
                          Desativado
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Filtro por Empresa */}
                  <Select value={filterEmpresa} onValueChange={handleFilterEmpresa}>
                    <SelectTrigger className="w-[180px] h-9">
                      <Building2 className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                      <SelectValue placeholder="Empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {empresas.map((empresa) => (
                        <SelectItem key={empresa.id} value={empresa.id}>
                          {empresa.nome_empresa}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Botão limpar filtros */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="h-9 px-3 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Limpar
                  </Button>
                </div>

                {/* Indicador de filtros ativos */}
                {(searchTerm || filterNumero || filterMarca !== "all" || filterUF !== "all" || filterStatus !== "all" || filterEmpresa !== "all" || filterNomeAgente !== "all") && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Filtros ativos:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {filterNomeAgente !== "all" && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          Agente: {filterNomeAgente}
                        </Badge>
                      )}
                      {searchTerm && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          Busca: {searchTerm}
                        </Badge>
                      )}
                      {filterNumero && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          Número: {filterNumero}
                        </Badge>
                      )}
                      {filterUF !== "all" && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          UF: {filterUF}
                        </Badge>
                      )}
                      {filterMarca !== "all" && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          Marca: {filterMarca}
                        </Badge>
                      )}
                      {filterStatus !== "all" && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          Status: {filterStatus === "ativo" ? "Ativo" : "Desativado"}
                        </Badge>
                      )}
                      {filterEmpresa !== "all" && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          Empresa: {empresas.find(e => e.id === filterEmpresa)?.nome_empresa || filterEmpresa}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lista de Agentes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Agentes ({filteredAgentes.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAgentes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum agente encontrado
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marca</TableHead>
                      <TableHead>UF</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Instância</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAgentes.map((agente, index) => (
                      <TableRow 
                        key={agente.id || index} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleOpenAgentModal(agente)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{agente.marca || "N/A"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{agente.uf || "N/A"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{agente.num_maia || "N/A"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {(agente as any).agente || agente.nome || "N/A"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]" title={agente.instancia || "N/A"}>
                              {agente.instancia || "N/A"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={agente.ativo !== false 
                              ? "bg-green-500 hover:bg-green-600 text-white" 
                              : "bg-red-500 hover:bg-red-600 text-white"
                            }
                          >
                            {agente.ativo !== false ? "Ativo" : "Desativado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => handleOpenAssignModal(e, agente)}
                          >
                            <Building2 className="h-4 w-4 mr-1" />
                            Atribuir
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {startIndex + 1}-{Math.min(endIndex, filteredAgentes.length)} de {filteredAgentes.length} agentes
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => {
                          if (totalPages <= 7) return true;
                          if (page === 1 || page === totalPages) return true;
                          if (Math.abs(page - currentPage) <= 1) return true;
                          return false;
                        })
                        .map((page, index, arr) => (
                          <span key={page} className="flex items-center">
                            {index > 0 && arr[index - 1] !== page - 1 && (
                              <span className="px-2 text-muted-foreground">...</span>
                            )}
                            <Button
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              className="w-8 h-8 p-0"
                              onClick={() => handlePageChange(page)}
                            >
                              {page}
                            </Button>
                          </span>
                        ))
                      }
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Próximo
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Modal Principal do Agente */}
          <Dialog open={showAgentModal} onOpenChange={setShowAgentModal}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  {isNewAgente ? "Novo Agente" : `${selectedAgente?.marca || formData.nome || "Agente"}`}
                </DialogTitle>
                <DialogDescription>
                  {isNewAgente ? "Criar um novo agente de IA" : "Visualize e edite os dados do agente"}
                </DialogDescription>
              </DialogHeader>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 justify-end border-b pb-4">
                {!isNewAgente && (
                  <Button onClick={handleSaveAgente} disabled={savingAgente}>
                    <Save className="h-4 w-4 mr-2" />
                    {savingAgente ? "Salvando..." : "Salvar"}
                  </Button>
                )}
                
                {agenteLocal && (
                  <>
                    <Button variant="outline" onClick={handleToggleStatus}>
                      {formData.ativo ? (
                        <><PowerOff className="h-4 w-4 mr-2" />Inativar</>
                      ) : (
                        <><Power className="h-4 w-4 mr-2" />Ativar</>
                      )}
                    </Button>
                    
                    <Button variant="destructive" onClick={handleDeleteAgente}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  </>
                )}

                {isNewAgente && (
                  <p className="text-sm text-muted-foreground self-center mr-auto">
                    Preencha os dados na aba "Instâncias" e clique em "Criar Agente"
                  </p>
                )}
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                  <TabsList className="w-max sm:w-auto flex-nowrap">
                    <TabsTrigger value="dados-gerais">Dados Gerais</TabsTrigger>
                    <TabsTrigger value="qualificacao" disabled={!agenteLocal}>Qualificação</TabsTrigger>
                    <TabsTrigger value="cadencia" disabled={!agenteLocal}>Cadência</TabsTrigger>
                    <TabsTrigger value="periodo" disabled={!agenteLocal}>Jornada da IA</TabsTrigger>
                    <TabsTrigger value="instancias">Instâncias</TabsTrigger>
                    {/* Aba de Eventos - apenas para agentes Pri(Ligação) */}
                    {isPriLigacao() && agenteLocal && (
                      <TabsTrigger value="eventos">Eventos</TabsTrigger>
                    )}
                  </TabsList>
                </div>

                {/* Aviso para novo agente */}
                {!agenteLocal && activeTab !== "dados-gerais" && activeTab !== "instancias" && (
                  <div className="flex items-center justify-center py-12 text-center">
                    <div className="space-y-2">
                      <Bot className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">
                        Salve o agente primeiro para acessar esta configuração.
                      </p>
                      <Button onClick={() => setActiveTab("dados-gerais")}>
                        Voltar para Dados Gerais
                      </Button>
                    </div>
                  </div>
                )}

                {/* Dados Gerais Tab */}
                <TabsContent value="dados-gerais">
                  <Card>
                    <CardHeader>
                      <CardTitle>Dados Gerais do Agente</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col lg:flex-row gap-6">
                        {/* Foto do agente */}
                        <div className="flex flex-col items-center space-y-4 w-full lg:w-auto lg:shrink-0">
                          {formData.foto_url ? (
                            <Dialog>
                              <DialogTrigger asChild>
                                <div className="h-32 w-32 relative cursor-pointer hover:opacity-80 transition-opacity">
                                  <img 
                                    src={formData.foto_url} 
                                    alt={`Foto do agente ${formData.nome}`}
                                    className="w-full h-full object-cover rounded-lg"
                                  />
                                </div>
                              </DialogTrigger>
                              <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-2">
                                <img 
                                  src={formData.foto_url} 
                                  alt={`Foto completa do agente ${formData.nome}`}
                                  className="w-full h-auto max-w-full max-h-[90vh] object-contain rounded-lg"
                                />
                              </DialogContent>
                            </Dialog>
                          ) : (
                            <div className="h-32 w-32 bg-primary/10 rounded-lg flex items-center justify-center">
                              <span className="text-3xl font-semibold text-primary">
                                {formData.nome.charAt(0).toUpperCase() || "A"}
                              </span>
                            </div>
                          )}
                          
                          <div className="w-full max-w-[200px] space-y-2">
                            <Label htmlFor="foto_url">URL da Foto</Label>
                            <Input
                              id="foto_url"
                              value={formData.foto_url}
                              onChange={(e) => setFormData(prev => ({ ...prev, foto_url: e.target.value }))}
                              placeholder="https://exemplo.com/foto.jpg"
                            />
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFileUpload}
                              accept="image/*"
                              className="hidden"
                            />
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploading}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              {uploading ? "Carregando..." : "Upload de Imagem"}
                            </Button>
                          </div>
                        </div>

                        {/* Campos de texto */}
                        <div className="flex-1 min-w-0 space-y-4">
                          <div>
                            <Label htmlFor="nome">Nome do Agente *</Label>
                            <Input
                              id="nome"
                              value={formData.nome}
                              onChange={(e) => handleNomeChange(e.target.value)}
                              placeholder="Ex: Assistente Virtual"
                              required
                            />
                          </div>

                          <div>
                            <Label htmlFor="telefone">Telefone *</Label>
                            <Input
                              id="telefone"
                              value={formData.telefone}
                              onChange={(e) => handleTelefoneChange(e.target.value)}
                              placeholder="+55 11 99999-9999"
                              required
                            />
                          </div>

                          <div>
                            <Label htmlFor="dealer_id">DealerID</Label>
                            <Input
                              id="dealer_id"
                              value={formData.dealer_id}
                              onChange={(e) => setFormData(prev => ({ ...prev, dealer_id: e.target.value }))}
                              placeholder="1234"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Lojas Atribuídas */}
                      {agenteLocal && (
                        <div className="mt-6 pt-6 border-t">
                          <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="flex items-center gap-2">
                              <Store className="h-5 w-5 text-muted-foreground" />
                              <Label className="text-base font-medium">Lojas Atribuídas</Label>
                              {loadingLojas && (
                                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                              )}
                              {lojasAtribuidas.length > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {filteredLojasAtribuidas.length !== lojasAtribuidas.length 
                                    ? `${filteredLojasAtribuidas.length}/${lojasAtribuidas.length}`
                                    : lojasAtribuidas.length
                                  }
                                </Badge>
                              )}
                            </div>
                            
                            {lojasAtribuidas.length > 0 && (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={toggleSelectAllLojasFiltered}
                                  className="text-xs h-7"
                                >
                                  {filteredLojasAtribuidas.length > 0 && filteredLojasAtribuidas.every(l => selectedLojasToRemove.includes(l.id)) 
                                    ? "Desmarcar Todas" 
                                    : "Selecionar Todas"}
                                </Button>
                                {selectedLojasToRemove.length > 0 && (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleRemoveLojas(selectedLojasToRemove)}
                                    disabled={removingLojas}
                                    className="text-xs h-7"
                                  >
                                    {removingLojas ? (
                                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3 w-3 mr-1" />
                                    )}
                                    Remover ({selectedLojasToRemove.length})
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Filtros de Lojas Atribuídas */}
                          {lojasAtribuidas.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Marca</Label>
                                <Select value={filterLojaMarca} onValueChange={setFilterLojaMarca}>
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Todas as marcas" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">Todas as marcas</SelectItem>
                                    {uniqueLojasMarcas.map((marca) => (
                                      <SelectItem key={marca} value={marca}>{marca}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">UF</Label>
                                <Select value={filterLojaUF} onValueChange={setFilterLojaUF}>
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Todos os estados" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">Todos os estados</SelectItem>
                                    {uniqueLojasUFs.map((uf) => (
                                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Cidade</Label>
                                <Select value={filterLojaCidade} onValueChange={setFilterLojaCidade}>
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Todas as cidades" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">Todas as cidades</SelectItem>
                                    {uniqueLojasCidades.map((cidade) => (
                                      <SelectItem key={cidade} value={cidade}>{cidade}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}
                          
                          {lojasAtribuidas.length > 0 ? (
                            filteredLojasAtribuidas.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {filteredLojasAtribuidas.map((loja) => (
                                  <div 
                                    key={loja.id}
                                    className={`flex items-center gap-2 p-2 rounded-lg border transition-colors cursor-pointer ${
                                      selectedLojasToRemove.includes(loja.id) 
                                        ? "bg-destructive/10 border-destructive/30" 
                                        : "bg-muted/50 hover:bg-muted/70"
                                    }`}
                                    onClick={() => toggleLojaSelection(loja.id)}
                                  >
                                    <Checkbox 
                                      checked={selectedLojasToRemove.includes(loja.id)}
                                      onCheckedChange={() => toggleLojaSelection(loja.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="shrink-0"
                                    />
                                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium truncate">{loja.nome_empresa}</p>
                                      <p className="text-xs text-muted-foreground truncate">
                                        {[loja.marca, loja.cidade, loja.uf].filter(Boolean).join(' • ')}
                                      </p>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveLojas([loja.id]);
                                      }}
                                      disabled={removingLojas}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-6 bg-muted/30 rounded-lg border border-dashed">
                                <Search className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                                <p className="text-sm text-muted-foreground">
                                  Nenhuma loja encontrada com os filtros selecionados.
                                </p>
                                <Button 
                                  variant="link" 
                                  size="sm" 
                                  onClick={resetLojaFilters}
                                  className="mt-2"
                                >
                                  Limpar filtros
                                </Button>
                              </div>
                            )
                          ) : (
                            <div className="text-center py-6 bg-muted/30 rounded-lg border border-dashed">
                              <Store className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                              <p className="text-sm text-muted-foreground">
                                Este agente não está atribuído a nenhuma loja.
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Use o botão "Atribuir a Lojas" na listagem para associar este agente a empresas.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Qualificação Tab */}
                {agenteLocal && (
                  <TabsContent value="qualificacao">
                    <AgenteVariaveis agenteId={agenteLocal.id} />
                  </TabsContent>
                )}

                {/* Cadência Tab - Unificada com Follow-up, Acompanhamento e Integração */}
                {agenteLocal && (
                  <TabsContent value="cadencia">
                    <div className="space-y-6">
                      <AgenteCadenciasNova agenteId={agenteLocal.id} />
                      
                      <AgenteCadencia 
                        agenteId={agenteLocal.id}
                        tipoCadencia="acompanhamento"
                        titulo="Cadência de Acompanhamento"
                        descricao="Configure uma cadência de acompanhamento contínuo com intervalos maiores"
                      />

                      <AgenteFollowups agenteId={agenteLocal.id} />
                      
                      <AgenteIntegracao agenteId={agenteLocal.id} />
                    </div>
                  </TabsContent>
                )}

                {/* Jornada da IA Tab */}
                {agenteLocal && (
                  <TabsContent value="periodo">
                    <AgenteCadencia 
                      agenteId={agenteLocal.id}
                      tipoCadencia="rapida"
                      titulo="Jornada de Trabalho da IA"
                      descricao="Configure o horário e dias de trabalho para execução da cadência"
                    />
                  </TabsContent>
                )}

                {/* Instâncias Tab */}
                <TabsContent value="instancias">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Server className="h-5 w-5" />
                            {isNewAgente ? "Criar Nova Instância" : "Editar Instância"}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {isNewAgente 
                              ? "Preencha os dados para criar uma nova instância no sistema"
                              : "Gerencie as configurações da instância Evolution"
                            }
                          </CardDescription>
                        </div>
                        {instanciaData && !editInstancia && !isNewAgente && (
                          <Button size="sm" variant="outline" onClick={handleEditInstancia}>
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {loadingInstancia ? (
                        <div className="flex items-center justify-center py-8">
                          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : isNewAgente ? (
                        /* Formulário de criação de nova instância */
                        <div className="space-y-4">
                          <Card className="border">
                            <CardContent className="p-4">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="space-y-1">
                                    <span className="text-muted-foreground text-sm">Nova Instância:</span>
                                    <h4 className="font-semibold text-lg">
                                      {instanciaPreview || "Preencha os campos obrigatórios"}
                                    </h4>
                                  </div>
                                  <Badge variant="outline">Novo Agente</Badge>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <Label>Número Agente *</Label>
                                    <Input
                                      value={novaInstancia.num_maia}
                                      onChange={(e) => handleNovaInstanciaChange('num_maia', e.target.value)}
                                      placeholder="Ex: 61999999999"
                                    />
                                    <p className="text-xs text-muted-foreground">Número do WhatsApp do agente (apenas dígitos)</p>
                                  </div>
                                  
                                  <div className="space-y-1">
                                    <Label>Marca</Label>
                                    <Input
                                      value={novaInstancia.marca}
                                      onChange={(e) => handleNovaInstanciaChange('marca', e.target.value)}
                                      placeholder="Ex: volkswagen, chevrolet, corretora..."
                                    />
                                    <p className="text-xs text-muted-foreground">Marca/fabricante associado ao agente</p>
                                  </div>
                                  
                                  <div className="space-y-1">
                                    <Label>UF *</Label>
                                    <Select
                                      value={novaInstancia.uf}
                                      onValueChange={(value) => handleNovaInstanciaChange('uf', value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecione a UF" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {UF_LIST.map((uf) => (
                                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">Estado onde o agente atua</p>
                                  </div>
                                  
                                  <div className="space-y-1">
                                    <Label>Nome Agente *</Label>
                                    <Input
                                      value={novaInstancia.agente}
                                      onChange={(e) => handleNovaInstanciaChange('agente', e.target.value)}
                                      placeholder="Ex: maia, pri, bela..."
                                    />
                                    <p className="text-xs text-muted-foreground">Nome/persona do agente de IA</p>
                                  </div>

                                  <div className="space-y-1">
                                    <Label>ID Número Meta</Label>
                                    <Input
                                      value={novaInstancia.id_numero_meta}
                                      onChange={(e) => handleNovaInstanciaChange('id_numero_meta', e.target.value)}
                                      placeholder="ID do número Meta"
                                    />
                                    <p className="text-xs text-muted-foreground">ID do número de telefone no Meta Business</p>
                                  </div>
                                  
                                  <div className="space-y-1">
                                    <Label>CW Inbox</Label>
                                    <Input
                                      value={novaInstancia.cw_inbox}
                                      onChange={(e) => handleNovaInstanciaChange('cw_inbox', e.target.value)}
                                      placeholder="CW Inbox ID"
                                    />
                                    <p className="text-xs text-muted-foreground">ID da caixa de entrada no Chatwoot</p>
                                  </div>

                                  <div className="space-y-1">
                                    <Label>WABA</Label>
                                    <Input
                                      value={novaInstancia.waba}
                                      onChange={(e) => handleNovaInstanciaChange('waba', e.target.value)}
                                      placeholder="WABA ID"
                                    />
                                    <p className="text-xs text-muted-foreground">ID da conta WhatsApp Business API</p>
                                  </div>

                                  <div className="space-y-1">
                                    <Label>Meta App ID</Label>
                                    <Input
                                      value={novaInstancia.meta_app_id}
                                      onChange={(e) => handleNovaInstanciaChange('meta_app_id', e.target.value)}
                                      placeholder="Meta App ID"
                                    />
                                    <p className="text-xs text-muted-foreground">ID do aplicativo no Meta Developers</p>
                                  </div>

                                  <div className="space-y-1">
                                    <Label>TB Histories</Label>
                                    <Input
                                      value={novaInstancia.tb_histories}
                                      onChange={(e) => handleNovaInstanciaChange('tb_histories', e.target.value)}
                                      placeholder="Tabela de histórico"
                                    />
                                    <p className="text-xs text-muted-foreground">Nome da tabela para guardar histórico de conversas</p>
                                  </div>
                                </div>

                                <div className="space-y-1 pt-2 border-t">
                                  <Label>Token Evo</Label>
                                  <Input
                                    type="password"
                                    value={novaInstancia.evo_token}
                                    onChange={(e) => handleNovaInstanciaChange('evo_token', e.target.value)}
                                    placeholder="Token da Evolution API"
                                  />
                                  <p className="text-xs text-muted-foreground">Token de autenticação da Evolution API</p>
                                </div>

                                <div className="space-y-1">
                                  <Label>CW Token Maia</Label>
                                  <Input
                                    type="password"
                                    value={novaInstancia.cw_token_maia}
                                    onChange={(e) => handleNovaInstanciaChange('cw_token_maia', e.target.value)}
                                    placeholder="Token do Chatwoot"
                                  />
                                  <p className="text-xs text-muted-foreground">Token de acesso do agente no Chatwoot</p>
                                </div>

                                {/* Preview da instância gerada */}
                                {instanciaPreview && (
                                  <div className="p-3 bg-muted rounded-lg">
                                    <Label className="text-xs text-muted-foreground">Instância gerada automaticamente:</Label>
                                    <p className="font-mono text-sm mt-1">{instanciaPreview}</p>
                                  </div>
                                )}

                                <div className="flex gap-3 pt-4 border-t">
                                  <Button 
                                    onClick={handleCriarInstancia}
                                    disabled={creatingInstancia}
                                  >
                                    {creatingInstancia ? (
                                      <>
                                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                        Criando...
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Criar Agente
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      ) : editInstancia && editedInstancia ? (
                        /* Modo de edição */
                        <div className="space-y-4">
                          <Card className="border">
                            <CardContent className="p-4">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="space-y-1">
                                    <span className="text-muted-foreground text-sm">Instância:</span>
                                    <h4 className="font-semibold text-lg">{editedInstancia.instancia}</h4>
                                  </div>
                                  <Badge variant="secondary">Editando</Badge>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <Label>Número Agente</Label>
                                    <Input
                                      value={editedInstancia.num_maia}
                                      onChange={(e) => handleInstanciaFieldChange('num_maia', e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">Número do WhatsApp do agente</p>
                                  </div>
                                  
                                  <div className="space-y-1">
                                    <Label>Marca</Label>
                                    <Input
                                      value={editedInstancia.marca}
                                      onChange={(e) => handleInstanciaFieldChange('marca', e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">Marca/fabricante associado</p>
                                  </div>
                                  
                                  <div className="space-y-1">
                                    <Label>UF</Label>
                                    <Input
                                      value={editedInstancia.uf}
                                      onChange={(e) => handleInstanciaFieldChange('uf', e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">Estado onde o agente atua</p>
                                  </div>
                                  
                                  <div className="space-y-1">
                                    <Label>ID Número Meta</Label>
                                    <Input
                                      value={editedInstancia.id_numero_meta || ''}
                                      onChange={(e) => handleInstanciaFieldChange('id_numero_meta', e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">ID do número no Meta Business</p>
                                  </div>

                                  <div className="space-y-1">
                                    <Label>Instância</Label>
                                    <Input
                                      value={editedInstancia.instancia}
                                      onChange={(e) => handleInstanciaFieldChange('instancia', e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">Identificador único da instância Evolution</p>
                                  </div>
                                  
                                  <div className="space-y-1">
                                    <Label>CW Inbox</Label>
                                    <Input
                                      value={editedInstancia.cw_inbox || ''}
                                      onChange={(e) => handleInstanciaFieldChange('cw_inbox', e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">ID da caixa de entrada no Chatwoot</p>
                                  </div>

                                  <div className="space-y-1">
                                    <Label>Agente</Label>
                                    <Input
                                      value={editedInstancia.agente || ''}
                                      onChange={(e) => handleInstanciaFieldChange('agente', e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">Nome/persona do agente de IA</p>
                                  </div>

                                  <div className="space-y-1">
                                    <Label>WABA</Label>
                                    <Input
                                      value={editedInstancia.waba || ''}
                                      onChange={(e) => handleInstanciaFieldChange('waba', e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">ID da conta WhatsApp Business API</p>
                                  </div>

                                  <div className="space-y-1">
                                    <Label>Meta App ID</Label>
                                    <Input
                                      value={editedInstancia.meta_app_id || ''}
                                      onChange={(e) => handleInstanciaFieldChange('meta_app_id', e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">ID do aplicativo no Meta Developers</p>
                                  </div>

                                  <div className="space-y-1">
                                    <Label>TB Histories</Label>
                                    <Input
                                      value={editedInstancia.tb_histories || ''}
                                      onChange={(e) => handleInstanciaFieldChange('tb_histories', e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">Tabela para histórico de conversas</p>
                                  </div>
                                </div>

                                <div className="space-y-1 pt-2 border-t">
                                  <Label>Token Evo</Label>
                                  <Input
                                    type={showEvoToken ? "text" : "password"}
                                    value={editedInstancia.evo_token || ''}
                                    onChange={(e) => handleInstanciaFieldChange('evo_token', e.target.value)}
                                  />
                                  <p className="text-xs text-muted-foreground">Token de autenticação da Evolution API</p>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      type="button"
                                      onClick={() => setShowEvoToken(!showEvoToken)}
                                    >
                                      {showEvoToken ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                                      {showEvoToken ? "Ocultar" : "Mostrar"}
                                    </Button>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <Label>CW Token Maia</Label>
                                  <Input
                                    type={showCwToken ? "text" : "password"}
                                    value={editedInstancia.cw_token_maia || ''}
                                    onChange={(e) => handleInstanciaFieldChange('cw_token_maia', e.target.value)}
                                  />
                                  <p className="text-xs text-muted-foreground">Token de acesso do agente no Chatwoot</p>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      type="button"
                                      onClick={() => setShowCwToken(!showCwToken)}
                                    >
                                      {showCwToken ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                                      {showCwToken ? "Ocultar" : "Mostrar"}
                                    </Button>
                                  </div>
                                </div>

                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      ) : instanciaData ? (
                        /* Modo de visualização */
                        <div className="space-y-4">
                          <Card className="border">
                            <CardContent className="p-4">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <div className="space-y-1">
                                    <span className="text-muted-foreground text-sm">Instância:</span>
                                    <h4 className="font-semibold text-lg">{instanciaData.instancia}</h4>
                                  </div>
                                  <Badge variant="default">Ativa</Badge>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                  <div className="space-y-0.5">
                                    <span className="text-muted-foreground">Número Agente:</span>
                                    <p className="font-medium">{instanciaData.num_maia}</p>
                                    <p className="text-[10px] text-muted-foreground/70">Número do WhatsApp do agente</p>
                                  </div>
                                  
                                  <div className="space-y-0.5">
                                    <span className="text-muted-foreground">Marca:</span>
                                    <p className="font-medium capitalize">{instanciaData.marca}</p>
                                    <p className="text-[10px] text-muted-foreground/70">Marca/fabricante associado</p>
                                  </div>
                                  
                                  <div className="space-y-0.5">
                                    <span className="text-muted-foreground">UF:</span>
                                    <p className="font-medium">{instanciaData.uf}</p>
                                    <p className="text-[10px] text-muted-foreground/70">Estado onde o agente atua</p>
                                  </div>
                                  
                                  <div className="space-y-0.5">
                                    <span className="text-muted-foreground">ID Número Meta:</span>
                                    <p className="font-medium">{instanciaData.id_numero_meta || '-'}</p>
                                    <p className="text-[10px] text-muted-foreground/70">ID do número no Meta Business</p>
                                  </div>

                                  <div className="space-y-0.5">
                                    <span className="text-muted-foreground">CW Inbox:</span>
                                    <p className="font-medium">{instanciaData.cw_inbox || '-'}</p>
                                    <p className="text-[10px] text-muted-foreground/70">ID da caixa de entrada no Chatwoot</p>
                                  </div>

                                  <div className="space-y-0.5">
                                    <span className="text-muted-foreground">WABA:</span>
                                    <p className="font-medium">{instanciaData.waba || '-'}</p>
                                    <p className="text-[10px] text-muted-foreground/70">ID da conta WhatsApp Business API</p>
                                  </div>

                                  <div className="space-y-0.5">
                                    <span className="text-muted-foreground">Agente:</span>
                                    <p className="font-medium">{instanciaData.agente || '-'}</p>
                                    <p className="text-[10px] text-muted-foreground/70">Nome/persona do agente de IA</p>
                                  </div>

                                  <div className="space-y-0.5">
                                    <span className="text-muted-foreground">Meta App ID:</span>
                                    <p className="font-medium">{instanciaData.meta_app_id || '-'}</p>
                                    <p className="text-[10px] text-muted-foreground/70">ID do aplicativo no Meta Developers</p>
                                  </div>

                                  <div className="space-y-0.5">
                                    <span className="text-muted-foreground">TB Histories:</span>
                                    <p className="font-medium">{instanciaData.tb_histories || '-'}</p>
                                    <p className="text-[10px] text-muted-foreground/70">Tabela para histórico de conversas</p>
                                  </div>
                                  
                                  {instanciaData.criado_em && (
                                    <div className="space-y-1">
                                      <span className="text-muted-foreground">Criado em:</span>
                                      <p className="font-medium">
                                        {new Date(instanciaData.criado_em).toLocaleDateString('pt-BR', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {instanciaData.evo_token && (
                                  <div className="space-y-2 pt-2 border-t">
                                    <span className="text-muted-foreground text-sm">Token Evo:</span>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 min-w-0 font-mono text-xs bg-muted p-2 rounded break-all overflow-hidden">
                                        {showEvoToken
                                          ? instanciaData.evo_token
                                          : "••••••••••••••••••••••••••••••••••••••••••••••••••"}
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setShowEvoToken(!showEvoToken)}
                                        title={showEvoToken ? "Ocultar" : "Mostrar"}
                                      >
                                        {showEvoToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => handleCopyToClipboard(e, instanciaData.evo_token, "Token Evo")}
                                        title="Copiar"
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {instanciaData.cw_token_maia && (
                                  <div className="space-y-2">
                                    <span className="text-muted-foreground text-sm">CW Token Maia:</span>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 min-w-0 font-mono text-xs bg-muted p-2 rounded break-all overflow-hidden">
                                        {showCwToken
                                          ? instanciaData.cw_token_maia
                                          : "••••••••••••••••••••••••"}
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setShowCwToken(!showCwToken)}
                                        title={showCwToken ? "Ocultar" : "Mostrar"}
                                      >
                                        {showCwToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => handleCopyToClipboard(e, instanciaData.cw_token_maia!, "CW Token Maia")}
                                        title="Copiar"
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Nenhuma instância encontrada para este agente</p>
                          <p className="text-sm mt-1">Verifique se o telefone está correto</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Eventos Tab - apenas para agentes Pri(Ligação) */}
                {isPriLigacao() && agenteLocal && (
                  <TabsContent value="eventos">
                    <AgenteEventos 
                      agenteId={agenteLocal.id} 
                      agenteTelefone={formData.telefone}
                    />
                  </TabsContent>
                )}
              </Tabs>

              <DialogFooter>
                <Button variant="outline" onClick={handleCloseAgentModal}>
                  Fechar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal de Atribuição de Empresa */}
          <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Atribuir Agente a Empresas</DialogTitle>
                <DialogDescription>
                  Selecione as empresas para vincular o agente "{agenteToAssign?.nome || agenteToAssign?.marca}"
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                {/* Filtros */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-4 flex-shrink-0">
                  <div className="space-y-1">
                    <Label className="text-xs">Buscar por Nome</Label>
                    <Input
                      placeholder="Filtrar por nome..."
                      value={assignFilterNome}
                      onChange={(e) => setAssignFilterNome(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Marca</Label>
                    <Select value={assignFilterMarca} onValueChange={setAssignFilterMarca}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {uniqueEmpresaMarcas.map((marca) => (
                          <SelectItem key={marca} value={marca}>{marca}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">UF</Label>
                    <Select value={assignFilterUF} onValueChange={setAssignFilterUF}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {uniqueEmpresaUFs.map((uf) => (
                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Contador de selecionados e botão selecionar todas */}
                <div className="flex items-center justify-between pb-2 border-b flex-shrink-0">
                  <span className="text-sm text-muted-foreground">
                    {filteredEmpresasModal.length} empresa(s) encontrada(s)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const filteredIds = filteredEmpresasModal.map(e => e.id);
                        const allSelected = filteredIds.every(id => selectedEmpresaIds.includes(id));
                        if (allSelected) {
                          setSelectedEmpresaIds(prev => prev.filter(id => !filteredIds.includes(id)));
                        } else {
                          setSelectedEmpresaIds(prev => [...new Set([...prev, ...filteredIds])]);
                        }
                      }}
                    >
                      {filteredEmpresasModal.length > 0 && filteredEmpresasModal.every(e => selectedEmpresaIds.includes(e.id))
                        ? "Desmarcar todas"
                        : "Selecionar todas"}
                    </Button>
                    <Badge variant="secondary">
                      {selectedEmpresaIds.length} selecionada(s)
                    </Badge>
                  </div>
                </div>

                {/* Lista de empresas */}
                {loadingAssignedEmpresas ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto mt-2 space-y-1 min-h-0">
                    {filteredEmpresasModal.map((empresa) => (
                      <div 
                        key={empresa.id}
                        className={`flex items-center gap-3 p-2 rounded-md border cursor-pointer transition-colors ${
                          selectedEmpresaIds.includes(empresa.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted/50'
                        }`}
                        onClick={() => handleToggleEmpresa(empresa.id)}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                          selectedEmpresaIds.includes(empresa.id)
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-input'
                        }`}>
                          {selectedEmpresaIds.includes(empresa.id) && (
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{empresa.nome_empresa}</div>
                          <div className="text-xs text-muted-foreground">
                            {empresa.marca} • {empresa.cidade} - {empresa.uf}
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredEmpresasModal.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nenhuma empresa encontrada</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter className="flex-shrink-0 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowAssignModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAssignAgente}>
                  Confirmar ({selectedEmpresaIds.length})
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
            </TabsContent>

            {/* Tab Controle de Agentes */}
            <TabsContent value="controle" className="mt-6">
              <ControleAgentesContent />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
}
