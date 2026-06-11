---
name: Bypass de compliance por empresa
description: Flag empresas.bypass_compliance desliga quarentena e todos os opt-outs (externo, global, interno) para bases de colaboradores
type: feature
---
Empresas marcadas com `empresas.bypass_compliance = true` são bases internas de colaboradores e ignoram TODOS os controles de compliance de importação.

Pontos de bypass (3):
1. `process-import/index.ts`: pula o bloco "OPT-OUT EXTERNO (fail-closed)" inteiro — não exige marca/UF, não chama API externa, usa índice vazio em `partitionByOptOut`.
2. `bulk_upsert_contatos` (RPC SECURITY DEFINER): lê `bypass_compliance` no início. Quando true:
   - Não chama `check_global_opt_out` (libera `global_opt_outs`).
   - Força `v_quarentena_enabled := false` → não consulta nem grava `contato_quarentena`.
3. Retorno do RPC inclui `bypass_compliance: bool` para auditoria.

UI: checkbox vermelho "Bypass compliance" em `/administracao/empresas` visível **apenas para Master** (`useMfaMaster`). Badge `BYPASS COMPLIANCE` na lista. RLS de `empresas` continua sendo a defesa real — o gate de UI é cosmético.

NÃO afeta: `upsert_quarentena`, índice parcial `uq_quarentena_telefone_marca_canal`, RPCs de listagem da quarentena, opt-out interno por canal de outras empresas, ou qualquer empresa sem a flag.

Marca/UF da empresa de colaboradores podem ficar nulos (não há mais guarda exigindo) ou preenchidos com valores cosméticos (ex.: SAGA/BR) só para UI — não disparam nada quando bypass está ativo.