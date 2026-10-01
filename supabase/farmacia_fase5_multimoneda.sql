-- ─────────────────────────────────────────────────────────────────────────────
-- FARMACIA · FASE 5: moneda por negocio, IVA por producto, lotes sin fecha
--                    de vencimiento e historial de cambios de productos
-- Ejecutar en: Supabase → SQL Editor
-- Requiere: farmacia_fase0..4 y farmacia_ajustes_cliente1 ya aplicados.
-- Idempotente: se puede ejecutar más de una vez.
--
-- Qué resuelve:
--   1. LOMS 360 es colombiana pero la primera farmacia es chilena: la moneda
--      (COP / CLP) y el IVA por defecto pasan a ser DEL NEGOCIO, no globales.
--   2. El costo de cada producto se guarda NETO y el IVA aparte (iva_pct), para
--      mostrar costo con IVA, margen y utilidad reales.
--   3. La carga inicial de inventario viene sin fecha de vencimiento: los lotes
--      pueden quedar "sin fecha registrada" y el POS igual los vende (al final
--      del FEFO). La vista de stock cuenta cuántos lotes faltan completar.
--   4. Historial de cambios de productos (precio, costo, nombre, etc.) con
--      quién y cuándo — complementa el log de accesos de la ronda 1.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Moneda e IVA por defecto del negocio ───────────────────────────────────
ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS moneda          TEXT          NOT NULL DEFAULT 'COP',
  ADD COLUMN IF NOT EXISTS iva_pct_default NUMERIC(5,2)  NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'negocios_moneda_check') THEN
    ALTER TABLE public.negocios
      ADD CONSTRAINT negocios_moneda_check CHECK (moneda IN ('COP', 'CLP'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'negocios_iva_pct_default_check') THEN
    ALTER TABLE public.negocios
      ADD CONSTRAINT negocios_iva_pct_default_check CHECK (iva_pct_default >= 0 AND iva_pct_default <= 100);
  END IF;
END $$;

-- ── 2. IVA por producto (el costo queda neto) ─────────────────────────────────
ALTER TABLE public.productos_farmacia
  ADD COLUMN IF NOT EXISTS iva_pct NUMERIC(5,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'productos_farmacia_iva_pct_check') THEN
    ALTER TABLE public.productos_farmacia
      ADD CONSTRAINT productos_farmacia_iva_pct_check CHECK (iva_pct >= 0 AND iva_pct <= 100);
  END IF;
END $$;

-- ── 3. Lotes sin fecha de vencimiento ─────────────────────────────────────────
ALTER TABLE public.lotes_farmacia ALTER COLUMN fecha_vencimiento DROP NOT NULL;

-- La vista de stock informa cuántos lotes con unidades siguen sin fecha
CREATE OR REPLACE VIEW public.stock_farmacia
WITH (security_invoker = true) AS
SELECT
  p.id            AS producto_id,
  p.negocio_id,
  COALESCE(SUM(l.cantidad_venta),  0) AS stock_venta,
  COALESCE(SUM(l.cantidad_bodega), 0) AS stock_bodega,
  MIN(l.fecha_vencimiento) FILTER (
    WHERE l.cantidad_venta + l.cantidad_bodega > 0
  ) AS proximo_vencimiento,
  COUNT(*) FILTER (
    WHERE l.fecha_vencimiento IS NULL AND l.cantidad_venta + l.cantidad_bodega > 0
  ) AS lotes_sin_fecha
FROM public.productos_farmacia p
LEFT JOIN public.lotes_farmacia l ON l.producto_id = p.id
GROUP BY p.id, p.negocio_id;

-- El POS vende lotes sin fecha, pero después de los que sí tienen (FEFO:
-- primero lo que vence antes; lo que no se sabe cuándo vence, al final).
-- Mismo cuerpo que en la fase 2, salvo las dos condiciones marcadas con ★.
CREATE OR REPLACE FUNCTION public.registrar_venta_farmacia(
  p_items   JSONB,              -- [{"producto_id": uuid, "cantidad": num}, ...]
  p_pagos   JSONB,              -- [{"metodo": text, "monto": num}, ...]
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
  -- Negocio del vendedor (cualquier miembro puede vender)
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

  -- 1) Validar productos, calcular total y verificar stock vendible (FEFO,
  --    solo área de venta y solo lotes NO vencidos; los sin fecha cuentan)
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
    WHERE producto_id = v_item.producto_id
      AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= CURRENT_DATE);   -- ★

    IF v_disponible < v_item.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente de "%" (hay % en venta sin vencer)', v_prod.nombre, v_disponible;
    END IF;

    v_total := v_total + ROUND(v_prod.precio_venta * v_item.cantidad, 2);
  END LOOP;

  IF v_total <= 0 THEN RAISE EXCEPTION 'El total debe ser mayor a cero'; END IF;

  -- 2) Validar pagos: lo no-efectivo no puede exceder el total; el vuelto
  --    solo puede salir del efectivo
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

  -- 3) Número de venta consecutivo por negocio (lock por negocio)
  PERFORM pg_advisory_xact_lock(hashtext('venta_farmacia:' || v_negocio::text));
  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
  FROM public.ventas_farmacia WHERE negocio_id = v_negocio;

  INSERT INTO public.ventas_farmacia (negocio_id, numero, cliente_id, user_id, total)
  VALUES (v_negocio, v_numero, p_cliente, auth.uid(), v_total)
  RETURNING id INTO v_venta_id;

  -- 4) Items (snapshot) + descuento de stock FEFO + movimientos enlazados
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(producto_id UUID, cantidad NUMERIC)
  LOOP
    SELECT nombre, concentracion, precio_venta INTO v_prod
    FROM public.productos_farmacia WHERE id = v_item.producto_id;

    INSERT INTO public.items_venta_farmacia (venta_id, producto_id, nombre, cantidad, precio_unitario)
    VALUES (
      v_venta_id, v_item.producto_id,
      v_prod.nombre || COALESCE(' ' || v_prod.concentracion, ''),
      v_item.cantidad, v_prod.precio_venta
    );

    v_pendiente := v_item.cantidad;
    FOR v_lote IN
      SELECT id, cantidad_venta FROM public.lotes_farmacia
      WHERE producto_id = v_item.producto_id
        AND cantidad_venta > 0
        AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= CURRENT_DATE)   -- ★
      ORDER BY fecha_vencimiento ASC NULLS LAST, created_at ASC                 -- ★
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
      -- Otro cajero vendió lo mismo en paralelo y ganó los lotes
      RAISE EXCEPTION 'El stock de "%" cambió durante la venta. Intenta de nuevo.', v_prod.nombre;
    END IF;
  END LOOP;

  -- 5) Pagos
  FOR v_pago IN SELECT * FROM jsonb_to_recordset(p_pagos) AS x(metodo TEXT, monto NUMERIC)
  LOOP
    INSERT INTO public.pagos_venta_farmacia (venta_id, metodo, monto)
    VALUES (v_venta_id, v_pago.metodo, v_pago.monto);
  END LOOP;

  RETURN jsonb_build_object(
    'venta_id', v_venta_id,
    'numero',   v_numero,
    'total',    v_total,
    'vuelto',   v_vuelto
  );
