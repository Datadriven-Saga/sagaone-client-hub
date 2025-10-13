import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { RecepcaoVisita } from "@/hooks/useRecepcaoData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RecepcaoTableProps {
  visitas: RecepcaoVisita[];
  onDelete: (visitaId: string) => void;
  searchFilter?: string;
}

export const RecepcaoTable = ({ visitas, onDelete, searchFilter = "" }: RecepcaoTableProps) => {
  // Filtrar visitas baseado no searchFilter
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
      <div className="text-center py-12 text-muted-foreground">
        {searchFilter ? (
          <>
            <p>Nenhuma visita encontrada</p>
            <p className="text-sm mt-2">Tente ajustar os filtros de busca</p>
          </>
        ) : (
          <>
            <p>Nenhuma visita registrada ainda</p>
            <p className="text-sm mt-2">Clique em "Registrar Visita" para começar</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome do Cliente</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Campanha</TableHead>
            <TableHead>ID da Empresa</TableHead>
            <TableHead>ID da Maia</TableHead>
            <TableHead>Data/Hora da Visita</TableHead>
            <TableHead className="w-[100px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visitasFiltradas.map((visita) => (
            <TableRow key={visita.id}>
              <TableCell className="font-medium">{visita.nome_cliente}</TableCell>
              <TableCell>{visita.telefone_cliente}</TableCell>
              <TableCell>{visita.nome_campanha}</TableCell>
              <TableCell className="font-mono text-sm">{visita.empresa_id}</TableCell>
              <TableCell className="font-mono text-sm">{visita.id_maia || "-"}</TableCell>
              <TableCell>
                {format(new Date(visita.data_hora_visita), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(visita.id)}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={16} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
