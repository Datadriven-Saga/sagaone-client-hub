import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Motivo {
  id: string;
  descricao: string;
  ativo: boolean;
  ordem: number;
}

interface EmpresaMotivosTabProps {
  empresaId: string;
}

export function EmpresaMotivosTab({ empresaId }: EmpresaMotivosTabProps) {
  const [motivos, setMotivos] = useState<Motivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoMotivo, setNovoMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMotivos();
  }, [empresaId]);

  const fetchMotivos = async () => {
    try {
      const { data, error } = await supabase
        .from('motivos_nao_participacao')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('ordem');

      if (error) throw error;
      setMotivos(data || []);
    } catch (error) {
      console.error('Erro ao buscar motivos:', error);
      toast.error('Erro ao carregar motivos');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMotivo = async () => {
    if (!novoMotivo.trim()) {
      toast.error('Digite o motivo');
      return;
    }

    setSaving(true);
    try {
      const maxOrdem = motivos.length > 0 ? Math.max(...motivos.map(m => m.ordem)) : 0;

      const { data, error } = await supabase
        .from('motivos_nao_participacao')
        .insert({
          empresa_id: empresaId,
          descricao: novoMotivo.trim(),
          ordem: maxOrdem + 1,
          ativo: true
        })
        .select()
        .single();

      if (error) throw error;

      setMotivos([...motivos, data]);
      setNovoMotivo('');
      toast.success('Motivo adicionado');
    } catch (error) {
      console.error('Erro ao adicionar motivo:', error);
      toast.error('Erro ao adicionar motivo');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAtivo = async (id: string, ativo: boolean) => {
    try {
      const { error } = await supabase
        .from('motivos_nao_participacao')
        .update({ ativo })
        .eq('id', id);

      if (error) throw error;

      setMotivos(motivos.map(m => m.id === id ? { ...m, ativo } : m));
      toast.success(ativo ? 'Motivo ativado' : 'Motivo desativado');
    } catch (error) {
      console.error('Erro ao atualizar motivo:', error);
      toast.error('Erro ao atualizar motivo');
    }
  };

  const handleDeleteMotivo = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este motivo?')) return;

    try {
      const { error } = await supabase
        .from('motivos_nao_participacao')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMotivos(motivos.filter(m => m.id !== id));
      toast.success('Motivo excluído');
    } catch (error) {
      console.error('Erro ao excluir motivo:', error);
      toast.error('Erro ao excluir motivo');
    }
  };

  const handleUpdateDescricao = async (id: string, descricao: string) => {
    try {
      const { error } = await supabase
        .from('motivos_nao_participacao')
        .update({ descricao })
        .eq('id', id);

      if (error) throw error;

      setMotivos(motivos.map(m => m.id === id ? { ...m, descricao } : m));
    } catch (error) {
      console.error('Erro ao atualizar motivo:', error);
      toast.error('Erro ao atualizar motivo');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Motivos de Não Participação</CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure os motivos disponíveis para quando um cliente não irá participar de uma prospecção
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Adicionar novo motivo */}
          <div className="flex gap-2">
            <Input
              placeholder="Digite o novo motivo..."
              value={novoMotivo}
              onChange={(e) => setNovoMotivo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMotivo()}
            />
            <Button onClick={handleAddMotivo} disabled={saving}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>

          {/* Lista de motivos */}
          <div className="space-y-2">
            {motivos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum motivo cadastrado
              </p>
            ) : (
              motivos.map((motivo) => (
                <div
                  key={motivo.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    motivo.ativo ? 'bg-background' : 'bg-muted/50 opacity-60'
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  
                  <Input
                    value={motivo.descricao}
                    onChange={(e) => {
                      const newMotivos = motivos.map(m =>
                        m.id === motivo.id ? { ...m, descricao: e.target.value } : m
                      );
                      setMotivos(newMotivos);
                    }}
                    onBlur={(e) => handleUpdateDescricao(motivo.id, e.target.value)}
                    className="flex-1"
                  />

                  <div className="flex items-center gap-2">
                    <Label htmlFor={`ativo-${motivo.id}`} className="text-xs text-muted-foreground">
                      {motivo.ativo ? 'Ativo' : 'Inativo'}
                    </Label>
                    <Switch
                      id={`ativo-${motivo.id}`}
                      checked={motivo.ativo}
                      onCheckedChange={(checked) => handleToggleAtivo(motivo.id, checked)}
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteMotivo(motivo.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
