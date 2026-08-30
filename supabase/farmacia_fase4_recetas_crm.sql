-- ─────────────────────────────────────────────────────────────────────────────
-- FARMACIA · FASE 4 — Recetas (libro de control) y CRM de tratamientos crónicos
-- Ejecutar en: Supabase → SQL Editor
-- Requiere: farmacia_fase0/1/2/3 ya aplicados.
-- Idempotente: se puede ejecutar más de una vez.
--
-- Reglas:
--   · Un producto marcado "requiere receta" NO se puede vender sin registrar
--     los datos del médico, paciente y número de receta — lo exige la RPC.
--   · El libro de control es INMUTABLE: las recetas no se editan ni se borran.
--   · Tratamientos crónicos: todo el equipo los gestiona (el cajero es quien
--     más contacto tiene con el paciente).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Libro de control: recetas registradas ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recetas_farmacia (
  id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id         UUID        NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  venta_id           UUID        REFERENCES public.ventas_farmacia(id) ON DELETE SET NULL,
  venta_numero       BIGINT,
  producto_id        UUID        REFERENCES public.productos_farmacia(id) ON DELETE SET NULL,
  producto_nombre    TEXT        NOT NULL,   -- snapshot para el libro
  cantidad           NUMERIC(12,2) NOT NULL CHECK (cantidad > 0),
  paciente_nombre    TEXT        NOT NULL,
  paciente_documento TEXT        NOT NULL,
  medico_nombre      TEXT        NOT NULL,
  medico_registro    TEXT,                   -- tarjeta profesional
  numero_receta      TEXT        NOT NULL,
  notas              TEXT,
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recetas_farmacia_negocio ON public.recetas_farmacia(negocio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recetas_farmacia_venta   ON public.recetas_farmacia(venta_id);

-- ── 2. CRM: tratamientos crónicos ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tratamientos_farmacia (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id      UUID        NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  cliente_id      UUID        NOT NULL REFERENCES public.clientes_farmacia(id) ON DELETE CASCADE,
  producto_id     UUID        REFERENCES public.productos_farmacia(id) ON DELETE SET NULL,
  producto_nombre TEXT        NOT NULL,   -- snapshot (el nombre no cambia si se borra el producto)
  dias_duracion   INTEGER     NOT NULL CHECK (dias_duracion BETWEEN 1 AND 365),
  ultima_compra   DATE        NOT NULL DEFAULT CURRENT_DATE,
  notas           TEXT,
  activo          BOOLEAN     NOT NULL DEFAULT TRUE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tratamientos_farmacia_negocio ON public.tratamientos_farmacia(negocio_id, activo);

DROP TRIGGER IF EXISTS trg_tratamientos_farmacia_updated ON public.tratamientos_farmacia;
CREATE TRIGGER trg_tratamientos_farmacia_updated
  BEFORE UPDATE ON public.tratamientos_farmacia
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. RPC de venta: ahora exige receta para productos controlados ────────────
-- Cambia la firma (se agrega p_receta), así que se elimina la versión anterior
-- para que no queden dos sobrecargas ambiguas.
DROP FUNCTION IF EXISTS public.registrar_venta_farmacia(JSONB, JSONB, UUID);

CREATE OR REPLACE FUNCTION public.registrar_venta_farmacia(
  p_items   JSONB,
  p_pagos   JSONB,
  p_cliente UUID  DEFAULT NULL,
  p_receta  JSONB DEFAULT NULL    -- {paciente_nombre, paciente_documento, medico_nombre, medico_registro, numero_receta, notas}
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
  v_hay_rx      BOOLEAN := FALSE;
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

  -- 1) Validar productos, total, stock vendible y si hay controlados
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(producto_id UUID, cantidad NUMERIC)
  LOOP
    IF v_item.producto_id IS NULL OR v_item.cantidad IS NULL OR v_item.cantidad <= 0 THEN
      RAISE EXCEPTION 'Item inválido en la venta';
    END IF;

    SELECT id, nombre, concentracion, precio_venta, requiere_receta INTO v_prod
    FROM public.productos_farmacia
    WHERE id = v_item.producto_id AND negocio_id = v_negocio AND activo;
    IF NOT FOUND THEN RAISE EXCEPTION 'Producto no encontrado o inactivo'; END IF;

    IF v_prod.requiere_receta THEN v_hay_rx := TRUE; END IF;

    SELECT COALESCE(SUM(cantidad_venta), 0) INTO v_disponible
    FROM public.lotes_farmacia
    WHERE producto_id = v_item.producto_id AND fecha_vencimiento >= CURRENT_DATE;

    IF v_disponible < v_item.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente de "%" (hay % en venta sin vencer)', v_prod.nombre, v_disponible;
    END IF;

    v_total := v_total + ROUND(v_prod.precio_venta * v_item.cantidad, 2);
  END LOOP;

  IF v_total <= 0 THEN RAISE EXCEPTION 'El total debe ser mayor a cero'; END IF;

  -- Medicamento de control especial: sin receta completa NO hay venta
  IF v_hay_rx THEN
    IF p_receta IS NULL
       OR trim(COALESCE(p_receta->>'paciente_nombre', ''))    = ''
       OR trim(COALESCE(p_receta->>'paciente_documento', '')) = ''
       OR trim(COALESCE(p_receta->>'medico_nombre', ''))      = ''
       OR trim(COALESCE(p_receta->>'numero_receta', ''))      = ''
    THEN
      RAISE EXCEPTION 'La venta incluye medicamentos de control especial: registra paciente, documento, médico y número de receta';
    END IF;
  END IF;

  -- 2) Validar pagos (mixto)
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

  -- 3) Venta con número consecutivo
  PERFORM pg_advisory_xact_lock(hashtext('venta_farmacia:' || v_negocio::text));
  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
  FROM public.ventas_farmacia WHERE negocio_id = v_negocio;

  INSERT INTO public.ventas_farmacia (negocio_id, numero, cliente_id, user_id, total)
  VALUES (v_negocio, v_numero, p_cliente, auth.uid(), v_total)
  RETURNING id INTO v_venta_id;

  -- 4) Items + FEFO + movimientos + libro de control
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(producto_id UUID, cantidad NUMERIC)
  LOOP
    SELECT nombre, concentracion, precio_venta, costo, requiere_receta INTO v_prod
    FROM public.productos_farmacia WHERE id = v_item.producto_id;

    INSERT INTO public.items_venta_farmacia
      (venta_id, producto_id, nombre, cantidad, precio_unitario, costo_unitario)
    VALUES (
      v_venta_id, v_item.producto_id,
      v_prod.nombre || COALESCE(' ' || v_prod.concentracion, ''),
      v_item.cantidad, v_prod.precio_venta, COALESCE(v_prod.costo, 0)
    );

    -- Registro en el libro de control (dentro de la MISMA transacción:
    -- no puede existir venta de controlado sin su asiento en el libro)
    IF v_prod.requiere_receta THEN
      INSERT INTO public.recetas_farmacia
        (negocio_id, venta_id, venta_numero, producto_id, producto_nombre, cantidad,
         paciente_nombre, paciente_documento, medico_nombre, medico_registro,
         numero_receta, notas, user_id)
      VALUES
        (v_negocio, v_venta_id, v_numero, v_item.producto_id,
         v_prod.nombre || COALESCE(' ' || v_prod.concentracion, ''), v_item.cantidad,
         trim(p_receta->>'paciente_nombre'),
         trim(p_receta->>'paciente_documento'),
         trim(p_receta->>'medico_nombre'),
         NULLIF(trim(COALESCE(p_receta->>'medico_registro', '')), ''),
         trim(p_receta->>'numero_receta'),
         NULLIF(trim(COALESCE(p_receta->>'notas', '')), ''),
         auth.uid());
    END IF;

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

  -- 5) Pagos
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

