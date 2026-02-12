import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  ShieldCheck,
  Plus,
  Trash2,
  Copy,
  Camera,
  KeyRound,
  MoreVertical,
  FileKey,
  Upload,
  X,
  Pencil,
  ScrollText,
  Users,
  UserPlus,
  UserMinus,
  Search,
} from "lucide-react";
import { MFAAccessManager } from "@/components/admin/MFAAccessManager";
import { useToast } from "@/hooks/use-toast";
import * as OTPAuth from "otpauth";
import { Html5Qrcode } from "html5-qrcode";
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
  algorithm: string;
  digits: number;
  period: number;
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

// Parse Google Authenticator migration QR codes (otpauth-migration://offline?data=...)
function parseOtpauthMigration(uri: string): Partial<MFAAccount>[] {
  try {
    const url = new URL(uri);
    const b64 = url.searchParams.get("data");
    if (!b64) return [];

    const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const accounts: Partial<MFAAccount>[] = [];

    const parseOtpParams = (data: Uint8Array): Partial<MFAAccount> | null => {
      let p = 0;
      let secret = "", name = "", issuer = "";
      let algo = 1, digits = 6, otpType = 0;

      const rv = (): number => {
        let r = 0, s = 0;
        while (p < data.length) {
          const b = data[p++];
          r |= (b & 0x7f) << s;
          if ((b & 0x80) === 0) return r;
          s += 7;
        }
        return r;
      };

      while (p < data.length) {
        const tag = rv();
        const fieldNum = tag >> 3;
        const wireType = tag & 0x7;

        if (wireType === 2) {
          const len = rv();
          const fieldData = data.slice(p, p + len);
          p += len;
          if (fieldNum === 1) {
            const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
            let bits = 0, value = 0, b32 = "";
            for (const byte of fieldData) {
              value = (value << 8) | byte;
              bits += 8;
              while (bits >= 5) {
                b32 += alphabet[(value >>> (bits - 5)) & 31];
                bits -= 5;
              }
            }
            if (bits > 0) b32 += alphabet[(value << (5 - bits)) & 31];
            secret = b32;
          } else if (fieldNum === 2) name = new TextDecoder().decode(fieldData);
          else if (fieldNum === 3) issuer = new TextDecoder().decode(fieldData);
        } else if (wireType === 0) {
          const val = rv();
          if (fieldNum === 4) algo = val;
          else if (fieldNum === 5) digits = val === 2 ? 8 : 6;
          else if (fieldNum === 6) otpType = val;
        }
      }

      if (!secret || otpType === 1) return null;
      const algoMap: Record<number, string> = { 0: "SHA1", 1: "SHA1", 2: "SHA256", 3: "SHA512", 4: "MD5" };
      
      let parsedIssuer = issuer;
      let parsedLabel = name;
      if (!parsedIssuer && name.includes(":")) {
        const parts = name.split(":");
        parsedIssuer = parts[0].trim();
        parsedLabel = parts.slice(1).join(":").trim();
      }

      return {
        issuer: parsedIssuer || "Importado",
        label: parsedLabel || parsedIssuer || "Conta",
        secret,
        algorithm: algoMap[algo] || "SHA1",
        digits,
        period: 30,
      };
    };

    // Parse outer MigrationPayload
    let pos = 0;
    const readVarint = (): number => {
      let result = 0, shift = 0;
      while (pos < raw.length) {
        const byte = raw[pos++];
        result |= (byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) return result;
        shift += 7;
      }
      return result;
    };

    while (pos < raw.length) {
      const tag = readVarint();
      const fieldNum = tag >> 3;
      const wireType = tag & 0x7;
      if (wireType === 2) {
        const len = readVarint();
        const fieldData = raw.slice(pos, pos + len);
        pos += len;
        if (fieldNum === 1) {
          const parsed = parseOtpParams(fieldData);
          if (parsed) accounts.push(parsed);
        }
      } else if (wireType === 0) {
        readVarint();
      }
    }

    return accounts;
  } catch (err) {
    console.error("[MFA] Migration parse error:", err);
    return [];
  }
}

