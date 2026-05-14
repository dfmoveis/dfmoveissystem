ALTER TABLE public.projetos
ADD COLUMN IF NOT EXISTS fonte text;

ALTER TABLE public.projetos
DROP CONSTRAINT IF EXISTS projetos_fonte_check;

ALTER TABLE public.projetos
ADD CONSTRAINT projetos_fonte_check
CHECK (fonte IS NULL OR fonte IN ('ARQUITETO', 'VENDA_DIRETA', 'INDICACAO'));