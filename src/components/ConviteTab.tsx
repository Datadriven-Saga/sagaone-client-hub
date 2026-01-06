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
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { Contato } from '@/hooks/useContatoData';

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
  
  // QR Code state
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  
  // Refs para download
  const kvRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const conviteRef = useRef<HTMLDivElement>(null);

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

        // Buscar dados da prospecção
        if (currentProspeccaoId) {
          const { data: prospeccaoData, error: prospeccaoError } = await supabase
            .from('prospeccoes')
            .select('id, titulo, data_inicio, data_fim, empresa_id')
            .eq('id', currentProspeccaoId)
            .single();
          
          if (!prospeccaoError && prospeccaoData) {
            setProspeccao(prospeccaoData);
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
        
        // Buscar imagem do convite
        const conviteProspeccaoId = currentProspeccaoId || prospeccaoId;
        if (conviteProspeccaoId) {
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
        if (user?.id) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('nome_completo')
            .eq('id', user.id)
            .single();
          
          if (profileData?.nome_completo) {
            setUserName(profileData.nome_completo);
          }
        }

        // Buscar dados do contato com qr_token
        const { data: contatoData } = await supabase
          .from('contatos')
          .select('qr_token, qr_token_used, vendedor_nome, responsavel_email')
          .eq('id', contato.id)
          .single();

        if (contatoData) {
          setQrToken(contatoData.qr_token);
          setQrTokenUsed(contatoData.qr_token_used || false);
          setVendedorNome(contatoData.vendedor_nome || '');

          // Se tem responsavel_email, buscar nome do vendedor
          if (contatoData.responsavel_email && !contatoData.vendedor_nome) {
            const { data: vendedorData } = await supabase
              .from('profiles')
              .select('nome_completo')
              .ilike('id', `%${contatoData.responsavel_email}%`)
              .maybeSingle();
            
            if (vendedorData?.nome_completo) {
              setVendedorNome(vendedorData.nome_completo);
            }
          }

          // Se já tem qr_token, gerar URL do QR Code
          if (contatoData.qr_token) {
            generateQRCodeUrl(contatoData.qr_token);
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
  const generateQRCodeUrl = (token: string) => {
    const qrData = JSON.stringify({
      qr_token: token,
      convidado_nome: contato.nome,
      convidado_telefone: contato.telefone || '',
      quem_convidou: userName,
      vendedor: vendedorNome || userName
    });
    
    const qrUrl = `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(qrData)}&choe=UTF-8`;
    setQrCodeUrl(qrUrl);
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
        quem_convidou: userName,
        vendedor: vendedorNome || userName
      });
      
      const qrUrl = `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(qrData)}&choe=UTF-8`;
      setQrCodeUrl(qrUrl);

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

  // Formatar datas
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Não definida';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  // Função para salvar o convite (placeholder)
  const handleSaveConvite = async () => {
    setSaving(true);
    try {
      toast({
        title: 'Convite salvo',
        description: 'O convite foi salvo com sucesso'
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
      {/* Grid com as 4 imagens */}
      <div className="grid grid-cols-2 gap-4">
        {/* 1. KV do Evento */}
        <Card className="p-4" ref={kvRef}>
          <div className="flex items-center gap-2 mb-3">
            <Image className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-sm">KV do Evento</h4>
          </div>
          <div className="aspect-square bg-muted rounded-lg overflow-hidden flex items-center justify-center">
            {conviteImagem ? (
              <img 
                src={conviteImagem} 
                alt="KV do Evento" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center text-muted-foreground p-4">
                <Image className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Imagem não configurada</p>
                <p className="text-xs">Configure na criação do evento</p>
              </div>
            )}
          </div>
        </Card>

        {/* 2. Informações */}
        <Card className="p-4" ref={infoRef}>
          <div className="flex items-center gap-2 mb-3">
            <Building className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-sm">Informações</h4>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Nome do Evento</Label>
              <p className="font-medium text-sm">{prospeccao?.titulo || 'Não definido'}</p>
            </div>
            <Separator />
            <div>
              <Label className="text-xs text-muted-foreground">Nome da Empresa</Label>
              <p className="font-medium text-sm">{empresa?.nome_empresa || activeCompany?.nome_empresa || 'Não definida'}</p>
            </div>
            <Separator />
            <div>
              <Label className="text-xs text-muted-foreground">Data do Evento</Label>
              <div className="flex items-center gap-1 text-sm">
                <CalendarDays className="w-3 h-3 text-muted-foreground" />
                <span>{formatDate(prospeccao?.data_inicio)}</span>
                {prospeccao?.data_fim && prospeccao.data_fim !== prospeccao.data_inicio && (
                  <>
                    <span className="text-muted-foreground">até</span>
                    <span>{formatDate(prospeccao?.data_fim)}</span>
                  </>
                )}
              </div>
            </div>
            <Separator />
            <div>
              <Label className="text-xs text-muted-foreground">Localização</Label>
              <div className="flex items-center gap-1 text-sm">
                <MapPin className="w-3 h-3 text-muted-foreground" />
                <span>{empresa?.uf ? `${empresa.uf}` : 'Não definida'}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* 3. QR Code */}
        <Card className="p-4" ref={qrRef}>
          <div className="flex items-center gap-2 mb-3">
            <QrCode className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-sm">QR Code Check-in</h4>
            {qrTokenUsed && (
              <Badge variant="destructive" className="text-xs">Usado</Badge>
            )}
          </div>
          <div className="aspect-square bg-white rounded-lg overflow-hidden flex items-center justify-center p-2">
            {qrCodeUrl && qrToken ? (
              <img 
                src={qrCodeUrl} 
                alt="QR Code para Check-in" 
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center text-muted-foreground">
                <QrCode className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Clique para gerar</p>
              </div>
            )}
          </div>
          
          {qrToken ? (
            <div className="space-y-2 mt-2">
              <p className="text-xs text-muted-foreground text-center">
                {qrTokenUsed ? 'Este QR Code já foi utilizado' : 'Envie o QR Code para o cliente'}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleGenerateQRCode}
                  disabled={generatingQR}
                >
                  {generatingQR ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span className="ml-1">Regenerar</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleCheckin}
                >
                  <QrCode className="w-4 h-4" />
                  <span className="ml-1">Check-in Manual</span>
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="w-full mt-2"
              onClick={handleGenerateQRCode}
              disabled={generatingQR}
            >
              {generatingQR ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4 mr-2" />
              )}
              Gerar QR Code de Convite
            </Button>
          )}
        </Card>

        {/* 4. Convite */}
        <Card className="p-4" ref={conviteRef}>
          <div className="flex items-center gap-2 mb-3">
            <UserCheck className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-sm">Convite</h4>
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="w-3 h-3" />
                Convidado
              </Label>
              <p className="font-semibold text-lg mt-1">{contato.nome || 'Sem nome'}</p>
              {contato.telefone && (
                <p className="text-sm text-muted-foreground">{contato.telefone}</p>
              )}
              <Badge variant="outline" className="mt-1">
                {contato.status}
              </Badge>
            </div>
            <Separator />
            <div className="p-3 bg-muted/50 rounded-lg">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                Quem Convidou
              </Label>
              <p className="font-medium mt-1">{userName || 'Usuário não identificado'}</p>
            </div>
            <Separator />
            <div className="p-3 bg-muted/50 rounded-lg">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="w-3 h-3" />
                Vendedor
              </Label>
              <p className="font-medium mt-1">{vendedorNome || userName || 'Não definido'}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Botão de Salvar */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold">Salvar Convite</h4>
            <p className="text-sm text-muted-foreground">
              Baixe o convite completo como imagem
            </p>
          </div>
          <Button onClick={handleSaveConvite} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar Convite
          </Button>
        </div>
      </Card>
    </div>
  );
}
