-- Create function for updating timestamps if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create table for schedule events
CREATE TABLE IF NOT EXISTS public.agendamentos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo TEXT NOT NULL,
    descricao TEXT,
    data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    data_fim TIMESTAMP WITH TIME ZONE NOT NULL,
    criado_por UUID REFERENCES public.users(id) NOT NULL,
    cliente_id UUID REFERENCES public.clientes(id),
    tipo TEXT NOT NULL DEFAULT 'REUNIAO', -- REUNIAO, ATENDIMENTO, VISITA
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

-- Simple policies for development
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'agendamentos' AND policyname = 'Permitir tudo para agendamentos'
    ) THEN
        CREATE POLICY "Permitir tudo para agendamentos" ON public.agendamentos FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Add fields to projects for file management
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS arquivo_url TEXT;
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- Trigger for updated_at on agendamentos
DROP TRIGGER IF EXISTS update_agendamentos_updated_at ON public.agendamentos;
CREATE TRIGGER update_agendamentos_updated_at
BEFORE UPDATE ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();