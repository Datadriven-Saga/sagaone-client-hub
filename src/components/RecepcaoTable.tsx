import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, Calendar, Phone, User, Tag, Building2 } from "lucide-react";
import { RecepcaoVisita } from "@/hooks/useRecepcaoData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RecepcaoTableProps {
  visitas: RecepcaoVisita[];
  onDelete: (visitaId: string) => void;
  searchFilter?: string;
}

export const RecepcaoTable = ({ visitas, onDelete, searchFilter = "" }: RecepcaoTableProps) => {
  const [visitaParaExcluir, setVisitaParaExcluir] = useState<string | null>(null);

  const visitasFiltradas = visitas.filter(visita => {
    if (!searchFilter) return true;
    
    const searchLower = searchFilter.toLowerCase();
    return (
      visita.nome_cliente.toLowerCase().includes(searchLower) ||
      visita.telefone_cliente.includes(searchLower) ||
      visita.nome_campanha.toLowerCase().includes(searchLower) ||
      visita.empresa_id.toLowerCase().includes(searchLower) ||
      (visita.id_maia && visita.id_maia.toLowerCase().includes(searchLower))
    );
  });

  if (visitasFiltradas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <User className="w-8 h-8 text-muted-foreground" />
        </div>
        {searchFilter ? (
          <>
            <p className="text-muted-foreground font-medium">Nenhuma visita encontrada</p>
            <p className="text-sm text-muted-foreground mt-1">Tente ajustar os filtros</p>
          </>
        ) : (
          <>
            <p className="text-muted-foreground font-medium">Nenhuma visita registrada</p>
            <p className="text-sm text-muted-foreground mt-1">Registre uma visita ou leia um QR Code</p>
          </>
        )}
      </div>
    );
  }

  // Mobile card view
  const MobileCard = ({ visita }: { visita: RecepcaoVisita }) => (
    <div className="bg-card border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{visita.nome_cliente}</p>
            <p className="text-sm text-muted-foreground">{visita.telefone_cliente}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setVisitaParaExcluir(visita.id)}
          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
        >
          <Trash2 size={16} />
        </Button>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Tag className="w-3.5 h-3.5" />
          <span className="truncate">{visita.nome_campanha}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          <span>{format(new Date(visita.data_hora_visita), "dd/MM HH:mm", { locale: ptBR })}</span>
        </div>
      </div>
      
      {visita.id_maia && (
        <div className="text-xs text-muted-foreground pt-1 border-t">
          ID Maia: {visita.id_maia}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile view - cards */}
      <div className="block sm:hidden space-y-3">
        {visitasFiltradas.map((visita) => (
          <MobileCard key={visita.id} visita={visita} />
        ))}
      </div>

      {/* Desktop view - table */}
      <div className="hidden sm:block border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Cliente</TableHead>
              <TableHead className="font-semibold">Telefone</TableHead>
              <TableHead className="font-semibold">Campanha</TableHead>
              <TableHead className="font-semibold hidden lg:table-cell">ID Maia</TableHead>
              <TableHead className="font-semibold">Data/Hora</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visitasFiltradas.map((visita) => (
              <TableRow key={visita.id} className="hover:bg-muted/30">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <span className="font-medium">{visita.nome_cliente}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{visita.telefone_cliente}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                    {visita.nome_campanha}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground hidden lg:table-cell">
                  {visita.id_maia || "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(visita.data_hora_visita), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setVisitaParaExcluir(visita.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 size={16} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={!!visitaParaExcluir}
        onOpenChange={(open) => !open && setVisitaParaExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir visita</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta visita? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (visitaParaExcluir) {
                  onDelete(visitaParaExcluir);
                  setVisitaParaExcluir(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
