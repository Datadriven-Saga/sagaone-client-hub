# Entra Dados — Visão Geral

**Área:** Entra Dados
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Hub em `/entra-dados` que reúne **bases, tabelas e de-paras** mantidos pelo time de dados. Diferente do fluxo de **Importação de Bases** (planilha / pool / API), aqui gerenciamos **artefatos de referência** consumidos por pipelines externos (n8n, Datalake, jobs).

> Não confundir: importar leads para um evento é [Importação de Bases](../importacao/visao-geral.md). Este módulo é sobre **dados-mestre e mapeamentos**.

## Fluxo funcional (para usuário)

1. Abrir `/entra-dados`.
2. KPIs no topo mostram quantas **Bases**, **Tabelas** e **De-Paras** existem.
3. Filtrar por tipo (aba) ou por texto (busca em nome/descrição).
4. Clicar em **Abrir** no card:
   - **De-Para** → navega para `/de-para` (funcional, S3).
   - **Base / Tabela** → toast "Em breve" (ainda não implementado).
5. Botão **Nova base** também mostra "Em breve".

## Estado atual

| Tipo | Status | Onde vive |
|---|---|---|
| De-Para | Funcional | S3 bucket `dados-custom-entradados`, prefixo `de-para/` |
| Base | Placeholder (mock) | Não implementado |
| Tabela | Placeholder (mock) | Não implementado |

A lista de cards vem de `MOCK_ITEMS` hard-coded em `src/pages/EntraDados.tsx`. Só o item `depara-marcas` tem `url` e navega.

## Detalhes técnicos

- **Página:** `src/pages/EntraDados.tsx` (197 linhas, sem hooks nem Supabase).
- **Rota:** `/entra-dados` — guard `canAccessPosVendas`.
- **Sem persistência local** — nenhuma tabela Supabase por trás.

## Roadmap sugerido

- Ligar catálogo real de bases/tabelas (provavelmente lendo do Datalake ou de uma tabela `entra_dados_catalogo`).
- Fluxo real de "Nova base" (upload + registro).
- Preview / query rápido por item.

## Relacionado

- [De-Para](./de-para.md)
- [Importação de Bases](../importacao/visao-geral.md)