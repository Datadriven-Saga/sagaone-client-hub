import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  ArrowUp, 
  ArrowDown, 
  Edit, 
  Trash2, 
  Ban, 
  CheckCircle, 
  Plus 
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface Variavel {
  id: string;
  ordem: number;
  nome: string;
  descricao: string;
  ativo: boolean;
}

interface AgenteVariaveisProps {
  agenteId: string;
}

export default function AgenteVariaveis({ agenteId }: AgenteVariaveisProps) {
  const [variaveis, setVariaveis] = useState<Variavel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingVariavel, setEditingVariavel] = useState<Variavel | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
  });

  useEffect(() => {
    carregarVariaveis();
  }, [agenteId]);

  const carregarVariaveis = async () => {
    try {
      const { data, error } = await supabase
        .from("agente_variaveis")
        .select("*")
        .eq("agente_id", agenteId)
        .order("ordem", { ascending: true });

      if (error) throw error;
      setVariaveis(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar variáveis: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (variavel?: Variavel) => {
    if (variavel) {
      setEditingVariavel(variavel);
      setFormData({
        nome: variavel.nome,
        descricao: variavel.descricao,
      });
    } else {
      setEditingVariavel(null);
      setFormData({
        nome: "",
        descricao: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      toast.error("Nome da variável é obrigatório");
      return;
    }

    try {
      if (editingVariavel) {
        // Editar variável existente
        const { error } = await supabase
          .from("agente_variaveis")
          .update({
            nome: formData.nome,
            descricao: formData.descricao,
          })
          .eq("id", editingVariavel.id);

        if (error) throw error;
        toast.success("Variável atualizada com sucesso!");
      } else {
        // Criar nova variável
        const maxOrdem = variaveis.length > 0 
          ? Math.max(...variaveis.map(v => v.ordem)) 
          : 0;

        const { error } = await supabase
          .from("agente_variaveis")
          .insert({
            agente_id: agenteId,
            ordem: maxOrdem + 1,
            nome: formData.nome,
            descricao: formData.descricao,
          });

        if (error) throw error;
        toast.success("Variável criada com sucesso!");
      }

      setIsDialogOpen(false);
      carregarVariaveis();
    } catch (error: any) {
      toast.error("Erro ao salvar variável: " + error.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("agente_variaveis")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;
      
      toast.success("Variável excluída com sucesso!");
      setDeleteId(null);
      carregarVariaveis();
    } catch (error: any) {
      toast.error("Erro ao excluir variável: " + error.message);
    }
  };

  const handleToggleAtivo = async (id: string, ativo: boolean) => {
    try {
      const { error } = await supabase
        .from("agente_variaveis")
        .update({ ativo: !ativo })
        .eq("id", id);

      if (error) throw error;
      
      toast.success(ativo ? "Variável inativada" : "Variável ativada");
      carregarVariaveis();
    } catch (error: any) {
      toast.error("Erro ao alterar status: " + error.message);
    }
  };

  const handleMoveUp = async (variavel: Variavel) => {
    const currentIndex = variaveis.findIndex(v => v.id === variavel.id);
    if (currentIndex <= 0) return;

    const prev = variaveis[currentIndex - 1];

    try {
      // Passo 1: liberar a ordem anterior usando um valor temporário
      let { error: e1 } = await supabase
        .from("agente_variaveis")
        .update({ ordem: -999999 })
        .eq("id", variavel.id);
      if (e1) throw e1;

      // Passo 2: mover o item anterior para a ordem do atual
      let { error: e2 } = await supabase
        .from("agente_variaveis")
        .update({ ordem: variavel.ordem })
        .eq("id", prev.id);
      if (e2) throw e2;

      // Passo 3: colocar o item atual na ordem anterior
      let { error: e3 } = await supabase
        .from("agente_variaveis")
        .update({ ordem: prev.ordem })
        .eq("id", variavel.id);
      if (e3) throw e3;

      toast.success("Ordem alterada com sucesso!");
      carregarVariaveis();
    } catch (error: any) {
      toast.error("Erro ao mover variável: " + error.message);
    }
  };

  const handleMoveDown = async (variavel: Variavel) => {
    const currentIndex = variaveis.findIndex(v => v.id === variavel.id);
    if (currentIndex >= variaveis.length - 1) return;

    const next = variaveis[currentIndex + 1];

    try {
      // Passo 1: liberar a próxima ordem usando um valor temporário
      let { error: e1 } = await supabase
        .from("agente_variaveis")
        .update({ ordem: -999999 })
        .eq("id", variavel.id);
      if (e1) throw e1;

      // Passo 2: mover o item seguinte para a ordem do atual
      let { error: e2 } = await supabase
        .from("agente_variaveis")
        .update({ ordem: variavel.ordem })
        .eq("id", next.id);
      if (e2) throw e2;

      // Passo 3: colocar o item atual na próxima ordem
      let { error: e3 } = await supabase
        .from("agente_variaveis")
        .update({ ordem: next.ordem })
        .eq("id", variavel.id);
      if (e3) throw e3;

      toast.success("Ordem alterada com sucesso!");
      carregarVariaveis();
    } catch (error: any) {
      toast.error("Erro ao mover variável: " + error.message);
    }
  };

  if (loading) {
    return <div className="p-6">Carregando variáveis...</div>;
  }

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Variáveis de Qualificação</h3>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Variável
              </Button>
            </div>

            {variaveis.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma variável cadastrada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Ordem</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right w-48">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variaveis.map((variavel, index) => (
                    <TableRow key={variavel.id} className={!variavel.ativo ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{variavel.ordem}</TableCell>
                      <TableCell>{variavel.nome}</TableCell>
                      <TableCell className="max-w-md truncate">{variavel.descricao}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMoveUp(variavel)}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMoveDown(variavel)}
                            disabled={index === variaveis.length - 1}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(variavel)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleAtivo(variavel.id, variavel.ativo)}
                          >
                            {variavel.ativo ? (
                              <Ban className="h-4 w-4" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(variavel.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog para criar/editar variável */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingVariavel ? "Editar Variável" : "Nova Variável"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome da Variável</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Nome do cliente"
              />
            </div>
            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descreva como esta variável deve ser coletada"
                rows={6}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AlertDialog para confirmar exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta variável? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
