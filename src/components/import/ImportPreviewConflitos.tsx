import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle } from 'lucide-react';

export interface ConflitoLead {
  telefone: string;
  contato_id: string | null;
  nome: string | null;
  status_atual: string | null;
  eventos_ativos: Array<{
    evento_id: string;
    evento_nome: string | null;
    data_inicio: string | null;
    data_fim: string | null;
  }>;
}

interface ImportPreviewConflitosProps {
  open: boolean;
  conflitos: ConflitoLead[];
  totalImport: number;
  onCancel: () => void;
  onConfirm: (telefonesSkip: string[]) => void;
}

const STATUS_PROTEGIDOS = new Set([
  'Convidado',
  'Confirmado',
  'Check-in',
  'Agendado',
  'Venda',
  'Ganho',
]);

export const ImportPreviewConflitos = ({
  open,
  conflitos,
  totalImport,
  onCancel,
  onConfirm,
}: ImportPreviewConflitosProps) => {
  // Default: status protegido = pular; demais = reimportar.
  const defaultSkip = useMemo(() => {
    const set = new Set<string>();
    for (const c of conflitos) {
      if (c.status_atual && STATUS_PROTEGIDOS.has(c.status_atual)) {
        set.add(c.telefone);
      }
    }
    return set;
  }, [conflitos]);

  const [skipSet, setSkipSet] = useState<Set<string>>(defaultSkip);

  // Se a lista de conflitos mudar, ressetamos os defaults
  useMemo(() => setSkipSet(new Set(defaultSkip)), [defaultSkip]);

  const toggle = (telefone: string) => {
    setSkipSet(prev => {
      const next = new Set(prev);
      if (next.has(telefone)) next.delete(telefone);
      else next.add(telefone);
      return next;
    });
  };

  const reimportarTodos = () => setSkipSet(new Set());
  const pularTodos = () => setSkipSet(new Set(conflitos.map(c => c.telefone)));

  const totalConflitos = conflitos.length;
  const totalReimportar = totalConflitos - skipSet.size;
  const totalPular = skipSet.size;

  const formatEventos = (eventos: ConflitoLead['eventos_ativos']) => {
    if (!eventos || eventos.length === 0) return '-';
    return eventos
      .map(e => e.evento_nome || `Evento ${e.evento_id.slice(0, 8)}`)
      .join(', ');
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onCancel()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Leads já existem em outros eventos ativos
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-3">
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
            <p>
              <strong>{totalConflitos}</strong> de <strong>{totalImport}</strong> contatos da sua planilha já estão vinculados a outros eventos ativos. Escolha o que fazer com cada um.
            </p>
            <p className="mt-1">
              Ao <strong>reimportar</strong>, o status do lead será redefinido para <em>Novo</em> (ou <em>Atribuído</em> se a planilha trouxer um responsável). Os contatos sem conflito serão importados normalmente.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex gap-3">
              <span className="text-emerald-700">
                ✅ <strong>{totalReimportar}</strong> reimportar
              </span>
              <span className="text-muted-foreground">
                ⏭️ <strong>{totalPular}</strong> pular
              </span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={reimportarTodos}>
                Reimportar todos
              </Button>
              <Button size="sm" variant="outline" onClick={pularTodos}>
                Pular todos
              </Button>
            </div>
          </div>

          <div className="border rounded-md flex-1 overflow-hidden">
            <ScrollArea className="h-[50vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/95 z-10">
                  <tr className="border-b text-left">
                    <th className="py-2 px-3 w-24">Reimportar</th>
                    <th className="py-2 px-3">Telefone</th>
                    <th className="py-2 px-3">Nome</th>
                    <th className="py-2 px-3">Status atual</th>
                    <th className="py-2 px-3">Eventos ativos</th>
                  </tr>
                </thead>
                <tbody>
                  {conflitos.map(c => {
                    const skip = skipSet.has(c.telefone);
                    return (
                      <tr key={c.telefone} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-2 px-3">
                          <Checkbox
                            checked={!skip}
                            onCheckedChange={() => toggle(c.telefone)}
                          />
                        </td>
                        <td className="py-2 px-3 font-mono text-xs">{c.telefone}</td>
                        <td className="py-2 px-3 truncate max-w-[180px]">{c.nome || '-'}</td>
                        <td className="py-2 px-3">
                          <span
                            className={
                              c.status_atual && STATUS_PROTEGIDOS.has(c.status_atual)
                                ? 'text-amber-700 font-medium'
                                : 'text-muted-foreground'
                            }
                          >
                            {c.status_atual || '-'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-xs text-muted-foreground truncate max-w-[260px]">
                          {formatEventos(c.eventos_ativos)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(Array.from(skipSet))}>
            Continuar importação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
