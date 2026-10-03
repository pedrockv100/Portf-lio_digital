-- Portfólio Digital CEUNSP
-- Execute este arquivo no SQL Editor do seu projeto Supabase.
-- As políticas abaixo permitem leitura pública e restringem escrita a usuários
-- autenticados com { "role": "admin" } em app_metadata.

create table if not exists public.projects (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 2 and 120),
  description text not null,
  short_description text not null check (char_length(short_description) <= 240),
  course text not null,
  subject text not null,
  class_name text,
  students text[] not null default '{}',
  technologies text[] not null default '{}',
  cover_image text,
  cover_storage_path text,
  project_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.project_images (
  id bigint generated always as identity primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  image_url text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists projects_course_idx on public.projects (course);
create index if not exists projects_subject_idx on public.projects (subject);
create index if not exists projects_created_at_idx on public.projects (created_at desc);
create index if not exists project_images_project_id_idx on public.project_images (project_id);

alter table public.projects enable row level security;
alter table public.project_images enable row level security;

drop policy if exists "Public can read projects" on public.projects;
create policy "Public can read projects"
  on public.projects for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can insert projects" on public.projects;
create policy "Admins can insert projects"
  on public.projects for insert
  to authenticated
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update projects" on public.projects;
create policy "Admins can update projects"
  on public.projects for update
  to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can delete projects" on public.projects;
create policy "Admins can delete projects"
  on public.projects for delete
  to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Public can read project images" on public.project_images;
create policy "Public can read project images"
  on public.project_images for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can insert project images" on public.project_images;
create policy "Admins can insert project images"
  on public.project_images for insert
  to authenticated
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update project images" on public.project_images;
create policy "Admins can update project images"
  on public.project_images for update
  to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can delete project images" on public.project_images;
create policy "Admins can delete project images"
  on public.project_images for delete
  to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- Novos projetos Supabase podem exigir grants explícitos para a Data API.
grant select on public.projects, public.project_images to anon;
grant select, insert, update, delete on public.projects, public.project_images to authenticated;
grant usage, select on sequence public.projects_id_seq, public.project_images_id_seq to authenticated;

-- Bucket público: as imagens do portfólio podem ser exibidas sem sessão.
-- Upload, alteração e exclusão continuam protegidos pelas políticas abaixo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-images',
  'project-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload project images" on storage.objects;
create policy "Admins can upload project images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'project-images'
    and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Admins can update stored project images" on storage.objects;
create policy "Admins can update stored project images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'project-images'
    and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    bucket_id = 'project-images'
    and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Admins can delete stored project images" on storage.objects;
create policy "Admins can delete stored project images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'project-images'
    and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Para atualização automática da vitrine, habilite Realtime para public.projects
-- no painel do Supabase (Database > Replication).