function TOTPCode({ account, onCopy }: { account: MFAAccount; onCopy?: (code: string) => void }) {
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
      <span
        className={`text-3xl font-mono font-bold tracking-wider select-none ${isLow ? "text-destructive" : "text-foreground"}`}
        style={{ filter: "blur(8px)", WebkitFilter: "blur(8px)" }}
      >
        {formattedCode}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onCopy?.(code);
        }}
        title="Copiar código"
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function MFAAgentesContent() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isMaster, logAction } = useMfaMaster();
  const [accounts, setAccounts] = useState<MFAAccount[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<"choose" | "scan" | "manual">("choose");
  const [manualForm, setManualForm] = useState({ issuer: "", secret: "", keyType: "totp" });
  const [scanning, setScanning] = useState(false);
  const html5QrRef = useRef<Html5Qrcode | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [searchLogs, setSearchLogs] = useState("");
  const [logActionFilter, setLogActionFilter] = useState("all");
  const [logPage, setLogPage] = useState(1);
  const LOGS_PER_PAGE = 20;
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Access assignment state
  const [accessList, setAccessList] = useState<any[]>([]);
  const [users, setUsers] = useState<{ id: string; nome_completo: string }[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loadingAccess, setLoadingAccess] = useState(false);

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

  // Load accounts from decrypted view (RLS filters by user_id = auth.uid())
  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const { data, error } = await supabase
        .from("mfa_accounts_decrypted" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAccounts((data as any[]) || []);
    } catch (err: any) {
      console.error("[MFA] Load error:", err);
      toast({ title: "Erro ao carregar contas MFA", description: err.message, variant: "destructive" });
    } finally {
      setLoadingAccounts(false);
    }
  }, [toast]);

  // Load audit logs
  const loadAuditLogs = useCallback(async () => {
    if (!isMaster) return;
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from("mfa_audit_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setAuditLogs(data || []);
    } catch (err: any) {
      console.error("[MFA] Logs error:", err);
    } finally {
      setLoadingLogs(false);
    }
  }, [isMaster]);

  // Load access list and users (only Administrador users for assignment)
  const loadAccessData = useCallback(async () => {
    if (!isMaster) return;
    setLoadingAccess(true);
    try {
      const [accessRes, usersRes] = await Promise.all([
        supabase.from("mfa_account_access" as any).select("*").order("granted_at", { ascending: false }),
        supabase.from("profiles").select("id, nome_completo, tipo_acesso").eq("status", "Ativo").in("tipo_acesso", ["Administrador", "Master"]).order("nome_completo"),
      ]);
      setAccessList(accessRes.data || []);
      setUsers((usersRes.data || []).map((u: any) => ({ id: u.id, nome_completo: u.nome_completo })));
    } catch (err: any) {
      console.error("[MFA] Access data error:", err);
    } finally {
      setLoadingAccess(false);
    }
  }, [isMaster]);

  // Grant access
  const handleGrantAccess = async () => {
    if (!selectedAccountId || !selectedUserId || !user) return;
    // Check if access already exists (active or revoked)
    const existing = accessList.find((a: any) => a.account_id === selectedAccountId && a.user_id === selectedUserId);
    try {
      if (existing && existing.active) {
        toast({ title: "Usuário já possui acesso a este authenticator", variant: "destructive" });
        return;
      }
      if (existing && !existing.active) {
        // Reactivate revoked access
        const { error } = await supabase.from("mfa_account_access" as any)
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
      loadAccessData();
    } catch (err: any) {
      toast({ title: "Erro ao conceder acesso", description: err.message, variant: "destructive" });
    }
  };

  // Revoke access
  const handleRevokeAccess = async (accessId: string, acc: any) => {
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
      loadAccessData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };


  const migrateLocalStorage = useCallback(async () => {
    if (!user) return;
    const STORAGE_KEY = "mfa_authenticator_accounts";
    const MIGRATED_KEY = "mfa_accounts_migrated_v3";
    if (localStorage.getItem(MIGRATED_KEY)) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) { localStorage.setItem(MIGRATED_KEY, "true"); return; }
      const localAccounts = JSON.parse(stored);
      if (!localAccounts.length) { localStorage.setItem(MIGRATED_KEY, "true"); return; }

      for (const acc of localAccounts) {
        // Insert with plaintext secret — trigger auto-encrypts
        await supabase
          .from("mfa_accounts" as any)
          .upsert({
            id: acc.id,
            issuer: acc.issuer,
            label: acc.label || acc.issuer,
            secret_encrypted: acc.secret, // trigger will encrypt
            algorithm: acc.algorithm || "SHA1",
            digits: acc.digits || 6,
            period: acc.period || 30,
            user_id: user.id,
            created_by: user.id,
          }, { onConflict: "id" });
      }

      localStorage.setItem(MIGRATED_KEY, "true");
      console.log(`[MFA] Migrated ${localAccounts.length} accounts from localStorage`);
    } catch (err) {
      console.error("[MFA] localStorage migration error:", err);
    }
  }, [user]);

  // Load access data on mount for Master users
  useEffect(() => {
    if (isMaster) loadAccessData();
  }, [isMaster, loadAccessData]);

  useEffect(() => {
    if (!user) return;
    const init = async () => {
      await migrateLocalStorage();
      await loadAccounts();
    };
    init();

    // Realtime subscription for cross-device sync
    const channel = supabase
      .channel(`mfa-sync-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mfa_accounts",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadAccounts();
        }
      )
      .subscribe();

    // Polling fallback with exponential backoff
    let pollInterval = 5000;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastSync = new Date().toISOString();

    const poll = async () => {
      try {
        const { data } = await supabase
          .from("mfa_accounts" as any)
          .select("id")
          .eq("user_id", user.id)
          .gt("updated_at", lastSync)
          .limit(1);

        if (data && data.length > 0) {
          lastSync = new Date().toISOString();
          pollInterval = 5000;
          await loadAccounts();
        } else {
          pollInterval = Math.min(pollInterval * 1.5, 30000);
        }
      } catch { /* ignore */ }
      timeoutId = setTimeout(poll, pollInterval);
    };
    timeoutId = setTimeout(poll, pollInterval);

    return () => {
      supabase.removeChannel(channel);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user, migrateLocalStorage, loadAccounts]);

  // Recovery codes
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

  const saveRecoveryCodes = useCallback(async (accountId: string, codes: string[]) => {
    if (!user) return;
    const cleanCodes = codes.map(c => c.trim()).filter(Boolean);
    try {
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

  const openRecoveryModal = (account: MFAAccount) => {
    setRecoveryAccount(account);
    setRecoveryAddMode("choose");
    setRecoveryInput("");
    setShowRecoveryModal(true);
    loadRecoveryCodes(account.id);
  };

  const handleAddRecoveryManual = () => {
    const newCodes = recoveryInput.split(/[\n,;]+/).map(c => c.trim()).filter(Boolean);
    if (newCodes.length === 0) { toast({ title: "Insira ao menos um código", variant: "destructive" }); return; }
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
      const newCodes = text.split(/[\n,;]+/).map(c => c.trim()).filter(Boolean);
      if (newCodes.length === 0) { toast({ title: "Nenhum código encontrado no arquivo", variant: "destructive" }); return; }
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
      // Request camera permission directly in click handler context
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      // Stop the stream immediately - html5-qrcode will request its own
      stream.getTracks().forEach(t => t.stop());

      // Now wait for DOM container to be ready
      await new Promise((r) => setTimeout(r, 150));
      const containerId = "mfa-qr-scanner";
      const container = document.getElementById(containerId);
      if (!container) return;
      const html5Qr = new Html5Qrcode(containerId);
      html5QrRef.current = html5Qr;
      await html5Qr.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (decodedText) handleQRResult(decodedText);
        },
        () => {}
      );
      setScanning(true);
    } catch (err: any) {
      console.error("[MFA] Camera error:", err);
      const msg = err.name === "NotAllowedError"
        ? "Permissão da câmera negada. Permita o acesso nas configurações do navegador."
        : "Câmera indisponível. Use a opção manual.";
      toast({ title: "Erro na câmera", description: msg, variant: "destructive" });
      setAddMode("manual");
    }
  }, [toast]);

  const saveAccount = useCallback(async (account: Omit<MFAAccount, 'created_at'>) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("mfa_accounts" as any)
        .insert({
          id: account.id,
          issuer: account.issuer,
          label: account.label,
          secret_encrypted: account.secret, // trigger auto-encrypts
          algorithm: account.algorithm,
          digits: account.digits,
          period: account.period,
          user_id: user.id,
          created_by: user.id,
        });
      if (error) throw error;
      await logAction("create", account.id, account.issuer);
      await loadAccounts();
    } catch (err: any) {
      toast({ title: "Erro ao salvar conta", description: err.message, variant: "destructive" });
    }
  }, [user, loadAccounts, toast, logAction]);

  const handleQRResult = async (decodedText: string) => {
    stopCamera();
    
    // 1. Try otpauth:// URI (standard single account)
    if (decodedText.startsWith("otpauth://")) {
      const parsed = parseOtpauthUri(decodedText);
      if (parsed?.secret) {
        await saveAccount({
          id: `mfa-${Date.now()}`,
          issuer: parsed.issuer || "Desconhecido",
          label: parsed.label || "",
          secret: parsed.secret,
          algorithm: parsed.algorithm || "SHA1",
          digits: parsed.digits || 6,
          period: parsed.period || 30,
        });
        setShowAddModal(false);
        setAddMode("choose");
        toast({ title: "Conta adicionada!", description: parsed.issuer });
        return;
      }
    }

    // 2. Try otpauth-migration:// (Google Authenticator export)
    if (decodedText.startsWith("otpauth-migration://")) {
      const migrated = parseOtpauthMigration(decodedText);
      if (migrated.length > 0) {
        let added = 0;
        for (const acc of migrated) {
          if (acc.secret) {
            await saveAccount({
              id: `mfa-${Date.now()}-${added}`,
              issuer: acc.issuer || "Importado",
              label: acc.label || "",
              secret: acc.secret,
              algorithm: acc.algorithm || "SHA1",
              digits: acc.digits || 6,
              period: acc.period || 30,
            });
            added++;
          }
        }
        setShowAddModal(false);
        setAddMode("choose");
        toast({ title: `${added} conta(s) importada(s)!`, description: "Transferência do Google Authenticator concluída" });
        return;
      }
    }

    toast({ title: "QR Code não reconhecido", description: "Use um QR Code de configuração MFA (otpauth://)", variant: "destructive" });
    // Re-enable scanning to try again
    setTimeout(() => startCamera(), 500);
  };

  const handleManualAdd = async () => {
    const secret = manualForm.secret.replace(/\s/g, "").toUpperCase();
    if (!secret) { toast({ title: "Chave obrigatória", variant: "destructive" }); return; }
    if (!manualForm.issuer.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    try { OTPAuth.Secret.fromBase32(secret); } catch {
      toast({ title: "Chave inválida", description: "Base32 inválido", variant: "destructive" }); return;
    }
    await saveAccount({
      id: `mfa-${Date.now()}`,
      issuer: manualForm.issuer.trim(),
      label: manualForm.issuer.trim(),
      secret,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    });
    setShowAddModal(false);
    setAddMode("choose");
    setManualForm({ issuer: "", secret: "", keyType: "totp" });
    toast({ title: "Conta adicionada!", description: manualForm.issuer.trim() });
  };

  const handleDelete = async (id: string) => {
    const account = accounts.find((a) => a.id === id);
    try {
      // Delete access assignments first
      await supabase.from("mfa_account_access" as any).delete().eq("account_id", id);
      // Delete recovery codes
      await supabase.from("mfa_recovery_codes" as any).delete().eq("account_id", id);
      // Delete account
      await supabase.from("mfa_accounts" as any).delete().eq("id", id);
      await logAction("delete", id, account?.issuer);
      await loadAccounts();
      toast({ title: "Conta removida", description: account?.issuer });
    } catch {
      toast({ title: "Erro ao remover conta", variant: "destructive" });
    }
    setExpandedId(null);
  };

  const handleCopy = (code: string, account?: MFAAccount) => {
    navigator.clipboard.writeText(code.replace(/\s/g, ""));
    if (account) logAction("copy", account.id, account.issuer);
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
      await loadAccounts();
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

  const getUserName = (userId: string) => users.find(u => u.id === userId)?.nome_completo || userId.slice(0, 8);

  const actionLabels: Record<string, string> = {
    create: "Criou", view: "Visualizou", copy: "Copiou", delete: "Removeu",
    grant_access: "Concedeu acesso", revoke_access: "Revogou acesso",
    toggle_feature_flag: "Alterou flag", rename: "Renomeou",
  };

  const actionColors: Record<string, string> = {
    create: "bg-emerald-500/10 text-emerald-600", view: "bg-blue-500/10 text-blue-600",
    copy: "bg-amber-500/10 text-amber-600", delete: "bg-red-500/10 text-red-600",
    grant_access: "bg-emerald-500/10 text-emerald-600", revoke_access: "bg-red-500/10 text-red-600",
    rename: "bg-indigo-500/10 text-indigo-600",
  };

  const filteredLogs = auditLogs.filter(l => {
    const matchesSearch = !searchLogs ||
      l.user_email?.toLowerCase().includes(searchLogs.toLowerCase()) ||
      l.user_name?.toLowerCase().includes(searchLogs.toLowerCase()) ||
      l.action?.toLowerCase().includes(searchLogs.toLowerCase()) ||
      l.account_issuer?.toLowerCase().includes(searchLogs.toLowerCase());
    const matchesAction = logActionFilter === "all" || l.action === logActionFilter;
    return matchesSearch && matchesAction;
  });

  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PER_PAGE));
  const paginatedLogs = filteredLogs.slice((logPage - 1) * LOGS_PER_PAGE, logPage * LOGS_PER_PAGE);

  // Unique actions for filter
  const uniqueLogActions = Array.from(new Set(auditLogs.map(l => l.action))).filter(Boolean);

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
        {isMaster && (
          <Button onClick={() => setShowAddModal(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Adicionar MFA
          </Button>
        )}
      </div>

      <Tabs defaultValue="authenticators" className="w-full" onValueChange={(v) => {
        if (v === "logs" && auditLogs.length === 0) loadAuditLogs();
        if (v === "access" && users.length === 0) loadAccessData();
      }}>
        <TabsList className={`grid w-full ${isMaster ? "grid-cols-3" : "grid-cols-1"} max-w-lg`}>
          <TabsTrigger value="authenticators" className="gap-1.5">
            <KeyRound className="h-4 w-4" /> Códigos
          </TabsTrigger>
          {isMaster && (
            <>
              <TabsTrigger value="access" className="gap-1.5">
                <Users className="h-4 w-4" /> Acessos
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-1.5">
                <ScrollText className="h-4 w-4" /> Logs
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* AUTHENTICATORS TAB */}
        <TabsContent value="authenticators" className="space-y-3 mt-4">
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
                  {isMaster
                    ? "Adicione contas MFA escaneando QR Codes ou inserindo chaves manualmente."
                    : "Nenhuma conta MFA foi atribuída a você. Solicite ao Master."}
                </p>
                {isMaster && (
                  <Button onClick={() => setShowAddModal(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> Adicionar primeira conta
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => {
                const accountAccessUsers = accessList.filter((a: any) => a.account_id === account.id && a.active);
                return (
                  <Card key={account.id} className="border-muted hover:border-primary/30 transition-colors">
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
                          <TOTPCode account={account} onCopy={(code) => handleCopy(code, account)} />
                          {isMaster && accountAccessUsers.length > 0 && (
                            <div className="flex items-center gap-1 mt-2 flex-wrap">
                              <span className="text-xs text-muted-foreground mr-1">Acesso:</span>
                              {accountAccessUsers.map((au: any) => (
                                <Badge key={au.id} variant="outline" className="text-xs">
                                  {getUserName(au.user_id)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isMaster && (
                            <Button variant="ghost" size="icon" className="h-8 w-8"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === account.id ? null : account.id); }}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {isMaster && expandedId === account.id && (
                        <div className="mt-3 pt-3 border-t border-muted flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                            onClick={() => { setEditingAccount(account); setEditName(account.issuer); }}>
                            <Pencil className="h-3 w-3" /> Renomear
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
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ACCESS TAB */}
        {isMaster && (
          <TabsContent value="access" className="mt-4">
            <MFAAccessManager accounts={accounts} onAccessChanged={() => { loadAccounts(); loadAccessData(); }} />
          </TabsContent>
        )}

        {/* LOGS TAB */}
        {isMaster && (
          <TabsContent value="logs" className="space-y-4 mt-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 max-w-md min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar nos logs..." value={searchLogs} onChange={e => { setSearchLogs(e.target.value); setLogPage(1); }} className="pl-9" />
              </div>
              <Select value={logActionFilter} onValueChange={(v) => { setLogActionFilter(v); setLogPage(1); }}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar ação" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  {uniqueLogActions.map(a => (
                    <SelectItem key={a} value={a}>{actionLabels[a] || a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="secondary">{filteredLogs.length} registros</Badge>
            </div>

            {loadingLogs ? (
              <div className="text-center py-8 text-muted-foreground">Carregando logs...</div>
            ) : filteredLogs.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="py-12 text-center">
                  <ScrollText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">Nenhum log encontrado</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-2">
                  {paginatedLogs.map((log: any) => (
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
                {/* Pagination */}
                {totalLogPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Button variant="outline" size="sm" disabled={logPage <= 1} onClick={() => setLogPage(p => p - 1)}>Anterior</Button>
                    <span className="text-sm text-muted-foreground">Página {logPage} de {totalLogPages}</span>
                    <Button variant="outline" size="sm" disabled={logPage >= totalLogPages} onClick={() => setLogPage(p => p + 1)}>Próxima</Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Old assign modal removed - now handled by MFAAccessManager */}
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
                  onClick={async () => { setAddMode("scan"); await startCamera(); }}>
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
              Gerencie os códigos de recuperação desta conta.
            </DialogDescription>
          </DialogHeader>

          {recoveryAddMode === "choose" && (
            <div className="space-y-4">
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