END;
$$;

-- ── 4. Historial de cambios de productos ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.historial_productos_farmacia (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id     UUID        NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  producto_id    UUID        NOT NULL REFERENCES public.productos_farmacia(id) ON DELETE CASCADE,
  user_id        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL = cambio por script
  campo          TEXT        NOT NULL,       -- 'creado' | nombre | precio_venta | costo | iva_pct | ...
  valor_anterior TEXT,
  valor_nuevo    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historial_prod_farmacia_producto ON public.historial_productos_farmacia(producto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_historial_prod_farmacia_negocio  ON public.historial_productos_farmacia(negocio_id, created_at DESC);

ALTER TABLE public.historial_productos_farmacia ENABLE ROW LEVEL SECURITY;

-- Lo ven dueño y regente (el cajero no ve costos ni márgenes). Nadie lo
-- escribe a mano: solo el trigger.
DROP POLICY IF EXISTS "historial_prod_select" ON public.historial_productos_farmacia;
CREATE POLICY "historial_prod_select" ON public.historial_productos_farmacia
  FOR SELECT TO authenticated
  USING (public.es_gestor(negocio_id) OR public.is_admin());

CREATE OR REPLACE FUNCTION public.log_cambios_producto_farmacia()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old   JSONB;
  v_new   JSONB;
  v_campo TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.historial_productos_farmacia (negocio_id, producto_id, user_id, campo, valor_nuevo)
    VALUES (NEW.negocio_id, NEW.id, auth.uid(), 'creado', NEW.nombre);
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);
  FOREACH v_campo IN ARRAY ARRAY[
    'nombre', 'principio_activo', 'concentracion', 'presentacion', 'categoria',
    'codigo_barras', 'registro_invima', 'precio_venta', 'costo', 'iva_pct',
    'requiere_receta', 'activo', 'laboratorio_id', 'proveedor_id'
  ] LOOP
    IF (v_old -> v_campo) IS DISTINCT FROM (v_new -> v_campo) THEN
      INSERT INTO public.historial_productos_farmacia
        (negocio_id, producto_id, user_id, campo, valor_anterior, valor_nuevo)
      VALUES
        (NEW.negocio_id, NEW.id, auth.uid(), v_campo, v_old ->> v_campo, v_new ->> v_campo);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_productos_farmacia_historial ON public.productos_farmacia;
CREATE TRIGGER trg_productos_farmacia_historial
  AFTER INSERT OR UPDATE ON public.productos_farmacia
  FOR EACH ROW EXECUTE FUNCTION public.log_cambios_producto_farmacia();

-- ── 5. La farmacia chilena: CLP e IVA 19% ─────────────────────────────────────
-- Cambiar v_email_dueno si hace falta configurar otro negocio. Los negocios
-- que no se tocan quedan en COP / 0% (Colombia: la mayoría de los medicamentos
-- está excluida de IVA).
DO $$
DECLARE
  v_email_dueno TEXT := 'Luisgabriel830@hotmail.com';
  v_user        UUID;
  v_n           INT;
BEGIN
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = lower(v_email_dueno);
  IF v_user IS NULL THEN
    RAISE NOTICE 'No existe el usuario %: no se configuró ningún negocio en CLP.', v_email_dueno;
    RETURN;
  END IF;

  UPDATE public.negocios n
  SET moneda = 'CLP', iva_pct_default = 19
  WHERE n.id IN (SELECT negocio_id FROM public.miembros_negocio WHERE user_id = v_user AND rol = 'dueno')
    AND (n.moneda <> 'CLP' OR n.iva_pct_default <> 19);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'Negocios configurados en CLP / IVA 19%%: %', v_n;

  -- Productos ya cargados de ese negocio sin IVA asignado → 19%
  UPDATE public.productos_farmacia p
  SET iva_pct = 19
  WHERE p.negocio_id IN (SELECT negocio_id FROM public.miembros_negocio WHERE user_id = v_user AND rol = 'dueno')
    AND p.iva_pct = 0;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'Productos actualizados a IVA 19%%: %', v_n;
END $$;

-- ── 6. Verificación ───────────────────────────────────────────────────────────
SELECT n.nombre, n.moneda, n.iva_pct_default,
       (SELECT COUNT(*) FROM public.productos_farmacia p WHERE p.negocio_id = n.id) AS productos
FROM public.negocios n
ORDER BY n.nombre;
