import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Módulos disponíveis no sistema
const MODULOS_SISTEMA = [
  "Dashboard",
  "Prospecção", 
  "Clientes",
  "Agentes IA",
  "Personas",
  "Gatilhos",
  "Treinamentos",
  "Notificações",
  "Relatórios",
  "Configurações",
  "Ajuda",
  "Administração"
];

const moduloSchema = z.object({
  modulo_nome: z.string().min(1, "Módulo é obrigatório"),
  data_inicio: z.string().min(1, "Data de início é obrigatória"),
  data_fim: z.string().min(1, "Data de fim é obrigatória"),
});

type ModuloForm = z.infer<typeof moduloSchema>;

interface EmpresaModulo {
  id: string;
  modulo_nome: string;
  data_inicio: string;
  data_fim: string;
  ativo: boolean;
}

interface EmpresaModulosTabProps {
  empresaId: string;
}

export function EmpresaModulosTab({ empresaId }: EmpresaModulosTabProps) {
  const [modulos, setModulos] = useState<EmpresaModulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingModulo, setEditingModulo] = useState<EmpresaModulo | null>(null);

  const form = useForm<ModuloForm>({
    resolver: zodResolver(moduloSchema),
    defaultValues: {
      modulo_nome: "",
      data_inicio: "",
      data_fim: "",
    },
  });

  useEffect(() => {
    if (empresaId) {
      fetchModulos();
    }
  }, [empresaId]);

  const fetchModulos = async () => {
    try {
      const { data, error } = await supabase
        .from("empresa_modulos")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("modulo_nome");

      if (error) throw error;
      setModulos(data || []);
    } catch (error) {
      console.error("Erro ao buscar módulos:", error);
      toast.error("Erro ao carregar módulos da empresa");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: ModuloForm) => {
    if (!empresaId) return;
    
    setSubmitting(true);
    try {
      if (editingModulo) {
        await handleUpdateModulo(data);
      } else {
        await handleCreateModulo(data);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateModulo = async (data: ModuloForm) => {
    try {
      const { error } = await supabase
        .from("empresa_modulos")
        .insert([{
          empresa_id: empresaId,
          modulo_nome: data.modulo_nome,
          data_inicio: data.data_inicio,
          data_fim: data.data_fim,
          ativo: true,
        }]);

      if (error) throw error;

      toast.success("Módulo adicionado com sucesso");
      form.reset();
      fetchModulos();
    } catch (error) {
      console.error("Erro ao criar módulo:", error);
      toast.error("Erro ao adicionar módulo");
    }
  };

  const handleUpdateModulo = async (data: ModuloForm) => {
    if (!editingModulo) return;

    try {
      const { error } = await supabase
        .from("empresa_modulos")
        .update({
          modulo_nome: data.modulo_nome,
          data_inicio: data.data_inicio,
          data_fim: data.data_fim,
        })
        .eq("id", editingModulo.id);

      if (error) throw error;

      toast.success("Módulo atualizado com sucesso");
      setEditingModulo(null);
      form.reset();
      fetchModulos();
    } catch (error) {
      console.error("Erro ao atualizar módulo:", error);
      toast.error("Erro ao atualizar módulo");
    }
  };

  const handleEdit = (modulo: EmpresaModulo) => {
    setEditingModulo(modulo);
    form.reset({
      modulo_nome: modulo.modulo_nome,
      data_inicio: modulo.data_inicio,
      data_fim: modulo.data_fim,
    });
  };

  const handleDelete = async (moduloId: string) => {
    try {
      const { error } = await supabase
        .from("empresa_modulos")
        .delete()
        .eq("id", moduloId);

      if (error) throw error;

      toast.success("Módulo removido com sucesso");
      fetchModulos();
    } catch (error) {
      console.error("Erro ao excluir módulo:", error);
      toast.error("Erro ao remover módulo");
    }
  };

  const handleToggleAtivo = async (modulo: EmpresaModulo) => {
    try {
      const { error } = await supabase
        .from("empresa_modulos")
        .update({ ativo: !modulo.ativo })
        .eq("id", modulo.id);

      if (error) throw error;

      toast.success(`Módulo ${!modulo.ativo ? 'ativado' : 'desativado'} com sucesso`);
      fetchModulos();
    } catch (error) {
      console.error("Erro ao alterar status do módulo:", error);
      toast.error("Erro ao alterar status do módulo");
    }
  };

  const getModulosDisponiveis = () => {
    const modulosExistentes = modulos.map(m => m.modulo_nome);
    return MODULOS_SISTEMA.filter(modulo => !modulosExistentes.includes(modulo));
  };

  const cancelEdit = () => {
    setEditingModulo(null);
    form.reset();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Formulário para adicionar/editar módulo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {editingModulo ? "Editar Módulo" : "Adicionar Módulo"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="modulo_nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Módulo</FormLabel>
                      <FormControl>
                        <select 
                          {...field}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                          disabled={!!editingModulo}
                        >
                          <option value="">Selecione um módulo</option>
                          {editingModulo ? (
                            <option value={editingModulo.modulo_nome}>
                              {editingModulo.modulo_nome}
                            </option>
                          ) : (
                            getModulosDisponiveis().map((modulo) => (
                              <option key={modulo} value={modulo}>
                                {modulo}
                              </option>
                            ))
                          )}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="data_inicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Início</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="data_fim"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Fim</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Salvando..." : editingModulo ? "Atualizar" : "Adicionar"}
                </Button>
                {editingModulo && (
                  <Button type="button" variant="outline" onClick={cancelEdit}>
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Lista de módulos */}
      <Card>
        <CardHeader>
          <CardTitle>Módulos da Empresa</CardTitle>
        </CardHeader>
        <CardContent>
          {modulos.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum módulo configurado para esta empresa
            </p>
          ) : (
            <div className="space-y-4">
              {modulos.map((modulo) => (
                <div key={modulo.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={modulo.ativo}
                      onCheckedChange={() => handleToggleAtivo(modulo)}
                    />
                    <div>
                      <h4 className="font-medium">{modulo.modulo_nome}</h4>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Início: {format(new Date(modulo.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Fim: {format(new Date(modulo.data_fim), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(modulo)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(modulo.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}