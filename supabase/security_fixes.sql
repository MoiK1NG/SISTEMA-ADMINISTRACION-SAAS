-- =============================================================================
-- SECURITY FIXES — hallazgos de la auditoría (agosto 2026)
-- Ejecutar en: Supabase → SQL Editor, ANTES de (re)ejecutar los schemas de portal.
--
-- Orden recomendado en una BD existente:
--   1. Este archivo
--   2. Re-ejecutar los schemas corregidos: prestamos_schema.sql,
--      canchas_schema.sql, cobros_schema.sql, panaderia_schema.sql,
--      restaurante_schema.sql (todos idempotentes)
--
-- Cubre:
--   C2  Vistas KPI corrían como owner (postgres) y saltaban RLS → security_invoker
--   M1  Policies de profiles auto-referenciales → recursión 42P17 → is_admin()
--   M2  Un admin podía autopromoverse a superadmin vía PostgREST → trigger
--   M3  memberships.status vs is_active desincronizados → columna generada
--   +   handle_new_user sin search_path fijo, grants mínimos en RPCs,
--       audit_logs con admin_id forzado al autor real
--
-- Idempotente: se puede ejecutar más de una vez sin efectos secundarios.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. HELPERS (SECURITY DEFINER para evitar recursión de RLS sobre profiles)
--    is_admin(): superadmin cuenta siempre; admin solo si activo y aprobado.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (role = 'superadmin' OR (role = 'admin' AND is_active AND is_approved))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PROFILES — reemplaza las policies auto-referenciales (recursión 42P17)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Un admin no puede borrar al superadmin ni a sí mismo; el superadmin puede todo.
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE USING (
    public.is_superadmin()
    OR (public.is_admin() AND role <> 'superadmin' AND id <> auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PROFILES — bloquear escalación de rol a nivel BD
--    La policy de UPDATE no puede comparar OLD vs NEW, así que el candado del
--    campo `role` va en un trigger. auth.uid() IS NULL = acceso directo
--    (SQL Editor / service role), que sigue permitido para el setup inicial.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Solo el superadmin puede cambiar roles';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. MEMBERSHIPS — unificar status / is_active
--    El código escribe `status` (admin/actions.ts) pero lee `is_active`
--    (middleware, dashboard, admin). Se materializa is_active como columna
--    generada a partir de status: ambas quedan consistentes para siempre.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_generated text;
BEGIN
  SELECT is_generated INTO v_generated
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'memberships'
    AND column_name = 'is_active';

  -- Si existe como columna normal (potencialmente desincronizada), se recrea
  IF v_generated = 'NEVER' THEN
    ALTER TABLE public.memberships DROP COLUMN is_active;
    v_generated := NULL;
  END IF;

  IF v_generated IS NULL THEN
    ALTER TABLE public.memberships
      ADD COLUMN is_active boolean GENERATED ALWAYS AS (status = 'active') STORED;
  END IF;
END $$;

-- has_active_portal_access valida contra status (la fuente de verdad)
CREATE OR REPLACE FUNCTION public.has_active_portal_access(p_portal_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_portal_access upa
    WHERE upa.user_id = auth.uid() AND upa.portal_id = p_portal_id
  )
  AND EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id    = auth.uid()
      AND m.status     = 'active'
      AND m.start_date <= CURRENT_DATE
      AND m.end_date   >= CURRENT_DATE
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. handle_new_user — fijar search_path (SECURITY DEFINER sin path fijo
--    es vulnerable a hijacking por objetos homónimos en otros schemas)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'user',
    true,
    false
  );
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. VISTAS KPI — security_invoker (para las que ya existan en la BD)
--    Sin esto la vista corre con los privilegios del owner (postgres) y
--    devuelve los datos financieros de TODOS los agentes a cualquiera.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.kpis_agente         SET (security_invoker = true);
ALTER VIEW IF EXISTS public.kpis_cobros         SET (security_invoker = true);
ALTER VIEW IF EXISTS public.kpis_canchas_agente SET (security_invoker = true);

DO $$
BEGIN
  IF to_regclass('public.kpis_agente') IS NOT NULL THEN
    REVOKE ALL ON public.kpis_agente FROM anon;
  END IF;
  IF to_regclass('public.kpis_cobros') IS NOT NULL THEN
    REVOKE ALL ON public.kpis_cobros FROM anon;
  END IF;
  IF to_regclass('public.kpis_canchas_agente') IS NOT NULL THEN
    REVOKE ALL ON public.kpis_canchas_agente FROM anon;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RPCs — grants mínimos (para las que ya existan en la BD)
--    Nota: la versión corregida de aplicar_pago_cobro (con chequeo de dueño)
--    está en cobros_schema.sql — re-ejecutarlo después de este archivo.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regprocedure('public.aplicar_pago_cobro(uuid, numeric, date, text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.aplicar_pago_cobro(uuid, numeric, date, text) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.aplicar_pago_cobro(uuid, numeric, date, text) TO authenticated;
  END IF;

  IF to_regprocedure('public.registrar_pago(uuid, numeric, date, text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.registrar_pago(uuid, numeric, date, text) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.registrar_pago(uuid, numeric, date, text) TO authenticated;
  END IF;

  -- Solo para cron/service role: ningún usuario autenticado debe ejecutarla
  IF to_regprocedure('public.actualizar_mora()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.actualizar_mora() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. AUDIT_LOGS — sin subquery recursiva y con admin_id forzado al autor real
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "admins_read_audit_logs" ON public.audit_logs;
    CREATE POLICY "admins_read_audit_logs" ON public.audit_logs
      FOR SELECT TO authenticated USING (public.is_admin());

    DROP POLICY IF EXISTS "admins_insert_audit_logs" ON public.audit_logs;
    CREATE POLICY "admins_insert_audit_logs" ON public.audit_logs
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin() AND admin_id = auth.uid());
  END IF;
END $$;
