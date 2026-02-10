import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Plus,
  Trash2,
  Copy,
  Camera,
  KeyRound,
  MoreVertical,
  FileKey,
  Upload,
  FileText,
  X,
  Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as OTPAuth from "otpauth";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface MFAAccount {
  id: string;
  issuer: string;
  label: string;
  secret: string;
  algorithm: string;
  digits: number;
  period: number;
  created_by?: string;
  created_at: string;
}

function generateTOTP(secret: string, period = 30, digits = 6, algorithm = "SHA1"): string {
  try {
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret.replace(/\s/g, "").toUpperCase()),
      digits,
      period,
      algorithm,
    });
    return totp.generate();
  } catch {
    return "------";
  }
}

function parseOtpauthUri(uri: string): Partial<MFAAccount> | null {
  try {
    const parsed = OTPAuth.URI.parse(uri);
    if (parsed instanceof OTPAuth.TOTP) {
      return {
        issuer: parsed.issuer || "Desconhecido",
        label: parsed.label || parsed.issuer || "Conta",
        secret: parsed.secret.base32,
        algorithm: parsed.algorithm || "SHA1",
        digits: parsed.digits || 6,
        period: parsed.period || 30,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function TOTPCode({ account }: { account: MFAAccount }) {
  const [code, setCode] = useState(() => generateTOTP(account.secret, account.period, account.digits, account.algorithm));
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = account.period - (now % account.period);
      setTimeLeft(remaining);
      setCode(generateTOTP(account.secret, account.period, account.digits, account.algorithm));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [account.secret, account.period, account.digits, account.algorithm]);

  const progress = (timeLeft / account.period) * 100;
  const isLow = timeLeft <= 5;
  const formattedCode = code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-10 w-10 flex items-center justify-center">
        <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--muted))" strokeWidth="2" />
          <circle
            cx="18" cy="18" r="15.5" fill="none"
            stroke={isLow ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
            strokeWidth="2" strokeDasharray={`${progress} 100`} strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <span className={`absolute text-xs font-mono font-bold ${isLow ? "text-destructive" : "text-foreground"}`}>{timeLeft}</span>
      </div>
      <span className={`text-3xl font-mono font-bold tracking-wider ${isLow ? "text-destructive" : "text-foreground"}`}>{formattedCode}</span>
    </div>
  );
}

export function MFAAgentesContent() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<MFAAccount[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<"choose" | "scan" | "manual">("choose");
  const [manualForm, setManualForm] = useState({ issuer: "", secret: "", keyType: "totp" });
  const [scanning, setScanning] = useState(false);
  const html5QrRef = useRef<Html5Qrcode | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Recovery codes state
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryAccount, setRecoveryAccount] = useState<MFAAccount | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [recoveryInput, setRecoveryInput] = useState("");
  const [recoveryAddMode, setRecoveryAddMode] = useState<"choose" | "manual" | "file">("choose");
  const [loadingRecovery, setLoadingRecovery] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit account state
  const [editingAccount, setEditingAccount] = useState<MFAAccount | null>(null);
  const [editName, setEditName] = useState("");

  // Load accounts from Supabase
  const loadAccountsFromDB = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const { data, error } = await supabase
        .from("mfa_accounts" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAccounts((data as any[]) || []);
    } catch (err) {
      console.error("Erro ao carregar contas MFA:", err);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    loadAccountsFromDB();
  }, [loadAccountsFromDB]);

  // Load recovery codes for an account
  const loadRecoveryCodes = useCallback(async (accountId: string) => {
    setLoadingRecovery(true);
    try {
      const { data, error } = await supabase
        .from("mfa_recovery_codes" as any)
        .select("codes")
        .eq("account_id", accountId)
        .maybeSingle();
      if (error) throw error;
      setRecoveryCodes((data as any)?.codes || []);
    } catch {
      setRecoveryCodes([]);
    } finally {
      setLoadingRecovery(false);
    }
  }, []);

  // Save recovery codes for an account
  const saveRecoveryCodes = useCallback(async (accountId: string, codes: string[]) => {
    if (!user) return;
    const cleanCodes = codes.map(c => c.trim()).filter(Boolean);
    try {
      // Try upsert
      const { error } = await supabase
        .from("mfa_recovery_codes" as any)
        .upsert(
          { user_id: user.id, account_id: accountId, codes: cleanCodes, updated_at: new Date().toISOString() },
          { onConflict: "user_id,account_id" }
        );
      if (error) throw error;
      setRecoveryCodes(cleanCodes);
      toast({ title: "Recovery codes salvos!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  }, [user, toast]);

  // Delete recovery codes for an account
  const deleteRecoveryCodes = useCallback(async (accountId: string) => {
    await supabase
      .from("mfa_recovery_codes" as any)
      .delete()
      .eq("account_id", accountId);
  }, []);

  const openRecoveryModal = (account: MFAAccount) => {
    setRecoveryAccount(account);
    setRecoveryAddMode("choose");
    setRecoveryInput("");
    setShowRecoveryModal(true);
    loadRecoveryCodes(account.id);
  };

  const handleAddRecoveryManual = () => {
    const newCodes = recoveryInput
      .split(/[\n,;]+/)
      .map(c => c.trim())
      .filter(Boolean);
    if (newCodes.length === 0) {
      toast({ title: "Insira ao menos um código", variant: "destructive" });
      return;
    }
    const merged = [...recoveryCodes, ...newCodes];
    if (recoveryAccount) saveRecoveryCodes(recoveryAccount.id, merged);
    setRecoveryInput("");
    setRecoveryAddMode("choose");
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const newCodes = text
        .split(/[\n,;]+/)
        .map(c => c.trim())
        .filter(Boolean);
      if (newCodes.length === 0) {
        toast({ title: "Nenhum código encontrado no arquivo", variant: "destructive" });
        return;
      }
      const merged = [...recoveryCodes, ...newCodes];
      if (recoveryAccount) saveRecoveryCodes(recoveryAccount.id, merged);
      setRecoveryAddMode("choose");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleRemoveRecoveryCode = (index: number) => {
    const updated = recoveryCodes.filter((_, i) => i !== index);
    if (recoveryAccount) saveRecoveryCodes(recoveryAccount.id, updated);
  };

  const stopCamera = useCallback(async () => {
    if (html5QrRef.current) {
      try {
        const state = html5QrRef.current.getState();
        if (state === 2) await html5QrRef.current.stop();
      } catch { /* ignore */ }
      html5QrRef.current.clear();
      html5QrRef.current = null;
    }
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      await new Promise((r) => setTimeout(r, 200));
      const containerId = "mfa-qr-scanner";
      const container = document.getElementById(containerId);
      if (!container) return;
      const html5Qr = new Html5Qrcode(containerId);
      html5QrRef.current = html5Qr;
      await html5Qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          if (decodedText?.startsWith("otpauth://")) handleQRResult(decodedText);
        },
        () => {}
      );
      setScanning(true);
    } catch {
      toast({ title: "Câmera indisponível", description: "Use a opção manual.", variant: "destructive" });
      setAddMode("manual");
    }
  }, [toast]);

  const saveAccountToDB = useCallback(async (account: MFAAccount) => {
    try {
      const { error } = await supabase
        .from("mfa_accounts" as any)
        .insert({
          id: account.id,
          issuer: account.issuer,
          label: account.label,
          secret: account.secret,
          algorithm: account.algorithm,
          digits: account.digits,
          period: account.period,
          created_by: user?.id,
        });
      if (error) throw error;
      await loadAccountsFromDB();
    } catch (err: any) {
      toast({ title: "Erro ao salvar conta", description: err.message, variant: "destructive" });
    }
  }, [user, loadAccountsFromDB, toast]);

  const handleQRResult = (uri: string) => {
    stopCamera();
    const parsed = parseOtpauthUri(uri);
    if (!parsed?.secret) {
      toast({ title: "QR Code inválido", variant: "destructive" });
      return;
    }
    const newAccount: MFAAccount = {
      id: `mfa-${Date.now()}`,
      issuer: parsed.issuer || "Desconhecido",
      label: parsed.label || "",
      secret: parsed.secret,
      algorithm: parsed.algorithm || "SHA1",
      digits: parsed.digits || 6,
      period: parsed.period || 30,
      created_at: new Date().toISOString(),
    };
    saveAccountToDB(newAccount);
    setShowAddModal(false);
    setAddMode("choose");
    toast({ title: "Conta adicionada!", description: newAccount.issuer });
  };

  const handleManualAdd = () => {
    const secret = manualForm.secret.replace(/\s/g, "").toUpperCase();
    if (!secret) { toast({ title: "Chave obrigatória", variant: "destructive" }); return; }
    if (!manualForm.issuer.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    try { OTPAuth.Secret.fromBase32(secret); } catch {
      toast({ title: "Chave inválida", description: "Base32 inválido", variant: "destructive" }); return;
    }
    const newAccount: MFAAccount = {
      id: `mfa-${Date.now()}`,
      issuer: manualForm.issuer.trim(),
      label: manualForm.issuer.trim(),
      secret,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      created_at: new Date().toISOString(),
    };
    saveAccountToDB(newAccount);
    setShowAddModal(false);
    setAddMode("choose");
    setManualForm({ issuer: "", secret: "", keyType: "totp" });
    toast({ title: "Conta adicionada!", description: newAccount.issuer });
  };

  const handleDelete = async (id: string) => {
    const account = accounts.find((a) => a.id === id);
    try {
      await supabase.from("mfa_accounts" as any).delete().eq("id", id);
      deleteRecoveryCodes(id);
      await loadAccountsFromDB();
      toast({ title: "Conta removida", description: account?.issuer });
    } catch {
      toast({ title: "Erro ao remover conta", variant: "destructive" });
    }
    setExpandedId(null);
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code.replace(/\s/g, ""));
    toast({ title: "Código copiado!" });
  };

  const handleRename = async () => {
    if (!editingAccount || !editName.trim()) return;
    try {
      const { error } = await supabase
        .from("mfa_accounts" as any)
        .update({ issuer: editName.trim(), label: editName.trim(), updated_at: new Date().toISOString() })
        .eq("id", editingAccount.id);
      if (error) throw error;
      await loadAccountsFromDB();
      toast({ title: "Nome atualizado!" });
    } catch (err: any) {
      toast({ title: "Erro ao renomear", description: err.message, variant: "destructive" });
    }
    setEditingAccount(null);
    setEditName("");
  };

  const closeModal = () => {
    stopCamera();
    setShowAddModal(false);
    setAddMode("choose");
    setManualForm({ issuer: "", secret: "", keyType: "totp" });
  };

  const getInitials = (issuer: string) => issuer.slice(0, 2).toUpperCase();

  const getColorForIssuer = (issuer: string): string => {
    const colors = ["bg-blue-600", "bg-emerald-600", "bg-violet-600", "bg-amber-600", "bg-rose-600", "bg-cyan-600", "bg-indigo-600", "bg-pink-600"];
    let hash = 0;
    for (let i = 0; i < issuer.length; i++) hash = issuer.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Authenticator</h2>
            <p className="text-sm text-muted-foreground">
              {accounts.length} {accounts.length === 1 ? "conta" : "contas"} cadastradas
            </p>
          </div>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Adicionar MFA
        </Button>
      </div>

      {/* Accounts List */}
      {loadingAccounts ? (
        <Card className="border-muted">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Carregando contas MFA...</p>
          </CardContent>
        </Card>
      ) : accounts.length === 0 ? (
        <Card className="border-dashed border-2 border-muted">
          <CardContent className="py-16 text-center">
            <ShieldCheck className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Nenhuma conta MFA</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Adicione contas MFA escaneando QR Codes ou inserindo chaves manualmente.
            </p>
            <Button onClick={() => setShowAddModal(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Adicionar primeira conta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <Card
              key={account.id}
              className="border-muted hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => {
                const code = generateTOTP(account.secret, account.period, account.digits, account.algorithm);
                handleCopy(code);
              }}
            >
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-full ${getColorForIssuer(account.issuer)} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white font-bold text-sm">{getInitials(account.issuer)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground truncate">{account.issuer}</span>
                      {account.label && account.label !== account.issuer && (
                        <span className="text-xs text-muted-foreground truncate">({account.label})</span>
                      )}
                    </div>
                    <TOTPCode account={account} />
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === account.id ? null : account.id); }}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {expandedId === account.id && (
                  <div className="mt-3 pt-3 border-t border-muted flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                      onClick={() => { setEditingAccount(account); setEditName(account.issuer); }}>
                      <Pencil className="h-3 w-3" /> Renomear
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                      onClick={() => { navigator.clipboard.writeText(account.secret); toast({ title: "Chave copiada!" }); }}>
                      <Copy className="h-3 w-3" /> Copiar chave
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                      onClick={() => openRecoveryModal(account)}>
                      <FileKey className="h-3 w-3" /> Recovery Codes
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-destructive hover:text-destructive"
                      onClick={() => handleDelete(account.id)}>
                      <Trash2 className="h-3 w-3" /> Remover
                    </Button>
                    <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                      {account.algorithm} • {account.digits} dígitos • {account.period}s
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Account Modal */}
      <Dialog open={showAddModal} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-md" hideCloseButton={addMode === "scan"}>
          {addMode === "choose" && (
            <>
              <DialogHeader>
                <DialogTitle>Adicionar nova MFA</DialogTitle>
                <DialogDescription>Escolha como deseja adicionar a conta</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-3 py-4">
                <Button variant="outline" className="h-auto py-6 flex flex-col items-center gap-3"
                  onClick={() => { setAddMode("scan"); setTimeout(() => startCamera(), 100); }}>
                  <Camera className="h-8 w-8 text-primary" />
                  <div className="text-center">
                    <p className="font-semibold">Escanear QR Code</p>
                    <p className="text-xs text-muted-foreground">Use a câmera para ler o QR Code</p>
                  </div>
                </Button>
                <Button variant="outline" className="h-auto py-6 flex flex-col items-center gap-3"
                  onClick={() => setAddMode("manual")}>
                  <KeyRound className="h-8 w-8 text-primary" />
                  <div className="text-center">
                    <p className="font-semibold">Inserir chave manualmente</p>
                    <p className="text-xs text-muted-foreground">Cole a setup key (Base32) do serviço</p>
                  </div>
                </Button>
              </div>
            </>
          )}

          {addMode === "scan" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center">Escanear QR Code</DialogTitle>
              </DialogHeader>
              <div id="mfa-qr-scanner" className="w-full max-w-sm mx-auto rounded-xl overflow-hidden" style={{ minHeight: 300 }} />
              {!scanning && (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">Iniciando câmera...</p>
                </div>
              )}
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { stopCamera(); setAddMode("choose"); }} className="flex-1">Voltar</Button>
                <Button variant="outline" onClick={() => { stopCamera(); setAddMode("manual"); }} className="flex-1">Inserir manualmente</Button>
              </DialogFooter>
            </>
          )}

          {addMode === "manual" && (
            <>
              <DialogHeader>
                <DialogTitle>Inserir dados da conta</DialogTitle>
                <DialogDescription>Insira as informações fornecidas pelo serviço</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Nome da conta *</Label>
                  <Input value={manualForm.issuer} onChange={(e) => setManualForm({ ...manualForm, issuer: e.target.value })} placeholder="Ex: GitHub, Google, n8n" />
                </div>
                <div>
                  <Label>Chave secreta (Setup Key) *</Label>
                  <Input value={manualForm.secret} onChange={(e) => setManualForm({ ...manualForm, secret: e.target.value })} placeholder="Ex: JBSWY3DPEHPK3PXP" className="font-mono" />
                  <p className="text-[11px] text-muted-foreground mt-1">Chave Base32 fornecida pelo serviço</p>
                </div>
                <div>
                  <Label>Tipo de chave</Label>
                  <Select value={manualForm.keyType} onValueChange={(v) => setManualForm({ ...manualForm, keyType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="totp">Time based</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setAddMode("choose")}>Voltar</Button>
                <Button onClick={handleManualAdd} className="flex-1">Adicionar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Recovery Codes Modal */}
      <Dialog open={showRecoveryModal} onOpenChange={(open) => { if (!open) { setShowRecoveryModal(false); setRecoveryAccount(null); setRecoveryAddMode("choose"); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileKey className="h-5 w-5 text-primary" />
              Recovery Codes — {recoveryAccount?.issuer}
            </DialogTitle>
            <DialogDescription>
              Gerencie os códigos de recuperação desta conta. Eles são únicos e vinculados apenas a esta conta.
            </DialogDescription>
          </DialogHeader>

          {recoveryAddMode === "choose" && (
            <div className="space-y-4">
              {/* Existing codes */}
              {loadingRecovery ? (
                <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
              ) : recoveryCodes.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{recoveryCodes.length} código(s) salvos</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {recoveryCodes.map((code, i) => (
                      <div key={i} className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1.5 group">
                        <code className="text-xs font-mono text-foreground flex-1 truncate">{code}</code>
                        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => { navigator.clipboard.writeText(code); toast({ title: "Código copiado!" }); }}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                          onClick={() => handleRemoveRecoveryCode(i)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs w-full"
                    onClick={() => { navigator.clipboard.writeText(recoveryCodes.join("\n")); toast({ title: "Todos os códigos copiados!" }); }}>
                    <Copy className="h-3 w-3" /> Copiar todos
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <FileKey className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum recovery code salvo para esta conta</p>
                </div>
              )}

              {/* Add options */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2"
                  onClick={() => setRecoveryAddMode("manual")}>
                  <KeyRound className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium">Digitar códigos</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2"
                  onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium">Importar arquivo</span>
                </Button>
              </div>
              <input ref={fileInputRef} type="file" accept=".txt,.csv,.text" className="hidden" onChange={handleFileImport} />
            </div>
          )}

          {recoveryAddMode === "manual" && (
            <div className="space-y-4">
              <div>
                <Label>Cole os recovery codes</Label>
                <Textarea
                  value={recoveryInput}
                  onChange={(e) => setRecoveryInput(e.target.value)}
                  placeholder={"abc12-def34\nghi56-jkl78\nmno90-pqr12\n..."}
                  className="font-mono text-sm min-h-[120px]"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Um código por linha, ou separados por vírgula/ponto e vírgula</p>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { setRecoveryAddMode("choose"); setRecoveryInput(""); }}>Voltar</Button>
                <Button onClick={handleAddRecoveryManual} className="flex-1">Salvar códigos</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Account Name Modal */}
      <Dialog open={!!editingAccount} onOpenChange={(open) => { if (!open) { setEditingAccount(null); setEditName(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Renomear conta
            </DialogTitle>
            <DialogDescription>Altere o nome da conta MFA</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>Nome da conta</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Ex: GitHub, Google, n8n" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setEditingAccount(null); setEditName(""); }}>Cancelar</Button>
            <Button onClick={handleRename} disabled={!editName.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
