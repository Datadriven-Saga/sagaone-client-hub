import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Upload, Save, Power, PowerOff, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AgenteFollowups } from "@/components/AgenteFollowups";
import { AgenteCadencia } from "@/components/AgenteCadencia";
import { AgenteIntegracao } from "@/components/AgenteIntegracao";

interface Agente {
  id: string;
  nome: string;
  persona: string;
  cerebro: string;
  telefone: string;
  foto_url?: string;
  ativo: boolean;
}

interface AgenteDetalhesProps {
  agente: Agente | null;
  onClose: () => void;
}

export function AgenteDetalhes({ agente, onClose }: AgenteDetalhesProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("dados-gerais");
  const [formData, setFormData] = useState({
    nome: "",
    persona: "",
    cerebro: "",
    telefone: "",
    foto_url: "",
    ativo: true
  });

  const isEditing = !!agente;

  useEffect(() => {
    if (agente) {
      setFormData({
        nome: agente.nome || "",
        persona: agente.persona || "",
        cerebro: agente.cerebro || "",
        telefone: agente.telefone || "",
        foto_url: agente.foto_url || "",
        ativo: agente.ativo
      });
    }
  }, [agente]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione apenas arquivos de imagem",
        variant: "destructive"
      });
      return;
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Erro", 
        description: "A imagem deve ter no máximo 5MB",
        variant: "destructive"
      });
      return;
    }

    try {
      setUploading(true);

      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `agents/${fileName}`;

      // Upload para o Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('agent-photos')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Obter URL pública da imagem
      const { data: { publicUrl } } = supabase.storage
        .from('agent-photos')
        .getPublicUrl(filePath);

      // Atualizar o formData com a nova URL
      setFormData(prev => ({ ...prev, foto_url: publicUrl }));

      toast({
        title: "Sucesso",
        description: "Foto carregada com sucesso"
      });
    } catch (error) {
      console.error('Erro no upload:', error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível carregar a imagem",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nome) {
      toast({
        title: "Erro",
        description: "O nome do agente é obrigatório",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      if (isEditing) {
        // Atualizar agente existente
        const { error } = await supabase
          .from('agentes_ia')
          .update({
            nome: formData.nome,
            persona: formData.persona,
            cerebro: formData.cerebro,
            telefone: formData.telefone,
            foto_url: formData.foto_url,
            ativo: formData.ativo
          })
          .eq('id', agente.id);

        if (error) throw error;

        toast({
          title: "Agente atualizado",
          description: "O agente foi atualizado com sucesso"
        });
      } else {
        // Criar novo agente
        const { error } = await supabase
          .from('agentes_ia')
          .insert({
            nome: formData.nome,
            persona: formData.persona,
            cerebro: formData.cerebro,
            telefone: formData.telefone,
            foto_url: formData.foto_url,
            ativo: formData.ativo,
            criado_por: user?.id
          });

        if (error) throw error;

        toast({
          title: "Agente criado",
          description: "O agente foi criado com sucesso"
        });
      }

      onClose();
    } catch (error) {
      console.error('Erro ao salvar agente:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o agente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!isEditing) return;
    
    try {
      const newStatus = !formData.ativo;
      
      const { error } = await supabase
        .from('agentes_ia')
        .update({ ativo: newStatus })
        .eq('id', agente.id);

      if (error) throw error;

      setFormData(prev => ({ ...prev, ativo: newStatus }));

      toast({
        title: newStatus ? "Agente ativado" : "Agente inativado",
        description: `O agente foi ${newStatus ? 'ativado' : 'inativado'} com sucesso`
      });
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast({
        title: "Erro ao alterar status",
        description: "Não foi possível alterar o status do agente",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async () => {
    if (!isEditing) return;
    
    if (!confirm(`Tem certeza que deseja excluir o agente "${formData.nome}"? Esta ação não pode ser desfeita.`)) {
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
        description: "O agente foi excluído com sucesso"
      });

      onClose();
    } catch (error) {
      console.error('Erro ao excluir agente:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o agente",
        variant: "destructive"
      });
    }
  };

  return (
    <DashboardLayout title={isEditing ? `Editando: ${formData.nome}` : "Novo Agente"}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onClose}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Agentes
          </Button>
          
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Salvando..." : "Salvar"}
            </Button>
            
            {isEditing && (
              <>
                <Button variant="outline" onClick={handleToggleStatus}>
                  {formData.ativo ? (
                    <><PowerOff className="h-4 w-4 mr-2" />Inativar</>
                  ) : (
                    <><Power className="h-4 w-4 mr-2" />Ativar</>
                  )}
                </Button>
                
                <Button variant="destructive" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              </>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dados-gerais">Dados Gerais</TabsTrigger>
            {isEditing && (
              <>
                <TabsTrigger value="followup">Follow-up</TabsTrigger>
                <TabsTrigger value="cadencia">Cadência</TabsTrigger>
                <TabsTrigger value="integracao">Integração</TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="dados-gerais">
            <Card>
              <CardHeader>
                <CardTitle>Dados Gerais do Agente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Foto do agente */}
                  <div className="flex flex-col items-center space-y-4">
                    {formData.foto_url ? (
                      <Dialog>
                        <DialogTrigger asChild>
                          <div className="h-32 w-32 relative cursor-pointer hover:opacity-80 transition-opacity">
                            <img 
                              src={formData.foto_url} 
                              alt={`Foto do agente ${formData.nome}`}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-2">
                          <img 
                            src={formData.foto_url} 
                            alt={`Foto completa do agente ${formData.nome}`}
                            className="w-full h-auto max-w-full max-h-[90vh] object-contain rounded-lg"
                          />
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <div className="h-32 w-32 bg-primary/10 rounded-lg flex items-center justify-center">
                        <span className="text-3xl font-semibold text-primary">
                          {formData.nome.charAt(0).toUpperCase() || "A"}
                        </span>
                      </div>
                    )}
                    
                    <div className="w-full space-y-2">
                      <Label htmlFor="foto_url">URL da Foto</Label>
                      <Input
                        id="foto_url"
                        value={formData.foto_url}
                        onChange={(e) => setFormData(prev => ({ ...prev, foto_url: e.target.value }))}
                        placeholder="https://exemplo.com/foto.jpg"
                      />
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploading ? "Carregando..." : "Upload de Imagem"}
                      </Button>
                    </div>
                  </div>

                  {/* Campos de texto */}
                  <div className="lg:col-span-2 space-y-4">
                    <div>
                      <Label htmlFor="nome">Nome do Agente</Label>
                      <Input
                        id="nome"
                        value={formData.nome}
                        onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                        placeholder="Ex: Assistente Virtual"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="persona">Persona do Agente</Label>
                      <Textarea
                        id="persona"
                        value={formData.persona}
                        onChange={(e) => setFormData(prev => ({ ...prev, persona: e.target.value }))}
                        placeholder="Descrição breve sobre a identidade do agente..."
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="cerebro">Cérebro do Agente</Label>
                      <Textarea
                        id="cerebro"
                        value={formData.cerebro}
                        onChange={(e) => setFormData(prev => ({ ...prev, cerebro: e.target.value }))}
                        placeholder="Texto longo em linguagem natural que define o comportamento do agente..."
                        rows={6}
                      />
                    </div>

                    <div>
                      <Label htmlFor="telefone">Telefone</Label>
                      <Input
                        id="telefone"
                        value={formData.telefone}
                        onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                        placeholder="+55 11 99999-9999"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {isEditing && (
            <>
              <TabsContent value="followup">
                <AgenteFollowups agenteId={agente.id} />
              </TabsContent>

              <TabsContent value="cadencia">
                <AgenteCadencia agenteId={agente.id} />
              </TabsContent>

              <TabsContent value="integracao">
                <AgenteIntegracao agenteId={agente.id} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}