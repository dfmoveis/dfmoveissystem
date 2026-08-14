-- Operational workflow hardening for project distribution and the shared agenda.

CREATE INDEX IF NOT EXISTS idx_projetos_projetista_status
  ON public.projetos (projetista_id, status);

CREATE INDEX IF NOT EXISTS idx_projetos_fila
  ON public.projetos (status, projetista_id, created_at);

CREATE INDEX IF NOT EXISTS idx_projetos_prazo_termino
  ON public.projetos (prazo_termino);

CREATE INDEX IF NOT EXISTS idx_agendamentos_intervalo
  ON public.agendamentos (data_inicio, data_fim);

-- Prevent two people from booking overlapping store appointments.
-- Existing conflicting rows must be resolved before applying this constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agendamentos_sem_sobreposicao'
      AND conrelid = 'public.agendamentos'::regclass
  ) THEN
    ALTER TABLE public.agendamentos
      ADD CONSTRAINT agendamentos_sem_sobreposicao
      EXCLUDE USING gist (
        tstzrange(data_inicio, data_fim, '[)') WITH &&
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
