import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, PhoneCall, UserPlus, RefreshCw, CheckCircle, Calendar } from "lucide-react";
import { usePriLigacaoEventos } from "@/hooks/usePriLigacaoEventos";

interface ContatoTeste {
  id: string;
  nome: string;
  telefone: string;
}

interface EventoPriVoz {
  id: string;
  id_evento: number;
  nome: string;
  data_inicio?: string;
  data_fim?: string;
  evt_status?: string;
}

interface AgenteTestarProps {
  telefonePri: string;
  dealerId?: string;
  empresaId?: string;
  agenteNome?: string;
}

export function AgenteTestar({ telefonePri, dealerId, empresaId, agenteNome }: AgenteTestarProps) {
  const { toast } = useToast();
  const [contatos, setContatos] = useState<ContatoTeste[]>([
    { id: crypto.randomUUID(), nome: "", telefone: "" }
  ]);
  const [confirmando, setConfirmando] = useState(false);
  const [disparando, setDisparando] = useState(false);
  const [baseConfirmada, setBaseConfirmada] = useState(false);
  const [eventoSelecionado, setEventoSelecionado] = useState<string>("");

  const {
    data: eventosData = [],
    isLoading: loadingEventos,
  } = usePriLigacaoEventos(telefonePri);

  const eventos = useMemo<EventoPriVoz[]>(() => {
    return (eventosData || []).map((evt: any) => {
      const rawStatus = evt?.evt_status ?? evt?.status;
      const isAtivo = rawStatus === true || String(rawStatus).toLowerCase() === "ativo";
      return {
        id: String(evt.id_evento || evt.id),
        id_evento: evt.id_evento || evt.id,
        nome: evt.nome || evt.name || `Evento ${evt.id_evento}`,
        data_inicio: evt.data_inicio || evt.start_date,
        data_fim: evt.data_fim || evt.end_date,
        evt_status: isAtivo ? "ativo" : "inativo",
      };
    });
  }, [eventosData]);

  useEffect(() => {
    if (eventoSelecionado) return;
    if (eventos.length === 0) return;

    const eventoAtivo = eventos.find((e) => e.evt_status === "ativo");
    setEventoSelecionado((eventoAtivo || eventos[0]).id);
  }, [eventos, eventoSelecionado]);

  const adicionarContato = () => {
    setContatos(prev => [...prev, { id: crypto.randomUUID(), nome: "", telefone: "" }]);
  };

  const removerContato = (id: string) => {
    if (contatos.length > 1) {
      setContatos(prev => prev.filter(c => c.id !== id));
    }
  };

  const atualizarContato = (id: string, campo: "nome" | "telefone", valor: string) => {
    setContatos(prev => prev.map(c => 
      c.id === id ? { ...c, [campo]: valor } : c
    ));
  };

  const validarContatos = (): boolean => {
    const contatosValidos = contatos.filter(c => c.nome.trim() && c.telefone.trim());
    if (contatosValidos.length === 0) {
      toast({
        title: "Dados incompletos",
        description: "Preencha pelo menos um contato com nome e telefone",
        variant: "destructive"
      });
      return false;
    }
    return true;
  };

  const handleConfirmar = async () => {
    if (!validarContatos()) return;

    const contatosParaEnviar = contatos
      .filter(c => c.nome.trim() && c.telefone.trim())
      .map(c => ({ nome: c.nome.trim(), telefone: c.telefone.trim() }));

    if (!eventoSelecionado) {
      toast({
        title: "Evento obrigatório",
        description: "Selecione um evento para realizar o teste",
        variant: "destructive"
      });
      return;
    }

    const eventoEscolhido = eventos.find(e => e.id === eventoSelecionado);
    if (!eventoEscolhido) {
      toast({
        title: "Erro",
        description: "Evento selecionado não encontrado",
        variant: "destructive"
      });
      return;
    }

    setConfirmando(true);

    try {
      // Usar create-base-ligacao diretamente com o id_evento real do evento selecionado
      const payload: Record<string, any> = {
        contatos: contatosParaEnviar.map(c => ({
          nome: c.nome,
          telefone: c.telefone.replace(/\D/g, ''),
        })),
        id_evento: eventoEscolhido.id_evento,
        telefone_pri: telefonePri.replace(/\D/g, ''),
        loja: agenteNome || 'Teste Rápido',
        sync_external: true, // Sincronizar com sistema externo usando evento real
      };
      
      // Só incluir empresa_id se existir
      if (empresaId) {
        payload.empresa_id = empresaId;
      }
      
      const { data, error } = await supabase.functions.invoke('create-base-ligacao', {
        body: payload,
      });

      if (error) throw error;

      console.log("Resposta create-base-ligacao:", data);

      // Verificar se houve sucesso
      if (data?.success) {
        const syncStatus = data.external_sync?.success ? "e sincronizada externamente" : "(apenas local)";
        toast({
          title: "Base criada com sucesso!",
          description: `${data.summary?.supabase_salvos || contatosParaEnviar.length} contato(s) preparado(s) ${syncStatus}`,
        });
        setBaseConfirmada(true);
      } else {
        throw new Error(data?.error || "Falha ao criar base");
      }
    } catch (error: any) {
      console.error("Erro ao criar base:", error);
      toast({
        title: "Erro ao criar base",
        description: error.message || "Falha ao enviar contatos",
        variant: "destructive"
      });
    } finally {
      setConfirmando(false);
    }
  };

  // Função para normalizar telefone para 10 dígitos (sem o 9 inicial)
  const normalizePhoneTo10Digits = (phone: string): string => {
    let digits = phone.replace(/\D/g, '');
    
    // Remove DDI 55 se existir
    if (digits.startsWith('55') && digits.length > 11) {
      digits = digits.slice(2);
    }
    
    // Se tem 11 dígitos e o 3º é 9, remove o 9
    if (digits.length === 11 && digits[2] === '9') {
      digits = digits.slice(0, 2) + digits.slice(3);
    }
    
    return digits;
  };

  const handleDisparar = async () => {
    const contatosParaEnviar = contatos
      .filter(c => c.nome.trim() && c.telefone.trim())
      .map(c => ({ 
        nome: c.nome.trim(), 
        telefone_lead: normalizePhoneTo10Digits(c.telefone) 
      }));

    if (contatosParaEnviar.length === 0) {
      toast({
        title: "Sem contatos",
        description: "Adicione pelo menos um contato antes de disparar",
        variant: "destructive"
      });
      return;
    }

    if (!telefonePri) {
      toast({
        title: "Erro",
        description: "Telefone PRI não configurado para este agente",
        variant: "destructive"
      });
      return;
    }

    if (!eventoSelecionado) {
      toast({
        title: "Evento obrigatório",
        description: "Selecione um evento para disparar a ligação",
        variant: "destructive"
      });
      return;
    }

    const eventoEscolhido = eventos.find(e => e.id === eventoSelecionado);
    if (!eventoEscolhido) {
      toast({
        title: "Erro",
        description: "Evento selecionado não encontrado",
        variant: "destructive"
      });
      return;
    }

    setDisparando(true);

    try {
      // Chamar o webhook dispara-ligacao via proxy com o id_evento real e telefone_lead
      const { data, error } = await supabase.functions.invoke('external-webhook-proxy', {
        body: {
          endpoint: 'dispara-ligacao',
          telefone_pri: telefonePri.replace(/\D/g, ''),
          id_evento: eventoEscolhido.id_evento,
          contatos: contatosParaEnviar,
        },
      });

      if (error) throw error;

      console.log("Resposta dispara-ligacao:", data);

      // A resposta é assíncrona, então mostramos sucesso imediato
      toast({
        title: "Disparo iniciado!",
        description: data?.message || `Ligação para ${contatosParaEnviar.length} contato(s) será realizada em instantes`,
      });

    } catch (error: any) {
      console.error("Erro ao disparar ligações:", error);
      toast({
        title: "Erro ao disparar",
        description: error.message || "Falha ao iniciar ligações",
        variant: "destructive"
      });
    } finally {
      setDisparando(false);
    }
  };

  const limparFormulario = () => {
    setContatos([{ id: crypto.randomUUID(), nome: "", telefone: "" }]);
    setBaseConfirmada(false);
  };

  const contatosPreenchidos = contatos.filter(c => c.nome.trim() && c.telefone.trim()).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-primary" />
            Teste Rápido de Ligação
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Adicione contatos para testar a ligação rapidamente
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={limparFormulario}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Limpar
        </Button>
      </div>

      {/* Seletor de Evento */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Evento para Teste
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingEventos ? (
            <div className="text-sm text-muted-foreground">Carregando eventos...</div>
          ) : eventos.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Nenhum evento encontrado para esta empresa. Crie um evento de IA Ligação primeiro.
            </div>
          ) : (
            <Select value={eventoSelecionado} onValueChange={setEventoSelecionado}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um evento" />
              </SelectTrigger>
              <SelectContent>
                {eventos.map((evento) => (
                  <SelectItem key={evento.id} value={evento.id}>
                    <div className="flex items-center gap-2">
                      <span>{evento.nome}</span>
                      <Badge 
                        variant={evento.evt_status === 'ativo' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {evento.evt_status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        (ID: {evento.id_evento})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Info do Agente */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="py-4">
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <div>
              <span className="text-muted-foreground">Agente:</span>{" "}
              <span className="font-medium">{agenteNome || "Pri(Ligação)"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Telefone PRI:</span>{" "}
              <span className="font-mono font-medium">{telefonePri || "N/A"}</span>
            </div>
            {dealerId && (
              <div>
                <span className="text-muted-foreground">Dealer ID:</span>{" "}
                <span className="font-mono">{dealerId}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de Contatos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Contatos para Teste
              {contatosPreenchidos > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {contatosPreenchidos} preenchido(s)
                </Badge>
              )}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={adicionarContato}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {contatos.map((contato, index) => (
            <div key={contato.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full text-sm font-medium text-primary">
                {index + 1}
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`nome-${contato.id}`} className="text-xs text-muted-foreground">
                    Nome
                  </Label>
                  <Input
                    id={`nome-${contato.id}`}
                    value={contato.nome}
                    onChange={(e) => atualizarContato(contato.id, "nome", e.target.value)}
                    placeholder="Nome do contato"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor={`telefone-${contato.id}`} className="text-xs text-muted-foreground">
                    Telefone
                  </Label>
                  <Input
                    id={`telefone-${contato.id}`}
                    value={contato.telefone}
                    onChange={(e) => atualizarContato(contato.id, "telefone", e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="mt-1"
                  />
                </div>
              </div>
              {contatos.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removerContato(contato.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Botões de Ação */}
      <div className="flex items-center gap-4 pt-4 border-t">
        <Button 
          onClick={handleConfirmar}
          disabled={confirmando || contatosPreenchidos === 0}
          className="flex-1"
          variant={baseConfirmada ? "outline" : "default"}
        >
          {confirmando ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Criando base...
            </>
          ) : baseConfirmada ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
              Base Confirmada
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar Base
            </>
          )}
        </Button>

        <Button 
          onClick={handleDisparar}
          disabled={disparando || contatosPreenchidos === 0}
          className="flex-1"
          variant="default"
        >
          {disparando ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Disparando...
            </>
          ) : (
            <>
              <PhoneCall className="h-4 w-4 mr-2" />
              Disparar Ligação
            </>
          )}
        </Button>
      </div>

      {/* Dica */}
      <p className="text-xs text-muted-foreground text-center">
        💡 Você pode confirmar a base primeiro ou disparar diretamente. O disparo também cria a base automaticamente se necessário.
      </p>
    </div>
  );
}
