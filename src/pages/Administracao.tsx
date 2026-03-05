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
  GraduationCap,
  ShieldCheck,
  KeyRound,
  DollarSign,
  PhoneCall,
  Flag,
  ShieldBan
} from "lucide-react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { useMfaMaster } from "@/hooks/useMfaMaster";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Administracao = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAdminCheck();
  const { isGerente, isCRM, loading: accessLoading } = useUserAccessType();
  const { isMaster } = useMfaMaster();

  const isFullLoading = loading || accessLoading;

  // Show loading state
  if (isFullLoading) {
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

  // CRM users: redirect straight to Quarentena
  const isCRMOnly = isCRM && !isAdmin && !isGerente;
  if (isCRMOnly) {
    return <Navigate to="/administracao/quarentena" replace />;
  }

  // Allow access for admins AND managers
  const hasAccess = isAdmin || isGerente;

  // Block access for users without permission
  if (!hasAccess) {
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
              O módulo de Administração é restrito a usuários com perfil de <strong>Administrador</strong> ou <strong>Gerente</strong>. 
              Entre em contato com um administrador do sistema se você acredita que deveria ter acesso a esta área.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  // Modules available only for Admins
  const adminOnlyModules = [
    {
      title: "Empresas",
      description: "Gerenciar dados das empresas do sistema",
      icon: Building,
      route: "/administracao/empresas"
    },
    {
      title: "Agentes",
      description: "Gerenciar agentes de IA e controle de implantação",
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
    },
    {
      title: "Painel Treinamento",
      description: "Gerenciar treinamentos e simulações",
      icon: GraduationCap,
      route: "/administracao/treinamentos"
    },
    {
      title: "Controle de Acessos",
      description: "Gerenciar permissões por departamento",
      icon: ShieldCheck,
      route: "/administracao/controle-acessos"
    },
    {
      title: "Logs de Disparos",
      description: "Auditoria de todos os disparos de IA com custos",
      icon: DollarSign,
      route: "/administracao/logs-disparos"
    },
    {
      title: "Controle Gastos Ligação",
      description: "Dashboard de custos e métricas Twilio / Vapi em tempo real",
      icon: PhoneCall,
      route: "/administracao/gastos-ligacao"
    },
    {
      title: "Feature Flags",
      description: "Controle centralizado de funcionalidades do sistema",
      icon: Flag,
      route: "/administracao/feature-flags"
    },
    {
      title: "Quarentena",
      description: "Visualizar e gerenciar contatos bloqueados por marca",
      icon: ShieldBan,
      route: "/administracao/quarentena"
    }
  ];

  // MFA Master module - only for Master users
  const masterModules = isMaster ? [
    {
      title: "MFA Master",
      description: "Controle centralizado de Authenticators, acessos e logs",
      icon: KeyRound,
      route: "/administracao/mfa-master"
    }
  ] : [];

  // Modules available for both Admins and Managers
  const sharedModules = [
    {
      title: "Acessos",
      description: isGerente && !isAdmin 
        ? "Gerenciar usuários SDR, Vendedores e Recepcionistas das suas lojas" 
        : "Gerenciar usuários e permissões do sistema",
      icon: Users,
      route: "/administracao/acessos"
    }
  ];

  // Combine modules based on user role
  const adminModules = isAdmin 
    ? [...sharedModules, ...adminOnlyModules, ...masterModules] 
    : [...sharedModules, ...masterModules];

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

          {/* Info Cards - only show for admins */}
          {isAdmin && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <div className="bg-card border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
                <p className="text-sm text-muted-foreground">
                  Apenas usuários com perfil de <strong>Administrador</strong> têm acesso 
                  completo a este módulo. Gerentes podem gerenciar apenas acessos da equipe.
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
          )}
          
          {/* Info for Managers */}
          {isGerente && !isAdmin && (
            <div className="bg-card border rounded-lg p-6 mt-8">
              <h3 className="text-lg font-semibold mb-2">Acesso de Gerente</h3>
              <p className="text-sm text-muted-foreground">
                Como gerente, você pode criar e gerenciar usuários <strong>SDR</strong>, <strong>Vendedor</strong> e <strong>Recepcionista</strong> apenas das lojas que você gerencia.
              </p>
            </div>
          )}
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default Administracao;