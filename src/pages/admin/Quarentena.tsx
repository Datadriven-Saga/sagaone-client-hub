import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Search, Trash2, RefreshCw, ShieldAlert, Clock, Calendar } from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface QuarentenaItem {
  id: string;
  telefone_normalizado: string;
  marca: string | null;
  empresa_id: string | null;
  evento_nome: string | null;
  prospeccao_id: string | null;
  data_fim_evento: string | null;
  ultimo_impacto_at: string;
  canal: string | null;
  created_at: string;
  updated_at: string;
}

const Quarentena = () => {
  const { activeCompany } = useCompany();
  const [items, setItems] = useState<QuarentenaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterMarca, setFilterMarca] = useState<string>("all");
  const [marcas, setMarcas] = useState<string[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("contato_quarentena")
        .select("*")
        .order("ultimo_impacto_at", { ascending: false })
        .limit(500);

      if (activeCompany?.id) {
        query = query.eq("empresa_id", activeCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      setItems((data as QuarentenaItem[]) || []);

      // Extract unique marcas
      const uniqueMarcas = [...new Set((data || []).map(d => d.marca).filter(Boolean))] as string[];
      setMarcas(uniqueMarcas);
    } catch (err) {
      console.error("Erro ao carregar quarentena:", err);
      toast.error("Erro ao carregar dados de quarentena");
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRemove = async (id: string) => {
    setRemoving(id);
    try {
      const { error } = await supabase
        .from("contato_quarentena")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Contato liberado da quarentena");
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      console.error("Erro ao liberar:", err);
      toast.error("Erro ao liberar contato da quarentena");
    } finally {
      setRemoving(null);
    }
  };

  const getQuarentenaStatus = (item: QuarentenaItem) => {
    if (!item.data_fim_evento) return { active: false, daysLeft: 0, label: "Sem data fim" };
    const dataFim = new Date(item.data_fim_evento);
    const now = new Date();
    const expiry = addDays(dataFim, 30);

    if (now < dataFim) {
      return { active: false, daysLeft: 0, label: "Evento ativo" };
    }
    if (now > expiry) {
      return { active: false, daysLeft: 0, label: "Expirada" };
    }
    const daysLeft = differenceInDays(expiry, now);
    return { active: true, daysLeft, label: `${daysLeft}d restantes` };
  };

  const filtered = items.filter(item => {
    const matchSearch = !search ||
      item.telefone_normalizado?.includes(search) ||
      item.evento_nome?.toLowerCase().includes(search.toLowerCase()) ||
      item.marca?.toLowerCase().includes(search.toLowerCase());
    const matchMarca = filterMarca === "all" || item.marca === filterMarca;
    return matchSearch && matchMarca;
  });

  const activeCount = filtered.filter(i => getQuarentenaStatus(i).active).length;

  return (
    <DashboardLayout title="Quarentena de Contatos">
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
              <ShieldAlert className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{filtered.length}</p>
                <p className="text-xs text-muted-foreground">Total registros</p>
              </div>
            </div>
            <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
              <Clock className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Em quarentena ativa</p>
              </div>
            </div>
            <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
              <Calendar className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{filtered.length - activeCount}</p>
                <p className="text-xs text-muted-foreground">Expiradas / Evento ativo</p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar telefone, evento ou marca..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterMarca} onValueChange={setFilterMarca}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Marca" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as marcas</SelectItem>
                {marcas.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Último Impacto</TableHead>
                  <TableHead>Fim Evento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum registro de quarentena encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(item => {
                    const status = getQuarentenaStatus(item);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">{item.telefone_normalizado}</TableCell>
                        <TableCell>
                          {item.marca ? (
                            <Badge variant="outline">{item.marca}</Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">
                          {item.evento_nome || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(item.ultimo_impacto_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.data_fim_evento
                            ? format(new Date(item.data_fim_evento), "dd/MM/yy", { locale: ptBR })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={status.active ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                disabled={removing === item.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Liberar da quarentena?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  O contato <strong>{item.telefone_normalizado}</strong> poderá ser impactado novamente
                                  por eventos da marca <strong>{item.marca || "N/A"}</strong>.
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRemove(item.id)}>
                                  Liberar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Info */}
          <div className="bg-card border rounded-lg p-4 text-sm text-muted-foreground">
            <p><strong>Como funciona:</strong> Após o término de um evento, os contatos impactados ficam bloqueados por 30 dias para a mesma marca. 
            Durante esse período, não podem ser importados em novos eventos da marca. Ao liberar um contato, ele poderá ser impactado novamente imediatamente.</p>
          </div>
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default Quarentena;
