import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil, Phone, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

interface WhatsApp {
  id: string;
  telefone: string;
  usuario_id: string | null;
  status: string;
  usuario_nome?: string;
}

interface Usuario {
  id: string;
  nome_completo: string;
}

export function WhatsAppTab() {
  const { activeCompany } = useCompany();
  const [whatsapps, setWhatsapps] = useState<WhatsApp[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedWhats, setSelectedWhats] = useState<WhatsApp | null>(null);
  const [formData, setFormData] = useState({ telefone: "", usuario_id: "", status: "Desconectado" });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!activeCompany?.id) {
      setWhatsapps([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch whatsapps
      const { data: whatsData, error: whatsError } = await supabase
        .from('whatsapp_vinculados')
        .select('*')
        .eq('empresa_id', activeCompany.id)
        .order('created_at');

      if (whatsError) throw whatsError;

      // Fetch usuarios
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, nome_completo')
        .eq('empresa_id', activeCompany.id)
        .eq('status', 'Ativo')
        .order('nome_completo');

      if (usersError) throw usersError;

      setUsuarios(usersData || []);

      // Map user names to whatsapps
      const whatsWithUsers = (whatsData || []).map(w => ({
        ...w,
        usuario_nome: usersData?.find(u => u.id === w.usuario_id)?.nome_completo
      }));

      setWhatsapps(whatsWithUsers);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeCompany?.id]);

  const handleNew = () => {
    setSelectedWhats(null);
    setFormData({ telefone: "", usuario_id: "", status: "Desconectado" });
    setModalOpen(true);
  };

  const handleEdit = (whats: WhatsApp) => {
    setSelectedWhats(whats);
    setFormData({ telefone: whats.telefone, usuario_id: whats.usuario_id || "", status: whats.status });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.telefone.trim()) {
      toast.error("Telefone é obrigatório");
      return;
    }

    if (!activeCompany?.id) {
      toast.error("Selecione uma empresa");
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        telefone: formData.telefone,
        usuario_id: formData.usuario_id || null,
        status: formData.status
      };

      if (selectedWhats) {
        const { error } = await supabase
          .from('whatsapp_vinculados')
          .update(dataToSave)
          .eq('id', selectedWhats.id);
        if (error) throw error;
        toast.success("WhatsApp atualizado");
      } else {
        const { error } = await supabase
          .from('whatsapp_vinculados')
          .insert([{ ...dataToSave, empresa_id: activeCompany.id }]);
        if (error) throw error;
        toast.success("WhatsApp adicionado");
      }
      setModalOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error saving whatsapp:", error);
      toast.error(error.message || "Erro ao salvar WhatsApp");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedWhats) return;
    try {
      const { error } = await supabase.from('whatsapp_vinculados').delete().eq('id', selectedWhats.id);
      if (error) throw error;
      toast.success("WhatsApp removido");
      fetchData();
    } catch (error) {
      console.error("Error deleting whatsapp:", error);
      toast.error("Erro ao remover WhatsApp");
    } finally {
      setDeleteDialogOpen(false);
      setSelectedWhats(null);
    }
  };

  const confirmDelete = (whats: WhatsApp) => {
    setSelectedWhats(whats);
    setDeleteDialogOpen(true);
  };

  const toggleStatus = async (whats: WhatsApp) => {
    const newStatus = whats.status === 'Conectado' ? 'Desconectado' : 'Conectado';
    try {
      const { error } = await supabase
        .from('whatsapp_vinculados')
        .update({ status: newStatus })
        .eq('id', whats.id);
      if (error) throw error;
      toast.success(`WhatsApp ${newStatus.toLowerCase()}`);
      fetchData();
    } catch (error) {
      console.error("Error toggling status:", error);
      toast.error("Erro ao alterar status");
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">WhatsApp Vinculados</h3>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar WhatsApp
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : whatsapps.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Phone className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum WhatsApp vinculado</p>
          <p className="text-sm">Clique em "Adicionar WhatsApp" para vincular um novo número</p>
        </div>
      ) : (
        <div className="space-y-4">
          {whatsapps.map((whats) => (
            <div key={whats.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">{whats.telefone}</p>
                <p className="text-sm text-muted-foreground">
                  {whats.usuario_nome || "Sem usuário vinculado"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={whats.status === 'Conectado' ? 'default' : 'secondary'}>
                  {whats.status}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => toggleStatus(whats)}>
                  {whats.status === 'Conectado' ? 'Desconectar' : 'Conectar'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleEdit(whats)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => confirmDelete(whats)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedWhats ? "Editar WhatsApp" : "Adicionar WhatsApp"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone *</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="+55 11 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label>Usuário Vinculado</Label>
              <Select value={formData.usuario_id} onValueChange={(value) => setFormData({ ...formData, usuario_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {usuarios.map((user) => (
                    <SelectItem key={user.id} value={user.id}>{user.nome_completo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Conectado">Conectado</SelectItem>
                  <SelectItem value="Desconectado">Desconectado</SelectItem>
                </SelectContent>
              </Select>
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
            <AlertDialogTitle>Remover WhatsApp</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o WhatsApp "{selectedWhats?.telefone}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
