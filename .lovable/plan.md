## Objetivo

Na aba "Histórico" de `/administracao/logs-cadeiras`, a coluna "Executado por" mostra apenas `nome_completo`. Adicionar email e cargo (`tipo_acesso`).

## Mudanças

### `src/pages/admin/LogsCadeiras.tsx`
- Expandir o embed `executor:executado_por(nome_completo)` para `executor:executado_por(nome_completo, tipo_acesso)`.
- Após carregar os logs, coletar os `executado_por` distintos e chamar a RPC já existente `get_users_emails(user_ids uuid[])` para buscar emails de uma vez (auth.users não é acessível por embed).
- Guardar um map `userId → email` em estado.
- Atualizar o tipo `Log.executor` para incluir `tipo_acesso`.
- Renderizar a célula "Executado por" como:
  - linha 1: `nome_completo`
  - linha 2 (text-xs muted): `email · cargo`
- Incluir email e cargo no filtro de busca local (`search`).

### Não muda
- Banco, RLS, RPC `set_seat_limit`, `list_seat_usage`.
- Aba "Limites por loja".
- Demais colunas do histórico.

## Testes
1. Histórico carrega sem erro; cada linha mostra nome + email + cargo do executor.
2. Buscar por email ou cargo filtra corretamente.
3. Logs antigos sem `executado_por` continuam mostrando "—".
