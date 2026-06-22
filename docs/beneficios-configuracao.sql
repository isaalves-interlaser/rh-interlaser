-- Configuração fixa de benefícios para seleção no cadastro de vagas

create table if not exists public.beneficios_configuracao (
  codigo text primary key,
  nome text not null,
  descricao text,
  active boolean not null default true,
  padrao boolean not null default true,
  ordem integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.beneficios_configuracao enable row level security;

drop policy if exists "beneficios_configuracao_select_authenticated" on public.beneficios_configuracao;
drop policy if exists "beneficios_configuracao_insert_authenticated" on public.beneficios_configuracao;
drop policy if exists "beneficios_configuracao_update_authenticated" on public.beneficios_configuracao;
drop policy if exists "beneficios_configuracao_delete_authenticated" on public.beneficios_configuracao;

create policy "beneficios_configuracao_select_authenticated"
on public.beneficios_configuracao
for select
to authenticated
using (true);

create policy "beneficios_configuracao_insert_authenticated"
on public.beneficios_configuracao
for insert
to authenticated
with check (true);

create policy "beneficios_configuracao_update_authenticated"
on public.beneficios_configuracao
for update
to authenticated
using (true)
with check (true);

create policy "beneficios_configuracao_delete_authenticated"
on public.beneficios_configuracao
for delete
to authenticated
using (true);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists beneficios_configuracao_set_updated_at on public.beneficios_configuracao;

create trigger beneficios_configuracao_set_updated_at
before update on public.beneficios_configuracao
for each row
execute function public.set_updated_at();

insert into public.beneficios_configuracao (codigo, nome, descricao, active, padrao, ordem)
values
  ('vale_transporte', 'Vale transporte', 'Benefício de deslocamento para o colaborador.', true, true, 10),
  ('refeicao', 'Refeição', 'Refeição no local ou benefício equivalente.', true, true, 20),
  ('cesta_basica', 'Cesta básica', 'Benefício mensal conforme política interna.', true, true, 30),
  ('convenio_medico', 'Convênio médico', 'Quando aplicável à vaga e à política vigente.', true, false, 40),
  ('convenio_odontologico', 'Convênio odontológico', 'Quando aplicável à vaga e à política vigente.', true, false, 50),
  ('seguro_vida', 'Seguro de vida', 'Benefício conforme política interna.', true, false, 60)
on conflict (codigo) do nothing;
