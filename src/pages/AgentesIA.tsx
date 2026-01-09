import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Bot, Phone, Store, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface AgenteWebhook {
  id?: string;
  nome: string;
  telefone: string;
  marca?: string;
  loja?: string;
  empresa_id?: string;
  ativo?: boolean;
}

export default function AgentesIA() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [agentes, setAgentes] = useState<AgenteWebhook[]>([]);
  const [loading, setLoading] = useState(false);
  const [userEmpresaId, setUserEmpresaId] = useState<string | null>(null);

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
      
      const response = await fetch('https://automatemaiawh.sagadatadriven.com.br/webhook/busca-dados-agentes', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      const data = await response.json();
      const agentesArray = Array.isArray(data) ? data : [data];
      
      // Filtrar apenas agentes da empresa do usuário logado
      const agentesFiltrados = agentesArray.filter(
        (agente: AgenteWebhook) => agente.empresa_id === userEmpresaId
      );
      
      setAgentes(agentesFiltrados);
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
              {agentes.map((agente, index) => (
                <Card key={agente.id || index} className="hover:shadow-card transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-4">
                      <div className="h-14 w-14 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Bot className="h-7 w-7 text-primary" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{agente.nome}</CardTitle>
                        <Badge 
                          variant={agente.ativo !== false ? "default" : "secondary"}
                          className="mt-1"
                        >
                          {agente.ativo !== false ? "Ativo" : "Inativo"}
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
                      {agente.marca && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Store className="h-4 w-4" />
                          <span>
                            {agente.marca}
                            {agente.loja && ` - ${agente.loja}`}
                          </span>
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
    </DashboardLayout>
  );
}
