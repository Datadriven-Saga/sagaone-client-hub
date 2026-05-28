import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { Phone, CheckCircle, XCircle, PhoneOff, MessageSquare } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import { ScrollIndicator } from '@/components/ui/scroll-indicator';
import { setContatoStatus } from '@/lib/contatoStatusApi';

interface MotivoInsucesso {
  id: string;
  descricao: string;
}

interface ContatoRealizadoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contatoId: string;
  prospeccaoId: string;
  onSuccess?: (novoStatus: string) => void;
}

type TipoContato = 'vai_participar' | 'registrar_contato' | 'tentativa_sem_sucesso' | 'nao_vai_participar' | 'opt_out';

export function ContatoRealizadoDialog({
  isOpen,
  onClose,
  contatoId,
  prospeccaoId,
  onSuccess
}: ContatoRealizadoDialogProps) {
  const { activeCompany } = useCompany();
  const [tipoContato, setTipoContato] = useState<TipoContato | ''>('');
  const [motivoId, setMotivoId] = useState<string>('');
  const [anotacao, setAnotacao] = useState('');
  const [motivos, setMotivos] = useState<MotivoInsucesso[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMotivos, setLoadingMotivos] = useState(true);
  const { toast } = useToast();
  const anotacaoRef = useRef<HTMLTextAreaElement>(null);

  const handleTipoContatoChange = (value: TipoContato) => {
    setTipoContato(value);
    // Focar no campo de anotação após selecionar uma opção
    setTimeout(() => {
      anotacaoRef.current?.focus();
    }, 100);
  };

  useEffect(() => {
    const fetchMotivos = async () => {
      if (!isOpen || !activeCompany?.id) return;
      
      setLoadingMotivos(true);
      try {
        // Buscar motivos de insucesso da empresa
        const { data, error } = await supabase
          .from('motivos_insucesso')
          .select('id, descricao')
          .eq('empresa_id', activeCompany.id)
          .eq('ativo', true)
          .order('ordem');

        if (error) throw error;
        setMotivos(data || []);
      } catch (error) {
        console.error('Erro ao buscar motivos:', error);
      } finally {
        setLoadingMotivos(false);
      }
    };

    fetchMotivos();
  }, [isOpen, activeCompany?.id]);

  const handleSubmit = async () => {
    if (!tipoContato) {
      toast({
        title: "Selecione uma opção",
        description: "Escolha o tipo de contato realizado",
        variant: "destructive"
      });
      return;
    }

    if (tipoContato === 'registrar_contato' && !anotacao.trim()) {
      toast({
        title: "Anotação obrigatória",
        description: "Detalhe o contato realizado",
        variant: "destructive"
      });
      return;
    }

    if (tipoContato === 'nao_vai_participar' && !motivoId) {
      toast({
        title: "Motivo obrigatório",
        description: "Selecione o motivo da não participação",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Montar a descrição da anotação
      const tipoDescricao: Record<TipoContato, string> = {
        vai_participar: '✅ CLIENTE VAI PARTICIPAR',
        registrar_contato: '📞 CONTATO REALIZADO',
        tentativa_sem_sucesso: '📵 TENTATIVA SEM SUCESSO',
        nao_vai_participar: '❌ CLIENTE NÃO VAI PARTICIPAR',
        opt_out: '🔕 OPT OUT SOLICITADO',
      };

      const anotacaoTrim = anotacao.trim();
      let descricaoCompleta = anotacaoTrim
        ? `${tipoDescricao[tipoContato]}\n\n${anotacaoTrim}`
        : tipoDescricao[tipoContato];

      // Se não vai participar, adicionar o motivo
      if (tipoContato === 'nao_vai_participar' && motivoId) {
        const motivoSelecionado = motivos.find(m => m.id === motivoId);
        if (motivoSelecionado) {
          descricaoCompleta += `\n\nMotivo: ${motivoSelecionado.descricao}`;
        }
      }

      // Salvar anotação via edge function
      const { error } = await supabase.functions.invoke('prospeccao-anotacao', {
        body: {
          prospeccao_id: prospeccaoId,
          contato_id: contatoId,
          mensagem: descricaoCompleta
        }
      });

      // Atualizar status do contato baseado no tipo de contato
      type StatusLead = Database['public']['Enums']['status_lead'];
      
      let novoStatus: StatusLead | null = null;
      
      if (tipoContato === 'vai_participar') {
        novoStatus = 'Convidado';
      } else if (tipoContato === 'registrar_contato') {
        novoStatus = 'Em Espera';
      } else if (tipoContato === 'tentativa_sem_sucesso') {
        novoStatus = 'Em Espera';
      } else if (tipoContato === 'nao_vai_participar') {
        novoStatus = 'Descartado';
      } else if (tipoContato === 'opt_out') {
        novoStatus = 'Opt Out';
      }

      if (novoStatus) {
        const statusResult = await setContatoStatus({
          contatoId,
          novoStatus,
          prospeccaoId,
          observacoes: descricaoCompleta,
          webhookKind: 'atualizacao_status',
        });

        if (!statusResult.ok) {
          console.error('Erro ao atualizar status:', statusResult.error);
          toast({
            title: "Erro ao atualizar status",
            description: statusResult.error ?? "Tente novamente.",
            variant: "destructive",
          });
          return;
        }
      }

      if (error) throw error;

      toast({
        title: "Contato registrado",
        description: "O contato foi registrado com sucesso"
      });

      // Reset form
      setTipoContato('');
      setMotivoId('');
      setAnotacao('');
      
      // Chamar onSuccess com o novo status para atualizar a UI
      if (novoStatus) {
        onSuccess?.(novoStatus);
      }
      onClose();
    } catch (error) {
      console.error('Erro ao registrar contato:', error);
      toast({
        title: "Erro",
        description: "Erro ao registrar contato. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTipoContato('');
    setMotivoId('');
    setAnotacao('');
    onClose();
  };

  const opcoes = [
    {
      value: 'vai_participar' as TipoContato,
      label: 'O cliente VAI PARTICIPAR',
      description: 'O cliente confirmou presença no evento',
      icon: CheckCircle,
      color: 'text-green-600'
    },
    {
      value: 'registrar_contato' as TipoContato,
      label: 'Registrar apenas contato',
      description: 'Contato realizado, sem definição ainda',
      icon: MessageSquare,
      color: 'text-blue-600'
    },
    {
      value: 'tentativa_sem_sucesso' as TipoContato,
      label: 'Tentativa sem sucesso',
      description: 'Não conseguiu contato (não atendeu, caixa postal, etc)',
      icon: PhoneOff,
      color: 'text-amber-600'
    },
    {
      value: 'nao_vai_participar' as TipoContato,
      label: 'O cliente NÃO VAI PARTICIPAR',
      description: 'Cliente informou que não participará',
      icon: XCircle,
      color: 'text-red-600'
    },
    {
      value: 'opt_out' as TipoContato,
      label: 'O cliente solicitou Opt Out',
      description: 'O cliente deixou explícito que não deseja mais contatos desse tipo',
      icon: XCircle,
      color: 'text-gray-600'
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl h-[85vh] max-h-[680px] flex flex-col p-0 gap-0">
        {/* Header fixo */}
        <DialogHeader className="px-6 py-5 border-b flex-shrink-0 bg-background">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-full bg-primary/10">
              <Phone className="w-5 h-5 text-primary" />
            </div>
            Contato Realizado
          </DialogTitle>
          <DialogDescription className="text-[15px] mt-1">
            Registre o resultado do contato com o cliente
          </DialogDescription>
        </DialogHeader>

        {/* Conteúdo com scroll */}
        <ScrollIndicator className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Coluna Esquerda - Resultado do Contato */}
              <div className="space-y-4">
                <Label className="text-base font-semibold text-foreground">
                  Resultado do Contato
                </Label>
                <RadioGroup
                  value={tipoContato}
                  onValueChange={(value) => handleTipoContatoChange(value as TipoContato)}
                  className="space-y-3"
                >
                  {opcoes.map((opcao) => {
                    const Icon = opcao.icon;
                    const isSelected = tipoContato === opcao.value;
                    return (
                      <div
                        key={opcao.value}
                        className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                          isSelected 
                            ? 'border-primary bg-primary/5 shadow-sm' 
                            : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
                        }`}
                        onClick={() => handleTipoContatoChange(opcao.value)}
                      >
                        <RadioGroupItem 
                          value={opcao.value} 
                          id={opcao.value} 
                          className="h-5 w-5 border-2"
                        />
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-background' : 'bg-muted/50'}`}>
                          <Icon className={`w-5 h-5 ${opcao.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor={opcao.value}
                            className="block text-[15px] font-medium cursor-pointer leading-tight"
                          >
                            {opcao.label}
                          </label>
                          <p className="text-sm text-foreground/60 mt-0.5 leading-snug">
                            {opcao.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </RadioGroup>

                {/* Motivo de Insucesso */}
                {tipoContato === 'nao_vai_participar' && (
                  <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Label className="text-base font-semibold text-foreground">
                      Motivo de Insucesso *
                    </Label>
                    <Select value={motivoId} onValueChange={setMotivoId}>
                      <SelectTrigger className="h-12 text-[15px]">
                        <SelectValue placeholder="Selecione o motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingMotivos ? (
                          <SelectItem value="loading" disabled>
                            Carregando...
                          </SelectItem>
                        ) : (
                          motivos.map((motivo) => (
                            <SelectItem 
                              key={motivo.id} 
                              value={motivo.id}
                              className="text-[15px] py-3"
                            >
                              {motivo.descricao}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Coluna Direita - Anotações */}
              <div className="space-y-3">
                <Label className="text-base font-semibold text-foreground">
                  Anotações *
                </Label>
                <Textarea
                  ref={anotacaoRef}
                  placeholder="Descreva os detalhes do contato realizado..."
                  value={anotacao}
                  onChange={(e) => setAnotacao(e.target.value)}
                  className="min-h-[280px] text-[15px] leading-relaxed resize-none rounded-xl"
                  maxLength={500}
                />
                <p className="text-sm text-foreground/50 text-right">
                  {anotacao.length}/500 caracteres
                </p>
              </div>
            </div>
          </div>
        </ScrollIndicator>

        {/* Footer fixo */}
        <DialogFooter className="px-6 py-4 border-t flex-shrink-0 bg-background gap-3">
          <Button 
            variant="outline" 
            onClick={handleClose} 
            disabled={loading}
            className="h-11 px-6 text-[15px]"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !tipoContato}
            className="h-11 px-6 text-[15px] min-w-[160px]"
          >
            {loading ? "Registrando..." : "Registrar Contato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
