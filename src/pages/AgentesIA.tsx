import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Bot, Phone, Store, RefreshCw, User, Brain } from "lucide-react";
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
  
  const [agentes, setAgentes] = useState<AgenteLocal[]>([]);
  const [loading, setLoading] = useState(false);
  const [userEmpresaId, setUserEmpresaId] = useState<string | null>(null);
  const [selectedAgente, setSelectedAgente] = useState<AgenteLocal | null>(null);
  const [showModal, setShowModal] = useState(false);

  const getUserEmpresa = async () => {
    if (!user) return;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('id', user.id)
        .single();
      
      setUserEmpresaId(profile?.empresa_id || null);
    } catch (error) {
      console.error('Erro ao buscar empresa do usuário:', error);
    }
  };

  const carregarAgentes = async () => {
    if (!userEmpresaId) return;
    
    try {
      setLoading(true);
      
      // Buscar agentes atribuídos à empresa do usuário via tabela de relacionamento
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
        .eq('empresa_id', userEmpresaId);

      if (errorRelacionamento) {
        console.error('Erro ao buscar agentes:', errorRelacionamento);
        throw errorRelacionamento;
      }

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
    getUserEmpresa();
  }, [user]);

  useEffect(() => {
    if (userEmpresaId) {
      carregarAgentes();
    }
  }, [userEmpresaId]);

  return (
    <DashboardLayout title="Agentes de IA">
      <ScrollIndicator className="flex-1 h-full">
        <div className="space-y-6 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Agentes de IA</h1>
              <p className="text-muted-foreground">
                Agentes disponíveis para sua loja
              </p>
            </div>
            <Button onClick={carregarAgentes} disabled={loading} variant="outline">
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
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : agentes.length === 0 ? (
            <Card className="p-12 text-center">
              <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum agente disponível</h3>
              <p className="text-muted-foreground">
                Não há agentes de IA configurados para sua loja no momento
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agentes.map((agente) => (
                <Card 
                  key={agente.id} 
                  className="hover:shadow-card transition-shadow cursor-pointer"
                  onClick={() => handleOpenAgente(agente)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={agente.foto_url || undefined} alt={agente.nome} />
                        <AvatarFallback className="bg-primary/10 text-primary text-lg">
                          {agente.nome.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{agente.nome}</CardTitle>
                        <Badge 
                          className={agente.ativo 
                            ? "bg-green-500 hover:bg-green-600 text-white mt-1" 
                            : "bg-red-500 hover:bg-red-600 text-white mt-1"
                          }
                        >
                          {agente.ativo ? "Ativo" : "Desativado"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {agente.telefone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          <span>{agente.telefone}</span>
                        </div>
                      )}
                      {agente.dealer_id && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Store className="h-4 w-4" />
                          <span>DealerID: {agente.dealer_id}</span>
                        </div>
                      )}
                      {agente.persona && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{agente.persona}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollIndicator>

      {/* Modal de Detalhes do Agente (Somente Leitura) */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedAgente?.foto_url || undefined} alt={selectedAgente?.nome} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {selectedAgente?.nome?.charAt(0).toUpperCase() || 'A'}
                </AvatarFallback>
              </Avatar>
              <div>
                <span>{selectedAgente?.nome}</span>
                <Badge 
                  className={`ml-2 ${selectedAgente?.ativo 
                    ? "bg-green-500 hover:bg-green-600 text-white" 
                    : "bg-red-500 hover:bg-red-600 text-white"
                  }`}
                >
                  {selectedAgente?.ativo ? "Ativo" : "Desativado"}
                </Badge>
              </div>
            </DialogTitle>
            <DialogDescription>
              Informações do agente de IA
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Dados Básicos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Telefone</Label>
                <p className="font-medium">{selectedAgente?.telefone || '-'}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">DealerID</Label>
                <p className="font-medium">{selectedAgente?.dealer_id || '-'}</p>
              </div>
            </div>

            {/* Persona */}
            {selectedAgente?.persona && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Persona do Agente
                </Label>
                <Card className="p-4 bg-muted/30">
                  <p className="text-sm whitespace-pre-wrap">{selectedAgente.persona}</p>
                </Card>
              </div>
            )}

            {/* Cérebro */}
            {selectedAgente?.cerebro && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Cérebro do Agente
                </Label>
                <Card className="p-4 bg-muted/30 max-h-[200px] overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">{selectedAgente.cerebro}</p>
                </Card>
              </div>
            )}

            {/* Nota de somente leitura */}
            <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 p-3 rounded-lg text-sm flex items-center gap-2">
              <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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