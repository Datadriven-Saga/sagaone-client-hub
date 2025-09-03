import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardCard } from "@/components/DashboardCard";
import { 
  Users, 
  Bell, 
  Target, 
  Headphones, 
  Store, 
  Search
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardData } from "@/hooks/useDashboardData";

const Index = () => {
  const navigate = useNavigate();
  const { data, loading } = useDashboardData();

  return (
    <DashboardLayout>
      <div className="space-y-3">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Bem-vindo ao TAVAT
          </h1>
          <p className="text-muted-foreground">
            Aqui está o resumo das suas atividades e performance.
          </p>
        </div>

        {/* Cards dos Módulos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Carteira de Clientes */}
          <DashboardCard
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
          </DashboardCard>

          {/* Notificações */}
          <DashboardCard
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
          </DashboardCard>

          {/* Prospecção */}
          <DashboardCard
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
          </DashboardCard>

          {/* Central de Atendimento */}
          <DashboardCard
            title="Central de Atendimento"
            icon={Headphones}
            actionText="Ver Atendimentos"
            onAction={() => navigate('/central-atendimento')}
          >
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Leads Abertos:</span>
                <span className="font-semibold">
                  {loading ? "..." : data.leadsAbertos}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Em Andamento:</span>
                <span className="font-semibold text-blue-600">
                  {loading ? "..." : data.leadsEmAndamento}
                </span>
              </div>
            </div>
          </DashboardCard>

          {/* Loja */}
          <DashboardCard
            title="Loja"
            icon={Store}
            actionText="Ver Loja"
            onAction={() => navigate('/loja')}
          >
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Vendas Mês:</span>
                <span className="font-semibold text-green-600">
                  {loading ? "..." : data.vendasMes}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Em Negociação:</span>
                <span className="font-semibold text-orange-600">
                  {loading ? "..." : data.vendasEmNegociacao}
                </span>
              </div>
            </div>
          </DashboardCard>

          {/* Busca & Resgate */}
          <DashboardCard
            title="Busca & Resgate"
            icon={Search}
            actionText="Ver B&R"
            onAction={() => navigate('/busca-resgate')}
          >
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Eventos Ativos:</span>
                <span className="font-semibold">
                  {loading ? "..." : data.eventosAtivos}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Concluídos:</span>
                <span className="font-semibold text-green-600">
                  {loading ? "..." : data.eventosConcluidos}
                </span>
              </div>
            </div>
          </DashboardCard>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
