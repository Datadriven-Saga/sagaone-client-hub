import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  Search,
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  Key,
  Smartphone,
  Clock,
  QrCode,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MFAConfig {
  id: string;
  agente_nome: string;
  tipo_agente: string;
  marca: string;
  loja: string;
  mfa_habilitado: boolean;
  mfa_secret: string;
  mfa_uri: string;
  mfa_backup_codes: string[];
  ultimo_verificado_em: string | null;
  created_at: string;
}

// Simulated TOTP code generator (rotates every 30s based on secret)
function generateTOTP(secret: string): string {
  const epoch = Math.floor(Date.now() / 30000);
  let hash = 0;
  const combined = secret + epoch.toString();
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash % 1000000).toString().padStart(6, "0");
}

function getTimeRemaining(): number {
  return 30 - (Math.floor(Date.now() / 1000) % 30);
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
    mfa_backup_codes: ["123456", "789012", "345678", "901234"],
    ultimo_verificado_em: new Date().toISOString(),
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
    mfa_backup_codes: ["112233", "445566", "778899", "001122"],
    ultimo_verificado_em: new Date(Date.now() - 3600000).toISOString(),
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
    mfa_backup_codes: ["998877", "665544", "332211", "009988"],
    ultimo_verificado_em: null,
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
    mfa_backup_codes: ["554433", "221100", "887766", "443322"],
    ultimo_verificado_em: new Date(Date.now() - 7200000).toISOString(),
    created_at: new Date().toISOString(),
  },
];

