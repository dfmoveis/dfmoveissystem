-- Reserve shared time slots only for client meetings.
-- Measures, visits and individual appointments may overlap across designers.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_sem_sobreposicao;

ALTER TABLE public.agendamentos
  ADD CONSTRAINT agendamentos_sem_sobreposicao
  EXCLUDE USING gist (
    tstzrange(data_inicio, data_fim, '[)') WITH &&
  )
  WHERE (tipo = 'REUNIAO');

NOTIFY pgrst, 'reload schema';
