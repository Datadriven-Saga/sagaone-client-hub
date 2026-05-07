export interface GatilhoEntrega {
  slug: string;
  nome: string;
  descricao: string;
}

export const GATILHOS_ENTREGA: GatilhoEntrega[] = [
  {
    slug: "novo-lead-criacao",
    nome: "Novo Lead (Pré-requisitos atingidos)",
    descricao: "Disparo quando todos os pré-requisitos configurados no SagaConecta são alcançados.",
  },
  {
    slug: "confirma-agendamento",
    nome: "Confirmação de Agendamento",
    descricao: "Enviado quando o agendamento de entrega é confirmado.",
  },
  {
    slug: "entrega-confirmada",
    nome: "Entrega Confirmada",
    descricao: "Enviado após a confirmação da entrega do veículo.",
  },
  {
    slug: "aviso-entrega-24h",
    nome: "Aviso 24h antes da Entrega",
    descricao: "Lembrete automático enviado 24 horas antes da entrega.",
  },
  {
    slug: "MESSAGE_SENT_BEFORE_1H",
    nome: "1 Hora Antes",
    descricao: "Lembrete enviado 1 hora antes do horário de entrega.",
  },
  {
    slug: "MESSAGE_SENT_AFTER_1H",
    nome: "1 Hora Depois",
    descricao: "Follow-up enviado 1 hora após a entrega.",
  },
  {
    slug: "MESSAGE_SENT_AFTER_1D",
    nome: "1 Dia Depois",
    descricao: "Follow-up enviado 1 dia após a entrega.",
  },
];

export const CUSTO_POR_CATEGORIA: Record<string, number> = {
  MARKETING: 0.0625,
  UTILITY: 0.0068,
  AUTHENTICATION: 0.0068,
};

export const PATY_NAME_FILTER = "%PATY%";