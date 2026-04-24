import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import QRCode from "qrcode";
import { Calendar, MapPin, Check, Navigation } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const SUPABASE_URL = "https://karcxgnfiymlrkbzhewo.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthcmN4Z25maXltbHJrYnpoZXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NzI0NTEsImV4cCI6MjA3MjM0ODQ1MX0.POIqU4VIszatnejZm6cLMa8ndmhkFjHiOnpUo8xahS8";
const FN_URL = `${SUPABASE_URL}/functions/v1/confirm-presence-info`;

type Data = {
  nome: string;
  convidado_por: string | null;
  qr_token: string;
  confirmed_at: string | null;
  evento_finalizado: boolean;
  evento: {
    titulo: string;
    data_inicio: string | null;
    data_fim: string | null;
    imagem_divulgacao_url: string | null;
  } | null;
  empresa: {
    nome: string;
    endereco: string | null;
    cidade: string | null;
    uf: string | null;
  } | null;
};

function formatDateTime(d: string | null) {
  if (!d) return "-";
  const dt = new Date(d);
  const date = dt.toLocaleDateString("pt-BR");
  const time = dt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} - ${time}`;
}

export default function ConfirmarPresenca() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<"not_found" | "generic" | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  // Fetch dados
  useEffect(() => {
    if (!token) return;
    fetch(`${FN_URL}?token=${encodeURIComponent(token)}`, {
      headers: { apikey: SUPABASE_ANON_KEY },
    })
      .then(async (r) => {
        if (r.status === 404) {
          setError("not_found");
          return null;
        }
        if (!r.ok) {
          setError("generic");
          return null;
        }
        return r.json();
      })
      .then((d) => d && setData(d))
      .catch(() => setError("generic"))
      .finally(() => setLoading(false));
  }, [token]);

  // Gerar QR (mesmo formato usado na recepção: JSON com token)
  useEffect(() => {
    if (!data?.qr_token) return;
    const payload = JSON.stringify({ token: data.qr_token });
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 280,
      color: { dark: "#000000", light: "#FFFFFF" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [data?.qr_token]);

  const handleConfirm = async () => {
    if (!token || confirming || data?.confirmed_at) return;
    setConfirming(true);
    try {
      const r = await fetch(FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ token }),
      });
      const json = await r.json();
      if (r.ok && json.ok) {
        setData((prev) =>
          prev ? { ...prev, confirmed_at: json.confirmed_at } : prev,
        );
        toast({
          title: "Presença confirmada!",
          description: "Apresente o QR Code na entrada do evento.",
        });
      } else {
        toast({
          title: "Erro ao confirmar",
          description: "Tente novamente em instantes.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erro de conexão",
        description: "Verifique sua internet e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setConfirming(false);
    }
  };

  const enderecoCompleto = useMemo(() => {
    if (!data?.empresa) return "";
    const { endereco, cidade, uf } = data.empresa;
    return [endereco, cidade, uf].filter(Boolean).join(", ");
  }, [data?.empresa]);

  // ===== Estados de tela =====
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F1E] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-400" />
      </div>
    );
  }

  if (error === "not_found" || !data) {
    return (
      <div className="min-h-screen bg-[#0B0F1E] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold text-white mb-2">Link inválido</h1>
          <p className="text-gray-400">
            Este convite não foi encontrado ou já não está disponível.
          </p>
        </div>
      </div>
    );
  }

  if (data.evento_finalizado) {
    return (
      <div className="min-h-screen bg-[#0B0F1E] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="text-purple-400 text-xs tracking-[0.2em] uppercase mb-4">
            Saga One
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">
            Este evento já foi realizado
          </h1>
          <p className="text-gray-400">
            Agradecemos seu interesse, {data.nome.split(" ")[0]}!
          </p>
        </div>
      </div>
    );
  }

  const isConfirmed = !!data.confirmed_at;
  const evento = data.evento;
  const empresa = data.empresa;
  const mapsHref = enderecoCompleto
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`
    : "#";
  const wazeHref = enderecoCompleto
    ? `https://waze.com/ul?q=${encodeURIComponent(enderecoCompleto)}&navigate=yes`
    : "#";

  // ===== Layout principal =====
  return (
    <div className="min-h-screen bg-[#0B0F1E] text-white py-8 px-4 md:py-12">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
        {/* COLUNA ESQUERDA */}
        <div className="space-y-5">
          <div>
            <p className="text-purple-400 text-xs tracking-[0.2em] uppercase mb-2">
              Seu Convite Digital
            </p>
            <h1 className="text-3xl md:text-4xl font-bold">
              Olá, {data.nome.split(" ")[0]}
            </h1>
          </div>

          {/* CTA */}
          <button
            onClick={handleConfirm}
            disabled={isConfirmed || confirming}
            className={`w-full py-4 rounded-lg font-bold tracking-wide transition-all ${
              isConfirmed
                ? "bg-emerald-600 text-white cursor-default"
                : "bg-gradient-to-r from-[#D9F77E] to-[#A3E635] text-black hover:opacity-90 active:scale-[0.99]"
            } ${confirming ? "opacity-70" : ""}`}
          >
            {isConfirmed ? (
              <span className="flex items-center justify-center gap-2">
                <Check className="w-5 h-5" />
                PRESENÇA CONFIRMADA
              </span>
            ) : confirming ? (
              "CONFIRMANDO..."
            ) : (
              "CONFIRMAR PRESENÇA"
            )}
          </button>

          {/* KV do evento */}
          {evento?.imagem_divulgacao_url && (
            <div className="rounded-xl overflow-hidden bg-[#161B2E] border border-white/5">
              <img
                src={evento.imagem_divulgacao_url}
                alt={evento.titulo}
                className="w-full h-auto object-cover"
              />
            </div>
          )}

          {/* Título do evento */}
          {evento && (
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-purple-400 leading-tight">
                {evento.titulo}
              </h2>
              {empresa?.nome && (
                <p className="text-white/90 mt-1">{empresa.nome}</p>
              )}
            </div>
          )}
        </div>

        {/* COLUNA DIREITA */}
        <div className="space-y-4">
          {/* QR Card */}
          <div className="bg-[#161B2E] border border-white/5 rounded-xl p-6 text-center">
            <p className="text-purple-400 text-xs tracking-[0.2em] uppercase mb-4">
              Apresente na Entrada
            </p>

            <div className="relative inline-block">
              <div
                className={`bg-white p-3 rounded-lg inline-block transition-all ${
                  isConfirmed ? "" : "blur-md"
                }`}
              >
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR Code"
                    className="w-[220px] h-[220px] block"
                  />
                ) : (
                  <div className="w-[220px] h-[220px] bg-gray-200 animate-pulse" />
                )}
              </div>
              {!isConfirmed && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="bg-black/70 text-white text-xs px-3 py-2 rounded-md tracking-wide">
                    Confirme para liberar
                  </span>
                </div>
              )}
            </div>

            {data.convidado_por && (
              <div className="mt-5 pt-4 border-t border-white/10 text-left">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-purple-400 text-[11px] tracking-widest uppercase">
                    Convidado por:
                  </span>
                  <span className="text-white text-sm font-medium text-right">
                    {data.convidado_por}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Data e Horário */}
          {evento?.data_inicio && (
            <div className="bg-[#161B2E] border border-white/5 rounded-xl p-4 flex items-start gap-3">
              <div className="bg-purple-500/15 p-2 rounded-lg">
                <Calendar className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-purple-400 text-[11px] tracking-widest uppercase mb-1">
                  Data e Horário
                </p>
                <p className="text-white font-semibold">
                  {formatDateTime(evento.data_inicio)}
                </p>
              </div>
            </div>
          )}

          {/* Localização */}
          {empresa && (empresa.endereco || empresa.cidade) && (
            <div className="bg-[#161B2E] border border-white/5 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="bg-purple-500/15 p-2 rounded-lg">
                  <MapPin className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-purple-400 text-[11px] tracking-widest uppercase mb-1">
                    Localização
                  </p>
                  <p className="text-white font-semibold leading-snug">
                    {empresa.endereco}
                    {empresa.cidade && (
                      <>
                        <br />
                        {empresa.cidade}
                        {empresa.uf ? ` / ${empresa.uf}` : ""}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-2 text-sm font-medium transition-colors"
                >
                  <MapPin className="w-4 h-4" /> Google Maps
                </a>
                <a
                  href={wazeHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-2 text-sm font-medium transition-colors"
                >
                  <Navigation className="w-4 h-4" /> Abrir Waze
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}