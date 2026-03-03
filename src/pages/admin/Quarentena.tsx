import { RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuarentenaStats } from "@/components/quarentena/QuarentenaStats";
import { QuarentenaFilters } from "@/components/quarentena/QuarentenaFilters";
import { QuarentenaTable } from "@/components/quarentena/QuarentenaTable";
import { QuarentenaLogs } from "@/components/quarentena/QuarentenaLogs";
import { useQuarentenaData, getQuarentenaStatus } from "@/hooks/useQuarentenaData";

const Quarentena = () => {
  const {
    items, allFiltered, loading, filters, setFilters,
    page, setPage, totalPages,
    stats, availableMarcas, availableLojas,
    sortColumn, sortDirection, toggleSort,
    handleDeactivate, handleDeactivateFiltered, reload,
  } = useQuarentenaData();

  const activeFilteredCount = allFiltered.filter(i => getQuarentenaStatus(i).status === "ativo").length;

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
                totalFiltered={allFiltered.length}
                activeFilteredCount={activeFilteredCount}
              />

              <div className="bg-card border rounded-lg p-4 text-sm text-muted-foreground">
                <p><strong>Como funciona:</strong> Após o término de um evento, os contatos impactados ficam bloqueados por 30 dias para a mesma marca.
                Durante esse período, não podem ser importados em novos eventos da marca. Bases de teste são ignoradas pela regra de quarentena.
                Ao desativar um contato, ele poderá ser impactado novamente imediatamente.</p>
              </div>
            </TabsContent>

            <TabsContent value="logs">
              <QuarentenaLogs />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default Quarentena;
