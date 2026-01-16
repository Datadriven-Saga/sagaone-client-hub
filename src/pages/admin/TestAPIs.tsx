import React, { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Copy, Play, ArrowLeft, Info, QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const TestAPIs = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [leadId, setLeadId] = useState('');
  const [leadCodigo, setLeadCodigo] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [novoStatus, setNovoStatus] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);

  const baseUrl = 'https://karcxgnfiymlrkbzhewo.supabase.co/functions/v1';

  // Status válidos do sistema de prospecção - valores em snake_case para API
  const statusOptions = [
    { label: 'Novos', value: 'novo' },
    { label: 'Atribuídos', value: 'atribuido' },
    { label: 'Em Espera', value: 'em_espera' },
    { label: 'Convidados', value: 'convidado' },
    { label: 'Confirmados', value: 'confirmado' },
    { label: 'Check-ins', value: 'checkin' },
    { label: 'Vendas', value: 'venda' },
    { label: 'Descartados', value: 'descartado' },
    { label: 'Opt Out', value: 'opt_out' }
  ];

  const testGetStatus = async () => {
    if (!leadId) {
      toast({
        title: "Erro",
        description: "Preencha o lead_id",
        variant: "destructive"
      });
      return;
    }

    setLoading('get');
    try {
      const response = await fetch(`${baseUrl}/prospeccao-status?lead_id=${leadId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Erro na requisição');

      setResponses(prev => ({ ...prev, get: data }));
      toast({
        title: "Sucesso",
        description: "API GET executada com sucesso"
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao executar GET",
        variant: "destructive"
      });
      setResponses(prev => ({ ...prev, get: { error: error.message } }));
    } finally {
      setLoading(null);
    }
  };

  const testPutStatus = async () => {
    if (!leadId || !novoStatus) {
      toast({
        title: "Erro", 
        description: "Preencha lead_id e novo status",
        variant: "destructive"
      });
      return;
    }

    setLoading('put');
    try {
      const response = await fetch(`${baseUrl}/prospeccao-status?lead_id=${leadId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ novo_status: novoStatus })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Erro na requisição');

      setResponses(prev => ({ ...prev, put: data }));
      toast({
        title: "Sucesso",
        description: "Status atualizado com sucesso"
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao executar PUT",
        variant: "destructive"
      });
      setResponses(prev => ({ ...prev, put: { error: error.message } }));
    } finally {
      setLoading(null);
    }
  };

  const testPostAnotacao = async () => {
    if (!leadId || !mensagem) {
      toast({
        title: "Erro",
        description: "Preencha lead_id e mensagem",
        variant: "destructive"
      });
      return;
    }

    setLoading('post');
    try {
      const response = await fetch(`${baseUrl}/prospeccao-anotacao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          lead_id: parseInt(leadId),
          mensagem: mensagem
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Erro na requisição');

      setResponses(prev => ({ ...prev, post: data }));
      toast({
        title: "Sucesso",
        description: "Anotação criada com sucesso"
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao executar POST",
        variant: "destructive"
      });
      setResponses(prev => ({ ...prev, post: { error: error.message } }));
    } finally {
      setLoading(null);
    }
  };

  const testGetQRCode = async () => {
    if (!leadCodigo) {
      toast({
        title: "Erro",
        description: "Preencha o código do lead",
        variant: "destructive"
      });
      return;
    }

    if (!adminToken) {
      toast({
        title: "Erro",
        description: "Preencha o Admin Token (SAGA_ONE_ADMIN_TOKEN)",
        variant: "destructive"
      });
      return;
    }

    setLoading('qrcode');
    setQrCodeImage(null);
    try {
      const response = await fetch(`${baseUrl}/get-lead-qrcode?lead_id=${encodeURIComponent(leadCodigo)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        }
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Erro na requisição');

      setResponses(prev => ({ ...prev, qrcode: data }));
      
      // Se tem QR Code, mostrar a imagem
      if (data.qrcode?.data_url) {
        setQrCodeImage(data.qrcode.data_url);
      }
      
      toast({
        title: "Sucesso",
        description: "QR Code gerado com sucesso"
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao gerar QR Code",
        variant: "destructive"
      });
      setResponses(prev => ({ ...prev, qrcode: { error: error.message } }));
    } finally {
      setLoading(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado",
      description: "URL copiada para a área de transferência"
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/administracao')}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Teste de APIs de Prospecção
            </h1>
            <p className="text-muted-foreground">
              Interface para testar as APIs usando <code className="text-xs bg-muted px-1 py-0.5 rounded">lead_id</code> numérico
            </p>
          </div>
        </div>

        {/* Parâmetro Global - lead_id */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Parâmetro Global
              <Badge variant="outline" className="font-mono">lead_id</Badge>
            </CardTitle>
            <CardDescription className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                O <code className="text-xs bg-muted px-1 py-0.5 rounded">lead_id</code> é o identificador numérico único do lead, 
                recebido no payload de disparo para IA WhatsApp. Use este ID para consultar, 
                atualizar status e adicionar anotações.
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lead_id">Lead ID (numérico)</Label>
              <Input
                id="lead_id"
                type="number"
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                placeholder="Ex: 42"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Exemplo de payload recebido no disparo: <code>{`{ "lead_id": 42, "nome": "João", "telefone": "..." }`}</code>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* GET Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">GET</Badge>
                Consultar Status do Lead
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(`${baseUrl}/prospeccao-status?lead_id=${leadId || '{lead_id}'}`)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </CardTitle>
            <CardDescription>
              Consulta o status atual de um lead pelo seu ID numérico
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-3 rounded-md">
              <code className="text-sm">
                GET {baseUrl}/prospeccao-status?lead_id={leadId || '{lead_id}'}
              </code>
            </div>
            <Button 
              onClick={testGetStatus} 
              disabled={loading === 'get'}
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              {loading === 'get' ? 'Executando...' : 'Testar GET'}
            </Button>
            {responses.get && (
              <div className="bg-muted p-3 rounded-md">
                <Label className="text-sm font-medium">Resposta:</Label>
                <pre className="text-xs mt-2 overflow-auto max-h-48">
                  {JSON.stringify(responses.get, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PUT Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="default">PUT</Badge>
                Atualizar Status do Lead
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(`${baseUrl}/prospeccao-status?lead_id=${leadId || '{lead_id}'}`)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </CardTitle>
            <CardDescription>
              Atualiza o status de um lead pelo seu ID numérico
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-3 rounded-md">
              <code className="text-sm">
                PUT {baseUrl}/prospeccao-status?lead_id={leadId || '{lead_id}'}
              </code>
            </div>
            <div className="space-y-2">
              <Label htmlFor="novo_status">Novo Status</Label>
              <Select value={novoStatus} onValueChange={setNovoStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o novo status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-muted p-3 rounded-md">
              <Label className="text-sm font-medium">Body:</Label>
              <pre className="text-xs mt-2">
                {JSON.stringify({ novo_status: novoStatus || '{status}' }, null, 2)}
              </pre>
            </div>
            <Button 
              onClick={testPutStatus} 
              disabled={loading === 'put'}
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              {loading === 'put' ? 'Executando...' : 'Testar PUT'}
            </Button>
            {responses.put && (
              <div className="bg-muted p-3 rounded-md">
                <Label className="text-sm font-medium">Resposta:</Label>
                <pre className="text-xs mt-2 overflow-auto max-h-48">
                  {JSON.stringify(responses.put, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* POST Anotação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="destructive">POST</Badge>
                Criar Anotação
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(`${baseUrl}/prospeccao-anotacao`)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </CardTitle>
            <CardDescription>
              Adiciona uma anotação a um lead pelo seu ID numérico
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-3 rounded-md">
              <code className="text-sm">
                POST {baseUrl}/prospeccao-anotacao
              </code>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mensagem">Mensagem da Anotação</Label>
              <Textarea
                id="mensagem"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Digite a mensagem da anotação..."
                rows={3}
              />
            </div>
            <div className="bg-muted p-3 rounded-md">
              <Label className="text-sm font-medium">Body da Requisição:</Label>
              <pre className="text-xs mt-2">
                {JSON.stringify({
                  lead_id: leadId ? parseInt(leadId) : '{lead_id}',
                  mensagem: mensagem || '{mensagem}'
                }, null, 2)}
              </pre>
            </div>
            <Button 
              onClick={testPostAnotacao} 
              disabled={loading === 'post'}
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              {loading === 'post' ? 'Executando...' : 'Testar POST'}
            </Button>
            {responses.post && (
              <div className="bg-muted p-3 rounded-md">
                <Label className="text-sm font-medium">Resposta:</Label>
                <pre className="text-xs mt-2 overflow-auto max-h-48">
                  {JSON.stringify(responses.post, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* GET QR Code */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">GET</Badge>
                <QrCode className="h-5 w-5" />
                Gerar QR Code do Lead
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(`${baseUrl}/get-lead-qrcode?lead_id=${leadCodigo || '{lead_id}'}`)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </CardTitle>
            <CardDescription>
              Gera ou retorna o QR Code de check-in de um lead pelo <code className="text-xs bg-muted px-1 py-0.5 rounded">lead_id</code>. Requer <code className="text-xs bg-muted px-1 py-0.5 rounded">SAGA_ONE_ADMIN_TOKEN</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-3 rounded-md">
              <code className="text-sm">
                GET {baseUrl}/get-lead-qrcode?lead_id={leadCodigo || '{lead_id}'}
              </code>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lead_codigo">Lead ID</Label>
                <Input
                  id="lead_codigo"
                  type="number"
                  value={leadCodigo}
                  onChange={(e) => setLeadCodigo(e.target.value)}
                  placeholder="Ex: 12345"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin_token">Admin Token</Label>
                <Input
                  id="admin_token"
                  type="password"
                  value={adminToken}
                  onChange={(e) => setAdminToken(e.target.value)}
                  placeholder="SAGA_ONE_ADMIN_TOKEN"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="bg-muted p-3 rounded-md">
              <Label className="text-sm font-medium">Headers:</Label>
              <pre className="text-xs mt-2">
                {JSON.stringify({
                  'Authorization': 'Bearer {SAGA_ONE_ADMIN_TOKEN}',
                  'Content-Type': 'application/json'
                }, null, 2)}
              </pre>
            </div>

            <Button 
              onClick={testGetQRCode} 
              disabled={loading === 'qrcode'}
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              {loading === 'qrcode' ? 'Gerando...' : 'Testar GET QR Code'}
            </Button>

            {qrCodeImage && (
              <div className="flex flex-col items-center gap-4 p-4 bg-white rounded-lg">
                <Label className="text-sm font-medium text-foreground">QR Code Gerado:</Label>
                <img 
                  src={qrCodeImage} 
                  alt="QR Code do Lead" 
                  className="w-48 h-48 border rounded-lg"
                />
              </div>
            )}

            {responses.qrcode && (
              <div className="bg-muted p-3 rounded-md">
                <Label className="text-sm font-medium">Resposta:</Label>
                <pre className="text-xs mt-2 overflow-auto max-h-48">
                  {JSON.stringify(responses.qrcode, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default TestAPIs;
