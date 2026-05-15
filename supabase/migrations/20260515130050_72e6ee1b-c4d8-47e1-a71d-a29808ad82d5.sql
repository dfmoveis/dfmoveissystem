-- Atualizar Enums se necessário (Supabase permite adicionar valores)
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'EM_ACOMPANHAMENTO';
ALTER TYPE public.sale_status ADD VALUE IF NOT EXISTS 'NAO_VENDEU';

-- Adicionar novas colunas na tabela projetos
ALTER TABLE public.projetos 
ADD COLUMN IF NOT EXISTS nome_arquiteto TEXT,
ADD COLUMN IF NOT EXISTS motivo_perda TEXT,
ADD COLUMN IF NOT EXISTS percentual_comissao NUMERIC,
ADD COLUMN IF NOT EXISTS valor_entrada NUMERIC,
ADD COLUMN IF NOT EXISTS forma_pagamento_entrada TEXT,
ADD COLUMN IF NOT EXISTS numero_parcelas INTEGER,
ADD COLUMN IF NOT EXISTS valor_parcela NUMERIC;

-- Criar tabela para o Diário de Bordo (Anotações)
CREATE TABLE IF NOT EXISTS public.anotacoes_projeto (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
    autor_id UUID NOT NULL REFERENCES public.users(id),
    autor_nome TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela de anotações
ALTER TABLE public.anotacoes_projeto ENABLE ROW LEVEL SECURITY;

-- Políticas para anotações (Liberado para todos autenticados por enquanto seguindo o padrão do projeto)
CREATE POLICY "Liberar anotações" ON public.anotacoes_projeto FOR ALL USING (true) WITH CHECK (true);

-- Configurar Storage
INSERT INTO storage.buckets (id, name, public) 
VALUES ('projetos_arquivos', 'projetos_arquivos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
CREATE POLICY "Arquivos acessíveis publicamente" 
ON storage.objects FOR SELECT USING (bucket_id = 'projetos_arquivos');

CREATE POLICY "Usuários autenticados podem fazer upload" 
ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'projetos_arquivos' AND auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem deletar seus arquivos" 
ON storage.objects FOR DELETE USING (bucket_id = 'projetos_arquivos' AND auth.role() = 'authenticated');

-- Recarregar schema para o PostgREST
NOTIFY pgrst, 'reload schema';