REVOKE ALL ON FUNCTION public.registrar_venta_farmacia(JSONB, JSONB, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_venta_farmacia(JSONB, JSONB, UUID, JSONB) TO authenticated;

-- ── 4. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.recetas_farmacia      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tratamientos_farmacia ENABLE ROW LEVEL SECURITY;

-- Libro de control: el equipo lo consulta; se inserta con la venta (RPC).
-- INMUTABLE: sin policies de UPDATE ni DELETE — nadie reescribe el libro.
DROP POLICY IF EXISTS "receta_select" ON public.recetas_farmacia;
CREATE POLICY "receta_select" ON public.recetas_farmacia
  FOR SELECT TO authenticated
  USING (public.es_miembro(negocio_id) OR public.is_admin());
DROP POLICY IF EXISTS "receta_insert" ON public.recetas_farmacia;
CREATE POLICY "receta_insert" ON public.recetas_farmacia
  FOR INSERT TO authenticated
  WITH CHECK ((public.es_miembro(negocio_id) AND user_id = auth.uid()) OR public.is_admin());

-- Tratamientos: todo el equipo gestiona; eliminar es de gestores
DROP POLICY IF EXISTS "trat_select" ON public.tratamientos_farmacia;
CREATE POLICY "trat_select" ON public.tratamientos_farmacia
  FOR SELECT TO authenticated
  USING (public.es_miembro(negocio_id) OR public.is_admin());
DROP POLICY IF EXISTS "trat_insert" ON public.tratamientos_farmacia;
CREATE POLICY "trat_insert" ON public.tratamientos_farmacia
  FOR INSERT TO authenticated
  WITH CHECK ((public.es_miembro(negocio_id) AND user_id = auth.uid()) OR public.is_admin());
DROP POLICY IF EXISTS "trat_update" ON public.tratamientos_farmacia;
CREATE POLICY "trat_update" ON public.tratamientos_farmacia
  FOR UPDATE TO authenticated
  USING      (public.es_miembro(negocio_id) OR public.is_admin())
  WITH CHECK (public.es_miembro(negocio_id) OR public.is_admin());
DROP POLICY IF EXISTS "trat_delete" ON public.tratamientos_farmacia;
CREATE POLICY "trat_delete" ON public.tratamientos_farmacia
  FOR DELETE TO authenticated
  USING (public.es_gestor(negocio_id) OR public.is_admin());

-- ── 5. Verificación ───────────────────────────────────────────────────────────
SELECT tablename,
       CASE WHEN rowsecurity THEN '✅ RLS' ELSE '❌ SIN RLS' END AS seguridad
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('recetas_farmacia', 'tratamientos_farmacia')
ORDER BY tablename;
