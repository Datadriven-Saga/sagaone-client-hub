import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { RotateCcw } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';

const PRI_IA_EMAIL = 'pri.ia@sagadatadriven.com.br';
const NULL_TOKEN = '__null__';
const PRI_TOKEN = '__pri_ia__';

const STATUS_PROTEGIDOS = new Set([
  'Convidado',
  'Confirmado',
  'Check-in',
  'Agendado',
  'Venda',
  'Em Espera',
]);

export interface LeadMesmoEvento {
  telefone: string;
  contato_id: string | null;
  nome: string | null;
  status_atual: string | null;
  responsavel_email: string | null;
  vendedor_nome: string | null;
}

interface Props {
  open: boolean;
  leads: LeadMesmoEvento[];
  onCancel: () => void;
  /** Recebe os telefones a manter (não-resetar) — eles serão adicionados ao telefones_skip. */
  onConfirm: (telefonesSkip: string[], resetCount: number) => void;
}

function defaultSelected(l: LeadMesmoEvento): boolean {
  const semResp =
    !l.responsavel_email ||
    l.responsavel_email === '' ||
    l.responsavel_email.toLowerCase() === PRI_IA_EMAIL;
  const novo = l.status_atual === 'Novo';
  // Marca p/ reset: lead Novo + (sem responsável | Pri IA)
  if (novo && semResp) return true;
  // Status protegidos ou Atribuído com vendedor real → não marca
  if (l.status_atual && STATUS_PROTEGIDOS.has(l.status_atual)) return false;
  if (l.status_atual === 'Atribuído' && !semResp) return false;
  return false;
}

