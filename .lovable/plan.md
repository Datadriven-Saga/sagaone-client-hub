## Problema

Quando o usuário tenta disparar e já existe um job ativo (`pending`/`processing`/`scheduled`) para a mesma prospecção, o `INSERT` em `campaign_jobs` falha com `23505 / uq_campaign_jobs_active_per_prospeccao`. Hoje o toast mostra apenas "Erro ao criar job de disparo", sem explicar a causa.

O caminho do disparo agendado (linha 1689) já trata `uq_campaign_jobs_scheduled_slot` com mensagem amigável. Falta o mesmo tratamento no disparo imediato (linha 1527).

## Alteração

Arquivo único: `src/pages/prospeccao/EventoBase.tsx`, bloco do disparo imediato (~linha 1527).

Substituir o toast genérico por detecção do erro:

- Se `jobError.code === '23505'` e a mensagem contém `uq_campaign_jobs_active_per_prospeccao`:
  - Título: "Disparo já em andamento"
  - Descrição: "Já existe um disparo ativo (pendente, processando ou agendado) para este evento. Aguarde a conclusão ou cancele o disparo atual antes de iniciar um novo."
- Caso contrário, manter mensagem genérica mas incluir `jobError.message` para diagnóstico (igual ao padrão da linha 1691).

Também adicionar log mantendo o `console.error` atual.

## Fora de escopo

- Não mexer em RPC, migrations, edge functions ou no chunking server-side.
- Não alterar a constraint nem o fluxo agendado (já trata seu próprio caso).
- Não mexer em UI além do toast.

## Teste

1. Iniciar um disparo imediato e, antes dele concluir, clicar disparar novamente → toast "Disparo já em andamento" com a explicação.
2. Disparo normal sem job ativo → segue funcionando.