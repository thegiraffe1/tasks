-- Migration to add parent_id and subtask_index to tasks table
alter table public.tasks add column if not exists parent_id uuid references public.tasks(id) on delete cascade;
alter table public.tasks add column if not exists subtask_index integer;
create index if not exists tasks_parent_id_idx on public.tasks(parent_id);
