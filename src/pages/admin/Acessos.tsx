import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Users, Edit, Trash2, Shield, Loader2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { EmpresasSelector } from "@/components/EmpresasSelector";

import { Database } from "@/integrations/supabase/types";

type TipoAcesso = Database["public"]["Enums"]["tipo_acesso"];
type StatusUsuario = Database["public"]["Enums"]["status_usuario"];

const userSchema = z.object({
  nome_completo: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional().or(z.literal("")),
  tipo_acesso: z.enum(["SDR", "Gerente de Leads", "Vendedor", "Gerente de Loja", "Diretor", "TI", "Administrador", "Proprietário", "CRM", "Recepcionista"]),
  departamento: z.string().optional(),
  celular: z.string().optional(),
  cpf: z.string().optional(),
  status: z.enum(["Ativo", "Inativo", "Suspenso"]),
  empresas: z.array(z.string()).min(1, "Selecione pelo menos uma empresa")
});

type UserForm = z.infer<typeof userSchema>;

interface Profile {
  id: string;
  nome_completo: string;
  tipo_acesso: TipoAcesso | null;
  status: StatusUsuario | null;
  departamento?: string | null;
  celular?: string | null;
  cpf?: string | null;
  created_at: string | null;
  email: string;
  empresas?: Array<{
    id: string;
    nome_empresa: string;
  }>;
}

interface Company {
  id: string;
  nome_empresa: string;
  marca?: string;
  uf?: string;
  cnpj?: string;
  crm_id?: string;
}

