import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Eye,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Bot,
  CheckCircle2,
  Clock,
  Save,
  X,
  Users,
  Target
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

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

interface ControleAgente {
  id: string;
  nome_agente: string;
  tipo_agente: string;
  marca: string;
  uf: string;
  loja: string;
  status: string | null;
}

export default function VisaoGeral() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("visao");
  
  // Visão dos Agentes
  const [agentesVisao, setAgentesVisao] = useState<AgenteVisao[]>([]);
  const [loadingVisao, setLoadingVisao] = useState(false);
  const [editingVisao, setEditingVisao] = useState<AgenteVisao | null>(null);
  const [novoVisaoOpen, setNovoVisaoOpen] = useState(false);
  
  // Cronograma
  const [cronograma, setCronograma] = useState<CronogramaItem[]>([]);
  const [loadingCronograma, setLoadingCronograma] = useState(false);
  const [editingCronograma, setEditingCronograma] = useState<CronogramaItem | null>(null);
  const [novoCronogramaOpen, setNovoCronogramaOpen] = useState(false);
  
  // Agentes de Controle (para seleção no cronograma)
  const [controlesAgentes, setControleAgentes] = useState<ControleAgente[]>([]);
  const [loadingControle, setLoadingControle] = useState(false);

  const fetchAgentesVisao = useCallback(async () => {
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
      toast({ title: "Erro ao carregar agentes", variant: "destructive" });
    } finally {
      setLoadingVisao(false);
    }
  }, [toast]);

  const fetchCronograma = useCallback(async () => {
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
      toast({ title: "Erro ao carregar cronograma", variant: "destructive" });
    } finally {
      setLoadingCronograma(false);
    }
  }, [toast]);

  const fetchControleAgentes = useCallback(async () => {
    setLoadingControle(true);
    try {
      const { data, error } = await supabase
        .from("controle_agentes")
        .select("id, nome_agente, tipo_agente, marca, uf, loja, status")
        .order("nome_agente");
      if (error) throw error;
      setControleAgentes(data || []);
    } catch (error) {
      console.error("Erro ao carregar controle:", error);
    } finally {
      setLoadingControle(false);
    }
  }, []);

  useEffect(() => {
    // Carregar dados iniciais
    fetchAgentesVisao();
    fetchCronograma();
    fetchControleAgentes();
  }, [fetchAgentesVisao, fetchCronograma, fetchControleAgentes]);

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

  const handleDeleteVisao = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este agente?")) return;
    try {
      const { error } = await supabase.from("agentes_visao").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Agente excluído!" });
      fetchAgentesVisao();
    } catch (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  const handleSaveCronograma = async (item: Partial<CronogramaItem>) => {
    try {
      if (editingCronograma?.id) {
        const { error } = await supabase
          .from("cronograma_implantacao")
          .update(item)
          .eq("id", editingCronograma.id);
        if (error) throw error;
        toast({ title: "Cronograma atualizado!" });
      } else {
        const { error } = await supabase
          .from("cronograma_implantacao")
          .insert([item as any]);
        if (error) throw error;
        toast({ title: "Cronograma criado!" });
      }
      setEditingCronograma(null);
      setNovoCronogramaOpen(false);
      fetchCronograma();
    } catch (error) {
      console.error("Erro:", error);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const handleDeleteCronograma = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este item?")) return;
    try {
      const { error } = await supabase.from("cronograma_implantacao").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Item excluído!" });
      fetchCronograma();
    } catch (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  const handleToggleConcluido = async (id: string, concluido: boolean) => {
    try {
      const { error } = await supabase
        .from("cronograma_implantacao")
        .update({ concluido })
        .eq("id", id);
      if (error) throw error;
      setCronograma(prev => prev.map(c => c.id === id ? { ...c, concluido } : c));
      toast({ title: concluido ? "Marcado como concluído!" : "Marcado como pendente!" });
    } catch (error) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Visão Geral</h1>
              <p className="text-muted-foreground">
                Catálogo de agentes e cronograma de implantação
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("/administracao/agentes")}>
              Voltar para Agentes
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{agentesVisao.length.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-muted-foreground">Tipos de Agentes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{cronograma.filter(c => c.concluido).length.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-muted-foreground">Fases Concluídas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <Clock className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{cronograma.filter(c => !c.concluido).length.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-muted-foreground">Fases Pendentes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{controlesAgentes.length.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-muted-foreground">Agentes Cadastrados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="visao" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Visão dos Agentes
              </TabsTrigger>
              <TabsTrigger value="cronograma" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Cronograma
              </TabsTrigger>
            </TabsList>

            {/* Visão dos Agentes Tab */}
            <TabsContent value="visao" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Catálogo de Agentes</CardTitle>
                      <CardDescription>Tipos de agentes disponíveis no sistema</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={fetchAgentesVisao} disabled={loadingVisao}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loadingVisao ? "animate-spin" : ""}`} />
                        Atualizar
                      </Button>
                      <Button size="sm" onClick={() => { setEditingVisao(null); setNovoVisaoOpen(true); }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Agente
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingVisao ? (
                    <div className="flex justify-center py-12">
                      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : agentesVisao.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhum agente cadastrado</p>
                      <Button className="mt-4" onClick={() => setNovoVisaoOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Criar Primeiro Agente
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {agentesVisao.map((av) => (
                        <Card key={av.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-primary/10">
                                  <Bot className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <h3 className="font-semibold">{av.nome}</h3>
                                  <p className="text-xs text-muted-foreground">{av.tipo}</p>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setEditingVisao(av)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => handleDeleteVisao(av.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant={av.ativo ? "default" : "secondary"} className="text-[10px]">
                                {av.ativo ? "Ativo" : "Inativo"}
                              </Badge>
                              {av.strategica && (
                                <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600">
                                  <Target className="h-2.5 w-2.5 mr-1" />
                                  Estratégica
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[10px]">
                                {av.tipo_implantacao}
                              </Badge>
                            </div>
                            {av.criador && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Criado por: {av.criador}
                              </p>
                            )}
                            {av.descricao && (
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                {av.descricao}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Cronograma Tab */}
            <TabsContent value="cronograma" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Cronograma de Implantação</CardTitle>
                      <CardDescription>Fases e datas de implantação dos agentes</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={fetchCronograma} disabled={loadingCronograma}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loadingCronograma ? "animate-spin" : ""}`} />
                        Atualizar
                      </Button>
                      <Button size="sm" onClick={() => { setEditingCronograma(null); setNovoCronogramaOpen(true); }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Fase
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingCronograma ? (
                    <div className="flex justify-center py-12">
                      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : cronograma.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhum cronograma cadastrado</p>
                      <Button className="mt-4" onClick={() => setNovoCronogramaOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Criar Primeira Fase
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fase</TableHead>
                          <TableHead>Agente/Unidades</TableHead>
                          <TableHead>Atividade</TableHead>
                          <TableHead>Período</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[100px]">Ações</TableHead>
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
                            <TableCell className="max-w-[200px]">
                              <p className="truncate text-sm">{item.unidades}</p>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <p className="truncate text-sm">{item.atividade}</p>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {format(new Date(item.data_inicio), "dd/MM", { locale: ptBR })} - {format(new Date(item.data_termino), "dd/MM", { locale: ptBR })}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => handleToggleConcluido(item.id, !item.concluido)}
                              >
                                <Badge variant={item.concluido ? "default" : "secondary"} className="cursor-pointer">
                                  {item.concluido ? (
                                    <><CheckCircle2 className="h-3 w-3 mr-1" />Concluído</>
                                  ) : (
                                    <><Clock className="h-3 w-3 mr-1" />Pendente</>
                                  )}
                                </Badge>
                              </Button>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setEditingCronograma(item)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => handleDeleteCronograma(item.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollIndicator>

      {/* Modal Visão */}
      <Dialog open={novoVisaoOpen || !!editingVisao} onOpenChange={(open) => { if (!open) { setNovoVisaoOpen(false); setEditingVisao(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingVisao ? "Editar Agente" : "Novo Agente"}</DialogTitle>
          </DialogHeader>
          <VisaoForm
            initial={editingVisao}
            onSave={handleSaveVisao}
            onCancel={() => { setEditingVisao(null); setNovoVisaoOpen(false); }}
          />
        </DialogContent>
      </Dialog>

      {/* Modal Cronograma */}
      <Dialog open={novoCronogramaOpen || !!editingCronograma} onOpenChange={(open) => { if (!open) { setNovoCronogramaOpen(false); setEditingCronograma(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCronograma ? "Editar Fase" : "Nova Fase"}</DialogTitle>
          </DialogHeader>
          <CronogramaForm
            initial={editingCronograma}
            controlesAgentes={controlesAgentes}
            onSave={handleSaveCronograma}
            onCancel={() => { setEditingCronograma(null); setNovoCronogramaOpen(false); }}
          />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
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
      <div className="flex items-center gap-6">
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
          rows={3}
        />
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
        <Button onClick={() => onSave(data)} disabled={!data.nome || !data.tipo}>
          <Save className="h-4 w-4 mr-2" />
          Salvar
        </Button>
      </div>
    </div>
  );
}

// Componente para formulário de Cronograma
function CronogramaForm({ 
  initial,
  controlesAgentes,
  onSave, 
  onCancel 
}: { 
  initial: CronogramaItem | null;
  controlesAgentes: ControleAgente[];
  onSave: (data: Partial<CronogramaItem>) => void;
  onCancel: () => void;
}) {
  const [data, setData] = useState({
    fase: initial?.fase || "",
    unidades: initial?.unidades || "",
    atividade: initial?.atividade || "",
    data_inicio: initial?.data_inicio || new Date().toISOString().split('T')[0],
    data_termino: initial?.data_termino || new Date().toISOString().split('T')[0],
    observacoes: initial?.observacoes || "",
    concluido: initial?.concluido || false,
    agente_visao_id: initial?.agente_visao_id || null
  });

  const [selectedAgente, setSelectedAgente] = useState<string>("");

  const handleSelectAgente = (agenteId: string) => {
    setSelectedAgente(agenteId);
    const agente = controlesAgentes.find(a => a.id === agenteId);
    if (agente) {
      setData(prev => ({
        ...prev,
        unidades: `${agente.nome_agente} - ${agente.loja} (${agente.marca}/${agente.uf})`
      }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Selecionar Agente (opcional)</Label>
        <Select value={selectedAgente} onValueChange={handleSelectAgente}>
          <SelectTrigger>
            <SelectValue placeholder="Escolha um agente de Controle de Agentes" />
          </SelectTrigger>
          <SelectContent>
            {controlesAgentes.map((ag) => (
              <SelectItem key={ag.id} value={ag.id}>
                <span className="font-medium">{ag.nome_agente}</span>
                <span className="text-muted-foreground ml-2">- {ag.loja} ({ag.marca}/{ag.uf})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Ao selecionar, as unidades serão preenchidas automaticamente</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Fase *</Label>
          <Select value={data.fase} onValueChange={(v) => setData({ ...data, fase: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a fase" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INFRA">INFRA</SelectItem>
              <SelectItem value="Fase 1">Fase 1</SelectItem>
              <SelectItem value="Fase 2">Fase 2</SelectItem>
              <SelectItem value="Fase 3">Fase 3</SelectItem>
              <SelectItem value="Fase 4">Fase 4</SelectItem>
              <SelectItem value="FINAL">FINAL</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Unidades *</Label>
          <Input
            value={data.unidades}
            onChange={(e) => setData({ ...data, unidades: e.target.value })}
            placeholder="Unidades afetadas"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label>Atividade *</Label>
        <Input
          value={data.atividade}
          onChange={(e) => setData({ ...data, atividade: e.target.value })}
          placeholder="Descrição da atividade"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data Início *</Label>
          <Input
            type="date"
            value={data.data_inicio}
            onChange={(e) => setData({ ...data, data_inicio: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Data Término *</Label>
          <Input
            type="date"
            value={data.data_termino}
            onChange={(e) => setData({ ...data, data_termino: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          value={data.observacoes}
          onChange={(e) => setData({ ...data, observacoes: e.target.value })}
          placeholder="Observações adicionais..."
          rows={2}
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={data.concluido}
          onCheckedChange={(v) => setData({ ...data, concluido: v })}
        />
        <Label>Concluído</Label>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
        <Button onClick={() => onSave(data)} disabled={!data.fase || !data.unidades || !data.atividade}>
          <Save className="h-4 w-4 mr-2" />
          Salvar
        </Button>
      </div>
    </div>
  );
}
