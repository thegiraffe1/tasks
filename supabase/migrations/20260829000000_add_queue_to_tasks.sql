-- Migration to add queue column to tasks table
alter table public.tasks add column if not exists queue text not null default 'Tasks';
