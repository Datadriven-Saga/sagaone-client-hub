import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardCard } from "@/components/DashboardCard";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { 
  Users, 
  Bell, 
  Target,
  Bot,
  FileText,
  GraduationCap
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useUserAccessType } from "@/hooks/useUserAccessType";

const Index = () => {
  const navigate = useNavigate();
  const { data, loading } = useDashboardData();
  const { permissions } = useUserAccessType();
  const p = (key: string): boolean => permissions[key] ?? false;

  return (
    <DashboardLayout>
      <ScrollIndicator className="flex-1 h-full">
        <div className="space-y-3 pb-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Bem-vindo ao Saga One
          </h1>
          <p className="text-muted-foreground">
            Aqui está o resumo das suas atividades e performance.
          </p>
        </div>

        {/* Cards dos Módulos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Agentes de IA */}
          {p("canAccessAgentesIA") && <DashboardCard
            title="Agentes de IA"
            icon={Bot}
            actionText="Gerenciar Agentes"
            onAction={() => navigate('/agentes-ia')}
          >
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Agentes Ativos:</span>
                <span className="font-semibold text-green-600">
                  {loading ? "..." : data.agentesAtivos}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Automações:</span>
                <span className="font-semibold">
                  {loading ? "..." : data.automacoes}
                </span>
              </div>
            </div>
          </DashboardCard>}

          {/* Prospecção */}
          {p("canViewProspeccao") && <DashboardCard
            title="Prospecção"
            icon={Target}
            actionText="Ver Prospecções"
            onAction={() => navigate('/prospeccao')}
          >
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Ativas:</span>
                <span className="font-semibold">
                  {loading ? "..." : data.prospeccoesAtivas}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Confirmados:</span>
                <span className="font-semibold text-green-600">
                  {loading ? "..." : data.prospeccoesConfirmadas}
                </span>
              </div>
            </div>
          </DashboardCard>}

          {/* Carteira de Clientes */}
          {p("canViewClientes") && <DashboardCard
            title="Carteira de Clientes"
            icon={Users}
            actionText="Gerenciar Clientes"
            onAction={() => navigate('/clientes')}
          >
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold">{loading ? "..." : data.totalClientes.toLocaleString()}</p>
                <p className="text-muted-foreground">Total de Clientes</p>
              </div>
              <div>
                <p className="font-semibold">
                  {loading ? "..." : data.totalClientes > 0 
                    ? `${((data.clientesComTelefone / data.totalClientes) * 100).toFixed(1)}%`
                    : "0%"
                  }
                </p>
                <p className="text-muted-foreground">Com Telefone</p>
              </div>
            </div>
          </DashboardCard>}

          {/* Notificações */}
          {p("canAccessNotificacoes") && <DashboardCard
            title="Notificações"
            icon={Bell}
            actionText="Ver Notificações"
            onAction={() => navigate('/notificacoes')}
          >
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Pendentes:</span>
                <span className="font-semibold text-orange-600">
                  {loading ? "..." : data.notificacoesPendentes}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Realizadas hoje:</span>
                <span className="font-semibold text-green-600">
                  {loading ? "..." : data.notificacoesRealizadas}
                </span>
              </div>
            </div>
          </DashboardCard>}

          {/* Relatórios */}
          {p("canAccessRelatorios") && <DashboardCard
            title="Relatórios"
            icon={FileText}
            actionText="Ver Relatórios"
            onAction={() => navigate('/relatorios')}
          >
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Gerados hoje:</span>
                <span className="font-semibold">
                  {loading ? "..." : data.relatoriosHoje}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Pendentes:</span>
                <span className="font-semibold text-orange-600">
                  {loading ? "..." : data.relatoriosPendentes}
                </span>
              </div>
            </div>
          </DashboardCard>

          {/* Treinamentos */}
          <DashboardCard
            title="Treinamentos"
            icon={GraduationCap}
            actionText="Acessar Treinamentos"
            onAction={() => navigate('/treinamentos')}
          >
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Cursos Ativos:</span>
                <span className="font-semibold">
                  {loading ? "..." : data.treinamentosAtivos}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Progresso Médio:</span>
                <span className="font-semibold text-green-600">
                  {loading ? "..." : `${data.progressoMedio}%`}
                </span>
              </div>
            </div>
          </DashboardCard>
        </div>
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default Index;
