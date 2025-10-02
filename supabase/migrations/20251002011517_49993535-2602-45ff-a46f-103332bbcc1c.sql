-- Criar tabela para variáveis dos agentes
CREATE TABLE public.agente_variaveis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id UUID NOT NULL REFERENCES public.agentes_ia(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  empresa_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(agente_id, ordem)
);

-- Enable RLS
ALTER TABLE public.agente_variaveis ENABLE ROW LEVEL SECURITY;

-- RLS Policy: apenas admins e TI podem gerenciar variáveis
CREATE POLICY agente_variaveis_admins_ti_only ON public.agente_variaveis
  FOR ALL
  USING (
    get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
    AND empresa_id = get_user_active_company(auth.uid())
  )
  WITH CHECK (
    get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
    AND empresa_id = get_user_active_company(auth.uid())
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_agente_variaveis_updated_at
  BEFORE UPDATE ON public.agente_variaveis
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir as 8 variáveis iniciais para todos os agentes existentes
INSERT INTO public.agente_variaveis (agente_id, ordem, nome, descricao, empresa_id)
SELECT 
  a.id as agente_id,
  v.ordem,
  v.nome,
  v.descricao,
  a.empresa_id
FROM public.agentes_ia a
CROSS JOIN (
  VALUES 
    (1, 'Nome do cliente', '**⚠️ IMPORTANTE: VERIFIQUE PRIMEIRO SE JÁ TEM O NOME**
   
   - **SE já souber o nome do cliente** (verificar na memória da conversa): PULE esta etapa - NÃO pergunte novamente
   - **SE NÃO souber o nome do cliente**: Pergunte o nome
   
   **Pergunta (apenas se não souber o nome):**
   "Olá! Qual seu nome?"

   **Observação:** Aceite qualquer nome fornecido pelo cliente. Não precisa ser nome completo.'),
    (2, 'Varejo ou Venda Direta', '- Perguntar: "Você teria interesse em comprar como pessoa física, CNPJ, PCD ou Produtor Rural?"
   *Se pessoa física, continue o fluxo.
   *Se CNPJ, PCD ou Produtor Rural, identifique como outro departamento.'),
    (3, 'Modelo', '{{ $(''set-variaveis'').item.json.v_marca }}**
   - Perguntar: "Qual modelo {{ $(''set-variaveis'').item.json.v_marca }} você tem interesse?"
   Opções:
    {{ $(''set-variaveis'').item.json.v_opcoes_produto }}
- Se o cliente não souber o modelo especifico: pergunte a faixa de preço
- Se o cliente não souber nem modelo, nem faixa de preço: encaminhe para o vendedor com a observação "não sabe modelo nem valor"'),
    (4, 'Canal de atendimento', '"Prefere que o especialista {{ $(''set-variaveis'').item.json.v_marca }} te chame pelo WhatsApp (por aqui mesmo), ligação ou vídeo chamada?"'),
    (5, 'Equipe', '" {{ $(''set-variaveis'').item.json.v_opcoes_loja }} "'),
    (6, 'Veiculo Usado da Troca', 'Seu objetivo é  entender se o cliente tem um veículo usado para dar como forma de pagamento.'),
    (7, 'Modelo e Ano do Veículo', 'Caso o cliente tenha um veículo usado para utilizar na troca, você deve solicitar as informações de modelo e ano do veículo'),
    (8, 'Financiamento', 'Você deve perguntar ao cliente se ele deseja ou não financiar parte do pagamento. Você não deve falar sobre taxas ou condições comerciais para o financiamento. Estas informações serão passadas pelo vendedor.')
) AS v(ordem, nome, descricao);