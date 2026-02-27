import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

interface Departamento {
  id: string;
  nome: string;
  modelo_distribuicao: string;
  ativo: boolean;
}

const MODELOS_DISTRIBUICAO = ["Manual", "Fila de Vendedores", "Para Gerentes", "Round Robin"];

export function DepartamentosTab() {
  const { activeCompany } = useCompany();
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<Departamento | null>(null);
  const [formData, setFormData] = useState({ nome: "", modelo_distribuicao: "Manual", ativo: true });
  const [saving, setSaving] = useState(false);

  const fetchDepartamentos = async () => {
    if (!activeCompany?.id) {
      setDepartamentos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('departamentos')
        .select('*')
        .eq('empresa_id', activeCompany.id)
        .order('nome');

      if (error) throw error;
      setDepartamentos(data || []);
    } catch (error) {
      console.error("Error fetching departamentos:", error);
      toast.error("Erro ao carregar departamentos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartamentos();
  }, [activeCompany?.id]);

  const handleNew = () => {
    setSelectedDept(null);
    setFormData({ nome: "", modelo_distribuicao: "Manual", ativo: true });
    setModalOpen(true);
  };

  const handleEdit = (dept: Departamento) => {
    setSelectedDept(dept);
    setFormData({ nome: dept.nome, modelo_distribuicao: dept.modelo_distribuicao, ativo: dept.ativo });
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
      if (selectedDept) {
        const { error } = await supabase
          .from('departamentos')
          .update({ nome: formData.nome, modelo_distribuicao: formData.modelo_distribuicao, ativo: formData.ativo })
          .eq('id', selectedDept.id);
        if (error) throw error;
        toast.success("Departamento atualizado");
      } else {
        const { error } = await supabase
          .from('departamentos')
          .insert([{ nome: formData.nome, modelo_distribuicao: formData.modelo_distribuicao, ativo: formData.ativo, empresa_id: activeCompany.id }]);
        if (error) throw error;
        toast.success("Departamento criado");
      }
      setModalOpen(false);
      fetchDepartamentos();
    } catch (error: any) {
      console.error("Error saving departamento:", error);
      toast.error(error.message || "Erro ao salvar departamento");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDept) return;
    try {
      const { error } = await supabase.from('departamentos').delete().eq('id', selectedDept.id);
      if (error) throw error;
      toast.success("Departamento excluído");
      fetchDepartamentos();
    } catch (error) {
      console.error("Error deleting departamento:", error);
      toast.error("Erro ao excluir departamento");
    } finally {
      setDeleteDialogOpen(false);
      setSelectedDept(null);
    }
  };

  const confirmDelete = (dept: Departamento) => {
    setSelectedDept(dept);
    setDeleteDialogOpen(true);
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Departamentos</h3>
        </div>
        <Button onClick={handleNew} size="sm" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Novo Departamento
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : departamentos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum departamento cadastrado</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Modelo de Distribuição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departamentos.map((dept) => (
                <TableRow key={dept.id}>
                  <TableCell>{dept.nome}</TableCell>
                  <TableCell>{dept.modelo_distribuicao}</TableCell>
                  <TableCell>
                    <span className={dept.ativo ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                      {dept.ativo ? "Ativo" : "Desativado"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(dept)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => confirmDelete(dept)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedDept ? "Editar Departamento" : "Novo Departamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome do departamento"
              />
            </div>
            <div className="space-y-2">
              <Label>Modelo de Distribuição</Label>
              <Select value={formData.modelo_distribuicao} onValueChange={(value) => setFormData({ ...formData, modelo_distribuicao: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELOS_DISTRIBUICAO.map((modelo) => (
                    <SelectItem key={modelo} value={modelo}>{modelo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <AlertDialogTitle>Excluir Departamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{selectedDept?.nome}"?
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
