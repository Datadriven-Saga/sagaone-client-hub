import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Eye,
  EyeOff,
  Camera,
  KeyRound,
  Clock,
  MoreVertical,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as OTPAuth from "otpauth";
import { Html5Qrcode } from "html5-qrcode";

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

const STORAGE_KEY = "mfa_authenticator_accounts";

function loadAccounts(): MFAAccount[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts: MFAAccount[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
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
  const formattedCode = code.length === 6
    ? `${code.slice(0, 3)} ${code.slice(3)}`
    : code;

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-10 w-10 flex items-center justify-center">
        <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
          <circle
            cx="18" cy="18" r="15.5"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="2"
          />
          <circle
            cx="18" cy="18" r="15.5"
            fill="none"
            stroke={isLow ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
            strokeWidth="2"
            strokeDasharray={`${progress} 100`}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <span className={`absolute text-xs font-mono font-bold ${isLow ? "text-destructive" : "text-foreground"}`}>
          {timeLeft}
        </span>
      </div>
      <span className={`text-3xl font-mono font-bold tracking-wider ${isLow ? "text-destructive" : "text-foreground"}`}>
        {formattedCode}
      </span>
    </div>
  );
}

export function MFAAgentesContent() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<MFAAccount[]>(loadAccounts);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<"choose" | "scan" | "manual">("choose");
  const [manualForm, setManualForm] = useState({ issuer: "", secret: "", keyType: "totp" });
  const [scanning, setScanning] = useState(false);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<Html5Qrcode | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Persist accounts
  useEffect(() => {
    saveAccounts(accounts);
  }, [accounts]);

  const stopCamera = useCallback(async () => {
    if (html5QrRef.current) {
      try {
        const state = html5QrRef.current.getState();
        if (state === 2) { // SCANNING
          await html5QrRef.current.stop();
        }
      } catch {
        // ignore
      }
      html5QrRef.current.clear();
      html5QrRef.current = null;
    }
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      // Small delay to ensure DOM is ready
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
          if (decodedText && decodedText.startsWith("otpauth://")) {
            handleQRResult(decodedText);
          }
        },
        () => {
          // ignore scan failures
        }
      );
      setScanning(true);
    } catch (err) {
      toast({
        title: "Câmera indisponível",
        description: "Não foi possível acessar a câmera. Use a opção manual.",
        variant: "destructive",
      });
      setAddMode("manual");
    }
  }, [toast]);

  const handleQRResult = (uri: string) => {
    stopCamera();
    const parsed = parseOtpauthUri(uri);
    if (!parsed || !parsed.secret) {
      toast({ title: "QR Code inválido", description: "O código não contém dados TOTP válidos", variant: "destructive" });
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

    setAccounts((prev) => [...prev, newAccount]);
    setShowAddModal(false);
    setAddMode("choose");
    toast({ title: "Conta adicionada!", description: `${newAccount.issuer} - ${newAccount.label}` });
  };

  const handleManualAdd = () => {
    const secret = manualForm.secret.replace(/\s/g, "").toUpperCase();
    if (!secret) {
      toast({ title: "Chave obrigatória", description: "Insira a chave secreta (setup key)", variant: "destructive" });
      return;
    }
    if (!manualForm.issuer.trim()) {
      toast({ title: "Nome obrigatório", description: "Insira o nome da conta", variant: "destructive" });
      return;
    }

    // Validate base32
    try {
      OTPAuth.Secret.fromBase32(secret);
    } catch {
      toast({ title: "Chave inválida", description: "A chave não é um Base32 válido", variant: "destructive" });
      return;
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

    setAccounts((prev) => [...prev, newAccount]);
    setShowAddModal(false);
    setAddMode("choose");
    setManualForm({ issuer: "", secret: "", keyType: "totp" });
    toast({ title: "Conta adicionada!", description: `${newAccount.issuer}` });
  };

  const handleDelete = (id: string) => {
    const account = accounts.find((a) => a.id === id);
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    toast({ title: "Conta removida", description: `${account?.issuer} removido` });
    setExpandedId(null);
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code.replace(/\s/g, ""));
    toast({ title: "Código copiado!" });
  };

  const closeModal = () => {
    stopCamera();
    setShowAddModal(false);
    setAddMode("choose");
    setManualForm({ issuer: "", secret: "", keyType: "totp" });
  };

  const getInitials = (issuer: string) => {
    return issuer.slice(0, 2).toUpperCase();
  };

  const getColorForIssuer = (issuer: string): string => {
    const colors = [
      "bg-blue-600", "bg-emerald-600", "bg-violet-600", "bg-amber-600",
      "bg-rose-600", "bg-cyan-600", "bg-indigo-600", "bg-pink-600",
    ];
    let hash = 0;
    for (let i = 0; i < issuer.length; i++) {
      hash = issuer.charCodeAt(i) + ((hash << 5) - hash);
    }
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
          <Plus className="h-4 w-4" />
          Adicionar MFA
        </Button>
      </div>

      {/* Accounts List */}
      {accounts.length === 0 ? (
        <Card className="border-dashed border-2 border-muted">
          <CardContent className="py-16 text-center">
            <ShieldCheck className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Nenhuma conta MFA</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Adicione contas MFA escaneando QR Codes ou inserindo chaves manualmente de serviços como GitHub, Google, n8n, etc.
            </p>
            <Button onClick={() => setShowAddModal(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar primeira conta
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
                  {/* Avatar */}
                  <div className={`h-12 w-12 rounded-full ${getColorForIssuer(account.issuer)} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white font-bold text-sm">{getInitials(account.issuer)}</span>
                  </div>

                  {/* Info + Code */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground truncate">{account.issuer}</span>
                      {account.label && account.label !== account.issuer && (
                        <span className="text-xs text-muted-foreground truncate">({account.label})</span>
                      )}
                    </div>
                    <TOTPCode account={account} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(expandedId === account.id ? null : account.id);
                      }}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Expanded actions */}
                {expandedId === account.id && (
                  <div className="mt-3 pt-3 border-t border-muted flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(account.secret);
                        toast({ title: "Chave copiada!" });
                      }}
                    >
                      <Copy className="h-3 w-3" />
                      Copiar chave
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs text-destructive hover:text-destructive"
                      onClick={() => handleDelete(account.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                      Remover
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
                <DialogDescription>
                  Escolha como deseja adicionar a conta de autenticação
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-3 py-4">
                <Button
                  variant="outline"
                  className="h-auto py-6 flex flex-col items-center gap-3"
                  onClick={() => {
                    setAddMode("scan");
                    setTimeout(() => startCamera(), 100);
                  }}
                >
                  <Camera className="h-8 w-8 text-primary" />
                  <div className="text-center">
                    <p className="font-semibold">Escanear QR Code</p>
                    <p className="text-xs text-muted-foreground">Use a câmera para ler o QR Code</p>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-6 flex flex-col items-center gap-3"
                  onClick={() => setAddMode("manual")}
                >
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
                <Button variant="outline" onClick={() => { stopCamera(); setAddMode("choose"); }} className="flex-1">
                  Voltar
                </Button>
                <Button variant="outline" onClick={() => { stopCamera(); setAddMode("manual"); }} className="flex-1">
                  Inserir manualmente
                </Button>
              </DialogFooter>
            </>
          )}

          {addMode === "manual" && (
            <>
              <DialogHeader>
                <DialogTitle>Inserir dados da conta</DialogTitle>
                <DialogDescription>
                  Insira as informações fornecidas pelo serviço
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Nome da conta *</Label>
                  <Input
                    value={manualForm.issuer}
                    onChange={(e) => setManualForm({ ...manualForm, issuer: e.target.value })}
                    placeholder="Ex: GitHub, Google, n8n"
                  />
                </div>
                <div>
                  <Label>Chave secreta (Setup Key) *</Label>
                  <Input
                    value={manualForm.secret}
                    onChange={(e) => setManualForm({ ...manualForm, secret: e.target.value })}
                    placeholder="Ex: JBSWY3DPEHPK3PXP"
                    className="font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Chave Base32 fornecida pelo serviço</p>
                </div>
                <div>
                  <Label>Tipo de chave</Label>
                  <Select value={manualForm.keyType} onValueChange={(v) => setManualForm({ ...manualForm, keyType: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="totp">Time based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setAddMode("choose")}>
                  Voltar
                </Button>
                <Button onClick={handleManualAdd} className="flex-1">
                  Adicionar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
