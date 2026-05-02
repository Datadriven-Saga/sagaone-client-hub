import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, CheckCircle2, Clock, XCircle, MapPin, Calendar } from "lucide-react";
import QRCodeLib from "qrcode";

type PageState =
  | "loading"
  | "ready"
  | "confirming"
  | "confirmed"
  | "already"
  | "expired"
  | "error";

interface ConviteInfo {
  nome: string;
  already_confirmed?: boolean;
  qr_token?: string | null;
  evento: { nome: string; data_inicio: string | null; data_fim: string | null } | null;
  empresa: { nome: string; endereco: string | null; cidade: string | null; uf: string | null } | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const formatDate = (iso: string | null) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

async function generateQR(qrToken: string, eventoId?: string): Promise<string> {
  // Mantém o mesmo formato JSON que a recepção (QRCodeScanner) consome
  const payload = JSON.stringify({
    qr_token: qrToken,
    evento_id: eventoId ?? "",
  });
  return QRCodeLib.toDataURL(payload, { width: 280, margin: 2 });
}

export default function ConfirmarPresenca() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>("loading");
  const [info, setInfo] = useState<ConviteInfo | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  // Carrega dados ao montar
  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/confirm-presence-info?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } },
        );
        const data = await res.json();

        if (data.expired) {
          setState("expired");
          return;
        }
        if (!res.ok) {
          setState("error");
          return;
        }

        setInfo(data);

        if (data.already_confirmed && data.qr_token) {
          const url = await generateQR(data.qr_token);
          setQrDataUrl(url);
          setState("already");
        } else {
          setState("ready");
        }
      } catch (e) {
        console.error("Erro ao carregar convite:", e);
        setState("error");
      }
    })();
  }, [token]);

  const handleConfirm = async () => {
    if (!token) return;
    setState("confirming");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/confirm-presence`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (res.status === 410) {
        setState("expired");
        return;
      }
      if (!res.ok || !data.success) {
        setState("error");
        return;
      }

      if (data.qr_token) {
        const url = await generateQR(data.qr_token);
        setQrDataUrl(url);
      }
      setState(data.already_confirmed ? "already" : "confirmed");
    } catch (e) {
      console.error("Erro ao confirmar:", e);
      setState("error");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
          <h1 className="text-2xl font-bold tracking-tight">
            {info?.empresa?.nome ?? "Saga"}
          </h1>
          {info?.evento?.nome && (
            <p className="text-blue-100 text-sm mt-1">{info.evento.nome}</p>
          )}
        </div>

        <div className="p-6">
          {state === "loading" && (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm text-slate-500">Carregando convite...</p>
            </div>
          )}

          {state === "ready" && info && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Olá, {info.nome}! 👋
                </h2>
                <p className="text-slate-600 mt-1 text-sm">
                  Confirme sua presença no evento abaixo:
                </p>
              </div>

              {info.evento && (
                <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-100">
                  <p className="font-semibold text-slate-900">{info.evento.nome}</p>
                  {info.evento.data_inicio && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="w-4 h-4 shrink-0" />
                      <span>{formatDate(info.evento.data_inicio)}</span>
                    </div>
                  )}
                  {info.empresa?.endereco && (
                    <div className="flex items-start gap-2 text-sm text-slate-600">
                      <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        {info.empresa.endereco}
                        {info.empresa.cidade && ` — ${info.empresa.cidade}`}
                        {info.empresa.uf && `/${info.empresa.uf}`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleConfirm}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
              >
                ✅ Confirmar Presença
              </button>
            </div>
          )}

          {state === "confirming" && (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm text-slate-500">Confirmando...</p>
            </div>
          )}

          {(state === "confirmed" || state === "already") && (
            <div className="text-center space-y-4 py-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                <CheckCircle2 className="w-9 h-9 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {state === "already" ? "Presença já confirmada!" : "Presença confirmada!"}
                </h2>
                <p className="text-slate-600 text-sm mt-1">
                  Apresente o QR Code abaixo no check-in:
                </p>
              </div>
              {qrDataUrl && (
                <div className="flex justify-center">
                  <div className="bg-white p-3 rounded-xl border-2 border-slate-200">
                    <img
                      src={qrDataUrl}
                      alt="QR Code do convite"
                      className="w-56 h-56"
                    />
                  </div>
                </div>
              )}
              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`qrcode-${info?.nome ?? "convite"}.png`}
                  className="inline-flex items-center justify-center gap-2 w-full bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
                >
                  ⬇️ Baixar QR Code
                </a>
              )}
              <p className="text-xs text-slate-400">
                Tire um print desta tela ou salve a imagem do QR Code
              </p>
            </div>
          )}

          {state === "expired" && (
            <div className="text-center space-y-3 py-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full">
                <Clock className="w-9 h-9 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Convite expirado</h2>
              <p className="text-slate-600 text-sm">
                Este link de confirmação não está mais válido. Entre em contato
                com seu vendedor para receber um novo.
              </p>
            </div>
          )}

          {state === "error" && (
            <div className="text-center space-y-3 py-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full">
                <XCircle className="w-9 h-9 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                Convite não encontrado
              </h2>
              <p className="text-slate-600 text-sm">
                Verifique se o link está correto ou entre em contato com seu
                vendedor.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">Powered by Saga One</p>
        </div>
      </div>
    </div>
  );
}