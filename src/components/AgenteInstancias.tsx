import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Edit, RefreshCw, Check, Building2, Server, Copy, X, Save, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAgenteSync } from "@/components/AgenteDetalhes";

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

interface NovaInstanciaData {
  num_maia: string;
  marca: string;
  uf: string;
  nome_agente: string;
  evo_token: string;
  id_numero_meta: string;
  tb_histories: string;
  cw_inbox: string;
  waba: string;
  meta_app_id: string;
  cw_token_maia: string;
}

interface AgenteInstanciasProps {
  agenteId: string;
  isNewAgent?: boolean;
}

const UF_LIST = ["DF", "GO", "MG", "MT", "RO"];

export function AgenteInstancias({ agenteId, isNewAgent = false }: AgenteInstanciasProps) {
  const { toast } = useToast();
  const { activeCompany } = useCompany();
  const syncContext = useAgenteSync();
  
  const [loading, setLoading] = useState(false);
  const [loadingInstancias, setLoadingInstancias] = useState(false);
  const [loadingUpdate, setLoadingUpdate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [creatingAgente, setCreatingAgente] = useState(false);
  const [editingTelefone, setEditingTelefone] = useState(false);
  const [telefoneMaia, setTelefoneMaia] = useState("");
  const [savedTelefoneMaia, setSavedTelefoneMaia] = useState("");
  const [instanciaData, setInstanciaData] = useState<InstanciaData | null>(null);
  const [showInstancias, setShowInstancias] = useState(isNewAgent);
  const [empresaNome, setEmpresaNome] = useState("");
  const [showEvoToken, setShowEvoToken] = useState(false);
  const [showCwToken, setShowCwToken] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState<InstanciaData | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(isNewAgent);
  const [novaInstancia, setNovaInstancia] = useState<NovaInstanciaData>({
    num_maia: "",
    marca: "",
    uf: "",
    nome_agente: "",
    evo_token: "",
    id_numero_meta: "",
    tb_histories: "",
    cw_inbox: "",
    waba: "",
    meta_app_id: "",
    cw_token_maia: ""
  });

  // Sincronizar dados do contexto para novaInstancia
  useEffect(() => {
    if (syncContext) {
      setNovaInstancia(prev => ({
        ...prev,
        num_maia: syncContext.formData.telefone || prev.num_maia,
        nome_agente: syncContext.formData.nome || prev.nome_agente
      }));
      setTelefoneMaia(syncContext.formData.telefone || "");
      setSavedTelefoneMaia(syncContext.formData.telefone || "");
    }
  }, [syncContext?.formData.telefone, syncContext?.formData.nome]);

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

  const carregarDados = async () => {
    // Se for novo agente, não buscar dados do banco
    if (isNewAgent || !agenteId) {
      if (activeCompany) {
        setEmpresaNome(activeCompany.nome_empresa);
      }
      return;
    }
    
    try {
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

  const buscarInstancias = async (): Promise<InstanciaData | null> => {
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
    
    if (data && Object.keys(data).length > 0 && data.num_maia) {
      return data;
    }
    return null;
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
      setEditMode(false);
      setShowCreateForm(false);

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
      setShowInstancias(true);
      setShowCreateForm(false);

      const data = await buscarInstancias();
      
      if (data) {
        setInstanciaData(data);
        setEditedData({ ...data });
        setEditMode(true);
        toast({
          title: "Dados carregados",
          description: "Edite os campos desejados e clique em Salvar"
        });
      } else {
        toast({
          title: "Nenhuma instância encontrada",
          description: "Não foram encontradas instâncias para editar",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao buscar instâncias para edição:', error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar os dados da instância",
        variant: "destructive"
      });
    } finally {
      setLoadingUpdate(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editedData) return;

    try {
      setSavingEdit(true);

      // Primeiro, atualizar instância via webhook atualiza-instancias_evo
      const response = await fetch('https://automatemaiawh.sagadatadriven.com.br/webhook/atualiza-instancias_evo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telefone: savedTelefoneMaia,
          ...editedData
        })
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      // Também chamar o webhook de atualização de agente
      try {
        const agentePayload = {
          num_maia: editedData.num_maia,
          nome_agente: editedData.agente,
          marca: editedData.marca,
          uf: editedData.uf,
          instancia: editedData.instancia,
          evo_token: editedData.evo_token || null,
          id_numero_meta: editedData.id_numero_meta || null,
          tb_histories: editedData.tb_histories || null,
          cw_inbox: editedData.cw_inbox || null,
          waba: editedData.waba || null,
          meta_app_id: editedData.meta_app_id || null,
          cw_token_maia: editedData.cw_token_maia || null,
          atualizado_em: new Date().toISOString()
        };

        console.log('Enviando para webhook atualiza-agente:', agentePayload);

        await fetch('https://automatemaiawh.sagadatadriven.com.br/webhook/atualiza-agente', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(agentePayload)
        });
      } catch (webhookError) {
        console.error('Erro ao chamar webhook atualiza-agente:', webhookError);
      }

      // Sincronizar com o contexto se disponível
      if (syncContext && editedData.num_maia) {
        syncContext.updateInstanciaData('num_maia', editedData.num_maia);
        syncContext.updateInstanciaData('marca', editedData.marca);
        syncContext.updateInstanciaData('uf', editedData.uf);
        if (editedData.agente) {
          syncContext.updateInstanciaData('nome_agente', editedData.agente);
        }
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

  // Gerar instância automaticamente
  const gerarInstancia = (nome_agente: string, marca: string, uf: string, num_maia: string) => {
    if (!nome_agente || !marca || !uf || !num_maia) return "";
    return `${nome_agente}${marca}${uf}+55${num_maia}`;
  };

  // Atualizar campo da nova instância com sincronização
  const handleNovaInstanciaChange = (field: keyof NovaInstanciaData, value: string) => {
    setNovaInstancia(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Sincronizar com o contexto do AgenteDetalhes
    if (syncContext) {
      if (field === 'num_maia') {
        syncContext.updateInstanciaData('num_maia', value);
      }
      if (field === 'nome_agente') {
        syncContext.updateInstanciaData('nome_agente', value);
      }
      if (field === 'marca') {
        syncContext.updateInstanciaData('marca', value);
      }
      if (field === 'uf') {
        syncContext.updateInstanciaData('uf', value);
      }
      if (field === 'evo_token') {
        syncContext.updateInstanciaData('evo_token', value);
      }
      if (field === 'id_numero_meta') {
        syncContext.updateInstanciaData('id_numero_meta', value);
      }
      if (field === 'tb_histories') {
        syncContext.updateInstanciaData('tb_histories', value);
      }
      if (field === 'cw_inbox') {
        syncContext.updateInstanciaData('cw_inbox', value);
      }
      if (field === 'waba') {
        syncContext.updateInstanciaData('waba', value);
      }
      if (field === 'meta_app_id') {
        syncContext.updateInstanciaData('meta_app_id', value);
      }
      if (field === 'cw_token_maia') {
        syncContext.updateInstanciaData('cw_token_maia', value);
      }
    }
  };

  // Criar nova instância via webhook
  const handleCriarAgente = async () => {
    // Validar campos obrigatórios
    if (!novaInstancia.num_maia.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O número do agente é obrigatório",
        variant: "destructive"
      });
      return;
    }
    if (!novaInstancia.marca.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "A marca é obrigatória",
        variant: "destructive"
      });
      return;
    }
    if (!novaInstancia.uf.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "A UF é obrigatória",
        variant: "destructive"
      });
      return;
    }
    if (!novaInstancia.nome_agente.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do agente é obrigatório",
        variant: "destructive"
      });
      return;
    }

    try {
      setCreatingAgente(true);

      // Gerar instância automaticamente
      const instancia = gerarInstancia(
        novaInstancia.nome_agente.trim(),
        novaInstancia.marca.trim(),
        novaInstancia.uf.trim(),
        novaInstancia.num_maia.trim()
      );

      const payload = {
        num_maia: novaInstancia.num_maia.trim(),
        marca: novaInstancia.marca.trim(),
        uf: novaInstancia.uf.trim(),
        nome_agente: novaInstancia.nome_agente.trim(),
        instancia: instancia,
        evo_token: novaInstancia.evo_token.trim() || null,
        id_numero_meta: novaInstancia.id_numero_meta.trim() || null,
        tb_histories: novaInstancia.tb_histories.trim() || null,
        cw_inbox: novaInstancia.cw_inbox.trim() || null,
        waba: novaInstancia.waba.trim() || null,
        meta_app_id: novaInstancia.meta_app_id.trim() || null,
        cw_token_maia: novaInstancia.cw_token_maia.trim() || null,
        criado_em: new Date().toISOString()
      };

      console.log('Enviando para webhook cria-agente:', payload);

      const response = await fetch('https://automatemaiawh.sagadatadriven.com.br/webhook/cria-agente', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      const result = await response.json();
      console.log('Resposta do webhook cria-agente:', result);

      toast({
        title: "Agente criado com sucesso!",
        description: `O agente ${novaInstancia.nome_agente} foi adicionado no banco com sucesso.`
      });

      // Limpar formulário e atualizar dados
      setNovaInstancia({
        num_maia: "",
        marca: "",
        uf: "",
        nome_agente: "",
        evo_token: "",
        id_numero_meta: "",
        tb_histories: "",
        cw_inbox: "",
        waba: "",
        meta_app_id: "",
        cw_token_maia: ""
      });
      setShowCreateForm(false);
      
      // Atualizar telefone maia se foi preenchido
      if (novaInstancia.num_maia) {
        setTelefoneMaia(novaInstancia.num_maia);
        setSavedTelefoneMaia(novaInstancia.num_maia);
        
        // Salvar no banco local também
        await supabase
          .from('agentes_ia')
          .update({ telefone: novaInstancia.num_maia.trim() })
          .eq('id', agenteId);
      }

      // Buscar instância criada
      setTimeout(() => {
        handleVerInstancias();
      }, 1000);

    } catch (error) {
      console.error('Erro ao criar agente:', error);
      toast({
        title: "Erro ao criar agente",
        description: "Não foi possível adicionar o agente no banco. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setCreatingAgente(false);
    }
  };

  const handleShowCreateForm = () => {
    setShowCreateForm(true);
    setShowInstancias(true);
    setEditMode(false);
    setInstanciaData(null);
  };

  useEffect(() => {
    carregarDados();
  }, [agenteId, activeCompany]);

  // Instância gerada automaticamente para preview
  const instanciaPreview = gerarInstancia(
    novaInstancia.nome_agente,
    novaInstancia.marca,
    novaInstancia.uf,
    novaInstancia.num_maia
  );

  return (
    <div className="space-y-6">
      {/* Mostrar o formulário de criação diretamente para novos agentes */}
      {isNewAgent ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Criar Nova Instância
                </CardTitle>
                <CardDescription className="mt-1">
                  Preencha os dados para criar uma nova instância no sistema
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Card className="border">
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="space-y-1">
                        <span className="text-muted-foreground text-sm">Nova Instância:</span>
                        <h4 className="font-semibold text-lg">
                          {instanciaPreview || "Preencha os campos obrigatórios"}
                        </h4>
                      </div>
                      <Badge variant="outline">Novo Agente</Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome do Agente *</Label>
                        <Input
                          value={novaInstancia.nome_agente}
                          onChange={(e) => handleNovaInstanciaChange('nome_agente', e.target.value)}
                          placeholder="Ex: Pri, Maia..."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Número Agente *</Label>
                        <Input
                          value={novaInstancia.num_maia}
                          onChange={(e) => handleNovaInstanciaChange('num_maia', e.target.value)}
                          placeholder="Ex: 61999999999"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Marca *</Label>
                        <Input
                          value={novaInstancia.marca}
                          onChange={(e) => handleNovaInstanciaChange('marca', e.target.value)}
                          placeholder="Ex: Volkswagen, Chevrolet..."
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>UF *</Label>
                        <Select
                          value={novaInstancia.uf}
                          onValueChange={(value) => handleNovaInstanciaChange('uf', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a UF" />
                          </SelectTrigger>
                          <SelectContent>
                            {UF_LIST.map((uf) => (
                              <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>ID Número Meta</Label>
                        <Input
                          value={novaInstancia.id_numero_meta}
                          onChange={(e) => handleNovaInstanciaChange('id_numero_meta', e.target.value)}
                          placeholder="ID do número Meta"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>CW Inbox</Label>
                        <Input
                          value={novaInstancia.cw_inbox}
                          onChange={(e) => handleNovaInstanciaChange('cw_inbox', e.target.value)}
                          placeholder="CW Inbox ID"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>WABA</Label>
                        <Input
                          value={novaInstancia.waba}
                          onChange={(e) => handleNovaInstanciaChange('waba', e.target.value)}
                          placeholder="WABA ID"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Meta App ID</Label>
                        <Input
                          value={novaInstancia.meta_app_id}
                          onChange={(e) => handleNovaInstanciaChange('meta_app_id', e.target.value)}
                          placeholder="Meta App ID"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>TB Histories</Label>
                        <Input
                          value={novaInstancia.tb_histories}
                          onChange={(e) => handleNovaInstanciaChange('tb_histories', e.target.value)}
                          placeholder="Tabela de histórico"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                      <Label>Token Evo</Label>
                      <Input
                        type="password"
                        value={novaInstancia.evo_token}
                        onChange={(e) => handleNovaInstanciaChange('evo_token', e.target.value)}
                        placeholder="Token da Evolution API"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>CW Token Maia</Label>
                      <Input
                        type="password"
                        value={novaInstancia.cw_token_maia}
                        onChange={(e) => handleNovaInstanciaChange('cw_token_maia', e.target.value)}
                        placeholder="Token do Chatwoot"
                      />
                    </div>

                    {/* Preview da instância gerada */}
                    {instanciaPreview && (
                      <div className="p-3 bg-muted rounded-lg">
                        <Label className="text-xs text-muted-foreground">Instância gerada automaticamente:</Label>
                        <p className="font-mono text-sm mt-1">{instanciaPreview}</p>
                      </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t">
                      <Button 
                        onClick={handleCriarAgente}
                        disabled={creatingAgente}
                      >
                        {creatingAgente ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Criando...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Criar Agente
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Interface padrão para agentes existentes */
        <>
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
                      Carregando...
                    </>
                  ) : (
                    <>
                      <Edit className="h-4 w-4 mr-2" />
                      Atualizar Instâncias Evo
                    </>
                  )}
                </Button>

                <Button 
                  variant="secondary"
                  onClick={handleShowCreateForm}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Nova Instância
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista de instâncias ou formulário de criação */}
          {showInstancias && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {showCreateForm ? "Criar Nova Instância" : editMode ? "Editar Instância" : "Instâncias Encontradas"}
                  </CardTitle>
                  {!editMode && !showCreateForm && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleVerInstancias}
                      disabled={loadingInstancias}
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${loadingInstancias ? 'animate-spin' : ''}`} />
                      Atualizar
                    </Button>
                  )}
                </div>
                {showCreateForm && (
                  <CardDescription>
                    Preencha os dados para criar uma nova instância no sistema
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {loadingInstancias || loadingUpdate ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : showCreateForm ? (
                  /* Formulário de criação */
                  <div className="space-y-4">
                <Card className="border">
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="space-y-1">
                          <span className="text-muted-foreground text-sm">Nova Instância:</span>
                          <h4 className="font-semibold text-lg">
                            {instanciaPreview || "Preencha os campos obrigatórios"}
                          </h4>
                        </div>
                        <Badge variant="outline">Criando</Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nome do Agente *</Label>
                          <Input
                            value={novaInstancia.nome_agente}
                            onChange={(e) => handleNovaInstanciaChange('nome_agente', e.target.value)}
                            placeholder="Ex: Pri, Maia..."
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Número Agente *</Label>
                          <Input
                            value={novaInstancia.num_maia}
                            onChange={(e) => handleNovaInstanciaChange('num_maia', e.target.value)}
                            placeholder="Ex: 61999999999"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Marca *</Label>
                          <Input
                            value={novaInstancia.marca}
                            onChange={(e) => handleNovaInstanciaChange('marca', e.target.value)}
                            placeholder="Ex: Volkswagen, Chevrolet..."
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>UF *</Label>
                          <Select
                            value={novaInstancia.uf}
                            onValueChange={(value) => handleNovaInstanciaChange('uf', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a UF" />
                            </SelectTrigger>
                            <SelectContent>
                              {UF_LIST.map((uf) => (
                                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>ID Número Meta</Label>
                          <Input
                            value={novaInstancia.id_numero_meta}
                            onChange={(e) => handleNovaInstanciaChange('id_numero_meta', e.target.value)}
                            placeholder="ID do número Meta"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>CW Inbox</Label>
                          <Input
                            value={novaInstancia.cw_inbox}
                            onChange={(e) => handleNovaInstanciaChange('cw_inbox', e.target.value)}
                            placeholder="CW Inbox ID"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>WABA</Label>
                          <Input
                            value={novaInstancia.waba}
                            onChange={(e) => handleNovaInstanciaChange('waba', e.target.value)}
                            placeholder="WABA ID"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Meta App ID</Label>
                          <Input
                            value={novaInstancia.meta_app_id}
                            onChange={(e) => handleNovaInstanciaChange('meta_app_id', e.target.value)}
                            placeholder="Meta App ID"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>TB Histories</Label>
                          <Input
                            value={novaInstancia.tb_histories}
                            onChange={(e) => handleNovaInstanciaChange('tb_histories', e.target.value)}
                            placeholder="Tabela de histórico"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t">
                        <Label>Token Evo</Label>
                        <Input
                          type="password"
                          value={novaInstancia.evo_token}
                          onChange={(e) => handleNovaInstanciaChange('evo_token', e.target.value)}
                          placeholder="Token da Evolution API"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>CW Token Maia</Label>
                        <Input
                          type="password"
                          value={novaInstancia.cw_token_maia}
                          onChange={(e) => handleNovaInstanciaChange('cw_token_maia', e.target.value)}
                          placeholder="Token do Chatwoot"
                        />
                      </div>

                      {/* Preview da instância gerada */}
                      {instanciaPreview && (
                        <div className="p-3 bg-muted rounded-lg">
                          <Label className="text-xs text-muted-foreground">Instância gerada automaticamente:</Label>
                          <p className="font-mono text-sm mt-1">{instanciaPreview}</p>
                        </div>
                      )}

                      <div className="flex gap-3 pt-4 border-t">
                        <Button 
                          onClick={handleCriarAgente}
                          disabled={creatingAgente}
                        >
                          {creatingAgente ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Criando...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Criar Agente
                            </>
                          )}
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => setShowCreateForm(false)}
                          disabled={creatingAgente}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : editMode && editedData ? (
              /* Modo de edição */
              <div className="space-y-4">
                <Card className="border">
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="space-y-1">
                          <span className="text-muted-foreground text-sm">Instância:</span>
                          <h4 className="font-semibold text-lg">{editedData.instancia}</h4>
                        </div>
                        <Badge variant="secondary">Editando</Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Número Agente</Label>
                          <Input
                            value={editedData.num_maia}
                            onChange={(e) => handleEditFieldChange('num_maia', e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Marca</Label>
                          <Input
                            value={editedData.marca}
                            onChange={(e) => handleEditFieldChange('marca', e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>UF</Label>
                          <Input
                            value={editedData.uf}
                            onChange={(e) => handleEditFieldChange('uf', e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>ID Número Meta</Label>
                          <Input
                            value={editedData.id_numero_meta || ''}
                            onChange={(e) => handleEditFieldChange('id_numero_meta', e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Instância</Label>
                          <Input
                            value={editedData.instancia}
                            onChange={(e) => handleEditFieldChange('instancia', e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>CW Inbox</Label>
                          <Input
                            value={editedData.cw_inbox || ''}
                            onChange={(e) => handleEditFieldChange('cw_inbox', e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Agente</Label>
                          <Input
                            value={editedData.agente || ''}
                            onChange={(e) => handleEditFieldChange('agente', e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>WABA</Label>
                          <Input
                            value={editedData.waba || ''}
                            onChange={(e) => handleEditFieldChange('waba', e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Meta App ID</Label>
                          <Input
                            value={editedData.meta_app_id || ''}
                            onChange={(e) => handleEditFieldChange('meta_app_id', e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>TB Histories</Label>
                          <Input
                            value={editedData.tb_histories || ''}
                            onChange={(e) => handleEditFieldChange('tb_histories', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t">
                        <Label>Token Evo</Label>
                        <Input
                          type={showEvoToken ? "text" : "password"}
                          value={editedData.evo_token || ''}
                          onChange={(e) => handleEditFieldChange('evo_token', e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            type="button"
                            onClick={handleToggleEvoToken}
                          >
                            {showEvoToken ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                            {showEvoToken ? "Ocultar" : "Mostrar"}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>CW Token Maia</Label>
                        <Input
                          type={showCwToken ? "text" : "password"}
                          value={editedData.cw_token_maia || ''}
                          onChange={(e) => handleEditFieldChange('cw_token_maia', e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            type="button"
                            onClick={handleToggleCwToken}
                          >
                            {showCwToken ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                            {showCwToken ? "Ocultar" : "Mostrar"}
                          </Button>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-4 border-t">
                        <Button 
                          onClick={handleSaveEdit}
                          disabled={savingEdit}
                        >
                          {savingEdit ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Salvando...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Salvar Alterações
                            </>
                          )}
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={handleCancelEdit}
                          disabled={savingEdit}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : instanciaData ? (
              /* Modo de visualização */
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
                          <span className="text-muted-foreground">Número Agente:</span>
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
                            <div className="flex-1 min-w-0 font-mono text-xs bg-muted p-2 rounded break-all overflow-hidden">
                              {showEvoToken
                                ? instanciaData.evo_token
                                : "••••••••••••••••••••••••••••••••••••••••••••••••••"}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              type="button"
                              className="shrink-0 relative z-10"
                              onClick={handleToggleEvoToken}
                              title={showEvoToken ? "Ocultar" : "Mostrar"}
                            >
                              {showEvoToken ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              type="button"
                              className="shrink-0 relative z-10"
                              onClick={(e) =>
                                handleCopyToClipboard(e, instanciaData.evo_token, "Token Evo")
                              }
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
                            <div className="flex-1 min-w-0 font-mono text-xs bg-muted p-2 rounded break-all overflow-hidden">
                              {showCwToken
                                ? instanciaData.cw_token_maia
                                : "••••••••••••••••••••••••"}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              type="button"
                              className="shrink-0 relative z-10"
                              onClick={handleToggleCwToken}
                              title={showCwToken ? "Ocultar" : "Mostrar"}
                            >
                              {showCwToken ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              type="button"
                              className="shrink-0 relative z-10"
                              onClick={(e) =>
                                handleCopyToClipboard(
                                  e,
                                  instanciaData.cw_token_maia!,
                                  "CW Token Maia"
                                )
                              }
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
                    <p>Nenhuma instância encontrada para este agente</p>
                    <p className="text-sm mt-1">Verifique se o Telefone Maia está correto ou crie uma nova instância</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={handleShowCreateForm}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Nova Instância
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
