export interface GatilhoPecas {
  key: string; // composite key for UI
  label: string;
  descricao: string;
  status: string;
  tipo_requisicao: "" | "Normal" | "VOR";
}

export const GATILHOS_PECAS: GatilhoPecas[] = [
  { key: "PEDIDO_FATURADO::", label: "Pedido Faturado", descricao: "Disparo quando o pedido é faturado no MySaga.", status: "PEDIDO_FATURADO", tipo_requisicao: "" },
  { key: "PEDIDO_EM_BO::", label: "Pedido em BO", descricao: "Disparo quando o pedido entra em BO.", status: "PEDIDO_EM_BO", tipo_requisicao: "" },
  { key: "PEDIDO_EM_TRANSITO::", label: "Pedido em Trânsito", descricao: "Disparo quando o pedido sai em trânsito.", status: "PEDIDO_EM_TRANSITO", tipo_requisicao: "" },
  { key: "PEDIDO_ENTREGUE::", label: "Peça chegou — Balcão", descricao: "Genérico: peça chegou para retirada no balcão (fallback).", status: "PEDIDO_ENTREGUE", tipo_requisicao: "" },
  { key: "PEDIDO_ENTREGUE::Normal", label: "Peça chegou — Carro com cliente", descricao: "Peça chegou para veículo Normal (em uso do cliente).", status: "PEDIDO_ENTREGUE", tipo_requisicao: "Normal" },
  { key: "PEDIDO_ENTREGUE::VOR", label: "Peça chegou — Imobilizado (VOR)", descricao: "Peça chegou para veículo Imobilizado (VOR).", status: "PEDIDO_ENTREGUE", tipo_requisicao: "VOR" },
];

export function gatilhoKey(status: string, tipo_requisicao: string | null | undefined): string {
  return `${status}::${tipo_requisicao ?? ""}`;
}