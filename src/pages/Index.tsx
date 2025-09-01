import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { DashboardCard } from "@/components/DashboardCard";
import { 
  Users, 
  Bell, 
  Target, 
  Headphones, 
  Store, 
  Search,
  Phone,
  Mail,
  TrendingUp,
  CheckCircle
} from "lucide-react";

const Index = () => {
  // Mock data - será substituído por dados reais do Supabase
  const mockKPIs = {
    totalClientes: 1247,
    clientesComTelefone: 1180,
    clientesComEmail: 892,
    notificacoesPendentes: 23,
    prospeccoesAtivas: 8,
    leadsAbertos: 145,
    vendasMes: 87
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Bem-vindo ao TAVAT
          </h1>
          <p className="text-muted-foreground">
            Aqui está o resumo das suas atividades e performance.
          </p>
        </div>

        {/* KPIs Gerais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Total de Clientes"
            value={mockKPIs.totalClientes}
            icon={Users}
            change={{ value: 12.5, type: 'increase' }}
          />
          <KPICard
            title="Clientes com Telefone"
            value={`${mockKPIs.clientesComTelefone} (${Math.round((mockKPIs.clientesComTelefone / mockKPIs.totalClientes) * 100)}%)`}
            icon={Phone}
            change={{ value: 2.3, type: 'increase' }}
          />
          <KPICard
            title="Clientes com E-mail"
            value={`${mockKPIs.clientesComEmail} (${Math.round((mockKPIs.clientesComEmail / mockKPIs.totalClientes) * 100)}%)`}
            icon={Mail}
            change={{ value: -1.2, type: 'decrease' }}
          />
          <KPICard
            title="Vendas do Mês"
            value={mockKPIs.vendasMes}
            icon={TrendingUp}
            change={{ value: 8.7, type: 'increase' }}
          />
        </div>

        {/* Cards dos Módulos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Carteira de Clientes */}
          <DashboardCard
            title="Carteira de Clientes"
            icon={Users}
            actionText="Gerenciar Clientes"
          >
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold">{mockKPIs.totalClientes}</p>
                <p className="text-muted-foreground">Total de Clientes</p>
              </div>
              <div>
                <p className="font-semibold">94.6%</p>
                <p className="text-muted-foreground">Com Telefone</p>
              </div>
            </div>
          </DashboardCard>

          {/* Notificações */}
          <DashboardCard
            title="Notificações"
            icon={Bell}
            actionText="Ver Notificações"
          >
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Pendentes:</span>
                <span className="font-semibold text-orange-600">{mockKPIs.notificacoesPendentes}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Realizadas hoje:</span>
                <span className="font-semibold text-green-600">12</span>
              </div>
            </div>
          </DashboardCard>

          {/* Prospecção */}
          <DashboardCard
            title="Prospecção"
            icon={Target}
            actionText="Ver Prospecções"
          >
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Ativas:</span>
                <span className="font-semibold">{mockKPIs.prospeccoesAtivas}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Confirmados:</span>
                <span className="font-semibold text-green-600">34</span>
              </div>
            </div>
          </DashboardCard>

          {/* Central de Atendimento */}
          <DashboardCard
            title="Central de Atendimento"
            icon={Headphones}
            actionText="Ver Atendimentos"
          >
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Leads Abertos:</span>
                <span className="font-semibold">{mockKPIs.leadsAbertos}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Em Andamento:</span>
                <span className="font-semibold text-blue-600">67</span>
              </div>
            </div>
          </DashboardCard>

          {/* Loja */}
          <DashboardCard
            title="Loja"
            icon={Store}
            actionText="Ver Loja"
          >
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Vendas Mês:</span>
                <span className="font-semibold text-green-600">{mockKPIs.vendasMes}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Em Negociação:</span>
                <span className="font-semibold text-orange-600">23</span>
              </div>
            </div>
          </DashboardCard>

          {/* Busca & Resgate */}
          <DashboardCard
            title="Busca & Resgate"
            icon={Search}
            actionText="Ver B&R"
          >
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Eventos Ativos:</span>
                <span className="font-semibold">18</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Concluídos:</span>
                <span className="font-semibold text-green-600">5</span>
              </div>
            </div>
          </DashboardCard>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
