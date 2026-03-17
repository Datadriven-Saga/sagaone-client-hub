import { useState, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldBan, Plus, Upload, Search, Trash2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const OptOutGlobal = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newMotivo, setNewMotivo] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

      const rows = phones.map((t) => ({ telefone_normalizado: t, motivo: "Importação em massa" }));
      const batchSize = 200;
      let inserted = 0;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase.from("global_opt_outs").upsert(batch, {
          onConflict: "telefone_normalizado",
          ignoreDuplicates: true,
        });
        if (!error) inserted += batch.length;
      }

      queryClient.invalidateQueries({ queryKey: ["global-opt-outs"] });
      setShowImportDialog(false);
      toast({ title: `${inserted} números processados com sucesso` });
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
              <h1 className="text-3xl font-bold text-foreground mb-1">Gestão de Opt-Out Global</h1>
              <p className="text-muted-foreground">
                Números bloqueados permanentemente em todos os canais e marcas
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Importar CSV
              </Button>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar à Lista Negra
              </Button>
            </div>
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
                onClick={() => addMutation.mutate({ telefone: newPhone, motivo: newMotivo })}
                disabled={addMutation.isPending || newPhone.replace(/\D/g, "").length < 10}
              >
                {addMutation.isPending ? "Salvando..." : "Bloquear Número"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
