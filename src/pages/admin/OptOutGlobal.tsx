import { useState, useCallback, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldBan, Plus, Upload, Search, Trash2, AlertTriangle, FileSpreadsheet, ShieldOff } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCompany } from "@/contexts/CompanyContext";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { ExternalOptOutDialog } from "@/components/ExternalOptOutDialog";
import { ExternalOptOutConfirmDialog } from "@/components/optout/ExternalOptOutConfirmDialog";
import { ExternalOptOutBulkConfirmDialog, type BulkOptOutRow } from "@/components/optout/ExternalOptOutBulkConfirmDialog";

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const OptOutGlobal = () => {
  const queryClient = useQueryClient();
  const { activeCompany } = useCompany();
  const { permissions } = useUserAccessType();
  const canRegisterExternal = permissions.canRegisterExternalOptOut === true;
  const [search, setSearch] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newMotivo, setNewMotivo] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Confirmação regulatória para inclusão manual
  const [manualOptOutOpen, setManualOptOutOpen] = useState(false);
  // Confirmação em massa (CSV)
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkOptOutRow[]>([]);

  // Externo Regulatório
  const [extPhone, setExtPhone] = useState("");
  const [extNome, setExtNome] = useState("");
  const [extCpf, setExtCpf] = useState("");
  const [extEmail, setExtEmail] = useState("");
  const [extDialogOpen, setExtDialogOpen] = useState(false);
  const [empresaInfo, setEmpresaInfo] = useState<{ marca: string; uf: string } | null>(null);

  useEffect(() => {
    const fetchEmpresa = async () => {
      if (!activeCompany?.id) { setEmpresaInfo(null); return; }
      const { data } = await supabase
        .from("empresas")
        .select("marca, uf")
        .eq("id", activeCompany.id)
        .maybeSingle();
      if (data) setEmpresaInfo({ marca: data.marca || "", uf: data.uf || "" });
    };
    fetchEmpresa();
  }, [activeCompany?.id]);

  const { data: optOuts = [], isLoading } = useQuery({
    queryKey: ["global-opt-outs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("global_opt_outs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = optOuts.filter((item: any) =>
    !search || item.telefone_normalizado?.includes(search.replace(/\D/g, ""))
  );

  const addMutation = useMutation({
    mutationFn: async ({ telefone, motivo }: { telefone: string; motivo: string }) => {
      const digits = telefone.replace(/\D/g, "");
      if (digits.length < 10) throw new Error("Número inválido");
      const { error } = await supabase.from("global_opt_outs").insert({
        telefone_normalizado: digits,
        motivo: motivo || null,
      });
      if (error) {
        if (error.code === "23505") throw new Error("Número já está na lista");
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["global-opt-outs"] });
      setShowAddDialog(false);
      setNewPhone("");
      setNewMotivo("");
      toast({ title: "Número adicionado à lista negra" });
    },
    onError: (e: Error) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("global_opt_outs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["global-opt-outs"] });
      setDeleteId(null);
      toast({ title: "Número removido da lista" });
    },
    onError: () => {
      toast({ title: "Erro ao remover", variant: "destructive" });
    },
  });

  const handleFileImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split(/[\r\n]+/).filter(Boolean);
      const phones: string[] = [];
      for (const line of lines) {
        const digits = line.replace(/\D/g, "");
        if (digits.length >= 10 && digits.length <= 13) {
          phones.push(digits);
        }
      }
      if (phones.length === 0) {
        toast({ title: "Nenhum número válido encontrado no arquivo", variant: "destructive" });
        return;
      }
      // Abre modal de confirmação regulatória em massa. O insert em
      // global_opt_outs só acontece após a API externa responder OK por número.
      setBulkRows(phones.map((p) => ({ telefone: p })));
      setShowImportDialog(false);
      setBulkConfirmOpen(true);
    } catch {
      toast({ title: "Erro ao processar arquivo", variant: "destructive" });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }, [queryClient]);

  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">Gestão de Opt-Out</h1>
              <p className="text-muted-foreground">
                Bloqueio interno (lista negra global) e externo (regulatório por marca/UF)
              </p>
            </div>
          </div>

          <Tabs defaultValue="global" className="space-y-6">
            <TabsList>
              <TabsTrigger value="global">
                <ShieldBan className="h-4 w-4 mr-2" />
                Global Interno
              </TabsTrigger>
              {canRegisterExternal && (
                <TabsTrigger value="externo">
                  <ShieldOff className="h-4 w-4 mr-2" />
                  Externo (Regulatório)
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="global" className="space-y-6 mt-0">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Importar CSV
              </Button>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar à Lista Negra
              </Button>
            </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="rounded-xl">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <ShieldBan className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{optOuts.length}</p>
                  <p className="text-xs text-muted-foreground">Total Bloqueados</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <Card className="rounded-xl">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar número na lista negra..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Números Bloqueados</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShieldBan className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Nenhum número encontrado</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Data Bloqueio</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">
                          {item.telefone_normalizado}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-destructive/15 text-destructive border-0 text-[10px] font-semibold tracking-wide">
                            BLOQUEADO PERMANENTEMENTE
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {item.motivo || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.created_at
                            ? format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteId(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
            </TabsContent>

            {canRegisterExternal && (
              <TabsContent value="externo" className="space-y-6 mt-0">
                <Card className="rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShieldOff className="h-4 w-4 text-destructive" />
                      Registrar contato no Opt-Out Externo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Esta ação envia o contato para a API regulatória externa.
                      Marca e UF são derivadas da empresa ativa
                      {empresaInfo
                        ? <> (<span className="font-medium">{empresaInfo.marca || "—"}</span> / <span className="font-medium">{empresaInfo.uf || "—"}</span>).</>
                        : <>.</>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Nome completo *</label>
                        <Input value={extNome} onChange={(e) => setExtNome(e.target.value)} placeholder="Nome do contato" />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Telefone *</label>
                        <Input value={extPhone} onChange={(e) => setExtPhone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">CPF (opcional)</label>
                        <Input value={extCpf} onChange={(e) => setExtCpf(e.target.value)} placeholder="Somente dígitos" maxLength={14} />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">E-mail (opcional)</label>
                        <Input type="email" value={extEmail} onChange={(e) => setExtEmail(e.target.value)} placeholder="email@exemplo.com" />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        variant="destructive"
                        disabled={
                          !extNome.trim() ||
                          extPhone.replace(/\D/g, "").length < 10 ||
                          !empresaInfo?.marca || !empresaInfo?.uf
                        }
                        onClick={() => setExtDialogOpen(true)}
                      >
                        <ShieldOff className="h-4 w-4 mr-2" />
                        Prosseguir para confirmação
                      </Button>
                    </div>
                    {(!empresaInfo?.marca || !empresaInfo?.uf) && (
                      <p className="text-xs text-destructive">
                        A empresa ativa não tem marca/UF configurada. Configure em Empresas antes de registrar opt-out externo.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {extDialogOpen && empresaInfo && (
                  <ExternalOptOutDialog
                    open={extDialogOpen}
                    onOpenChange={setExtDialogOpen}
                    contato={{
                      nome: extNome.trim(),
                      telefone: extPhone,
                      cpf: extCpf?.trim() || null,
                      email: extEmail?.trim() || null,
                    }}
                    empresa={{ marca: empresaInfo.marca, uf: empresaInfo.uf }}
                    canal="whatsapp"
                    allowCanalSelection
                    onSuccess={() => {
                      setExtNome(""); setExtPhone(""); setExtCpf(""); setExtEmail("");
                    }}
                  />
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Add Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar à Lista Negra</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Telefone</label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={newPhone}
                  onChange={(e) => setNewPhone(formatPhone(e.target.value))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Motivo (opcional)</label>
                <Textarea
                  placeholder="Ex: Solicitação do cliente, número inválido..."
                  value={newMotivo}
                  onChange={(e) => setNewMotivo(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
              <Button
                onClick={() => {
                  if (newPhone.replace(/\D/g, "").length < 10) return;
                  setShowAddDialog(false);
                  setManualOptOutOpen(true);
                }}
                disabled={addMutation.isPending || newPhone.replace(/\D/g, "").length < 10}
              >
                Prosseguir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmação regulatória — inclusão manual */}
        {manualOptOutOpen && (
          <ExternalOptOutConfirmDialog
            open={manualOptOutOpen}
            onClose={() => setManualOptOutOpen(false)}
            onConfirmed={() => {
              addMutation.mutate(
                { telefone: newPhone, motivo: newMotivo || "Opt-out regulatório" },
                {
                  onSettled: () => setManualOptOutOpen(false),
                },
              );
            }}
            contato={{
              telefone: newPhone.replace(/\D/g, ""),
              nome: "Não informado",
              email: null,
              cpf: null,
            }}
            marca={empresaInfo?.marca || ""}
            uf={empresaInfo?.uf || ""}
            allowMarcaUfEdit={!empresaInfo?.marca || !empresaInfo?.uf}
            justificativaInicial={newMotivo || undefined}
          />
        )}

        {/* Confirmação regulatória em massa — CSV */}
        {bulkConfirmOpen && (
          <ExternalOptOutBulkConfirmDialog
            open={bulkConfirmOpen}
            onClose={() => {
              setBulkConfirmOpen(false);
              setBulkRows([]);
            }}
            rows={bulkRows}
            marca={empresaInfo?.marca || ""}
            uf={empresaInfo?.uf || ""}
            allowMarcaUfEdit={!empresaInfo?.marca || !empresaInfo?.uf}
            onConfirmed={async (result) => {
              // Insere em global_opt_outs APENAS os que tiveram sucesso na API externa.
              const okPhones = bulkRows.filter(
                (r) => !result.errors.find((e) => e.telefone === r.telefone),
              );
              if (okPhones.length === 0) {
                queryClient.invalidateQueries({ queryKey: ["global-opt-outs"] });
                return;
              }
              const rowsInsert = okPhones.map((r) => ({
                telefone_normalizado: r.telefone,
                motivo: "Importação em massa (opt-out regulatório)",
              }));
              const batchSize = 200;
              for (let i = 0; i < rowsInsert.length; i += batchSize) {
                const batch = rowsInsert.slice(i, i + batchSize);
                await supabase.from("global_opt_outs").upsert(batch, {
                  onConflict: "telefone_normalizado",
                  ignoreDuplicates: true,
                });
              }
              queryClient.invalidateQueries({ queryKey: ["global-opt-outs"] });
            }}
          />
        )}

        {/* Import Dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Importar Números em Massa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="border-2 border-dashed rounded-xl p-6 text-center">
                <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">
                  Selecione um arquivo CSV ou TXT com um número por linha
                </p>
                <label className="cursor-pointer">
                  <Button variant="outline" asChild disabled={importing}>
                    <span>{importing ? "Processando..." : "Selecionar Arquivo"}</span>
                  </Button>
                  <input
                    type="file"
                    accept=".csv,.txt,.xlsx"
                    className="hidden"
                    onChange={handleFileImport}
                    disabled={importing}
                  />
                </label>
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>Duplicatas serão ignoradas automaticamente. Números com menos de 10 dígitos serão descartados.</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Remoção</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja remover este número da lista negra? Ele voltará a receber comunicações.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Removendo..." : "Remover"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default OptOutGlobal;
