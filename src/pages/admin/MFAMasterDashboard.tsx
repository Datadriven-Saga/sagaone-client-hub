import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
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
  ShieldCheck,
  Users,
  ScrollText,
  Settings2,
  UserPlus,
  UserMinus,
  Search,
  Eye,
  Copy,
  Plus,
  Trash2,
  KeyRound,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMfaMaster } from "@/hooks/useMfaMaster";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MFAAccountRow {
  id: string;
  issuer: string;
  label: string;
  user_id: string;
  created_by: string;
  created_at: string;
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

interface AuditLog {
  id: string;
  user_email: string;
  user_name: string;
  action: string;
  account_issuer: string | null;
  target_user_email: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

interface FeatureFlag {
  id: string;
  flag_key: string;
  flag_label: string;
  enabled: boolean;
}

interface ProfileRow {
  id: string;
  nome_completo: string;
  email?: string;
}

const MFAMasterDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { isMaster, loading: masterLoading, logAction } = useMfaMaster();
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<MFAAccountRow[]>([]);
  const [accessList, setAccessList] = useState<AccessRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [searchAccounts, setSearchAccounts] = useState("");
  const [searchLogs, setSearchLogs] = useState("");
  const [loadingData, setLoadingData] = useState(true);

  // Access assignment modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const loadAll = useCallback(async () => {
    setLoadingData(true);
    try {
      const [accRes, accessRes, logsRes, flagsRes, usersRes] = await Promise.all([
        supabase.from("mfa_accounts" as any).select("id, issuer, label, user_id, created_by, created_at").order("created_at", { ascending: false }),
        supabase.from("mfa_account_access" as any).select("*").order("granted_at", { ascending: false }),
        supabase.from("mfa_audit_logs" as any).select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("mfa_feature_flags" as any).select("*"),
        supabase.from("profiles").select("id, nome_completo").eq("status", "Ativo").in("tipo_acesso", ["Administrador", "Master"] as any).order("nome_completo"),
      ]);

      setAccounts((accRes.data as any[]) || []);
      setAccessList((accessRes.data as any[]) || []);
      setAuditLogs((logsRes.data as any[]) || []);
      setFeatureFlags((flagsRes.data as any[]) || []);

      // Get emails for users
      const profilesWithEmail = (usersRes.data || []).map((p: any) => ({ ...p, email: "" }));
      setUsers(profilesWithEmail);
    } catch (err: any) {
      toast({ title: "Erro ao carregar dados", description: err.message, variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isMaster && !masterLoading) loadAll();
  }, [isMaster, masterLoading, loadAll]);

  const handleGrantAccess = async () => {
    if (!selectedAccountId || !selectedUserId || !user) return;
    // Check duplicate
    const existing = accessList.find(a => a.account_id === selectedAccountId && a.user_id === selectedUserId);
    try {
      if (existing && existing.active) {
        toast({ title: "Usuário já possui acesso a este authenticator", variant: "destructive" });
        return;
      }
      if (existing && !existing.active) {
        const { error } = await (supabase.from("mfa_account_access" as any) as any)
          .update({ active: true, revoked_at: null, granted_by: user.id, granted_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mfa_account_access" as any).insert({
          account_id: selectedAccountId,
          user_id: selectedUserId,
          granted_by: user.id,
          active: true,
        });
        if (error) throw error;
      }

      const targetUser = users.find(u => u.id === selectedUserId);
      const account = accounts.find(a => a.id === selectedAccountId);
      await logAction("grant_access", selectedAccountId, account?.issuer, selectedUserId, targetUser?.nome_completo);

      toast({ title: "Acesso concedido!" });
      setShowAssignModal(false);
      setSelectedAccountId("");
      setSelectedUserId("");
      loadAll();
    } catch (err: any) {
      toast({ title: "Erro ao conceder acesso", description: err.message, variant: "destructive" });
    }
  };

  const handleRevokeAccess = async (accessId: string, accAccess: AccessRow) => {
    try {
      const { error } = await supabase
        .from("mfa_account_access" as any)
        .update({ active: false, revoked_at: new Date().toISOString() })
        .eq("id", accessId);
      if (error) throw error;

      const account = accounts.find(a => a.id === accAccess.account_id);
      const targetUser = users.find(u => u.id === accAccess.user_id);
      await logAction("revoke_access", accAccess.account_id, account?.issuer, accAccess.user_id, targetUser?.nome_completo);

      toast({ title: "Acesso revogado!" });
      loadAll();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleToggleFlag = async (flag: FeatureFlag) => {
    try {
      const { error } = await supabase
        .from("mfa_feature_flags" as any)
        .update({ enabled: !flag.enabled, updated_at: new Date().toISOString(), updated_by: user?.id })
        .eq("id", flag.id);
      if (error) throw error;
      await logAction("toggle_feature_flag", undefined, undefined, undefined, undefined, {
        flag: flag.flag_key,
        new_value: !flag.enabled,
      });
      toast({ title: `Feature flag ${!flag.enabled ? "ativada" : "desativada"}` });
      loadAll();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  if (authLoading || masterLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user || !isMaster) {
    return <Navigate to="/" replace />;
  }

  const getUserName = (userId: string) => users.find(u => u.id === userId)?.nome_completo || userId.slice(0, 8);

  const getAccountAccessUsers = (accountId: string) =>
    accessList.filter(a => a.account_id === accountId && a.active);

  const filteredAccounts = accounts.filter(a =>
    !searchAccounts || a.issuer.toLowerCase().includes(searchAccounts.toLowerCase()) || a.label?.toLowerCase().includes(searchAccounts.toLowerCase())
  );

  const filteredLogs = auditLogs.filter(l =>
    !searchLogs ||
    l.user_email?.toLowerCase().includes(searchLogs.toLowerCase()) ||
    l.action?.toLowerCase().includes(searchLogs.toLowerCase()) ||
    l.account_issuer?.toLowerCase().includes(searchLogs.toLowerCase()) ||
    l.target_user_email?.toLowerCase().includes(searchLogs.toLowerCase())
  );

  const actionLabels: Record<string, string> = {
    create: "Criou",
    view: "Visualizou",
    copy: "Copiou",
    delete: "Removeu",
    grant_access: "Concedeu acesso",
    revoke_access: "Revogou acesso",
    toggle_feature_flag: "Alterou feature flag",
    rename: "Renomeou",
  };

  const actionColors: Record<string, string> = {
    create: "bg-emerald-500/10 text-emerald-600",
    view: "bg-blue-500/10 text-blue-600",
    copy: "bg-amber-500/10 text-amber-600",
    delete: "bg-red-500/10 text-red-600",
    grant_access: "bg-emerald-500/10 text-emerald-600",
    revoke_access: "bg-red-500/10 text-red-600",
    toggle_feature_flag: "bg-purple-500/10 text-purple-600",
    rename: "bg-indigo-500/10 text-indigo-600",
  };

  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">MFA Master Dashboard</h1>
              <p className="text-sm text-muted-foreground">Controle centralizado de Authenticators</p>
            </div>
          </div>

          <Tabs defaultValue="accounts" className="w-full">
            <TabsList className="grid w-full grid-cols-4 max-w-2xl">
              <TabsTrigger value="accounts" className="gap-1.5">
                <KeyRound className="h-4 w-4" /> Authenticators
              </TabsTrigger>
              <TabsTrigger value="access" className="gap-1.5">
                <Users className="h-4 w-4" /> Acessos
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-1.5">
                <ScrollText className="h-4 w-4" /> Logs
              </TabsTrigger>
              <TabsTrigger value="flags" className="gap-1.5">
                <Settings2 className="h-4 w-4" /> Feature Flags
              </TabsTrigger>
            </TabsList>

            {/* ACCOUNTS TAB */}
            <TabsContent value="accounts" className="space-y-4 mt-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar authenticator..." value={searchAccounts} onChange={e => setSearchAccounts(e.target.value)} className="pl-9" />
                </div>
                <Badge variant="secondary">{accounts.length} total</Badge>
              </div>

              {loadingData ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : filteredAccounts.length === 0 ? (
                <Card className="border-dashed border-2">
                  <CardContent className="py-12 text-center">
                    <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground">Nenhum authenticator encontrado</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredAccounts.map(acc => {
                    const accessUsers = getAccountAccessUsers(acc.id);
                    return (
                      <Card key={acc.id}>
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-foreground">{acc.issuer}</span>
                                {acc.label && acc.label !== acc.issuer && (
                                  <span className="text-xs text-muted-foreground">({acc.label})</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>Criado: {format(new Date(acc.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                                <span>Por: {getUserName(acc.created_by)}</span>
                              </div>
                              {accessUsers.length > 0 && (
                                <div className="flex items-center gap-1 mt-2 flex-wrap">
                                  <span className="text-xs text-muted-foreground mr-1">Acesso:</span>
                                  {accessUsers.map(au => (
                                    <Badge key={au.id} variant="outline" className="text-xs">
                                      {getUserName(au.user_id)}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                              setSelectedAccountId(acc.id);
                              setShowAssignModal(true);
                            }}>
                              <UserPlus className="h-3.5 w-3.5" /> Atribuir
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ACCESS TAB */}
            <TabsContent value="access" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Atribuições de Acesso</h3>
                <Button size="sm" className="gap-1.5" onClick={() => setShowAssignModal(true)}>
                  <UserPlus className="h-4 w-4" /> Nova Atribuição
                </Button>
              </div>

              {accessList.filter(a => a.active).length === 0 ? (
                <Card className="border-dashed border-2">
                  <CardContent className="py-12 text-center">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground">Nenhum acesso atribuído</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {accessList.filter(a => a.active).map(acc => {
                    const account = accounts.find(a => a.id === acc.account_id);
                    return (
                      <Card key={acc.id}>
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{account?.issuer || acc.account_id.slice(0, 8)}</Badge>
                                <span className="text-sm">→</span>
                                <span className="text-sm font-medium">{getUserName(acc.user_id)}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                Concedido por {getUserName(acc.granted_by)} em {format(new Date(acc.granted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </span>
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

              {/* Revoked access history */}
              {accessList.filter(a => !a.active).length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Acessos Revogados</h4>
                  <div className="space-y-2 opacity-60">
                    {accessList.filter(a => !a.active).map(acc => {
                      const account = accounts.find(a => a.id === acc.account_id);
                      return (
                        <Card key={acc.id}>
                          <CardContent className="py-2">
                            <div className="flex items-center gap-2 text-sm">
                              <Badge variant="outline" className="line-through">{account?.issuer || "?"}</Badge>
                              <span>→</span>
                              <span>{getUserName(acc.user_id)}</span>
                              {acc.revoked_at && (
                                <span className="text-xs text-muted-foreground ml-auto">
                                  Revogado em {format(new Date(acc.revoked_at), "dd/MM/yyyy", { locale: ptBR })}
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* LOGS TAB */}
            <TabsContent value="logs" className="space-y-4 mt-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar nos logs..." value={searchLogs} onChange={e => setSearchLogs(e.target.value)} className="pl-9" />
                </div>
                <Badge variant="secondary">{auditLogs.length} registros</Badge>
              </div>

              {filteredLogs.length === 0 ? (
                <Card className="border-dashed border-2">
                  <CardContent className="py-12 text-center">
                    <ScrollText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground">Nenhum log encontrado</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {filteredLogs.map(log => (
                    <Card key={log.id}>
                      <CardContent className="py-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge className={`text-xs ${actionColors[log.action] || "bg-muted text-muted-foreground"}`}>
                                {actionLabels[log.action] || log.action}
                              </Badge>
                              <span className="text-sm font-medium truncate">{log.user_name || log.user_email}</span>
                            </div>
                            <div className="text-xs text-muted-foreground space-x-2">
                              {log.account_issuer && <span>Conta: <strong>{log.account_issuer}</strong></span>}
                              {log.target_user_email && <span>→ {log.target_user_email}</span>}
                              {log.details && Object.keys(log.details).length > 0 && (
                                <span className="font-mono">{JSON.stringify(log.details)}</span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* FEATURE FLAGS TAB */}
            <TabsContent value="flags" className="space-y-4 mt-4">
              <div>
                <h3 className="font-semibold text-foreground mb-1">Feature Flags</h3>
                <p className="text-sm text-muted-foreground">Controle granular de funcionalidades do MFA</p>
              </div>
              <div className="space-y-3">
                {featureFlags.map(flag => (
                  <Card key={flag.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-foreground">{flag.flag_label}</span>
                          <p className="text-xs text-muted-foreground font-mono">{flag.flag_key}</p>
                        </div>
                        <Switch checked={flag.enabled} onCheckedChange={() => handleToggleFlag(flag)} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Assign Access Modal */}
        <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Atribuir Acesso
              </DialogTitle>
              <DialogDescription>Selecione um authenticator e um usuário para conceder acesso</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Authenticator</label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.issuer}{a.label && a.label !== a.issuer ? ` (${a.label})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Usuário</label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.nome_completo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAssignModal(false)}>Cancelar</Button>
              <Button onClick={handleGrantAccess} disabled={!selectedAccountId || !selectedUserId}>Conceder Acesso</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default MFAMasterDashboard;
