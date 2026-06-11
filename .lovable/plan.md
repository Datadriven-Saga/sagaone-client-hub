
## Objetivo

Criar uma empresa especial de base de colaboradores que **não passa por quarentena nem por nenhum opt-out** (externo, global ou interno). A regra fica em uma flag na própria empresa — não em marca/UF — para não contaminar a semântica das outras regras.

## Por que não usar marca nula ou marca "SAGA"

- **Marca nula**: quarentena bypassa naturalmente (gate `v_marca IS NOT NULL`), mas `process-import` bloqueia a importação com "Empresa sem marca/UF configurados" antes mesmo de chegar no upsert. Quebrar essa guarda relaxa segurança para todas as outras empresas mal configuradas.
- **Marca "SAGA" + UF "BR"**: a API externa de opt-out muito provavelmente retorna erro/404 para marca desconhecida (fail-closed → importação bloqueada). E `bulk_upsert_contatos` passaria a gravar em `contato_quarentena` para colaboradores — exatamente o oposto do que se quer.

## Mudança

### 1. Schema — `empresas`

Nova coluna booleana `bypass_compliance` (`default false`, `not null`). Documentada como "Empresa de uso interno (colaboradores). Ignora quarentena, opt-out externo, global e interno. Só pode ser ativada por Master."

### 2. `bulk_upsert_contatos` (v2 controlada por flag)

Tratar como área crítica — seguir a regra do projeto. Antes de alterar, vou:

1. Carregar a versão atual (`20260516131604_..._.sql`) e fazer um diff mental.
2. Adicionar **um único** ponto de carregamento da flag no início: `SELECT bypass_compliance INTO v_bypass FROM empresas WHERE id = p_empresa_id`.
3. Ajustar três gates já existentes para incluir `AND NOT v_bypass`:
   - `v_quarentena_enabled := v_quarentena_enabled AND NOT v_bypass` (linha equivalente à `is_feature_enabled('quarentena_marca_ativa')`).
   - `check_global_opt_out(v_telefone_raw)` — só chama se `NOT v_bypass`.
   - Verificação de `opt_outs` interno (se houver na função; senão, n/a).
4. **Não** alterar `upsert_quarentena` nem o índice parcial.
5. Manter `SECURITY DEFINER`, `search_path`, assinatura e retorno idênticos — sem overload.

### 3. `process-import/index.ts`

Logo após carregar `empresaInfo`, ler também `bypass_compliance`. Se `true`:
- Pular o bloco "OPT-OUT EXTERNO (fail-closed)" inteiro (linhas 435–537), incluindo a guarda de marca/UF obrigatórios.
- Inicializar `optOutIndex` como um índice vazio (`phones: new Set()`, etc.) para que `partitionByOptOut` continue funcionando sem mudanças.
- Logar explicitamente: `[process-import][bypass-compliance] empresa <id> — opt-out e quarentena desativados`.

### 4. UI — `/administracao/empresas`

- Adicionar checkbox **"Bypass compliance (base de colaboradores)"** na edição da empresa, **visível apenas para Master**.
- Badge vermelho "BYPASS COMPLIANCE" na lista e no header da empresa ativa.
- Texto de aviso no checkbox: "Esta empresa não passará por quarentena, opt-out externo, global nem interno. Use apenas para bases de colaboradores."

### 5. Memory

Adicionar `mem://architecture/compliance/bypass-empresa-colaboradores.md` registrando: flag, três pontos de bypass (process-import, bulk_upsert, gates de opt-out), restrição Master e ausência de impacto em outras empresas.

## Testes obrigatórios (regra do projeto para `bulk_upsert_contatos`)

Antes de aprovar a migration:

1. Empresa normal — importação por planilha (deve continuar bloqueando quarentena/opt-out como hoje).
2. Empresa normal — importação via pool.
3. Empresa normal — telefone na quarentena (deve continuar bloqueando).
4. Empresa normal — telefone em `global_opt_outs` (deve continuar bloqueando).
5. Empresa bypass — importação por planilha com telefones em quarentena ativa (devem entrar).
6. Empresa bypass — telefones em `global_opt_outs` (devem entrar).
7. Empresa bypass — sem marca/UF preenchidos (deve importar; não deve chamar API externa).
8. Empresa bypass — duplicados e telefone inválido (lógica de dedup/normalização inalterada).
9. `import_logs` e `bases_importadas` sem regressão de campos.

## Marca/UF da empresa de colaboradores

Independente do bypass, recomendo preencher `marca = 'SAGA'` e `uf = 'BR'` apenas para evitar `null` em filtros de UI (`get_user_marcas`, seletor de empresa, relatórios). Com o bypass ativo, esses valores **não** disparam quarentena nem chamada externa.

## Detalhes técnicos

- `bypass_compliance` em `empresas` é fonte única da verdade. Nada de mapear por CNPJ, marca ou nome.
- Migration: 4 passos — `ALTER TABLE empresas ADD COLUMN` + `COMMENT ON COLUMN` + `CREATE OR REPLACE FUNCTION bulk_upsert_contatos` (corpo completo, ajustes mínimos) + nenhum DROP (sem overload).
- Edge function: deploy automático após aprovar a mudança de código.
- RLS de `empresas` já restringe escrita a Admin/Master; o checkbox só aparece para Master no front (defesa em profundidade, não substitui RLS).
- Sem mudanças em `upsert_quarentena`, no índice parcial, em `quarentena_config` nem nos RPCs de listagem da quarentena.

```text
Fluxo com bypass ativo:

UploadPlanilha
  → process-import
     → lê empresas.bypass_compliance = true
     → PULA bloco opt-out externo (sem fetch, sem guarda marca/uf)
     → bulk_upsert_contatos(... empresa_id ...)
         → lê bypass_compliance internamente
         → não chama check_global_opt_out
         → não grava contato_quarentena
         → ignora flag quarentena_marca_ativa
     → import_logs OK
```
