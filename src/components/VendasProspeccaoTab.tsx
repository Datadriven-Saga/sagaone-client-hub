import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollIndicator } from '@/components/ui/scroll-indicator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DollarSign, MoreVertical, Edit, Trash2, Printer, Upload, FileImage, ExternalLink } from 'lucide-react';
import { VendaProspeccao, useVendasProspeccao } from '@/hooks/useVendasProspeccao';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ProspeccaoGlobalFilters } from './ProspeccaoGlobalFilter';

interface VendasProspeccaoTabProps {
  globalFilters: ProspeccaoGlobalFilters;
}

export function VendasProspeccaoTab({ globalFilters }: VendasProspeccaoTabProps) {
  const { vendas, loading, atualizarVenda, excluirVenda } = useVendasProspeccao();
  const { toast } = useToast();
  const [editingVenda, setEditingVenda] = useState<VendaProspeccao | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    data_venda: '',
    valor_venda: '',
  });
  const [uploadingComprovante, setUploadingComprovante] = useState<string | null>(null);

  // Apply global filters
  const filteredVendas = useMemo(() => {
    let result = [...vendas];

    // Filter by prospeccao
    if (globalFilters.prospeccaoId && globalFilters.prospeccaoId !== 'todos') {
      result = result.filter(v => v.prospeccao_id === globalFilters.prospeccaoId);
    }

    // Filter by responsavel
    if (globalFilters.responsavelId && globalFilters.responsavelId !== 'todos') {
      result = result.filter(v => v.responsavel_id === globalFilters.responsavelId);
    }

    // Filter by date range
    if (globalFilters.dataInicio) {
      result = result.filter(v => v.data_venda >= globalFilters.dataInicio);
    }
    if (globalFilters.dataFim) {
      result = result.filter(v => v.data_venda <= globalFilters.dataFim);
    }

    // Filter by dados lead (search in cliente_nome, cliente_telefone)
    if (globalFilters.dadosLead) {
      const searchLower = globalFilters.dadosLead.toLowerCase();
      result = result.filter(v => 
        v.cliente_nome.toLowerCase().includes(searchLower) ||
        (v.cliente_telefone && v.cliente_telefone.includes(globalFilters.dadosLead)) ||
        v.numero_venda.toString().includes(globalFilters.dadosLead)
      );
    }

    return result;
  }, [vendas, globalFilters]);

  const handleEdit = (venda: VendaProspeccao) => {
    setEditingVenda(venda);
    setEditForm({
      data_venda: venda.data_venda,
      valor_venda: venda.valor_venda ? venda.valor_venda.toString() : '',
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingVenda) return;

    try {
      await atualizarVenda(editingVenda.id, {
        data_venda: editForm.data_venda,
        valor_venda: editForm.valor_venda ? parseFloat(editForm.valor_venda) : null,
      });
      toast({
        title: 'Venda atualizada',
        description: 'Os dados da venda foram atualizados com sucesso.',
      });
      setIsEditModalOpen(false);
      setEditingVenda(null);
    } catch (error) {
      console.error('Erro ao atualizar venda:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a venda.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (vendaId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta venda?')) return;

    try {
      await excluirVenda(vendaId);
      toast({
        title: 'Venda excluída',
        description: 'A venda foi removida com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao excluir venda:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a venda.',
        variant: 'destructive',
      });
    }
  };

  const handleUploadComprovante = async (vendaId: string, file: File) => {
    try {
      setUploadingComprovante(vendaId);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${vendaId}-${Date.now()}.${fileExt}`;
      const filePath = `comprovantes/${fileName}`;

      // Upload to storage (assuming bucket exists or we create one)
      const { error: uploadError } = await supabase.storage
        .from('vendas-comprovantes')
        .upload(filePath, file);

      if (uploadError) {
        // Try to create bucket if it doesn't exist
        if (uploadError.message.includes('Bucket not found')) {
          toast({
            title: 'Bucket não encontrado',
            description: 'Entre em contato com o administrador para configurar o storage.',
            variant: 'destructive',
          });
          return;
        }
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('vendas-comprovantes')
        .getPublicUrl(filePath);

      // Update venda with comprovante URL
      await atualizarVenda(vendaId, {
        comprovante_url: urlData.publicUrl,
      });

      toast({
        title: 'Comprovante enviado',
        description: 'O comprovante foi anexado à venda com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: 'Erro no upload',
        description: 'Não foi possível enviar o comprovante.',
        variant: 'destructive',
      });
    } finally {
      setUploadingComprovante(null);
    }
  };

  const handlePrint = (venda: VendaProspeccao) => {
    // TODO: Implement +1 SAGA print template
    toast({
      title: 'Em desenvolvimento',
      description: 'A impressão do papel +1 SAGA será implementada em breve.',
    });
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <ScrollIndicator className="flex-1 h-full">
      <div className="space-y-3 pb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <DollarSign className="text-primary" size={20} />
              <div>
                <h3 className="text-base font-semibold text-foreground">Vendas Realizadas</h3>
                <p className="text-xs text-muted-foreground">
                  {filteredVendas.length} {filteredVendas.length === 1 ? 'venda registrada' : 'vendas registradas'}
                </p>
              </div>
            </div>
          </div>

          {vendas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="mx-auto h-12 w-12 mb-3 opacity-50" />
              <p className="font-medium">Nenhuma venda registrada</p>
              <p className="text-sm mt-1">As vendas são criadas automaticamente quando um lead é movido para o status "Vendas" com um produto selecionado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Nº</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Evento</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Telefone</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Vendedor</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Produto</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Departamento</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Data</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Valor</th>
                    <th className="text-center py-2 px-3 text-sm font-medium text-muted-foreground">Comprovante</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendas.map((venda) => (
                    <tr key={venda.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-primary/10 text-primary">
                          #{venda.numero_venda}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-sm">
                        {venda.prospeccao?.titulo || '-'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-medium text-sm">{venda.cliente_nome}</span>
                      </td>
                      <td className="py-3 px-3 text-sm text-muted-foreground">
                        {venda.cliente_telefone || '-'}
                      </td>
                      <td className="py-3 px-3 text-sm">
                        {venda.responsavel ? (
                          <div>
                            <span className="font-medium">{venda.responsavel.nome_completo}</span>
                            {venda.responsavel.tipo_acesso && (
                              <span className="block text-xs text-muted-foreground">{venda.responsavel.tipo_acesso}</span>
                            )}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-3 text-sm">
                        {venda.produto?.nome || '-'}
                      </td>
                      <td className="py-3 px-3 text-sm">
                        {venda.departamento?.nome || '-'}
                      </td>
                      <td className="py-3 px-3 text-sm text-muted-foreground">
                        {formatDate(venda.data_venda)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-medium text-sm text-green-600">
                          {formatCurrency(venda.valor_venda)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {venda.comprovante_url ? (
                          <a
                            href={venda.comprovante_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:text-primary/80"
                          >
                            <FileImage size={16} />
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*,.pdf"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadComprovante(venda.id, file);
                              }}
                              disabled={uploadingComprovante === venda.id}
                            />
                            <span className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
                              {uploadingComprovante === venda.id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                              ) : (
                                <Upload size={16} />
                              )}
                            </span>
                          </label>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(venda)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePrint(venda)}>
                              <Printer className="mr-2 h-4 w-4" />
                              Imprimir +1 SAGA
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(venda.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Venda #{editingVenda?.numero_venda}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Data da Venda</Label>
              <Input
                type="date"
                value={editForm.data_venda}
                onChange={(e) => setEditForm(prev => ({ ...prev, data_venda: e.target.value }))}
              />
            </div>
            <div>
              <Label>Valor da Venda (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={editForm.valor_venda}
                onChange={(e) => setEditForm(prev => ({ ...prev, valor_venda: e.target.value }))}
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
    </ScrollIndicator>
  );
}
