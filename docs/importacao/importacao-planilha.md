# Importação por Planilha

**Área:** Importação
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Fluxo de upload manual de XLSX/XLS/CSV para vincular leads a um evento de prospecção. Continua sendo o principal para bases fora do Datalake.

## Fluxo funcional (para usuário)

1. Prospecção → Adicionar Clientes → aba **Planilha**.
2. Arrastar arquivo (XLSX/XLS/CSV) ou clicar para selecionar.
3. Mapear colunas se o cabeçalho não for autodetectado (nome, telefone, e-mail, ...).
4. Confirmar → arquivo sobe para Storage e o processamento acontece em background.
5. Notificação em tempo real (`notificacoes_importacao`) reporta andamento e resultado (vinculados, já vinculados, bloqueados por quarentena/opt-out, inválidos).

## Detalhes técnicos

- **Componente:** `src/components/UploadPlanilha.tsx`, hook `src/hooks/useBulkImport.ts`.
- **Storage:** bucket `import-files` (RLS por empresa).
- **Edge Function:** `supabase/functions/process-import/index.ts`.
- **RPC crítica:** `bulk_upsert_contatos` → ver [regras críticas](./bulk-upsert-contatos.md).
- **Tabelas:** `import_logs` (auditoria), `bases_importadas` (metadados do arquivo), `notificacoes_importacao` (feed realtime).
- **Parser:** SheetJS via `src/lib/xlsxSafe.ts` (mitigação de prototype pollution — memory `vulnerability-mitigation-xlsx`).

### Self-chaining

`process-import` divide o arquivo em lotes e se auto-invoca até esgotar, contornando o limite de 150 s da Edge. Cada lote grava um `import_logs` parcial; o último consolida.

### Colunas aceitas

| Campo | Aliases | Obrigatório |
|---|---|---|
| `nome` | nome, cliente, contato, name | sim |
| `telefone` | telefone, celular, phone, whatsapp | sim |
| `email` | email, e-mail, mail | não |
| `modelo` | modelo, veiculo | não |
| `placa` | placa | não |
| `origem` | origem, fonte | não |

Aliases exatos estão em `useBulkImport.ts` — confirmar antes de mudar.

## Regras de negócio

- Telefone normalizado (remove DDI 55 e 9º dígito de celular). Inválido → conta em `invalidos`.
- Duplicados na própria planilha são deduplicados por telefone antes do upsert.
- Contato existente em outro evento é **reutilizado** (novo vínculo em `eventos_prospeccao`).
- Bloqueios de quarentena/opt-out **não** interrompem — vão para colunas específicas do log.

## Erros comuns

| Sintoma | Causa | Ação |
|---|---|---|
| "Arquivo inválido" | Extensão diferente ou cabeçalho ausente | Reexportar como XLSX limpo |
| Import trava em "Processando" | Edge caiu antes do último self-chain | Ver logs de `process-import`; reprocessar `bases_importadas` |
| Muitos `invalidos` | Coluna de telefone com texto/formatação | Formatar como texto no Excel |
| `bloqueados_quarentena` alto | Marca em quarentena para aqueles telefones | Ver [Quarentena](../prospeccao/quarentena.md) |

## Relacionado

- [`bulk_upsert_contatos`](./bulk-upsert-contatos.md)
- [Importação do Pool](./importacao-pool.md)
- [Quarentena](../prospeccao/quarentena.md)