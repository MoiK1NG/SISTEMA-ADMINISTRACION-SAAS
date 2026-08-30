-- ─────────────────────────────────────────────────────────────────────────────
-- FARMACIA · FASE 3 — Caja ciega, cuentas por pagar y márgenes
-- Ejecutar en: Supabase → SQL Editor
-- Requiere: farmacia_fase0/1/2 ya aplicados.
-- Idempotente: se puede ejecutar más de una vez.
--
-- Reglas de rol:
--   · Cierre de caja: cualquier miembro cierra; el cajero ve SOLO sus cierres.
--   · Cuentas por pagar: dueño y regente (el regente gestiona compras).
--   · La contabilidad general (flujo, márgenes) se restringe al dueño en la
--     capa de página; acá el costo queda snapshoteado para calcularla.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Margen real: snapshot del costo en cada item vendido ──────────────────
-- Sin esto el margen histórico se falsea cuando el dueño cambia el costo.
ALTER TABLE public.items_venta_farmacia
  ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Se redefine la RPC de venta (misma firma) para guardar el costo del momento
CREATE OR REPLACE FUNCTION public.registrar_venta_farmacia(
  p_items   JSONB,
  p_pagos   JSONB,
  p_cliente UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_negocio     UUID;
  v_item        RECORD;
  v_pago        RECORD;
  v_prod        RECORD;
  v_lote        RECORD;
  v_total       NUMERIC := 0;
  v_pagado      NUMERIC := 0;
  v_no_efectivo NUMERIC := 0;
  v_vuelto      NUMERIC := 0;
  v_numero      BIGINT;
  v_venta_id    UUID;
  v_pendiente   NUMERIC;
  v_disponible  NUMERIC;
  v_tomar       NUMERIC;
BEGIN
  SELECT negocio_id INTO v_negocio FROM public.miembros_negocio
  WHERE user_id = auth.uid() LIMIT 1;
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No perteneces a ningún negocio'; END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta debe tener al menos un producto';
  END IF;
  IF p_pagos IS NULL OR jsonb_typeof(p_pagos) <> 'array' OR jsonb_array_length(p_pagos) = 0 THEN
    RAISE EXCEPTION 'Falta el pago';
  END IF;

  IF p_cliente IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clientes_farmacia WHERE id = p_cliente AND negocio_id = v_negocio
  ) THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(producto_id UUID, cantidad NUMERIC)
  LOOP
    IF v_item.producto_id IS NULL OR v_item.cantidad IS NULL OR v_item.cantidad <= 0 THEN
      RAISE EXCEPTION 'Item inválido en la venta';
    END IF;

    SELECT id, nombre, concentracion, precio_venta INTO v_prod
    FROM public.productos_farmacia
    WHERE id = v_item.producto_id AND negocio_id = v_negocio AND activo;
    IF NOT FOUND THEN RAISE EXCEPTION 'Producto no encontrado o inactivo'; END IF;

    SELECT COALESCE(SUM(cantidad_venta), 0) INTO v_disponible
    FROM public.lotes_farmacia
    WHERE producto_id = v_item.producto_id AND fecha_vencimiento >= CURRENT_DATE;

    IF v_disponible < v_item.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente de "%" (hay % en venta sin vencer)', v_prod.nombre, v_disponible;
    END IF;

    v_total := v_total + ROUND(v_prod.precio_venta * v_item.cantidad, 2);
  END LOOP;

  IF v_total <= 0 THEN RAISE EXCEPTION 'El total debe ser mayor a cero'; END IF;

  FOR v_pago IN SELECT * FROM jsonb_to_recordset(p_pagos) AS x(metodo TEXT, monto NUMERIC)
  LOOP
    IF v_pago.metodo NOT IN ('efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia') THEN
      RAISE EXCEPTION 'Método de pago inválido';
    END IF;
    IF v_pago.monto IS NULL OR v_pago.monto <= 0 THEN
      RAISE EXCEPTION 'Cada pago debe ser mayor a cero';
    END IF;
    v_pagado := v_pagado + v_pago.monto;
    IF v_pago.metodo <> 'efectivo' THEN
      v_no_efectivo := v_no_efectivo + v_pago.monto;
    END IF;
  END LOOP;

  IF v_no_efectivo > v_total THEN
    RAISE EXCEPTION 'Los pagos electrónicos (%) superan el total (%)', v_no_efectivo, v_total;
  END IF;
  IF v_pagado < v_total THEN
    RAISE EXCEPTION 'El pago (%) no cubre el total (%)', v_pagado, v_total;
  END IF;
  v_vuelto := v_pagado - v_total;

  PERFORM pg_advisory_xact_lock(hashtext('venta_farmacia:' || v_negocio::text));
  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
  FROM public.ventas_farmacia WHERE negocio_id = v_negocio;

  INSERT INTO public.ventas_farmacia (negocio_id, numero, cliente_id, user_id, total)
  VALUES (v_negocio, v_numero, p_cliente, auth.uid(), v_total)
  RETURNING id INTO v_venta_id;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(producto_id UUID, cantidad NUMERIC)
  LOOP
    SELECT nombre, concentracion, precio_venta, costo INTO v_prod
    FROM public.productos_farmacia WHERE id = v_item.producto_id;

    INSERT INTO public.items_venta_farmacia
      (venta_id, producto_id, nombre, cantidad, precio_unitario, costo_unitario)
    VALUES (
      v_venta_id, v_item.producto_id,
      v_prod.nombre || COALESCE(' ' || v_prod.concentracion, ''),
      v_item.cantidad, v_prod.precio_venta, COALESCE(v_prod.costo, 0)
    );

    v_pendiente := v_item.cantidad;
    FOR v_lote IN
      SELECT id, cantidad_venta FROM public.lotes_farmacia
      WHERE producto_id = v_item.producto_id
        AND cantidad_venta > 0
        AND fecha_vencimiento >= CURRENT_DATE
      ORDER BY fecha_vencimiento ASC, created_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_pendiente <= 0;
      v_tomar := LEAST(v_lote.cantidad_venta, v_pendiente);

      UPDATE public.lotes_farmacia
      SET cantidad_venta = cantidad_venta - v_tomar
      WHERE id = v_lote.id;

      INSERT INTO public.movimientos_farmacia
        (negocio_id, producto_id, lote_id, tipo, cantidad, motivo, user_id, venta_id)
      VALUES
        (v_negocio, v_item.producto_id, v_lote.id, 'salida_venta', v_tomar,
         'Venta #' || v_numero, auth.uid(), v_venta_id);

      v_pendiente := v_pendiente - v_tomar;
    END LOOP;

    IF v_pendiente > 0 THEN
      RAISE EXCEPTION 'El stock de "%" cambió durante la venta. Intenta de nuevo.', v_prod.nombre;
    END IF;
  END LOOP;

  FOR v_pago IN SELECT * FROM jsonb_to_recordset(p_pagos) AS x(metodo TEXT, monto NUMERIC)
  LOOP
    INSERT INTO public.pagos_venta_farmacia (venta_id, metodo, monto)
    VALUES (v_venta_id, v_pago.metodo, v_pago.monto);
  END LOOP;

  RETURN jsonb_build_object(
    'venta_id', v_venta_id, 'numero', v_numero, 'total', v_total, 'vuelto', v_vuelto
  );
