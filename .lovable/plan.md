# Gate do botão "Importar base" no EventoBaseModal

## Causa

O botão foi adicionado sempre visível em `EventoBaseModal.tsx` (linha 366-374), sem checar permissão. O `UploadPlanilha` original em `Prospeccao.tsx` já é gateado pelo hook `useUserAccessType` via `canUploadBase`.

## Mudança

Em `src/components/EventoBaseModal.tsx`:

1. Importar `useUserAccessType` e ler `canUploadBase`.
2. Renderizar o botão "Importar base" apenas quando `canUploadBase === true`.

## Fora de escopo

- Não tocar em `UploadPlanilha` nem nas features de prevenção já implementadas.
- Não criar nova permissão — reusar a existente (`canUploadBase`) garante paridade com o fluxo antigo.
