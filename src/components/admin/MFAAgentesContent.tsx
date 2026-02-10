import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  ShieldOff,
  Copy,
  Eye,
  EyeOff,
  Search,
  Plus,
  Trash2,
  Key,
  Smartphone,
  QrCode,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";

interface MFAConfig {
  id: string;
  agente_nome: string;
  tipo_agente: string;
  marca: string;
  loja: string;
  mfa_habilitado: boolean;
  mfa_secret: string;
  mfa_uri: string;
  verificado: boolean;
  created_at: string;
}

// Initial demo data
const INITIAL_MFA_DATA: MFAConfig[] = [
  {
    id: "mfa-maia-01",
    agente_nome: "Maia",
    tipo_agente: "WhatsApp",
    marca: "Jeep",
    loja: "Saga Jeep Brasília",
    mfa_habilitado: true,
    mfa_secret: "JBSWY3DPEHPK3PXP",
    mfa_uri: "otpauth://totp/SagaOne:maia-jeep-bsb?secret=JBSWY3DPEHPK3PXP&issuer=SagaOne",
    verificado: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "mfa-pri-01",
    agente_nome: "Pri",
    tipo_agente: "Ligação",
    marca: "Fiat",
    loja: "Saga Fiat Goiânia",
    mfa_habilitado: true,
    mfa_secret: "KRSXG5CTMVRXEZLUKN",
    mfa_uri: "otpauth://totp/SagaOne:pri-fiat-gyn?secret=KRSXG5CTMVRXEZLUKN&issuer=SagaOne",
    verificado: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "mfa-maia-02",
    agente_nome: "Maia",
    tipo_agente: "WhatsApp",
    marca: "Volkswagen",
    loja: "Saga VW Cuiabá",
    mfa_habilitado: false,
    mfa_secret: "GEZDGNBVGY3TQOJQ",
    mfa_uri: "otpauth://totp/SagaOne:maia-vw-cba?secret=GEZDGNBVGY3TQOJQ&issuer=SagaOne",
    verificado: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "mfa-pri-02",
    agente_nome: "Pri",
    tipo_agente: "Ligação",
    marca: "Jeep",
    loja: "Saga Jeep Porto Velho",
    mfa_habilitado: true,
    mfa_secret: "MFXHK3TJNZ2A",
    mfa_uri: "otpauth://totp/SagaOne:pri-jeep-pvh?secret=MFXHK3TJNZ2A&issuer=SagaOne",
    verificado: true,
    created_at: new Date().toISOString(),
  },
];

function QRCodeImage({ uri }: { uri: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && uri) {
      QRCode.toCanvas(canvasRef.current, uri, {
        width: 180,
        margin: 2,
        color: { dark: "#1a1a2e", light: "#ffffff" },
      }).catch(console.error);
    }
  }, [uri]);

  return <canvas ref={canvasRef} className="mx-auto rounded-lg border border-muted" />;
}

