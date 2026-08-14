-- Allow the administrator to create active designers and permanently remove
-- a designer together with all operational data owned by that profile.

CREATE OR REPLACE FUNCTION public.admin_create_designer(
  p_admin_id UUID,
  p_admin_password TEXT,
  p_nome TEXT,
  p_email TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_designer_id UUID;
  v_email TEXT := LOWER(BTRIM(p_email));
  v_nome TEXT := BTRIM(p_nome);
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_admin_id
      AND role::TEXT = 'ADMIN'
      AND status = 'ATIVO'
      AND password = p_admin_password
  ) THEN
    RAISE EXCEPTION 'Senha do administrador incorreta.';
  END IF;

  IF LENGTH(v_nome) < 2 THEN
    RAISE EXCEPTION 'Informe o nome completo da projetista.';
  END IF;

  IF v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Informe um e-mail válido.';
  END IF;

  IF LENGTH(COALESCE(p_password, '')) < 6 THEN
    RAISE EXCEPTION 'A senha da projetista precisa ter pelo menos 6 caracteres.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE LOWER(email) = v_email) THEN
    RAISE EXCEPTION 'Este e-mail já está cadastrado.';
  END IF;

  INSERT INTO public.users (nome, email, password, role, status)
  VALUES (v_nome, v_email, p_password, 'PROJETISTA', 'PENDENTE')
  RETURNING id INTO v_designer_id;

  UPDATE public.users
  SET status = 'ATIVO',
      approved_at = NOW(),
      approved_by = p_admin_id
  WHERE id = v_designer_id;

  RETURN jsonb_build_object(
    'id', v_designer_id,
    'nome', v_nome,
    'email', v_email,
    'status', 'ATIVO'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_designer(
  p_admin_id UUID,
  p_admin_password TEXT,
  p_designer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_designer_name TEXT;
  v_designer_email TEXT;
  v_client_count INTEGER := 0;
  v_project_count INTEGER := 0;
  v_appointment_count INTEGER := 0;
  v_commission_count INTEGER := 0;
  v_note_count INTEGER := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_admin_id
      AND role::TEXT = 'ADMIN'
      AND status = 'ATIVO'
      AND password = p_admin_password
  ) THEN
    RAISE EXCEPTION 'Senha do administrador incorreta.';
  END IF;

  SELECT nome, email
  INTO v_designer_name, v_designer_email
  FROM public.users
  WHERE id = p_designer_id
    AND role::TEXT = 'PROJETISTA'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projetista não encontrada ou já removida.';
  END IF;

  SELECT COUNT(*) INTO v_client_count
  FROM public.clientes
  WHERE projetista_id = p_designer_id;

  SELECT COUNT(DISTINCT p.id) INTO v_project_count
  FROM public.projetos p
  WHERE p.projetista_id = p_designer_id
     OR EXISTS (
       SELECT 1
       FROM public.clientes c
       WHERE c.id = p.cliente_id
         AND c.projetista_id = p_designer_id
     );

  SELECT COUNT(*) INTO v_appointment_count
  FROM public.agendamentos a
  WHERE a.criado_por = p_designer_id
     OR EXISTS (
       SELECT 1
       FROM public.clientes c
       WHERE c.id = a.cliente_id
         AND c.projetista_id = p_designer_id
     );

  SELECT COUNT(*) INTO v_commission_count
  FROM public.comissoes c
  WHERE c.projetista_id = p_designer_id
     OR EXISTS (
       SELECT 1
       FROM public.projetos p
       WHERE p.id = c.projeto_id
         AND (
           p.projetista_id = p_designer_id
           OR EXISTS (
             SELECT 1
             FROM public.clientes cl
             WHERE cl.id = p.cliente_id
               AND cl.projetista_id = p_designer_id
           )
         )
     );

  DELETE FROM public.agendamentos a
  WHERE a.criado_por = p_designer_id
     OR EXISTS (
       SELECT 1
       FROM public.clientes c
       WHERE c.id = a.cliente_id
         AND c.projetista_id = p_designer_id
     );

  IF TO_REGCLASS('public.anotacoes_projeto') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.anotacoes_projeto WHERE autor_id = $1'
      USING p_designer_id;
    GET DIAGNOSTICS v_note_count = ROW_COUNT;
  END IF;

  DELETE FROM public.projetos p
  WHERE p.projetista_id = p_designer_id
     OR EXISTS (
       SELECT 1
       FROM public.clientes c
       WHERE c.id = p.cliente_id
         AND c.projetista_id = p_designer_id
     );

  DELETE FROM public.clientes
  WHERE projetista_id = p_designer_id;

  DELETE FROM public.users
  WHERE id = p_designer_id
    AND role::TEXT = 'PROJETISTA';

  RETURN jsonb_build_object(
    'designer_name', v_designer_name,
    'designer_email', v_designer_email,
    'deleted_clients', v_client_count,
    'deleted_projects', v_project_count,
    'deleted_appointments', v_appointment_count,
    'deleted_commissions', v_commission_count,
    'deleted_notes', v_note_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_designer(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_designer(UUID, TEXT, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_create_designer(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_designer(UUID, TEXT, UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
