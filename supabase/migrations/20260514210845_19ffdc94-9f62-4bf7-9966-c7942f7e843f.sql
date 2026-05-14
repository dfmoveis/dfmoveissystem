ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'PENDENTE';
UPDATE public.users SET status = 'ATIVO' WHERE status = 'PENDENTE';
ALTER TABLE public.users ADD CONSTRAINT users_status_check CHECK (status IN ('PENDENTE','ATIVO','BLOQUEADO'));