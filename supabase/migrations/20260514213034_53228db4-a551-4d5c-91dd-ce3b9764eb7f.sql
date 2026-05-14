ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS projetista_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_projetista_id ON public.clientes(projetista_id);