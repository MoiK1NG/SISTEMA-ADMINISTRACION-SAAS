-- ─────────────────────────────────────────────────────────────────────────────
-- MANTENIMIENTO DIARIO · mantiene despierta la base y hace tareas útiles
-- Ejecutar en: Supabase → SQL Editor. Idempotente: se puede correr varias veces.
--
-- Por qué: en el plan gratuito, Supabase pausa el proyecto tras 1 semana sin
-- actividad. Una tarea programada de Vercel (vercel.json → /api/cron/diario)
-- llama una vez por día a ejecutar_mantenimiento_diario(), que además:
--   1. Marca como 'expired' las membresías activas cuya fecha de fin ya pasó
--      (el acceso ya se cortaba por fecha; ahora el estado también lo dice).
--   2. Calcula, por negocio, las alertas de farmacia: lotes vencidos, por
--      vencer (≤ 90 días) y sin fecha; pacientes crónicos a ≤ 3 días de quedarse
--      sin medicamento; cuentas por pagar vencidas. Mismos criterios que las
--      pantallas del portal.
--   3. Guarda cada ejecución en mantenimiento_diario, para que el panel admin
--      muestre la última y avise si la tarea dejó de correr.
--
-- Quién puede ejecutarla: la tarea programada (service_role), un admin desde el
-- panel ("Ejecutar ahora") o el SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Registro de ejecuciones ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mantenimiento_diario (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  ejecutado_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  origen              TEXT        NOT NULL CHECK (origen IN ('cron', 'manual', 'sql')),
  ejecutado_por       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,  -- admin, si fue manual
  membresias_vencidas INTEGER     NOT NULL DEFAULT 0,
  alertas             JSONB       NOT NULL DEFAULT '[]'::jsonb,   -- una entrada por negocio
  duracion_ms         INTEGER
);

CREATE INDEX IF NOT EXISTS idx_mantenimiento_diario_fecha ON public.mantenimiento_diario(ejecutado_at DESC);

ALTER TABLE public.mantenimiento_diario ENABLE ROW LEVEL SECURITY;

-- Lo leen los admins. Nadie lo escribe a mano: solo la función.
DROP POLICY IF EXISTS "admins_leen_mantenimiento" ON public.mantenimiento_diario;
CREATE POLICY "admins_leen_mantenimiento" ON public.mantenimiento_diario
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ── 2. La tarea ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ejecutar_mantenimiento_diario()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio   TIMESTAMPTZ := clock_timestamp();
  v_origen   TEXT;
  v_vencidas INTEGER;
  v_alertas  JSONB;
  v_id       UUID;
  v_fecha    TIMESTAMPTZ;
BEGIN
  -- service_role = la tarea programada; is_admin() = botón del panel;
  -- session_user postgres = SQL Editor. Cualquier otro, afuera.
  IF COALESCE(auth.role(), '') = 'service_role' THEN
    v_origen := 'cron';
  ELSIF public.is_admin() THEN
    v_origen := 'manual';
  ELSIF session_user = 'postgres' THEN
    v_origen := 'sql';
  ELSE
    RAISE EXCEPTION 'No autorizado para ejecutar el mantenimiento diario';
  END IF;

  -- 1. Membresías vencidas (extendMembership las vuelve a 'active' al renovar)
  UPDATE public.memberships
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active' AND end_date < CURRENT_DATE;
  GET DIAGNOSTICS v_vencidas = ROW_COUNT;

  -- 2. Alertas por negocio (mismos umbrales que caducidad.ts y pacientes)
  SELECT COALESCE(jsonb_agg(a ORDER BY a->>'negocio'), '[]'::jsonb) INTO v_alertas
  FROM (
    SELECT jsonb_build_object(
      'negocio_id', n.id,
      'negocio',    n.nombre,
      'lotes_vencidos', (
        SELECT COUNT(*) FROM public.lotes_farmacia l
        WHERE l.negocio_id = n.id AND l.cantidad_venta + l.cantidad_bodega > 0
          AND l.fecha_vencimiento < CURRENT_DATE),
      'lotes_por_vencer', (
        SELECT COUNT(*) FROM public.lotes_farmacia l
        WHERE l.negocio_id = n.id AND l.cantidad_venta + l.cantidad_bodega > 0
          AND l.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 90),
      'lotes_sin_fecha', (
        SELECT COUNT(*) FROM public.lotes_farmacia l
        WHERE l.negocio_id = n.id AND l.cantidad_venta + l.cantidad_bodega > 0
          AND l.fecha_vencimiento IS NULL),
      'cronicos_por_acabarse', (
        SELECT COUNT(*) FROM public.tratamientos_farmacia t
        WHERE t.negocio_id = n.id AND t.activo
          AND (t.ultima_compra + t.dias_duracion) - CURRENT_DATE <= 3),
      'cuentas_por_pagar_vencidas', (
        SELECT COUNT(*) FROM public.cuentas_pagar_farmacia c
        WHERE c.negocio_id = n.id AND c.estado IN ('pendiente', 'parcial')
          AND c.fecha_vencimiento < CURRENT_DATE)
    ) AS a
    FROM public.negocios n
  ) s;

  -- 3. Registro (y limpieza: se guardan 180 días)
  INSERT INTO public.mantenimiento_diario (origen, ejecutado_por, membresias_vencidas, alertas, duracion_ms)
  VALUES (v_origen, auth.uid(), v_vencidas, v_alertas,
          (EXTRACT(EPOCH FROM clock_timestamp() - v_inicio) * 1000)::INTEGER)
  RETURNING id, ejecutado_at INTO v_id, v_fecha;

  DELETE FROM public.mantenimiento_diario WHERE ejecutado_at < NOW() - INTERVAL '180 days';

  RETURN jsonb_build_object(
    'id',                  v_id,
    'ejecutado_at',        v_fecha,
    'origen',              v_origen,
    'membresias_vencidas', v_vencidas,
    'alertas',             v_alertas
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ejecutar_mantenimiento_diario() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ejecutar_mantenimiento_diario() TO authenticated, service_role;

-- ── 3. Primera ejecución y verificación ───────────────────────────────────────
SELECT public.ejecutar_mantenimiento_diario();
