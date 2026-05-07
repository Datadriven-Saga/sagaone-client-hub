export interface PatyAgente {
  id: string;
  nome: string;
  telefone: string | null;
  ativo: boolean;
  marca?: string | null;
  uf?: string | null;
}

export interface PatyTemplate {
  id: string;
  nome: string;
  categoria: string;
  category_meta: string | null;
  status_meta: string | null;
  agente_id: string | null;
}

export interface GatilhoConfig {
  id?: string;
  agente_id: string;
  empresa_id: string;
  gatilho_slug: string;
  template_id: string | null;
  ativo: boolean;
}

export interface FollowupConfig {
  id?: string;
  cadencia_id?: string;
  ordem: number;
  template_id: string | null;
  intervalo_horas: number;
  ativo: boolean;
}

export interface CadenciaConfig {
  id?: string;
  agente_id: string;
  empresa_id: string;
  template_inicial_id: string | null;
  max_tentativas: number;
  intervalo_tentativas_horas: number;
  ativo: boolean;
  followups: FollowupConfig[];
}

export interface LojaPosVenda {
  id: string;
  agente_id: string;
  empresa_id: string;
  marca: string;
  uf: string;
  dealer_id: string;
  movisis_id: string | null;
  loja_nome: string | null;
  ativo: boolean;
}