import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Building, Users, Edit, Trash2, Loader2, Phone, Mail, Globe, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";

type Empresa = Database["public"]["Tables"]["empresas"]["Row"];

const empresaSchema = z.object({
  nome_empresa: z.string().min(1, "Nome da empresa é obrigatório"),
  razao_social: z.string().min(1, "Razão social é obrigatória"),
  cnpj: z.string().min(1, "CNPJ é obrigatório"),
  grupo_empresarial: z.string().optional(),
  endereco: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  site: z.string().optional(),
  horario_funcionamento: z.string().optional(),
  responsavel_legal_nome: z.string().optional(),
  responsavel_legal_cpf: z.string().optional(),
  responsavel_legal_telefone: z.string().optional(),
  responsavel_legal_email: z.string().email("Email inválido").optional().or(z.literal("")),
  logomarca_url: z.string().optional()
});

type EmpresaForm = z.infer<typeof empresaSchema>;

const Empresas = () => {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<EmpresaForm>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      nome_empresa: "",
      razao_social: "",
      cnpj: "",
      grupo_empresarial: "",
      endereco: "",
      email: "",
      site: "",
      horario_funcionamento: "",
      responsavel_legal_nome: "",
      responsavel_legal_cpf: "",
      responsavel_legal_telefone: "",
      responsavel_legal_email: "",
      logomarca_url: ""
    }
  });

  const fetchEmpresas = async () => {
    try {
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmpresas(data || []);
    } catch (error) {
      console.error('Erro ao buscar empresas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as empresas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmpresas();
  }, []);

  const handleCreateEmpresa = async (data: EmpresaForm) => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('empresas')
        .insert([{
          nome_empresa: data.nome_empresa,
          razao_social: data.razao_social,
          cnpj: data.cnpj,
          grupo_empresarial: data.grupo_empresarial || null,
          endereco: data.endereco || null,
          email: data.email || null,
          site: data.site || null,
          horario_funcionamento: data.horario_funcionamento || null,
          responsavel_legal_nome: data.responsavel_legal_nome || null,
          responsavel_legal_cpf: data.responsavel_legal_cpf || null,
          responsavel_legal_telefone: data.responsavel_legal_telefone || null,
          responsavel_legal_email: data.responsavel_legal_email || null,
          logomarca_url: data.logomarca_url || null
        }]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Empresa criada com sucesso"
      });

      setIsDialogOpen(false);
      form.reset();
      fetchEmpresas();

    } catch (error: any) {
      console.error('Erro ao criar empresa:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar a empresa",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateEmpresa = async (data: EmpresaForm) => {
    if (!editingEmpresa) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('empresas')
        .update({
          nome_empresa: data.nome_empresa,
          razao_social: data.razao_social,
          cnpj: data.cnpj,
          grupo_empresarial: data.grupo_empresarial || null,
          endereco: data.endereco || null,
          email: data.email || null,
          site: data.site || null,
          horario_funcionamento: data.horario_funcionamento || null,
          responsavel_legal_nome: data.responsavel_legal_nome || null,
          responsavel_legal_cpf: data.responsavel_legal_cpf || null,
          responsavel_legal_telefone: data.responsavel_legal_telefone || null,
          responsavel_legal_email: data.responsavel_legal_email || null,
          logomarca_url: data.logomarca_url || null
        })
        .eq('id', editingEmpresa.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Empresa atualizada com sucesso"
      });

      setIsDialogOpen(false);
      setEditingEmpresa(null);
      form.reset();
      fetchEmpresas();

    } catch (error: any) {
      console.error('Erro ao atualizar empresa:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar a empresa",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (data: EmpresaForm) => {
    if (editingEmpresa) {
      handleUpdateEmpresa(data);
    } else {
      handleCreateEmpresa(data);
    }
  };

  const handleEdit = (empresa: Empresa) => {
    setEditingEmpresa(empresa);
    form.reset({
      nome_empresa: empresa.nome_empresa,
      razao_social: empresa.razao_social,
      cnpj: empresa.cnpj,
      grupo_empresarial: empresa.grupo_empresarial || "",
      endereco: empresa.endereco || "",
      email: empresa.email || "",
      site: empresa.site || "",
      horario_funcionamento: empresa.horario_funcionamento || "",
      responsavel_legal_nome: empresa.responsavel_legal_nome || "",
      responsavel_legal_cpf: empresa.responsavel_legal_cpf || "",
      responsavel_legal_telefone: empresa.responsavel_legal_telefone || "",
      responsavel_legal_email: empresa.responsavel_legal_email || "",
      logomarca_url: empresa.logomarca_url || ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (empresaId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta empresa? Esta ação não pode ser desfeita.")) return;

    try {
      const { error } = await supabase
        .from('empresas')
        .delete()
        .eq('id', empresaId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Empresa excluída com sucesso"
      });

      fetchEmpresas();
    } catch (error: any) {
      console.error('Erro ao excluir empresa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a empresa",
        variant: "destructive"
      });
    }
  };

  const handleNewEmpresa = () => {
    setEditingEmpresa(null);
    form.reset({
      nome_empresa: "",
      razao_social: "",
      cnpj: "",
      grupo_empresarial: "",
      endereco: "",
      email: "",
      site: "",
      horario_funcionamento: "",
      responsavel_legal_nome: "",
      responsavel_legal_cpf: "",
      responsavel_legal_telefone: "",
      responsavel_legal_email: "",
      logomarca_url: ""
    });
    setIsDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Empresas</h1>
            <p className="text-muted-foreground">
              Gerencie as empresas cadastradas no sistema
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleNewEmpresa}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Empresa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingEmpresa ? "Editar Empresa" : "Nova Empresa"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  
                  {/* Dados Básicos */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Dados Básicos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="nome_empresa"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome da Empresa *</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="razao_social"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Razão Social *</FormLabel>
                            <FormControl>
                              <Input {...field} />
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
                              <Input {...field} placeholder="00.000.000/0001-00" />
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
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Contato e Endereço */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Contato e Endereço</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="site"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Site</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="https://..." />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="endereco"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Endereço</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={2} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="horario_funcionamento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Horário de Funcionamento</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ex: Segunda a Sexta, 8h às 18h" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Responsável Legal */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Responsável Legal</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="responsavel_legal_nome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome do Responsável</FormLabel>
                            <FormControl>
                              <Input {...field} />
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
                            <FormLabel>CPF do Responsável</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="000.000.000-00" />
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
                            <FormLabel>Telefone do Responsável</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="(11) 99999-9999" />
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
                            <FormLabel>Email do Responsável</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Logomarca */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Logomarca</h3>
                    <FormField
                      control={form.control}
                      name="logomarca_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL da Logomarca</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https://..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-2 pt-4 border-t">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingEmpresa ? "Atualizar" : "Criar"} Empresa
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Empresas Cadastradas
            </CardTitle>
            <CardDescription>
              Lista de todas as empresas no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {empresas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma empresa encontrada
                  </div>
                ) : (
                  empresas.map((empresa) => (
                    <div key={empresa.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="space-y-3 flex-1">
                          <div>
                            <h3 className="text-lg font-semibold">{empresa.nome_empresa}</h3>
                            <p className="text-sm text-muted-foreground">{empresa.razao_social}</p>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4" />
                                <span>CNPJ: {empresa.cnpj}</span>
                              </div>
                              
                              {empresa.email && (
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4" />
                                  <span>{empresa.email}</span>
                                </div>
                              )}
                              
                              {empresa.site && (
                                <div className="flex items-center gap-2">
                                  <Globe className="h-4 w-4" />
                                  <span>{empresa.site}</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="space-y-2">
                              {empresa.endereco && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4" />
                                  <span>{empresa.endereco}</span>
                                </div>
                              )}
                              
                              {empresa.responsavel_legal_nome && (
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4" />
                                  <span>Resp: {empresa.responsavel_legal_nome}</span>
                                </div>
                              )}
                              
                              {empresa.responsavel_legal_telefone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4" />
                                  <span>{empresa.responsavel_legal_telefone}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {empresa.grupo_empresarial && (
                            <div className="text-sm text-muted-foreground">
                              Grupo: {empresa.grupo_empresarial}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 ml-4">
                          <Badge variant="default">Ativa</Badge>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleEdit(empresa)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDelete(empresa.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Empresas;