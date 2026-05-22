# Limpeza: manter só os disparados nos eventos 56896ecf e 02228a03

## Situação atual

| Evento | Total | Disparados (manter) | Pendentes (apagar) |
|---|---:|---:|---:|
| 56896ecf SN MT COXIPÓ | 6.860 | **419** | 6.441 |
| 02228a03 | 9.887 | **290** | 9.597 |
| **Soma** | 16.747 | **709** | **16.038** |

Disparado = `eventos_prospeccao.data_disparo_ia IS NOT NULL`.

## O que será feito (1 migration, transação única)

**Passo 1 — Apagar vínculos pendentes**
```sql
DELETE FROM eventos_prospeccao
 WHERE prospeccao_id IN (
   '56896ecf-2b66-4d93-b4da-064e47fce692',
   '02228a03-2e36-4225-b9c8-cd61292e6699'
 )
 AND data_disparo_ia IS NULL;
-- esperado: 16.038 linhas
```

Com `ASSERT` para abortar se o número divergir.

**Passo 2 — Apagar contatos órfãos**

Dos 16.038 contatos desvinculados, **12.003 ficarão sem nenhum outro vínculo em `eventos_prospeccao`** (em qualquer evento/empresa). Esses serão apagados de `contatos`.

```sql
DELETE FROM contatos c
 WHERE c.id IN (<lista dos 16.038 contato_ids desvinculados no passo 1>)
   AND NOT EXISTS (
     SELECT 1 FROM eventos_prospeccao ep WHERE ep.contato_id = c.id
   );
-- esperado: 12.003 linhas
```

Para capturar a lista do passo 1, uso `DELETE ... RETURNING contato_id` em CTE.

**Passo 3 — Log**

`RAISE NOTICE` com contagens finais. Sem ASSERT no passo 2 (o número pode variar levemente se houver concorrência), mas log claro pra auditoria.

## Riscos e mitigações

- **Cascade de `contatos`**: anotações (`contato_anotacoes`), timeline, etc. caem junto via FK cascade. Isso é o esperado já que o contato vai sumir.
- **Concorrência**: rodar em horário de baixa, ou aceitar pequena variação no count do passo 2.
- **Irreversível**: backup lógico já fica no histórico do Postgres por algumas horas; se algo der errado, restauramos pelo PITR do Supabase.

## Fora de escopo

- Não mexer em `import_logs` (já marcado como reverted antes).
- Não alterar UI nem features de prevenção (já implementadas no loop anterior).
