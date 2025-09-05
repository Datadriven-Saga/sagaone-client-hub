import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Building } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { ImportEmpresasButton } from "@/components/ImportEmpresasButton";
import { UpdateCrmIdsButton } from "@/components/UpdateCrmIdsButton";

// Schema de validação
const empresaSchema = z.object({
  nome_empresa: z.string().min(1, "Nome da empresa é obrigatório"),
  cnpj: z.string().min(1, "CNPJ é obrigatório"),
  crm_id: z.string().optional(),
  uf: z.string().optional(),
  marca: z.string().optional(),
  grupo_empresarial: z.string().optional(),
  horario_funcionamento: z.string().optional(),
  responsavel_legal_nome: z.string().optional(),
  responsavel_legal_cpf: z.string().optional(),
  responsavel_legal_email: z.string().email("Email inválido").optional().or(z.literal("")),
  responsavel_legal_telefone: z.string().optional(),
});

type EmpresaForm = z.infer<typeof empresaSchema>;

interface Empresa {
  id: string;
  nome_empresa: string;
  cnpj: string;
  crm_id?: string;
  uf?: string;
  marca?: string;
  grupo_empresarial?: string;
  horario_funcionamento?: string;
  responsavel_legal_nome?: string;
  responsavel_legal_cpf?: string;
  responsavel_legal_email?: string;
  responsavel_legal_telefone?: string;
  logomarca_url?: string;
  created_at?: string;
  updated_at?: string;
}

