import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowUp, ArrowDown, Edit, Trash2, Power, PowerOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CadenciaModal } from "./CadenciaModal";

interface Cadencia {
  id: string;
  agente_id: string;
  ordem: number;
  nome_cadencia: string;
  descricao?: string;
  tipo_disparo: 'whatsapp' | 'ligacao';
  tipo_mensagem: 'dinamica' | 'pre-definida';
  mensagem_enviada?: string;
  intervalo_minutos: number;
  ativa: boolean;
  empresa_id?: string;
}

interface AgenteCadenciasNovaProps {
  agenteId: string;
}

export function AgenteCadenciasNova({ agenteId }: AgenteCadenciasNovaProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [cadencias, setCadencias] = useState<Cadencia[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCadencia, setSelectedCadencia] = useState<Cadencia | null>(null);

  const carregarCadencias = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('agente_cadencias_steps')
        .select('*')
        .eq('agente_id', agenteId)
        .order('ordem', { ascending: true });

      if (error) throw error;
      setCadencias((data || []) as Cadencia[]);
    } catch (error) {
      console.error('Erro ao carregar cadências:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as cadências",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarCadencias();
  }, [agenteId]);

  const handleMoveUp = async (cadencia: Cadencia) => {
    if (cadencia.ordem === 1) return;
    
    const cadenciaAcima = cadencias.find(c => c.ordem === cadencia.ordem - 1);
    if (!cadenciaAcima) return;

    try {
      const { error: error1 } = await supabase
        .from('agente_cadencias_steps')
        .update({ ordem: cadencia.ordem })
        .eq('id', cadenciaAcima.id);

      const { error: error2 } = await supabase
        .from('agente_cadencias_steps')
        .update({ ordem: cadencia.ordem - 1 })
        .eq('id', cadencia.id);

      if (error1 || error2) throw error1 || error2;

      toast({ title: "Ordem atualizada", description: "A ordem das cadências foi atualizada" });
      carregarCadencias();
    } catch (error) {
      console.error('Erro ao mover cadência:', error);
      toast({
        title: "Erro",
        description: "Não foi possível mover a cadência",
        variant: "destructive"
      });
    }
  };

  const handleMoveDown = async (cadencia: Cadencia) => {
    const maxOrdem = Math.max(...cadencias.map(c => c.ordem));
    if (cadencia.ordem === maxOrdem) return;
    
    const cadenciaAbaixo = cadencias.find(c => c.ordem === cadencia.ordem + 1);
    if (!cadenciaAbaixo) return;

    try {
      const { error: error1 } = await supabase
        .from('agente_cadencias_steps')
        .update({ ordem: cadencia.ordem })
        .eq('id', cadenciaAbaixo.id);

      const { error: error2 } = await supabase
        .from('agente_cadencias_steps')
        .update({ ordem: cadencia.ordem + 1 })
        .eq('id', cadencia.id);

      if (error1 || error2) throw error1 || error2;

      toast({ title: "Ordem atualizada", description: "A ordem das cadências foi atualizada" });
      carregarCadencias();
    } catch (error) {
      console.error('Erro ao mover cadência:', error);
      toast({
        title: "Erro",
        description: "Não foi possível mover a cadência",
        variant: "destructive"
      });
    }
  };

  const handleToggleStatus = async (cadencia: Cadencia) => {
    try {
      const { error } = await supabase
        .from('agente_cadencias_steps')
        .update({ ativa: !cadencia.ativa })
        .eq('id', cadencia.id);

      if (error) throw error;

      toast({
        title: cadencia.ativa ? "Cadência inativada" : "Cadência ativada",
        description: `A cadência foi ${cadencia.ativa ? 'inativada' : 'ativada'} com sucesso`
      });
      carregarCadencias();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status da cadência",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (cadencia: Cadencia) => {
    if (!confirm(`Tem certeza que deseja excluir a cadência "${cadencia.nome_cadencia}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('agente_cadencias_steps')
        .delete()
        .eq('id', cadencia.id);

      if (error) throw error;

      toast({
        title: "Cadência excluída",
        description: "A cadência foi excluída com sucesso"
      });
      carregarCadencias();
    } catch (error) {
      console.error('Erro ao excluir cadência:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a cadência",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (cadencia: Cadencia) => {
    setSelectedCadencia(cadencia);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedCadencia(null);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedCadencia(null);
    carregarCadencias();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Nova Cadência</CardTitle>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Cadência
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : cadencias.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma cadência cadastrada. Clique em "Nova Cadência" para adicionar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Ordem</TableHead>
                    <TableHead>Nome da Cadência</TableHead>
                    <TableHead>Tipo de Disparo</TableHead>
                    <TableHead>Tipo da Mensagem</TableHead>
                    <TableHead>Mensagem Enviada</TableHead>
                    <TableHead className="text-right">Intervalo (min)</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cadencias.map((cadencia) => (
                    <TableRow key={cadencia.id} className={!cadencia.ativa ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{cadencia.ordem}</TableCell>
                      <TableCell>{cadencia.nome_cadencia}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {cadencia.tipo_disparo === 'whatsapp' ? 'WhatsApp' : 'Ligação'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {cadencia.tipo_mensagem === 'dinamica' ? 'Dinâmica' : 'Pré-Definida'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {cadencia.mensagem_enviada || '-'}
                      </TableCell>
                      <TableCell className="text-right">{cadencia.intervalo_minutos}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMoveUp(cadencia)}
                            disabled={cadencia.ordem === 1}
                            title="Mover para cima"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMoveDown(cadencia)}
                            disabled={cadencia.ordem === Math.max(...cadencias.map(c => c.ordem))}
                            title="Mover para baixo"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(cadencia)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleStatus(cadencia)}
                            title={cadencia.ativa ? "Inativar" : "Ativar"}
                          >
                            {cadencia.ativa ? (
                              <PowerOff className="h-4 w-4" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(cadencia)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CadenciaModal
        open={modalOpen}
        onClose={handleModalClose}
        cadencia={selectedCadencia}
        agenteId={agenteId}
        proximaOrdem={cadencias.length + 1}
      />
    </>
  );
}