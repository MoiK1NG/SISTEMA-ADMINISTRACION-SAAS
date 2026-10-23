-- ─────────────────────────────────────────────────────────────────────────────
-- NEGOCIOS · Alta desde el panel admin y límites de usuarios por plan
-- Ejecutar en: Supabase → SQL Editor. Requiere farmacia_fase5_multimoneda.sql.
-- Idempotente: se puede correr más de una vez.
--
-- Qué resuelve (reunión del 21 de octubre):
--   1. Límite de regentes y cajeros por negocio, configurable en cada plan de
--      membresía (NULL = sin límite). Lo aplica un trigger en
--      miembros_negocio, así vale por cualquier camino: el dueño agregando
--      gente, un cambio de rol, el alta desde el panel o un INSERT directo.
--      El dueño no tiene límite. Quien ya está en el equipo no se toca: el
--      límite solo frena altas y cambios de rol nuevos.
--   2. alta_negocio_farmacia: un admin crea el negocio con su moneda e IVA y
--      deja al dueño listo (miembro, cuenta aprobada, acceso al portal) desde
--      el panel, sin pasar por el SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Límites en los planes ─────────────────────────────────────────────────
-- Los valores iniciales (2 regentes, 3 cajeros) se ponen solo la primera vez,
-- para no pisar lo que después se edite en Admin → Planes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'membership_plans' AND column_name = 'max_cajeros'
  ) THEN
    ALTER TABLE public.membership_plans
      ADD COLUMN max_regentes INTEGER CHECK (max_regentes >= 0),
      ADD COLUMN max_cajeros  INTEGER CHECK (max_cajeros  >= 0);
    UPDATE public.membership_plans SET max_regentes = 2, max_cajeros = 3;
  END IF;
END $$;

-- ── 2. Límite vigente de un negocio ──────────────────────────────────────────
-- Sale del plan de la membresía vigente del dueño (la que heredan regente y
-- cajeros). Sin membresía vigente no hay límite que aplicar: el portal ya
-- está bloqueado por tiene_membresia_vigente.
CREATE OR REPLACE FUNCTION public.limites_equipo(p_negocio UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE
  v_plan RECORD;
BEGIN
  -- auth.uid() es NULL dentro del trigger llamado por el SQL Editor
  IF auth.uid() IS NOT NULL AND NOT (public.es_miembro(p_negocio) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  SELECT p.name, p.max_regentes, p.max_cajeros INTO v_plan
  FROM public.miembros_negocio d
  JOIN public.memberships m
    ON m.user_id = d.user_id
   AND m.status = 'active'
   AND m.start_date <= CURRENT_DATE
   AND m.end_date   >= CURRENT_DATE
  JOIN public.membership_plans p ON p.id = m.plan_id
  WHERE d.negocio_id = p_negocio AND d.rol = 'dueno'
  ORDER BY m.end_date DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'plan',    v_plan.name,
    'regente', v_plan.max_regentes,
    'cajero',  v_plan.max_cajeros
  );
END;
$$;

REVOKE ALL ON FUNCTION public.limites_equipo(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.limites_equipo(UUID) TO authenticated;

-- ── 3. El trigger que aplica el límite ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validar_limite_equipo()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limite INTEGER;
  v_actual INTEGER;
BEGIN
  IF NEW.rol = 'dueno' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.rol = NEW.rol AND OLD.negocio_id = NEW.negocio_id THEN RETURN NEW; END IF;

  -- Dos altas al mismo tiempo no pueden pasarse del límite entre las dos
  PERFORM pg_advisory_xact_lock(hashtext('equipo:' || NEW.negocio_id::text));

  v_limite := (public.limites_equipo(NEW.negocio_id) ->> NEW.rol)::integer;
  IF v_limite IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_actual
  FROM public.miembros_negocio
  WHERE negocio_id = NEW.negocio_id AND rol = NEW.rol AND id <> NEW.id;

  IF v_actual >= v_limite THEN
    RAISE EXCEPTION 'Tu plan permite hasta % %. Para sumar más, cambia de plan o quita a alguien del equipo.',
      v_limite,
      CASE WHEN NEW.rol = 'cajero'
           THEN CASE WHEN v_limite = 1 THEN 'cajero' ELSE 'cajeros' END
           ELSE CASE WHEN v_limite = 1 THEN 'regente' ELSE 'regentes' END END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_miembros_negocio_limite ON public.miembros_negocio;
CREATE TRIGGER trg_miembros_negocio_limite
  BEFORE INSERT OR UPDATE OF rol, negocio_id ON public.miembros_negocio
  FOR EACH ROW EXECUTE FUNCTION public.validar_limite_equipo();

-- ── 4. Alta de un negocio desde el panel admin ───────────────────────────────
-- El dueño ya tiene que tener cuenta (el panel la crea antes con contraseña
-- inicial, o se elige una existente). Una cuenta pertenece a un solo negocio:
-- el portal resuelve "mi negocio" por usuario.
CREATE OR REPLACE FUNCTION public.alta_negocio_farmacia(
  p_dueno  UUID,
  p_nombre TEXT,
  p_moneda TEXT,
  p_iva    NUMERIC
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio UUID;
  v_portal  UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo un administrador puede dar de alta negocios'; END IF;
  IF p_nombre IS NULL OR length(trim(p_nombre)) < 2 THEN RAISE EXCEPTION 'Indica el nombre del negocio'; END IF;
  IF p_moneda NOT IN ('COP', 'CLP') THEN RAISE EXCEPTION 'Moneda inválida'; END IF;
  IF p_iva IS NULL OR p_iva < 0 OR p_iva > 100 THEN RAISE EXCEPTION 'IVA inválido'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_dueno) THEN
    RAISE EXCEPTION 'La cuenta del dueño no existe';
  END IF;
  IF EXISTS (SELECT 1 FROM public.miembros_negocio WHERE user_id = p_dueno) THEN
    RAISE EXCEPTION 'Esa cuenta ya pertenece a otro negocio';
  END IF;

  INSERT INTO public.negocios (nombre, moneda, iva_pct_default)
  VALUES (trim(p_nombre), p_moneda, p_iva)
  RETURNING id INTO v_negocio;

  INSERT INTO public.miembros_negocio (negocio_id, user_id, rol)
  VALUES (v_negocio, p_dueno, 'dueno');

  UPDATE public.profiles
  SET is_approved = TRUE, is_active = TRUE
  WHERE id = p_dueno AND (NOT is_approved OR NOT is_active);

  SELECT id INTO v_portal FROM public.portals WHERE slug = 'farmacia';
  IF v_portal IS NOT NULL THEN
    INSERT INTO public.user_portal_access (user_id, portal_id, granted_by)
    VALUES (p_dueno, v_portal, auth.uid())
    ON CONFLICT (user_id, portal_id) DO NOTHING;
  END IF;

  RETURN v_negocio;
END;
$$;

REVOKE ALL ON FUNCTION public.alta_negocio_farmacia(UUID, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alta_negocio_farmacia(UUID, TEXT, TEXT, NUMERIC) TO authenticated;

-- ── Verificación ─────────────────────────────────────────────────────────────
-- Debe devolver cada plan con sus límites y trigger_limite = true.
SELECT name AS plan, max_regentes, max_cajeros,
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_miembros_negocio_limite') AS trigger_limite
FROM public.membership_plans
ORDER BY price;
