import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Target,
  ArrowLeft
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

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
  controle_agente_id: string | null;
  atividade: string;
  data_inicio: string;
  data_termino: string;
  observacoes: string | null;
  concluido: boolean;
  responsavel: string | null;
  status: string | null;
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

interface TIUser {
  id: string;
  nome_completo: string;
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
  
  // Usuários TI (para seleção de responsável)
  const [tiUsers, setTIUsers] = useState<TIUser[]>([]);

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

  const fetchTIUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome_completo")
        .eq("tipo_acesso", "TI")
        .eq("status", "Ativo")
        .order("nome_completo");
      if (error) throw error;
      setTIUsers(data || []);
    } catch (error) {
      console.error("Erro ao carregar usuários TI:", error);
    }
  }, []);

  useEffect(() => {
    fetchAgentesVisao();
    fetchCronograma();
    fetchControleAgentes();
    fetchTIUsers();
  }, [fetchAgentesVisao, fetchCronograma, fetchControleAgentes, fetchTIUsers]);

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

  // Helper para buscar o nome do agente no controle
  const getControleAgenteName = (controleAgenteId: string | null) => {
    if (!controleAgenteId) return "-";
    const agente = controlesAgentes.find(a => a.id === controleAgenteId);
    if (!agente) return "-";
    return `${agente.nome_agente} - ${agente.loja} (${agente.marca}/${agente.uf})`;
  };

  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Visão Geral</h1>
                <p className="text-muted-foreground">
                  Catálogo de agentes e cronograma de implantação
                </p>
              </div>
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
                    <p className="text-xs text-muted-foreground">Concluídos</p>
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
                    <p className="text-xs text-muted-foreground">Pendentes</p>
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

            {/* Visão dos Agentes Tab - LISTA */}
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
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Criador</TableHead>
                          <TableHead>Implantação</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[100px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {agentesVisao.map((av) => (
                          <TableRow key={av.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-primary" />
                                <span className="font-medium">{av.nome}</span>
                                {av.strategica && (
                                  <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600">
                                    <Target className="h-2.5 w-2.5 mr-1" />
                                    Estratégica
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{av.tipo}</TableCell>
                            <TableCell>{av.criador || "-"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {av.tipo_implantacao}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={av.ativo ? "default" : "secondary"} className="text-xs">
                                {av.ativo ? "Ativo" : "Inativo"}
                              </Badge>
                            </TableCell>
                            <TableCell>
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
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
                      <CardDescription>Gerenciamento de implantação dos agentes</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={fetchCronograma} disabled={loadingCronograma}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loadingCronograma ? "animate-spin" : ""}`} />
                        Atualizar
                      </Button>
                      <Button size="sm" onClick={() => { setEditingCronograma(null); setNovoCronogramaOpen(true); }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Implantação
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
                        Criar Primeira Implantação
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Agente</TableHead>
                          <TableHead>Atividade</TableHead>
                          <TableHead>Período</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead className="w-[100px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cronograma.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="max-w-[200px]">
                              <p className="truncate text-sm font-medium">{getControleAgenteName(item.controle_agente_id)}</p>
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
                              <Badge 
                                variant={
                                  item.status === "concluído" ? "default" : 
                                  item.status === "em andamento" ? "secondary" : 
                                  "outline"
                                }
                                className={
                                  item.status === "concluído" ? "bg-green-500" : 
                                  item.status === "em andamento" ? "bg-yellow-500 text-foreground" : 
                                  ""
                                }
                              >
                                {item.status === "concluído" ? (
                                  <><CheckCircle2 className="h-3 w-3 mr-1" />Concluído</>
                                ) : item.status === "em andamento" ? (
                                  <><RefreshCw className="h-3 w-3 mr-1" />Em Andamento</>
                                ) : (
                                  <><Clock className="h-3 w-3 mr-1" />Pendente</>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{item.responsavel || "-"}</span>
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
            <DialogTitle>{editingCronograma ? "Editar Implantação" : "Nova Implantação"}</DialogTitle>
          </DialogHeader>
          <CronogramaForm
            initial={editingCronograma}
            controlesAgentes={controlesAgentes}
            tiUsers={tiUsers}
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

// Componente para formulário de Cronograma - COM STATUS E DROPDOWN TI
function CronogramaForm({ 
  initial,
  controlesAgentes,
  tiUsers,
  onSave, 
  onCancel 
}: { 
  initial: CronogramaItem | null;
  controlesAgentes: ControleAgente[];
  tiUsers: TIUser[];
  onSave: (data: Partial<CronogramaItem>) => void;
  onCancel: () => void;
}) {
  const [data, setData] = useState({
    controle_agente_id: initial?.controle_agente_id || null,
    atividade: initial?.atividade || "",
    data_inicio: initial?.data_inicio || new Date().toISOString().split('T')[0],
    data_termino: initial?.data_termino || new Date().toISOString().split('T')[0],
    observacoes: initial?.observacoes || "",
    concluido: initial?.concluido || false,
    responsavel: initial?.responsavel || "",
    status: initial?.status || "pendente",
    agente_visao_id: initial?.agente_visao_id || null
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Selecionar Agente do Controle *</Label>
        <Select 
          value={data.controle_agente_id || ""} 
          onValueChange={(v) => setData({ ...data, controle_agente_id: v || null })}
        >
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
        <p className="text-xs text-muted-foreground">Selecione o agente que será implantado</p>
      </div>
      
      <div className="space-y-2">
        <Label>Atividade *</Label>
        <Input
          value={data.atividade}
          onChange={(e) => setData({ ...data, atividade: e.target.value })}
          placeholder="Descrição da atividade de implantação"
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Responsável</Label>
          <Select 
            value={data.responsavel || ""} 
            onValueChange={(v) => setData({ ...data, responsavel: v || "" })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um responsável" />
            </SelectTrigger>
            <SelectContent>
              {tiUsers.map((user) => (
                <SelectItem key={user.id} value={user.nome_completo}>
                  {user.nome_completo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select 
            value={data.status} 
            onValueChange={(v) => setData({ ...data, status: v, concluido: v === "concluído" })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em andamento">Em Andamento</SelectItem>
              <SelectItem value="concluído">Concluído</SelectItem>
            </SelectContent>
          </Select>
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

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
        <Button onClick={() => onSave(data)} disabled={!data.controle_agente_id || !data.atividade}>
          <Save className="h-4 w-4 mr-2" />
          Salvar
        </Button>
      </div>
    </div>
  );
}
