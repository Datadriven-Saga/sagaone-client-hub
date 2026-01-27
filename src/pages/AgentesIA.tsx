import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Bot, Phone, RefreshCw, User, Brain, ChevronRight, Store, Sparkles, Activity, Zap, MessageSquare } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useCompany } from "@/contexts/CompanyContext";
import { formatPhone } from "@/lib/utils";

interface AgenteLocal {
  id: string;
  nome: string;
  telefone: string | null;
  persona: string | null;
  cerebro: string | null;
  foto_url: string | null;
  ativo: boolean;
  dealer_id: string | null;
}

// Função para verificar se o agente veio do webhook (telefone sem formatação antiga)
function isWebhookAgent(agente: AgenteLocal): boolean {
  if (!agente.telefone) return false;
  
  // Agentes manuais antigos tinham formato (XX) XXXX-XXXX no banco
  // Agentes do webhook têm apenas dígitos ou formato +55XXXXXXXXXXX
  const telefone = agente.telefone;
  
  // Se começa com parêntese, foi criado manualmente (formato antigo)
  if (telefone.startsWith('(')) return false;
  
  // Verifica se tem pelo menos 10 dígitos (telefone válido)
  const digits = telefone.replace(/\D/g, '');
  return digits.length >= 10;
}

export default function AgentesIA() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeCompany } = useCompany();
  
  const [agentes, setAgentes] = useState<AgenteLocal[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAgente, setSelectedAgente] = useState<AgenteLocal | null>(null);
  const [showModal, setShowModal] = useState(false);

  const carregarAgentes = async () => {
    if (!activeCompany?.id) {
      console.log('Nenhuma empresa selecionada');
      setAgentes([]);
      return;
    }
    
    try {
      setLoading(true);
      console.log('Buscando agentes para empresa:', activeCompany.id);
      
      const { data: agenteEmpresas, error: errorRelacionamento } = await supabase
        .from('agente_empresas')
        .select(`
          agente_id,
          agentes_ia (
            id,
            nome,
            telefone,
            persona,
            cerebro,
            foto_url,
            ativo,
            dealer_id
          )
        `)
        .eq('empresa_id', activeCompany.id);

      if (errorRelacionamento) {
        console.error('Erro ao buscar agentes:', errorRelacionamento);
        throw errorRelacionamento;
      }

      console.log('Dados retornados:', agenteEmpresas);

      // Extrair agentes únicos por ID e TELEFONE (um agente pode estar em várias empresas, mas só aparece uma vez)
      const agentesUnicos: AgenteLocal[] = [];
      const idsAdicionados = new Set<string>();
      const telefonesAdicionados = new Set<string>();

      if (agenteEmpresas) {
        for (const item of agenteEmpresas) {
          const agente = item.agentes_ia as unknown as AgenteLocal;
          if (agente && !idsAdicionados.has(agente.id) && isWebhookAgent(agente)) {
            // Também verificar por telefone para evitar duplicatas visuais
            const telefoneNormalizado = agente.telefone?.replace(/\D/g, '') || '';
            if (telefoneNormalizado && telefonesAdicionados.has(telefoneNormalizado)) {
              continue; // Já existe agente com esse telefone
            }
            agentesUnicos.push(agente);
            idsAdicionados.add(agente.id);
            if (telefoneNormalizado) {
              telefonesAdicionados.add(telefoneNormalizado);
            }
          }
        }
      }
      
      console.log('Agentes do webhook encontrados:', agentesUnicos);
      setAgentes(agentesUnicos);
    } catch (error) {
      console.error('Erro ao carregar agentes:', error);
      toast({
        title: "Erro ao carregar agentes",
        description: "Não foi possível carregar a lista de agentes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAgente = (agente: AgenteLocal) => {
    setSelectedAgente(agente);
    setShowModal(true);
  };

  useEffect(() => {
    carregarAgentes();
  }, [activeCompany?.id]);

  const agentesAtivos = agentes.filter(a => a.ativo).length;
  const agentesInativos = agentes.filter(a => !a.ativo).length;

  return (
    <DashboardLayout title="Agentes de IA">
      <ScrollIndicator className="flex-1 h-full">
        <div className="space-y-6 pb-6">
          {/* Header com gradiente */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10 ring-1 ring-primary/20">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    Agentes de IA
                    <Sparkles className="h-5 w-5 text-primary" />
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Gerencie seus assistentes virtuais inteligentes
                  </p>
                </div>
              </div>
              <Button 
                onClick={carregarAgentes} 
                disabled={loading} 
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>

          {/* Cards de estatísticas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-primary">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{agentes.length.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-muted-foreground">Total de Agentes</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-green-500/10">
                  <Activity className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{agentesAtivos.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-muted-foreground">Ativos</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-orange-500/10">
                  <Zap className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-600">{agentesInativos.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-muted-foreground">Inativos</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                <div className="relative p-4 rounded-full bg-primary/10">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                </div>
              </div>
              <p className="text-muted-foreground">Carregando agentes...</p>
            </div>
          ) : agentes.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="p-12 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <Bot className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">Nenhum agente encontrado</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Não há agentes de IA configurados para esta empresa. Os agentes são sincronizados automaticamente quando configurados no sistema.
                </p>
              </CardContent>
            </Card>
          ) : (
            /* Grid de cards dos agentes */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {agentes.map((agente) => (
                <Card 
                  key={agente.id} 
                  className={`group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 cursor-pointer ${
                    agente.ativo 
                      ? 'border-l-4 border-l-green-500' 
                      : 'border-l-4 border-l-red-500 opacity-75'
                  }`}
                  onClick={() => handleOpenAgente(agente)}
                >
                  {/* Efeito de hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <CardContent className="p-5 relative">
                    <div className="flex items-start gap-4">
                      {/* Avatar com indicador de status */}
                      <div className="relative">
                        <Avatar className="h-14 w-14 ring-2 ring-background shadow-md">
                          <AvatarImage src={agente.foto_url || undefined} alt={agente.nome || "Agente"} />
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-lg font-semibold">
                            {agente.nome?.charAt(0).toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-background ${
                          agente.ativo ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-semibold truncate ${
                            !agente.nome || agente.nome === "Novo agente" 
                              ? "text-muted-foreground italic" 
                              : ""
                          }`}>
                            {agente.nome && agente.nome !== "Novo agente" ? agente.nome : "Sem nome"}
                          </h3>
                        </div>
                        
                        <div className="space-y-1.5">
                          {agente.telefone && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              <span className="truncate">{formatPhone(agente.telefone) || agente.telefone}</span>
                            </div>
                          )}
                          
                          {agente.dealer_id && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Store className="h-3.5 w-3.5" />
                              <span className="truncate">{agente.dealer_id}</span>
                            </div>
                          )}
                        </div>

                        {/* Indicadores de recursos */}
                        <div className="flex items-center gap-2 mt-3">
                          {agente.persona && (
                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 gap-1">
                              <User className="h-3 w-3" />
                              Persona
                            </Badge>
                          )}
                          {agente.cerebro && (
                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 gap-1">
                              <Brain className="h-3 w-3" />
                              Cérebro
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Seta indicadora */}
                      <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollIndicator>

      {/* Modal de Detalhes do Agente */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-16 w-16 ring-2 ring-primary/20 shadow-lg">
                  <AvatarImage src={selectedAgente?.foto_url || undefined} alt={selectedAgente?.nome || "Agente"} />
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-xl font-semibold">
                    {selectedAgente?.nome?.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-background ${
                  selectedAgente?.ativo ? 'bg-green-500' : 'bg-red-500'
                }`} />
              </div>
              <div>
                <DialogTitle className={`text-xl ${!selectedAgente?.nome || selectedAgente?.nome === "Novo agente" ? "text-muted-foreground italic" : ""}`}>
                  {selectedAgente?.nome && selectedAgente?.nome !== "Novo agente" ? selectedAgente.nome : "Sem nome"}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge 
                    className={`text-xs ${selectedAgente?.ativo 
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200" 
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200"
                    }`}
                  >
                    {selectedAgente?.ativo ? "● Ativo" : "● Inativo"}
                  </Badge>
                  <DialogDescription className="text-sm m-0 flex items-center gap-1">
                    <Bot className="h-3.5 w-3.5" />
                    Agente de IA
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Dados Básicos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="p-4 bg-muted/30 border-0">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Phone className="h-3.5 w-3.5" />
                  Telefone
                </Label>
                <p className="font-semibold">{formatPhone(selectedAgente?.telefone) || '-'}</p>
              </Card>
              <Card className="p-4 bg-muted/30 border-0">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Store className="h-3.5 w-3.5" />
                  DealerID
                </Label>
                <p className="font-semibold">{selectedAgente?.dealer_id || '-'}</p>
              </Card>
            </div>

            {/* Persona */}
            {selectedAgente?.persona && (
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                  <User className="h-3.5 w-3.5" />
                  Persona
                </Label>
                <Card className="p-4 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20 border-blue-200/50 dark:border-blue-800/30">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{selectedAgente.persona}</p>
                </Card>
              </div>
            )}

            {/* Cérebro */}
            {selectedAgente?.cerebro && (
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Brain className="h-3.5 w-3.5" />
                  Cérebro
                </Label>
                <Card className="p-4 bg-gradient-to-br from-purple-50/50 to-transparent dark:from-purple-950/20 border-purple-200/50 dark:border-purple-800/30 max-h-48 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{selectedAgente.cerebro}</p>
                </Card>
              </div>
            )}

            {/* Nota informativa */}
            <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              Para alterações, entre em contato com o administrador.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
