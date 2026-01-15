import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Edit, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Search,
  Users,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Contato } from '@/hooks/useContatoData';
import { format } from 'date-fns';

interface ClientesImportadosListProps {
  contatos: Contato[];
  prospeccoes: { id: string; titulo: string }[];
  prospeccaoId?: string;
  onEditContato: (contato: Contato) => void;
  onDeleteContato: (contatoId: string) => Promise<void>;
  onDeleteMultiplosContatos?: (contatoIds: string[]) => Promise<{ sucesso: number; falha: number }>;
  onDeleteAllContatos?: () => Promise<{ sucesso: number; falha: number }>;
  onReenviarGatilhos?: (contatoIds: string[], prospeccaoId: string) => Promise<{ sucesso: number; falha: number }>;
  onUpdateContato: (contatoId: string, data: Partial<Contato>) => Promise<boolean>;
}

const ITEMS_PER_PAGE = 10;

export const ClientesImportadosList = ({ 
  contatos, 
  prospeccoes,
  prospeccaoId,
  onEditContato,
  onDeleteContato,
  onDeleteMultiplosContatos,
  onDeleteAllContatos,
  onReenviarGatilhos,
  onUpdateContato
}: ClientesImportadosListProps) => {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProspeccao, setFilterProspeccao] = useState<string>('todos');
  const [editingContato, setEditingContato] = useState<Contato | null>(null);
  const [deleteContatoIds, setDeleteContatoIds] = useState<string[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedContatos, setSelectedContatos] = useState<Set<string>>(new Set());
  const [isReenviarModalOpen, setIsReenviarModalOpen] = useState(false);
  const [isReenviando, setIsReenviando] = useState(false);
  const [deleteAllMode, setDeleteAllMode] = useState(false);
  
  // Form state for editing
  const [editForm, setEditForm] = useState({
    nome: '',
    telefone: '',
    email: ''
  });

  // Filter and search contacts
  const filteredContatos = useMemo(() => {
    return contatos.filter(contato => {
      // Search filter
      const matchesSearch = !searchTerm || 
        contato.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (contato.telefone && contato.telefone.includes(searchTerm)) ||
        (contato.email && contato.email.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Prospeccao filter - we'd need prospeccao_id on contato for this to work properly
      // For now, show all if filterProspeccao is 'todos'
      const matchesProspeccao = filterProspeccao === 'todos';
      
      return matchesSearch && matchesProspeccao;
    });
  }, [contatos, searchTerm, filterProspeccao]);

  // Pagination
  const totalPages = Math.ceil(filteredContatos.length / ITEMS_PER_PAGE);
  const paginatedContatos = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredContatos.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredContatos, currentPage]);

  // Reset to page 1 when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm, filterProspeccao]);

  const handleEdit = (contato: Contato) => {
    setEditingContato(contato);
    setEditForm({
      nome: contato.nome,
      telefone: contato.telefone || '',
      email: contato.email || ''
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingContato) return;
    
    try {
      await onUpdateContato(editingContato.id, {
        nome: editForm.nome,
        telefone: editForm.telefone,
        email: editForm.email
      });
      
      toast({
        title: "Contato atualizado",
        description: "As alterações foram salvas com sucesso.",
      });
      
      setIsEditModalOpen(false);
      setEditingContato(null);
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive"
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteContatoIds.length === 0) return;

    setIsDeleting(true);
    try {
        // Modo "Excluir Todos" deve usar uma operação dedicada (sem lista gigante de IDs)
        if (deleteAllMode && onDeleteAllContatos) {
          const resultado = await onDeleteAllContatos();
          const hasFailures = resultado.falha > 0;

          toast({
            title: hasFailures ? "Exclusão parcial" : "Contatos excluídos",
            description: `${resultado.sucesso} excluídos com sucesso${hasFailures ? `, ${resultado.falha} falharam` : ''}.`,
            ...(hasFailures ? { variant: "destructive" as const } : {}),
          });
          setSelectedContatos(new Set());
        } else if (onDeleteMultiplosContatos && deleteContatoIds.length > 1) {
          const resultado = await onDeleteMultiplosContatos(deleteContatoIds);
          const hasFailures = resultado.falha > 0;

          toast({
            title: hasFailures ? "Exclusão parcial" : "Contatos excluídos",
            description: `${resultado.sucesso} excluídos com sucesso${hasFailures ? `, ${resultado.falha} falharam` : ''}.`,
            ...(hasFailures ? { variant: "destructive" as const } : {}),
          });

        // Limpar seleção após exclusão
        setSelectedContatos(prev => {
          const newSet = new Set(prev);
          deleteContatoIds.forEach(id => newSet.delete(id));
          return newSet;
        });
      } else {
        for (const id of deleteContatoIds) {
          await onDeleteContato(id);
        }
        toast({
          title: deleteContatoIds.length === 1 ? "Contato excluído" : "Contatos excluídos",
          description:
            deleteContatoIds.length === 1
              ? "O contato foi removido com sucesso."
              : `${deleteContatoIds.length} contatos foram removidos com sucesso.`,
        });

        // Limpar seleção após exclusão
        setSelectedContatos(prev => {
          const newSet = new Set(prev);
          deleteContatoIds.forEach(id => newSet.delete(id));
          return newSet;
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o(s) contato(s).",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setDeleteContatoIds([]);
      setDeleteAllMode(false);
    }
  };

  const handleSelectContato = (contatoId: string, checked: boolean) => {
    setSelectedContatos(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(contatoId);
      } else {
        newSet.delete(contatoId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Seleciona TODOS os contatos filtrados, não apenas a página atual
      setSelectedContatos(new Set(filteredContatos.map(c => c.id)));
    } else {
      setSelectedContatos(new Set());
    }
  };

  const handleDeleteSelected = () => {
    if (selectedContatos.size > 0) {
      setDeleteContatoIds(Array.from(selectedContatos));
    }
  };

  const handleDeleteAll = () => {
    setDeleteAllMode(true);
    setDeleteContatoIds(contatos.map(c => c.id));
  };

  const handleReenviarGatilhos = async () => {
    if (!onReenviarGatilhos || !prospeccaoId) {
      toast({ title: "Erro", description: "Função não disponível", variant: "destructive" });
      return;
    }

    setIsReenviando(true);
    try {
      const idsParaReenviar = selectedContatos.size > 0 
        ? Array.from(selectedContatos)
        : contatos.map(c => c.id);
      
      const resultado = await onReenviarGatilhos(idsParaReenviar, prospeccaoId);
      
      toast({
        title: "Gatilhos reenviados",
        description: `${resultado.sucesso} enviados com sucesso${resultado.falha > 0 ? `, ${resultado.falha} falharam` : ''}.`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao reenviar gatilhos",
        variant: "destructive"
      });
    } finally {
      setIsReenviando(false);
      setIsReenviarModalOpen(false);
    }
  };

  const allPageSelected = paginatedContatos.length > 0 && 
    paginatedContatos.every(c => selectedContatos.has(c.id));
  
  const allSelected = filteredContatos.length > 0 && 
    filteredContatos.every(c => selectedContatos.has(c.id));

  if (contatos.length === 0) {
    return null;
  }

  return (
    <Card className="p-4 mt-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h4 className="font-medium text-sm">Clientes Importados ({contatos.length})</h4>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Botão Reenviar Gatilhos */}
          {onReenviarGatilhos && prospeccaoId && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsReenviarModalOpen(true)}
              disabled={isReenviando}
            >
              {isReenviando ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Reenviar Gatilhos {selectedContatos.size > 0 ? `(${selectedContatos.size})` : `(${contatos.length})`}
            </Button>
          )}
          
          {/* Botão Excluir Todos */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleDeleteAll}
            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir Todos ({contatos.length})
          </Button>

          {/* Botão Excluir Selecionados */}
          {selectedContatos.size > 0 && (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleDeleteSelected}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir {selectedContatos.size} selecionado{selectedContatos.size > 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterProspeccao} onValueChange={setFilterProspeccao}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrar por evento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os eventos</SelectItem>
            {prospeccoes.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  title={allSelected ? "Desmarcar todos" : `Selecionar todos (${filteredContatos.length})`}
                />
              </TableHead>
              <TableHead className="w-[200px]">Nome</TableHead>
              <TableHead className="w-[150px]">Telefone</TableHead>
              <TableHead className="w-[200px]">E-mail</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[120px]">Data Criação</TableHead>
              <TableHead className="w-[100px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedContatos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum contato encontrado
                </TableCell>
              </TableRow>
            ) : (
              paginatedContatos.map((contato) => (
                <TableRow key={contato.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedContatos.has(contato.id)}
                      onCheckedChange={(checked) => handleSelectContato(contato.id, !!checked)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{contato.nome}</TableCell>
                  <TableCell>{contato.telefone || '-'}</TableCell>
                  <TableCell>{contato.email || '-'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      contato.status === 'Novo' ? 'bg-blue-100 text-blue-700' :
                      contato.status === 'Venda' ? 'bg-green-100 text-green-700' :
                      contato.status === 'Descartado' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {contato.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {contato.created_at ? format(new Date(contato.created_at), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleEdit(contato)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteContatoIds([contato.id])}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredContatos.length)} de {filteredContatos.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Contato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-nome">Nome</Label>
              <Input
                id="edit-nome"
                value={editForm.nome}
                onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-telefone">Telefone</Label>
              <Input
                id="edit-telefone"
                value={editForm.telefone}
                onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-email">E-mail</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteContatoIds.length > 0} onOpenChange={(open) => { if (!open) { setDeleteContatoIds([]); setDeleteAllMode(false); }}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteAllMode 
                ? `Excluir todos os ${deleteContatoIds.length} contatos?` 
                : deleteContatoIds.length === 1 
                  ? 'Excluir contato?' 
                  : `Excluir ${deleteContatoIds.length} contatos?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. {deleteAllMode
                ? `Todos os ${deleteContatoIds.length} contatos desta prospecção serão removidos permanentemente.`
                : deleteContatoIds.length === 1 
                  ? 'O contato será removido permanentemente do sistema.'
                  : `Os ${deleteContatoIds.length} contatos selecionados serão removidos permanentemente do sistema.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete} 
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reenviar Gatilhos Confirmation */}
      <AlertDialog open={isReenviarModalOpen} onOpenChange={setIsReenviarModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reenviar gatilhos?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedContatos.size > 0
                ? `Os gatilhos serão reenviados para ${selectedContatos.size} contatos selecionados.`
                : `Os gatilhos serão reenviados para todos os ${contatos.length} contatos desta prospecção.`}
              {' '}Isso irá disparar novamente os webhooks de criação de contato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReenviando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReenviarGatilhos}
              disabled={isReenviando}
            >
              {isReenviando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reenviando...
                </>
              ) : 'Reenviar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
