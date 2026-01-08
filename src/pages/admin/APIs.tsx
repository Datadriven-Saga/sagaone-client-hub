import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Code, Activity, Settings, Eye, ArrowLeft, Webhook, Link2, CheckCircle2, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const APIs = () => {
  const navigate = useNavigate();

  const integracoes = [
    {
      nome: "WhatsApp Business API",
      tipo: "Mensageria",
      status: "Conectado",
      ultimaSincronizacao: "2024-01-15 14:30",
      endpoint: "https://api.whatsapp.com/v1/..."
    },
    {
      nome: "API do CRM",
      tipo: "Integração",
      status: "Conectado", 
      ultimaSincronizacao: "2024-01-15 14:25",
      endpoint: "https://api.crm.com/v2/..."
    },
    {
      nome: "Gateway de Pagamento",
      tipo: "Financeiro",
      status: "Desconectado",
      ultimaSincronizacao: "2024-01-14 10:15",
      endpoint: "https://api.payment.com/v1/..."
    }
  ];

  const apisProspeccao = [
    {
      nome: "Consultar Status do Contato",
      metodo: "GET",
      endpoint: "https://karcxgnfiymlrkbzhewo.supabase.co/functions/v1/prospeccao-status",
      parametros: "?prospeccao_id={ID}&lead_id={ID}",
      descricao: "Retorna o status atual do contato na prospecção"
    },
    {
      nome: "Alterar Status do Contato",
      metodo: "PUT",
      endpoint: "https://karcxgnfiymlrkbzhewo.supabase.co/functions/v1/prospeccao-status", 
      parametros: "?prospeccao_id={ID}&lead_id={ID}",
      descricao: "Altera o status do contato na prospecção"
    },
    {
      nome: "Adicionar Anotação",
      metodo: "POST",
      endpoint: "https://karcxgnfiymlrkbzhewo.supabase.co/functions/v1/prospeccao-anotacao",
      parametros: "{ prospeccao_id, lead_id, mensagem }",
      descricao: "Insere uma anotação no contato dentro da prospeção"
    }
  ];

  const webhooks = [
    {
      nome: "Webhook Novos Leads",
      url: "https://supersaga.com/webhook/leads",
      status: "Ativo",
      ultimaExecucao: "2024-01-15 14:28"
    },
    {
      nome: "Webhook Vendas Finalizadas", 
      url: "https://supersaga.com/webhook/sales",
      status: "Ativo",
      ultimaExecucao: "2024-01-15 13:45"
    }
  ];

  const getMetodoBadgeVariant = (metodo: string) => {
    switch (metodo) {
      case 'GET': return 'secondary';
      case 'PUT': return 'default';
      case 'POST': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">APIs e Integrações</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie APIs externas e integrações do sistema
              </p>
            </div>
          </div>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova Integração
          </Button>
        </div>

        {/* Integrações Externas */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Integrações Externas</CardTitle>
                <CardDescription>APIs conectadas ao sistema Saga One</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {integracoes.map((api, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    api.status === "Conectado" ? "bg-green-500/10" : "bg-destructive/10"
                  }`}>
                    {api.status === "Conectado" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{api.nome}</h3>
                      <Badge variant={api.status === "Conectado" ? "default" : "secondary"} className="text-xs">
                        {api.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{api.tipo}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Última sincronização: {api.ultimaSincronizacao}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Activity className="h-4 w-4" />
                    <span className="hidden sm:inline">Logs</span>
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/configuracoes')}>
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Configurar</span>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* APIs de Prospecção */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10">
                <Code className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-lg">APIs de Prospecção</CardTitle>
                <CardDescription>APIs para gerenciar contatos e status nas prospecções</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {apisProspeccao.map((api, index) => (
              <div 
                key={index} 
                className="p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={getMetodoBadgeVariant(api.metodo)} className="font-mono text-xs">
                        {api.metodo}
                      </Badge>
                      <h3 className="font-medium text-foreground">{api.nome}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{api.descricao}</p>
                    <div className="bg-background/80 border rounded-md p-3">
                      <code className="text-xs text-muted-foreground break-all">
                        {api.endpoint}{api.parametros && api.parametros}
                      </code>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Eye className="h-4 w-4" />
                    Documentação
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/administracao/test-apis')}>
                    <Settings className="h-4 w-4" />
                    Testar API
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Webhooks */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-500/10">
                <Webhook className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Webhooks</CardTitle>
                <CardDescription>Endpoints para receber notificações em tempo real</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {webhooks.map((webhook, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500/10">
                    <Activity className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{webhook.nome}</h3>
                      <Badge variant="default" className="text-xs">{webhook.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground font-mono">{webhook.url}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Última execução: {webhook.ultimaExecucao}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Eye className="h-4 w-4" />
                    <span className="hidden sm:inline">Logs</span>
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/configuracoes')}>
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Configurar</span>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default APIs;