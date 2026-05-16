-- Availabilities table for time tracking

create table if not exists public.availabilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  date date not null,
  start_time time not null,
  end_time time not null,
  updated_at timestamptz not null default now()
);

create index if not exists availabilities_user_id_idx on public.availabilities (user_id);
create index if not exists availabilities_date_idx on public.availabilities (date);

alter table public.availabilities enable row level security;

create policy "availabilities_select_dev" on public.availabilities for select using (true);
create policy "availabilities_insert_dev" on public.availabilities for insert with check (true);
create policy "availabilities_update_dev" on public.availabilities for update using (true) with check (true);
create policy "availabilities_delete_dev" on public.availabilities for delete using (true);
