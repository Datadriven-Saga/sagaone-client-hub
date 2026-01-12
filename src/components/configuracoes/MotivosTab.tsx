import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

interface Motivo {
  id: string;
  descricao: string;
  ativo: boolean;
  ordem: number;
}

export function MotivosTab() {
  const { activeCompany } = useCompany();
  const [motivos, setMotivos] = useState<Motivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMotivo, setSelectedMotivo] = useState<Motivo | null>(null);
  const [formData, setFormData] = useState({ descricao: "", ativo: true });
  const [saving, setSaving] = useState(false);

  const fetchMotivos = async () => {
    if (!activeCompany?.id) {
      setMotivos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('motivos_insucesso')
        .select('*')
        .eq('empresa_id', activeCompany.id)
        .order('ordem');

      if (error) throw error;
      setMotivos(data || []);
    } catch (error) {
      console.error("Error fetching motivos:", error);
      toast.error("Erro ao carregar motivos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMotivos();
  }, [activeCompany?.id]);

  const handleNew = () => {
    setSelectedMotivo(null);
    setFormData({ descricao: "", ativo: true });
    setModalOpen(true);
  };

  const handleEdit = (motivo: Motivo) => {
    setSelectedMotivo(motivo);
    setFormData({ descricao: motivo.descricao, ativo: motivo.ativo });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.descricao.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }

    if (!activeCompany?.id) {
      toast.error("Selecione uma empresa");
      return;
    }

    setSaving(true);
    try {
      if (selectedMotivo) {
        const { error } = await supabase
          .from('motivos_insucesso')
          .update({ descricao: formData.descricao, ativo: formData.ativo })
          .eq('id', selectedMotivo.id);
        if (error) throw error;
        toast.success("Motivo atualizado");
      } else {
        const { error } = await supabase
          .from('motivos_insucesso')
          .insert([{ descricao: formData.descricao, ativo: formData.ativo, empresa_id: activeCompany.id, ordem: motivos.length }]);
        if (error) throw error;
        toast.success("Motivo criado");
      }
      setModalOpen(false);
      fetchMotivos();
    } catch (error: any) {
      console.error("Error saving motivo:", error);
      toast.error(error.message || "Erro ao salvar motivo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMotivo) return;
    try {
      const { error } = await supabase.from('motivos_insucesso').delete().eq('id', selectedMotivo.id);
      if (error) throw error;
      toast.success("Motivo excluído");
      fetchMotivos();
    } catch (error) {
      console.error("Error deleting motivo:", error);
      toast.error("Erro ao excluir motivo");
    } finally {
      setDeleteDialogOpen(false);
      setSelectedMotivo(null);
    }
  };

  const confirmDelete = (motivo: Motivo) => {
    setSelectedMotivo(motivo);
    setDeleteDialogOpen(true);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <X className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Motivos de Insucesso</h3>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Motivo
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : motivos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <X className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum motivo cadastrado</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {motivos.map((motivo) => (
              <TableRow key={motivo.id}>
                <TableCell>{motivo.descricao}</TableCell>
                <TableCell>
                  <span className={motivo.ativo ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                    {motivo.ativo ? "Ativo" : "Desativado"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(motivo)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => confirmDelete(motivo)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedMotivo ? "Editar Motivo" : "Novo Motivo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição do motivo"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formData.ativo} onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })} />
              <Label>Ativo</Label>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Motivo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{selectedMotivo?.descricao}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
