import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollIndicator } from '@/components/ui/scroll-indicator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ImportacaoHistorico {
  id: string;
  data: string;
  campanha: string;
  quantidade: number;
  usuario: string;
}

interface HistoricoImportacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  historico: ImportacaoHistorico[];
}

export const HistoricoImportacaoModal: React.FC<HistoricoImportacaoModalProps> = ({
  isOpen,
  onClose,
  historico
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Histórico de Importação</DialogTitle>
        </DialogHeader>

        <ScrollIndicator className="flex-1 min-h-0">
          {historico.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma importação realizada ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Usuário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {format(new Date(item.data), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{item.campanha}</TableCell>
                    <TableCell>{item.quantidade} contatos</TableCell>
                    <TableCell>{item.usuario}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollIndicator>
      </DialogContent>
    </Dialog>
  );
};
