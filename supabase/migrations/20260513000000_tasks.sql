-- Tasks table (Supabase / Postgres). RLS permissive for local dev; tighten before production.

create extension if not exists "pgcrypto";

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  estimated_time double precision not null,
  real_time double precision not null default 0,
  deadline date,
  priority text not null check (priority in ('High', 'Medium', 'Low')),
  completion boolean not null default false,
  missed boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_id_idx on public.tasks (user_id);
create index if not exists tasks_deadline_idx on public.tasks (deadline);
create index if not exists tasks_completion_idx on public.tasks (completion);

alter table public.tasks enable row level security;

-- Dev-friendly policies (replace with user-scoped policies when auth is wired).
create policy "tasks_select_dev" on public.tasks for select using (true);
create policy "tasks_insert_dev" on public.tasks for insert with check (true);
create policy "tasks_update_dev" on public.tasks for update using (true) with check (true);
create policy "tasks_delete_dev" on public.tasks for delete using (true);

comment on table public.tasks is 'Task tracker rows; missed is manual-only (no deadline triggers).';
