import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil, Thermometer, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

interface Temperatura {
  id: string;
  nome: string;
  cor: string;
  ativo: boolean;
  ordem: number;
}

const CORES_SUGERIDAS = [
  { nome: "Vermelho", valor: "#ef4444" },
  { nome: "Laranja", valor: "#f97316" },
  { nome: "Amarelo", valor: "#eab308" },
  { nome: "Verde", valor: "#22c55e" },
  { nome: "Azul", valor: "#3b82f6" },
  { nome: "Cinza", valor: "#6b7280" }
];

export function TemperaturasTab() {
  const { activeCompany } = useCompany();
  const [temperaturas, setTemperaturas] = useState<Temperatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemp, setSelectedTemp] = useState<Temperatura | null>(null);
  const [formData, setFormData] = useState({ nome: "", cor: "#ef4444", ativo: true });
  const [saving, setSaving] = useState(false);

  const fetchTemperaturas = async () => {
    if (!activeCompany?.id) {
      setTemperaturas([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('temperaturas_lead')
        .select('*')
        .eq('empresa_id', activeCompany.id)
        .order('ordem');

      if (error) throw error;
      setTemperaturas(data || []);
    } catch (error) {
      console.error("Error fetching temperaturas:", error);
      toast.error("Erro ao carregar temperaturas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemperaturas();
  }, [activeCompany?.id]);

  const handleNew = () => {
    setSelectedTemp(null);
    setFormData({ nome: "", cor: "#ef4444", ativo: true });
    setModalOpen(true);
  };

  const handleEdit = (temp: Temperatura) => {
    setSelectedTemp(temp);
    setFormData({ nome: temp.nome, cor: temp.cor, ativo: temp.ativo });
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
      if (selectedTemp) {
        const { error } = await supabase
          .from('temperaturas_lead')
          .update({ nome: formData.nome, cor: formData.cor, ativo: formData.ativo })
          .eq('id', selectedTemp.id);
        if (error) throw error;
        toast.success("Temperatura atualizada");
      } else {
        const { error } = await supabase
          .from('temperaturas_lead')
          .insert([{ nome: formData.nome, cor: formData.cor, ativo: formData.ativo, empresa_id: activeCompany.id, ordem: temperaturas.length }]);
        if (error) throw error;
        toast.success("Temperatura criada");
      }
      setModalOpen(false);
      fetchTemperaturas();
    } catch (error: any) {
      console.error("Error saving temperatura:", error);
      toast.error(error.message || "Erro ao salvar temperatura");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemp) return;
    try {
      const { error } = await supabase.from('temperaturas_lead').delete().eq('id', selectedTemp.id);
      if (error) throw error;
      toast.success("Temperatura excluída");
      fetchTemperaturas();
    } catch (error) {
      console.error("Error deleting temperatura:", error);
      toast.error("Erro ao excluir temperatura");
    } finally {
      setDeleteDialogOpen(false);
      setSelectedTemp(null);
    }
  };

  const confirmDelete = (temp: Temperatura) => {
    setSelectedTemp(temp);
    setDeleteDialogOpen(true);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Thermometer className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Temperaturas</h3>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Temperatura
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : temperaturas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Thermometer className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma temperatura cadastrada</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Cor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {temperaturas.map((temp) => (
              <TableRow key={temp.id}>
                <TableCell>{temp.nome}</TableCell>
                <TableCell>
                  <Badge style={{ backgroundColor: temp.cor, color: 'white' }}>
                    {CORES_SUGERIDAS.find(c => c.valor === temp.cor)?.nome || temp.cor}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className={temp.ativo ? "text-green-600" : "text-muted-foreground"}>
                    {temp.ativo ? "Ativo" : "Inativo"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(temp)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => confirmDelete(temp)}>
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
            <DialogTitle>{selectedTemp ? "Editar Temperatura" : "Nova Temperatura"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Quente, Morno, Frio"
              />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {CORES_SUGERIDAS.map((cor) => (
                  <button
                    key={cor.valor}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${formData.cor === cor.valor ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: cor.valor }}
                    onClick={() => setFormData({ ...formData, cor: cor.valor })}
                    title={cor.nome}
                  />
                ))}
              </div>
              <Input
                type="color"
                value={formData.cor}
                onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                className="h-10 w-20 p-1"
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
            <AlertDialogTitle>Excluir Temperatura</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{selectedTemp?.nome}"?
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
