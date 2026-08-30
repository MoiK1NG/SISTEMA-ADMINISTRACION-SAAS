-- ─────────────────────────────────────────────────────────────────────────────
-- FARMACIA · FASE 0 — Negocios con equipo y roles
-- Ejecutar en: Supabase → SQL Editor
-- Requiere: security_fixes.sql (is_admin) ya aplicado.
-- Idempotente: se puede ejecutar más de una vez.
--
-- Rompe el supuesto "1 usuario = 1 negocio": una farmacia tiene dueño,
-- regente y cajeros, personas distintas con permisos distintos sobre los
-- mismos datos. Los roles se hacen cumplir acá, en la base, no solo en la UI.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Tablas ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.negocios (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      TEXT        NOT NULL,
  tipo        TEXT        NOT NULL DEFAULT 'farmacia' CHECK (tipo IN ('farmacia')),
  nit         TEXT,
  direccion   TEXT,
  telefono    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.miembros_negocio (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id  UUID        NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol         TEXT        NOT NULL CHECK (rol IN ('dueno', 'regente', 'cajero')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (negocio_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_miembros_negocio_user    ON public.miembros_negocio(user_id);
CREATE INDEX IF NOT EXISTS idx_miembros_negocio_negocio ON public.miembros_negocio(negocio_id);

DROP TRIGGER IF EXISTS trg_negocios_updated_at ON public.negocios;
CREATE TRIGGER trg_negocios_updated_at
  BEFORE UPDATE ON public.negocios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. Helpers (SECURITY DEFINER: evitan recursión de RLS) ────────────────────
CREATE OR REPLACE FUNCTION public.es_miembro(p_negocio UUID)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.miembros_negocio
    WHERE negocio_id = p_negocio AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.es_dueno(p_negocio UUID)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.miembros_negocio
    WHERE negocio_id = p_negocio AND user_id = auth.uid() AND rol = 'dueno'
  );
$$;

CREATE OR REPLACE FUNCTION public.rol_en_negocio(p_negocio UUID)
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT rol FROM public.miembros_negocio
  WHERE negocio_id = p_negocio AND user_id = auth.uid()
  LIMIT 1;
$$;

-- La membresía la paga el DUEÑO del negocio: regente y cajeros heredan la
-- vigencia. Esta función reemplaza el chequeo "membresía propia" del
-- middleware y de las server actions.
CREATE OR REPLACE FUNCTION public.tiene_membresia_vigente(p_user UUID)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  -- Membresía propia vigente
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = p_user
      AND m.status = 'active'
      AND m.start_date <= CURRENT_DATE
      AND m.end_date   >= CURRENT_DATE
  )
  -- …o heredada: es miembro de un negocio cuyo dueño tiene membresía vigente
  OR EXISTS (
    SELECT 1
    FROM public.miembros_negocio yo
    JOIN public.miembros_negocio dueno
      ON dueno.negocio_id = yo.negocio_id AND dueno.rol = 'dueno'
    JOIN public.memberships m
      ON m.user_id = dueno.user_id
     AND m.status = 'active'
     AND m.start_date <= CURRENT_DATE
     AND m.end_date   >= CURRENT_DATE
    WHERE yo.user_id = p_user
  );
$$;

REVOKE ALL ON FUNCTION public.tiene_membresia_vigente(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tiene_membresia_vigente(UUID) TO authenticated;

-- ── 3. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.negocios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miembros_negocio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "negocios_select" ON public.negocios;
CREATE POLICY "negocios_select" ON public.negocios
  FOR SELECT TO authenticated
  USING (public.es_miembro(id) OR public.is_admin());

DROP POLICY IF EXISTS "negocios_update" ON public.negocios;
CREATE POLICY "negocios_update" ON public.negocios
  FOR UPDATE TO authenticated
  USING      (public.es_dueno(id) OR public.is_admin())
  WITH CHECK (public.es_dueno(id) OR public.is_admin());

-- Crear y borrar negocios: solo la plataforma (admin)
DROP POLICY IF EXISTS "negocios_insert" ON public.negocios;
CREATE POLICY "negocios_insert" ON public.negocios
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "negocios_delete" ON public.negocios;
CREATE POLICY "negocios_delete" ON public.negocios
  FOR DELETE TO authenticated USING (public.is_admin());

-- Miembros: todo el equipo ve quiénes son; solo el dueño gestiona.
-- Las mutaciones pasan por las funciones de la sección 4 (validan la regla
-- del último dueño), pero la RLS queda como segunda línea de defensa.
DROP POLICY IF EXISTS "miembros_select" ON public.miembros_negocio;
CREATE POLICY "miembros_select" ON public.miembros_negocio
  FOR SELECT TO authenticated
  USING (public.es_miembro(negocio_id) OR public.is_admin());

DROP POLICY IF EXISTS "miembros_insert" ON public.miembros_negocio;
CREATE POLICY "miembros_insert" ON public.miembros_negocio
  FOR INSERT TO authenticated
  WITH CHECK (public.es_dueno(negocio_id) OR public.is_admin());

DROP POLICY IF EXISTS "miembros_update" ON public.miembros_negocio;
CREATE POLICY "miembros_update" ON public.miembros_negocio
  FOR UPDATE TO authenticated
  USING      (public.es_dueno(negocio_id) OR public.is_admin())
  WITH CHECK (public.es_dueno(negocio_id) OR public.is_admin());

DROP POLICY IF EXISTS "miembros_delete" ON public.miembros_negocio;
CREATE POLICY "miembros_delete" ON public.miembros_negocio
  FOR DELETE TO authenticated
  USING (public.es_dueno(negocio_id) OR public.is_admin());

-- ── 4. Gestión del equipo (funciones con las reglas de negocio) ───────────────
-- El dueño agrega gente por email. SECURITY DEFINER porque un dueño no puede
-- leer los perfiles de otros usuarios (la RLS de profiles lo impide), pero sí
-- necesita ubicar a su empleado ya registrado.
CREATE OR REPLACE FUNCTION public.agregar_miembro_negocio(
  p_negocio UUID,
  p_email   TEXT,
  p_rol     TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perfil  RECORD;
  v_portal  UUID;
BEGIN
  IF NOT (public.es_dueno(p_negocio) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Solo el dueño puede gestionar el equipo';
  END IF;
  IF p_rol NOT IN ('dueno', 'regente', 'cajero') THEN
    RAISE EXCEPTION 'Rol inválido';
  END IF;

  SELECT id, full_name, email, is_approved INTO v_perfil
  FROM public.profiles WHERE lower(email) = lower(trim(p_email));

  IF v_perfil.id IS NULL THEN
    RAISE EXCEPTION 'No hay ninguna cuenta registrada con ese correo. La persona debe crear su cuenta en la página de registro primero.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.miembros_negocio WHERE negocio_id = p_negocio AND user_id = v_perfil.id) THEN
    RAISE EXCEPTION 'Esa persona ya es parte del equipo';
  END IF;

  INSERT INTO public.miembros_negocio (negocio_id, user_id, rol)
  VALUES (p_negocio, v_perfil.id, p_rol);

  -- Acceso al portal de farmacia (la membresía la hereda del dueño)
  SELECT id INTO v_portal FROM public.portals WHERE slug = 'farmacia';
  IF v_portal IS NOT NULL THEN
    INSERT INTO public.user_portal_access (user_id, portal_id, granted_by)
    VALUES (v_perfil.id, v_portal, auth.uid())
    ON CONFLICT (user_id, portal_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'user_id', v_perfil.id,
    'nombre',  COALESCE(v_perfil.full_name, v_perfil.email),
    'aprobado', v_perfil.is_approved
  );
END;
$$;

-- Cambiar rol, protegiendo al último dueño
CREATE OR REPLACE FUNCTION public.cambiar_rol_miembro(
  p_miembro UUID,
  p_rol     TEXT
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m RECORD;
BEGIN
  SELECT * INTO v_m FROM public.miembros_negocio WHERE id = p_miembro;
  IF NOT FOUND THEN RAISE EXCEPTION 'Miembro no encontrado'; END IF;

  IF NOT (public.es_dueno(v_m.negocio_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Solo el dueño puede gestionar el equipo';
  END IF;
  IF p_rol NOT IN ('dueno', 'regente', 'cajero') THEN
    RAISE EXCEPTION 'Rol inválido';
  END IF;

  IF v_m.rol = 'dueno' AND p_rol <> 'dueno' AND NOT EXISTS (
    SELECT 1 FROM public.miembros_negocio
    WHERE negocio_id = v_m.negocio_id AND rol = 'dueno' AND id <> p_miembro
  ) THEN
    RAISE EXCEPTION 'El negocio no puede quedarse sin dueño';
  END IF;

  UPDATE public.miembros_negocio SET rol = p_rol WHERE id = p_miembro;
END;
$$;

-- Quitar a alguien del equipo (y su acceso al portal), protegiendo al último dueño
CREATE OR REPLACE FUNCTION public.quitar_miembro_negocio(p_miembro UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m      RECORD;
  v_portal UUID;
BEGIN
  SELECT * INTO v_m FROM public.miembros_negocio WHERE id = p_miembro;
  IF NOT FOUND THEN RAISE EXCEPTION 'Miembro no encontrado'; END IF;

  IF NOT (public.es_dueno(v_m.negocio_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Solo el dueño puede gestionar el equipo';
  END IF;

  IF v_m.rol = 'dueno' AND NOT EXISTS (
    SELECT 1 FROM public.miembros_negocio
    WHERE negocio_id = v_m.negocio_id AND rol = 'dueno' AND id <> p_miembro
  ) THEN
    RAISE EXCEPTION 'El negocio no puede quedarse sin dueño';
  END IF;

  DELETE FROM public.miembros_negocio WHERE id = p_miembro;

  -- Si no pertenece a otro negocio, se le retira el acceso al portal
  IF NOT EXISTS (SELECT 1 FROM public.miembros_negocio WHERE user_id = v_m.user_id) THEN
    SELECT id INTO v_portal FROM public.portals WHERE slug = 'farmacia';
    IF v_portal IS NOT NULL THEN
      DELETE FROM public.user_portal_access
      WHERE user_id = v_m.user_id AND portal_id = v_portal;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.agregar_miembro_negocio(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cambiar_rol_miembro(UUID, TEXT)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.quitar_miembro_negocio(UUID)             FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agregar_miembro_negocio(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cambiar_rol_miembro(UUID, TEXT)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.quitar_miembro_negocio(UUID)              TO authenticated;

-- Lista del equipo con nombre y correo. SECURITY DEFINER porque la RLS de
-- profiles solo deja ver el perfil propio, pero el equipo necesita verse
-- entre sí. Solo devuelve filas si quien consulta es miembro (o admin).
CREATE OR REPLACE FUNCTION public.equipo_negocio(p_negocio UUID)
RETURNS TABLE (
  miembro_id UUID,
  user_id    UUID,
  rol        TEXT,
  nombre     TEXT,
  email      TEXT,
  aprobado   BOOLEAN,
  desde      TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT m.id, m.user_id, m.rol,
         COALESCE(p.full_name, p.email) AS nombre,
         p.email, p.is_approved, m.created_at
  FROM public.miembros_negocio m
  JOIN public.profiles p ON p.id = m.user_id
  WHERE m.negocio_id = p_negocio
    AND (public.es_miembro(p_negocio) OR public.is_admin())
  ORDER BY CASE m.rol WHEN 'dueno' THEN 0 WHEN 'regente' THEN 1 ELSE 2 END, m.created_at;
$$;

REVOKE ALL ON FUNCTION public.equipo_negocio(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equipo_negocio(UUID) TO authenticated;

-- ── 5. Setup: crear una farmacia (correr desde el SQL Editor) ─────────────────
-- Uso:  SELECT public.crear_negocio_farmacia('correo-del-dueno@x.com', 'Farmacia San Rafael');
-- El dueño debe tener su cuenta creada. Devuelve el id del negocio.
CREATE OR REPLACE FUNCTION public.crear_negocio_farmacia(
  p_email_dueno TEXT,
  p_nombre      TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dueno   UUID;
  v_negocio UUID;
  v_portal  UUID;
BEGIN
  -- Solo desde el SQL Editor (postgres) o siendo admin de la plataforma
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT id INTO v_dueno FROM public.profiles WHERE lower(email) = lower(trim(p_email_dueno));
  IF v_dueno IS NULL THEN
    RAISE EXCEPTION 'No existe una cuenta con el correo %', p_email_dueno;
  END IF;

  INSERT INTO public.negocios (nombre) VALUES (trim(p_nombre)) RETURNING id INTO v_negocio;
  INSERT INTO public.miembros_negocio (negocio_id, user_id, rol) VALUES (v_negocio, v_dueno, 'dueno');

  SELECT id INTO v_portal FROM public.portals WHERE slug = 'farmacia';
  IF v_portal IS NOT NULL THEN
    INSERT INTO public.user_portal_access (user_id, portal_id)
    VALUES (v_dueno, v_portal)
    ON CONFLICT (user_id, portal_id) DO NOTHING;
  END IF;

  RETURN v_negocio;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_negocio_farmacia(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ── 6. Catálogo: entra Farmacia, se pausa el resto ────────────────────────────
INSERT INTO public.portals (name, slug, description, url, icon, color, is_active)
VALUES (
  'Farmacia',
  'farmacia',
  'ERP completo para farmacias: inventario con lotes y vencimientos, POS con pago mixto, pedidos pendientes, equipo con roles y control regulatorio.',
  '/portal/farmacia',
  'pill',
  '#0d9488',
  TRUE
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, url = EXCLUDED.url,
  icon = EXCLUDED.icon, color = EXCLUDED.color, is_active = TRUE, updated_at = NOW();

UPDATE public.portals
SET is_active = FALSE, updated_at = NOW()
WHERE slug <> 'farmacia';

-- ── 7. Verificación ───────────────────────────────────────────────────────────
SELECT name, slug,
       CASE WHEN is_active THEN '✅ activo' ELSE '⏸ pausado' END AS estado
FROM public.portals ORDER BY is_active DESC, name;
