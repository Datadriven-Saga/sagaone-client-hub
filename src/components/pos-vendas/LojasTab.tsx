import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { AgenteSelector } from "./AgenteSelector";
import { usePatyAgentes, useLojasPosVenda } from "@/hooks/pos-vendas/usePosVendasData";
import type { LojaPosVenda } from "@/types/pos-vendas";

const UF_OPTIONS = ["DF","GO","MG","MT","RO","SP","RJ","BA","PR","SC","RS","ES","CE","PE"];

export function LojasTab() {
  const { toast } = useToast();
  const { activeCompany } = useCompany();
  const { agentes, loading: loadingAgentes } = usePatyAgentes();
  const [agenteId, setAgenteId] = useState<string | null>(null);
  const effectiveId = agenteId ?? agentes[0]?.id ?? null;
  const { lojas, loading, reload } = useLojasPosVenda(effectiveId);
  const [editing, setEditing] = useState<Partial<LojaPosVenda> | null>(null);

  const handleToggle = async (loja: LojaPosVenda, ativo: boolean) => {
    const { error } = await supabase.from("pos_vendas_lojas").update({ ativo }).eq("id", loja.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else reload();
  };

  const handleSave = async () => {
    if (!editing || !effectiveId || !activeCompany?.id) return;
    if (!editing.marca || !editing.uf || !editing.dealer_id) {
      toast({ title: "Preencha marca, UF e dealer ID", variant: "destructive" });
      return;
    }
    const payload = {
      agente_id: effectiveId,
      empresa_id: activeCompany.id,
      marca: editing.marca!,
      uf: editing.uf!,
      dealer_id: editing.dealer_id!,
      movisis_id: editing.movisis_id ?? null,
      loja_nome: editing.loja_nome ?? null,
      ativo: editing.ativo ?? false,
    };
    const { error } = editing.id
      ? await supabase.from("pos_vendas_lojas").update(payload).eq("id", editing.id)
      : await supabase.from("pos_vendas_lojas").insert(payload);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Loja salva" }); setEditing(null); reload(); }
  };

  const ativas = lojas.filter(l => l.ativo).length;

  return (
    <div className="space-y-6">
      <AgenteSelector agentes={agentes} value={effectiveId} onChange={setAgenteId} loading={loadingAgentes} />
      {effectiveId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Lojas vinculadas
              {lojas.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  {ativas} ativas · {lojas.length - ativas} inativas
                </span>
              )}
            </CardTitle>
            <Button size="sm" onClick={() => setEditing({ ativo: false })}>
              <Plus className="h-4 w-4 mr-1" /> Nova Loja
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : lojas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma loja cadastrada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Marca</TableHead>
                    <TableHead>UF</TableHead>
                    <TableHead>Dealer ID</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lojas.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.marca}</TableCell>
                      <TableCell>{l.uf}</TableCell>
                      <TableCell className="font-mono text-xs">{l.dealer_id}</TableCell>
                      <TableCell>{l.loja_nome ?? "—"}</TableCell>
                      <TableCell><Switch checked={l.ativo} onCheckedChange={(v) => handleToggle(l, v)} /></TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => setEditing(l)}><Edit className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar Loja" : "Nova Loja"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Marca</Label><Input value={editing.marca ?? ""} onChange={(e) => setEditing({ ...editing, marca: e.target.value.toUpperCase() })} /></div>
              <div>
                <Label>UF</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={editing.uf ?? ""} onChange={(e) => setEditing({ ...editing, uf: e.target.value })}>
                  <option value="">Selecione...</option>
                  {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <div><Label>Dealer ID</Label><Input value={editing.dealer_id ?? ""} onChange={(e) => setEditing({ ...editing, dealer_id: e.target.value })} /></div>
              <div><Label>Movisis ID</Label><Input value={editing.movisis_id ?? ""} onChange={(e) => setEditing({ ...editing, movisis_id: e.target.value })} /></div>
              <div><Label>Nome da Loja</Label><Input value={editing.loja_nome ?? ""} onChange={(e) => setEditing({ ...editing, loja_nome: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}