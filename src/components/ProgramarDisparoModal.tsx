import { useEffect, useMemo, useState } from "react";
import { Calendar as CalendarIcon, Clock, Layers, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const JANELA_INICIO_H = 7;
const JANELA_FIM_H = 22; // último slot 22:00
const TZ = "America/Sao_Paulo";

function buildSlots(): string[] {
  const slots: string[] = [];
  for (let h = JANELA_INICIO_H; h <= JANELA_FIM_H; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    if (h !== JANELA_FIM_H) slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

// Constrói uma timestamp ISO interpretando date+hora COMO se fosse no fuso de SP.
// Para isso convertemos via offset fixo (-03:00 padrão Brasília sem horário de verão).
function buildScheduledIso(date: Date, hhmm: string): string {
  const [hh, mm] = hhmm.split(":").map(Number);
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const HH = String(hh).padStart(2, "0");
  const MM = String(mm).padStart(2, "0");
  // Brasília atualmente sem DST → offset fixo -03:00
  return `${y}-${mo}-${d}T${HH}:${MM}:00-03:00`;
}

function minutesBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 60000);
}

function isWithinWindow(slotIso: string): boolean {
  // Extrai HH:MM do ISO (que já está em offset -03:00)
  const m = slotIso.match(/T(\d{2}):(\d{2})/);
  if (!m) return false;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < JANELA_INICIO_H) return false;
  if (h > JANELA_FIM_H) return false;
  if (h === JANELA_FIM_H && min > 0) return false;
  return true;
}

export type ProgramarDisparoConfig = {
  scheduledIso: string;            // primeiro lote
  cadenceType: "none" | "by_lot_count" | "by_lot_size";
  intervalMinutes: number;         // múltiplo de 30
  lotCount: number;                // total de lotes de negócio
  lotSize: number;                 // contatos por lote
  timezone: string;
};

interface ProgramarDisparoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (cfg: ProgramarDisparoConfig) => void;
  totalContatos: number;
  eventoNome: string;
  isSubmitting?: boolean;
}

const LOTE_TETO = 5000;

