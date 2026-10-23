-- ─────────────────────────────────────────────────────────────────────────────
-- FARMACIA · Logo y color del negocio, suspender gente del equipo
-- Ejecutar en: Supabase → SQL Editor.
-- Requiere: farmacia_fase5_multimoneda.sql.
-- Idempotente: se puede correr más de una vez.
--
-- Qué resuelve (reunión del 21 de octubre):
--   1. Cada negocio puede tener su logo y un color de una paleta cerrada (con
--      contraste suficiente para texto blanco). Sin color = azul LOMS 360.
--      El logo vive en el bucket público "logos-negocios"; lo sube el
--      servidor con la service role después de verificar que es el dueño.
--   2. El dueño puede SUSPENDER a un regente o cajero sin quitarlo del
--      equipo: deja de ver datos al instante (RLS) y el portal lo frena en su
--      siguiente clic (ya no hereda la membresía del dueño). Al dueño no se le
--      puede suspender.
--   3. equipo_negocio devuelve además el último acceso, el último cierre de
--      caja y si la persona está suspendida.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Marca del negocio ─────────────────────────────────────────────────────
ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS color    TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'negocios_color_check') THEN
    ALTER TABLE public.negocios ADD CONSTRAINT negocios_color_check CHECK (
      color IS NULL OR color IN ('#0F766E', '#15803D', '#B45309', '#B91C1C', '#BE185D', '#7E22CE', '#1D4ED8', '#334155')
    );
  END IF;
END $$;

-- Bucket público de solo lectura: las escrituras las hace el servidor con la
-- service role, así que no hacen falta políticas de INSERT/UPDATE en storage.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('logos-negocios', 'logos-negocios', true, 512000, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ── 2. Suspender sin quitar ──────────────────────────────────────────────────
ALTER TABLE public.miembros_negocio
  ADD COLUMN IF NOT EXISTS suspendido BOOLEAN NOT NULL DEFAULT false;

-- Helpers: cuerpos vigentes (fase 0 y fase 1) + "y no está suspendido".
-- es_dueno no cambia: a un dueño no se lo puede suspender.
CREATE OR REPLACE FUNCTION public.es_miembro(p_negocio UUID)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.miembros_negocio
    WHERE negocio_id = p_negocio AND user_id = auth.uid() AND NOT suspendido
  );
$$;

CREATE OR REPLACE FUNCTION public.es_gestor(p_negocio UUID)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.miembros_negocio
    WHERE negocio_id = p_negocio
      AND user_id = auth.uid()
      AND rol IN ('dueno', 'regente')
      AND NOT suspendido
  );
$$;

CREATE OR REPLACE FUNCTION public.rol_en_negocio(p_negocio UUID)
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT rol FROM public.miembros_negocio
  WHERE negocio_id = p_negocio AND user_id = auth.uid() AND NOT suspendido
  LIMIT 1;
$$;

-- La membresía heredada no alcanza a quien está suspendido: el middleware
-- lo saca del portal en su siguiente clic.
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
  -- …o heredada: es miembro (no suspendido) de un negocio cuyo dueño tiene membresía vigente
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
    WHERE yo.user_id = p_user AND NOT yo.suspendido
  );
$$;

-- ¿Está suspendido en su negocio? Lo usa el middleware para explicar por qué
-- no puede entrar (en vez de "membresía vencida").
CREATE OR REPLACE FUNCTION public.estoy_suspendido()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.miembros_negocio WHERE user_id = auth.uid() AND suspendido
  );
$$;

REVOKE ALL ON FUNCTION public.estoy_suspendido() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estoy_suspendido() TO authenticated;

CREATE OR REPLACE FUNCTION public.suspender_miembro(
  p_miembro    UUID,
  p_suspendido BOOLEAN
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
    RAISE EXCEPTION 'Solo el dueño puede suspender a alguien del equipo';
  END IF;
  IF v_m.rol = 'dueno' THEN RAISE EXCEPTION 'Al dueño no se lo puede suspender'; END IF;

  UPDATE public.miembros_negocio SET suspendido = COALESCE(p_suspendido, false) WHERE id = p_miembro;
END;
$$;

REVOKE ALL ON FUNCTION public.suspender_miembro(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suspender_miembro(UUID, BOOLEAN) TO authenticated;

-- ── 3. Equipo con último acceso, último cierre y estado ──────────────────────
-- Cambian las columnas de salida: hay que borrarla y crearla de nuevo.
DROP FUNCTION IF EXISTS public.equipo_negocio(UUID);
CREATE FUNCTION public.equipo_negocio(p_negocio UUID)
RETURNS TABLE (
  miembro_id    UUID,
  user_id       UUID,
  rol           TEXT,
  nombre        TEXT,
  email         TEXT,
  aprobado      BOOLEAN,
  desde         TIMESTAMPTZ,
  suspendido    BOOLEAN,
  ultimo_acceso TIMESTAMPTZ,
  ultimo_cierre TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT m.id, m.user_id, m.rol,
         COALESCE(p.full_name, p.email) AS nombre,
         p.email, p.is_approved, m.created_at,
         m.suspendido,
         u.last_sign_in_at,
         (SELECT MAX(c.created_at) FROM public.cierres_caja_farmacia c
          WHERE c.negocio_id = m.negocio_id AND c.user_id = m.user_id)
  FROM public.miembros_negocio m
  JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN auth.users u ON u.id = m.user_id
  WHERE m.negocio_id = p_negocio
    AND (public.es_miembro(p_negocio) OR public.is_admin())
  ORDER BY CASE m.rol WHEN 'dueno' THEN 0 WHEN 'regente' THEN 1 ELSE 2 END, m.created_at;
$$;

REVOKE ALL ON FUNCTION public.equipo_negocio(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equipo_negocio(UUID) TO authenticated;

-- ── Verificación ─────────────────────────────────────────────────────────────
-- Debe devolver true en las cuatro columnas.
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name = 'negocios' AND column_name = 'logo_url')            AS columnas_marca,
  EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'logos-negocios')             AS bucket_logos,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name = 'miembros_negocio' AND column_name = 'suspendido')  AS columna_suspendido,
  pg_get_functiondef('public.es_miembro(uuid)'::regprocedure) LIKE '%suspendido%' AS es_miembro_actualizado;
