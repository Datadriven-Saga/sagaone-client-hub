import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpDown, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { QuarentenaItem, getQuarentenaStatus, QuarentenaStatus } from "@/hooks/useQuarentenaData";

interface Props {
  items: QuarentenaItem[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  sortColumn: string;
  sortDirection: "asc" | "desc";
  onToggleSort: (col: string) => void;
  onDeactivate: (ids: string[]) => Promise<void>;
  onDeactivateFiltered: () => Promise<void>;
  totalFiltered: number;
  activeFilteredCount: number;
}

const statusBadgeVariant: Record<QuarentenaStatus, "destructive" | "secondary" | "outline"> = {
  ativo: "destructive",
  expirado: "secondary",
  desativado: "outline",
};

function SortableHeader({ label, column, active, direction, onToggle }: { label: string; column: string; active: boolean; direction: string; onToggle: (c: string) => void }) {
  return (
    <TableHead className="cursor-pointer select-none" onClick={() => onToggle(column)}>
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active ? "text-foreground" : "text-muted-foreground/50"}`} />
      </div>
    </TableHead>
  );
}

export function QuarentenaTable({
  items, loading, page, totalPages, onPageChange,
  sortColumn, sortDirection, onToggleSort,
  onDeactivate, onDeactivateFiltered, totalFiltered, activeFilteredCount,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeactivating, setBulkDeactivating] = useState(false);

  const allSelected = items.length > 0 && items.every(i => selected.has(i.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(i => i.id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleBulkDeactivate = async () => {
    setBulkDeactivating(true);
    await onDeactivate(Array.from(selected));
    setSelected(new Set());
    setBulkDeactivating(false);
  };

  const handleDeactivateAll = async () => {
    setBulkDeactivating(true);
    await onDeactivateFiltered();
    setSelected(new Set());
    setBulkDeactivating(false);
  };

  const selectedActiveCount = Array.from(selected).filter(id => {
    const item = items.find(i => i.id === id);
    return item && getQuarentenaStatus(item, (item as any).dias_config).status === "ativo";
  }).length;

  return (
    <div className="space-y-3">
      {/* Bulk actions bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={selectedActiveCount === 0}>
                  <ShieldOff className="h-4 w-4 mr-1" />
                  Desativar selecionados ({selectedActiveCount})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>⚠️ Desativar quarentena em massa?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Você está prestes a desativar a quarentena de <strong>{selectedActiveCount}</strong> contato(s).
                    Eles poderão ser impactados novamente imediatamente. Esta ação será registrada nos logs.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBulkDeactivate}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={bulkDeactivating}
                  >
                    {bulkDeactivating ? "Processando..." : "Confirmar desativação"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" disabled={activeFilteredCount === 0}>
              <ShieldOff className="h-4 w-4 mr-1" />
              Desativar toda base filtrada ({activeFilteredCount})
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>🚨 Ação crítica — Desativar toda a base filtrada</AlertDialogTitle>
              <AlertDialogDescription>
                Você está prestes a desativar a quarentena de <strong>{activeFilteredCount}</strong> contatos ativos
                que correspondem aos filtros atuais. Todos poderão ser reimpactados imediatamente. Tem certeza?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeactivateAll}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={bulkDeactivating}
              >
                {bulkDeactivating ? "Processando..." : `Desativar ${activeFilteredCount} contatos`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </TableHead>
              <SortableHeader label="Telefone" column="telefone_normalizado" active={sortColumn === "telefone_normalizado"} direction={sortDirection} onToggle={onToggleSort} />
              <SortableHeader label="Marca" column="marca" active={sortColumn === "marca"} direction={sortDirection} onToggle={onToggleSort} />
              <TableHead>Canal</TableHead>
              <SortableHeader label="Loja" column="empresa_nome" active={sortColumn === "empresa_nome"} direction={sortDirection} onToggle={onToggleSort} />
              <SortableHeader label="Evento" column="evento_nome" active={sortColumn === "evento_nome"} direction={sortDirection} onToggle={onToggleSort} />
              <SortableHeader label="Último Impacto" column="ultimo_impacto_at" active={sortColumn === "ultimo_impacto_at"} direction={sortDirection} onToggle={onToggleSort} />
              <SortableHeader label="Fim Evento" column="data_fim_evento" active={sortColumn === "data_fim_evento"} direction={sortDirection} onToggle={onToggleSort} />
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                 <TableCell colSpan={10} className="text-center py-8">
                   <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
               <TableRow>
                 <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                   Nenhum registro de quarentena encontrado
                </TableCell>
              </TableRow>
            ) : (
              items.map(item => {
                const diasConfig = (item as any).dias_config;
                const status = getQuarentenaStatus(item, diasConfig);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggle(item.id)} />
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.telefone_normalizado}</TableCell>
                    <TableCell>
                      {item.marca ? <Badge variant="outline">{item.marca}</Badge> : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.canal === "ligacao" ? "secondary" : "default"} className="text-xs">
                        {item.canal === "ligacao" ? "Ligação" : "WhatsApp"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate">{item.empresa_nome || "-"}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm">{item.evento_nome || "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(item.ultimo_impacto_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.data_fim_evento ? format(new Date(item.data_fim_evento), "dd/MM/yy", { locale: ptBR }) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant[status.status]} className="text-xs">
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {status.status === "ativo" ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                              <ShieldOff className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Desativar quarentena?</AlertDialogTitle>
                              <AlertDialogDescription>
                                O contato <strong>{item.telefone_normalizado}</strong> poderá ser impactado novamente
                                por eventos da marca <strong>{item.marca || "N/A"}</strong>.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onDeactivate([item.id])}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Desativar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => onPageChange(Math.max(1, page - 1))}
                className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <PaginationItem key={pageNum}>
                  <PaginationLink
                    isActive={pageNum === page}
                    onClick={() => onPageChange(pageNum)}
                    className="cursor-pointer"
                  >
                    {pageNum}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            <PaginationItem>
              <PaginationNext
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
