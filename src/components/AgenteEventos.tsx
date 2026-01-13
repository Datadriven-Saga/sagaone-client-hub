import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  RefreshCw, 
  Trash2, 
  Calendar, 
  AlertTriangle 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Evento {
  id_evento: string;
  nome_evento?: string;
  titulo?: string;
  evt_status: 'ativo' | 'inativo';
  data_criacao?: string;
  data_inicio?: string;
  data_fim?: string;
  [key: string]: any;
}

interface AgenteEventosProps {
  agenteId: string;
  agenteTelefone?: string;
}

export function AgenteEventos({ agenteId, agenteTelefone }: AgenteEventosProps) {
  const { toast } = useToast();
  const { isAdminOrTI } = useUserAccessType();
  
  const [loading, setLoading] = useState(false);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [changingStatus, setChangingStatus] = useState<string | null>(null);
  const [deletingEvento, setDeletingEvento] = useState<string | null>(null);
  const [eventoToDelete, setEventoToDelete] = useState<Evento | null>(null);

  const carregarEventos = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('eventos-ligacao-proxy', {
        body: {
          action: 'listar',
          agente_id: agenteId,
          telefone: agenteTelefone
        }
      });

      if (error) {
        throw error;
      }

      console.log('Eventos carregados:', data);
      
      // Garantir que sempre temos um array
      const eventosArray = Array.isArray(data) ? data : (data?.eventos || [data]).filter(Boolean);
      setEventos(eventosArray);
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
      toast({
        title: "Erro ao carregar eventos",
        description: "Não foi possível buscar os eventos deste agente",
        variant: "destructive"
      });
      setEventos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (evento: Evento) => {
    try {
      setChangingStatus(evento.id_evento);
      
      const novoStatus = evento.evt_status === 'ativo' ? 'inativo' : 'ativo';
      
      const { error } = await supabase.functions.invoke('eventos-ligacao-proxy', {
        body: {
          action: 'mudar_status',
          id_evento: evento.id_evento,
          evt_status: novoStatus
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Status atualizado",
        description: `Evento ${novoStatus === 'ativo' ? 'ativado' : 'inativado'} com sucesso`
      });

      // Atualizar localmente
      setEventos(prev => prev.map(e => 
        e.id_evento === evento.id_evento 
          ? { ...e, evt_status: novoStatus }
          : e
      ));
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast({
        title: "Erro ao alterar status",
        description: "Não foi possível alterar o status do evento",
        variant: "destructive"
      });
    } finally {
      setChangingStatus(null);
    }
  };

  const handleDeleteEvento = async (evento: Evento) => {
    try {
      setDeletingEvento(evento.id_evento);
      
      const { error } = await supabase.functions.invoke('eventos-ligacao-proxy', {
        body: {
          action: 'deletar',
          id_evento: evento.id_evento
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Evento excluído",
        description: "O evento foi excluído com sucesso"
      });

      // Remover da lista local
      setEventos(prev => prev.filter(e => e.id_evento !== evento.id_evento));
      setEventoToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir evento:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o evento",
        variant: "destructive"
      });
    } finally {
      setDeletingEvento(null);
    }
  };

  useEffect(() => {
    if (agenteId) {
      carregarEventos();
    }
  }, [agenteId, agenteTelefone]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Eventos do Agente
            </CardTitle>
            <CardDescription className="mt-1">
              Gerencie os eventos de ligação vinculados a este agente
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={carregarEventos}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : eventos.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              Nenhum evento encontrado
            </h3>
            <p className="text-sm text-muted-foreground">
              Este agente ainda não possui eventos de ligação cadastrados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Evento</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Ativo/Inativo</TableHead>
                  {isAdminOrTI && (
                    <TableHead className="text-right">Ações</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventos.map((evento) => (
                  <TableRow key={evento.id_evento}>
                    <TableCell className="font-medium">
                      {evento.nome_evento || evento.titulo || `Evento ${evento.id_evento}`}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {evento.id_evento}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={evento.evt_status === 'ativo' ? 'default' : 'secondary'}
                        className={evento.evt_status === 'ativo' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                        }
                      >
                        {evento.evt_status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={evento.evt_status === 'ativo'}
                        onCheckedChange={() => handleToggleStatus(evento)}
                        disabled={changingStatus === evento.id_evento}
                      />
                    </TableCell>
                    {isAdminOrTI && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setEventoToDelete(evento)}
                          disabled={deletingEvento === evento.id_evento}
                        >
                          {deletingEvento === evento.id_evento ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Diálogo de confirmação para exclusão */}
        <AlertDialog open={!!eventoToDelete} onOpenChange={() => setEventoToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar Exclusão
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o evento{' '}
                <strong>"{eventoToDelete?.nome_evento || eventoToDelete?.titulo || eventoToDelete?.id_evento}"</strong>?
                <br /><br />
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={!!deletingEvento}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => eventoToDelete && handleDeleteEvento(eventoToDelete)}
                disabled={!!deletingEvento}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletingEvento ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir Evento
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
