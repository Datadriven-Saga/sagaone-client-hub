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
  FileText
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
  { value: "ok", label: "OK", icon: CheckCircle2, color: "text-green-600" },
  { value: "IMPLANTADA", label: "Implantada", icon: CheckCircle2, color: "text-green-600" },
  { value: "em_desenvolvimento", label: "Em Desenvolvimento", icon: Settings, color: "text-yellow-600" },
  { value: "em_roll_out", label: "Em Roll Out", icon: Rocket, color: "text-blue-600" },
  { value: "pendente", label: "Pendente", icon: Clock, color: "text-gray-600" },
  { value: "erro", label: "Erro", icon: AlertCircle, color: "text-red-600" },
  { value: "bloqueado", label: "Bloqueado", icon: XCircle, color: "text-red-600" },
];

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

  useEffect(() => {
    if (agente) {
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
        status: agente.status || "",
        chamado: agente.chamado || "",
        observacoes: agente.observacoes || "",
        descricao: agente.descricao || "",
        numero_telefone: agente.numero_telefone || "",
        ativo: agente.ativo ?? true
      });
      setActiveTab("detalhes");
      setInstanciaData(null);
    }
  }, [agente]);

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
          ativo: formData.ativo
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

  const getStatusIcon = (status: string | null) => {
    const opt = statusOptions.find(s => s.value === status);
    if (opt) {
      const Icon = opt.icon;
      return <Icon className={`h-4 w-4 ${opt.color}`} />;
    }
    return <Clock className="h-4 w-4 text-gray-600" />;
  };

  if (!agente) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <Bot className="h-6 w-6 text-primary" />
            <div className="flex-1">
              <span>{agente.nome_agente}</span>
              <span className="text-muted-foreground font-normal ml-2">- {agente.loja}</span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(formData.status)}
              <Badge variant={formData.ativo ? "default" : "secondary"}>
                {formData.ativo ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
            <TabsTrigger value="detalhes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Detalhes
            </TabsTrigger>
            <TabsTrigger value="implantacao" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Implantação
            </TabsTrigger>
            <TabsTrigger value="instancia" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              Instância
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="detalhes" className="m-0 space-y-4">
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
                      rows={4}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                    <div className="space-y-0.5">
                      <Label>Status do Agente</Label>
                      <p className="text-sm text-muted-foreground">Ative ou desative o agente</p>
                    </div>
                    <Switch
                      checked={formData.ativo}
                      onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="implantacao" className="m-0 space-y-4">
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
                  <CardTitle className="text-base">Status da Implantação</CardTitle>
                  <CardDescription>Acompanhamento do processo</CardDescription>
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
                      <Label>Status</Label>
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
                    <div className="space-y-2">
                      <Label>Cronograma</Label>
                      <Input
                        value={formData.cronograma}
                        onChange={(e) => setFormData({ ...formData, cronograma: e.target.value })}
                        placeholder="Ex: 12/fev"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Número do Chamado</Label>
                    <Input
                      value={formData.chamado}
                      onChange={(e) => setFormData({ ...formData, chamado: e.target.value })}
                      placeholder="Ex: #12345"
                    />
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

            <TabsContent value="instancia" className="m-0 space-y-4">
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
          </ScrollArea>
        </Tabs>

        <div className="flex items-center justify-end gap-2 pt-4 border-t flex-shrink-0">
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
