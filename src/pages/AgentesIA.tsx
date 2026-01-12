import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Bot, Phone, RefreshCw, User, Brain, ChevronRight, Store } from "lucide-react";
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

  return (
    <DashboardLayout title="Agentes de IA">
      <ScrollIndicator className="flex-1 h-full">
        <div className="space-y-6 pb-6">
          {/* Header simples */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Agentes de IA</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {agentes.length > 0 
                  ? `${agentes.length} agente${agentes.length > 1 ? 's' : ''} disponíve${agentes.length > 1 ? 'is' : 'l'}`
                  : 'Nenhum agente disponível'
                }
              </p>
            </div>
            <Button 
              onClick={carregarAgentes} 
              disabled={loading} 
              variant="outline"
              size="sm"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Atualizar
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : agentes.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <Bot className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Nenhum agente de IA configurado para esta empresa.
                </p>
              </CardContent>
            </Card>
          ) : (
            /* Lista em coluna única */
            <div className="space-y-2">
              {agentes.map((agente) => (
                <Card 
                  key={agente.id} 
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleOpenAgente(agente)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      {/* Info principal */}
                      <div className="flex items-center gap-4 min-w-0">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={agente.foto_url || undefined} alt={agente.nome || "Agente"} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                            {agente.nome?.charAt(0).toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium truncate ${!agente.nome || agente.nome === "Novo agente" ? "text-muted-foreground italic" : ""}`}>
                              {agente.nome && agente.nome !== "Novo agente" ? agente.nome : "Sem nome"}
                            </span>
                            <Badge 
                              variant="secondary"
                              className={`shrink-0 text-[10px] px-1.5 py-0 ${agente.ativo 
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              }`}
                            >
                              {agente.ativo ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                          {agente.telefone && (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                              <Phone className="h-3 w-3" />
                              <span>{formatPhone(agente.telefone) || agente.telefone}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Botão de ação */}
                      <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground">
                        Ver detalhes
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
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
              <Avatar className="h-12 w-12">
                <AvatarImage src={selectedAgente?.foto_url || undefined} alt={selectedAgente?.nome || "Agente"} />
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {selectedAgente?.nome?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className={`text-lg ${!selectedAgente?.nome || selectedAgente?.nome === "Novo agente" ? "text-muted-foreground italic" : ""}`}>
                  {selectedAgente?.nome && selectedAgente?.nome !== "Novo agente" ? selectedAgente.nome : "Sem nome"}
                </DialogTitle>
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
                  <DialogDescription className="text-sm m-0">
                    Agente de IA
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Dados Básicos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/40">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                  <Phone className="h-3 w-3" />
                  Telefone
                </Label>
                <p className="font-medium text-sm">{formatPhone(selectedAgente?.telefone) || '-'}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/40">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                  <Store className="h-3 w-3" />
                  DealerID
                </Label>
                <p className="font-medium text-sm">{selectedAgente?.dealer_id || '-'}</p>
              </div>
            </div>

            {/* Persona */}
            {selectedAgente?.persona && (
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                  <User className="h-3 w-3" />
                  Persona
                </Label>
                <Card className="p-3 bg-muted/30">
                  <p className="text-sm whitespace-pre-wrap">{selectedAgente.persona}</p>
                </Card>
              </div>
            )}

            {/* Cérebro */}
            {selectedAgente?.cerebro && (
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Brain className="h-3 w-3" />
                  Cérebro
                </Label>
                <Card className="p-3 bg-muted/30 max-h-48 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">{selectedAgente.cerebro}</p>
                </Card>
              </div>
            )}

            {/* Nota informativa */}
            <p className="text-xs text-muted-foreground text-center pt-2">
              Para alterações, entre em contato com o administrador.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