const Acessos = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filterEmpresaId, setFilterEmpresaId] = useState<string>("");
  const { user: authUser, session } = useAuth();
  const { toast } = useToast();

  const form = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      nome_completo: "",
      email: "",
      password: "",
      tipo_acesso: "SDR",
      departamento: "",
      celular: "",
      cpf: "",
      status: "Ativo",
      empresas: []
    }
  });

  const fetchCompanies = async () => {
    try {
      console.log('Acessos: Fetching companies...');
      const { data, error } = await supabase
        .from('empresas')
        .select('id, nome_empresa, marca, uf, cnpj, crm_id')
        .order('nome_empresa');

      if (error) {
        console.error('Acessos: Error fetching companies:', error);
        throw error;
      }
      
      console.log('Acessos: Companies loaded:', data?.length || 0);
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as empresas. Verifique suas permissões.",
        variant: "destructive"
      });
    }
  };

  const fetchProfiles = async () => {
    try {
      console.log('Fetching profiles...');
      
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'list_users' }
      });

      console.log('Response from edge function:', data, error);

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Erro ao chamar a função de gerenciamento de usuários');
      }

      if (data?.users) {
        console.log('Found users from edge function:', data.users.length);
        setProfiles(data.users);
      } else {
        console.warn('No users found in response');
        setProfiles([]);
      }
    } catch (error: any) {
      console.error('Erro ao buscar perfis:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível carregar os usuários",
        variant: "destructive"
      });
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('Acessos: Component mounted, current user:', authUser?.id);
    console.log('Acessos: Session:', session ? 'exists' : 'null');
    
    fetchCompanies();
    fetchProfiles();
  }, [authUser, session]);

  const handleCreateUser = async (data: UserForm) => {
    setSubmitting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create_user',
          email: data.email,
          password: data.password!,
          nome_completo: data.nome_completo,
          tipo_acesso: data.tipo_acesso,
          departamento: data.departamento,
          celular: data.celular,
          cpf: data.cpf,
          status: data.status,
          empresas: data.empresas
        }
      });

      if (error) throw error;

      if (result?.success) {
        toast({
          title: "Sucesso",
          description: result.message || "Usuário criado com sucesso"
        });

        setIsDialogOpen(false);
        form.reset();
        fetchProfiles();
      } else {
        throw new Error(result?.error || 'Erro ao criar usuário');
      }

    } catch (error: any) {
      console.error('Erro ao criar usuário:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar o usuário",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async (data: UserForm) => {
    if (!editingUser) return;

    setSubmitting(true);
    try {
      const updatePayload: any = {
        action: 'update_user',
        user_id: editingUser.id,
        nome_completo: data.nome_completo,
        tipo_acesso: data.tipo_acesso,
        departamento: data.departamento,
        celular: data.celular,
        cpf: data.cpf,
        status: data.status,
        empresas: data.empresas
      };

      // Only include password if provided
      if (data.password && data.password.trim() !== "") {
        updatePayload.password = data.password;
      }

      const { data: result, error } = await supabase.functions.invoke('manage-users', {
        body: updatePayload
      });

      if (error) throw error;

      if (result?.success) {
        toast({
          title: "Sucesso",
          description: result.message || "Usuário atualizado com sucesso"
        });

        setIsDialogOpen(false);
        setEditingUser(null);
        form.reset();
        fetchProfiles();
      } else {
        throw new Error(result?.error || 'Erro ao atualizar usuário');
      }

    } catch (error: any) {
      console.error('Erro ao atualizar usuário:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar o usuário",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (data: UserForm) => {
    if (editingUser) {
      handleUpdateUser(data);
    } else {
      handleCreateUser(data);
    }
  };

  const handleEdit = (user: Profile) => {
    setEditingUser(user);
    // Cast tipo_acesso para lidar com valores legados que foram removidos do sistema
    const tipoAcesso = user.tipo_acesso || "SDR";
    const validTipoAcesso = ["SDR", "Gerente de Leads", "Vendedor", "Gerente de Loja", "Diretor", "TI", "Administrador", "Proprietário", "CRM", "Recepcionista"].includes(tipoAcesso) 
      ? tipoAcesso as "SDR" | "Gerente de Leads" | "Vendedor" | "Gerente de Loja" | "Diretor" | "TI" | "Administrador" | "Proprietário" | "CRM" | "Recepcionista"
      : "Vendedor";
    form.reset({
      nome_completo: user.nome_completo,
      email: user.email,
      tipo_acesso: validTipoAcesso,
      departamento: user.departamento || "",
      celular: user.celular || "",
      cpf: user.cpf || "",
      status: user.status || "Ativo",
      empresas: user.empresas?.map(e => e.id) || []
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.")) return;

    try {
      const { data: result, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'delete_user',
          user_id: userId
        }
      });

      if (error) throw error;

      if (result?.success) {
        toast({
          title: "Sucesso",
          description: result.message || "Usuário excluído com sucesso"
        });

        fetchProfiles();
      } else {
        throw new Error(result?.error || 'Erro ao excluir usuário');
      }
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível excluir o usuário",
        variant: "destructive"
      });
    }
  };

  const handleNewUser = () => {
    setEditingUser(null);
    form.reset({
      nome_completo: "",
      email: "",
      password: "",
      tipo_acesso: "SDR",
      departamento: "",
      celular: "",
      cpf: "",
      status: "Ativo",
      empresas: []
    });
    setIsDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <ScrollIndicator className="flex-1 h-full">
        <div className="space-y-6 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Acessos</h1>
            <p className="text-muted-foreground">
              Gerencie usuários e permissões do sistema
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleNewUser}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? "Editar Usuário" : "Novo Usuário"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="nome_completo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Completo *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {!editingUser && (
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email *</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {editingUser ? "Nova Senha (deixe em branco para não alterar)" : "Senha *"}
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder={editingUser ? "Digite apenas se quiser alterar" : ""}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="tipo_acesso"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Acesso *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="SDR">SDR</SelectItem>
                              <SelectItem value="Gerente de Leads">Gerente de Leads</SelectItem>
                              <SelectItem value="Vendedor">Vendedor</SelectItem>
                              <SelectItem value="Gerente de Loja">Gerente de Loja</SelectItem>
                              <SelectItem value="Diretor">Diretor</SelectItem>
                              <SelectItem value="TI">TI</SelectItem>
                              <SelectItem value="Administrador">Administrador</SelectItem>
                              <SelectItem value="Proprietário">Proprietário</SelectItem>
                              <SelectItem value="CRM">CRM</SelectItem>
                              <SelectItem value="Recepcionista">Recepcionista</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="departamento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Departamento</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="celular"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Celular</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="cpf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Ativo">Ativo</SelectItem>
                              <SelectItem value="Inativo">Inativo</SelectItem>
                              <SelectItem value="Suspenso">Suspenso</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Seleção de Empresas */}
                  <FormField
                    control={form.control}
                    name="empresas"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <EmpresasSelector
                            companies={companies}
                            selectedCompanies={field.value}
                            onSelectionChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingUser ? "Atualizar" : "Criar"} Usuário
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Usuários do Sistema
                </CardTitle>
                <CardDescription>
                  Lista de todos os usuários e suas permissões
                </CardDescription>
              </div>
              <div className="w-64">
                <Select value={filterEmpresaId} onValueChange={setFilterEmpresaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as empresas</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.nome_empresa}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {profiles
                  .filter(profile => {
                    if (!filterEmpresaId || filterEmpresaId === "all") return true;
                    return profile.empresas?.some(e => e.id === filterEmpresaId);
                  })
                  .length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum usuário encontrado
                  </div>
                ) : (
                  profiles
                    .filter(profile => {
                      if (!filterEmpresaId || filterEmpresaId === "all") return true;
                      return profile.empresas?.some(e => e.id === filterEmpresaId);
                    })
                    .map((profile: Profile) => (
                    <div key={profile.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{profile.nome_completo}</h3>
                          <Badge variant="outline">{profile.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{profile.email}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Shield className="h-4 w-4" />
                            {profile.tipo_acesso}
                          </span>
                          {profile.departamento && (
                            <span>{profile.departamento}</span>
                          )}
                        </div>
                        {profile.empresas && profile.empresas.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {profile.empresas.slice(0, 3).map((empresa) => (
                              <Badge key={empresa.id} variant="secondary" className="text-xs">
                                {empresa.nome_empresa}
                              </Badge>
                            ))}
                            {profile.empresas.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{profile.empresas.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(profile)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(profile.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default Acessos;