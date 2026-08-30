-- ─────────────────────────────────────────────────────────────────────────────
-- FARMACIA · FASE 2 — POS: ventas, pago mixto, anulaciones y pedidos pendientes
-- Ejecutar en: Supabase → SQL Editor
-- Requiere: farmacia_fase0_negocios.sql y farmacia_fase1_inventario.sql.
-- Idempotente: se puede ejecutar más de una vez.
--
-- Reglas de rol:
--   · Cualquier miembro (cajero incluido) vende y registra clientes.
--   · Anular una venta: SOLO dueño o regente, con motivo, y repone el stock.
--   · El precio SIEMPRE sale del catálogo; el descuento de stock es FEFO y
--     salta los lotes vencidos.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Clientes de la farmacia ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clientes_farmacia (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id  UUID        NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre      TEXT        NOT NULL,
  cedula      TEXT,
  telefono    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_farmacia_cedula
  ON public.clientes_farmacia (negocio_id, cedula)
  WHERE cedula IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clientes_farmacia_negocio ON public.clientes_farmacia(negocio_id, nombre);

-- ── 2. Ventas ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ventas_farmacia (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id     UUID        NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  numero         BIGINT      NOT NULL,
  cliente_id     UUID        REFERENCES public.clientes_farmacia(id) ON DELETE SET NULL,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- cajero
  total          NUMERIC(12,2) NOT NULL CHECK (total > 0),
  estado         TEXT        NOT NULL DEFAULT 'completada' CHECK (estado IN ('completada', 'anulada')),
  anulada_por    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  anulada_motivo TEXT,
  anulada_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (negocio_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_ventas_farmacia_negocio ON public.ventas_farmacia(negocio_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.items_venta_farmacia (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  venta_id        UUID        NOT NULL REFERENCES public.ventas_farmacia(id) ON DELETE CASCADE,
  -- SET NULL + snapshot: borrar un producto no rompe el historial de ventas
  producto_id     UUID        REFERENCES public.productos_farmacia(id) ON DELETE SET NULL,
  nombre          TEXT        NOT NULL,
  cantidad        NUMERIC(12,2) NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal        NUMERIC(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

CREATE INDEX IF NOT EXISTS idx_items_venta_farmacia ON public.items_venta_farmacia(venta_id);

-- Pago MIXTO: una venta puede tener varias filas (efectivo + tarjeta + …)
CREATE TABLE IF NOT EXISTS public.pagos_venta_farmacia (
  id        UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  venta_id  UUID        NOT NULL REFERENCES public.ventas_farmacia(id) ON DELETE CASCADE,
  metodo    TEXT        NOT NULL CHECK (metodo IN ('efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia')),
  monto     NUMERIC(12,2) NOT NULL CHECK (monto > 0)
);

CREATE INDEX IF NOT EXISTS idx_pagos_venta_farmacia ON public.pagos_venta_farmacia(venta_id);

-- Los movimientos de inventario de una venta quedan enlazados a ella,
-- para poder reponer exactamente los mismos lotes al anular.
ALTER TABLE public.movimientos_farmacia
  ADD COLUMN IF NOT EXISTS venta_id UUID REFERENCES public.ventas_farmacia(id) ON DELETE SET NULL;

-- ── 3. Pedidos pendientes (encargos pagados sin stock) ────────────────────────
-- Flujo: pagado → pedido (al proveedor) → recibido → notificado → entregado.
-- El encargo llega para el cliente y se entrega directo: no pasa por inventario.
CREATE TABLE IF NOT EXISTS public.pedidos_farmacia (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id   UUID        NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  cliente_id   UUID        NOT NULL REFERENCES public.clientes_farmacia(id) ON DELETE RESTRICT,
  producto_id  UUID        REFERENCES public.productos_farmacia(id) ON DELETE SET NULL,
  descripcion  TEXT        NOT NULL,   -- qué se encargó (libre o snapshot del producto)
  cantidad     NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  total        NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  monto_pagado NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monto_pagado >= 0),
  metodo_pago  TEXT        CHECK (metodo_pago IN ('efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia')),
  estado       TEXT        NOT NULL DEFAULT 'pagado' CHECK (estado IN
                 ('pagado', 'pedido', 'recibido', 'notificado', 'entregado', 'cancelado')),
  notas        TEXT,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_farmacia_negocio ON public.pedidos_farmacia(negocio_id, estado, created_at DESC);

DROP TRIGGER IF EXISTS trg_pedidos_farmacia_updated ON public.pedidos_farmacia;
CREATE TRIGGER trg_pedidos_farmacia_updated
  BEFORE UPDATE ON public.pedidos_farmacia
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4. RPC: registrar venta (atómica, FEFO, pago mixto) ───────────────────────
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
  --    solo área de venta y solo lotes NO vencidos)
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

-- ── 5. RPC: anular venta (solo dueño/regente, repone los mismos lotes) ────────
CREATE OR REPLACE FUNCTION public.anular_venta_farmacia(
  p_venta  UUID,
  p_motivo TEXT
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_v   RECORD;
  v_mov RECORD;
BEGIN
  SELECT * INTO v_v FROM public.ventas_farmacia WHERE id = p_venta FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venta no encontrada'; END IF;

  IF NOT (public.es_gestor(v_v.negocio_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Solo el dueño o el regente pueden anular ventas';
  END IF;
  IF v_v.estado <> 'completada' THEN
    RAISE EXCEPTION 'La venta ya está anulada';
  END IF;
  IF trim(COALESCE(p_motivo, '')) = '' THEN
    RAISE EXCEPTION 'El motivo de la anulación es obligatorio';
  END IF;

  -- Reponer exactamente lo que salió, lote por lote
  FOR v_mov IN
    SELECT lote_id, producto_id, cantidad FROM public.movimientos_farmacia
    WHERE venta_id = p_venta AND tipo = 'salida_venta'
  LOOP
    IF v_mov.lote_id IS NOT NULL THEN
      UPDATE public.lotes_farmacia
      SET cantidad_venta = cantidad_venta + v_mov.cantidad
      WHERE id = v_mov.lote_id;
    END IF;

    INSERT INTO public.movimientos_farmacia
      (negocio_id, producto_id, lote_id, tipo, cantidad, motivo, user_id, venta_id)
    VALUES
      (v_v.negocio_id, v_mov.producto_id, v_mov.lote_id, 'entrada_venta', v_mov.cantidad,
       'Anulación de venta #' || v_v.numero || ': ' || trim(p_motivo), auth.uid(), p_venta);
  END LOOP;

  UPDATE public.ventas_farmacia SET
    estado         = 'anulada',
    anulada_por    = auth.uid(),
    anulada_motivo = trim(p_motivo),
    anulada_at     = NOW()
  WHERE id = p_venta;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_venta_farmacia(JSONB, JSONB, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.anular_venta_farmacia(UUID, TEXT)            FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_venta_farmacia(JSONB, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.anular_venta_farmacia(UUID, TEXT)            TO authenticated;

-- ── 6. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.clientes_farmacia    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas_farmacia      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items_venta_farmacia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_venta_farmacia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_farmacia     ENABLE ROW LEVEL SECURITY;

-- Clientes: todo el equipo los ve y los registra (rol del cajero según el brief)
DROP POLICY IF EXISTS "cli_select" ON public.clientes_farmacia;
CREATE POLICY "cli_select" ON public.clientes_farmacia
  FOR SELECT TO authenticated USING (public.es_miembro(negocio_id) OR public.is_admin());
DROP POLICY IF EXISTS "cli_insert" ON public.clientes_farmacia;
CREATE POLICY "cli_insert" ON public.clientes_farmacia
  FOR INSERT TO authenticated WITH CHECK (public.es_miembro(negocio_id) OR public.is_admin());
DROP POLICY IF EXISTS "cli_update" ON public.clientes_farmacia;
CREATE POLICY "cli_update" ON public.clientes_farmacia
  FOR UPDATE TO authenticated
  USING      (public.es_miembro(negocio_id) OR public.is_admin())
  WITH CHECK (public.es_miembro(negocio_id) OR public.is_admin());
DROP POLICY IF EXISTS "cli_delete" ON public.clientes_farmacia;
CREATE POLICY "cli_delete" ON public.clientes_farmacia
  FOR DELETE TO authenticated USING (public.es_gestor(negocio_id) OR public.is_admin());

-- Ventas: el equipo las ve; se INSERTAN por la RPC a nombre propio; el único
-- UPDATE permitido es la anulación (la RPC valida gestor + motivo). El cajero
-- NO puede borrar ventas: no hay policy de DELETE.
DROP POLICY IF EXISTS "venta_select" ON public.ventas_farmacia;
CREATE POLICY "venta_select" ON public.ventas_farmacia
  FOR SELECT TO authenticated USING (public.es_miembro(negocio_id) OR public.is_admin());
DROP POLICY IF EXISTS "venta_insert" ON public.ventas_farmacia;
CREATE POLICY "venta_insert" ON public.ventas_farmacia
  FOR INSERT TO authenticated
  WITH CHECK ((public.es_miembro(negocio_id) AND user_id = auth.uid()) OR public.is_admin());
DROP POLICY IF EXISTS "venta_update" ON public.ventas_farmacia;
CREATE POLICY "venta_update" ON public.ventas_farmacia
  FOR UPDATE TO authenticated
  USING      (public.es_gestor(negocio_id) OR public.is_admin())
  WITH CHECK (public.es_gestor(negocio_id) OR public.is_admin());

-- Items y pagos: visibles para el equipo; se insertan con la venta; inmutables
DROP POLICY IF EXISTS "item_venta_select" ON public.items_venta_farmacia;
CREATE POLICY "item_venta_select" ON public.items_venta_farmacia
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ventas_farmacia v
    WHERE v.id = venta_id AND (public.es_miembro(v.negocio_id) OR public.is_admin())
  ));
DROP POLICY IF EXISTS "item_venta_insert" ON public.items_venta_farmacia;
CREATE POLICY "item_venta_insert" ON public.items_venta_farmacia
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ventas_farmacia v
    WHERE v.id = venta_id AND (public.es_miembro(v.negocio_id) OR public.is_admin())
  ));

DROP POLICY IF EXISTS "pago_venta_select" ON public.pagos_venta_farmacia;
CREATE POLICY "pago_venta_select" ON public.pagos_venta_farmacia
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ventas_farmacia v
    WHERE v.id = venta_id AND (public.es_miembro(v.negocio_id) OR public.is_admin())
  ));
DROP POLICY IF EXISTS "pago_venta_insert" ON public.pagos_venta_farmacia;
CREATE POLICY "pago_venta_insert" ON public.pagos_venta_farmacia
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ventas_farmacia v
    WHERE v.id = venta_id AND (public.es_miembro(v.negocio_id) OR public.is_admin())
  ));

-- Pedidos: el equipo los crea y avanza; cancelar es de gestores (se valida
-- en la capa de acciones; acá la segunda línea es que siga siendo del negocio)
DROP POLICY IF EXISTS "pedido_select" ON public.pedidos_farmacia;
CREATE POLICY "pedido_select" ON public.pedidos_farmacia
  FOR SELECT TO authenticated USING (public.es_miembro(negocio_id) OR public.is_admin());
DROP POLICY IF EXISTS "pedido_insert" ON public.pedidos_farmacia;
CREATE POLICY "pedido_insert" ON public.pedidos_farmacia
  FOR INSERT TO authenticated
  WITH CHECK ((public.es_miembro(negocio_id) AND user_id = auth.uid()) OR public.is_admin());
DROP POLICY IF EXISTS "pedido_update" ON public.pedidos_farmacia;
CREATE POLICY "pedido_update" ON public.pedidos_farmacia
  FOR UPDATE TO authenticated
  USING      (public.es_miembro(negocio_id) OR public.is_admin())
  WITH CHECK (public.es_miembro(negocio_id) OR public.is_admin());

-- ── 7. Verificación ───────────────────────────────────────────────────────────
SELECT tablename,
       CASE WHEN rowsecurity THEN '✅ RLS' ELSE '❌ SIN RLS' END AS seguridad
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('clientes_farmacia','ventas_farmacia','items_venta_farmacia',
                    'pagos_venta_farmacia','pedidos_farmacia')
ORDER BY tablename;
