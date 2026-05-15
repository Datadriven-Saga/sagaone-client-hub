import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Image, 
  Building, 
  CalendarDays, 
  MapPin, 
  QrCode, 
  User, 
  UserCheck, 
  Save,
  Loader2,
  RefreshCw,
  Download,
  Send,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { Contato } from '@/hooks/useContatoData';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import QRCodeLib from 'qrcode';
import html2canvas from 'html2canvas';
import { montarMensagemConvite, montarUrlWhatsapp } from '@/lib/conviteUtils';

interface ConviteTabProps {
  contato: Contato;
  prospeccaoId: string;
  onStatusChange?: (contatoId: string, novoStatus: Contato['status']) => void;
}

interface ProspeccaoData {
  id: string;
  titulo: string;
  data_inicio: string | null;
  data_fim: string | null;
  empresa_id: string;
  imagem_divulgacao_url?: string | null;
  texto_convite_template?: string | null;
}

interface EmpresaData {
  id: string;
  nome_empresa: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
}

interface ContatoExtended extends Contato {
  qr_token?: string | null;
  qr_token_used?: boolean;
  vendedor_nome?: string | null;
}

export function ConviteTab({ contato, prospeccaoId, onStatusChange }: ConviteTabProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const { isEnabledForEmpresa } = useFeatureFlags();
  const [confirmacaoFlagAtiva, setConfirmacaoFlagAtiva] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingQR, setGeneratingQR] = useState(false);
  const [prospeccao, setProspeccao] = useState<ProspeccaoData | null>(null);
  const [empresa, setEmpresa] = useState<EmpresaData | null>(null);
  const [conviteImagem, setConviteImagem] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [vendedorNome, setVendedorNome] = useState<string>('');
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrTokenUsed, setQrTokenUsed] = useState<boolean>(false);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);
  const [confirmationSentAt, setConfirmationSentAt] = useState<string | null>(null);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  // Carregar feature flag por empresa
  useEffect(() => {
    if (!activeCompany?.id) {
      setConfirmacaoFlagAtiva(false);
      return;
    }
    isEnabledForEmpresa('confirmacao_presenca_whatsapp', activeCompany.id)
      .then(setConfirmacaoFlagAtiva)
      .catch(() => setConfirmacaoFlagAtiva(false));
  }, [activeCompany?.id, isEnabledForEmpresa]);
  
  // QR Code state
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  
  // Refs para download
  const kvRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const conviteRef = useRef<HTMLDivElement>(null);
  const allCardsRef = useRef<HTMLDivElement>(null);

  // Buscar dados ao montar
  useEffect(() => {
    const fetchData = async () => {
      if (!activeCompany?.id) return;
      
      setLoading(true);
      try {
        let currentProspeccaoId = prospeccaoId;
        
        // Se não tem prospeccaoId, buscar a prospecção ativa da empresa
        if (!currentProspeccaoId) {
          const { data: prospeccaoAtiva } = await supabase
            .from('prospeccoes')
            .select('id')
            .eq('empresa_id', activeCompany.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (prospeccaoAtiva) {
            currentProspeccaoId = prospeccaoAtiva.id;
          }
        }

        // Buscar dados da prospecção (incluindo imagem_divulgacao_url)
        if (currentProspeccaoId) {
          const { data: prospeccaoData, error: prospeccaoError } = await supabase
            .from('prospeccoes')
            .select('id, titulo, data_inicio, data_fim, empresa_id, imagem_divulgacao_url, texto_convite_template')
            .eq('id', currentProspeccaoId)
            .single();
          
          if (!prospeccaoError && prospeccaoData) {
            setProspeccao(prospeccaoData);
            // Usar imagem_divulgacao_url da prospecção se disponível
            if (prospeccaoData.imagem_divulgacao_url) {
              setConviteImagem(prospeccaoData.imagem_divulgacao_url);
            }
          }
        }
        
        // Buscar dados da empresa
        const empresaId = prospeccao?.empresa_id || activeCompany.id;
        if (empresaId) {
          const { data: empresaData, error: empresaError } = await supabase
            .from('empresas')
            .select('id, nome_empresa, uf')
            .eq('id', empresaId)
            .single();
          
          if (!empresaError && empresaData) {
            setEmpresa(empresaData);
          }
        }
        
        // Buscar imagem do convite (apenas se não tiver imagem_divulgacao_url)
        const conviteProspeccaoId = currentProspeccaoId || prospeccaoId;
        if (conviteProspeccaoId && !conviteImagem) {
          const { data: conviteData, error: conviteError } = await supabase
            .from('prospeccao_convites')
            .select('imagem_url')
            .eq('prospeccao_id', conviteProspeccaoId)
            .maybeSingle();
        
          if (!conviteError && conviteData?.imagem_url) {
            setConviteImagem(conviteData.imagem_url);
          }
        }
        
        // Buscar nome do usuário atual (quem convidou)
        let currentUserName = '';
        if (user?.id) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('nome_completo')
            .eq('id', user.id)
            .single();
          
          if (profileData?.nome_completo) {
            currentUserName = profileData.nome_completo;
            setUserName(profileData.nome_completo);
          }
        }

        // Buscar dados do contato (qr_token + responsável)
        const { data: contatoData } = await supabase
          .from('contatos')
          .select('qr_token, qr_token_used, vendedor_nome, responsavel_email, confirmed_at')
          .eq('id', contato.id)
          .single();

        // Buscar token de confirmação do vínculo contato+evento (eventos_prospeccao)
        let vinculoData: { confirmation_token: string | null; confirmation_sent_at: string | null } | null = null;
        if (currentProspeccaoId) {
          const { data } = await supabase
            .from('eventos_prospeccao')
            .select('confirmation_token, confirmation_sent_at')
            .eq('contato_id', contato.id)
            .eq('prospeccao_id', currentProspeccaoId)
            .maybeSingle();
          vinculoData = data ?? null;
        }

        let currentVendedorNome = '';
        if (contatoData) {
          setQrToken(contatoData.qr_token);
          setQrTokenUsed(contatoData.qr_token_used || false);
          setConfirmationToken(vinculoData?.confirmation_token ?? null);
          setConfirmationSentAt(vinculoData?.confirmation_sent_at ?? null);
          setConfirmedAt(contatoData.confirmed_at ?? null);
          currentVendedorNome = contatoData.vendedor_nome || '';
          setVendedorNome(contatoData.vendedor_nome || '');

          // Se tem responsavel_email, buscar nome do vendedor
          if (contatoData.responsavel_email && !contatoData.vendedor_nome) {
            const { data: vendedorData } = await supabase
              .from('profiles')
              .select('nome_completo')
              .ilike('id', `%${contatoData.responsavel_email}%`)
              .maybeSingle();
            
            if (vendedorData?.nome_completo) {
              currentVendedorNome = vendedorData.nome_completo;
              setVendedorNome(vendedorData.nome_completo);
            }
          }

          // Se já tem qr_token, gerar URL do QR Code
          if (contatoData.qr_token) {
            const qrData = JSON.stringify({
              qr_token: contatoData.qr_token,
              convidado_nome: contato.nome,
              convidado_telefone: contato.telefone || '',
              quem_convidou: currentVendedorNome || currentUserName,
              vendedor: currentVendedorNome || currentUserName,
              evento_id: currentProspeccaoId || '',
              evento_nome: prospeccao?.titulo || ''
            });
            try {
              const dataUrl = await QRCodeLib.toDataURL(qrData, { width: 300, margin: 2 });
              setQrCodeUrl(dataUrl);
            } catch (err) {
              console.error('Erro ao gerar QR Code:', err);
            }
          } else {
            // Se não tem qr_token, gerar automaticamente
            const newToken = crypto.randomUUID();
            const { error: updateError } = await supabase
              .from('contatos')
              .update({
                qr_token: newToken,
                qr_token_used: false,
                vendedor_nome: currentVendedorNome || currentUserName,
                updated_at: new Date().toISOString()
              })
              .eq('id', contato.id);

            if (!updateError) {
              setQrToken(newToken);
              const qrData = JSON.stringify({
                qr_token: newToken,
                convidado_nome: contato.nome,
                convidado_telefone: contato.telefone || '',
                quem_convidou: currentVendedorNome || currentUserName,
                vendedor: currentVendedorNome || currentUserName,
                evento_id: currentProspeccaoId || '',
                evento_nome: prospeccao?.titulo || ''
              });
              try {
                const dataUrl = await QRCodeLib.toDataURL(qrData, { width: 300, margin: 2 });
                setQrCodeUrl(dataUrl);
              } catch (err) {
                console.error('Erro ao gerar QR Code:', err);
              }
            }
          }
        }
        
      } catch (error) {
        console.error('Erro ao carregar dados do convite:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os dados do convite',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [prospeccaoId, activeCompany?.id, user?.id, contato.id]);

  // Gerar URL do QR Code a partir do token
  const generateQRCodeUrl = async (token: string) => {
    const qrData = JSON.stringify({
      qr_token: token,
      convidado_nome: contato.nome,
      convidado_telefone: contato.telefone || '',
      quem_convidou: vendedorNome || userName,
      vendedor: vendedorNome || userName,
      evento_id: prospeccao?.id || '',
      evento_nome: prospeccao?.titulo || ''
    });
    
    try {
      const dataUrl = await QRCodeLib.toDataURL(qrData, { width: 300, margin: 2 });
      setQrCodeUrl(dataUrl);
    } catch (err) {
      console.error('Erro ao gerar QR Code:', err);
    }
  };

  // Gerar novo QR Token
  const handleGenerateQRCode = async () => {
    setGeneratingQR(true);
    try {
      // Gerar UUID único
      const newToken = crypto.randomUUID();
      
      // Salvar no banco
      const { error } = await supabase
        .from('contatos')
        .update({
          qr_token: newToken,
          qr_token_used: false,
          qr_token_used_at: null,
          vendedor_nome: vendedorNome || userName,
          updated_at: new Date().toISOString()
        })
        .eq('id', contato.id);

      if (error) throw error;

      setQrToken(newToken);
      setQrTokenUsed(false);
      
      // Gerar URL do QR Code
      const qrData = JSON.stringify({
        qr_token: newToken,
        convidado_nome: contato.nome,
        convidado_telefone: contato.telefone || '',
        quem_convidou: vendedorNome || userName,
        vendedor: vendedorNome || userName,
        evento_id: prospeccao?.id || '',
        evento_nome: prospeccao?.titulo || ''
      });
      
      try {
        const dataUrl = await QRCodeLib.toDataURL(qrData, { width: 300, margin: 2 });
        setQrCodeUrl(dataUrl);
      } catch (err) {
        console.error('Erro ao gerar QR Code:', err);
      }

      toast({
        title: 'QR Code gerado!',
        description: 'O QR Code foi gerado com sucesso. Envie para o cliente.'
      });
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível gerar o QR Code',
        variant: 'destructive'
      });
    } finally {
      setGeneratingQR(false);
    }
  };

  // Função para fazer check-in do lead (alterar status para Checkin)
  const handleCheckin = async () => {
    if (!contato || !onStatusChange) return;
    
    try {
      onStatusChange(contato.id, 'Check-in');
      toast({
        title: 'Check-in realizado',
        description: 'O status do lead foi alterado para Check-in'
      });
    } catch (error) {
      console.error('Erro ao fazer check-in:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível realizar o check-in',
        variant: 'destructive'
      });
    }
  };

  // Reenviar convite via WhatsApp (gera token se necessário)
  const handleReenviarConfirmacao = async () => {
    if (!contato.telefone) {
      toast({
        title: 'Sem telefone',
        description: 'Este contato não possui telefone cadastrado.',
        variant: 'destructive',
      });
      return;
    }
    setResending(true);
    try {
      if (!prospeccaoId) {
        toast({ title: 'Erro', description: 'Evento não identificado.', variant: 'destructive' });
        return;
      }
      let token = confirmationToken;
      if (!token) {
        // Token nasce com default na linha de eventos_prospeccao; busca/garante.
        const { data: vinc } = await supabase
          .from('eventos_prospeccao')
          .select('confirmation_token')
          .eq('contato_id', contato.id)
          .eq('prospeccao_id', prospeccaoId)
          .maybeSingle();
        token = vinc?.confirmation_token ?? null;
        if (!token) {
          token = crypto.randomUUID();
          const { error } = await supabase
            .from('eventos_prospeccao')
            .update({ confirmation_token: token })
            .eq('contato_id', contato.id)
            .eq('prospeccao_id', prospeccaoId);
          if (error) throw error;
        }
        setConfirmationToken(token);
      }

      const mensagem = montarMensagemConvite({
        template: prospeccao?.texto_convite_template ?? null,
        nome: contato.nome || '',
        evento: prospeccao?.titulo || 'Evento',
        token,
      });
      const url = montarUrlWhatsapp(contato.telefone, mensagem);

      // Registrar (re)envio
      const nowIso = new Date().toISOString();
      await supabase
        .from('eventos_prospeccao')
        .update({
          confirmation_sent_at: nowIso,
          confirmation_sent_by: user?.id ?? null,
        })
        .eq('contato_id', contato.id)
        .eq('prospeccao_id', prospeccaoId);
      setConfirmationSentAt(nowIso);

      window.open(url, '_blank', 'noopener,noreferrer');

      toast({
        title: 'WhatsApp aberto',
        description: 'A mensagem foi preparada para reenvio.',
      });
    } catch (err) {
      console.error('Erro ao reenviar convite:', err);
      toast({ title: 'Erro', description: 'Não foi possível reenviar.', variant: 'destructive' });
    } finally {
      setResending(false);
    }
  };

  // Função para exportar QR Code como imagem
  const handleExportQRCode = () => {
    if (!qrCodeUrl) return;
    
    // Criar link para download
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `qrcode-convite-${contato.nome?.replace(/\s+/g, '-') || 'cliente'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: 'QR Code exportado',
      description: 'O QR Code foi baixado com sucesso'
    });
  };

  // Formatar datas
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Não definida';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  // Função para salvar o convite como imagem (todos os 4 cards)
  const handleSaveConvite = async () => {
    if (!allCardsRef.current) {
      toast({
        title: 'Erro',
        description: 'Não foi possível capturar o convite',
        variant: 'destructive'
      });
      return;
    }
    
    setSaving(true);
    try {
      const canvas = await html2canvas(allCardsRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `convite-${contato.nome?.replace(/\s+/g, '-') || 'cliente'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: 'Convite salvo',
        description: 'O convite foi baixado como imagem'
      });
    } catch (error) {
      console.error('Erro ao salvar convite:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o convite',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Convite visual - apenas QR Code com nome/número */}
      <div ref={allCardsRef} className="flex justify-center">
        <Card className="p-6 max-w-sm w-full bg-white">
          <div className="flex flex-col items-center space-y-4">
            {/* QR Code */}
            <div className="bg-white rounded-xl p-4">
              {qrCodeUrl && qrToken ? (
                <img 
                  src={qrCodeUrl} 
                  alt="QR Code para Check-in" 
                  className="w-48 h-48 object-contain"
                />
              ) : (
                <div className="w-48 h-48 flex flex-col items-center justify-center text-muted-foreground">
                  <QrCode className="w-16 h-16 mb-2 opacity-50" />
                  <p className="text-sm">Gerando QR Code...</p>
                </div>
              )}
            </div>

            {/* Info do convidado */}
            <div className="text-center">
              <p className="font-semibold text-lg">{contato.nome || 'Sem nome'}</p>
              {contato.telefone && (
                <p className="text-sm text-muted-foreground">{contato.telefone}</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Seção de controles */}
      <Card className="p-4">
        {confirmacaoFlagAtiva && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Send className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-sm">Confirmação de Presença</h4>
              {confirmedAt ? (
                <Badge className="text-xs bg-green-100 text-green-800 border border-green-200 hover:bg-green-100">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Confirmado
                </Badge>
              ) : confirmationSentAt ? (
                <Badge className="text-xs bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-100">
                  <Clock className="w-3 h-3 mr-1" /> Aguardando
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">Não enviado</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {confirmedAt
                ? `Confirmado em ${new Date(confirmedAt).toLocaleString('pt-BR')}`
                : confirmationSentAt
                  ? `Enviado em ${new Date(confirmationSentAt).toLocaleString('pt-BR')}`
                  : 'Nenhuma confirmação enviada para este contato.'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReenviarConfirmacao}
              disabled={resending || !contato.telefone}
              className="mb-4 w-full"
            >
              {resending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-1" />
              )}
              {confirmationSentAt ? 'Reenviar Confirmação' : 'Enviar Confirmação'}
            </Button>
          </>
        )}

        <div className="flex items-center gap-2 mb-4">
          <QrCode className="w-4 h-4 text-primary" />
          <h4 className="font-semibold text-sm">Controles do QR Code</h4>
          {qrTokenUsed && (
            <Badge variant="destructive" className="text-xs">Usado</Badge>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          {qrTokenUsed ? 'Este QR Code já foi utilizado' : 'Envie o QR Code para o cliente'}
        </p>

        {qrToken && qrCodeUrl ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportQRCode}
            >
              <Download className="w-4 h-4 mr-1" />
              Baixar QR Code
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateQRCode}
              disabled={generatingQR}
            >
              {generatingQR ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1" />
              )}
              Regenerar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckin}
            >
              <UserCheck className="w-4 h-4 mr-1" />
              Check-in Manual
            </Button>
            <Button
              size="sm"
              onClick={handleSaveConvite}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Salvar Convite
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
      </Card>

      {/* Informações adicionais */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-primary" />
          <h4 className="font-semibold text-sm">Informações do Convite</h4>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground">Convidado</Label>
            <p className="font-medium">{contato.nome || 'Sem nome'}</p>
            {contato.telefone && (
              <p className="text-muted-foreground">{contato.telefone}</p>
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Badge variant="outline" className="mt-1">{contato.status}</Badge>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Quem Convidou</Label>
            <p className="font-medium">{userName || 'Não identificado'}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Vendedor</Label>
            <p className="font-medium">{vendedorNome || userName || 'Não definido'}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
