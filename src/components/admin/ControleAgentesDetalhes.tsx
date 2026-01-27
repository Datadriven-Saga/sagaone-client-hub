import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bot,
  Building2,
  MapPin,
  Phone,
  Save,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Rocket,
  Settings,
  Server,
  RefreshCw,
  FileText,
  Eye,
  Calendar,
  Plus,
  Pencil,
  Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ControleAgente {
  id: string;
  nome_agente: string;
  tipo_agente: string;
  marca: string;
  uf: string;
  loja: string;
  cnpj: string;
  responsavel: string | null;
  implantador: string | null;
  telefone_toca: string | null;
  cronograma: string | null;
  status: string | null;
  chamado: string | null;
  observacoes: string | null;
  descricao: string | null;
  numero_telefone: string | null;
  ativo: boolean;
  empresa_id: string | null;
  created_at: string;
  updated_at: string;
}

interface InstanciaEvolution {
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
}

interface AgenteVisao {
  id: string;
  nome: string;
  tipo: string;
  criador: string | null;
  strategica: boolean;
  tipo_implantacao: string;
  ativo: boolean;
  descricao: string | null;
  ordem: number;
}

interface CronogramaItem {
  id: string;
  agente_visao_id: string | null;
  fase: string;
  unidades: string;
  atividade: string;
  data_inicio: string;
  data_termino: string;
  observacoes: string | null;
  concluido: boolean;
}

