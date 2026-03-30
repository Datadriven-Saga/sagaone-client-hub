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
  ShieldBan,
  Plug
} from "lucide-react";
import { useNavigate, Navigate } from "react-router-dom";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { useMfaMaster } from "@/hooks/useMfaMaster";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Administracao = () => {
  const navigate = useNavigate();
  const { permissions, loading: accessLoading } = useUserAccessType();
  const { isMaster } = useMfaMaster();

  const p = (key: string): boolean => permissions[key] ?? false;

  if (accessLoading) {
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

  // CRM users with canGovernancaDados but not full admin: redirect to Quarentena
  if (p("canGovernancaDados") && !p("canAccessAdminConfig") && !p("canManageUsers")) {
    return <Navigate to="/administracao/quarentena" replace />;
  }

  const hasAccess = p("canAccessAdministracao") || p("canViewAuthenticator");

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
              O módulo de Administração é restrito. 
              Entre em contato com um administrador do sistema se você acredita que deveria ter acesso a esta área.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  // Build modules dynamically based on permission flags
  const allModules: { title: string; description: string; icon: any; route: string; permissionKey: string }[] = [
    {
      title: "Acessos",
      description: "Gerenciar usuários e permissões do sistema",
      icon: Users,
      route: "/administracao/acessos",
      permissionKey: "canManageUsers||canCreateUsers",
    },
    {
      title: "Empresas",
      description: "Gerenciar dados das empresas do sistema",
      icon: Building,
      route: "/administracao/empresas",
      permissionKey: "canManageEmpresas",
    },
    {
      title: "Agentes",
      description: "Gerenciar agentes de IA e controle de implantação",
      icon: Bot,
      route: "/administracao/agentes",
      permissionKey: "canAccessAgentesIA",
    },
    {
      title: "Gatilhos",
      description: "Configurar gatilhos para personas de IA",
      icon: Zap,
      route: "/gatilhos",
      permissionKey: "canAccessGatilhos",
    },
    {
      title: "MFA / Cofre de Senhas",
      description: "Gerenciar autenticação multifator, códigos TOTP e cofre de senhas",
      icon: ShieldCheck,
      route: "/administracao/mfa",
      permissionKey: "canAccessAgentesIA",
    },
    {
      title: "Campos Obrigatórios",
      description: "Configurar campos obrigatórios por módulo",
      icon: FileText,
      route: "/administracao/campos",
      permissionKey: "canAccessAdminConfig",
    },
    {
      title: "APIs",
      description: "Gerenciar APIs e integrações do sistema",
      icon: Code,
      route: "/administracao/apis",
      permissionKey: "canAccessAPIs",
    },
    {
      title: "Teste de APIs",
      description: "Testar APIs de prospecção do sistema",
      icon: Settings,
      route: "/administracao/test-apis",
      permissionKey: "canTestAPIs",
    },
    {
      title: "Painel Treinamento",
      description: "Gerenciar treinamentos e simulações",
      icon: GraduationCap,
      route: "/administracao/treinamentos",
      permissionKey: "canManageAcademy",
    },
    {
      title: "Controle de Acessos",
      description: "Gerenciar permissões por departamento",
      icon: ShieldCheck,
      route: "/administracao/controle-acessos",
      permissionKey: "canAccessControleAcessos",
    },
    {
      title: "Logs de Disparos",
      description: "Auditoria de todos os disparos de IA com custos",
      icon: DollarSign,
      route: "/administracao/logs-disparos",
      permissionKey: "canAccessAdminConfig",
    },
    {
      title: "Controle Gastos Ligação",
      description: "Dashboard de custos e métricas Twilio / Vapi em tempo real",
      icon: PhoneCall,
      route: "/administracao/gastos-ligacao",
      permissionKey: "canAccessFinancialReports",
    },
    {
      title: "Feature Flags",
      description: "Controle centralizado de funcionalidades do sistema",
      icon: Flag,
      route: "/administracao/feature-flags",
      permissionKey: "canAccessAdminConfig",
    },
    {
      title: "Quarentena",
      description: "Visualizar e gerenciar contatos bloqueados por marca",
      icon: ShieldBan,
      route: "/administracao/quarentena",
      permissionKey: "canGovernancaDados",
    },
    {
      title: "Criar Integração",
      description: "Configurar e gerenciar integrações com sistemas externos",
      icon: Plug,
      route: "/administracao/integracoes",
      permissionKey: "canAccessAgentesIA",
    },
    {
      title: "Opt-Out Global",
      description: "Lista negra permanente de números bloqueados em todos os canais",
      icon: ShieldBan,
      route: "/administracao/opt-out-global",
      permissionKey: "canAccessOptOutGlobal",
    },
  ];

  // MFA Master module
  const masterModules = isMaster ? [
    {
      title: "MFA Master",
      description: "Controle centralizado de Authenticators, acessos e logs",
      icon: KeyRound,
      route: "/administracao/mfa-master",
      permissionKey: "_always_", // Controlled by isMaster check above
    }
  ] : [];

  const visibleModules = [
    ...allModules.filter(m => p(m.permissionKey)),
    ...masterModules,
  ];

  const isFullAdmin = p("canAccessAdminConfig");

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
            {visibleModules.map((module) => (
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

          {/* Info Cards - only show for full admins */}
          {isFullAdmin && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <div className="bg-card border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
                <p className="text-sm text-muted-foreground">
                  Apenas usuários com permissões administrativas têm acesso 
                  completo a este módulo. Outros perfis veem apenas os módulos permitidos.
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
          
          {/* Info for limited access users */}
          {!isFullAdmin && (
            <div className="bg-card border rounded-lg p-6 mt-8">
              <h3 className="text-lg font-semibold mb-2">Acesso Limitado</h3>
              <p className="text-sm text-muted-foreground">
                Seu perfil possui acesso aos módulos exibidos acima. Para acesso a funcionalidades adicionais, entre em contato com um administrador.
              </p>
            </div>
          )}
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default Administracao;