export function MFAAgentesContent() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<MFAConfig[]>(INITIAL_MFA_DATA);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAgente, setFilterAgente] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMarca, setFilterMarca] = useState<string>("all");
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [verificationCodes, setVerificationCodes] = useState<Record<string, string>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState<string | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [newConfig, setNewConfig] = useState({
    agente_nome: "",
    tipo_agente: "WhatsApp",
    marca: "",
    loja: "",
    mfa_secret: "",
    mfa_uri: "",
  });

  // Filter configs
  const filteredConfigs = configs.filter((c) => {
    if (searchTerm && !c.agente_nome.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !c.loja.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !c.marca.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterAgente !== "all" && c.agente_nome !== filterAgente) return false;
    if (filterStatus !== "all") {
      if (filterStatus === "ativo" && !c.mfa_habilitado) return false;
      if (filterStatus === "inativo" && c.mfa_habilitado) return false;
    }
    if (filterMarca !== "all" && c.marca !== filterMarca) return false;
    return true;
  });

  const uniqueAgentes = [...new Set(configs.map((c) => c.agente_nome))].sort();
  const uniqueMarcas = [...new Set(configs.map((c) => c.marca))].sort();

  const totalAtivos = configs.filter((c) => c.mfa_habilitado).length;
  const totalInativos = configs.filter((c) => !c.mfa_habilitado).length;
  const totalVerificados = configs.filter((c) => c.verificado).length;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: `${label} copiado para a área de transferência` });
  };

  const toggleMFA = (id: string) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, mfa_habilitado: !c.mfa_habilitado } : c
      )
    );
    const config = configs.find((c) => c.id === id);
    toast({
      title: config?.mfa_habilitado ? "MFA Desativado" : "MFA Ativado",
      description: `MFA ${config?.mfa_habilitado ? "desativado" : "ativado"} para ${config?.agente_nome} - ${config?.loja}`,
    });
  };

  const handleDelete = (id: string) => {
    const config = configs.find((c) => c.id === id);
    setConfigs((prev) => prev.filter((c) => c.id !== id));
    toast({
      title: "Configuração removida",
      description: `MFA removido para ${config?.agente_nome} - ${config?.loja}`,
    });
  };

  const handleVerifyCode = (id: string) => {
    const code = verificationCodes[id] || "";
    if (code.length !== 6) {
      toast({ title: "Código inválido", description: "O código deve ter 6 dígitos", variant: "destructive" });
      return;
    }
    // In a real implementation, validate TOTP server-side
    setConfigs((prev) =>
      prev.map((c) => c.id === id ? { ...c, verificado: true, mfa_habilitado: true } : c)
    );
    setVerificationCodes((prev) => ({ ...prev, [id]: "" }));
    toast({ title: "MFA Verificado!", description: "Autenticação configurada com sucesso" });
  };

  const handleAddConfig = () => {
    if (!newConfig.agente_nome || !newConfig.marca || !newConfig.loja || !newConfig.mfa_secret) {
      toast({ title: "Campos obrigatórios", description: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    const id = `mfa-${Date.now()}`;
    const uri = newConfig.mfa_uri || `otpauth://totp/SagaOne:${newConfig.agente_nome.toLowerCase()}-${newConfig.marca.toLowerCase()}?secret=${newConfig.mfa_secret}&issuer=SagaOne`;

    setConfigs((prev) => [
      ...prev,
      {
        id,
        agente_nome: newConfig.agente_nome,
        tipo_agente: newConfig.tipo_agente,
        marca: newConfig.marca,
        loja: newConfig.loja,
        mfa_habilitado: false,
        mfa_secret: newConfig.mfa_secret,
        mfa_uri: uri,
        verificado: false,
        created_at: new Date().toISOString(),
      },
    ]);

    setShowAddModal(false);
    setNewConfig({ agente_nome: "", tipo_agente: "WhatsApp", marca: "", loja: "", mfa_secret: "", mfa_uri: "" });
    toast({ title: "MFA adicionado", description: "Agora escaneie o QR Code ou insira o código para ativar" });
  };

  const handleSetupSubmit = () => {
    if (setupCode.length !== 6) {
      toast({ title: "Código inválido", description: "Insira o código de 6 dígitos do app authenticator", variant: "destructive" });
      return;
    }
    if (showSetupModal) {
      setConfigs((prev) =>
        prev.map((c) => c.id === showSetupModal ? { ...c, verificado: true, mfa_habilitado: true } : c)
      );
      toast({ title: "MFA Configurado!", description: "Autenticação de dois fatores ativada com sucesso" });
    }
    setShowSetupModal(null);
    setSetupCode("");
  };

  const setupConfig = showSetupModal ? configs.find((c) => c.id === showSetupModal) : null;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-muted">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Agentes</p>
                <p className="text-2xl font-bold text-foreground">{configs.length}</p>
              </div>
              <Key className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-muted">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">MFA Ativo</p>
                <p className="text-2xl font-bold text-primary">{totalAtivos}</p>
              </div>
              <ShieldCheck className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-muted">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">MFA Inativo</p>
                <p className="text-2xl font-bold text-destructive">{totalInativos}</p>
              </div>
              <ShieldOff className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-muted">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Verificados</p>
                <p className="text-2xl font-bold text-primary">{totalVerificados}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card className="border-muted">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por agente, loja ou marca..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-40">
              <Label className="text-xs text-muted-foreground">Agente</Label>
              <Select value={filterAgente} onValueChange={setFilterAgente}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueAgentes.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Label className="text-xs text-muted-foreground">Marca</Label>
              <Select value={filterMarca} onValueChange={setFilterMarca}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {uniqueMarcas.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setShowAddModal(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo MFA
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* MFA Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredConfigs.map((config) => (
          <Card key={config.id} className={`border-muted ${!config.mfa_habilitado ? "opacity-60" : ""}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config.verificado ? "bg-primary/10" : "bg-muted"}`}>
                    {config.verificado ? (
                      <ShieldCheck className="h-5 w-5 text-primary" />
                    ) : (
                      <ShieldOff className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base">{config.agente_nome}</CardTitle>
                    <CardDescription className="text-xs">
                      {config.marca} • {config.loja}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={config.tipo_agente === "WhatsApp" ? "default" : "secondary"} className="text-xs">
                    {config.tipo_agente}
                  </Badge>
                  <Switch
                    checked={config.mfa_habilitado}
                    onCheckedChange={() => toggleMFA(config.id)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status & Setup */}
              <div className="bg-muted/50 rounded-lg p-4">
                {config.verificado ? (
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Authenticator configurado</p>
                      <p className="text-xs text-muted-foreground">
                        MFA ativo e verificado. O código é gerado pelo app authenticator.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowSetupModal(config.id);
                        setSetupCode("");
                      }}
                    >
                      <QrCode className="h-4 w-4 mr-1" />
                      Ver QR
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Configuração pendente</p>
                      <p className="text-xs text-muted-foreground">
                        Escaneie o QR code ou insira o código para ativar o MFA.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setShowSetupModal(config.id);
                        setSetupCode("");
                      }}
                    >
                      <QrCode className="h-4 w-4 mr-1" />
                      Configurar
                    </Button>
                  </div>
                )}
              </div>

              {/* Inline verification for pending configs */}
              {!config.verificado && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Código do app authenticator</Label>
                  <div className="flex gap-2">
                    <Input
                      value={verificationCodes[config.id] || ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setVerificationCodes((prev) => ({ ...prev, [config.id]: val }));
                      }}
                      placeholder="e.g. 123456"
                      className="font-mono text-center tracking-widest"
                      maxLength={6}
                    />
                    <Button
                      onClick={() => handleVerifyCode(config.id)}
                      disabled={!verificationCodes[config.id] || verificationCodes[config.id]?.length !== 6}
                    >
                      Verificar
                    </Button>
                  </div>
                </div>
              )}

              {/* Secret Key (collapsed) */}
              <div>
                <Label className="text-xs text-muted-foreground">Chave Secreta (Secret)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md font-mono truncate">
                    {showSecrets[config.id] ? config.mfa_secret : "••••••••••••••••"}
                  </code>
                  <Button size="icon" variant="ghost" onClick={() => setShowSecrets((prev) => ({ ...prev, [config.id]: !prev[config.id] }))}>
                    {showSecrets[config.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleCopy(config.mfa_secret, "Secret")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-muted">
                <span className="text-xs text-muted-foreground">
                  Status: {config.verificado ? "Verificado ✓" : "Pendente"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive h-7 text-xs"
                  onClick={() => handleDelete(config.id)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Remover
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredConfigs.length === 0 && (
        <Card className="border-muted">
          <CardContent className="py-12 text-center">
            <ShieldOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma configuração MFA encontrada</p>
            <p className="text-sm text-muted-foreground mt-1">
              Use o botão "Novo MFA" para adicionar uma configuração
            </p>
          </CardContent>
        </Card>
      )}

      {/* Setup Authenticator Modal - like reference image */}
      <Dialog open={!!showSetupModal} onOpenChange={(open) => { if (!open) { setShowSetupModal(null); setSetupCode(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Setup Authenticator app {setupConfig?.verificado ? "" : "[1/2]"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            {/* Step 1: QR Code */}
            <div className="space-y-2">
              <p className="font-semibold text-foreground">1. Scan the QR code</p>
              <p className="text-sm text-muted-foreground">
                Use an authenticator app from your phone to scan. If you can't scan the QR code, enter{" "}
                <button
                  className="text-primary hover:underline font-medium"
                  onClick={() => {
                    if (setupConfig) {
                      setShowSecrets((prev) => ({ ...prev, [setupConfig.id]: true }));
                      handleCopy(setupConfig.mfa_secret, "Secret key");
                    }
                  }}
                >
                  this text code
                </button>
              </p>
              {setupConfig && (
                <div className="flex justify-center py-4">
                  <QRCodeImage uri={setupConfig.mfa_uri} />
                </div>
              )}
            </div>

            {/* Step 2: Enter Code */}
            {!setupConfig?.verificado && (
              <div className="space-y-3">
                <p className="font-semibold text-foreground">2. Enter the code from the app</p>
                <p className="text-sm text-muted-foreground">Code from your authenticator app</p>
                <Input
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="e.g. 123456"
                  className="font-mono text-center text-lg tracking-[0.3em]"
                  maxLength={6}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            {setupConfig?.verificado ? (
              <Button variant="outline" onClick={() => { setShowSetupModal(null); setSetupCode(""); }}>
                Fechar
              </Button>
            ) : (
              <Button
                onClick={handleSetupSubmit}
                disabled={setupCode.length !== 6}
                className="w-full"
              >
                Continue
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add MFA Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Configuração MFA</DialogTitle>
            <DialogDescription>
              Configure a autenticação de dois fatores para um agente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Agente *</Label>
              <Select value={newConfig.agente_nome} onValueChange={(v) => setNewConfig({ ...newConfig, agente_nome: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Maia">Maia</SelectItem>
                  <SelectItem value="Pri">Pri</SelectItem>
                  <SelectItem value="Gaia">Gaia</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo do Agente</Label>
              <Select value={newConfig.tipo_agente} onValueChange={(v) => setNewConfig({ ...newConfig, tipo_agente: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="Ligação">Ligação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Marca *</Label>
              <Input
                value={newConfig.marca}
                onChange={(e) => setNewConfig({ ...newConfig, marca: e.target.value })}
                placeholder="Ex: Jeep, Fiat, VW"
              />
            </div>
            <div>
              <Label>Loja *</Label>
              <Input
                value={newConfig.loja}
                onChange={(e) => setNewConfig({ ...newConfig, loja: e.target.value })}
                placeholder="Ex: Saga Jeep Brasília"
              />
            </div>
            <div>
              <Label>Chave Secreta (Secret) *</Label>
              <Input
                value={newConfig.mfa_secret}
                onChange={(e) => setNewConfig({ ...newConfig, mfa_secret: e.target.value })}
                placeholder="Ex: JBSWY3DPEHPK3PXP"
                className="font-mono"
              />
            </div>
            <div>
              <Label>URI (opcional)</Label>
              <Input
                value={newConfig.mfa_uri}
                onChange={(e) => setNewConfig({ ...newConfig, mfa_uri: e.target.value })}
                placeholder="otpauth://totp/..."
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancelar</Button>
            <Button onClick={handleAddConfig}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
