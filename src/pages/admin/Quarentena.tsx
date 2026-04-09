import { RefreshCw, AlertTriangle, Settings } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuarentenaStats } from "@/components/quarentena/QuarentenaStats";
import { QuarentenaFilters } from "@/components/quarentena/QuarentenaFilters";
import { QuarentenaTable } from "@/components/quarentena/QuarentenaTable";
import { QuarentenaLogs } from "@/components/quarentena/QuarentenaLogs";
import { QuarentenaConfigTab } from "@/components/quarentena/QuarentenaConfigTab";
import { useQuarentenaData } from "@/hooks/useQuarentenaData";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Quarentena = () => {
  const { permissions, loading: accessLoading } = useUserAccessType();
  const canAccess = permissions.canGovernancaDados || permissions.canAccessAdminConfig;

  const {
    items, loading, filters, setFilters,
    page, setPage, totalPages,
    stats, availableMarcas, availableLojas,
    sortColumn, sortDirection, toggleSort,
    handleDeactivate, handleDeactivateFiltered,
    activeFilteredCount, reload,
  } = useQuarentenaData();

  if (accessLoading) {
    return (
      <DashboardLayout title="Quarentena de Contatos">
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!canAccess) {
    return (
      <DashboardLayout title="Quarentena de Contatos">
        <div className="space-y-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Você não tem permissão para acessar este módulo. Apenas perfis <strong>Administrador</strong> e <strong>CRM</strong> podem visualizar a quarentena.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }
  const totalFiltered = stats.total;

  return (
    <DashboardLayout title="Quarentena de Contatos">
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
          <QuarentenaStats {...stats} />

          <Tabs defaultValue="quarentena">
            <div className="flex items-center justify-between gap-2">
              <TabsList>
                <TabsTrigger value="quarentena">Quarentena</TabsTrigger>
                <TabsTrigger value="logs">Histórico / Logs</TabsTrigger>
                <TabsTrigger value="config" className="gap-1">
                  <Settings className="h-3.5 w-3.5" />
                  Configurações
                </TabsTrigger>
              </TabsList>
              <Button variant="outline" size="icon" onClick={reload} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            <TabsContent value="quarentena" className="space-y-4">
              <QuarentenaFilters
                filters={filters}
                onFiltersChange={setFilters}
                availableMarcas={availableMarcas}
                availableLojas={availableLojas}
              />
              <QuarentenaTable
                items={items}
                loading={loading}
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onToggleSort={toggleSort}
                onDeactivate={handleDeactivate}
                onDeactivateFiltered={handleDeactivateFiltered}
                totalFiltered={totalFiltered}
                activeFilteredCount={activeFilteredCount}
              />

              <div className="bg-card border rounded-lg p-4 text-sm text-muted-foreground">
                <p><strong>Como funciona:</strong> Após o término de um evento, os contatos impactados ficam bloqueados por canal (WhatsApp ou Ligação) separadamente, pelo prazo configurado (padrão: 20 dias WhatsApp, 30 dias Ligação).
                Um contato bloqueado via WhatsApp pode ser impactado via Ligação e vice-versa.
                Bases de teste são ignoradas pela regra de quarentena. Ao desativar um contato, ele poderá ser impactado novamente imediatamente.</p>
                Durante esse período, não podem ser importados em novos eventos da marca. Bases de teste são ignoradas pela regra de quarentena.
              </div>
            </TabsContent>

            <TabsContent value="logs">
              <QuarentenaLogs />
            </TabsContent>

            <TabsContent value="config">
              <QuarentenaConfigTab availableMarcas={availableMarcas} />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default Quarentena;
