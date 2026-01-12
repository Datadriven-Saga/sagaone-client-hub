import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Building2, Search, Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserEmpresa {
  empresa_id: string;
  empresa_nome: string;
  is_ativa: boolean;
}

interface UserEmpresasManagerProps {
  userId: string;
  userNome: string;
  onClose?: () => void;
  onUpdate?: () => void;
}

export function UserEmpresasManager({ userId, userNome, onClose, onUpdate }: UserEmpresasManagerProps) {
  const [empresas, setEmpresas] = useState<UserEmpresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchUserEmpresas();
  }, [userId]);

  const fetchUserEmpresas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_empresas')
        .select(`
          empresa_id,
          is_ativa,
          empresas (
            id,
            nome_empresa
          )
        `)
        .eq('user_id', userId);

      if (error) throw error;

      const formattedData: UserEmpresa[] = (data || []).map((item: any) => ({
        empresa_id: item.empresa_id,
        empresa_nome: item.empresas?.nome_empresa || 'Empresa desconhecida',
        is_ativa: item.is_ativa || false
      }));

      // Sort: active first, then alphabetically
      formattedData.sort((a, b) => {
        if (a.is_ativa && !b.is_ativa) return -1;
        if (!a.is_ativa && b.is_ativa) return 1;
        return a.empresa_nome.localeCompare(b.empresa_nome);
      });

      setEmpresas(formattedData);
    } catch (error) {
      console.error('Error fetching user empresas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as empresas do usuário",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (empresaId: string, newValue: boolean) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'toggle_empresa_ativa',
          user_id: userId,
          empresa_id: empresaId,
          is_ativa: newValue
        }
      });

      if (error) throw error;

      if (data?.success) {
        // Update local state
        setEmpresas(prev => prev.map(e => 
          e.empresa_id === empresaId ? { ...e, is_ativa: newValue } : e
        ));
        
        toast({
          title: "Sucesso",
          description: newValue 
            ? "Empresa ativada com sucesso" 
            : "Empresa desativada com sucesso"
        });
        
        onUpdate?.();
      } else {
        throw new Error(data?.error || 'Erro ao atualizar empresa');
      }
    } catch (error: any) {
      console.error('Error toggling empresa:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar a empresa",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSetAsActive = async (empresaId: string) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'set_active_empresa',
          user_id: userId,
          empresa_id: empresaId
        }
      });

      if (error) throw error;

      if (data?.success) {
        // Update local state - deactivate all, activate selected
        setEmpresas(prev => prev.map(e => ({
          ...e,
          is_ativa: e.empresa_id === empresaId
        })));
        
        toast({
          title: "Sucesso",
          description: "Empresa ativa alterada com sucesso"
        });
        
        onUpdate?.();
      } else {
        throw new Error(data?.error || 'Erro ao definir empresa ativa');
      }
    } catch (error: any) {
      console.error('Error setting active empresa:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível definir a empresa ativa",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredEmpresas = empresas.filter(e => 
    e.empresa_nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeEmpresa = empresas.find(e => e.is_ativa);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" />
          Empresas do Usuário
        </CardTitle>
        <CardDescription>
          {userNome} - {empresas.length} empresa(s) associada(s)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Active */}
        {activeEmpresa && (
          <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <Star className="h-4 w-4 text-primary fill-primary" />
            <span className="text-sm font-medium">Empresa ativa:</span>
            <Badge variant="default">{activeEmpresa.empresa_nome}</Badge>
          </div>
        )}

        {empresas.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma empresa associada a este usuário</p>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Empresas List */}
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {filteredEmpresas.map((empresa) => (
                  <div
                    key={empresa.empresa_id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      empresa.is_ativa 
                        ? 'bg-primary/5 border-primary/30' 
                        : 'bg-muted/30 border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Switch
                        checked={empresa.is_ativa}
                        onCheckedChange={(checked) => handleToggleActive(empresa.empresa_id, checked)}
                        disabled={saving}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{empresa.empresa_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {empresa.is_ativa ? 'Ativa' : 'Inativa'}
                        </p>
                      </div>
                    </div>
                    
                    {!empresa.is_ativa && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetAsActive(empresa.empresa_id)}
                        disabled={saving}
                        className="shrink-0"
                      >
                        <Star className="h-4 w-4 mr-1" />
                        Tornar ativa
                      </Button>
                    )}
                    
                    {empresa.is_ativa && (
                      <Badge variant="default" className="shrink-0">
                        <Star className="h-3 w-3 mr-1 fill-current" />
                        Ativa
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <p className="text-xs text-muted-foreground">
              A empresa ativa é a que será usada por padrão ao fazer login. 
              Use o toggle para ativar/desativar o acesso a cada empresa.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
