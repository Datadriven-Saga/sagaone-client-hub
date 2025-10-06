import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  HelpCircle, 
  Mail, 
  Phone, 
  MessageCircle, 
  ExternalLink,
  FileText,
  Video,
  Users,
  Settings,
  BarChart,
  Target,
  Calendar
} from "lucide-react";

const Ajuda = () => {
  const faqItems = [
    {
      question: "Como criar um novo lead?",
      answer: "Para criar um novo lead, acesse o módulo 'Prospecção' e clique no botão 'Novo Lead'. Preencha os dados básicos como nome, email, telefone e origem do lead."
    },
    {
      question: "Como agendar um follow-up?",
      answer: "No Kanban de leads, clique no card do lead desejado. Na tela de detalhes, você pode definir um agendamento para próximo contato através do campo 'Próximo Contato'."
    },
    {
      question: "Como configurar personas?",
      answer: "Acesse o módulo 'Personas' para criar e configurar diferentes perfis de clientes. Defina características, comportamentos e preferências para cada persona."
    },
    {
      question: "Como definir metas para a equipe?",
      answer: "No módulo 'Metas e OKR', você pode definir objetivos para vendedores individuais ou para equipes inteiras. Configure valores, prazos e acompanhe o progresso."
    },
    {
      question: "Como gerar relatórios?",
      answer: "Acesse o módulo 'Relatórios' para visualizar métricas de desempenho, conversão de leads, vendas por período e outros indicadores importantes."
    },
    {
      question: "Como configurar gatilhos automáticos?",
      answer: "No módulo 'Gatilhos', você pode criar automações baseadas em eventos, como envio automático de mensagens para novos leads ou lembretes de follow-up."
    }
  ];

  const modules = [
    {
      name: "Central de Atendimento",
      icon: MessageCircle,
      description: "Gerencie conversas e atendimentos em tempo real"
    },
    {
      name: "Prospecção",
      icon: Users,
      description: "Organize e acompanhe leads no funil de vendas"
    },
    {
      name: "Configurações",
      icon: Settings,
      description: "Configure produtos, motivos e preferências do sistema"
    },
    {
      name: "Relatórios",
      icon: BarChart,
      description: "Visualize métricas e indicadores de performance"
    },
    {
      name: "Metas e OKR",
      icon: Target,
      description: "Defina e acompanhe objetivos da equipe"
    },
    {
      name: "Treinamentos",
      icon: Video,
      description: "Acesse materiais de capacitação e desenvolvimento"
    }
  ];

  return (
    <DashboardLayout title="Ajuda e Suporte">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Central de Ajuda</h1>
          <p className="text-muted-foreground">
            Encontre respostas para suas dúvidas e aprenda a usar o sistema SAGA X
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Documentação</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Guias completos sobre todas as funcionalidades
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <Video className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Tutoriais em Vídeo</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Aprenda através de vídeos explicativos passo a passo
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Chat de Suporte</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Converse diretamente com nossa equipe de suporte
              </p>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <HelpCircle className="h-5 w-5 mr-2" />
              Perguntas Frequentes
            </CardTitle>
            <CardDescription>
              Respostas para as dúvidas mais comuns sobre o sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Modules Guide */}
        <Card>
          <CardHeader>
            <CardTitle>Guia dos Módulos</CardTitle>
            <CardDescription>
              Entenda cada funcionalidade do sistema SAGA X
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {modules.map((module, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <module.icon className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium">{module.name}</h4>
                    <p className="text-sm text-muted-foreground">{module.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contact Support */}
        <Card>
          <CardHeader>
            <CardTitle>Precisa de Mais Ajuda?</CardTitle>
            <CardDescription>
              Entre em contato com nossa equipe de suporte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center space-x-3 p-4 border rounded-lg">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">suporte@supersaga.com.br</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-4 border rounded-lg">
                <Phone className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Telefone</p>
                  <p className="text-sm text-muted-foreground">(11) 9999-9999</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-4 border rounded-lg">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Horário</p>
                  <p className="text-sm text-muted-foreground">Seg-Sex: 8h às 18h</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-center">
              <Button className="flex items-center space-x-2">
                <ExternalLink className="h-4 w-4" />
                <span>Abrir Ticket de Suporte</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Version Info */}
        <div className="text-center space-y-2">
          <Badge variant="outline">Versão 1.0.0</Badge>
          <p className="text-xs text-muted-foreground">
            Sistema SAGA X - Plataforma de Gestão de Leads e Vendas
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Ajuda;