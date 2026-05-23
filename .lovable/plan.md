## Mudanças

### 1. `src/components/EventoBaseModal.tsx`
- Adicionar `evento_confirmacao?: boolean | null` na interface `Prospeccao`.
- Esconder botão "Importar base" quando `prospeccao?.evento_confirmacao === true`:
  ```tsx
  {canUploadBase && !prospeccao?.evento_confirmacao && (...)}
  ```

### 2. `src/components/UploadPlanilha.tsx`
- Adicionar `evento_confirmacao?: boolean | null` na interface `Prospeccao` (linha 19).
- Filtrar dropdown de campanha (linha 793) escondendo eventos de confirmação:
  ```tsx
  {prospeccoes.filter(p => !p.evento_confirmacao).map((p) => ( ... ))}
  ```

### 3. `src/pages/prospeccao/EventoBase.tsx` — novo botão "Adicionar clientes"
Adicionar à esquerda do botão "Atualizar" (antes da linha 2094), só quando:
- `permissions.canUploadBase === true`
- `!isConfirmacao` (eventos de confirmação herdam do pai)

Comportamento: abre o `UploadPlanilha` em modo `lockedProspeccao` travado no evento atual, recarregando a página/dados ao concluir (`handleRefresh`).

```tsx
{permissions.canUploadBase && !isConfirmacao && prospeccao && (
  <>
    <Button variant="default" size="sm" onClick={() => setShowUpload(true)}
      className="bg-emerald-600 hover:bg-emerald-700 text-white">
      <Upload className="h-4 w-4 mr-2" />
      Adicionar clientes
    </Button>
    <UploadPlanilha
      prospeccoes={[]}
      lockedProspeccao={{ id: prospeccao.id, titulo: prospeccao.titulo }}
      open={showUpload}
      onOpenChange={setShowUpload}
      hideTrigger
      onImportComplete={() => handleRefresh()}
    />
  </>
)}
```

Adicionar estado `showUpload` e import de `Upload` + `UploadPlanilha`.

## Fora de escopo
- `ImportarDoDataLake` e `BaseExistente`.
- Sem migração de banco.