interface Props {
  agente: ControleAgente | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

const statusOptions = [
  { value: "pendente", label: "Pendente", icon: Clock, color: "text-gray-600", bgColor: "bg-gray-500/10" },
  { value: "em_desenvolvimento", label: "Em Desenvolvimento", icon: Settings, color: "text-yellow-600", bgColor: "bg-yellow-500/10" },
  { value: "em_roll_out", label: "Em Roll Out", icon: Rocket, color: "text-blue-600", bgColor: "bg-blue-500/10" },
  { value: "IMPLANTADA", label: "Implantado", icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-500/10" },
  { value: "ok", label: "OK", icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-500/10" },
  { value: "erro", label: "Erro", icon: AlertCircle, color: "text-red-600", bgColor: "bg-red-500/10" },
  { value: "bloqueado", label: "Bloqueado", icon: XCircle, color: "text-red-600", bgColor: "bg-red-500/10" },
];

// Status que permite o agente estar ativo
const activeStatusValues = ["em_roll_out", "IMPLANTADA", "ok"];

export function ControleAgentesDetalhes({ agente, open, onOpenChange, onSave }: Props) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("detalhes");
  const [saving, setSaving] = useState(false);
  const [loadingInstancia, setLoadingInstancia] = useState(false);
  const [instanciaData, setInstanciaData] = useState<InstanciaEvolution | null>(null);
  
  // Visão dos Agentes
  const [agentesVisao, setAgentesVisao] = useState<AgenteVisao[]>([]);
  const [loadingVisao, setLoadingVisao] = useState(false);
  const [editingVisao, setEditingVisao] = useState<AgenteVisao | null>(null);
  const [novoVisaoOpen, setNovoVisaoOpen] = useState(false);
  
  // Cronograma
  const [cronograma, setCronograma] = useState<CronogramaItem[]>([]);
  const [loadingCronograma, setLoadingCronograma] = useState(false);
  
  const [formData, setFormData] = useState({
    nome_agente: "",
    tipo_agente: "",
    marca: "",
    uf: "",
    loja: "",
    cnpj: "",
    responsavel: "",
    implantador: "",
    telefone_toca: "",
    cronograma: "",
    status: "",
    chamado: "",
    observacoes: "",
    descricao: "",
    numero_telefone: "",
    ativo: true
  });

  // Determinar se pode estar ativo baseado no status
  const canBeActive = activeStatusValues.includes(formData.status);

  useEffect(() => {
    if (agente) {
      const status = agente.status || "pendente";
      const shouldBeActive = activeStatusValues.includes(status);
      
      setFormData({
        nome_agente: agente.nome_agente || "",
        tipo_agente: agente.tipo_agente || "",
        marca: agente.marca || "",
        uf: agente.uf || "",
        loja: agente.loja || "",
        cnpj: agente.cnpj || "",
        responsavel: agente.responsavel || "",
        implantador: agente.implantador || "",
        telefone_toca: agente.telefone_toca || "",
        cronograma: agente.cronograma || "",
        status: status,
        chamado: agente.chamado || "",
        observacoes: agente.observacoes || "",
        descricao: agente.descricao || "",
        numero_telefone: agente.numero_telefone || "",
        ativo: shouldBeActive ? agente.ativo : false
      });
      setActiveTab("detalhes");
      setInstanciaData(null);
    }
  }, [agente]);

  // Atualizar ativo automaticamente quando status muda
  useEffect(() => {
    if (!canBeActive && formData.ativo) {
      setFormData(prev => ({ ...prev, ativo: false }));
    }
  }, [formData.status, canBeActive]);

  const fetchAgentesVisao = async () => {
    setLoadingVisao(true);
    try {
      const { data, error } = await supabase
        .from("agentes_visao")
        .select("*")
        .order("ordem");
      if (error) throw error;
      setAgentesVisao(data || []);
    } catch (error) {
      console.error("Erro ao carregar visão:", error);
    } finally {
      setLoadingVisao(false);
    }
  };

  const fetchCronograma = async () => {
    setLoadingCronograma(true);
    try {
      const { data, error } = await supabase
        .from("cronograma_implantacao")
        .select("*")
        .order("data_inicio");
      if (error) throw error;
      setCronograma(data || []);
    } catch (error) {
      console.error("Erro ao carregar cronograma:", error);
    } finally {
      setLoadingCronograma(false);
    }
  };

  useEffect(() => {
    if (open && activeTab === "visao") {
      fetchAgentesVisao();
    }
    if (open && activeTab === "cronograma") {
      fetchCronograma();
    }
  }, [open, activeTab]);

  const buscarInstancia = async () => {
    if (!formData.numero_telefone) {
      toast({
        title: "Telefone não configurado",
        description: "Configure o número do agente primeiro",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoadingInstancia(true);
      const { data, error } = await supabase.functions.invoke('external-webhook-proxy', {
        body: { 
          endpoint: 'verifica-instancias_evo',
          telefone: formData.numero_telefone
        }
      });

      if (error) throw error;

      if (data && data.num_maia) {
        setInstanciaData(data);
        toast({
          title: "Instância encontrada",
          description: `Instância ${data.instancia || data.num_maia} carregada`
        });
      } else {
        setInstanciaData(null);
        toast({
          title: "Nenhuma instância encontrada",
          description: "Não há instância para este número",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao buscar instância:", error);
      toast({
        title: "Erro ao buscar instância",
        description: "Não foi possível carregar a instância",
        variant: "destructive"
      });
    } finally {
      setLoadingInstancia(false);
    }
  };

  const handleSave = async () => {
    if (!agente?.id) return;

    if (!formData.nome_agente || !formData.tipo_agente || !formData.marca || !formData.uf || !formData.loja || !formData.cnpj) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    // Garantir que ativo está correto baseado no status
    const finalAtivo = canBeActive ? formData.ativo : false;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("controle_agentes")
        .update({
          nome_agente: formData.nome_agente,
          tipo_agente: formData.tipo_agente,
          marca: formData.marca,
          uf: formData.uf,
          loja: formData.loja,
          cnpj: formData.cnpj,
          responsavel: formData.responsavel || null,
          implantador: formData.implantador || null,
          telefone_toca: formData.telefone_toca || null,
          cronograma: formData.cronograma || null,
          status: formData.status || null,
          chamado: formData.chamado || null,
          observacoes: formData.observacoes || null,
          descricao: formData.descricao || null,
          numero_telefone: formData.numero_telefone || null,
          ativo: finalAtivo
        })
        .eq("id", agente.id);

      if (error) throw error;

      toast({ title: "Sucesso", description: "Agente atualizado com sucesso!" });
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as alterações",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVisao = async (item: Partial<AgenteVisao>) => {
    try {
      if (editingVisao?.id) {
        const { error } = await supabase
          .from("agentes_visao")
          .update(item)
          .eq("id", editingVisao.id);
        if (error) throw error;
        toast({ title: "Agente atualizado!" });
      } else {
        const { error } = await supabase
          .from("agentes_visao")
          .insert([item as any]);
        if (error) throw error;
        toast({ title: "Agente criado!" });
      }
      setEditingVisao(null);
      setNovoVisaoOpen(false);
      fetchAgentesVisao();
    } catch (error) {
      console.error("Erro:", error);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const getStatusConfig = (status: string | null) => {
    const opt = statusOptions.find(s => s.value === status);
    return opt || statusOptions[0];
  };

  const getStatusBadge = (status: string | null) => {
    const config = getStatusConfig(status);
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.bgColor} ${config.color} border-0 gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (!agente) return null;

  const statusConfig = getStatusConfig(formData.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-3">
            <Bot className="h-6 w-6 text-primary" />
            <div className="flex-1">
              <span className="font-bold">{agente.nome_agente}</span>
              <span className="text-muted-foreground font-normal ml-2">- {agente.loja}</span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(formData.status)}
              <Badge variant={formData.ativo ? "default" : "secondary"}>
                {formData.ativo ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="flex-shrink-0 px-6 pt-4 border-b">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="detalhes" className="flex items-center gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" />
                Detalhes
              </TabsTrigger>
              <TabsTrigger value="implantacao" className="flex items-center gap-1.5 text-xs">
                <Building2 className="h-3.5 w-3.5" />
                Implantação
              </TabsTrigger>
              <TabsTrigger value="instancia" className="flex items-center gap-1.5 text-xs">
                <Server className="h-3.5 w-3.5" />
                Instância
              </TabsTrigger>
              <TabsTrigger value="visao" className="flex items-center gap-1.5 text-xs">
                <Eye className="h-3.5 w-3.5" />
                Visão Agentes
              </TabsTrigger>
              <TabsTrigger value="cronograma" className="flex items-center gap-1.5 text-xs">
                <Calendar className="h-3.5 w-3.5" />
                Cronograma
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 p-6">
            {/* Detalhes Tab */}
            <TabsContent value="detalhes" className="m-0 mt-0 space-y-4">
              {/* Status Card - First */}
              <Card className="border-2 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <statusConfig.icon className={`h-5 w-5 ${statusConfig.color}`} />
                    Status do Agente
                  </CardTitle>
                  <CardDescription>Status atual e ativação do agente</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Status de Implantação</Label>
                      <Select
                        value={formData.status || "pendente"}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <div className="flex items-center gap-2">
                                <opt.icon className={`h-4 w-4 ${opt.color}`} />
                                {opt.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                      <div className="space-y-0.5">
                        <Label>Agente Ativo</Label>
                        <p className="text-xs text-muted-foreground">
                          {canBeActive 
                            ? "Agente pode ser ativado" 
                            : "Apenas agentes implantados ou em roll out podem estar ativos"}
                        </p>
                      </div>
                      <Switch
                        checked={formData.ativo}
                        onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                        disabled={!canBeActive}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Informações do Agente</CardTitle>
                  <CardDescription>Dados básicos e descrição do agente</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome do Agente *</Label>
                      <Input
                        value={formData.nome_agente}
                        onChange={(e) => setFormData({ ...formData, nome_agente: e.target.value })}
                        placeholder="Ex: Aila, Bela, Pri..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo *</Label>
                      <Input
                        value={formData.tipo_agente}
                        onChange={(e) => setFormData({ ...formData, tipo_agente: e.target.value })}
                        placeholder="Ex: Prospecção, Entrega..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Número do Agente
                      </Label>
                      <Input
                        value={formData.numero_telefone}
                        onChange={(e) => setFormData({ ...formData, numero_telefone: e.target.value })}
                        placeholder="Ex: 5562999999999"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone que Toca</Label>
                      <Input
                        value={formData.telefone_toca}
                        onChange={(e) => setFormData({ ...formData, telefone_toca: e.target.value })}
                        placeholder="Telefone de transferência"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      placeholder="Descreva o que esse agente faz e pelo que é responsável..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Implantação Tab */}
            <TabsContent value="implantacao" className="m-0 mt-0 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Local de Implantação</CardTitle>
                  <CardDescription>Onde o agente está rodando</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Marca *</Label>
                      <Input
                        value={formData.marca}
                        onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                        placeholder="Ex: Fiat, BYD..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>UF *</Label>
                      <Input
                        value={formData.uf}
                        onChange={(e) => setFormData({ ...formData, uf: e.target.value })}
                        placeholder="Ex: DF, GO..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Loja *</Label>
                      <Input
                        value={formData.loja}
                        onChange={(e) => setFormData({ ...formData, loja: e.target.value })}
                        placeholder="Ex: Park Sul"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>CNPJ *</Label>
                    <Input
                      value={formData.cnpj}
                      onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                      placeholder="XX.XXX.XXX/XXXX-XX"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Acompanhamento da Implantação</CardTitle>
                  <CardDescription>Responsáveis e cronograma</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Responsável</Label>
                      <Input
                        value={formData.responsavel}
                        onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                        placeholder="Nome do responsável"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Implantador</Label>
                      <Input
                        value={formData.implantador}
                        onChange={(e) => setFormData({ ...formData, implantador: e.target.value })}
                        placeholder="Nome do implantador"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Cronograma</Label>
                      <Input
                        value={formData.cronograma}
                        onChange={(e) => setFormData({ ...formData, cronograma: e.target.value })}
                        placeholder="Ex: 12/fev"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Número do Chamado</Label>
                      <Input
                        value={formData.chamado}
                        onChange={(e) => setFormData({ ...formData, chamado: e.target.value })}
                        placeholder="Ex: #12345"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      value={formData.observacoes}
                      onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                      placeholder="Observações adicionais..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Instância Tab */}
            <TabsContent value="instancia" className="m-0 mt-0 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Instância Evolution</CardTitle>
                      <CardDescription>Dados da instância vinculada ao agente</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={buscarInstancia}
                      disabled={loadingInstancia || !formData.numero_telefone}
                    >
                      {loadingInstancia ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Server className="h-4 w-4 mr-2" />
                      )}
                      Buscar Instância
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {!formData.numero_telefone ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Phone className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Configure o número do agente para buscar a instância</p>
                    </div>
                  ) : instanciaData ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Número</Label>
                          <p className="text-sm font-medium">{instanciaData.num_maia}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Instância</Label>
                          <p className="text-sm font-medium">{instanciaData.instancia || "N/A"}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Marca</Label>
                          <p className="text-sm font-medium">{instanciaData.marca}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">UF</Label>
                          <p className="text-sm font-medium">{instanciaData.uf}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Agente</Label>
                          <p className="text-sm font-medium">{instanciaData.agente || "N/A"}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">WABA</Label>
                          <p className="text-sm font-medium">{instanciaData.waba || "N/A"}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">ID Número Meta</Label>
                        <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {instanciaData.id_numero_meta || "N/A"}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Tabela de Históricos</Label>
                        <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {instanciaData.tb_histories || "N/A"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Server className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Clique em "Buscar Instância" para carregar os dados</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Visão Agentes Tab */}
            <TabsContent value="visao" className="m-0 mt-0 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Visão dos Agentes</CardTitle>
                      <CardDescription>Catálogo de tipos de agentes disponíveis</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => { setEditingVisao(null); setNovoVisaoOpen(true); }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Agente
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingVisao ? (
                    <div className="flex justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Criador</TableHead>
                          <TableHead>Estratégica</TableHead>
                          <TableHead>Implantação</TableHead>
                          <TableHead className="w-[80px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {agentesVisao.map((av) => (
                          <TableRow key={av.id}>
                            <TableCell className="font-medium">{av.nome}</TableCell>
                            <TableCell>{av.tipo}</TableCell>
                            <TableCell>{av.criador || "-"}</TableCell>
                            <TableCell>
                              <Badge variant={av.strategica ? "default" : "secondary"}>
                                {av.strategica ? "Sim" : "Não"}
                              </Badge>
                            </TableCell>
                            <TableCell>{av.tipo_implantacao}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setEditingVisao(av)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {agentesVisao.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              Nenhum agente cadastrado
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Modal de edição/criação de Visão */}
              {(editingVisao || novoVisaoOpen) && (
                <Card className="border-primary">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      {editingVisao ? "Editar Agente" : "Novo Agente"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <VisaoForm
                      initial={editingVisao}
                      onSave={handleSaveVisao}
                      onCancel={() => { setEditingVisao(null); setNovoVisaoOpen(false); }}
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Cronograma Tab */}
            <TabsContent value="cronograma" className="m-0 mt-0 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Cronograma de Implantação</CardTitle>
                      <CardDescription>Fases e datas de implantação dos agentes</CardDescription>
                    </div>
                    <Button size="sm" variant="outline" onClick={fetchCronograma} disabled={loadingCronograma}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${loadingCronograma ? "animate-spin" : ""}`} />
                      Atualizar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingCronograma ? (
                    <div className="flex justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fase</TableHead>
                          <TableHead>Unidades</TableHead>
                          <TableHead>Atividade</TableHead>
                          <TableHead>Início</TableHead>
                          <TableHead>Término</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cronograma.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Badge variant={item.fase.includes("INFRA") || item.fase.includes("FINAL") ? "secondary" : "outline"}>
                                {item.fase}
                              </Badge>
                            </TableCell>
                            <TableCell>{item.unidades}</TableCell>
                            <TableCell>{item.atividade}</TableCell>
                            <TableCell>
                              {format(new Date(item.data_inicio), "dd/MMM", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              {format(new Date(item.data_termino), "dd/MMM", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <Badge variant={item.concluido ? "default" : "secondary"}>
                                {item.concluido ? "Concluído" : "Pendente"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {cronograma.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              Nenhum cronograma cadastrado
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex items-center justify-end gap-2 p-6 pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Componente para formulário de Visão
function VisaoForm({ 
  initial, 
  onSave, 
  onCancel 
}: { 
  initial: AgenteVisao | null;
  onSave: (data: Partial<AgenteVisao>) => void;
  onCancel: () => void;
}) {
  const [data, setData] = useState({
    nome: initial?.nome || "",
    tipo: initial?.tipo || "",
    criador: initial?.criador || "",
    strategica: initial?.strategica || false,
    tipo_implantacao: initial?.tipo_implantacao || "Marca/UF",
    ativo: initial?.ativo ?? true,
    descricao: initial?.descricao || "",
    ordem: initial?.ordem || 0
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome *</Label>
          <Input
            value={data.nome}
            onChange={(e) => setData({ ...data, nome: e.target.value })}
            placeholder="Nome do agente"
          />
        </div>
        <div className="space-y-2">
          <Label>Tipo *</Label>
          <Input
            value={data.tipo}
            onChange={(e) => setData({ ...data, tipo: e.target.value })}
            placeholder="Ex: Prospecção, Entrega..."
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Criador</Label>
          <Input
            value={data.criador}
            onChange={(e) => setData({ ...data, criador: e.target.value })}
            placeholder="Nome do criador"
          />
        </div>
        <div className="space-y-2">
          <Label>Tipo de Implantação</Label>
          <Select
            value={data.tipo_implantacao}
            onValueChange={(v) => setData({ ...data, tipo_implantacao: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Marca/UF">Marca/UF</SelectItem>
              <SelectItem value="Marca">Marca</SelectItem>
              <SelectItem value="UF">UF</SelectItem>
              <SelectItem value="Unica">Única</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            checked={data.strategica}
            onCheckedChange={(v) => setData({ ...data, strategica: v })}
          />
          <Label>Estratégica</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={data.ativo}
            onCheckedChange={(v) => setData({ ...data, ativo: v })}
          />
          <Label>Ativo</Label>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea
          value={data.descricao}
          onChange={(e) => setData({ ...data, descricao: e.target.value })}
          placeholder="Descrição do agente..."
          rows={2}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSave(data)}>Salvar</Button>
      </div>
    </div>
  );
}
