-- Create task_allocations junction table
CREATE TABLE IF NOT EXISTS public.task_allocations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    date date NOT NULL,
    allocated_hours double precision NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_task_allocations PRIMARY KEY (id),
    CONSTRAINT uq_task_date UNIQUE (task_id, date)
);

-- Index for fast lookups by task and date
CREATE INDEX IF NOT EXISTS idx_task_allocations_task_id ON public.task_allocations (task_id);
CREATE INDEX IF NOT EXISTS idx_task_allocations_date ON public.task_allocations (date);

-- Enable RLS
ALTER TABLE public.task_allocations ENABLE ROW LEVEL SECURITY;

-- Allow public access for now (or adjust policy as needed for dev)
CREATE POLICY "Allow all actions for task allocations" ON public.task_allocations
    FOR ALL
    USING (true)
    WITH CHECK (true);
