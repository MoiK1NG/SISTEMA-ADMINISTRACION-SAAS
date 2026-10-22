-- ─────────────────────────────────────────────────────────────────────────────
-- FARMACIA · Retiros y gastos de caja
-- Ejecutar en: Supabase → SQL Editor.
-- Requiere: farmacia_ajustes_cliente1.sql (no depende del arreglo de abonos).
-- Idempotente: se puede correr más de una vez.
--
-- Qué resuelve (reunión del 21 de octubre):
--   Durante el turno sale efectivo del cajón que no es una venta: el dueño
--   retira plata (remesa) o se paga un gasto menor (agua, aseo, un envío).
--   Hasta hoy el cierre no lo sabía y lo mostraba como faltante.
--
--   · Cualquier miembro registra un RETIRO o un GASTO (solo efectivo).
--   · El cierre resta retiros y gastos del efectivo esperado y los guarda.
--   · Un movimiento no se borra: se anula con motivo, solo mientras el turno
--     siga abierto. Lo anula quien lo hizo o un dueño/regente.
--   · El cajero ve sus movimientos; dueño y regente ven todos.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Tabla ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.movimientos_caja_farmacia (
  id             UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id     UUID          NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  tipo           TEXT          NOT NULL CHECK (tipo IN ('retiro', 'gasto')),
  monto          NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  concepto       TEXT          NOT NULL CHECK (length(trim(concepto)) > 0),
  -- Solo para gastos; un retiro no lleva categoría
  categoria      TEXT          CHECK (categoria IN ('insumos', 'aseo', 'transporte', 'propinas', 'otros')),
  user_id        UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  anulado        BOOLEAN       NOT NULL DEFAULT false,
  anulado_motivo TEXT,
  anulado_por    UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  anulado_at     TIMESTAMPTZ,
  CONSTRAINT movimiento_caja_categoria CHECK (
    (tipo = 'gasto' AND categoria IS NOT NULL) OR (tipo = 'retiro' AND categoria IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_mov_caja_negocio_fecha
  ON public.movimientos_caja_farmacia(negocio_id, created_at DESC);

ALTER TABLE public.movimientos_caja_farmacia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mov_caja_select" ON public.movimientos_caja_farmacia;
CREATE POLICY "mov_caja_select" ON public.movimientos_caja_farmacia
  FOR SELECT TO authenticated
  USING (public.es_gestor(negocio_id) OR user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "mov_caja_insert" ON public.movimientos_caja_farmacia;
CREATE POLICY "mov_caja_insert" ON public.movimientos_caja_farmacia
  FOR INSERT TO authenticated
  WITH CHECK (public.es_miembro(negocio_id) AND user_id = auth.uid() AND NOT anulado);
-- Sin UPDATE/DELETE directos: la anulación pasa por la RPC de abajo.

-- ── 2. Anular un movimiento del turno abierto ────────────────────────────────
CREATE OR REPLACE FUNCTION public.anular_movimiento_caja(
  p_id     UUID,
  p_motivo TEXT
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m           RECORD;
  v_ultimo      TIMESTAMPTZ;
BEGIN
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 3 THEN
    RAISE EXCEPTION 'Indica el motivo de la anulación';
  END IF;

  SELECT * INTO v_m FROM public.movimientos_caja_farmacia WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Movimiento no encontrado'; END IF;

  IF NOT (public.es_gestor(v_m.negocio_id)
          OR (v_m.user_id = auth.uid() AND public.es_miembro(v_m.negocio_id))) THEN
    RAISE EXCEPTION 'Solo quien lo registró, el dueño o el regente pueden anularlo';
  END IF;
  IF v_m.anulado THEN RAISE EXCEPTION 'Este movimiento ya está anulado'; END IF;

  SELECT MAX(periodo_hasta) INTO v_ultimo
  FROM public.cierres_caja_farmacia WHERE negocio_id = v_m.negocio_id;
  IF v_ultimo IS NOT NULL AND v_m.created_at <= v_ultimo THEN
    RAISE EXCEPTION 'Ese movimiento ya entró en un cierre de caja: anótalo en el próximo cierre';
  END IF;

  UPDATE public.movimientos_caja_farmacia
  SET anulado = true, anulado_motivo = trim(p_motivo),
      anulado_por = auth.uid(), anulado_at = NOW()
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.anular_movimiento_caja(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.anular_movimiento_caja(UUID, TEXT) TO authenticated;

-- ── 3. El cierre guarda retiros y gastos ─────────────────────────────────────
ALTER TABLE public.cierres_caja_farmacia
  ADD COLUMN IF NOT EXISTS retiros NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gastos  NUMERIC(12,2) NOT NULL DEFAULT 0;

-- ── 4. Cierre: efectivo esperado menos retiros y gastos ──────────────────────
-- Cuerpo vigente (farmacia_ajustes_cliente1.sql). Cambios: v_retiros/v_gastos,
-- la resta en el efectivo esperado, las dos columnas nuevas y el JSON de vuelta.
-- Misma firma: conserva los permisos.
CREATE OR REPLACE FUNCTION public.cerrar_caja_farmacia(
  p_declarado JSONB,
  p_notas     TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_negocio  UUID;
  v_desde    TIMESTAMPTZ;
  v_hasta    TIMESTAMPTZ := NOW();
  v_esp      JSONB;
  v_dec      JSONB;
  v_dif      JSONB;
  v_ventas   INTEGER;
  v_id       UUID;
  v_metodo   TEXT;
  v_esp_m    NUMERIC;
  v_dec_m    NUMERIC;
  v_dif_tot  NUMERIC := 0;
  v_retiros  NUMERIC := 0;
  v_gastos   NUMERIC := 0;
BEGIN
  SELECT negocio_id INTO v_negocio FROM public.miembros_negocio
  WHERE user_id = auth.uid() LIMIT 1;
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No perteneces a ningún negocio'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('cierre_caja:' || v_negocio::text));

  SELECT COALESCE(MAX(periodo_hasta), '-infinity'::timestamptz) INTO v_desde
  FROM public.cierres_caja_farmacia WHERE negocio_id = v_negocio;

  WITH ventas_periodo AS (
    SELECT v.id, v.total,
           COALESCE(SUM(p.monto), 0)                                        AS pagado,
           COALESCE(SUM(p.monto) FILTER (WHERE p.metodo = 'efectivo'), 0)   AS efectivo,
           COALESCE(SUM(p.monto) FILTER (WHERE p.metodo = 'tarjeta_debito'), 0)  AS debito,
           COALESCE(SUM(p.monto) FILTER (WHERE p.metodo = 'tarjeta_credito'), 0) AS credito,
           COALESCE(SUM(p.monto) FILTER (WHERE p.metodo = 'transferencia'), 0)   AS transf
    FROM public.ventas_farmacia v
    JOIN public.pagos_venta_farmacia p ON p.venta_id = v.id
    WHERE v.negocio_id = v_negocio
      AND v.estado = 'completada'
      AND v.created_at > v_desde AND v.created_at <= v_hasta
    GROUP BY v.id, v.total
  ),
  -- Pagos de encargos por la fecha en que ENTRÓ la plata (anticipo o saldo)
  pedidos_periodo AS (
    SELECT COALESCE(SUM(pg.monto) FILTER (WHERE pg.metodo = 'efectivo'), 0)        AS efectivo,
           COALESCE(SUM(pg.monto) FILTER (WHERE pg.metodo = 'tarjeta_debito'), 0)  AS debito,
           COALESCE(SUM(pg.monto) FILTER (WHERE pg.metodo = 'tarjeta_credito'), 0) AS credito,
           COALESCE(SUM(pg.monto) FILTER (WHERE pg.metodo = 'transferencia'), 0)   AS transf
    FROM public.pagos_pedido_farmacia pg
    JOIN public.pedidos_farmacia p ON p.id = pg.pedido_id
    WHERE p.negocio_id = v_negocio
      AND pg.created_at > v_desde AND pg.created_at <= v_hasta
  )
  SELECT jsonb_build_object(
           'efectivo',        ROUND(COALESCE(SUM(vp.efectivo - GREATEST(vp.pagado - vp.total, 0)), 0) + MAX(pp.efectivo), 2),
           'tarjeta_debito',  ROUND(COALESCE(SUM(vp.debito), 0)  + MAX(pp.debito), 2),
           'tarjeta_credito', ROUND(COALESCE(SUM(vp.credito), 0) + MAX(pp.credito), 2),
           'transferencia',   ROUND(COALESCE(SUM(vp.transf), 0)  + MAX(pp.transf), 2)
         ),
         COUNT(vp.id)
  INTO v_esp, v_ventas
  FROM pedidos_periodo pp
  LEFT JOIN ventas_periodo vp ON TRUE;

  -- Efectivo que salió del cajón durante el turno (sin los anulados)
  SELECT COALESCE(SUM(monto) FILTER (WHERE tipo = 'retiro'), 0),
         COALESCE(SUM(monto) FILTER (WHERE tipo = 'gasto'), 0)
  INTO v_retiros, v_gastos
  FROM public.movimientos_caja_farmacia
  WHERE negocio_id = v_negocio AND NOT anulado
    AND created_at > v_desde AND created_at <= v_hasta;

  v_esp := jsonb_set(v_esp, '{efectivo}',
    to_jsonb(ROUND((v_esp->>'efectivo')::numeric - v_retiros - v_gastos, 2)));

  v_dec := jsonb_build_object(
    'efectivo',        GREATEST(COALESCE((p_declarado->>'efectivo')::numeric, 0), 0),
    'tarjeta_debito',  GREATEST(COALESCE((p_declarado->>'tarjeta_debito')::numeric, 0), 0),
    'tarjeta_credito', GREATEST(COALESCE((p_declarado->>'tarjeta_credito')::numeric, 0), 0),
    'transferencia',   GREATEST(COALESCE((p_declarado->>'transferencia')::numeric, 0), 0)
  );

  v_dif := '{}'::jsonb;
  FOR v_metodo IN SELECT unnest(ARRAY['efectivo','tarjeta_debito','tarjeta_credito','transferencia'])
  LOOP
    v_esp_m := COALESCE((v_esp->>v_metodo)::numeric, 0);
    v_dec_m := COALESCE((v_dec->>v_metodo)::numeric, 0);
    v_dif := v_dif || jsonb_build_object(v_metodo, ROUND(v_dec_m - v_esp_m, 2));
    v_dif_tot := v_dif_tot + (v_dec_m - v_esp_m);
  END LOOP;
  v_dif := v_dif || jsonb_build_object('total', ROUND(v_dif_tot, 2));

  INSERT INTO public.cierres_caja_farmacia
    (negocio_id, user_id, periodo_desde, periodo_hasta, declarado, esperado, diferencia,
     num_ventas, notas, retiros, gastos)
  VALUES
    (v_negocio, auth.uid(), v_desde, v_hasta, v_dec, v_esp, v_dif, v_ventas,
     NULLIF(trim(COALESCE(p_notas, '')), ''), v_retiros, v_gastos)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'cierre_id', v_id, 'esperado', v_esp, 'declarado', v_dec,
    'diferencia', v_dif, 'num_ventas', v_ventas,
    'retiros', v_retiros, 'gastos', v_gastos
  );
END;
$$;

-- ── Verificación ─────────────────────────────────────────────────────────────
-- Debe devolver: la tabla con RLS, las dos columnas nuevas del cierre y el
-- cierre leyendo movimientos_caja_farmacia.
SELECT 'tabla_con_rls' AS chequeo,
       COALESCE((SELECT relrowsecurity::text FROM pg_class
                 WHERE oid = to_regclass('public.movimientos_caja_farmacia')), 'falta') AS resultado
UNION ALL
SELECT 'columnas_cierre',
       (SELECT string_agg(column_name, ', ' ORDER BY column_name) FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cierres_caja_farmacia'
          AND column_name IN ('retiros', 'gastos'))
UNION ALL
SELECT 'cierre_descuenta_movimientos',
       (pg_get_functiondef('public.cerrar_caja_farmacia(jsonb,text)'::regprocedure)
          LIKE '%movimientos_caja_farmacia%')::text;
