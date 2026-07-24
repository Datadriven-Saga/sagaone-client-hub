import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Info, ChevronDown, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  useEventosDisponiveis,
  useKanbanBasico,
  StatusLead,
} from "./useKanbanBasico";
import { KanbanBasicoBoard } from "./KanbanBasicoBoard";

export default function KanbanBasicoPage() {
  const { eventos, loading: loadingEventos } = useEventosDisponiveis();
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [openInfo, setOpenInfo] = useState(false);

  const prospeccaoIds = useMemo(() => selecionados, [selecionados.join(",")]);
  const { colunas, loading, error, refetch, mover } = useKanbanBasico(prospeccaoIds);

  const toggle = (id: string) => {
    setSelecionados((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  };

  const handleMover = async (leadId: string, anterior: StatusLead, novo: StatusLead) => {
    try {
      await mover(leadId, anterior, novo);
      toast({ title: "Lead movido", description: `${anterior} → ${novo}` });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Falha ao mover lead",
        description: e?.message ?? "Erro desconhecido",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Kanban de Atendimento (v0)</h1>
            <p className="text-xs text-muted-foreground">
              Versão simples, isolada. Coexiste com o Kanban atual em
              <code className="mx-1">/prospeccao/atendimento</code>.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={loading || selecionados.length === 0}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Explicação do fluxo de status */}
        <Collapsible open={openInfo} onOpenChange={setOpenInfo}>
          <Card className="p-3">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 text-sm font-medium w-full text-left">
                <Info className="h-4 w-4 text-primary" />
                Como o status de cada lead é gerado?
                <ChevronDown
                  className={`h-4 w-4 ml-auto transition-transform ${
                    openInfo ? "rotate-180" : ""
                  }`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>Leitura (esta tela):</strong> o status de cada card é
                derivado <em>por evento</em>. A RPC{" "}
                <code>get_kanban_columns</code> lê o último registro em{" "}
                <code>logs_movimentacao_contatos</code> para o par{" "}
                <code>(contato_id, prospeccao_id)</code> selecionado. Se o lead
                nunca foi movimentado nesse evento, cai em <strong>Novo</strong>.
              </p>
              <p>
                <strong>Escrita (mover card):</strong> chama{" "}
                <code>mutate_contato_status_atomic</code>, que numa mesma
                transação insere o log e atualiza <code>contatos.status</code>{" "}
                (global). O trigger PG dispara o webhook Mobi — o front{" "}
                <em>nunca</em> chama <code>trigger-webhook</code> diretamente
                (evita duplicação).
              </p>
              <p>
                <strong>Onde o lead vive:</strong> <code>contatos</code> é a
                pessoa; <code>eventos_prospeccao</code> é o vínculo lead↔evento;{" "}
                <code>contato_anotacoes</code> guarda o histórico textual e
                pertence ao lead (não ao evento).
              </p>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Filtro de eventos */}
        <Card className="p-3">
          <div className="text-sm font-medium mb-2">
            Eventos {selecionados.length > 0 && (
              <span className="text-xs text-muted-foreground">
                ({selecionados.length} selecionado{selecionados.length > 1 ? "s" : ""})
              </span>
            )}
          </div>
          {loadingEventos ? (
            <div className="text-xs text-muted-foreground">Carregando eventos…</div>
          ) : eventos.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              Nenhum evento encontrado nesta empresa.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {eventos.map((e) => {
                const active = selecionados.includes(e.id);
                return (
                  <button
                    key={e.id}
                    onClick={() => toggle(e.id)}
                    className={`px-2 py-1 rounded-md text-xs border transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:bg-muted"
                    }`}
                  >
                    {e.nome}
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Board */}
        {selecionados.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Selecione ao menos um evento acima para carregar o Kanban.
          </Card>
        ) : error ? (
          <Card className="p-4 text-sm text-destructive">
            Falha ao carregar: {error}
          </Card>
        ) : (
          <KanbanBasicoBoard colunas={colunas} onMover={handleMover} />
        )}
      </div>
    </DashboardLayout>
  );
}