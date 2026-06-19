## Resumo
Alterar o endpoint da Lambda de disparos de templates (Pri) de `/dev/disparo` para `/prd/disparo` na Edge Function `process-campaign-job`.

## Mudança
**Arquivo:** `supabase/functions/process-campaign-job/index.ts`
- **Linha 240:** Substituir a URL do webhook de template
  - **De:** `https://ccnv217nqk.execute-api.us-east-1.amazonaws.com/dev/disparo`
  - **Para:** `https://ccnv217nqk.execute-api.us-east-1.amazonaws.com/prd/disparo`

## Fora do escopo
- Não alterar o endpoint de ligação (linha 238-239, `isIALigacao`)
- Não alterar lógica de retry, observabilidade ou tratamento de erro
- Não alterar o job `3e7a65d5-cbca-4105-b4c0-960201c91b0d` manualmente

## Validação
- Verificar que a linha 240 contém a nova URL `/prd/disparo` após a mudança