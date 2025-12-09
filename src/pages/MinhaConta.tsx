import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Mail, Phone, Calendar, Building, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { AvatarBuilder } from "@/components/AvatarBuilder";

const profileSchema = z.object({
  nome_completo: z.string().min(1, "Nome é obrigatório"),
  celular: z.string().optional(),
  departamento: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

const MinhaConta = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nome_completo: "",
      celular: "",
      departamento: "",
    }
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (error) throw error;

      setProfile(data);
      form.reset({
        nome_completo: data.nome_completo || "",
        celular: data.celular || "",
        departamento: data.departamento || "",
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados do perfil.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (avatarUrl: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ foto_url: avatarUrl })
        .eq("id", user.id);

      if (error) throw error;

      setProfile({ ...profile, foto_url: avatarUrl });
      toast({
        title: "Sucesso",
        description: "Foto de perfil atualizada com sucesso!",
      });
    } catch (error) {
      console.error("Error updating avatar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a foto de perfil.",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (values: ProfileForm) => {
    if (!user) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update(values)
        .eq("id", user.id);

      if (error) throw error;

      setProfile({ ...profile, ...values });
      toast({
        title: "Sucesso",
        description: "Perfil atualizado com sucesso!",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o perfil.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Minha Conta">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">Carregando...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Minha Conta">
      <div className="space-y-6">
        {/* Profile Header */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center space-x-4">
              <AvatarBuilder
                currentAvatar={profile?.foto_url}
                userName={profile?.nome_completo}
                onAvatarChange={handleAvatarChange}
              />
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">{profile?.nome_completo}</h2>
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{user?.email}</span>
                </div>
                <Badge variant="outline">
                  <Shield className="h-3 w-3 mr-1" />
                  {profile?.tipo_acesso}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Profile Information */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Informações Pessoais
              </CardTitle>
              <CardDescription>
                Atualize suas informações pessoais básicas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="nome_completo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
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
                          <Input {...field} placeholder="(11) 99999-9999" />
                        </FormControl>
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

                  <Button type="submit" disabled={updating} className="w-full">
                    {updating ? "Atualizando..." : "Atualizar Perfil"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Account Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building className="h-5 w-5 mr-2" />
                Detalhes da Conta
              </CardTitle>
              <CardDescription>
                Informações da sua conta no sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Status:</span>
                <Badge variant={profile?.status === "Ativo" ? "default" : "secondary"}>
                  {profile?.status}
                </Badge>
              </div>

              <div className="flex justify-between">
                <span className="text-sm font-medium">Tipo de Acesso:</span>
                <span className="text-sm">{profile?.tipo_acesso}</span>
              </div>

              {profile?.cpf && (
                <div className="flex justify-between">
                  <span className="text-sm font-medium">CPF:</span>
                  <span className="text-sm">{profile.cpf}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-sm font-medium">Membro desde:</span>
                <div className="flex items-center text-sm">
                  <Calendar className="h-4 w-4 mr-1" />
                  {profile?.created_at ? 
                    new Date(profile.created_at).toLocaleDateString('pt-BR') : 
                    'Data não disponível'
                  }
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MinhaConta;
