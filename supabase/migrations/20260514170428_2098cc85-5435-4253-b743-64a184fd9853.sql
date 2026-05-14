-- Definição de ENUMS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'ADMIN',
        'PROJETISTA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE project_status AS ENUM (
        'PRONTO',
        'EM_EXECUCAO',
        'PAUSADO',
        'ATRASADO',
        'FINALIZADO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE sale_status AS ENUM (
        'EM_NEGOCIACAO',
        'VENDEU',
        'NAO_VENDEU'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabela Users (Profile data)
CREATE TABLE IF NOT EXISTS public.Users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'PROJETISTA',
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela Clientes
CREATE TABLE IF NOT EXISTS public.Clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    telefone TEXT,
    email TEXT,
    endereco TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela Projetos
CREATE TABLE IF NOT EXISTS public.Projetos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES public.Clientes(id) ON DELETE CASCADE,
    projetista_id UUID NOT NULL REFERENCES public.Users(id) ON DELETE CASCADE,
    status project_status NOT NULL DEFAULT 'PRONTO',
    data_inicio DATE NOT NULL,
    prazo_termino DATE NOT NULL,
    status_venda sale_status NOT NULL DEFAULT 'EM_NEGOCIACAO',
    valor_venda NUMERIC(10, 2),
    forma_pagamento TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela Comissoes
CREATE TABLE IF NOT EXISTS public.Comissoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id UUID NOT NULL REFERENCES public.Projetos(id) ON DELETE CASCADE,
    projetista_id UUID NOT NULL REFERENCES public.Users(id) ON DELETE CASCADE,
    percentual NUMERIC(5, 2) NOT NULL,
    valor_calculado NUMERIC(10, 2) NOT NULL,
    mes_referencia DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.Users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.Clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.Projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.Comissoes ENABLE ROW LEVEL SECURITY;

-- Initial Policies (Permissive for development as requested, but structured)
CREATE POLICY "Public Users are viewable by everyone" ON public.Users FOR SELECT USING (true);
CREATE POLICY "Public Clientes are viewable by everyone" ON public.Clientes FOR SELECT USING (true);
CREATE POLICY "Public Projetos are viewable by everyone" ON public.Projetos FOR SELECT USING (true);
CREATE POLICY "Public Comissoes are viewable by everyone" ON public.Comissoes FOR SELECT USING (true);

-- Allow all actions for now to facilitate development (will be refined with real Auth)
CREATE POLICY "Allow all actions for Users" ON public.Users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for Clientes" ON public.Clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for Projetos" ON public.Projetos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for Comissoes" ON public.Comissoes FOR ALL USING (true) WITH CHECK (true);

-- Insert the initial ADMIN user
INSERT INTO public.Users (nome, email, role)
VALUES ('Administrador', 'rangelmaker@gmail.com', 'ADMIN')
ON CONFLICT (email) DO NOTHING;