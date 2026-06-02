-- =============================================================================
-- RLS POLICIES: tenant_data
-- =============================================================================
-- Propósito: Solo el dueño de la fila (user_id = auth.uid()) o un admin/superadmin
--            global puede leer, insertar, actualizar o eliminar datos de un tenant.
--
-- Ejecutar en: Supabase SQL Editor
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. CREAR TABLA tenant_data
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_data (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  portal_id   uuid NOT NULL REFERENCES public.portals(id)  ON DELETE CASCADE,
  key         text NOT NULL,          -- nombre del campo/registro
  value       jsonb,                  -- datos flexibles por portal
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_tenant_data_user_id   ON public.tenant_data(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_data_portal_id ON public.tenant_data(portal_id);
CREATE INDEX IF NOT EXISTS idx_tenant_data_user_portal
  ON public.tenant_data(user_id, portal_id);


-- -----------------------------------------------------------------------------
-- 2. ACTIVAR ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.tenant_data ENABLE ROW LEVEL SECURITY;

-- Revocar acceso público por defecto (defensa en profundidad)
REVOKE ALL ON public.tenant_data FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_data TO authenticated;


-- -----------------------------------------------------------------------------
-- 3. FUNCIÓN HELPER: is_admin()
-- Verifica si el usuario autenticado tiene rol admin o superadmin en profiles.
-- Se define como SECURITY DEFINER para que pueda leer profiles sin RLS circular.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id   = auth.uid()
      AND role IN ('admin', 'superadmin')
      AND is_active   = true
      AND is_approved = true
  );
$$;


-- -----------------------------------------------------------------------------
-- 4. FUNCIÓN HELPER: has_active_portal_access(p_portal_id uuid)
-- Verifica que el usuario tenga acceso al portal Y una membresía activa y vigente.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_active_portal_access(p_portal_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_portal_access upa
    -- El usuario debe tener el portal asignado
    WHERE upa.user_id   = auth.uid()
      AND upa.portal_id = p_portal_id
  )
  AND EXISTS (
    SELECT 1
    FROM public.memberships m
    -- El usuario debe tener membresía activa y no expirada
    WHERE m.user_id    = auth.uid()
      AND m.is_active  = true
      AND m.start_date <= CURRENT_DATE
      AND m.end_date   >= CURRENT_DATE
  );
$$;


-- =============================================================================
-- 5. POLÍTICAS RLS
-- =============================================================================

-- ── SELECT ──────────────────────────────────────────────────────────────────
-- Puede leer si:
--   (a) es el dueño de la fila y tiene acceso activo al portal, O
--   (b) es admin/superadmin
DROP POLICY IF EXISTS "tenant_data_select" ON public.tenant_data;
CREATE POLICY "tenant_data_select"
  ON public.tenant_data
  FOR SELECT
  TO authenticated
  USING (
    (user_id = auth.uid() AND public.has_active_portal_access(portal_id))
    OR public.is_admin()
  );


-- ── INSERT ──────────────────────────────────────────────────────────────────
-- Solo puede insertar en su propio user_id y con acceso activo al portal.
-- Admin también puede insertar (ej. migración de datos).
DROP POLICY IF EXISTS "tenant_data_insert" ON public.tenant_data;
CREATE POLICY "tenant_data_insert"
  ON public.tenant_data
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND public.has_active_portal_access(portal_id))
    OR public.is_admin()
  );


-- ── UPDATE ──────────────────────────────────────────────────────────────────
-- Igual que SELECT: dueño con acceso vigente, o admin.
DROP POLICY IF EXISTS "tenant_data_update" ON public.tenant_data;
CREATE POLICY "tenant_data_update"
  ON public.tenant_data
  FOR UPDATE
  TO authenticated
  USING (
    (user_id = auth.uid() AND public.has_active_portal_access(portal_id))
    OR public.is_admin()
  )
  WITH CHECK (
    -- Impedir que el usuario cambie el user_id a otro (escalación)
    (user_id = auth.uid() AND public.has_active_portal_access(portal_id))
    OR public.is_admin()
  );


-- ── DELETE ──────────────────────────────────────────────────────────────────
-- Solo admin puede eliminar (el usuario no puede borrar su propia data
-- para evitar pérdidas accidentales; ajusta si tu negocio lo requiere).
DROP POLICY IF EXISTS "tenant_data_delete" ON public.tenant_data;
CREATE POLICY "tenant_data_delete"
  ON public.tenant_data
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
  );


-- =============================================================================
-- 6. TRIGGER: updated_at automático
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_data_updated_at ON public.tenant_data;
CREATE TRIGGER trg_tenant_data_updated_at
  BEFORE UPDATE ON public.tenant_data
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- 7. VERIFICACIÓN RÁPIDA (opcional, ejecutar manualmente para confirmar)
-- =============================================================================
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM   pg_policies
-- WHERE  tablename = 'tenant_data'
-- ORDER  BY cmd;
