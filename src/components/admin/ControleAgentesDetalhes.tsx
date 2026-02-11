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
  Bot,
  Building2,
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

const activeStatusValues = ["em_roll_out", "IMPLANTADA", "ok"];

export function ControleAgentesDetalhes({ agente, open, onOpenChange, onSave }: Props) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("detalhes");
  const [saving, setSaving] = useState(false);
  const [loadingInstancia, setLoadingInstancia] = useState(false);
  const [instanciaData, setInstanciaData] = useState<InstanciaEvolution | null>(null);
  
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

  useEffect(() => {
    if (!canBeActive && formData.ativo) {
      setFormData(prev => ({ ...prev, ativo: false }));
    }
  }, [formData.status, canBeActive]);

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

  const syncToAgentesIA = async (agenteControle: ControleAgente, telefone: string) => {
    try {
      // Check if agent already exists in agentes_ia with this name and phone
      const { data: existingAgent } = await supabase
        .from("agentes_ia")
        .select("id")
        .eq("nome", agenteControle.nome_agente)
        .eq("telefone", telefone)
        .maybeSingle();

      let agenteIaId: string;

      if (existingAgent) {
        // Update existing
        agenteIaId = existingAgent.id;
        await supabase
          .from("agentes_ia")
          .update({ ativo: true, updated_at: new Date().toISOString() })
          .eq("id", agenteIaId);
        console.log("✅ Agente IA atualizado:", agenteIaId);
      } else {
        // Insert new
        const { data: newAgent, error: insertErr } = await supabase
          .from("agentes_ia")
          .insert({
            nome: agenteControle.nome_agente,
            telefone: telefone,
            ativo: true,
          })
          .select("id")
          .single();

        if (insertErr) throw insertErr;
        agenteIaId = newAgent.id;
        console.log("✅ Agente IA criado:", agenteIaId);
      }

      // Link to empresa if empresa_id exists
      if (agenteControle.empresa_id) {
        const { data: existingLink } = await supabase
          .from("agente_empresas")
          .select("id")
          .eq("agente_id", agenteIaId)
          .eq("empresa_id", agenteControle.empresa_id)
          .maybeSingle();

        if (!existingLink) {
          await supabase.from("agente_empresas").insert({
            agente_id: agenteIaId,
            empresa_id: agenteControle.empresa_id,
            status: "ativo",
          });
          console.log("✅ Vínculo agente-empresa criado");
        }
      }

      return agenteIaId;
    } catch (err) {
      console.error("⚠️ Erro ao sincronizar com agentes_ia:", err);
      return null;
    }
  };

  const handleUpsertInstancia = async () => {
    if (!formData.numero_telefone || !agente) {
      toast({ title: "Telefone necessário", description: "Preencha o número do telefone primeiro", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      const agenteIaId = await syncToAgentesIA(agente, formData.numero_telefone);
      if (agenteIaId) {
        toast({ title: "Sucesso", description: "Agente sincronizado com Agentes de IA e instância vinculada" });
      } else {
        toast({ title: "Erro", description: "Não foi possível sincronizar o agente", variant: "destructive" });
      }
    } finally {
      setSaving(false);
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

      // Auto-sync to agentes_ia when activating with a phone number
      if (finalAtivo && formData.numero_telefone) {
        await syncToAgentesIA(agente, formData.numero_telefone);
      }

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
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0">
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
            <TabsList className="grid w-full grid-cols-3">
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
            </TabsList>
          </div>

          <ScrollArea className="flex-1 p-6">
            {/* Detalhes Tab */}
            <TabsContent value="detalhes" className="m-0 mt-0 space-y-4">
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
                  <CardTitle className="text-base">Informações Básicas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome do Agente *</Label>
                      <Input
                        value={formData.nome_agente}
                        onChange={(e) => setFormData({ ...formData, nome_agente: e.target.value })}
                        placeholder="Nome do agente"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo *</Label>
                      <Input
                        value={formData.tipo_agente}
                        onChange={(e) => setFormData({ ...formData, tipo_agente: e.target.value })}
                        placeholder="Tipo do agente"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      placeholder="Descrição das responsabilidades do agente..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número de Telefone</Label>
                    <div className="flex gap-2">
                      <Input
                        value={formData.numero_telefone}
                        onChange={(e) => setFormData({ ...formData, numero_telefone: e.target.value })}
                        placeholder="+55 11 99999-9999"
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleUpsertInstancia}
                        disabled={saving || !formData.numero_telefone}
                        title="Inserir ou atualizar este agente na tela de Agentes de IA"
                      >
                        <Server className="h-4 w-4 mr-1" />
                        Sincronizar IA
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Ao sincronizar, o agente será inserido/atualizado na tela de Agentes de IA com este telefone
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Implantação Tab */}
            <TabsContent value="implantacao" className="m-0 mt-0 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Dados da Loja</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Loja *</Label>
                      <Input
                        value={formData.loja}
                        onChange={(e) => setFormData({ ...formData, loja: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CNPJ *</Label>
                      <Input
                        value={formData.cnpj}
                        onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Marca *</Label>
                      <Input
                        value={formData.marca}
                        onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>UF *</Label>
                      <Input
                        value={formData.uf}
                        onChange={(e) => setFormData({ ...formData, uf: e.target.value })}
                        maxLength={2}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Responsáveis</CardTitle>
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
                      <Label>Chamado</Label>
                      <Input
                        value={formData.chamado}
                        onChange={(e) => setFormData({ ...formData, chamado: e.target.value })}
                        placeholder="Número do chamado"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone Toca</Label>
                      <Input
                        value={formData.telefone_toca}
                        onChange={(e) => setFormData({ ...formData, telefone_toca: e.target.value })}
                        placeholder="Telefone"
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
                      <CardTitle className="text-base">Dados da Instância Evolution</CardTitle>
                      <CardDescription>Informações técnicas da instância WhatsApp</CardDescription>
                    </div>
                    <Button size="sm" onClick={buscarInstancia} disabled={loadingInstancia}>
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
                  {loadingInstancia ? (
                    <div className="flex justify-center py-8">
                      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : instanciaData ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
