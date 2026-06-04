import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Armchair, Copy, Loader2, Plus, RefreshCw, AlertCircle, Power } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useUserAccessType } from "@/hooks/useUserAccessType";

type Seat = {
  id: string;
  profile_id: string;
  empresa_id: string;
  prospeccao_id: string;
  status: "active" | "expired" | "revoked";
  created_at: string;
  prospeccoes?: { id: string; titulo: string; data_fim: string | null; snapshot_realizado: boolean | null; ativo: boolean | null } | null;
  profiles?: { id: string; nome_completo: string; is_active: boolean | null } | null;
};

type Prospeccao = {
  id: string;
  titulo: string;
  data_fim: string | null;
};

const Cadeiras = () => {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const { permissions, isAdmin, tipoAcesso } = useUserAccessType();

  const canUseStoreSeat = !!permissions["canUseStoreSeat"];
  const canManageStoreSeats = !!permissions["canManageStoreSeats"] || isAdmin;

  const [flagEnabled, setFlagEnabled] = useState<boolean | null>(null);
  const [seatsLoading, setSeatsLoading] = useState(true);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [eventos, setEventos] = useState<Prospeccao[]>([]);
  const [limit, setLimit] = useState<number | null>(null);

  // Modal: criar cadeira
  const [openCreate, setOpenCreate] = useState(false);
  const [createNome, setCreateNome] = useState("");
  const [createEventoId, setCreateEventoId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; senha: string; evento: string } | null>(null);

  // Modal: renovar
  const [renewSeat, setRenewSeat] = useState<Seat | null>(null);
  const [renewEventoId, setRenewEventoId] = useState<string>("");
  const [renewing, setRenewing] = useState(false);
  const [renewCredentials, setRenewCredentials] = useState<{ email: string; senha: string; evento: string } | null>(null);

  const empresaId = activeCompany?.id || null;

  // Carrega flag para a empresa ativa
  useEffect(() => {
    if (!empresaId) {
      setFlagEnabled(null);
      return;
    }
    supabase
      .rpc("is_feature_enabled_for_empresa", {
        p_flag_key: "login_terceiros_cadeiras",
        p_empresa_id: empresaId,
      })
      .then(({ data, error }) => {
        if (error) {
          console.error("flag check error:", error);
          setFlagEnabled(false);
          return;
        }
        setFlagEnabled(data === true);
      });
  }, [empresaId]);

  // Carrega seats + eventos da empresa ativa + limite
  const loadAll = async () => {
    if (!empresaId || !user) return;
    setSeatsLoading(true);

    const today = new Date().toISOString().slice(0, 10);

    const [seatsRes, eventosRes, limitRes] = await Promise.all([
      supabase
        .from("external_access_seats")
        .select(`
          id, profile_id, empresa_id, prospeccao_id, status, created_at,
          prospeccoes:prospeccao_id(id, titulo, data_fim, snapshot_realizado, ativo),
          profiles:profile_id(id, nome_completo, is_active)
        `)
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false }),
      supabase
        .from("prospeccoes")
        .select("id, titulo, data_fim, snapshot_realizado, ativo")
        .eq("empresa_id", empresaId)
        .gte("data_fim", today)
        .order("data_fim", { ascending: true }),
      supabase.rpc("get_seats_limit", { p_empresa_id: empresaId }),
    ]);

    if (seatsRes.error) {
      console.error("seats error:", seatsRes.error);
      toast.error("Erro ao carregar cadeiras: " + seatsRes.error.message);
    } else {
      setSeats((seatsRes.data as any) || []);
    }

    if (eventosRes.error) {
      console.error("eventos error:", eventosRes.error);
    } else {
      const filtered = (eventosRes.data || []).filter(
        (e: any) => e.ativo !== false && e.snapshot_realizado !== true
      );
      setEventos(filtered.map((e: any) => ({ id: e.id, titulo: e.titulo, data_fim: e.data_fim })));
    }

    if (limitRes.error) {
      console.error("limit error:", limitRes.error);
    } else {
      const l = Number(limitRes.data ?? 5);
      setLimit(l);
    }

    setSeatsLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, user?.id]);

  // Domínios (admin only)
  useEffect(() => {
    if (!canManageLoginDomains) return;
    supabase
      .from("allowed_login_domains")
      .select("id, dominio, tipo, ativo")
      .order("dominio")
      .then(({ data, error }) => {
        if (error) {
          console.error("domains error:", error);
          return;
        }
        setDomains((data as any) || []);
      });
  }, [canManageLoginDomains]);

  const activeSeatsCount = useMemo(
    () => seats.filter((s) => s.status === "active" && s.profiles?.is_active !== false).length,
    [seats]
  );
  const mySeats = useMemo(
    () => seats.filter((s) => isAdmin || s.profiles), // RLS já filtra; lista o que veio
    [seats, isAdmin]
  );

  const handleCreate = async () => {
    if (!createNome.trim() || !createEventoId || !empresaId) return;
    setCreating(true);
    setCreatedCredentials(null);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "create_external",
          nome_completo: createNome.trim(),
          empresa_id: empresaId,
          prospeccao_id: createEventoId,
        },
      });
      if (error || (data && data.success === false) || data?.error) {
        const msg = data?.error || error?.message || "Falha ao criar cadeira";
        toast.error(msg);
        return;
      }
      setCreatedCredentials({
        email: data.email,
        senha: data.senha_temporaria,
        evento: data.evento_titulo || "",
      });
      toast.success("Cadeira criada com sucesso");
      await loadAll();
    } catch (e) {
      toast.error("Erro inesperado ao criar cadeira: " + (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleRenew = async () => {
    if (!renewSeat || !renewEventoId) return;
    setRenewing(true);
    setRenewCredentials(null);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "renew_external_seat",
          profile_id: renewSeat.profile_id,
          prospeccao_id: renewEventoId,
        },
      });
      if (error || (data && data.success === false) || data?.error) {
        const msg = data?.error || error?.message || "Falha ao renovar cadeira";
        toast.error(msg);
        return;
      }
      setRenewCredentials({
        email: data.email,
        senha: data.senha_temporaria,
        evento: data.evento_titulo || "",
      });
      toast.success("Cadeira renovada");
      await loadAll();
    } catch (e) {
      toast.error("Erro inesperado ao renovar: " + (e as Error).message);
    } finally {
      setRenewing(false);
    }
  };

  const handleToggleActive = async (seat: Seat, nextActive: boolean) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "set_external_active",
          profile_id: seat.profile_id,
          is_active: nextActive,
        },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Falha ao atualizar");
        return;
      }
      toast.success(nextActive ? "Terceiro reativado" : "Terceiro desativado");
      await loadAll();
    } catch (e) {
      toast.error("Erro: " + (e as Error).message);
    }
  };

  const handleAddDomain = async () => {
    const d = newDomain.trim().toLowerCase();
    if (!d) return;
    setSavingDomain(true);
    try {
      const { error } = await supabase.from("allowed_login_domains").insert({
        dominio: d,
        tipo: newDomainTipo,
        ativo: true,
        criado_por: user?.id,
      });
      if (error) throw error;
      toast.success("Domínio adicionado");
      setNewDomain("");
      const { data } = await supabase.from("allowed_login_domains").select("id, dominio, tipo, ativo").order("dominio");
      setDomains((data as any) || []);
    } catch (e) {
      toast.error("Erro: " + (e as Error).message);
    } finally {
      setSavingDomain(false);
    }
  };

  const handleToggleDomain = async (id: string, ativo: boolean) => {
    const { error } = await supabase.from("allowed_login_domains").update({ ativo }).eq("id", id);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    setDomains((prev) => prev.map((d) => (d.id === id ? { ...d, ativo } : d)));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado");
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  const statusBadge = (s: Seat) => {
    // Profile desativado tem prioridade sobre status do seat — usuário não consegue logar.
    if (s.profiles?.is_active === false) return <Badge variant="outline">Desativado</Badge>;
    if (s.status === "active") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Ativo</Badge>;
    if (s.status === "expired") return <Badge variant="secondary">Expirado</Badge>;
    return <Badge variant="destructive">Revogado</Badge>;
  };

  // Empresa não habilitada
  if (flagEnabled === false) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Armchair className="h-5 w-5" />
                Cadeiras
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Recurso não habilitado para esta loja</AlertTitle>
                <AlertDescription>
                  Fale com o time de TI para habilitar o "Login de Terceiros + Cadeiras" para a empresa{" "}
                  <strong>{activeCompany?.nome_empresa}</strong>.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Armchair className="h-6 w-6" />
              Cadeiras
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Empresa ativa: <strong>{activeCompany?.nome_empresa || "—"}</strong>
              {limit !== null && (
                <>
                  {" · "}Cadeiras ativas: <strong>{activeSeatsCount}/{limit}</strong>
                </>
              )}
            </p>
          </div>
          {canUseStoreSeat && (
            <Dialog open={openCreate} onOpenChange={(o) => { setOpenCreate(o); if (!o) { setCreateNome(""); setCreateEventoId(""); setCreatedCredentials(null); } }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Usar cadeira
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar acesso de terceiro</DialogTitle>
                  <DialogDescription>
                    Gera um email e senha temporária para o terceiro acessar o SagaOne durante o evento.
                  </DialogDescription>
                </DialogHeader>
                {createdCredentials ? (
                  <div className="space-y-3">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Adicione este usuário à equipe</AlertTitle>
                      <AlertDescription>
                        Vá em <strong>/prospeccao/eventos</strong> e adicione o terceiro à equipe do evento <strong>{createdCredentials.evento}</strong> para que ele receba leads.
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <div className="flex gap-2">
                        <Input readOnly value={createdCredentials.email} />
                        <Button type="button" size="icon" variant="outline" onClick={() => copyToClipboard(createdCredentials.email)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Senha temporária</Label>
                      <div className="flex gap-2">
                        <Input readOnly value={createdCredentials.senha} className="font-mono" />
                        <Button type="button" size="icon" variant="outline" onClick={() => copyToClipboard(createdCredentials.senha)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Esta senha aparece apenas uma vez. Compartilhe com o terceiro de forma segura.
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={() => setOpenCreate(false)}>Fechar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="nome">Nome do terceiro</Label>
                      <Input id="nome" value={createNome} onChange={(e) => setCreateNome(e.target.value)} placeholder="Ex: João da Silva" disabled={creating} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="evento">Evento</Label>
                      <Select value={createEventoId} onValueChange={setCreateEventoId} disabled={creating}>
                        <SelectTrigger id="evento"><SelectValue placeholder="Selecione um evento ativo" /></SelectTrigger>
                        <SelectContent>
                          {eventos.length === 0 ? (
                            <div className="p-3 text-sm text-muted-foreground">Nenhum evento ativo na loja</div>
                          ) : eventos.map((ev) => (
                            <SelectItem key={ev.id} value={ev.id}>
                              {ev.titulo} {ev.data_fim ? `(até ${ev.data_fim})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setOpenCreate(false)} disabled={creating}>Cancelar</Button>
                      <Button onClick={handleCreate} disabled={creating || !createNome.trim() || !createEventoId}>
                        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar acesso"}
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Tabela de cadeiras */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meus terceiros</CardTitle>
          </CardHeader>
          <CardContent>
            {seatsLoading ? (
              <div className="py-8 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              </div>
            ) : mySeats.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhum terceiro cadastrado nesta loja.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Vence em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mySeats.map((s) => {
                    const profileActive = s.profiles?.is_active !== false;
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          {s.profiles?.nome_completo || "—"}
                        </TableCell>
                        <TableCell>{s.prospeccoes?.titulo || "—"}</TableCell>
                        <TableCell>{s.prospeccoes?.data_fim || "—"}</TableCell>
                        <TableCell>{statusBadge(s)}</TableCell>
                        <TableCell className="text-right space-x-1">
                          {(s.status !== "active" || (s.prospeccoes?.data_fim && s.prospeccoes.data_fim < new Date().toISOString().slice(0, 10))) && (
                            <Button size="sm" variant="outline" onClick={() => { setRenewSeat(s); setRenewEventoId(""); setRenewCredentials(null); }}>
                              <RefreshCw className="h-3.5 w-3.5 mr-1" />
                              Renovar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant={profileActive ? "outline" : "default"}
                            onClick={() => handleToggleActive(s, !profileActive)}
                          >
                            <Power className="h-3.5 w-3.5 mr-1" />
                            {profileActive ? "Desativar" : "Reativar"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Renovação modal */}
        <Dialog open={!!renewSeat} onOpenChange={(o) => { if (!o) { setRenewSeat(null); setRenewCredentials(null); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Renovar acesso</DialogTitle>
              <DialogDescription>
                Gera uma nova senha e vincula a um novo evento ativo.
              </DialogDescription>
            </DialogHeader>
            {renewCredentials ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={renewCredentials.email} />
                    <Button size="icon" variant="outline" onClick={() => copyToClipboard(renewCredentials.email)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nova senha</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={renewCredentials.senha} className="font-mono" />
                    <Button size="icon" variant="outline" onClick={() => copyToClipboard(renewCredentials.senha)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => setRenewSeat(null)}>Fechar</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Terceiro</Label>
                  <Input readOnly value={renewSeat?.profiles?.nome_completo || "—"} />
                </div>
                <div className="space-y-1.5">
                  <Label>Novo evento</Label>
                  <Select value={renewEventoId} onValueChange={setRenewEventoId} disabled={renewing}>
                    <SelectTrigger><SelectValue placeholder="Selecione um evento ativo" /></SelectTrigger>
                    <SelectContent>
                      {eventos.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground">Nenhum evento ativo</div>
                      ) : eventos.map((ev) => (
                        <SelectItem key={ev.id} value={ev.id}>
                          {ev.titulo} {ev.data_fim ? `(até ${ev.data_fim})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setRenewSeat(null)} disabled={renewing}>Cancelar</Button>
                  <Button onClick={handleRenew} disabled={renewing || !renewEventoId}>
                    {renewing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Renovar"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Admin: domínios de login */}
        {canManageLoginDomains && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Domínios de login (admin)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <Label>Novo domínio</Label>
                  <Input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="exemplo.com.br" disabled={savingDomain} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={newDomainTipo} onValueChange={(v: any) => setNewDomainTipo(v)} disabled={savingDomain}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sso">SSO</SelectItem>
                      <SelectItem value="password">Senha</SelectItem>
                      <SelectItem value="both">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddDomain} disabled={savingDomain || !newDomain.trim()}>
                  {savingDomain ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domínio</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono">{d.dominio}</TableCell>
                      <TableCell><Badge variant="outline">{d.tipo}</Badge></TableCell>
                      <TableCell>{d.ativo ? <Badge>Sim</Badge> : <Badge variant="secondary">Não</Badge>}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => handleToggleDomain(d.id, !d.ativo)}>
                          {d.ativo ? "Desativar" : "Ativar"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Cadeiras;