END;
$$;

-- ── 2. Cierres de caja (ciegos) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cierres_caja_farmacia (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id    UUID        NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- quién cerró
  periodo_desde TIMESTAMPTZ NOT NULL,
  periodo_hasta TIMESTAMPTZ NOT NULL,
  declarado     JSONB       NOT NULL,   -- lo que el cajero contó, por método
  esperado      JSONB       NOT NULL,   -- lo que el sistema calculó, por método
  diferencia    JSONB       NOT NULL,   -- declarado - esperado, por método + total
  num_ventas    INTEGER     NOT NULL DEFAULT 0,
  notas         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cierres_caja_negocio ON public.cierres_caja_farmacia(negocio_id, created_at DESC);

-- RPC: cierre CIEGO — el cajero declara sin ver lo esperado; el server calcula
-- y guarda ambos. Cubre desde el cierre anterior hasta ahora.
CREATE OR REPLACE FUNCTION public.cerrar_caja_farmacia(
  p_declarado JSONB,      -- {"efectivo": n, "tarjeta_debito": n, "tarjeta_credito": n, "transferencia": n}
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
BEGIN
  SELECT negocio_id INTO v_negocio FROM public.miembros_negocio
  WHERE user_id = auth.uid() LIMIT 1;
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No perteneces a ningún negocio'; END IF;

  -- Un cierre a la vez por negocio
  PERFORM pg_advisory_xact_lock(hashtext('cierre_caja:' || v_negocio::text));

  SELECT COALESCE(MAX(periodo_hasta), '-infinity'::timestamptz) INTO v_desde
  FROM public.cierres_caja_farmacia WHERE negocio_id = v_negocio;

  -- Esperado por método: pagos de ventas completadas del período.
  -- Al efectivo se le descuenta el vuelto entregado (pagado - total de la venta).
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
  pedidos_periodo AS (
    SELECT COALESCE(SUM(monto_pagado) FILTER (WHERE metodo_pago = 'efectivo'), 0)        AS efectivo,
           COALESCE(SUM(monto_pagado) FILTER (WHERE metodo_pago = 'tarjeta_debito'), 0)  AS debito,
           COALESCE(SUM(monto_pagado) FILTER (WHERE metodo_pago = 'tarjeta_credito'), 0) AS credito,
           COALESCE(SUM(monto_pagado) FILTER (WHERE metodo_pago = 'transferencia'), 0)   AS transf
    FROM public.pedidos_farmacia
    WHERE negocio_id = v_negocio
      AND estado <> 'cancelado'
      AND monto_pagado > 0
      AND created_at > v_desde AND created_at <= v_hasta
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

  -- Normalizar lo declarado (faltantes = 0, nada negativo)
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
    (negocio_id, user_id, periodo_desde, periodo_hasta, declarado, esperado, diferencia, num_ventas, notas)
  VALUES
    (v_negocio, auth.uid(), v_desde, v_hasta, v_dec, v_esp, v_dif, v_ventas,
     NULLIF(trim(COALESCE(p_notas, '')), ''))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'cierre_id', v_id, 'esperado', v_esp, 'declarado', v_dec,
    'diferencia', v_dif, 'num_ventas', v_ventas
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cerrar_caja_farmacia(JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cerrar_caja_farmacia(JSONB, TEXT) TO authenticated;

-- ── 3. Cuentas por pagar (compras a proveedores) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.cuentas_pagar_farmacia (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id        UUID        NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  proveedor_id      UUID        REFERENCES public.proveedores_farmacia(id) ON DELETE SET NULL,
  concepto          TEXT        NOT NULL,
  monto_total       NUMERIC(12,2) NOT NULL CHECK (monto_total > 0),
  monto_pagado      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monto_pagado >= 0),
  fecha_vencimiento DATE,
  estado            TEXT        NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente', 'parcial', 'pagada', 'anulada')),
  notas             TEXT,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cxp_farmacia_negocio ON public.cuentas_pagar_farmacia(negocio_id, estado, fecha_vencimiento);

DROP TRIGGER IF EXISTS trg_cxp_farmacia_updated ON public.cuentas_pagar_farmacia;
CREATE TRIGGER trg_cxp_farmacia_updated
  BEFORE UPDATE ON public.cuentas_pagar_farmacia
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.abonos_cxp_farmacia (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  cuenta_id  UUID        NOT NULL REFERENCES public.cuentas_pagar_farmacia(id) ON DELETE CASCADE,
  monto      NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  metodo     TEXT        CHECK (metodo IN ('efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia')),
  nota       TEXT,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abonos_cxp_cuenta ON public.abonos_cxp_farmacia(cuenta_id);

-- RPC: abonar a una cuenta (atómico, sin sobrepago)
CREATE OR REPLACE FUNCTION public.abonar_cxp_farmacia(
  p_cuenta UUID,
  p_monto  NUMERIC,
  p_metodo TEXT DEFAULT NULL,
  p_nota   TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_c RECORD;
BEGIN
  SELECT * INTO v_c FROM public.cuentas_pagar_farmacia WHERE id = p_cuenta FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta no encontrada'; END IF;
  IF NOT (public.es_gestor(v_c.negocio_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Solo dueño o regente gestionan las cuentas por pagar';
  END IF;
  IF v_c.estado IN ('pagada', 'anulada') THEN
    RAISE EXCEPTION 'La cuenta ya está %', v_c.estado;
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN RAISE EXCEPTION 'El abono debe ser mayor a cero'; END IF;
  IF v_c.monto_pagado + p_monto > v_c.monto_total THEN
    RAISE EXCEPTION 'El abono supera el saldo (debe %)', v_c.monto_total - v_c.monto_pagado;
  END IF;
  IF p_metodo IS NOT NULL AND p_metodo NOT IN ('efectivo','tarjeta_debito','tarjeta_credito','transferencia') THEN
    RAISE EXCEPTION 'Método inválido';
  END IF;

  INSERT INTO public.abonos_cxp_farmacia (cuenta_id, monto, metodo, nota, user_id)
  VALUES (p_cuenta, p_monto, p_metodo, NULLIF(trim(COALESCE(p_nota, '')), ''), auth.uid());

  UPDATE public.cuentas_pagar_farmacia SET
    monto_pagado = monto_pagado + p_monto,
    estado = CASE WHEN monto_pagado + p_monto >= monto_total THEN 'pagada' ELSE 'parcial' END
  WHERE id = p_cuenta;
END;
$$;

REVOKE ALL ON FUNCTION public.abonar_cxp_farmacia(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abonar_cxp_farmacia(UUID, NUMERIC, TEXT, TEXT) TO authenticated;

-- ── 4. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.cierres_caja_farmacia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuentas_pagar_farmacia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abonos_cxp_farmacia    ENABLE ROW LEVEL SECURITY;

-- Cierres: el cajero ve SOLO los suyos; dueño/regente ven todos.
-- Sin UPDATE/DELETE: un cierre no se corrige, se hace otro.
DROP POLICY IF EXISTS "cierre_select" ON public.cierres_caja_farmacia;
CREATE POLICY "cierre_select" ON public.cierres_caja_farmacia
  FOR SELECT TO authenticated
  USING (
    public.es_gestor(negocio_id) OR user_id = auth.uid() OR public.is_admin()
  );
DROP POLICY IF EXISTS "cierre_insert" ON public.cierres_caja_farmacia;
CREATE POLICY "cierre_insert" ON public.cierres_caja_farmacia
  FOR INSERT TO authenticated
  WITH CHECK ((public.es_miembro(negocio_id) AND user_id = auth.uid()) OR public.is_admin());

-- CxP: solo gestores (el regente maneja compras; el cajero no las ve)
DROP POLICY IF EXISTS "cxp_all" ON public.cuentas_pagar_farmacia;
CREATE POLICY "cxp_all" ON public.cuentas_pagar_farmacia
  FOR ALL TO authenticated
  USING      (public.es_gestor(negocio_id) OR public.is_admin())
  WITH CHECK ((public.es_gestor(negocio_id) AND user_id = auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "abono_select" ON public.abonos_cxp_farmacia;
CREATE POLICY "abono_select" ON public.abonos_cxp_farmacia
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cuentas_pagar_farmacia c
    WHERE c.id = cuenta_id AND (public.es_gestor(c.negocio_id) OR public.is_admin())
  ));
DROP POLICY IF EXISTS "abono_insert" ON public.abonos_cxp_farmacia;
CREATE POLICY "abono_insert" ON public.abonos_cxp_farmacia
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cuentas_pagar_farmacia c
    WHERE c.id = cuenta_id AND (public.es_gestor(c.negocio_id) OR public.is_admin())
  ));

-- ── 5. Verificación ───────────────────────────────────────────────────────────
SELECT tablename,
       CASE WHEN rowsecurity THEN '✅ RLS' ELSE '❌ SIN RLS' END AS seguridad
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('cierres_caja_farmacia','cuentas_pagar_farmacia','abonos_cxp_farmacia')
ORDER BY tablename;
