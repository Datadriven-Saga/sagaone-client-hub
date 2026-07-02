## Objetivo

Garantir, no nível do banco, que nenhum lead seja gravado em `public.contatos` com um `responsavel_email` que não exista em `auth.users`. Hoje a coluna é texto livre, sem FK — qualquer caminho novo (edge function nova, script manual, integração futura) pode voltar a poluir a base. A única forma robusta é uma barreira no próprio Postgres.

## Caminho recomendado

**Trigger `BEFORE INSERT OR UPDATE OF responsavel_email` em `public.contatos`** com duas modalidades controladas por GUC/parâmetro:

1. **Modo estrito (padrão)**: rejeita a linha com `RAISE EXCEPTION` e grava log da tentativa.
2. **Modo tolerante (opt-in)**: apenas normaliza para `NULL` (mantendo o lead disponível para distribuição) e grava log.

O modo é decidido por uma flag por sessão (`SET LOCAL app.responsavel_strict = 'on'`) para não quebrar fluxos de background/legado enquanto observamos os logs.

### Por que trigger e não FK

- `responsavel_email` é texto (não é `auth.users.id`), então FK direta não é possível sem refatorar dezenas de queries e a UI.
- `auth.users` é schema reservado do Supabase — não podemos colocar constraint cruzada.
- Trigger `SECURITY DEFINER` consegue consultar `auth.users` e decidir; é o equivalente prático a uma FK "por email".

### Estrutura

```text
1. Tabela  public.contatos_responsavel_rejeicoes
   - id, contato_id (nullable, pois pode ser INSERT bloqueado)
   - responsavel_email_tentado
   - origem (current_user, session_user, application_name)
   - operacao (INSERT | UPDATE)
   - modo (strict | tolerant)
   - payload_resumo (jsonb: telefone, empresa_id, prospeccao_id)
   - stack_context (query atual via current_query())
   - created_at

2. Função  public.validate_contato_responsavel_email()
   - Se NEW.responsavel_email IS NULL -> retorna NEW.
   - Normaliza (lower/trim).
   - Verifica EXISTS em auth.users por email.
   - Se não existe:
       * insere em contatos_responsavel_rejeicoes
       * strict -> RAISE EXCEPTION
       * tolerant -> NEW.responsavel_email := NULL; RETURN NEW.

3. Trigger  trg_validate_contato_responsavel
   - BEFORE INSERT OR UPDATE OF responsavel_email ON public.contatos
   - FOR EACH ROW EXECUTE FUNCTION validate_contato_responsavel_email().
```

### Rollout seguro (evita quebrar produção)

Etapa 1 — deploy em **modo tolerante global** (default) por 3–5 dias:
- Trigger só zera o email inválido e loga.
- Monitoramos `contatos_responsavel_rejeicoes` para descobrir se ainda existe alguma origem viva alimentando lixo.

Etapa 2 — se logs zerarem (ou só mostrarem casos esperados já tratados):
- Vira o default para **strict**.
- `bulk_upsert_contatos` continua com a lógica atual (resolve/normaliza antes) e passa a rodar dentro da barreira sem impacto.
- Fluxos que legitimamente devem cair para "sem responsável" chamam `SET LOCAL app.responsavel_strict = 'off'` no início da transação.

Etapa 3 — auditoria:
- Página em `/administracao` (ou aba dentro do monitor existente) listando `contatos_responsavel_rejeicoes` das últimas 24h, com contagem por origem, para que a operação identifique rapidamente qual integração precisa ser corrigida.

## Tradeoffs

- **Custo por INSERT**: 1 lookup indexado em `auth.users` por linha. `bulk_upsert_contatos` faz milhares por lote; medir, mas historicamente `auth.users(email)` já é indexado e o custo é marginal.
- **Falhas silenciosas viram falhas ruidosas**: no modo strict, qualquer edge function nova mal escrita passa a estourar exceção. É desejável, mas exige que a etapa 1 seja levada a sério.
- **Não cobre alteração externa via SQL direto do dashboard**: trigger cobre sim, exceto se alguém rodar `ALTER TABLE ... DISABLE TRIGGER`. Aceitável.
- **Não impede email válido de usuário desativado** (`profiles.is_active = false`). Se quisermos endurecer, adicionamos verificação em `profiles` também — recomendo deixar para uma segunda iteração para não misturar responsabilidades.

## Alternativas descartadas

- **CHECK constraint**: não pode consultar outra tabela.
- **FK para `profiles(id)`**: exigiria migrar `responsavel_email` para `responsavel_id uuid` em toda a stack (UI, edge functions, relatórios, importações). Trabalho grande, alto risco; pode ser um passo futuro, mas não é o caminho imediato para "nunca mais acontecer".
- **Validação só na aplicação**: é o que temos hoje (parcial). Já falhou.

## Entregáveis desta task

1. Migração criando `contatos_responsavel_rejeicoes` (+ GRANTs + RLS restrita a Admin/TI/Master + índice em `created_at` e `responsavel_email_tentado`).
2. Migração criando função `validate_contato_responsavel_email()` (SECURITY DEFINER, `search_path=public`) e trigger `trg_validate_contato_responsavel` em **modo tolerante**.
3. Ajuste em `bulk_upsert_contatos` e `process-import` para, quando `p_strict_responsavel = true`, também emitir `SET LOCAL app.responsavel_strict = 'on'` — assim planilha continua rejeitando linhas ruins antes mesmo de chegar no trigger (mensagem de erro amigável já existente).
4. Documentação em `docs/investigacao/responsavel-email-invalido.md` descrevendo o trigger, os dois modos, como consultar rejeições e o plano de virar o default para strict.

## Fora de escopo agora

- Tela de auditoria em `/administracao` (fica para depois de confirmar que o volume de logs é gerenciável).
- Migração de `responsavel_email` → `responsavel_id`.
- Validação de `profiles.is_active`.
