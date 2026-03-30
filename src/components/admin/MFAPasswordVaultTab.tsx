import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Lock,
  LinkIcon,
  ShieldCheck,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import * as OTPAuth from "otpauth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMfaMaster } from "@/hooks/useMfaMaster";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MFAAccount {
  id: string;
  issuer: string;
  label: string;
  secret: string;
}

interface VaultEntry {
  id: string;
  account_id: string;
  login: string;
  password_plain: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface MFAPasswordVaultTabProps {
  accounts: MFAAccount[];
  onAccountCreated?: () => void;
}

export function MFAPasswordVaultTab({ accounts, onAccountCreated }: MFAPasswordVaultTabProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isMaster, logAction } = useMfaMaster();
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  // Form state
  const [formLogin, setFormLogin] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [mfaMode, setMfaMode] = useState<"existing" | "new">("existing");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [newIssuer, setNewIssuer] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [saving, setSaving] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("mfa_password_vault_decrypted" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Non-master users: filter to only accounts they have access to
      const accessibleAccountIds = new Set(accounts.map(a => a.id));
      const filtered = isMaster 
        ? (data as any[]) || []
        : ((data as any[]) || []).filter(e => accessibleAccountIds.has(e.account_id));
      setEntries(filtered);
    } catch (err: any) {
      console.error("[Vault] Load error:", err);
      toast({ title: "Erro ao carregar cofre", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, accounts, isMaster]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopyLogin = (login: string) => {
    navigator.clipboard.writeText(login);
    toast({ title: "Login copiado!" });
  };

  const handleCopyPassword = (password: string, entry: VaultEntry) => {
    navigator.clipboard.writeText(password);
    logAction("copy", entry.account_id, undefined, undefined, undefined, { type: "vault_password", vault_id: entry.id });
    toast({ title: "Senha copiada!" });
  };

  const handleDelete = async (entry: VaultEntry) => {
    try {
      const { error } = await supabase
        .from("mfa_password_vault" as any)
        .delete()
        .eq("id", entry.id);
      if (error) throw error;
      await logAction("delete", entry.account_id, undefined, undefined, undefined, { type: "vault_entry", vault_id: entry.id, login: entry.login });
      toast({ title: "Entrada removida do cofre" });
      loadEntries();
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormLogin("");
    setFormPassword("");
    setFormNotes("");
    setMfaMode("existing");
    setSelectedAccountId("");
    setNewIssuer("");
    setNewSecret("");
  };

  const handleSave = async () => {
    if (!user || !formLogin.trim() || !formPassword.trim()) {
      toast({ title: "Preencha login e senha", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      let accountId = selectedAccountId;

      // If creating new MFA, create the account first
      if (mfaMode === "new") {
        if (!newIssuer.trim() || !newSecret.trim()) {
          toast({ title: "Preencha os dados do novo MFA", variant: "destructive" });
          setSaving(false);
          return;
        }

        const { data: newAccount, error: createError } = await supabase
          .from("mfa_accounts" as any)
          .insert({
            issuer: newIssuer.trim(),
            label: newIssuer.trim(),
            secret_encrypted: newSecret.trim().replace(/\s/g, "").toUpperCase(),
            algorithm: "SHA1",
            digits: 6,
            period: 30,
            user_id: user.id,
            created_by: user.id,
          })
          .select("id")
          .single();

        if (createError) throw createError;
        accountId = (newAccount as any).id;
        await logAction("create", accountId, newIssuer.trim());
        onAccountCreated?.();
      }

      if (!accountId) {
        toast({ title: "Selecione um MFA para vincular", variant: "destructive" });
        setSaving(false);
        return;
      }

      // Create vault entry
      const { error: vaultError } = await supabase
        .from("mfa_password_vault" as any)
        .insert({
          account_id: accountId,
          login: formLogin.trim(),
          password_encrypted: formPassword,
          notes: formNotes.trim() || null,
          created_by: user.id,
        });

      if (vaultError) throw vaultError;

      await logAction("create", accountId, undefined, undefined, undefined, { type: "vault_entry", login: formLogin.trim() });
      toast({ title: "Senha salva no cofre!" });
      setShowAddModal(false);
      resetForm();
      loadEntries();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getAccountIssuer = (accountId: string) => {
    return accounts.find(a => a.id === accountId)?.issuer || "MFA desconhecido";
  };

  const handleCopyMfaCode = (entry: VaultEntry) => {
    const account = accounts.find(a => a.id === entry.account_id);
    if (!account?.secret) {
      toast({ title: "Secret MFA não encontrado", variant: "destructive" });
      return;
    }
    try {
      const totp = new OTPAuth.TOTP({
        issuer: account.issuer,
        label: account.label,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: account.secret,
      });
      const code = totp.generate();
      navigator.clipboard.writeText(code);
      logAction("copy", entry.account_id, undefined, undefined, undefined, { type: "vault_mfa_code", vault_id: entry.id });
      toast({ title: `Código MFA copiado: ${code}` });
    } catch (err: any) {
      toast({ title: "Erro ao gerar código MFA", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {entries.length} {entries.length === 1 ? "credencial salva" : "credenciais salvas"}
        </p>
        {isMaster && (
          <Button onClick={() => { resetForm(); setShowAddModal(true); }} className="gap-2" size="sm">
            <Plus className="h-4 w-4" /> Nova Senha
          </Button>
        )}
      </div>

      {/* Entries list */}
      {loading ? (
        <Card className="border-muted">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Carregando cofre...</p>
          </CardContent>
        </Card>
      ) : entries.length === 0 ? (
        <Card className="border-dashed border-2 border-muted">
          <CardContent className="py-16 text-center">
            <Lock className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Cofre vazio</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Adicione credenciais vinculadas a contas MFA para armazená-las de forma segura.
            </p>
            <Button onClick={() => { resetForm(); setShowAddModal(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> Adicionar primeira credencial
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry.id} className="border-muted hover:border-primary/30 transition-colors">
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                    <KeyRound className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">{entry.login}</span>
                      <Badge variant="outline" className="text-xs gap-1 flex-shrink-0">
                        <LinkIcon className="h-3 w-3" />
                        {getAccountIssuer(entry.account_id)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-muted-foreground">
                        {visiblePasswords.has(entry.id) ? entry.password_plain : "••••••••••"}
                      </code>
                      <Button variant="ghost" size="icon" className="h-6 w-6"
                        onClick={() => togglePasswordVisibility(entry.id)}>
                        {visiblePasswords.has(entry.id)
                          ? <EyeOff className="h-3.5 w-3.5" />
                          : <Eye className="h-3.5 w-3.5" />
                        }
                      </Button>
                    </div>
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground">{entry.notes}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Criado em {format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <TooltipProvider>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => handleCopyLogin(entry.login)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copiar login</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => handleCopyPassword(entry.password_plain, entry)}>
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copiar senha</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary"
                            onClick={() => handleCopyMfaCode(entry)}>
                            <ShieldCheck className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copiar código MFA</TooltipContent>
                      </Tooltip>
                      {isMaster && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(entry)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remover</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TooltipProvider>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <Dialog open={showAddModal} onOpenChange={(open) => { if (!open) { setShowAddModal(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Nova Credencial
            </DialogTitle>
            <DialogDescription>
              Cadastre login e senha vinculados a um MFA.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Login */}
            <div>
              <Label>Login / E-mail</Label>
              <Input
                value={formLogin}
                onChange={(e) => setFormLogin(e.target.value)}
                placeholder="usuario@exemplo.com"
              />
            </div>

            {/* Password */}
            <div>
              <Label>Senha</Label>
              <Input
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {/* Notes */}
            <div>
              <Label>Observações (opcional)</Label>
              <Input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Ex: conta principal do N8N"
              />
            </div>

            {/* MFA Association */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-sm font-medium">Vincular a MFA</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={mfaMode === "existing" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMfaMode("existing")}
                  className="flex-1"
                >
                  MFA existente
                </Button>
                <Button
                  type="button"
                  variant={mfaMode === "new" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMfaMode("new")}
                  className="flex-1"
                >
                  Criar novo MFA
                </Button>
              </div>

              {mfaMode === "existing" ? (
                <div>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um MFA..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.issuer} {acc.label !== acc.issuer ? `(${acc.label})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {accounts.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Nenhuma conta MFA disponível. Crie uma nova.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                  <div>
                    <Label className="text-xs">Nome / Issuer</Label>
                    <Input
                      value={newIssuer}
                      onChange={(e) => setNewIssuer(e.target.value)}
                      placeholder="Ex: GitHub, Google, N8N"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Secret (chave TOTP)</Label>
                    <Input
                      value={newSecret}
                      onChange={(e) => setNewSecret(e.target.value)}
                      placeholder="JBSWY3DPEHPK3PXP"
                      className="font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Cole a chave secreta Base32 fornecida pelo serviço
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowAddModal(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? "Salvando..." : "Salvar no cofre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
