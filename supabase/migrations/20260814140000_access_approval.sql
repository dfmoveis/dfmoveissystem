-- Access approval workflow for newly registered designers.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.prepare_new_designer_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  NEW.role := 'PROJETISTA';
  NEW.status := 'PENDENTE';
  NEW.approved_at := NULL;
  NEW.approved_by := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_new_designer_account_trigger ON public.users;
CREATE TRIGGER prepare_new_designer_account_trigger
BEFORE INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prepare_new_designer_account();

UPDATE public.users
SET status = 'ATIVO',
    approved_at = COALESCE(approved_at, NOW())
WHERE role = 'ADMIN';

NOTIFY pgrst, 'reload schema';
