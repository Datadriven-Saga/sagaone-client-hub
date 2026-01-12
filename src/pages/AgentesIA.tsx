import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Bot, Phone, Store, RefreshCw, User, Brain, Sparkles, MessageSquare } from "lucide-react";
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
      
      // Buscar agentes atribuídos à empresa selecionada via tabela de relacionamento
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

      // Extrair agentes únicos do resultado
      const agentesUnicos: AgenteLocal[] = [];
      const idsAdicionados = new Set<string>();

      if (agenteEmpresas) {
        for (const item of agenteEmpresas) {
          const agente = item.agentes_ia as unknown as AgenteLocal;
          if (agente && !idsAdicionados.has(agente.id)) {
            agentesUnicos.push(agente);
            idsAdicionados.add(agente.id);
          }
        }
      }
      
      console.log('Agentes únicos encontrados:', agentesUnicos);
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

  return (
    <DashboardLayout title="Agentes de IA">
      <ScrollIndicator className="flex-1 h-full">
        <div className="space-y-6 pb-6">
          {/* Header com gradiente */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-6 border border-primary/20">
            <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/20 backdrop-blur-sm">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Agentes de IA</h1>
                  <p className="text-muted-foreground mt-1">
                    {agentes.length > 0 
                      ? `${agentes.length} agente${agentes.length > 1 ? 's' : ''} disponíve${agentes.length > 1 ? 'is' : 'l'} para ${activeCompany?.nome_empresa || 'sua loja'}`
                      : 'Agentes disponíveis para sua loja'
                    }
                  </p>
                </div>
              </div>
              <Button 
                onClick={carregarAgentes} 
                disabled={loading} 
                variant="outline"
                className="shrink-0 bg-background/50 backdrop-blur-sm"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Atualizar
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <Bot className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              </div>
              <p className="text-muted-foreground">Carregando agentes...</p>
            </div>
          ) : agentes.length === 0 ? (
            <Card className="border-dashed border-2 bg-muted/20">
              <CardContent className="p-12 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Bot className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhum agente disponível</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Não há agentes de IA configurados para {activeCompany?.nome_empresa || 'sua loja'} no momento.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {agentes.map((agente) => (
                <Card 
                  key={agente.id} 
                  className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer border-border/50 hover:border-primary/30"
                  onClick={() => handleOpenAgente(agente)}
                >
                  {/* Indicador de status no topo */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${agente.ativo ? 'bg-green-500' : 'bg-red-500'}`} />
                  
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Avatar com efeito hover */}
                      <div className="relative">
                        <Avatar className="h-16 w-16 ring-2 ring-background shadow-md group-hover:ring-primary/20 transition-all">
                          <AvatarImage src={agente.foto_url || undefined} alt={agente.nome} />
                          <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-primary text-xl font-semibold">
                            {agente.nome.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-background flex items-center justify-center ${agente.ativo ? 'bg-green-500' : 'bg-red-500'}`}>
                          <MessageSquare className="h-3 w-3 text-white" />
                        </div>
                      </div>
                      
                      {/* Informações principais */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-lg truncate">{agente.nome}</h3>
                          <Badge 
                            variant="secondary"
                            className={`shrink-0 text-xs ${agente.ativo 
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            }`}
                          >
                            {agente.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                        
                        <div className="mt-3 space-y-2">
                          {agente.telefone && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="h-4 w-4 shrink-0 text-primary/60" />
                              <span className="truncate">{formatPhone(agente.telefone) || agente.telefone}</span>
                            </div>
                          )}
                          {agente.dealer_id && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Store className="h-4 w-4 shrink-0 text-primary/60" />
                              <span className="truncate">DealerID: {agente.dealer_id}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Persona preview */}
                    {agente.persona && (
                      <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border/50">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
                          <User className="h-3 w-3" />
                          Persona
                        </div>
                        <p className="text-sm text-foreground/80 line-clamp-2">{agente.persona}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollIndicator>

      {/* Modal de Detalhes do Agente (Somente Leitura) */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                <AvatarImage src={selectedAgente?.foto_url || undefined} alt={selectedAgente?.nome} />
                <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-primary text-xl">
                  {selectedAgente?.nome?.charAt(0).toUpperCase() || 'A'}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-xl">{selectedAgente?.nome}</DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant="secondary"
                    className={`text-xs ${selectedAgente?.ativo 
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {selectedAgente?.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                  <DialogDescription className="text-sm">
                    Agente de IA
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Dados Básicos em Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/30 border">
                <Label className="text-xs text-muted-foreground flex items-center gap-2 mb-2">
                  <Phone className="h-3 w-3" />
                  Telefone
                </Label>
                <p className="font-medium">{formatPhone(selectedAgente?.telefone) || '-'}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border">
                <Label className="text-xs text-muted-foreground flex items-center gap-2 mb-2">
                  <Store className="h-3 w-3" />
                  DealerID
                </Label>
                <p className="font-medium">{selectedAgente?.dealer_id || '-'}</p>
              </div>
            </div>

            {/* Persona */}
            {selectedAgente?.persona && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-2">
                  <User className="h-3 w-3" />
                  Persona do Agente
                </Label>
                <Card className="p-4 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{selectedAgente.persona}</p>
                </Card>
              </div>
            )}

            {/* Cérebro */}
            {selectedAgente?.cerebro && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-2">
                  <Brain className="h-3 w-3" />
                  Cérebro do Agente
                </Label>
                <Card className="p-4 bg-muted/30 max-h-[200px] overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{selectedAgente.cerebro}</p>
                </Card>
              </div>
            )}

            {/* Nota de somente leitura */}
            <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 p-4 rounded-lg text-sm flex items-start gap-3 border border-blue-200 dark:border-blue-800">
              <svg className="h-5 w-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>Estas informações são somente para visualização. Entre em contato com o administrador para solicitar alterações.</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
