import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Bot, Activity, Edit, Trash2, Power, PowerOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AgenteDetalhes } from "@/components/AgenteDetalhes";

interface Agente {
  id: string;
  nome: string;
  persona: string;
  cerebro: string;
  telefone: string;
  foto_url?: string;
  ativo: boolean;
  followups_count?: number;
  etapas_cadencia_count?: number;
}

interface Performance {
  agente_id: string;
  nome: string;
  followups_executados: number;
  cadencias_executadas: number;
}

export default function AgentesIA() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [performance, setPerformance] = useState<Performance[]>([]);
  const [loading, setLoading] = useState(false);
  const [agenteEdicao, setAgenteEdicao] = useState<Agente | null>(null);
  const [showDetalhes, setShowDetalhes] = useState(false);
  const [activeTab, setActiveTab] = useState("agentes");

  // Verificar se usuário tem acesso (TI ou Administrador)
  const [hasAccess, setHasAccess] = useState(false);

  const checkAccess = async () => {
    if (!user) return;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tipo_acesso')
        .eq('id', user.id)
        .single();
      
      const isAuthorized = profile?.tipo_acesso === 'TI' || profile?.tipo_acesso === 'Administrador';
      setHasAccess(isAuthorized);
      
      if (!isAuthorized) {
        toast({
          title: "Acesso negado",
          description: "Apenas usuários com perfil TI ou Administrador podem acessar este módulo",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao verificar acesso:', error);
      setHasAccess(false);
    }
  };

  const carregarAgentes = async () => {
    if (!user || !hasAccess) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('agentes_ia')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Buscar contagens de followups e total de etapas das cadências para cada agente
      const agentesComContadores = await Promise.all((data || []).map(async (agente) => {
        const [followupsResult, cadenciasResult] = await Promise.all([
          supabase
            .from('agente_followups')
            .select('id', { count: 'exact' })
            .eq('agente_id', agente.id),
          supabase
            .from('agente_cadencias')
            .select('quantidade_etapas')
            .eq('agente_id', agente.id)
        ]);
        
        // Somar total de etapas de todas as cadências
        const totalEtapas = cadenciasResult.data?.reduce((total, cadencia) => {
          return total + (cadencia.quantidade_etapas || 0);
        }, 0) || 0;
        
        return {
          ...agente,
          followups_count: followupsResult.count || 0,
          etapas_cadencia_count: totalEtapas
        };
      }));
      
      setAgentes(agentesComContadores);
    } catch (error) {
      console.error('Erro ao carregar agentes:', error);
      toast({
        title: "Erro ao carregar agentes",
        description: "Não foi possível carregar os agentes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const carregarPerformance = async () => {
    if (!user || !hasAccess) return;
    
    try {
      const { data, error } = await supabase
        .from('agente_performance')
        .select(`
          agente_id,
          followups_executados,
          cadencias_executadas,
          agentes_ia!inner(nome)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const performanceFormatada = (data || []).map(item => ({
        agente_id: item.agente_id,
        nome: (item.agentes_ia as any).nome,
        followups_executados: item.followups_executados,
        cadencias_executadas: item.cadencias_executadas
      }));
      
      setPerformance(performanceFormatada);
    } catch (error) {
      console.error('Erro ao carregar performance:', error);
    }
  };

  const handleCreateAgente = () => {
    setAgenteEdicao(null);
    setShowDetalhes(true);
  };

  const handleEditAgente = (agente: Agente) => {
    setAgenteEdicao(agente);
    setShowDetalhes(true);
  };

  const handleCloseDetalhes = () => {
    setShowDetalhes(false);
    setAgenteEdicao(null);
    carregarAgentes(); // Recarregar lista após edição
  };

  const handleToggleStatus = async (agente: Agente) => {
    try {
      const { error } = await supabase
        .from('agentes_ia')
        .update({ ativo: !agente.ativo })
        .eq('id', agente.id);
      
      if (error) throw error;
      
      toast({
        title: agente.ativo ? "Agente inativado" : "Agente ativado",
        description: `O agente ${agente.nome} foi ${agente.ativo ? 'inativado' : 'ativado'} com sucesso`
      });
      
      carregarAgentes();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast({
        title: "Erro ao alterar status",
        description: "Não foi possível alterar o status do agente",
        variant: "destructive"
      });
    }
  };

  const handleDeleteAgente = async (agente: Agente) => {
    if (!confirm(`Tem certeza que deseja excluir o agente "${agente.nome}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('agentes_ia')
        .delete()
        .eq('id', agente.id);
      
      if (error) throw error;
      
      toast({
        title: "Agente excluído",
        description: `O agente ${agente.nome} foi excluído com sucesso`
      });
      
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

  useEffect(() => {
    if (user) {
      checkAccess();
    }
  }, [user]);

  useEffect(() => {
    if (hasAccess) {
      carregarAgentes();
      carregarPerformance();
    }
  }, [hasAccess]);

  if (!hasAccess) {
    return (
      <DashboardLayout title="Agentes de IA">
        <Card className="p-12 text-center">
          <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
          <p className="text-muted-foreground">
            Apenas usuários com perfil TI ou Administrador podem acessar este módulo
          </p>
        </Card>
      </DashboardLayout>
    );
  }

  if (showDetalhes) {
    return (
      <AgenteDetalhes 
        agente={agenteEdicao}
        onClose={handleCloseDetalhes}
      />
    );
  }

  return (
    <DashboardLayout title="Agentes de IA">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Agentes de IA</h1>
            <p className="text-muted-foreground">
              Configure e monitore agentes inteligentes para automação
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="agentes">Agentes</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="agentes" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Lista de Agentes</h2>
              <Button onClick={handleCreateAgente}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Agente
              </Button>
            </div>

            {agentes.length === 0 ? (
              <Card className="p-12 text-center">
                <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum agente criado</h3>
                <p className="text-muted-foreground mb-4">
                  Crie seu primeiro agente de IA para começar a automação
                </p>
                <Button onClick={handleCreateAgente}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Agente
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agentes.map((agente) => (
                  <Card 
                    key={agente.id} 
                    className="cursor-pointer hover:shadow-card transition-shadow"
                    onClick={() => handleEditAgente(agente)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center space-x-4">
                        <div className="h-16 w-16 relative">
                          {agente.foto_url ? (
                            <img 
                              src={agente.foto_url} 
                              alt={`Foto do agente ${agente.nome}`}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-full h-full bg-primary/10 rounded-lg flex items-center justify-center">
                              <span className="text-lg font-semibold text-primary">
                                {agente.nome.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{agente.nome}</CardTitle>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {agente.persona}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mb-4">
                        <Badge variant={agente.ativo ? "default" : "secondary"}>
                          {agente.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-primary">
                            {agente.followups_count}
                          </p>
                          <p className="text-xs text-muted-foreground">Follow-ups</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-primary">
                            {agente.etapas_cadencia_count}
                          </p>
                          <p className="text-xs text-muted-foreground">Etapas da Cadência</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <h2 className="text-xl font-semibold">Performance dos Agentes</h2>
            
            {performance.length === 0 ? (
              <Card className="p-12 text-center">
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Sem dados de performance</h3>
                <p className="text-muted-foreground">
                  Os dados de performance aparecerão aqui quando os agentes começarem a executar ações
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {performance.map((perf) => (
                  <Card key={perf.agente_id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg">{perf.nome}</h3>
                        <div className="flex gap-8">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-primary">
                              {perf.followups_executados}
                            </p>
                            <p className="text-sm text-muted-foreground">Follow-ups Executados</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-primary">
                              {perf.cadencias_executadas}
                            </p>
                            <p className="text-sm text-muted-foreground">Cadências Executadas</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}