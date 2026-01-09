import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Eye, EyeOff, Edit, RefreshCw, Check, Building2, Server, Copy, X, Save, Plus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

interface Agente {
  id: string;
  nome: string;
  telefone: string | null;
  empresa_id: string | null;
}

export default function Instancias() {
  const { toast } = useToast();
  const { activeCompany } = useCompany();
  
  const [loading, setLoading] = useState(false);
  const [loadingInstancias, setLoadingInstancias] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [selectedAgenteId, setSelectedAgenteId] = useState<string>("");
  const [telefoneMaia, setTelefoneMaia] = useState("");
  const [instanciaData, setInstanciaData] = useState<InstanciaData | null>(null);
  const [showEvoToken, setShowEvoToken] = useState(false);
  const [showCwToken, setShowCwToken] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState<InstanciaData | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");

  const handleCopyToClipboard = async (
    e: React.MouseEvent,
    text: string,
    label: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const fallbackCopy = () => {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      el.style.top = "0";
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      if (!ok) throw new Error("execCommand(copy) falhou");
    };

    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopy();
      }

      toast({
        title: "Copiado!",
        description: `${label} copiado para a área de transferência`,
      });
    } catch (err) {
      try {
        fallbackCopy();
        toast({
          title: "Copiado!",
          description: `${label} copiado para a área de transferência`,
        });
      } catch (err2) {
        console.error("Erro ao copiar:", err, err2);
        toast({
          title: "Erro ao copiar",
          description: "Não foi possível copiar para a área de transferência",
          variant: "destructive",
        });
      }
    }
  };

  const handleToggleEvoToken = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowEvoToken(prev => !prev);
  };

  const handleToggleCwToken = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowCwToken(prev => !prev);
  };

  const carregarAgentes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('agentes_ia')
        .select('id, nome, telefone, empresa_id')
        .order('nome');

      if (error) throw error;
      setAgentes(data || []);
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

  const handleAgenteChange = async (agenteId: string) => {
    setSelectedAgenteId(agenteId);
    setInstanciaData(null);
    setEditMode(false);
    setShowEvoToken(false);
    setShowCwToken(false);

    const agente = agentes.find(a => a.id === agenteId);
    if (agente) {
      setTelefoneMaia(agente.telefone || "");
      
      if (agente.empresa_id) {
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
    }
  };

  const buscarInstancias = async (): Promise<InstanciaData | null> => {
    const response = await fetch('https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-instancias_evo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        telefone: telefoneMaia
      })
    });

    if (!response.ok) {
      throw new Error(`Erro na requisição: ${response.status}`);
    }

    const data = await response.json();
    console.log('Resposta do webhook verifica-instancias_evo:', data);
    
    if (data && Object.keys(data).length > 0 && data.num_maia) {
      return data;
    }
    return null;
  };

  const handleVerInstancias = async () => {
    if (!telefoneMaia) {
      toast({
        title: "Telefone Maia não configurado",
        description: "Selecione um agente com telefone configurado",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoadingInstancias(true);
      setInstanciaData(null);
      setEditMode(false);

      const data = await buscarInstancias();
      
      if (data) {
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

  const handleEditarInstancia = () => {
    if (instanciaData) {
      setEditedData({ ...instanciaData });
      setEditMode(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!editedData) return;

    try {
      setSavingEdit(true);

      const response = await fetch('https://automatemaiawh.sagadatadriven.com.br/webhook/atualiza-instancias_evo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telefone: telefoneMaia,
          ...editedData
        })
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      toast({
        title: "Instância atualizada",
        description: "Os dados da instância foram salvos com sucesso"
      });

      setInstanciaData(editedData);
      setEditMode(false);
    } catch (error) {
      console.error('Erro ao salvar edições:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as alterações",
        variant: "destructive"
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditedData(null);
  };

  const handleEditFieldChange = (field: keyof InstanciaData, value: string) => {
    if (editedData) {
      setEditedData({
        ...editedData,
        [field]: value
      });
    }
  };

  useEffect(() => {
    carregarAgentes();
  }, []);

  const renderTokenField = (
    label: string,
    value: string | null,
    showToken: boolean,
    onToggle: (e: React.MouseEvent) => void,
    onCopy: (e: React.MouseEvent) => void
  ) => (
    <div className="space-y-2 relative">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2 relative">
        <div className="flex-1 min-w-0 overflow-hidden">
          <code className="text-sm bg-muted px-2 py-1 rounded block truncate pointer-events-none select-none">
            {showToken ? (value || "N/A") : "••••••••••••••••"}
          </code>
        </div>
        <div className="flex gap-1 shrink-0 relative z-10 pointer-events-auto">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            title={showToken ? `Ocultar ${label}` : `Ver ${label}`}
            aria-label={showToken ? `Ocultar ${label}` : `Ver ${label}`}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={onToggle}
          >
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          {value && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              title={`Copiar ${label}`}
              aria-label={`Copiar ${label}`}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={onCopy}
            >
              <Copy className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout title="Instâncias">
      <ScrollIndicator className="flex-1 h-full">
        <div className="space-y-6 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Instâncias Evolution</h1>
            <p className="text-muted-foreground">
              Gerencie as instâncias da Evolution API vinculadas aos agentes
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Selecionar Agente
              </CardTitle>
              <CardDescription>
                Escolha um agente para visualizar suas instâncias
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label>Agente</Label>
                  <Select value={selectedAgenteId} onValueChange={handleAgenteChange}>
                    <SelectTrigger className="w-full max-w-md">
                      <SelectValue placeholder="Selecione um agente" />
                    </SelectTrigger>
                    <SelectContent>
                      {agentes.map((agente) => (
                        <SelectItem key={agente.id} value={agente.id}>
                          {agente.nome} {agente.telefone ? `(${agente.telefone})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedAgenteId && empresaNome && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span className="text-sm">{empresaNome}</span>
                  </div>
                )}
              </div>

              {selectedAgenteId && (
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button 
                    onClick={handleVerInstancias}
                    disabled={loadingInstancias || !telefoneMaia}
                  >
                    {loadingInstancias ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Carregando...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Buscar Instância
                      </>
                    )}
                  </Button>

                  {!telefoneMaia && (
                    <p className="text-sm text-muted-foreground flex items-center">
                      Este agente não possui telefone configurado
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {instanciaData && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {editMode ? "Editar Instância" : "Dados da Instância"}
                  </CardTitle>
                  <div className="flex gap-2">
                    {editMode ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEdit}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={savingEdit}
                        >
                          {savingEdit ? (
                            <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-1" />
                          )}
                          Salvar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleVerInstancias}
                          disabled={loadingInstancias}
                        >
                          <RefreshCw className={`h-4 w-4 mr-1 ${loadingInstancias ? 'animate-spin' : ''}`} />
                          Atualizar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleEditarInstancia}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {editMode && editedData ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_num_maia">Número Maia</Label>
                      <Input
                        id="edit_num_maia"
                        value={editedData.num_maia}
                        onChange={(e) => handleEditFieldChange('num_maia', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_marca">Marca</Label>
                      <Input
                        id="edit_marca"
                        value={editedData.marca}
                        onChange={(e) => handleEditFieldChange('marca', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_uf">UF</Label>
                      <Input
                        id="edit_uf"
                        value={editedData.uf}
                        onChange={(e) => handleEditFieldChange('uf', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_instancia">Instância</Label>
                      <Input
                        id="edit_instancia"
                        value={editedData.instancia}
                        onChange={(e) => handleEditFieldChange('instancia', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_evo_token">Evo Token</Label>
                      <Input
                        id="edit_evo_token"
                        value={editedData.evo_token}
                        onChange={(e) => handleEditFieldChange('evo_token', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_id_numero_meta">ID Número Meta</Label>
                      <Input
                        id="edit_id_numero_meta"
                        value={editedData.id_numero_meta}
                        onChange={(e) => handleEditFieldChange('id_numero_meta', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_tb_histories">TB Histories</Label>
                      <Input
                        id="edit_tb_histories"
                        value={editedData.tb_histories || ''}
                        onChange={(e) => handleEditFieldChange('tb_histories', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_cw_inbox">CW Inbox</Label>
                      <Input
                        id="edit_cw_inbox"
                        value={editedData.cw_inbox || ''}
                        onChange={(e) => handleEditFieldChange('cw_inbox', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_waba">WABA</Label>
                      <Input
                        id="edit_waba"
                        value={editedData.waba || ''}
                        onChange={(e) => handleEditFieldChange('waba', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_meta_app_id">Meta App ID</Label>
                      <Input
                        id="edit_meta_app_id"
                        value={editedData.meta_app_id || ''}
                        onChange={(e) => handleEditFieldChange('meta_app_id', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_agente">Agente</Label>
                      <Input
                        id="edit_agente"
                        value={editedData.agente || ''}
                        onChange={(e) => handleEditFieldChange('agente', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_cw_token_maia">CW Token Maia</Label>
                      <Input
                        id="edit_cw_token_maia"
                        value={editedData.cw_token_maia || ''}
                        onChange={(e) => handleEditFieldChange('cw_token_maia', e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Número Maia</Label>
                      <p className="text-sm font-medium">{instanciaData.num_maia}</p>
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
                      <Label className="text-xs text-muted-foreground">Instância</Label>
                      <p className="text-sm font-medium">{instanciaData.instancia}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">ID Número Meta</Label>
                      <p className="text-sm font-medium">{instanciaData.id_numero_meta}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Criado em</Label>
                      <p className="text-sm font-medium">{instanciaData.criado_em}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">TB Histories</Label>
                      <p className="text-sm font-medium">{instanciaData.tb_histories || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">CW Inbox</Label>
                      <p className="text-sm font-medium">{instanciaData.cw_inbox || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">WABA</Label>
                      <p className="text-sm font-medium">{instanciaData.waba || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Meta App ID</Label>
                      <p className="text-sm font-medium">{instanciaData.meta_app_id || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Agente</Label>
                      <p className="text-sm font-medium">{instanciaData.agente || 'N/A'}</p>
                    </div>
                    
                    {renderTokenField(
                      "Evo Token",
                      instanciaData.evo_token,
                      showEvoToken,
                      handleToggleEvoToken,
                      (e) => handleCopyToClipboard(e, instanciaData.evo_token, "Evo Token")
                    )}
                    
                    {renderTokenField(
                      "CW Token Maia",
                      instanciaData.cw_token_maia,
                      showCwToken,
                      handleToggleCwToken,
                      (e) => handleCopyToClipboard(e, instanciaData.cw_token_maia || "", "CW Token Maia")
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!selectedAgenteId && (
            <Card className="p-12 text-center">
              <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Selecione um Agente</h3>
              <p className="text-muted-foreground">
                Escolha um agente acima para visualizar suas instâncias Evolution
              </p>
            </Card>
          )}
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
}
