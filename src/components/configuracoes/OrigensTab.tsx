import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

interface Origem {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  ordem: number;
}

export function OrigensTab() {
  const { activeCompany } = useCompany();
  const [origens, setOrigens] = useState<Origem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedOrigem, setSelectedOrigem] = useState<Origem | null>(null);
  const [formData, setFormData] = useState({ nome: "", descricao: "", ativo: true });
  const [saving, setSaving] = useState(false);

  const fetchOrigens = async () => {
    if (!activeCompany?.id) {
      setOrigens([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('origens_lead')
        .select('*')
        .eq('empresa_id', activeCompany.id)
        .order('ordem');

      if (error) throw error;
      setOrigens(data || []);
    } catch (error) {
      console.error("Error fetching origens:", error);
      toast.error("Erro ao carregar origens");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrigens();
  }, [activeCompany?.id]);

  const handleNew = () => {
    setSelectedOrigem(null);
    setFormData({ nome: "", descricao: "", ativo: true });
    setModalOpen(true);
  };

  const handleEdit = (origem: Origem) => {
    setSelectedOrigem(origem);
    setFormData({ nome: origem.nome, descricao: origem.descricao || "", ativo: origem.ativo });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (!activeCompany?.id) {
      toast.error("Selecione uma empresa");
      return;
    }

    setSaving(true);
    try {
      if (selectedOrigem) {
        const { error } = await supabase
          .from('origens_lead')
          .update({ nome: formData.nome, descricao: formData.descricao || null, ativo: formData.ativo })
          .eq('id', selectedOrigem.id);
        if (error) throw error;
        toast.success("Origem atualizada");
      } else {
        const { error } = await supabase
          .from('origens_lead')
          .insert([{ nome: formData.nome, descricao: formData.descricao || null, ativo: formData.ativo, empresa_id: activeCompany.id, ordem: origens.length }]);
        if (error) throw error;
        toast.success("Origem criada");
      }
      setModalOpen(false);
      fetchOrigens();
    } catch (error: any) {
      console.error("Error saving origem:", error);
      toast.error(error.message || "Erro ao salvar origem");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedOrigem) return;
    try {
      const { error } = await supabase.from('origens_lead').delete().eq('id', selectedOrigem.id);
      if (error) throw error;
      toast.success("Origem excluída");
      fetchOrigens();
    } catch (error) {
      console.error("Error deleting origem:", error);
      toast.error("Erro ao excluir origem");
    } finally {
      setDeleteDialogOpen(false);
      setSelectedOrigem(null);
    }
  };

  const confirmDelete = (origem: Origem) => {
    setSelectedOrigem(origem);
    setDeleteDialogOpen(true);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Origens de Lead</h3>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Origem
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : origens.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma origem cadastrada</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {origens.map((origem) => (
              <TableRow key={origem.id}>
                <TableCell className="font-medium">{origem.nome}</TableCell>
                <TableCell className="text-muted-foreground">{origem.descricao || '-'}</TableCell>
                <TableCell>
                  <span className={origem.ativo ? "text-green-600" : "text-muted-foreground"}>
                    {origem.ativo ? "Ativo" : "Inativo"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(origem)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => confirmDelete(origem)}>
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
            <DialogTitle>{selectedOrigem ? "Editar Origem" : "Nova Origem"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Site, WhatsApp, Instagram"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição opcional"
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
            <AlertDialogTitle>Excluir Origem</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{selectedOrigem?.nome}"?
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
