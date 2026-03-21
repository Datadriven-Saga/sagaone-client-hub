import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Crown, Plus, Trash2, Loader2, Search, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MasterUser {
  user_id: string;
  created_at: string;
  nome_completo: string | null;
  email: string | null;
  tipo_acesso: string | null;
}

interface AvailableUser {
  id: string;
  nome_completo: string;
  email: string;
  tipo_acesso: string | null;
}

export function MasterUsersCard() {
  const [masters, setMasters] = useState<MasterUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [searchUser, setSearchUser] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchMasters = useCallback(async () => {
    try {
      // Fetch mfa_master_users with profile info
      const { data, error } = await supabase
        .from("mfa_master_users" as any)
        .select("user_id, created_at");

      if (error) throw error;

      const masterRows = (data || []) as any[];
      
      if (masterRows.length === 0) {
        setMasters([]);
        setLoading(false);
        return;
      }

      // Fetch profile info for each master
      const userIds = masterRows.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome_completo, tipo_acesso")
        .in("id", userIds);

      // Fetch emails
      const { data: emailsData } = await supabase.rpc("get_users_emails", {
        user_ids: userIds,
      });

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      const emailMap = new Map((emailsData || []).map((e: any) => [e.user_id, e.email]));

      const enriched: MasterUser[] = masterRows.map((m: any) => ({
        user_id: m.user_id,
        created_at: m.created_at,
        nome_completo: profileMap.get(m.user_id)?.nome_completo || null,
        email: emailMap.get(m.user_id) || null,
        tipo_acesso: profileMap.get(m.user_id)?.tipo_acesso || null,
      }));

      setMasters(enriched);
    } catch (err) {
      console.error("Erro ao carregar masters:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMasters();
  }, [fetchMasters]);

  const fetchAvailableUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome_completo, tipo_acesso")
        .eq("status", "Ativo")
        .order("nome_completo");

      if (error) throw error;

      // Fetch emails for all users
      const userIds = (data || []).map((p) => p.id);
      const { data: emailsData } = await supabase.rpc("get_users_emails", {
        user_ids: userIds,
      });
      const emailMap = new Map((emailsData || []).map((e: any) => [e.user_id, e.email]));

      // Filter out users already master
      const masterIds = new Set(masters.map((m) => m.user_id));
      const available: AvailableUser[] = (data || [])
        .filter((p) => !masterIds.has(p.id))
        .map((p) => ({
          id: p.id,
          nome_completo: p.nome_completo || "",
          email: emailMap.get(p.id) || "",
          tipo_acesso: p.tipo_acesso,
        }));

      setAvailableUsers(available);
    } catch (err) {
      console.error("Erro ao carregar usuários disponíveis:", err);
    }
  }, [masters]);

  const handleOpenAdd = () => {
    setSelectedUserId("");
    setSearchUser("");
    fetchAvailableUsers();
    setShowAddDialog(true);
  };

  const handleAdd = async () => {
    if (!selectedUserId) return;
    setAdding(true);
    try {
      const { error } = await supabase
        .from("mfa_master_users" as any)
        .insert({ user_id: selectedUserId } as any);

      if (error) throw error;

      toast({ title: "Sucesso", description: "Usuário promovido a Master" });
      setShowAddDialog(false);
      fetchMasters();
    } catch (err: any) {
      console.error("Erro ao adicionar master:", err);
      toast({
        title: "Erro",
        description: err.message || "Não foi possível promover o usuário",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Tem certeza que deseja remover este usuário da lista Master?")) return;
    setRemoving(userId);
    try {
      const { error } = await supabase
        .from("mfa_master_users" as any)
        .delete()
        .eq("user_id", userId);

      if (error) throw error;

      toast({ title: "Sucesso", description: "Acesso Master removido" });
      fetchMasters();
    } catch (err: any) {
      console.error("Erro ao remover master:", err);
      toast({
        title: "Erro",
        description: err.message || "Não foi possível remover o acesso",
        variant: "destructive",
      });
    } finally {
      setRemoving(null);
    }
  };

  const filteredAvailable = availableUsers.filter((u) => {
    if (!searchUser) return true;
    const s = searchUser.toLowerCase();
    return (
      u.nome_completo.toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s)
    );
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                Usuários Master
              </CardTitle>
              <CardDescription>
                Gerencie quem possui acesso Master no sistema (MFA e permissões elevadas)
              </CardDescription>
            </div>
            <Button onClick={handleOpenAdd} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : masters.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Nenhum usuário Master cadastrado na tabela <code>mfa_master_users</code>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border">
              {masters.map((master) => (
                <div
                  key={master.user_id}
                  className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {master.nome_completo || "Sem nome"}
                      </span>
                      {master.tipo_acesso && (
                        <Badge variant="outline" className="text-xs">
                          {master.tipo_acesso}
                        </Badge>
                      )}
                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-xs">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Master
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {master.email || "Email não disponível"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(master.user_id)}
                    disabled={removing === master.user_id}
                    className="text-destructive hover:text-destructive h-8 w-8 p-0 shrink-0"
                  >
                    {removing === master.user_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Adicionar Usuário Master
            </DialogTitle>
            <DialogDescription>
              Selecione um usuário para promover a Master. Ele terá acesso total ao MFA e permissões elevadas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um usuário" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {filteredAvailable.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Nenhum usuário encontrado
                  </div>
                ) : (
                  filteredAvailable.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <div className="flex flex-col">
                        <span>{u.nome_completo}</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={!selectedUserId || adding}>
              {adding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Promover a Master
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
