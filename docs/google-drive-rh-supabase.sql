-- Integração RH + Google Drive
-- Execute no SQL Editor do Supabase depois da fase 1 do portal de vagas.
-- Objetivo:
-- 1) Cada vaga pode guardar o ID/link da pasta no Google Drive.
-- 2) Cada candidato pode guardar o ID/link do currículo no Google Drive.
-- 3) O portal público deixa de usar o Supabase Storage para currículos.

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

-- Opcional: se você quiser manter compatibilidade com telas antigas que usam curriculo_path,
-- o sistema continuará preenchendo curriculo_path com o link do Drive.
