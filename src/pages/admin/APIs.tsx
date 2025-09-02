import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Code, Activity, Settings, Eye } from "lucide-react";

const APIs = () => {
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
      url: "https://tavat.com/webhook/leads",
      status: "Ativo",
      ultimaExecucao: "2024-01-15 14:28"
    },
    {
      nome: "Webhook Vendas Finalizadas", 
      url: "https://tavat.com/webhook/sales",
      status: "Ativo",
      ultimaExecucao: "2024-01-15 13:45"
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">APIs e Integrações</h1>
            <p className="text-muted-foreground">
              Gerencie APIs externas e integrações do sistema
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nova Integração
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Integrações Externas
            </CardTitle>
            <CardDescription>
              APIs conectadas ao sistema TAVAT
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {integracoes.map((api, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{api.nome}</h3>
                      <Badge variant={api.status === "Conectado" ? "default" : "secondary"}>
                        {api.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{api.tipo}</p>
                    <div className="text-xs text-muted-foreground">
                      <p>Endpoint: {api.endpoint}</p>
                      <p>Última sincronização: {api.ultimaSincronizacao}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Activity className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              APIs de Prospecção
            </CardTitle>
            <CardDescription>
              APIs para gerenciar contatos e status nas prospecções
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {apisProspeccao.map((api, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{api.nome}</h3>
                      <Badge variant="secondary">{api.metodo}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{api.descricao}</p>
                    <div className="text-xs text-muted-foreground">
                      <p className="font-mono bg-muted p-2 rounded">
                        {api.endpoint}{api.parametros && api.parametros}
                      </p>
                      {api.parametros && !api.parametros.startsWith('?') && (
                        <p className="mt-1">Body: {api.parametros}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Webhooks
            </CardTitle>
            <CardDescription>
              Endpoints para receber notificações em tempo real
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {webhooks.map((webhook, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <h3 className="font-semibold">{webhook.nome}</h3>
                    <p className="text-sm text-muted-foreground">{webhook.url}</p>
                    <p className="text-xs text-muted-foreground">
                      Última execução: {webhook.ultimaExecucao}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{webhook.status}</Badge>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default APIs;