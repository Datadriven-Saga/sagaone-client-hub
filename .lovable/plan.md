## Análise — solicitação de leads (SDR / acesso de terceiros)

### 1. Onde a regra vive hoje

Três funções no Postgres formam o fluxo (todas `SECURITY DEFINER`):

| Função | Papel |
|---|---|
| `count_vendedor_leads_pendentes(user_id)` | **Fonte da verdade do "limite"**. Retorna quantos leads o SDR tem "em aberto". |
| `vendedor_precisa_leads(user_id)` | Só faz `count_... < 30`. Usada para habilitar o botão. |
| `auto_atribuir_leads_vendedor(user_id)` | Aciona a solicitação. Calcula `30 - pendentes`; se ≤ 0, retorna `0`. |

Frontend:
- `src/hooks/useAutoAtribuirLeads.ts` chama as 3 RPCs.
- `src/pages/Prospeccao.tsx` (linhas 1373 e 2523) exibe o toast **"Limite de leads atingido — Você já possui 30 leads pendentes"** quando a RPC devolve `0` e a contagem bate no `LEAD_LIMIT` (30).

O erro do print (image-893) **não vem do backend**: vem do frontend, disparado sempre que `auto_atribuir_leads_vendedor` retorna 0 e `leadsPendentes >= 30`.

### 2. Comportamento atual (regra que define "pendente")

Dentro de `count_vendedor_leads_pendentes` o SDR é considerado "com lead pendente" quando:

- `responsavel_email = email do SDR` **OU** `vendedor_nome = nome do SDR`  
  **E**
- Status do lead está em **qualquer** um destes:
  `Atribuído`, `Em Espera`, `Convidado`, `Confirmado`, `Check-in`  
  (checa tanto o `contatos.status` global quanto o status derivado por evento via `get_contato_status_por_evento`).

Ou seja: um lead que o SDR já convidou, confirmou ou fez check-in continua ocupando slot do limite de 30. É por isso que a Lays'la (image-892) vê 892 leads em "Novos", 0 em "Atribuídos" e mesmo assim leva **Limite atingido** — os 30 slots dela estão presos em `Em Espera / Convidado / Confirmado / Check-in`.

### 3. Fluxo atual (diagrama)

```text
[SDR clica em "Solicitar"]
        │
        ▼
[Front: auto_atribuir_leads_vendedor]
        │
        ▼
[RPC lê count_vendedor_leads_pendentes]
        │
        ▼
   pendentes >= 30 ?
   ├── SIM → retorna 0 → Toast "Limite de leads atingido"
   └── NÃO → seleciona (30 - pendentes) leads "Novo" elegíveis
             │
             ▼
       UPDATE contatos (status='Atribuído', responsavel=SDR)
             │
             ▼
       INSERT logs_movimentacao_contatos

count_vendedor_leads_pendentes conta:
  responsavel_email=SDR OR vendedor_nome=SDR
  E
  status ∈ { Atribuído, Em Espera, Convidado, Confirmado, Check-in }
  (global OU por evento)
```

### 4. Comportamento desejado

"Só conta como pendente o que está em **Atribuído**. Em Espera, Convidado, Confirmado e Check-in **não** ocupam slot."

Justificativa operacional: SDR já trabalhou esses leads — não faz sentido travar a captura de novos por causa deles.

### 5. Proposta de alteração

**Escopo cirúrgico — mudar apenas a definição de "pendente".** Nenhuma mudança de UI, de webhook, de trigger ou de RLS.

Alterações:

1. **`public.count_vendedor_leads_pendentes(uuid)`** — reduzir o array de status para apenas `Atribuído` (global **e** por evento):
   - `status = 'Atribuído'::status_lead`
   - `OR EXISTS (... get_contato_status_por_evento(...) = 'Atribuído')`
   - Mantém `DISTINCT c.id`, `SECURITY DEFINER`, `search_path=public`, filtro por empresa ativa e match por email/nome.

2. **`public.vendedor_precisa_leads(uuid)`** — não muda (continua `< 30`), mas passa a refletir só `Atribuído`.

3. **`public.auto_atribuir_leads_vendedor(uuid)`** — sem alteração estrutural; ele já usa `count_vendedor_leads_pendentes`, logo herda a nova regra automaticamente. O bloco de seleção de leads elegíveis (`status = 'Novo'`) continua igual.

4. **Frontend** — sem mudanças. Os textos "Você já possui X leads pendentes" continuam corretos, apenas passam a refletir a nova definição.

### 6. Riscos e validações antes de aplicar

- **Reversibilidade:** mudança é apenas em duas funções (`count_vendedor_leads_pendentes` e, por herança, `vendedor_precisa_leads`). Rollback = re-aplicar a versão anterior. Nenhum dado é alterado.
- **Impacto operacional:** SDRs que hoje estão "travados" (30 no limite via Em Espera/Convidado/…) vão poder puxar leads novamente. Precisa aviso à operação — pode gerar pico de solicitações.
- **Efeito colateral em métricas:** nenhum. As tabelas `contatos`, `eventos_prospeccao` e `logs_movimentacao_contatos` não são tocadas. Dashboards que contam "pendentes" e que porventura chamem essa RPC vão passar a mostrar números menores — auditar se algum relatório depende do valor antigo.
- **Grande Evento / Mensal:** o filtro de canal em `auto_atribuir_leads_vendedor` (linhas `pr.canal IN ('Grande Evento','Mensal')`) permanece. O comportamento de auto-atribuição continua restrito a esses canais.
- **Cadeira de terceiros:** já valida via `prospeccao_equipe_membros`; permanece igual.

### 7. Testes a executar após a mudança (build mode)

1. Chamar `count_vendedor_leads_pendentes` para a Lays'la e para a Maisa — confirmar que retorna somente a contagem de "Atribuído".
2. Chamar `vendedor_precisa_leads` — confirmar `true` para casos que hoje retornam `false` só por causa de Em Espera/Convidado.
3. Rodar `auto_atribuir_leads_vendedor` num usuário de teste com muitos "Em Espera" e confirmar que agora atribui.
4. UI: abrir Prospecção como SDR, clicar "Solicitar", verificar toast e contagem.

### 8. O que fica de fora (não muda)

- Limite de 30 continua 30 (mudança de valor pode vir depois; hoje é constante `LEAD_LIMIT` no front + literal `30` na RPC — se quisermos parametrizar, é outro plano).
- Regras de visibilidade / equipe / cadeira externa — intocadas.
- Trigger de webhook Mobi — intocada.
- `get_contato_status_por_evento` — intocada.