export default function Empresas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<EmpresaForm>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      nome_empresa: "",
      cnpj: "",
      crm_id: "",
      uf: "",
      marca: "",
      grupo_empresarial: "",
      horario_funcionamento: "",
      responsavel_legal_nome: "",
      responsavel_legal_cpf: "",
      responsavel_legal_email: "",
      responsavel_legal_telefone: "",
    },
  });

  useEffect(() => {
    fetchEmpresas();
  }, []);

  const fetchEmpresas = async () => {
    try {
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .order("nome_empresa");

      if (error) throw error;
      setEmpresas(data || []);
    } catch (error) {
      console.error("Erro ao buscar empresas:", error);
      toast.error("Erro ao carregar empresas");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: EmpresaForm) => {
    setSubmitting(true);
    try {
      if (editingEmpresa) {
        await handleUpdateEmpresa(data);
      } else {
        await handleCreateEmpresa(data);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateEmpresa = async (data: EmpresaForm) => {
    try {
      // Filter out empty strings for optional fields
      const cleanData: any = {
        nome_empresa: data.nome_empresa,
        cnpj: data.cnpj,
        crm_id: data.crm_id || null,
        uf: data.uf || null,
        marca: data.marca || null,
        grupo_empresarial: data.grupo_empresarial || null,
        horario_funcionamento: data.horario_funcionamento || null,
        responsavel_legal_nome: data.responsavel_legal_nome || null,
        responsavel_legal_cpf: data.responsavel_legal_cpf || null,
        responsavel_legal_email: data.responsavel_legal_email || null,
        responsavel_legal_telefone: data.responsavel_legal_telefone || null,
      };

      const { error } = await supabase
        .from("empresas")
        .insert([cleanData]);

      if (error) throw error;

      toast.success("Empresa criada com sucesso");
      setDialogOpen(false);
      form.reset();
      fetchEmpresas();
    } catch (error) {
      console.error("Erro ao criar empresa:", error);
      toast.error("Erro ao criar empresa");
    }
  };

  const handleUpdateEmpresa = async (data: EmpresaForm) => {
    if (!editingEmpresa) return;

    try {
      // Filter out empty strings for optional fields
      const cleanData: any = {
        nome_empresa: data.nome_empresa,
        cnpj: data.cnpj,
        crm_id: data.crm_id || null,
        uf: data.uf || null,
        marca: data.marca || null,
        grupo_empresarial: data.grupo_empresarial || null,
        horario_funcionamento: data.horario_funcionamento || null,
        responsavel_legal_nome: data.responsavel_legal_nome || null,
        responsavel_legal_cpf: data.responsavel_legal_cpf || null,
        responsavel_legal_email: data.responsavel_legal_email || null,
        responsavel_legal_telefone: data.responsavel_legal_telefone || null,
      };

      const { error } = await supabase
        .from("empresas")
        .update(cleanData)
        .eq("id", editingEmpresa.id);

      if (error) throw error;

      toast.success("Empresa atualizada com sucesso");
      setDialogOpen(false);
      setEditingEmpresa(null);
      form.reset();
      fetchEmpresas();
    } catch (error) {
      console.error("Erro ao atualizar empresa:", error);
      toast.error("Erro ao atualizar empresa");
    }
  };

  const handleEdit = (empresa: Empresa) => {
    setEditingEmpresa(empresa);
    form.reset({
      nome_empresa: empresa.nome_empresa,
      cnpj: empresa.cnpj,
      crm_id: empresa.crm_id || "",
      uf: empresa.uf || "",
      marca: empresa.marca || "",
      grupo_empresarial: empresa.grupo_empresarial || "",
      horario_funcionamento: empresa.horario_funcionamento || "",
      responsavel_legal_nome: empresa.responsavel_legal_nome || "",
      responsavel_legal_cpf: empresa.responsavel_legal_cpf || "",
      responsavel_legal_email: empresa.responsavel_legal_email || "",
      responsavel_legal_telefone: empresa.responsavel_legal_telefone || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (empresaId: string) => {
    try {
      const { error } = await supabase
        .from("empresas")
        .delete()
        .eq("id", empresaId);

      if (error) throw error;

      toast.success("Empresa excluída com sucesso");
      fetchEmpresas();
    } catch (error) {
      console.error("Erro ao excluir empresa:", error);
      toast.error("Erro ao excluir empresa");
    }
  };

  const handleNewEmpresa = () => {
    setEditingEmpresa(null);
    form.reset();
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <DashboardLayout title="Empresas">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Empresas">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Gerenciar Empresas</h2>
            <p className="text-muted-foreground">
              Cadastre e gerencie as empresas do sistema
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
          <div className="flex gap-2">
            <ImportEmpresasButton />
            <UpdateCrmIdsButton />
            <Button onClick={handleNewEmpresa}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Empresa
            </Button>
          </div>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingEmpresa ? "Editar Empresa" : "Nova Empresa"}
                </DialogTitle>
                <DialogDescription>
                  {editingEmpresa 
                    ? "Atualize os dados da empresa"
                    : "Preencha os dados da nova empresa"
                  }
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="nome_empresa"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome da Empresa *</FormLabel>
                          <FormControl>
                            <Input placeholder="Digite o nome da empresa" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cnpj"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CNPJ *</FormLabel>
                          <FormControl>
                            <Input placeholder="00.000.000/0000-00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="crm_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CRM ID</FormLabel>
                          <FormControl>
                            <Input placeholder="ID do CRM" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="uf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UF</FormLabel>
                          <FormControl>
                            <Input placeholder="SP" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="marca"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Marca</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome da marca" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="grupo_empresarial"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Grupo Empresarial</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome do grupo empresarial" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="horario_funcionamento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horário de Funcionamento</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Segunda a Sexta das 8h às 18h" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="border-t pt-4">
                    <h4 className="text-lg font-semibold mb-3">Responsável Legal</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="responsavel_legal_nome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome do responsável legal" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="responsavel_legal_cpf"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF</FormLabel>
                            <FormControl>
                              <Input placeholder="000.000.000-00" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="responsavel_legal_email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="responsavel@empresa.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="responsavel_legal_telefone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <Input placeholder="(11) 99999-9999" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Salvando..." : editingEmpresa ? "Atualizar" : "Criar"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {empresas.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma empresa cadastrada</h3>
              <p className="text-muted-foreground text-center">
                Comece cadastrando a primeira empresa do sistema
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {empresas.map((empresa) => (
              <Card key={empresa.id} className="relative">
                <CardHeader>
                  <CardTitle className="text-lg">{empresa.nome_empresa}</CardTitle>
                  <CardDescription>{empresa.marca}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong>CNPJ:</strong> {empresa.cnpj}
                    </div>
                    {empresa.crm_id && (
                      <div>
                        <strong>CRM ID:</strong> {empresa.crm_id}
                      </div>
                    )}
                    {empresa.uf && (
                      <div>
                        <strong>UF:</strong> {empresa.uf}
                      </div>
                    )}
                    {empresa.grupo_empresarial && (
                      <div>
                        <strong>Grupo:</strong> {empresa.grupo_empresarial}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(empresa)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir a empresa "{empresa.nome_empresa}"? 
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(empresa.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}