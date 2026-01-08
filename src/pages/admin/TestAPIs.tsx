import React, { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Copy, Play, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const TestAPIs = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [prospeccaoId, setProspeccaoId] = useState('');
  const [leadId, setLeadId] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [novoStatus, setNovoStatus] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});

  const baseUrl = 'https://karcxgnfiymlrkbzhewo.supabase.co/functions/v1';

  const statusOptions = [
    'Novo', 'Tentativa de Contato', 'Em Conversa', 'Interessado', 
    'Não Interessado', 'Reagendado', 'Convertido'
  ];

  const testGetStatus = async () => {
    if (!prospeccaoId || !leadId) {
      toast({
        title: "Erro",
        description: "Preencha prospeccao_id e lead_id",
        variant: "destructive"
      });
      return;
    }

    setLoading('get');
    try {
      const { data, error } = await supabase.functions.invoke('prospeccao-status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prospeccao_id: prospeccaoId,
          contato_id: leadId
        })
      });

      if (error) throw error;

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
    if (!prospeccaoId || !leadId || !novoStatus) {
      toast({
        title: "Erro", 
        description: "Preencha todos os campos para PUT",
        variant: "destructive"
      });
      return;
    }

    setLoading('put');
    try {
      const { data, error } = await supabase.functions.invoke('prospeccao-status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prospeccao_id: prospeccaoId,
          contato_id: leadId,
          status: novoStatus
        })
      });

      if (error) throw error;

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
    if (!prospeccaoId || !leadId || !mensagem) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos para POST",
        variant: "destructive"
      });
      return;
    }

    setLoading('post');
    try {
      const { data, error } = await supabase.functions.invoke('prospeccao-anotacao', {
        body: {
          prospeccao_id: prospeccaoId,
          contato_id: leadId,
          mensagem: mensagem
        }
      });

      if (error) throw error;

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
              Interface para testar as APIs de status e anotação de leads
            </p>
          </div>
        </div>

        {/* Parâmetros Globais */}
        <Card>
          <CardHeader>
            <CardTitle>Parâmetros Globais</CardTitle>
            <CardDescription>
              IDs que serão utilizados em todas as requisições. Clique nas variáveis para inserir no campo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prospeccao_id">Prospecção ID</Label>
                <Input
                  id="prospeccao_id"
                  value={prospeccaoId}
                  onChange={(e) => setProspeccaoId(e.target.value)}
                  placeholder="UUID da prospecção"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead_id">Lead/Contato ID</Label>
                <Input
                  id="lead_id"
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value)}
                  placeholder="UUID do contato"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="text-xs text-muted-foreground mr-2">Variáveis disponíveis (clique para inserir):</span>
              <Badge 
                variant="outline" 
                className="cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText('prospeccao_id');
                  toast({ title: "Copiado", description: "prospeccao_id copiado" });
                }}
              >
                prospeccao_id
              </Badge>
              <Badge 
                variant="outline" 
                className="cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText('lead_id');
                  toast({ title: "Copiado", description: "lead_id copiado" });
                }}
              >
                lead_id
              </Badge>
              <Badge 
                variant="outline" 
                className="cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText('contato_id');
                  toast({ title: "Copiado", description: "contato_id copiado" });
                }}
              >
                contato_id
              </Badge>
              <Badge 
                variant="outline" 
                className="cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText('mensagem');
                  toast({ title: "Copiado", description: "mensagem copiado" });
                }}
              >
                mensagem
              </Badge>
              <Badge 
                variant="outline" 
                className="cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText('status');
                  toast({ title: "Copiado", description: "status copiado" });
                }}
              >
                status
              </Badge>
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
                onClick={() => copyToClipboard(`${baseUrl}/prospeccao-status?prospeccao_id=${prospeccaoId}&lead_id=${leadId}`)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </CardTitle>
            <CardDescription>
              Consulta o status atual de um lead em uma prospecção
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-3 rounded-md">
              <code className="text-sm">
                GET {baseUrl}/prospeccao-status?prospeccao_id={prospeccaoId || '{ID}'}&lead_id={leadId || '{ID}'}
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
                <pre className="text-xs mt-2 overflow-auto">
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
                onClick={() => copyToClipboard(`${baseUrl}/prospeccao-status?prospeccao_id=${prospeccaoId}&lead_id=${leadId}`)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </CardTitle>
            <CardDescription>
              Atualiza o status de um lead em uma prospecção
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-3 rounded-md">
              <code className="text-sm">
                PUT {baseUrl}/prospeccao-status?prospeccao_id={prospeccaoId || '{ID}'}&lead_id={leadId || '{ID}'}
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
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <pre className="text-xs mt-2 overflow-auto">
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
              Adiciona uma anotação a um lead em uma prospecção
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
                  prospeccao_id: prospeccaoId || '{prospeccao_id}',
                  contato_id: leadId || '{contato_id}',
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
                <pre className="text-xs mt-2 overflow-auto">
                  {JSON.stringify(responses.post, null, 2)}
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