export function ReimportSameEventPreview({ open, leads, onCancel, onConfirm }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [respFilter, setRespFilter] = useState<Set<string>>(new Set());

  // Defaults
  useEffect(() => {
    const s = new Set<string>();
    for (const l of leads) if (defaultSelected(l)) s.add(l.telefone);
    setSelected(s);
    setStatusFilter(new Set());
    setRespFilter(new Set());
  }, [leads]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => { if (l.status_atual) set.add(l.status_atual); });
    return Array.from(set).sort();
  }, [leads]);

  const respOptions = useMemo(() => {
    const map = new Map<string, string>();
    leads.forEach(l => {
      const email = (l.responsavel_email || '').toLowerCase();
      if (!email) {
        map.set(NULL_TOKEN, 'Sem responsável');
      } else if (email === PRI_IA_EMAIL) {
        map.set(PRI_TOKEN, 'Pri IA');
      } else {
        const label = l.vendedor_nome || l.responsavel_email || '—';
        map.set(email, label);
      }
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter(l => {
      if (statusFilter.size > 0 && !statusFilter.has(l.status_atual || '')) return false;
      if (respFilter.size > 0) {
        const email = (l.responsavel_email || '').toLowerCase();
        const token = !email ? NULL_TOKEN : email === PRI_IA_EMAIL ? PRI_TOKEN : email;
        if (!respFilter.has(token)) return false;
      }
      return true;
    });
  }, [leads, statusFilter, respFilter]);

  const toggle = (tel: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(tel)) next.delete(tel); else next.add(tel);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected(prev => {
      const next = new Set(prev);
      filtered.forEach(l => next.add(l.telefone));
      return next;
    });
  };
  const clearAllFiltered = () => {
    setSelected(prev => {
      const next = new Set(prev);
      filtered.forEach(l => next.delete(l.telefone));
      return next;
    });
  };
  const resetDefaults = () => {
    const s = new Set<string>();
    for (const l of leads) if (defaultSelected(l)) s.add(l.telefone);
    setSelected(s);
  };

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirt = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 12,
  });

  const totalReset = selected.size;
  const totalMantidos = leads.length - totalReset;

  const toggleSetItem = (set: Set<string>, item: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(item)) next.delete(item); else next.add(item);
    setter(next);
  };

  const formatResp = (l: LeadMesmoEvento) => {
    const email = (l.responsavel_email || '').toLowerCase();
    if (!email) return <span className="text-muted-foreground italic">—</span>;
    if (email === PRI_IA_EMAIL) return <span className="text-amber-600">Pri IA</span>;
    return <span>{l.vendedor_nome || l.responsavel_email}</span>;
  };

  const handleConfirm = () => {
    // telefones NÃO selecionados → manter (skip)
    const skip: string[] = [];
    for (const l of leads) {
      if (!selected.has(l.telefone)) skip.push(l.telefone);
    }
    onConfirm(skip, selected.size);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onCancel()}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {leads.length.toLocaleString('pt-BR')} leads já estão neste evento
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Selecione quais deseja resetar para "Novo". Os não selecionados não serão tocados.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-3">
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 border rounded-md bg-muted/30">
            <div>
              <p className="text-xs font-medium mb-1.5">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {statusOptions.map(s => (
                  <Badge
                    key={s}
                    variant={statusFilter.has(s) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => toggleSetItem(statusFilter, s, setStatusFilter)}
                  >
                    {s}
                  </Badge>
                ))}
                {statusFilter.size > 0 && (
                  <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => setStatusFilter(new Set())}>
                    limpar
                  </Button>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-1.5">Responsável</p>
              <div className="flex flex-wrap gap-1.5 max-h-[60px] overflow-y-auto">
                {respOptions.map(r => (
                  <Badge
                    key={r.value}
                    variant={respFilter.has(r.value) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => toggleSetItem(respFilter, r.value, setRespFilter)}
                  >
                    {r.label}
                  </Badge>
                ))}
                {respFilter.size > 0 && (
                  <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => setRespFilter(new Set())}>
                    limpar
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Ações em massa */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="text-muted-foreground">
              Mostrando <strong>{filtered.length.toLocaleString('pt-BR')}</strong> de {leads.length.toLocaleString('pt-BR')}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={selectAllFiltered}>
                Selecionar todos filtrados
              </Button>
              <Button size="sm" variant="outline" onClick={clearAllFiltered}>
                Desmarcar todos filtrados
              </Button>
              <Button size="sm" variant="ghost" onClick={resetDefaults} title="Restaurar seleção sugerida">
                <RotateCcw className="h-3 w-3 mr-1" /> Padrão
              </Button>
            </div>
          </div>

          {/* Tabela virtualizada */}
          <div className="border rounded-md flex-1 overflow-hidden flex flex-col">
            <div className="grid grid-cols-[40px_140px_1fr_120px_180px] gap-2 px-3 py-2 border-b bg-muted/60 text-xs font-medium sticky top-0">
              <div></div>
              <div>Telefone</div>
              <div>Nome</div>
              <div>Status</div>
              <div>Responsável</div>
            </div>
            <div ref={parentRef} className="flex-1 overflow-auto" style={{ maxHeight: '52vh' }}>
              <div style={{ height: rowVirt.getTotalSize(), position: 'relative' }}>
                {rowVirt.getVirtualItems().map(vr => {
                  const l = filtered[vr.index];
                  const checked = selected.has(l.telefone);
                  return (
                    <div
                      key={l.telefone}
                      className="grid grid-cols-[40px_140px_1fr_120px_180px] gap-2 px-3 items-center text-xs border-b hover:bg-muted/40 cursor-pointer"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: vr.size,
                        transform: `translateY(${vr.start}px)`,
                      }}
                      onClick={() => toggle(l.telefone)}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggle(l.telefone)} />
                      <div className="font-mono truncate">{l.telefone}</div>
                      <div className="truncate">{l.nome || '—'}</div>
                      <div>{l.status_atual || '—'}</div>
                      <div className="truncate">{formatResp(l)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm pt-1">
            <span className="text-emerald-700">
              ✅ <strong>{totalReset.toLocaleString('pt-BR')}</strong> selecionados para reset
            </span>
            <span className="text-muted-foreground">
              ⏭️ <strong>{totalMantidos.toLocaleString('pt-BR')}</strong> mantidos sem alteração
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}