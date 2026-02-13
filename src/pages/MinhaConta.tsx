import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Mail, Phone, Calendar, Building, Shield, Eye, Camera, X, Moon, Sun, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { AvatarBuilder } from "@/components/AvatarBuilder";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { uploadImageUrlToStorage, deleteFromStorage } from "@/lib/storageUtils";

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
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Verifica se há preferência salva no localStorage
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      return true;
    } else if (saved === "light") {
      return false;
    }
    // Se não houver preferência salva, usa o padrão claro
    return false;
  });

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nome_completo: "",
      celular: "",
      departamento: "",
    },
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  useEffect(() => {
    // Aplica ou remove a classe 'dark' do elemento html
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user?.id).single();

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
      // Delete old avatar from storage if it exists in our bucket
      if (profile?.foto_url && profile.foto_url.includes("/avatars/")) {
        await deleteFromStorage(profile.foto_url, "avatars");
      }

      // Upload to storage (handles both base64 and remote URLs)
      let finalUrl = avatarUrl;
      if (avatarUrl.startsWith("data:") || avatarUrl.startsWith("http")) {
        const result = await uploadImageUrlToStorage(
          avatarUrl,
          "avatars",
          user.id,
          `avatar-${Date.now()}`
        );
        finalUrl = result.url;
      }

      const { error } = await supabase.from("profiles").update({ foto_url: finalUrl }).eq("id", user.id);

      if (error) throw error;

      setProfile({ ...profile, foto_url: finalUrl });
      toast({
        title: "Sucesso",
        description: "Foto de perfil atualizada com sucesso!",
      });
    } catch (error) {
      console.error("Error updating avatar:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível atualizar a foto de perfil.",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (values: ProfileForm) => {
    if (!user) return;

    setUpdating(true);
    try {
      const { error } = await supabase.from("profiles").update(values).eq("id", user.id);

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
      <ScrollIndicator className="h-full">
        <div className="space-y-6 pb-6">
          {/* Dark Mode Toggle */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {isDarkMode ? (
                    <Moon className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Sun className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">Tema</p>
                    <p className="text-sm text-muted-foreground">
                      {isDarkMode ? "Modo Escuro" : "Modo Padrão (Claro)"}
                    </p>
                  </div>
                </div>
                <Switch checked={isDarkMode} onCheckedChange={setIsDarkMode} />
              </div>
            </CardContent>
          </Card>

          {/* Profile Header */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-4">
                {/* Profile Image with Dropdown Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="relative group cursor-pointer">
                      <Avatar className="h-20 w-20">
                        <AvatarImage
                          src={profile?.foto_url || undefined}
                          alt={profile?.nome_completo}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <AvatarFallback className="text-lg">
                          {profile?.nome_completo
                            ?.split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {profile?.foto_url && (
                      <DropdownMenuItem onClick={() => setShowImagePreview(true)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Visualizar foto
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setShowAvatarBuilder(true)}>
                      <Camera className="h-4 w-4 mr-2" />
                      Alterar foto
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

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

            {/* Hidden AvatarBuilder that opens via state */}
            {showAvatarBuilder && (
              <AvatarBuilder
                currentAvatar={profile?.foto_url}
                userName={profile?.nome_completo}
                onAvatarChange={(url) => {
                  handleAvatarChange(url);
                  setShowAvatarBuilder(false);
                }}
                triggerOpen={showAvatarBuilder}
                onOpenChange={setShowAvatarBuilder}
              />
            )}
          </Card>

          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Informações Pessoais
              </CardTitle>
              <CardDescription>Atualize suas informações pessoais básicas</CardDescription>
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
              <CardDescription>Informações da sua conta no sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Status:</span>
                <Badge
                  className={
                    profile?.status === "Ativo"
                      ? "bg-green-500 hover:bg-green-600 text-white"
                      : "bg-red-500 hover:bg-red-600 text-white"
                  }
                >
                  {profile?.status === "Ativo" ? "Ativo" : "Desativado"}
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
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString("pt-BR")
                    : "Data não disponível"}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollIndicator>

      {/* Image Preview Dialog */}
      <Dialog open={showImagePreview} onOpenChange={setShowImagePreview}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-black/90 border-none">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
            onClick={() => setShowImagePreview(false)}
          >
            <X className="h-5 w-5" />
          </Button>
          {profile?.foto_url && (
            <div className="flex items-center justify-center p-4">
              <img
                src={profile.foto_url}
                alt={profile?.nome_completo || "Foto de perfil"}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MinhaConta;
