import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { useToast } from "@/components/ui/use-toast";
import { Phone, ArrowRight, AlertCircle, UserCheck } from "lucide-react";
import { Contato } from "@/hooks/useContatoData";

interface NovoLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadCreated: () => void;
  onOpenContato: (contato: Contato) => void;
  profiles: { id: string; nome_completo: string; tipo_acesso: string | null; celular?: string | null; email?: string }[];
  /**
   * ID da prospecção (evento) ativa no contexto onde o modal foi aberto (ex.: filtro do Kanban).
   * Quando informado, o lead criado é vinculado a essa prospecção via edge `create-lead`.
   */
  activeProspeccaoId?: string;
}

type Step = 'phone' | 'form' | 'owner-message';

interface OwnerInfo {
  nome: string;
  contato: Contato;
  prospeccaoTitulo?: string | null;
}

export const NovoLeadModal = ({
  isOpen,
  onClose,
  onLeadCreated,
  onOpenContato,
  profiles,
  activeProspeccaoId,
}: NovoLeadModalProps) => {
  const [step, setStep] = useState<Step>('phone');
  const [telefone, setTelefone] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ownerInfo, setOwnerInfo] = useState<OwnerInfo | null>(null);
  
  // Form fields
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [origem, setOrigem] = useState<string>("Outros");
  const [observacoes, setObservacoes] = useState("");

  // Evento (prospecção) selecionado
  const [eventosDisponiveis, setEventosDisponiveis] = useState<Array<{ id: string; titulo: string }>>([]);
  const [selectedProspeccaoId, setSelectedProspeccaoId] = useState<string>("");
  const [eventosLoading, setEventosLoading] = useState(false);

  const { activeCompany } = useCompany();
  const { user } = useAuth();
  const { isAdmin, isGerente, isDiretor, isMasterRole, isTI } = useUserAccessType();
  const { toast } = useToast();
  const [eventoEncerradoAviso, setEventoEncerradoAviso] = useState<string | null>(null);
  const canSeeAllEventos = isAdmin || isGerente || isDiretor || isMasterRole || isTI;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStep('phone');
      setTelefone("");
      setOwnerInfo(null);
      setNome("");
      setEmail("");
      setOrigem("Outros");
      setObservacoes("");
      setEventoEncerradoAviso(null);
      setSelectedProspeccaoId("");
    }
  }, [isOpen]);

  // Carrega eventos ativos visíveis ao usuário
  useEffect(() => {
    if (!isOpen || !activeCompany?.id || !user?.id) return;
    let cancelled = false;

    (async () => {
      setEventosLoading(true);
      try {
        let eventos: Array<{ id: string; titulo: string }> = [];

        if (canSeeAllEventos) {
          const { data } = await supabase
            .from('prospeccoes')
            .select('id, titulo, ativo, encerrado_at')
            .eq('empresa_id', activeCompany.id)
            .eq('ativo', true)
            .is('encerrado_at', null)
            .order('created_at', { ascending: false });
          eventos = (data || []).map(p => ({ id: p.id, titulo: p.titulo || 'Sem título' }));
        } else {
          // SDR/Vendedor: somente eventos onde participa da equipe
          const { data } = await supabase
            .from('prospeccao_equipe_membros')
            .select(`
              prospeccao_equipes!inner (
                prospeccao_id,
                prospeccoes!inner ( id, titulo, ativo, encerrado_at, empresa_id )
              )
            `)
            .eq('user_id', user.id);

          const map = new Map<string, { id: string; titulo: string }>();
          for (const row of (data as any[]) || []) {
            const p = row?.prospeccao_equipes?.prospeccoes;
            if (
              p &&
              p.empresa_id === activeCompany.id &&
              p.ativo === true &&
              p.encerrado_at === null &&
              !map.has(p.id)
            ) {
              map.set(p.id, { id: p.id, titulo: p.titulo || 'Sem título' });
            }
          }
          eventos = Array.from(map.values());
        }

        if (cancelled) return;
        setEventosDisponiveis(eventos);

        // Pré-seleção
        if (activeProspeccaoId && eventos.some(e => e.id === activeProspeccaoId)) {
          setSelectedProspeccaoId(activeProspeccaoId);
        } else if (eventos.length === 1) {
          setSelectedProspeccaoId(eventos[0].id);
        } else {
          setSelectedProspeccaoId("");
        }
      } catch (err) {
        console.error('Erro ao carregar eventos disponíveis:', err);
      } finally {
        if (!cancelled) setEventosLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, activeCompany?.id, user?.id, activeProspeccaoId, canSeeAllEventos]);

  // Garante sessão válida antes do invoke sem derrubar o usuário por falha transitória de refresh.
  const ensureSession = async (): Promise<boolean> => {
    const { data: sessData } = await supabase.auth.getSession();
    const session = sessData?.session;

    if (session) {
      const expiresAt = (session.expires_at ?? 0) * 1000;
      const msLeft = expiresAt - Date.now();
      const secondsLeft = msLeft / 1000;

      if (secondsLeft >= 120) {
        return true;
      }

      if (secondsLeft > 0) {
        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
        if (!refreshErr && refreshed?.session) return true;

        console.warn('[NovoLeadModal] refreshSession falhou perto do vencimento; usando sessão atual ainda válida', {
          secondsLeft,
          refreshError: refreshErr?.message,
        });
        return true;
      }
    }

    const { data: lastTry, error: lastTryError } = await supabase.auth.refreshSession();
    if (lastTry?.session) return true;

    console.warn('[NovoLeadModal] sem sessão válida para criar lead', {
      refreshError: lastTryError?.message,
    });
    toast({
      title: "Sessão expirada",
      description: "Sua sessão expirou. Entre novamente e tente criar o lead de novo.",
      variant: "destructive",
    });
    return false;
  };

  const handleCheckPhone = async () => {
    if (!telefone.trim()) {
      toast({
        title: "Telefone obrigatório",
        description: "Por favor, informe o telefone do cliente.",
        variant: "destructive"
      });
      return;
    }

    if (!activeCompany?.id) {
      toast({
        title: "Erro",
        description: "Empresa não selecionada.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Checagem server-side com normalização canônica
      const { data: check, error: checkError } = await supabase.rpc('check_contato_by_telefone', {
        p_empresa_id: activeCompany.id,
        p_telefone: telefone,
      });

      if (checkError) throw checkError;

      const checkResult = (check ?? {}) as {
        exists?: boolean;
        contato_id?: string;
        nome?: string;
        telefone?: string;
        email?: string;
        status?: string;
        responsavel_email?: string | null;
        lead_id?: number;
      };

      if (checkResult.exists && checkResult.contato_id) {
        // Buscar dados completos para abrir no ContatoModal se necessário
        const { data: existingContato } = await supabase
          .from('contatos')
          .select('*')
          .eq('id', checkResult.contato_id)
          .single();

        if (!existingContato) {
          setStep('form');
          return;
        }
        // Lead já existe - verificar responsável
        if (existingContato.responsavel_email) {
          // Verificar se o responsável é o próprio usuário
          const isCurrentUser = 
            existingContato.responsavel_email === user?.id ||
            existingContato.responsavel_email === user?.email;
          
          if (isCurrentUser) {
            // Lead pertence ao usuário atual - abrir para edição
            onOpenContato(existingContato as Contato);
            onClose();
            return;
          }

          // Lead pertence a outro usuário - checar se há evento VIGENTE
          const { data: eventosVigentes } = await supabase
            .from('eventos_prospeccao')
            .select('prospeccao_id, prospeccoes:prospeccoes!prospeccao_id(id, titulo, encerrado_at, ativo)')
            .eq('contato_id', existingContato.id)
            .order('created_at', { ascending: false });

          const vigente = (eventosVigentes || [])
            .map(e => e.prospeccoes as { id: string; titulo: string | null; encerrado_at: string | null; ativo: boolean | null } | null)
            .find(p => p && p.encerrado_at === null && p.ativo === true);

          if (vigente) {
            // Bloqueia: lead em atendimento ativo por outro responsável
            const ownerProfile = profiles.find(p =>
              p.id === existingContato.responsavel_email ||
              p.email === existingContato.responsavel_email ||
              p.celular === existingContato.responsavel_email
            );
            setOwnerInfo({
              nome: ownerProfile?.nome_completo || existingContato.responsavel_email || 'Outro vendedor',
              contato: existingContato as Contato,
              prospeccaoTitulo: vigente.titulo ?? null,
            });
            setStep('owner-message');
            return;
          }

          // Evento anterior já encerrado: permite criar/atribuir ao usuário atual no novo contexto
          const ultimo = (eventosVigentes || [])
            .map(e => e.prospeccoes as { titulo: string | null } | null)
            .find(Boolean);
          setEventoEncerradoAviso(
            ultimo?.titulo
              ? `Este cliente esteve no evento encerrado "${ultimo.titulo}". Será atribuído a você no contexto atual.`
              : 'Este cliente já existia em evento encerrado. Será atribuído a você no contexto atual.'
          );
          setNome(existingContato.nome || '');
          setEmail(existingContato.email || '');
          setStep('form');
          return;
        }
        
        // Lead existe mas ninguém está atendendo - atribuir ao usuário atual
        const { error: updateError } = await supabase
          .from('contatos')
          .update({ responsavel_email: user?.id })
          .eq('id', existingContato.id);
        
        if (updateError) throw updateError;
        
        toast({
          title: "Lead atribuído a você",
          description: "Este cliente já existia no sistema e agora está sob sua responsabilidade.",
        });
        
        // Abrir contato para edição
        const updatedContato = { ...existingContato, responsavel_email: user?.id } as Contato;
        onOpenContato(updatedContato);
        onClose();
        return;
      }

      // Lead não existe - ir para formulário de criação
      setStep('form');
    } catch (error) {
      console.error('Erro ao verificar telefone:', error);
      toast({
        title: "Erro",
        description: "Erro ao verificar telefone. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLead = async () => {
    if (isSubmitting) return;

    if (!nome.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe o nome do cliente.",
        variant: "destructive"
      });
      return;
    }

    if (!activeCompany?.id) {
      toast({
        title: "Erro",
        description: "Empresa não selecionada.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedProspeccaoId) {
      toast({
        title: "Evento obrigatório",
        description: "Selecione o evento ao qual o lead será vinculado.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setLoading(true);

    // Refresh de sessão antes do invoke
    const ok = await ensureSession();
    if (!ok) {
      setIsSubmitting(false);
      setLoading(false);
      return;
    }

    try {
      const invokeBody = {
        nome: nome.trim(),
        telefone: telefone.trim(),
        email: email.trim() || null,
        origem: origem,
        observacoes: observacoes.trim() || null,
        responsavel_email: user?.id,
        empresa_id: activeCompany.id,
        status: 'Atribuído',
        prospeccao_id: selectedProspeccaoId,
      };

      let { data, error } = await supabase.functions.invoke('create-lead', { body: invokeBody });

      // Se 401, tenta refresh + 1 retry antes de tratar como sessão perdida
      if (error && (error as any).context?.status === 401) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed?.session) {
          const retry = await supabase.functions.invoke('create-lead', { body: invokeBody });
          data = retry.data;
          error = retry.error;
        }
      }

      // supabase.functions.invoke devolve `error` quando status >= 400.
      if (error) {
        // Tenta extrair o corpo da resposta
        const ctx: any = (error as any).context;
        const status = ctx?.status;
        let parsed: any = null;
        try {
          if (ctx && typeof ctx.json === 'function') parsed = await ctx.json();
          else if (ctx && typeof ctx.text === 'function') parsed = JSON.parse(await ctx.text());
        } catch (_) { /* ignore */ }

        if (status === 401) {
          console.warn('[NovoLeadModal] create-lead retornou 401 após retry');
          toast({
            title: "Sessão expirada",
            description: "Sua sessão expirou antes da criação do lead. Faça login novamente e tente de novo.",
            variant: "destructive",
          });
          return;
        }

        if (status === 409 && parsed?.lead_existente) {
          const le = parsed.lead_existente;
          const ownerProfile = profiles.find(p =>
            p.id === le.responsavel_email ||
            p.email === le.responsavel_email ||
            p.celular === le.responsavel_email
          );
          setOwnerInfo({
            nome: ownerProfile?.nome_completo || le.responsavel_email || 'Outro vendedor',
            contato: {
              id: le.contato_id,
              nome: le.nome,
              telefone: telefone,
              status: le.status,
            } as Contato,
            prospeccaoTitulo: le.evento_ativo?.prospeccao_titulo ?? null,
          });
          setStep('owner-message');
          return;
        }

        throw new Error(parsed?.error || error.message || 'Erro ao criar lead');
      }

      toast({
        title: "Lead criado",
        description: "O novo lead foi criado com sucesso.",
      });

      onLeadCreated();
      onClose();
    } catch (error) {
      console.error('Erro ao criar lead:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao criar lead. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            {step === 'phone' && 'Novo Lead'}
            {step === 'form' && 'Cadastrar Lead'}
            {step === 'owner-message' && 'Lead em Atendimento'}
          </DialogTitle>
        </DialogHeader>

        {step === 'phone' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone do Cliente</Label>
              <Input
                id="telefone"
                type="tel"
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCheckPhone()}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Informe o telefone para verificar se o cliente já está cadastrado
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleCheckPhone} disabled={loading}>
                {loading ? "Verificando..." : (
                  <>
                    Continuar
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'form' && (
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <span className="font-medium">Telefone:</span> {telefone}
              </p>
            </div>

            {eventoEncerradoAviso && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{eventoEncerradoAviso}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="evento">Evento *</Label>
              {eventosLoading ? (
                <p className="text-xs text-muted-foreground">Carregando eventos...</p>
              ) : eventosDisponiveis.length === 0 ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Você não está na equipe de nenhum evento ativo. Solicite ao gestor
                    que te adicione a um evento antes de cadastrar leads.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select value={selectedProspeccaoId} onValueChange={setSelectedProspeccaoId}>
                  <SelectTrigger id="evento">
                    <SelectValue placeholder="Selecione o evento" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventosDisponiveis.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.titulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Cliente *</Label>
              <Input
                id="nome"
                placeholder="Nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="origem">Origem</Label>
              <Select value={origem} onValueChange={setOrigem}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Site">Site</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="Facebook">Facebook</SelectItem>
                  <SelectItem value="Google">Google</SelectItem>
                  <SelectItem value="Indicação">Indicação</SelectItem>
                  <SelectItem value="Telefone">Telefone</SelectItem>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Input
                id="observacoes"
                placeholder="Observações opcionais"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('phone')}>
                Voltar
              </Button>
              <Button
                onClick={handleCreateLead}
                disabled={isSubmitting || loading || eventosDisponiveis.length === 0 || !selectedProspeccaoId}
              >
                {isSubmitting ? "Criando..." : "Criar Lead"}
              </Button>
            </div>
          </div>
        )}

        {step === 'owner-message' && ownerInfo && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Este lead já está sendo atendido por <strong>{ownerInfo.nome}</strong>
                {ownerInfo.prospeccaoTitulo ? <> no evento <strong>{ownerInfo.prospeccaoTitulo}</strong></> : null}.
                {" "}Solicite ao gerente a transferência.
              </AlertDescription>
            </Alert>

            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Informações do Lead</span>
              </div>
              <div className="text-sm space-y-1 pl-7">
                <p><span className="text-muted-foreground">Nome:</span> {ownerInfo.contato.nome}</p>
                <p><span className="text-muted-foreground">Telefone:</span> {ownerInfo.contato.telefone}</p>
                <p><span className="text-muted-foreground">Status:</span> {ownerInfo.contato.status}</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={onClose}>
                Entendi
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
