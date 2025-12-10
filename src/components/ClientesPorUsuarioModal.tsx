import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollIndicator } from '@/components/ui/scroll-indicator';
import { User } from 'lucide-react';

interface UsuarioClientes {
  id: string;
  nome: string;
  tipoAcesso: string;
  totalClientes: number;
  novos: number;
  atribuidos: number;
  emEspera: number;
  convidados: number;
}

interface ClientesPorUsuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  usuarios: UsuarioClientes[];
}

export const ClientesPorUsuarioModal: React.FC<ClientesPorUsuarioModalProps> = ({
  isOpen,
  onClose,
  usuarios
}) => {
  const totalGeral = usuarios.reduce((acc, u) => acc + u.totalClientes, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Clientes por Usuário
          </DialogTitle>
        </DialogHeader>

        <ScrollIndicator className="flex-1 min-h-0">
          {usuarios.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum usuário com clientes atribuídos.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Novos</TableHead>
                  <TableHead className="text-center">Atribuídos</TableHead>
                  <TableHead className="text-center">Em Espera</TableHead>
                  <TableHead className="text-center">Convidados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios.map((usuario) => (
                  <TableRow key={usuario.id}>
                    <TableCell>
                      <div>
                        <div className="font-bold">{usuario.nome}</div>
                        <div className="text-sm text-muted-foreground">{usuario.tipoAcesso}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-bold">
                        {usuario.totalClientes}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{usuario.novos}</TableCell>
                    <TableCell className="text-center">{usuario.atribuidos}</TableCell>
                    <TableCell className="text-center">{usuario.emEspera}</TableCell>
                    <TableCell className="text-center">{usuario.convidados}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>Total Geral</TableCell>
                  <TableCell className="text-center">{totalGeral}</TableCell>
                  <TableCell className="text-center">
                    {usuarios.reduce((acc, u) => acc + u.novos, 0)}
                  </TableCell>
                  <TableCell className="text-center">
                    {usuarios.reduce((acc, u) => acc + u.atribuidos, 0)}
                  </TableCell>
                  <TableCell className="text-center">
                    {usuarios.reduce((acc, u) => acc + u.emEspera, 0)}
                  </TableCell>
                  <TableCell className="text-center">
                    {usuarios.reduce((acc, u) => acc + u.convidados, 0)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </ScrollIndicator>
      </DialogContent>
    </Dialog>
  );
};
