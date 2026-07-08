## Mudança

**Arquivo:** `src/components/CriarProspeccaoModal.tsx` (linha 3269)

Remover o parágrafo condicional que aparece somente em modo edição:

```tsx
{editingProspeccao && (
  <p className="text-xs text-muted-foreground mt-1.5">Tipo de Lead e Evento de Confirmação não podem ser alterados após a criação.</p>
)}
```

O bloco inteiro sai — inclusive o `{editingProspeccao && (...)}` — assim como fizemos com o texto de confirmação na criação. Nada mais é alterado (o parágrafo do `isConfirmacaoFlow` logo abaixo permanece).
