// Utilities to sync Meta-defined WhatsApp templates into the PRI/SagaOne stack.
// Used by the Paty templates screen (/pos-vendas/templates).

export interface MetaButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | string;
  text: string;
  url?: string;
  phone_number?: string;
}

export interface MetaComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS" | string;
  format?: "IMAGE" | "VIDEO" | "TEXT" | "DOCUMENT" | string;
  text?: string;
  example?: {
    header_handle?: string[];
    body_text?: string[][];
  };
  buttons?: MetaButton[];
}

export interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: MetaComponent[];
}

export interface TransformedTemplate {
  /** PRI-shaped components ready to send to the dispatcher (button params, header media id, etc). */
  priComponents: { components: any[] };
  /** Body text extracted from the BODY component (without variables stripped). */
  conteudo: string;
  /** True when the body contains {{N}} placeholders. */
  temVars: boolean;
  /** Media info to upload before the PRI insert. Null when header is text-only or absent. */
  mediaInfo: { type: "image" | "video"; url: string; mime_type: string } | null;
  /** Lightweight card_data shape used by TemplatePreview. */
  cardData: any;
  /** SagaOne `formato` value for the templates table. */
  formato: "texto" | "botao" | "imagem" | "video";
}

/**
 * Convert a Meta template definition into the artifacts SagaOne needs to:
 *   - upload media (mediaInfo)
 *   - call the PRI create webhook (priComponents + conteudo + temVars)
 *   - render the local preview (cardData + formato)
 */
export function transformMetaToPriComponents(
  metaComponents: MetaComponent[]
): TransformedTemplate {
  const priComponentsArray: any[] = [];
  let conteudo = "";
  let temVars = false;
  let mediaInfo: TransformedTemplate["mediaInfo"] = null;
  const cardData: any = {};
  let headerKind: "image" | "video" | "text" | null = null;
  let hasButtons = false;

  for (const comp of metaComponents || []) {
    switch (comp.type) {
      case "HEADER": {
        if (comp.format === "IMAGE" || comp.format === "VIDEO") {
          const mediaType = comp.format.toLowerCase() as "image" | "video";
          headerKind = mediaType;
          priComponentsArray.push({
            type: "header",
            parameters: [
              {
                type: mediaType,
                [mediaType]: { id: "" }, // filled after upload
              },
            ],
          });

          const headerUrl = comp.example?.header_handle?.[0] || "";
          if (headerUrl) {
            mediaInfo = {
              type: mediaType,
              url: headerUrl,
              mime_type: mediaType === "image" ? "image/jpeg" : "video/mp4",
            };
          }
          if (mediaType === "image") cardData.imagemUrl = headerUrl;
          else cardData.videoUrl = headerUrl;
        } else if (comp.format === "TEXT") {
          headerKind = "text";
          cardData.textoCabecalho = comp.text || "";
        }
        break;
      }
      case "BODY": {
        conteudo = comp.text || "";
        temVars = /\{\{\d+\}\}/.test(conteudo);
        break;
      }
      case "FOOTER": {
        cardData.rodape = comp.text || "";
        break;
      }
      case "BUTTONS": {
        hasButtons = (comp.buttons || []).length > 0;
        cardData.botoes = (comp.buttons || []).map((b) => ({ nome: b.text, buttonId: b.text }));
        (comp.buttons || []).forEach((btn, idx) => {
          if (btn.type === "QUICK_REPLY") {
            priComponentsArray.push({
              type: "button",
              index: String(idx),
              sub_type: "QUICK_REPLY",
              parameters: [{ text: btn.text, type: "text" }],
            });
          } else if (btn.type === "URL") {
            priComponentsArray.push({
              type: "button",
              index: String(idx),
              sub_type: "url",
              parameters: [{ type: "text", text: btn.text }],
            });
          }
        });
        break;
      }
    }
  }

  const formato: TransformedTemplate["formato"] =
    headerKind === "image"
      ? "imagem"
      : headerKind === "video"
        ? "video"
        : hasButtons
          ? "botao"
          : "texto";

  return {
    priComponents: { components: priComponentsArray },
    conteudo,
    temVars,
    mediaInfo,
    cardData,
    formato,
  };
}

/**
 * Download a Meta header_handle URL and return it as a base64 data URL.
 * Returns null when the URL has expired or CORS blocks the download — the caller
 * should warn the user to upload media manually.
 */
export async function downloadMediaAsBase64(
  url: string
): Promise<{ base64: string; mime_type: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const mime_type = blob.type || "application/octet-stream";
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve({ base64: reader.result as string, mime_type });
      reader.onerror = () => resolve(null as any);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("[metaTemplateSync] Falha ao baixar mídia:", error);
    return null;
  }
}

/** Map Meta categoria (uppercase) to SagaOne lowercase value used in `categoria`. */
export function mapMetaCategory(metaCategory: string): "marketing" | "utilidade" | "autenticacao" {
  const c = (metaCategory || "").toUpperCase();
  if (c === "UTILITY") return "utilidade";
  if (c === "AUTHENTICATION") return "autenticacao";
  return "marketing";
}