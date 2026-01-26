import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardCard } from "@/components/DashboardCard";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { 
  Building, 
  Users, 
  Settings, 
  Code, 
  Zap,
  FileText,
  AlertTriangle,
  Bot,
  Phone
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Administracao = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAdminCheck();

  // Show loading state
  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">Verificando permissões...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Block access for non-admin users
  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Acesso Negado
            </h1>
            <p className="text-muted-foreground">
              Você não tem permissão para acessar este módulo
            </p>
          </div>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              O módulo de Administração é restrito a usuários com perfil de <strong>Administrador</strong>. 
              Entre em contato com um administrador do sistema se você acredita que deveria ter acesso a esta área.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  const adminModules = [
    {
      title: "Empresas",
      description: "Gerenciar dados das empresas do sistema",
      icon: Building,
      route: "/administracao/empresas"
    },
    {
      title: "Acessos",
      description: "Gerenciar usuários e permissões do sistema",
      icon: Users,
      route: "/administracao/acessos"
    },
    {
      title: "Agentes",
      description: "Gerenciar agentes de IA de todas as lojas",
      icon: Bot,
      route: "/administracao/agentes"
    },
    {
      title: "Gatilhos",
      description: "Configurar gatilhos para personas de IA",
      icon: Zap,
      route: "/gatilhos"
    },
    {
      title: "Campos Obrigatórios",
      description: "Configurar campos obrigatórios por módulo",
      icon: FileText,
      route: "/administracao/campos"
    },
    {
      title: "Agentes Nextip",
      description: "Gerenciar números e instâncias de agentes",
      icon: Phone,
      route: "/administracao/agentes-nextip"
    },
    {
      title: "APIs",
      description: "Gerenciar APIs e integrações do sistema",
      icon: Code,
      route: "/administracao/apis"
    },
    {
      title: "Teste de APIs",
      description: "Testar APIs de prospecção do sistema",
      icon: Settings,
      route: "/administracao/test-apis"
    }
  ];

  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Administração
            </h1>
            <p className="text-muted-foreground">
              Gerencie configurações avançadas do sistema Saga One
            </p>
          </div>

          {/* Admin Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminModules.map((module) => (
              <DashboardCard
                key={module.title}
                title={module.title}
                icon={module.icon}
                actionText={`Acessar ${module.title}`}
                onAction={() => navigate(module.route)}
              >
                <p className="text-sm text-muted-foreground">
                  {module.description}
                </p>
              </DashboardCard>
            ))}
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="bg-card border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
              <p className="text-sm text-muted-foreground">
                Apenas usuários com perfil de <strong>Administrador</strong> têm acesso 
                completo a este módulo. Outros perfis podem ter acesso limitado a alguns sub-módulos.
              </p>
            </div>
            
            <div className="bg-card border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">Configurações Críticas</h3>
              <p className="text-sm text-muted-foreground">
                As alterações realizadas neste módulo afetam todo o sistema. 
                Tenha cuidado ao modificar configurações existentes.
              </p>
            </div>
          </div>
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default Administracao;