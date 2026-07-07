## Implementação — Cadências (até 3) na criação/edição de evento IA Whatsapp

### Escopo

Somente `tipoEvento === 'IA Whatsapp'`. IA Ligação, Padrão, etc. **não são tocados** — não leem nem escrevem em `prospeccao_cadencias`.

Fora deste escopo: modo `cadencia_completa` antigo (mantido intacto), dispatcher, webhooks de disparo.

### Regra confirmada

- **Template Prospecção NÃO se repete** entre cadências — segue enviado uma vez em "Ver base".
- Cadências 2 e 3 têm somente: Agendados, Data/Hora, Não Responderam.

### 1. Banco — nova tabela `prospeccao_cadencias`

Migração:

```sql
create table public.prospeccao_cadencias (
  id uuid primary key default gen_random_uuid(),
  prospeccao_id uuid not null references public.prospeccoes(id) on delete cascade,
  ordem smallint not null check (ordem between 1 and 3),
  template_agendado_id uuid references public.whatsapp_templates(id) on delete set null,
  template_nao_agendado_id uuid references public.whatsapp_templates(id) on delete set null,
  data_envio_cadencia timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (prospeccao_id, ordem)
);
create index on public.prospeccao_cadencias (prospeccao_id);

grant select, insert, update, delete on public.prospeccao_cadencias to authenticated;
grant all on public.prospeccao_cadencias to service_role;

alter table public.prospeccao_cadencias enable row level security;

-- RLS espelha prospeccoes: quem pode ler/escrever a prospecção pode a cadência
create policy "cadencias select via prospeccao"
  on public.prospeccao_cadencias for select to authenticated
  using (exists (select 1 from public.prospeccoes p
                 where p.id = prospeccao_id
                   and public.user_can_access_empresa(auth.uid(), p.empresa_id)));

create policy "cadencias write via prospeccao"
  on public.prospeccao_cadencias for all to authenticated
  using (exists (select 1 from public.prospeccoes p
                 where p.id = prospeccao_id
                   and public.user_can_access_empresa(auth.uid(), p.empresa_id)))
  with check (exists (select 1 from public.prospeccoes p
                      where p.id = prospeccao_id
                        and public.user_can_access_empresa(auth.uid(), p.empresa_id)));

-- trigger updated_at (reusa update_updated_at_column existente)
create trigger set_updated_at
  before update on public.prospeccao_cadencias
  for each row execute function public.update_updated_at_column();
```

Colunas legacy em `prospeccoes` (`template_agendado_id`, `template_nao_agendado_id`, `data_envio_cadencia`) **permanecem** e continuam sendo a fonte da Cadência #1 para o dispatcher/webhooks. A tabela nova é sempre gravada em espelho: linha `ordem=1` recebe os mesmos valores; `ordem=2/3` são as cadências extras.

### 2. Frontend — `src/components/CriarProspeccaoModal.tsx`

UI da etapa "Configuração IA" (branch `tipoEvento === 'IA Whatsapp'` → `!cadCompleta`, linhas ~3033–3157):

```text
Editar Evento  Etapa 2 de 3                                             (X)
Configuração IA
─────────────────────────────────────────────────────────────────────────
┌─ Descrição ─────────────────┐  ┌─ Configurações do Evento ──────────┐
│ [Aplicar modelo] [Abrir…]   │  │ Tipo de Lead / Qualificar / …      │
└─────────────────────────────┘  └────────────────────────────────────┘

Template Prospecção *  (fora da tabela, único)
[select ......................▾]

Cadências (até 3)
┌─#─┬─ Cadência Agendados ─┬─ Data/Hora ──────┬─ Cadência Não Respond. ─┬─┐
│ 1 │ [select ...........▾]│ [datetime-local] │ [select .............▾] │ │
│ 2 │ [select ...........▾]│ [datetime-local] │ [select .............▾] │🗑│
│ 3 │ [select ...........▾]│ [datetime-local] │ [select .............▾] │🗑│
└───┴──────────────────────┴──────────────────┴─────────────────────────┴─┘
                              [ + adicionar cadência ]
```

- Novo estado: `cadenciasExtras: Array<{ template_agendado_id, data_envio_cadencia, template_nao_agendado_id }>` (max 2).
- Cadência #1 continua nos estados existentes (`templateAgendadoId`, `dataEnvioCadencia`, `templateNaoAgendadoId`).
- Botão `+` desabilitado quando `cadenciasExtras.length === 2`; lixeira só nas linhas 2/3.
- Regra de unicidade atual (Prospecção ≠ Agendados ≠ Não Responderam) mantida **dentro** de cada linha; entre linhas pode repetir.
- Hidratar `cadenciasExtras` no `useEffect` de `editingProspeccao` a partir de um SELECT em `prospeccao_cadencias where prospeccao_id = editingProspeccao.id order by ordem` (linhas 2 e 3 → estado extra; linha 1 confere com os campos legacy).
- Reset em `resetForm`: `setCadenciasExtras([])`.

### 3. Persistência

Após o `upsert` de `prospeccoes` (bloco ~1413–1468), executar em sequência:

```ts
// 1. Espelha cadência #1 (já persistida nas colunas legacy) na tabela nova
// 2. Insere/atualiza cadências extras
// 3. Deleta linhas ordem>=N+1 removidas pelo usuário
if (tipoEvento === 'IA Whatsapp' && !cadCompleta) {
  const rows = [
    { prospeccao_id, ordem: 1,
      template_agendado_id: templateAgendadoId || null,
      template_nao_agendado_id: templateNaoAgendadoId || null,
      data_envio_cadencia: dadosProspeccao.data_envio_cadencia },
    ...cadenciasExtras.map((c, i) => ({ prospeccao_id, ordem: i + 2, ...c })),
  ];
  await supabase.from('prospeccao_cadencias').upsert(rows, { onConflict: 'prospeccao_id,ordem' });
  await supabase.from('prospeccao_cadencias')
    .delete().eq('prospeccao_id', prospeccao_id).gt('ordem', rows.length);
}
```

### 4. Payload do webhook (`payload.cadencias`)

No bloco ~2228–2267, montar a lista a partir das mesmas fontes (cadência #1 dos campos legacy + `cadenciasExtras`), com todos os campos derivados (`_nome`, `_id_pri`, `_id_meta`) resolvidos via `whatsappTemplates`. Todos os campos legacy do payload continuam sendo enviados.

### 5. Arquivos alterados

- Migração nova (via tool) — cria `prospeccao_cadencias`.
- `src/components/CriarProspeccaoModal.tsx` — UI, estado, hidratação, persistência, payload.
- `.lovable/plan-cadencias.md` — atualizar notas.

### Fora de escopo

- Dispatcher, webhooks internos e envio real (continuam usando as colunas legacy da cadência #1).
- Cadência completa antiga.
- IA Ligação, Padrão e outros tipos de evento.
