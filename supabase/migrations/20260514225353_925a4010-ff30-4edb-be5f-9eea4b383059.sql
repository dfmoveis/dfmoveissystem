DROP POLICY IF EXISTS "Liberar projetos" ON public.projetos;
CREATE POLICY "Liberar projetos" ON public.projetos FOR ALL USING (true) WITH CHECK (true);
NOTIFY pgrst, 'reload schema';