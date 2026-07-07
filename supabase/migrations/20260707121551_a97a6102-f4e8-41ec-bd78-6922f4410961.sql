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

create index prospeccao_cadencias_prospeccao_id_idx on public.prospeccao_cadencias (prospeccao_id);

grant select, insert, update, delete on public.prospeccao_cadencias to authenticated;
grant all on public.prospeccao_cadencias to service_role;

alter table public.prospeccao_cadencias enable row level security;

create policy "cadencias select via prospeccao"
  on public.prospeccao_cadencias for select to authenticated
  using (exists (select 1 from public.prospeccoes p
                 where p.id = prospeccao_id
                   and public.user_can_access_empresa(auth.uid(), p.empresa_id)));

create policy "cadencias insert via prospeccao"
  on public.prospeccao_cadencias for insert to authenticated
  with check (exists (select 1 from public.prospeccoes p
                      where p.id = prospeccao_id
                        and public.user_can_access_empresa(auth.uid(), p.empresa_id)));

create policy "cadencias update via prospeccao"
  on public.prospeccao_cadencias for update to authenticated
  using (exists (select 1 from public.prospeccoes p
                 where p.id = prospeccao_id
                   and public.user_can_access_empresa(auth.uid(), p.empresa_id)))
  with check (exists (select 1 from public.prospeccoes p
                      where p.id = prospeccao_id
                        and public.user_can_access_empresa(auth.uid(), p.empresa_id)));

create policy "cadencias delete via prospeccao"
  on public.prospeccao_cadencias for delete to authenticated
  using (exists (select 1 from public.prospeccoes p
                 where p.id = prospeccao_id
                   and public.user_can_access_empresa(auth.uid(), p.empresa_id)));

create trigger set_updated_at
  before update on public.prospeccao_cadencias
  for each row execute function public.update_updated_at_column();