import { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  UserPlus,
  UserMinus,
  Search,
  KeyRound,
  ChevronLeft,
  ScrollText,
  Shield,
  User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMfaMaster } from "@/hooks/useMfaMaster";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MFAAccessManagerProps {
  accounts: { id: string; issuer: string; label?: string; created_at: string; created_by?: string }[];
  onAccessChanged?: () => void;
}

interface AccessRow {
  id: string;
  account_id: string;
  user_id: string;
  granted_by: string;
  granted_at: string;
  active: boolean;
  revoked_at: string | null;
}

interface ProfileRow {
  id: string;
  nome_completo: string;
}

interface AuditLog {
  id: string;
  user_email: string;
  user_name: string;
  action: string;
  account_issuer: string | null;
  target_user_email: string | null;
  user_id: string;
  target_user_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const actionLabels: Record<string, string> = {
  create: "Criou", view: "Visualizou", copy: "Copiou", delete: "Removeu",
  grant_access: "Concedeu acesso", revoke_access: "Revogou acesso",
  toggle_feature_flag: "Alterou flag", rename: "Renomeou",
};

const actionColors: Record<string, string> = {
  create: "bg-emerald-500/10 text-emerald-400 dark:text-emerald-400",
  view: "bg-blue-500/10 text-blue-400 dark:text-blue-400",
  copy: "bg-amber-500/10 text-amber-400 dark:text-amber-400",
  delete: "bg-red-500/10 text-red-400 dark:text-red-400",
  grant_access: "bg-emerald-500/10 text-emerald-400 dark:text-emerald-400",
  revoke_access: "bg-red-500/10 text-red-400 dark:text-red-400",
  rename: "bg-indigo-500/10 text-indigo-400 dark:text-indigo-400",
};

export function MFAAccessManager({ accounts, onAccessChanged }: MFAAccessManagerProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { logAction } = useMfaMaster();

  const [accessList, setAccessList] = useState<AccessRow[]>([]);
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchAccess, setSearchAccess] = useState("");
  const [searchUsers, setSearchUsers] = useState("");
  const [filterAccount, setFilterAccount] = useState("all");