export function MFAAgentesContent() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<MFAConfig[]>(INITIAL_MFA_DATA);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAgente, setFilterAgente] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMarca, setFilterMarca] = useState<string>("all");
  const [totpCodes, setTotpCodes] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining());
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [showBackupCodes, setShowBackupCodes] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MFAConfig>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newConfig, setNewConfig] = useState({
    agente_nome: "",
    tipo_agente: "WhatsApp",
    marca: "",
    loja: "",
    mfa_secret: "",
    mfa_uri: "",
  });

  // Generate TOTP codes and countdown
  useEffect(() => {
    const updateCodes = () => {
      const codes: Record<string, string> = {};
      configs.forEach((c) => {
        if (c.mfa_habilitado && c.mfa_secret) {
          codes[c.id] = generateTOTP(c.mfa_secret);
        }
      });
      setTotpCodes(codes);
      setTimeRemaining(getTimeRemaining());
    };

    updateCodes();
    const interval = setInterval(updateCodes, 1000);
    return () => clearInterval(interval);
  }, [configs]);

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

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: `${label} copiado para a área de transferência` });
  };

  const toggleMFA = (id: string) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, mfa_habilitado: !c.mfa_habilitado, ultimo_verificado_em: new Date().toISOString() }
          : c
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
        mfa_habilitado: true,
        mfa_secret: newConfig.mfa_secret,
        mfa_uri: uri,
        mfa_backup_codes: [],
        ultimo_verificado_em: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    ]);

    setShowAddModal(false);
    setNewConfig({ agente_nome: "", tipo_agente: "WhatsApp", marca: "", loja: "", mfa_secret: "", mfa_uri: "" });
    toast({ title: "MFA adicionado", description: `Configuração MFA criada para ${newConfig.agente_nome}` });
  };

  const startEdit = (config: MFAConfig) => {
    setEditingId(config.id);
    setEditForm({ mfa_secret: config.mfa_secret, mfa_uri: config.mfa_uri });
  };

  const saveEdit = (id: string) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, ...editForm, ultimo_verificado_em: new Date().toISOString() } : c
      )
    );
    setEditingId(null);
    setEditForm({});
    toast({ title: "Atualizado", description: "Configuração MFA atualizada com sucesso" });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Nunca";
    return new Date(dateStr).toLocaleString("pt-BR");
  };

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
                <p className="text-sm text-muted-foreground">Próximo Código</p>
                <p className="text-2xl font-bold text-foreground">{timeRemaining}s</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="mt-2 w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-1000"
                style={{ width: `${(timeRemaining / 30) * 100}%` }}
              />
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
                  <div className={`p-2 rounded-lg ${config.mfa_habilitado ? "bg-primary/10" : "bg-muted"}`}>
                    {config.mfa_habilitado ? (
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
              {/* TOTP Code Display */}
              {config.mfa_habilitado && totpCodes[config.id] && (
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                    <Smartphone className="h-3 w-3" />
                    Código Authenticator (TOTP)
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-3xl font-mono font-bold tracking-[0.3em] text-foreground">
                      {totpCodes[config.id]?.slice(0, 3)} {totpCodes[config.id]?.slice(3)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleCopy(totpCodes[config.id], "Código TOTP")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <div className="w-24 bg-muted rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all duration-1000"
                        style={{ width: `${(timeRemaining / 30) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{timeRemaining}s</span>
                  </div>
                </div>
              )}

              {/* Secret Key */}
              <div>
                <Label className="text-xs text-muted-foreground">Chave Secreta (Secret)</Label>
                {editingId === config.id ? (
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={editForm.mfa_secret || ""}
                      onChange={(e) => setEditForm({ ...editForm, mfa_secret: e.target.value })}
                      className="font-mono text-sm"
                    />
                    <Button size="icon" variant="ghost" onClick={() => saveEdit(config.id)}>
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
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
                    <Button size="icon" variant="ghost" onClick={() => startEdit(config)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* URI */}
              <div>
                <Label className="text-xs text-muted-foreground">URI (otpauth://)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md font-mono truncate text-muted-foreground">
                    {config.mfa_uri}
                  </code>
                  <Button size="icon" variant="ghost" onClick={() => handleCopy(config.mfa_uri, "URI")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Backup Codes */}
              {config.mfa_backup_codes.length > 0 && (
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Códigos de Backup</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setShowBackupCodes((prev) => ({ ...prev, [config.id]: !prev[config.id] }))}
                    >
                      {showBackupCodes[config.id] ? "Ocultar" : "Mostrar"}
                    </Button>
                  </div>
                  {showBackupCodes[config.id] && (
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      {config.mfa_backup_codes.map((code, i) => (
                        <code key={i} className="text-xs bg-muted px-2 py-1 rounded font-mono text-center">
                          {code}
                        </code>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-muted">
                <span className="text-xs text-muted-foreground">
                  Verificado: {formatDate(config.ultimo_verificado_em)}
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

      {/* Explicação Authenticator */}
      <Card className="border-muted bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Como funciona o Authenticator (TOTP)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            O <strong className="text-foreground">TOTP (Time-based One-Time Password)</strong> gera códigos de 6 dígitos que mudam a cada 30 segundos.
            É o mesmo mecanismo usado pelo Google Authenticator, Microsoft Authenticator e Authy.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-background rounded-lg p-4 border border-muted">
              <div className="flex items-center gap-2 mb-2">
                <Key className="h-4 w-4 text-primary" />
                <strong className="text-foreground text-sm">1. Secret Key</strong>
              </div>
              <p className="text-xs">
                Chave secreta compartilhada entre o servidor e o app authenticator. Nunca expor publicamente.
              </p>
            </div>
            <div className="bg-background rounded-lg p-4 border border-muted">
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="h-4 w-4 text-primary" />
                <strong className="text-foreground text-sm">2. QR Code / URI</strong>
              </div>
              <p className="text-xs">
                A URI <code>otpauth://</code> pode ser escaneada pelo app authenticator para configuração automática.
              </p>
            </div>
            <div className="bg-background rounded-lg p-4 border border-muted">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-primary" />
                <strong className="text-foreground text-sm">3. Código Rotativo</strong>
              </div>
              <p className="text-xs">
                O código muda a cada 30 segundos. Use-o para autenticar nas plataformas dos agentes (Meta, Evolution, etc).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
