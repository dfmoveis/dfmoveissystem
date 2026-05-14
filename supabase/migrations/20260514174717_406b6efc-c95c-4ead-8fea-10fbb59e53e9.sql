-- Fix function search path
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- Ensure RLS is enabled and policies are defined for agendamentos (already enabled in previous step)
-- We'll keep the permissive policy for now as requested for development, but fix the search path.