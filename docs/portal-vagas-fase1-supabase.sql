-- Portal público de vagas — Fase 1 com Google Drive
-- Execute no SQL Editor do Supabase.
-- Esta versão salva currículos no Google Drive via Edge Functions.

-- 1) Campos de integração com Google Drive.
alter table public.vagas
  add column if not exists drive_folder_id text,
  add column if not exists drive_folder_url text;

alter table public.candidatos
  add column if not exists curriculo_drive_file_id text,
  add column if not exists curriculo_drive_url text,
  add column if not exists curriculo_drive_nome text,
  add column if not exists curriculo_drive_folder_id text;

create index if not exists idx_vagas_drive_folder_id
  on public.vagas (drive_folder_id)
  where drive_folder_id is not null;

create index if not exists idx_candidatos_curriculo_drive_file_id
  on public.candidatos (curriculo_drive_file_id)
  where curriculo_drive_file_id is not null;

-- 2) RLS.
alter table public.vagas enable row level security;
alter table public.empresas enable row level security;
alter table public.filiais enable row level security;
alter table public.candidatos enable row level security;
alter table public.candidaturas enable row level security;

-- 3) Leitura de vagas.
-- Público vê apenas vagas abertas.
drop policy if exists "Portal publico le vagas abertas" on public.vagas;
create policy "Portal publico le vagas abertas"
on public.vagas
for select
to anon
using (status = 'aberta');

-- Usuário logado vê todas as vagas na área interna.
drop policy if exists "RH autenticado le vagas" on public.vagas;
create policy "RH autenticado le vagas"
on public.vagas
for select
to authenticated
using (true);

-- 4) Empresas e filiais.
-- Liberado para o portal e área interna porque são dados necessários para exibir as vagas.
drop policy if exists "Portal publico le empresas ativas" on public.empresas;
drop policy if exists "Portal publico le empresas" on public.empresas;
create policy "Portal publico le empresas"
on public.empresas
for select
to anon, authenticated
using (true);

drop policy if exists "Portal publico le filiais ativas" on public.filiais;
drop policy if exists "Portal publico le filiais" on public.filiais;
create policy "Portal publico le filiais"
on public.filiais
for select
to anon, authenticated
using (true);

-- 5) Cadastro público de candidatos e candidaturas iniciais.
drop policy if exists "Portal publico cria candidatos" on public.candidatos;
create policy "Portal publico cria candidatos"
on public.candidatos
for insert
to anon, authenticated
with check (
  origem in ('site', 'banco_talentos')
  and active = true
);

drop policy if exists "Portal publico cria candidaturas" on public.candidaturas;
create policy "Portal publico cria candidaturas"
on public.candidaturas
for insert
to anon, authenticated
with check (
  etapa = 'recebido'
  and status = 'ativo'
);
