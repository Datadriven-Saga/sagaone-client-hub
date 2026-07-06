import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { KeyRound, ShieldAlert, ShieldCheck, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Rotation {
  id: string;
  provider: string;
  client_id: string;
  rotated_at: string;
  expires_at: string;
  alert_at: string;
  last_alerted_at: string | null;
  alert_count: number;
  resolved_at: string | null;
}

export function SsoSecretStatusCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rot, setRot] = useState<Rotation | null>(null);
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("sso_secret_rotations")
      .select("*")
      .is("resolved_at", null)
      .order("rotated_at", { ascending: false })
      .limit(1);
    setRot(data?.[0] || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading || !rot) return null;

  const dias = Math.ceil((new Date(rot.expires_at).getTime() - Date.now()) / 86400000);
  const critico = dias < 0;
  const alerta = dias >= 0 && dias <= 30;
  const atencao = dias > 30 && dias <= 60;

  const variant = critico ? "destructive" : alerta ? "destructive" : atencao ? "secondary" : "default";
  const Icon = critico || alerta ? ShieldAlert : ShieldCheck;
  const cor = critico || alerta ? "text-destructive" : atencao ? "text-orange-500" : "text-emerald-500";

  const openModal = () => {
    setClientId(rot.client_id);
    // default = hoje + 24 meses (formato datetime-local)
    const d = new Date();
    d.setMonth(d.getMonth() + 24);
    setExpiresAt(d.toISOString().slice(0, 16));
    setOpen(true);
  };

  const salvar = async () => {
    if (!clientId || !expiresAt) return;
    setSaving(true);
    const expIso = new Date(expiresAt).toISOString();
    const alertIso = new Date(new Date(expiresAt).getTime() - 30 * 86400000).toISOString();
    const { data: userData } = await supabase.auth.getUser();

    // Resolve a rotação atual
    await (supabase as any)
      .from("sso_secret_rotations")
      .update({ resolved_at: new Date().toISOString() })
      .is("resolved_at", null);

    const { error } = await (supabase as any).from("sso_secret_rotations").insert({
      provider: "azure",
      client_id: clientId,
      rotated_at: new Date().toISOString(),
      expires_at: expIso,
      alert_at: alertIso,
      created_by: userData.user?.id,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Rotação registrada", description: "Alertas foram reiniciados." });
    setOpen(false);
    load();
  };

  return (
    <Card className="border-l-4" style={{ borderLeftColor: critico || alerta ? "hsl(var(--destructive))" : atencao ? "orange" : "hsl(var(--primary))" }}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          SSO Microsoft — Client Secret
        </CardTitle>
        <Badge variant={variant as any} className="flex items-center gap-1">
          <Icon className="h-3 w-3" />
          {critico ? `Expirado há ${Math.abs(dias)}d` : `${dias} dias restantes`}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          <div>Client ID: <code className="text-xs">{rot.client_id}</code></div>
          <div>Expira em: <span className={cor}>{new Date(rot.expires_at).toLocaleString("pt-BR")}</span></div>
          {rot.last_alerted_at && (
            <div className="text-xs">Último alerta: {new Date(rot.last_alerted_at).toLocaleString("pt-BR")} ({rot.alert_count}x)</div>
          )}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={openModal}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Registrar nova rotação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar nova rotação do Client Secret</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Client ID</Label>
                <Input value={clientId} onChange={(e) => setClientId(e.target.value)} />
              </div>
              <div>
                <Label>Nova data de expiração</Label>
                <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Alerta começa 30 dias antes desta data.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={salvar} disabled={saving}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}