  // Bulk assign modal
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkSelectedAccount, setBulkSelectedAccount] = useState("");
  const [bulkSelectedUsers, setBulkSelectedUsers] = useState<string[]>([]);
  const [bulkSearchUsers, setBulkSearchUsers] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // Bulk revoke modal
  const [showBulkRevoke, setShowBulkRevoke] = useState(false);
  const [bulkRevokeAccount, setBulkRevokeAccount] = useState("");
  const [bulkRevokeUsers, setBulkRevokeUsers] = useState<string[]>([]);
  const [bulkRevokeSearch, setBulkRevokeSearch] = useState("");
  const [bulkRevoking, setBulkRevoking] = useState(false);

  // User detail view
  const [selectedUser, setSelectedUser] = useState<ProfileRow | null>(null);
  const [userLogSearch, setUserLogSearch] = useState("");
  const [userLogPage, setUserLogPage] = useState(1);
  const USER_LOGS_PER_PAGE = 15;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [accessRes, usersRes, logsRes] = await Promise.all([
        supabase.from("mfa_account_access" as any).select("*").order("granted_at", { ascending: false }),
        supabase.from("profiles").select("id, nome_completo").eq("status", "Ativo").in("tipo_acesso", ["Administrador", "Master"] as any).order("nome_completo"),
        supabase.from("mfa_audit_logs" as any).select("*").order("created_at", { ascending: false }).limit(500),
      ]);
      setAccessList((accessRes.data as any[]) || []);
      setUsers((usersRes.data || []).map((u: any) => ({ id: u.id, nome_completo: u.nome_completo })));
      setAuditLogs((logsRes.data as any[]) || []);
    } catch (err: any) {
      toast({ title: "Erro ao carregar dados", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const getUserName = (userId: string) => users.find(u => u.id === userId)?.nome_completo || userId.slice(0, 8);

  const handleRevokeAccess = async (accessId: string, acc: AccessRow) => {
    try {
      const { error } = await supabase
        .from("mfa_account_access" as any)
        .update({ active: false, revoked_at: new Date().toISOString() })
        .eq("id", accessId);
      if (error) throw error;
      const account = accounts.find(a => a.id === acc.account_id);
      const targetUser = users.find(u => u.id === acc.user_id);
      await logAction("revoke_access", acc.account_id, account?.issuer, acc.user_id, targetUser?.nome_completo);
      toast({ title: "Acesso revogado!" });
      loadData();
      onAccessChanged?.();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkSelectedAccount || bulkSelectedUsers.length === 0 || !user) return;
    setBulkAssigning(true);
    try {
      let granted = 0;
      for (const userId of bulkSelectedUsers) {
        const existing = accessList.find(a => a.account_id === bulkSelectedAccount && a.user_id === userId);
        if (existing && existing.active) continue;
        if (existing && !existing.active) {
          await supabase.from("mfa_account_access" as any)
            .update({ active: true, revoked_at: null, granted_by: user.id, granted_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await supabase.from("mfa_account_access" as any).insert({
            account_id: bulkSelectedAccount,
            user_id: userId,
            granted_by: user.id,
            active: true,
          });
        }
        const targetUser = users.find(u => u.id === userId);
        const account = accounts.find(a => a.id === bulkSelectedAccount);
        await logAction("grant_access", bulkSelectedAccount, account?.issuer, userId, targetUser?.nome_completo);
        granted++;
      }
      toast({ title: `${granted} acesso(s) concedido(s)!` });
      setShowBulkAssign(false);
      setBulkSelectedAccount("");
      setBulkSelectedUsers([]);
      setBulkSearchUsers("");
      loadData();
      onAccessChanged?.();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setBulkAssigning(false);
    }
  };

  const handleBulkRevoke = async () => {
    if (!bulkRevokeAccount || bulkRevokeUsers.length === 0) return;
    setBulkRevoking(true);
    try {
      let revoked = 0;
      for (const userId of bulkRevokeUsers) {
        const access = accessList.find(a => a.account_id === bulkRevokeAccount && a.user_id === userId && a.active);
        if (!access) continue;
        const { error } = await supabase
          .from("mfa_account_access" as any)
          .update({ active: false, revoked_at: new Date().toISOString() })
          .eq("id", access.id);
        if (error) throw error;
        const account = accounts.find(a => a.id === bulkRevokeAccount);
        const targetUser = users.find(u => u.id === userId);
        await logAction("revoke_access", bulkRevokeAccount, account?.issuer, userId, targetUser?.nome_completo);
        revoked++;
      }
      toast({ title: `${revoked} acesso(s) revogado(s)!` });
      setShowBulkRevoke(false);
      setBulkRevokeAccount("");
      setBulkRevokeUsers([]);
      setBulkRevokeSearch("");
      loadData();
      onAccessChanged?.();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setBulkRevoking(false);
    }
  };

  // Bulk revoke filtered users
  const bulkRevokeFilteredUsers = bulkRevokeAccount
    ? users.filter(u => {
        const hasAccess = accessList.some(a => a.account_id === bulkRevokeAccount && a.user_id === u.id && a.active);
        if (!hasAccess) return false;
        if (!bulkRevokeSearch) return true;
        return u.nome_completo.toLowerCase().includes(bulkRevokeSearch.toLowerCase());
      })
    : [];

  const handleGrantSingleAccess = async (accountId: string, userId: string) => {
    if (!user) return;
    const existing = accessList.find(a => a.account_id === accountId && a.user_id === userId);
    try {
      if (existing && existing.active) {
        toast({ title: "Usuário já possui acesso", variant: "destructive" });
        return;
      }
      if (existing && !existing.active) {
        await supabase.from("mfa_account_access" as any)
          .update({ active: true, revoked_at: null, granted_by: user.id, granted_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("mfa_account_access" as any).insert({
          account_id: accountId, user_id: userId, granted_by: user.id, active: true,
        });
      }
      const targetUser = users.find(u => u.id === userId);
      const account = accounts.find(a => a.id === accountId);
      await logAction("grant_access", accountId, account?.issuer, userId, targetUser?.nome_completo);
      toast({ title: "Acesso concedido!" });
      loadData();
      onAccessChanged?.();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  // ─── Filtered data ─────────────────────────────────────
  const activeAccess = accessList.filter(a => a.active);

  // Group by authenticator
  const accessByAccount = accounts.map(acc => ({
    account: acc,
    accesses: activeAccess.filter(a => a.account_id === acc.id),
  })).filter(g => {
    if (filterAccount !== "all" && g.account.id !== filterAccount) return false;
    if (!searchAccess) return true;
    const s = searchAccess.toLowerCase();
    const matchAccount = g.account.issuer.toLowerCase().includes(s);
    const matchUser = g.accesses.some(a => getUserName(a.user_id).toLowerCase().includes(s));
    return matchAccount || matchUser;
  });

  // Group by user
  const accessByUser = users.map(u => ({
    user: u,
    accesses: activeAccess.filter(a => a.user_id === u.id),
  })).filter(g => g.accesses.length > 0 || searchUsers).filter(g => {
    if (!searchUsers) return g.accesses.length > 0;
    return g.user.nome_completo.toLowerCase().includes(searchUsers.toLowerCase());
  });

  // User detail logs
  const userLogs = selectedUser
    ? auditLogs.filter(l => {
        const matchesUser = l.user_id === selectedUser.id || l.target_user_id === selectedUser.id;
        if (!userLogSearch) return matchesUser;
        const s = userLogSearch.toLowerCase();
        return matchesUser && (
          l.action?.toLowerCase().includes(s) ||
          l.account_issuer?.toLowerCase().includes(s) ||
          l.user_name?.toLowerCase().includes(s)
        );
      })
    : [];
  const totalUserLogPages = Math.max(1, Math.ceil(userLogs.length / USER_LOGS_PER_PAGE));
  const paginatedUserLogs = userLogs.slice((userLogPage - 1) * USER_LOGS_PER_PAGE, userLogPage * USER_LOGS_PER_PAGE);

  // Bulk assign filtered users
  const bulkFilteredUsers = users.filter(u => {
    if (!bulkSearchUsers) return true;
    return u.nome_completo.toLowerCase().includes(bulkSearchUsers.toLowerCase());
  });

  const alreadyAssignedUserIds = bulkSelectedAccount
    ? activeAccess.filter(a => a.account_id === bulkSelectedAccount).map(a => a.user_id)
    : [];

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2" />
        Carregando...
      </div>
    );
  }

  // ─── User detail view ──────────────────────────────────
  if (selectedUser) {
    const userAccesses = activeAccess.filter(a => a.user_id === selectedUser.id);
    const userAccountIds = userAccesses.map(a => a.account_id);
    const availableAccounts = accounts.filter(a => !userAccountIds.includes(a.id));

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(null); setUserLogSearch(""); setUserLogPage(1); }}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{selectedUser.nome_completo}</h3>
              <p className="text-xs text-muted-foreground">{userAccesses.length} authenticator(s) atribuído(s)</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="authenticators" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-sm">
            <TabsTrigger value="authenticators" className="gap-1.5">
              <KeyRound className="h-4 w-4" /> Authenticators
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5">
              <ScrollText className="h-4 w-4" /> Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="authenticators" className="space-y-3 mt-4">
            {/* Current accesses */}
            {userAccesses.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="py-8 text-center">
                  <Shield className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum authenticator atribuído</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {userAccesses.map(acc => {
                  const account = accounts.find(a => a.id === acc.account_id);
                  return (
                    <Card key={acc.id}>
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-foreground">{account?.issuer || "?"}</span>
                            <p className="text-xs text-muted-foreground">
                              Concedido em {format(new Date(acc.granted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1"
                            onClick={() => handleRevokeAccess(acc.id, acc)}>
                            <UserMinus className="h-3.5 w-3.5" /> Revogar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Add authenticator to user */}
            {availableAccounts.length > 0 && (
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-2">Adicionar authenticator:</p>
                <div className="flex flex-wrap gap-2">
                  {availableAccounts.map(acc => (
                    <Button key={acc.id} variant="outline" size="sm" className="gap-1.5"
                      onClick={() => handleGrantSingleAccess(acc.id, selectedUser.id)}>
                      <UserPlus className="h-3 w-3" /> {acc.issuer}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs" className="space-y-3 mt-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar nos logs..." value={userLogSearch}
                  onChange={e => { setUserLogSearch(e.target.value); setUserLogPage(1); }} className="pl-9" />
              </div>
              <Badge variant="secondary">{userLogs.length} registros</Badge>
            </div>

            {userLogs.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="py-8 text-center">
                  <ScrollText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum log encontrado para este usuário</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-2">
                  {paginatedUserLogs.map(log => (
                    <Card key={log.id}>
                      <CardContent className="py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <Badge className={`text-xs ${actionColors[log.action] || "bg-muted text-muted-foreground"}`}>
                                {actionLabels[log.action] || log.action}
                              </Badge>
                              {log.account_issuer && (
                                <span className="text-xs text-muted-foreground">Conta: <strong>{log.account_issuer}</strong></span>
                              )}
                            </div>
                            {log.target_user_email && log.target_user_id !== selectedUser.id && (
                              <span className="text-xs text-muted-foreground">→ {log.target_user_email}</span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {totalUserLogPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Button variant="outline" size="sm" disabled={userLogPage <= 1} onClick={() => setUserLogPage(p => p - 1)}>Anterior</Button>
                    <span className="text-sm text-muted-foreground">Página {userLogPage} de {totalUserLogPages}</span>
                    <Button variant="outline" size="sm" disabled={userLogPage >= totalUserLogPages} onClick={() => setUserLogPage(p => p + 1)}>Próxima</Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // ─── Main access management view ──────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-foreground">Gestão de Acessos</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setShowBulkRevoke(true)}>
            <UserMinus className="h-4 w-4" /> Revogar em Lote
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setShowBulkAssign(true)}>
            <UserPlus className="h-4 w-4" /> Atribuir Acesso
          </Button>
        </div>
      </div>

      <Tabs defaultValue="by-authenticator" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="by-authenticator" className="gap-1.5">
            <KeyRound className="h-4 w-4" /> Por Authenticator
          </TabsTrigger>
          <TabsTrigger value="by-user" className="gap-1.5">
            <Users className="h-4 w-4" /> Por Usuário
          </TabsTrigger>
        </TabsList>

        {/* BY AUTHENTICATOR */}
        <TabsContent value="by-authenticator" className="space-y-3 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar authenticator ou usuário..." value={searchAccess}
                onChange={e => setSearchAccess(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterAccount} onValueChange={setFilterAccount}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filtrar por conta" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os authenticators</SelectItem>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.issuer}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary">{activeAccess.length} atribuições ativas</Badge>
          </div>

          {accessByAccount.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="py-10 text-center">
                <Shield className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum acesso encontrado</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {accessByAccount.map(({ account, accesses }) => (
                <Card key={account.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-foreground">{account.issuer}</span>
                        <Badge variant="secondary" className="text-xs">{accesses.length} usuário(s)</Badge>
                      </div>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                        setBulkSelectedAccount(account.id);
                        setShowBulkAssign(true);
                      }}>
                        <UserPlus className="h-3.5 w-3.5" /> Adicionar
                      </Button>
                    </div>
                    {accesses.length > 0 ? (
                      <div className="space-y-1.5">
                        {accesses.map(acc => (
                          <div key={acc.id} className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                            <div>
                              <span className="text-sm font-medium text-foreground">{getUserName(acc.user_id)}</span>
                              <p className="text-[11px] text-muted-foreground">
                                Concedido em {format(new Date(acc.granted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1 h-7"
                              onClick={() => handleRevokeAccess(acc.id, acc)}>
                              <UserMinus className="h-3 w-3" /> Revogar
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic pl-6">Nenhum usuário com acesso</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* BY USER */}
        <TabsContent value="by-user" className="space-y-3 mt-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar usuário..." value={searchUsers}
                onChange={e => setSearchUsers(e.target.value)} className="pl-9" />
            </div>
            <Badge variant="secondary">{accessByUser.filter(u => u.accesses.length > 0).length} usuário(s) com acesso</Badge>
          </div>

          {accessByUser.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="py-10 text-center">
                <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum usuário encontrado</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {accessByUser.map(({ user: u, accesses }) => (
                <Card key={u.id} className="cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => { setSelectedUser(u); setUserLogPage(1); setUserLogSearch(""); }}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-foreground">{u.nome_completo}</span>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            {accesses.map(a => {
                              const acc = accounts.find(ac => ac.id === a.account_id);
                              return (
                                <Badge key={a.id} variant="outline" className="text-[10px] h-5">
                                  {acc?.issuer || "?"}
                                </Badge>
                              );
                            })}
                            {accesses.length === 0 && (
                              <span className="text-xs text-muted-foreground italic">Sem acessos</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronLeft className="h-4 w-4 text-muted-foreground rotate-180" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Bulk Assign Modal */}
      <Dialog open={showBulkAssign} onOpenChange={(open) => {
        if (!open) { setShowBulkAssign(false); setBulkSelectedAccount(""); setBulkSelectedUsers([]); setBulkSearchUsers(""); }
      }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Atribuir Acesso em Lote
            </DialogTitle>
            <DialogDescription>Selecione um authenticator e múltiplos usuários</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Account selection */}
            <div>
              <label className="text-sm font-medium mb-1 block">Authenticator</label>
              <Select value={bulkSelectedAccount} onValueChange={(v) => { setBulkSelectedAccount(v); setBulkSelectedUsers([]); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o authenticator..." /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.issuer}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* User selection with search and checkboxes */}
            {bulkSelectedAccount && (
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Usuários</label>
                  {bulkSelectedUsers.length > 0 && (
                    <Badge variant="secondary">{bulkSelectedUsers.length} selecionado(s)</Badge>
                  )}
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar usuário..." value={bulkSearchUsers}
                    onChange={e => setBulkSearchUsers(e.target.value)} className="pl-9" />
                </div>

                {/* Select all / deselect all */}
                <div className="flex items-center gap-2 mb-2">
                  <Button variant="ghost" size="sm" className="text-xs h-7"
                    onClick={() => {
                      const selectableIds = bulkFilteredUsers
                        .filter(u => !alreadyAssignedUserIds.includes(u.id))
                        .map(u => u.id);
                      setBulkSelectedUsers(selectableIds);
                    }}>
                    Selecionar todos
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs h-7"
                    onClick={() => setBulkSelectedUsers([])}>
                    Limpar seleção
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 max-h-[280px] pr-1">
                  {bulkFilteredUsers.map(u => {
                    const alreadyHas = alreadyAssignedUserIds.includes(u.id);
                    const isSelected = bulkSelectedUsers.includes(u.id);
                    return (
                      <label key={u.id}
                        className={`flex items-center gap-3 py-2 px-3 rounded-md transition-colors cursor-pointer
                          ${alreadyHas ? "opacity-50 cursor-not-allowed bg-muted/20" : "hover:bg-muted/40"}
                          ${isSelected ? "bg-primary/5 border border-primary/20" : ""}
                        `}>
                        <Checkbox
                          checked={isSelected || alreadyHas}
                          disabled={alreadyHas}
                          onCheckedChange={(checked) => {
                            if (alreadyHas) return;
                            setBulkSelectedUsers(prev =>
                              checked ? [...prev, u.id] : prev.filter(id => id !== u.id)
                            );
                          }}
                        />
                        <span className="text-sm text-foreground">{u.nome_completo}</span>
                        {alreadyHas && <Badge variant="outline" className="text-[10px] ml-auto">Já possui</Badge>}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => { setShowBulkAssign(false); setBulkSelectedAccount(""); setBulkSelectedUsers([]); setBulkSearchUsers(""); }}>
              Cancelar
            </Button>
            <Button onClick={handleBulkAssign}
              disabled={!bulkSelectedAccount || bulkSelectedUsers.length === 0 || bulkAssigning}>
              {bulkAssigning ? "Concedendo..." : `Conceder Acesso (${bulkSelectedUsers.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Revoke Modal */}
      <Dialog open={showBulkRevoke} onOpenChange={(open) => {
        if (!open) { setShowBulkRevoke(false); setBulkRevokeAccount(""); setBulkRevokeUsers([]); setBulkRevokeSearch(""); }
      }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserMinus className="h-5 w-5 text-destructive" />
              Revogar Acesso em Lote
            </DialogTitle>
            <DialogDescription>Selecione um authenticator e os usuários para revogar</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div>
              <label className="text-sm font-medium mb-1 block">Authenticator</label>
              <Select value={bulkRevokeAccount} onValueChange={(v) => { setBulkRevokeAccount(v); setBulkRevokeUsers([]); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o authenticator..." /></SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => activeAccess.some(ac => ac.account_id === a.id)).map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.issuer}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {bulkRevokeAccount && (
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Usuários com acesso</label>
                  {bulkRevokeUsers.length > 0 && (
                    <Badge variant="secondary">{bulkRevokeUsers.length} selecionado(s)</Badge>
                  )}
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar usuário..." value={bulkRevokeSearch}
                    onChange={e => setBulkRevokeSearch(e.target.value)} className="pl-9" />
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <Button variant="ghost" size="sm" className="text-xs h-7"
                    onClick={() => setBulkRevokeUsers(bulkRevokeFilteredUsers.map(u => u.id))}>
                    Selecionar todos
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs h-7"
                    onClick={() => setBulkRevokeUsers([])}>
                    Limpar seleção
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 max-h-[280px] pr-1">
                  {bulkRevokeFilteredUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário com acesso a este authenticator</p>
                  ) : (
                    bulkRevokeFilteredUsers.map(u => {
                      const isSelected = bulkRevokeUsers.includes(u.id);
                      return (
                        <label key={u.id}
                          className={`flex items-center gap-3 py-2 px-3 rounded-md transition-colors cursor-pointer hover:bg-muted/40
                            ${isSelected ? "bg-destructive/5 border border-destructive/20" : ""}
                          `}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              setBulkRevokeUsers(prev =>
                                checked ? [...prev, u.id] : prev.filter(id => id !== u.id)
                              );
                            }}
                          />
                          <span className="text-sm text-foreground">{u.nome_completo}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => { setShowBulkRevoke(false); setBulkRevokeAccount(""); setBulkRevokeUsers([]); setBulkRevokeSearch(""); }}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleBulkRevoke}
              disabled={!bulkRevokeAccount || bulkRevokeUsers.length === 0 || bulkRevoking}>
              {bulkRevoking ? "Revogando..." : `Revogar Acesso (${bulkRevokeUsers.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
