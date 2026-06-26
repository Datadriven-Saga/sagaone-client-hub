import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Phone, Search, Pencil, Check, X, Loader2 } from "lucide-react";
import type { ContatoSufixoMatch } from "@/hooks/useRecepcaoData";
import { formatPhoneForDisplay } from "@/lib/phoneUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sufixo: string;
  contatos: ContatoSufixoMatch[];
  onSelect: (contato: ContatoSufixoMatch) => void;
}

export function RecepcaoMultiContatoPicker({ isOpen, onClose, sufixo, contatos, onSelect }: Props) {
  const [items, setItems] = useState<ContatoSufixoMatch[]>(contatos);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    setItems(contatos);
    setEditingId(null);
    setEditValue("");
  }, [contatos]);

  const isEmpty = items.length === 0;

  const startEdit = (c: ContatoSufixoMatch) => {
    setEditingId(c.id);
    setEditValue(c.nome || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async (c: ContatoSufixoMatch) => {
    const novoNome = editValue.trim();
    if (novoNome.length < 2) return;
    setSavingId(c.id);
    try {
      const { error } = await supabase
        .from("contatos")
        .update({ nome: novoNome })
        .eq("id", c.id);
      if (error) throw error;
      setItems((prev) => prev.map((i) => (i.id === c.id ? { ...i, nome: novoNome } : i)));
      toast.success("Nome atualizado");
      setEditingId(null);
      setEditValue("");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao atualizar nome");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[520px] p-4 sm:p-6 rounded-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Search className="w-5 h-5 text-primary" />
            Contatos com final {sufixo}
          </DialogTitle>
          <DialogDescription>
            {isEmpty
              ? "Nenhum lead encontrado com esses 4 dígitos em eventos ativos desta loja."
              : `Encontramos ${items.length} contato(s). Selecione qual fará o check-in.`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto space-y-2 py-2">
          {items.map((c) => {
            const isEditing = editingId === c.id;
            const isSaving = savingId === c.id;
            return (
              <div
                key={c.id}
                className="w-full text-left rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <User className="w-4 h-4 text-muted-foreground shrink-0" />
                    {isEditing ? (
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <Input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(c);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className="h-8"
                          disabled={isSaving}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={() => saveEdit(c)}
                          disabled={isSaving || editValue.trim().length < 2}
                        >
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={cancelEdit}
                          disabled={isSaving}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="truncate">{c.nome || "Sem nome"}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 shrink-0"
                          onClick={() => startEdit(c)}
                          title="Editar nome"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Phone className="w-3 h-3" />
                    <span>{formatPhoneForDisplay(c.telefone) || c.telefone}</span>
                    {c.status && <span className="ml-2 px-1.5 py-0.5 rounded bg-muted">{c.status}</span>}
                  </div>
                </div>
                {!isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelect(c)}
                    className="text-primary font-medium shrink-0"
                  >
                    Selecionar
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}