export default function ProgramarDisparoModal({
  isOpen,
  onClose,
  onConfirm,
  totalContatos,
  eventoNome,
  isSubmitting = false,
}: ProgramarDisparoModalProps) {
  const slots = useMemo(buildSlots, []);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [hora, setHora] = useState<string>("09:00");
  const [modo, setModo] = useState<"none" | "by_lot_count" | "by_lot_size">("none");
  const [lotCount, setLotCount] = useState<number>(2);
  const [lotSize, setLotSize] = useState<number>(500);
  const [intervaloMin, setIntervaloMin] = useState<number>(30);

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const proximo = new Date(now.getTime() + 30 * 60000);
      proximo.setMinutes(proximo.getMinutes() < 30 ? 30 : 0);
      if (proximo.getMinutes() === 0) proximo.setHours(proximo.getHours() + 1);
      proximo.setSeconds(0, 0);
      setDate(proximo);
      const h = String(proximo.getHours()).padStart(2, "0");
      const m = proximo.getMinutes() < 30 ? "00" : "30";
      setHora(`${h}:${m}`);
    }
  }, [isOpen]);

  const totalLotes = modo === "none"
    ? 1
    : modo === "by_lot_count"
      ? Math.max(1, lotCount)
      : Math.ceil(totalContatos / Math.max(1, lotSize));

  const sizePorLote = modo === "none"
    ? totalContatos
    : modo === "by_lot_count"
      ? Math.ceil(totalContatos / Math.max(1, lotCount))
      : Math.max(1, lotSize);

  const firstIso = date ? buildScheduledIso(date, hora) : null;
  const lastIso = firstIso
    ? buildScheduledIso(
        new Date(new Date(firstIso).getTime() + (totalLotes - 1) * intervaloMin * 60000),
        format(new Date(new Date(firstIso).getTime() + (totalLotes - 1) * intervaloMin * 60000), "HH:mm")
      )
    : null;

  // ---- Validações ----
  const errors: string[] = [];
  if (!date) errors.push("Selecione a data do primeiro envio.");
  if (firstIso) {
    const f = new Date(firstIso);
    if (f.getTime() <= Date.now()) errors.push("O horário inicial precisa estar no futuro.");
    if (!isWithinWindow(firstIso)) errors.push("O horário inicial está fora da janela 07:00–22:00.");
  }
  if (sizePorLote > LOTE_TETO) errors.push(`Cada lote pode ter no máximo ${LOTE_TETO.toLocaleString("pt-BR")} contatos.`);
  if (modo === "by_lot_count" && lotCount > totalContatos) errors.push("Número de lotes maior que o total de contatos.");
  if (modo === "by_lot_size" && lotSize <= 0) errors.push("Tamanho de lote inválido.");
  if (modo !== "none" && intervaloMin < 30) errors.push("Intervalo mínimo entre lotes é 30 minutos.");
  if (modo !== "none" && intervaloMin % 30 !== 0) errors.push("Intervalo deve ser múltiplo de 30 minutos.");

  // Verifica TODOS os lotes dentro da janela
  if (firstIso && totalLotes > 1) {
    for (let i = 0; i < totalLotes; i++) {
      const slotDate = new Date(new Date(firstIso).getTime() + i * intervaloMin * 60000);
      const iso = buildScheduledIso(slotDate, format(slotDate, "HH:mm"));
      if (!isWithinWindow(iso)) {
        errors.push(`Lote ${i + 1} cai fora da janela 07:00–22:00 (${format(slotDate, "dd/MM HH:mm")}). Ajuste o intervalo.`);
        break;
      }
    }
  }

  const handleSubmit = () => {
    if (errors.length > 0 || !firstIso) return;
    onConfirm({
      scheduledIso: firstIso,
      cadenceType: modo,
      intervalMinutes: modo === "none" ? 0 : intervaloMin,
      lotCount: totalLotes,
      lotSize: sizePorLote,
      timezone: TZ,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Programar disparo de WhatsApp
          </DialogTitle>
          <DialogDescription>
            Evento: <span className="font-medium">{eventoNome}</span> — {totalContatos.toLocaleString("pt-BR")} contatos pendentes
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Os horários estão no fuso de <strong>Brasília (GMT-3)</strong>. Janela permitida: 07:00–22:00.
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Data do primeiro envio</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start font-normal", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  disabled={(d) => d < new Date(new Date().toDateString())}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Horário do primeiro envio</Label>
            <Select value={hora} onValueChange={setHora}>
              <SelectTrigger>
                <SelectValue placeholder="Horário" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {slots.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="flex items-center gap-2"><Layers className="h-4 w-4" /> Divisão dos contatos</Label>
          <RadioGroup value={modo} onValueChange={(v) => setModo(v as any)} className="space-y-2">
            <div className="flex items-start gap-2">
              <RadioGroupItem value="none" id="modo-none" className="mt-1" />
              <Label htmlFor="modo-none" className="font-normal cursor-pointer">
                Tudo de uma vez (1 lote único)
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="by_lot_count" id="modo-count" className="mt-1" />
              <Label htmlFor="modo-count" className="font-normal cursor-pointer flex items-center gap-2">
                Dividir em
                <Input
                  type="number"
                  min={1}
                  className="w-20 h-8"
                  value={lotCount}
                  onChange={(e) => setLotCount(parseInt(e.target.value || "1", 10))}
                  disabled={modo !== "by_lot_count"}
                />
                lotes
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="by_lot_size" id="modo-size" className="mt-1" />
              <Label htmlFor="modo-size" className="font-normal cursor-pointer flex items-center gap-2">
                Lotes de
                <Input
                  type="number"
                  min={1}
                  className="w-24 h-8"
                  value={lotSize}
                  onChange={(e) => setLotSize(parseInt(e.target.value || "1", 10))}
                  disabled={modo !== "by_lot_size"}
                />
                contatos cada
              </Label>
            </div>
          </RadioGroup>
        </div>

        {modo !== "none" && (
          <div className="space-y-2">
            <Label>Intervalo entre lotes</Label>
            <Select value={String(intervaloMin)} onValueChange={(v) => setIntervaloMin(parseInt(v, 10))}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[30, 60, 90, 120, 180, 240, 360, 480].map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m < 60 ? `${m} min` : `${m / 60} h${m % 60 ? ` ${m % 60} min` : ""}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
          <div><strong>Resumo</strong></div>
          <div>{totalContatos.toLocaleString("pt-BR")} contatos divididos em <strong>{totalLotes}</strong> lote(s) de ~{sizePorLote.toLocaleString("pt-BR")} contatos.</div>
          {firstIso && (
            <div>Primeiro envio: <strong>{format(new Date(firstIso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</strong></div>
          )}
          {totalLotes > 1 && lastIso && (
            <div>Último envio: <strong>{format(new Date(lastIso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</strong></div>
          )}
          <div className="text-muted-foreground">Custo estimado WhatsApp: <strong>US$ {(totalContatos * 0.06).toFixed(2)}</strong></div>
        </div>

        {errors.length > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive space-y-1">
            {errors.map((e, i) => <div key={i}>• {e}</div>)}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={errors.length > 0 || isSubmitting}>
            {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Programando…</>) : "Programar disparo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}