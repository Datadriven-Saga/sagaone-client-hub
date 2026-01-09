import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Edit, RefreshCw, Check, Building2, Server, Upload, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

interface InstanciaData {
  num_maia: string;
  marca: string;
  uf: string;
  instancia: string;
  evo_token: string;
  id_numero_meta: string;
  criado_em: string;
  tb_histories: string | null;
  cw_inbox: string | null;
  waba: string | null;
  meta_app_id: string | null;
  agente: string | null;
  cw_token_maia: string | null;
}

interface AgenteInstanciasProps {
  agenteId: string;
}

export function AgenteInstancias({ agenteId }: AgenteInstanciasProps) {
  const { toast } = useToast();
  const { activeCompany } = useCompany();
  
  const [loading, setLoading] = useState(false);
  const [loadingInstancias, setLoadingInstancias] = useState(false);
  const [loadingUpdate, setLoadingUpdate] = useState(false);
  const [editingTelefone, setEditingTelefone] = useState(false);
  const [telefoneMaia, setTelefoneMaia] = useState("");
  const [savedTelefoneMaia, setSavedTelefoneMaia] = useState("");
  const [instanciaData, setInstanciaData] = useState<InstanciaData | null>(null);
  const [showInstancias, setShowInstancias] = useState(false);
  const [empresaNome, setEmpresaNome] = useState("");
  const [showEvoToken, setShowEvoToken] = useState(false);
  const [showCwToken, setShowCwToken] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${label} copiado para a área de transferência`
    });
  };

  // Carregar dados do agente (telefone = telefone maia)
  const carregarDados = async () => {
    try {
      // Buscar o agente para obter o telefone
      const { data: agente, error } = await supabase
        .from('agentes_ia')
        .select('telefone, empresa_id')
        .eq('id', agenteId)
        .single();

      if (error) throw error;

      if (agente?.telefone) {
        setTelefoneMaia(agente.telefone);
        setSavedTelefoneMaia(agente.telefone);
      }

      // Buscar nome da empresa
      if (agente?.empresa_id) {
        const { data: empresa } = await supabase
          .from('empresas')
          .select('nome_empresa')
          .eq('id', agente.empresa_id)
          .single();

        if (empresa) {
          setEmpresaNome(empresa.nome_empresa);
        }
      } else if (activeCompany) {
        setEmpresaNome(activeCompany.nome_empresa);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const handleSaveTelefone = async () => {
    if (!telefoneMaia.trim()) {
      toast({
        title: "Erro",
        description: "O Telefone Maia não pode estar vazio",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from('agentes_ia')
        .update({ telefone: telefoneMaia.trim() })
        .eq('id', agenteId);

      if (error) throw error;

      setSavedTelefoneMaia(telefoneMaia.trim());
      setEditingTelefone(false);

      toast({
        title: "Telefone Maia salvo",
        description: "O Telefone Maia foi atualizado com sucesso"
      });
    } catch (error) {
      console.error('Erro ao salvar Telefone Maia:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o Telefone Maia",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerInstancias = async () => {
    if (!savedTelefoneMaia) {
      toast({
        title: "Telefone Maia não configurado",
        description: "Configure o Telefone Maia antes de buscar as instâncias",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoadingInstancias(true);
      setShowInstancias(true);
      setInstanciaData(null);

      // Chamar o webhook para verificar instâncias
      const response = await fetch('https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-instancias_evo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          telefone: savedTelefoneMaia
        })
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      const data = await response.json();
      console.log('Resposta do webhook verifica-instancias_evo:', data);
      
      // Verificar se a resposta tem dados válidos
      if (data && Object.keys(data).length > 0 && data.num_maia) {
        setInstanciaData(data);
        
        toast({
          title: "Instância encontrada",
          description: `Instância ${data.instancia || data.num_maia} carregada com sucesso`
        });
      } else {
        setInstanciaData(null);
        toast({
          title: "Nenhuma instância encontrada",
          description: "Não foram encontradas instâncias para este telefone",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao buscar instâncias:', error);
      toast({
        title: "Erro ao buscar instâncias",
        description: "Não foi possível carregar as instâncias da Evo",
        variant: "destructive"
      });
      setInstanciaData(null);
    } finally {
      setLoadingInstancias(false);
    }
  };

  const handleAtualizarInstancias = async () => {
    if (!savedTelefoneMaia) {
      toast({
        title: "Telefone Maia não configurado",
        description: "Configure o Telefone Maia antes de atualizar instâncias",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoadingUpdate(true);

      // Chamar o webhook para atualizar instâncias
      const response = await fetch('https://automatemaiawh.sagadatadriven.com.br/webhook/atualiza-instancias_evo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          telefone: savedTelefoneMaia
        })
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      toast({
        title: "Instâncias atualizadas",
        description: "A tabela da Evo foi atualizada com sucesso"
      });

      // Recarregar instâncias após atualização
      if (showInstancias) {
        await handleVerInstancias();
      }
    } catch (error) {
      console.error('Erro ao atualizar instâncias:', error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar as instâncias da Evo",
        variant: "destructive"
      });
    } finally {
      setLoadingUpdate(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [agenteId, activeCompany]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Instâncias Evolution
              </CardTitle>
              <CardDescription className="mt-1">
                Gerencie as instâncias da Evolution API vinculadas a esta Maia
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Campo Telefone Maia com nome da empresa */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="telefoneMaia">Telefone Maia</Label>
              <div className="flex gap-2 items-center flex-wrap">
                {editingTelefone ? (
                  <>
                    <Input
                      id="telefoneMaia"
                      value={telefoneMaia}
                      onChange={(e) => setTelefoneMaia(e.target.value)}
                      placeholder="Digite o telefone da Maia"
                      className="max-w-xs"
                    />
                    <Button 
                      size="sm" 
                      onClick={handleSaveTelefone}
                      disabled={loading}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {loading ? "Salvando..." : "Confirmar"}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setTelefoneMaia(savedTelefoneMaia);
                        setEditingTelefone(false);
                      }}
                    >
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-lg px-4 py-2">
                        {savedTelefoneMaia || "Não configurado"}
                      </Badge>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setEditingTelefone(true)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Alterar
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Nome da loja/empresa */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span className="text-sm">{empresaNome || "Loja não identificada"}</span>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={handleVerInstancias}
              disabled={loadingInstancias || !savedTelefoneMaia}
            >
              {loadingInstancias ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Carregando...
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Ver Instâncias Evo
                </>
              )}
            </Button>

            <Button 
              variant="outline"
              onClick={handleAtualizarInstancias}
              disabled={loadingUpdate || !savedTelefoneMaia}
            >
              {loadingUpdate ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Atualizar Instâncias Evo
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de instâncias */}
      {showInstancias && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Instâncias Encontradas</CardTitle>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleVerInstancias}
                disabled={loadingInstancias}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${loadingInstancias ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingInstancias ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : instanciaData ? (
              <div className="space-y-4">
                <Card className="border">
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-muted-foreground text-sm">Instância:</span>
                          <h4 className="font-semibold text-lg">{instanciaData.instancia}</h4>
                        </div>
                        <Badge variant="default">Ativa</Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="space-y-1">
                          <span className="text-muted-foreground">Número Maia:</span>
                          <p className="font-medium">{instanciaData.num_maia}</p>
                        </div>
                        
                        <div className="space-y-1">
                          <span className="text-muted-foreground">Marca:</span>
                          <p className="font-medium capitalize">{instanciaData.marca}</p>
                        </div>
                        
                        <div className="space-y-1">
                          <span className="text-muted-foreground">UF:</span>
                          <p className="font-medium">{instanciaData.uf}</p>
                        </div>
                        
                        <div className="space-y-1">
                          <span className="text-muted-foreground">ID Número Meta:</span>
                          <p className="font-medium">{instanciaData.id_numero_meta || '-'}</p>
                        </div>
                        
                        {instanciaData.criado_em && (
                          <div className="space-y-1">
                            <span className="text-muted-foreground">Criado em:</span>
                            <p className="font-medium">
                              {new Date(instanciaData.criado_em).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        )}
                        
                        {instanciaData.cw_inbox && (
                          <div className="space-y-1">
                            <span className="text-muted-foreground">CW Inbox:</span>
                            <p className="font-medium">{instanciaData.cw_inbox}</p>
                          </div>
                        )}

                        {instanciaData.agente && (
                          <div className="space-y-1">
                            <span className="text-muted-foreground">Agente:</span>
                            <p className="font-medium">{instanciaData.agente}</p>
                          </div>
                        )}

                        {instanciaData.waba && (
                          <div className="space-y-1">
                            <span className="text-muted-foreground">WABA:</span>
                            <p className="font-medium">{instanciaData.waba}</p>
                          </div>
                        )}
                      </div>

                      {instanciaData.evo_token && (
                        <div className="space-y-2 pt-2 border-t">
                          <span className="text-muted-foreground text-sm">Token Evo:</span>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 font-mono text-xs bg-muted p-2 rounded break-all">
                              {showEvoToken 
                                ? instanciaData.evo_token 
                                : '••••••••••••••••••••••••••••••••••••••••••••••••••'}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setShowEvoToken(!showEvoToken)}
                              title={showEvoToken ? "Ocultar" : "Mostrar"}
                            >
                              {showEvoToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(instanciaData.evo_token, "Token Evo")}
                              title="Copiar"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {instanciaData.cw_token_maia && (
                        <div className="space-y-2">
                          <span className="text-muted-foreground text-sm">CW Token Maia:</span>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 font-mono text-xs bg-muted p-2 rounded">
                              {showCwToken 
                                ? instanciaData.cw_token_maia 
                                : '••••••••••••••••••••••••'}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setShowCwToken(!showCwToken)}
                              title={showCwToken ? "Ocultar" : "Mostrar"}
                            >
                              {showCwToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(instanciaData.cw_token_maia!, "CW Token Maia")}
                              title="Copiar"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma instância encontrada para este telefone</p>
                <p className="text-sm mt-1">Verifique se o Telefone Maia está correto</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}