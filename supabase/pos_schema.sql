-- ─────────────────────────────────────────────────────────────────────────────
-- Portal POS — catálogo de productos y ventas de mostrador
-- Ejecutar en: Supabase → SQL Editor
-- Requiere: public.is_admin() (security_fixes.sql o rls_tenant_data.sql)
-- Idempotente: se puede ejecutar más de una vez.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.productos_pos (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id   UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      TEXT    NOT NULL,
  categoria   TEXT    NOT NULL DEFAULT 'otros'
                      CHECK (categoria IN ('panes','postres','bebidas','salados','otros')),
  emoji       TEXT    NOT NULL DEFAULT '🛒',
  precio      NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
  disponible  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ventas_pos (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id       UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subtotal        NUMERIC(12,2) NOT NULL CHECK (subtotal > 0),
  impuesto        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (impuesto >= 0),
  total           NUMERIC(12,2) NOT NULL CHECK (total > 0),
  metodo          TEXT    NOT NULL CHECK (metodo IN ('efectivo','tarjeta','transferencia')),
  monto_recibido  NUMERIC(12,2) CHECK (monto_recibido IS NULL OR monto_recibido >= 0),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.items_venta_pos (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  venta_id        UUID    NOT NULL REFERENCES public.ventas_pos(id) ON DELETE CASCADE,
  -- SET NULL + snapshot de nombre/precio: borrar un producto no borra el historial
  producto_id     UUID    REFERENCES public.productos_pos(id) ON DELETE SET NULL,
  nombre          TEXT    NOT NULL,
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal        NUMERIC(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_productos_pos_agente    ON public.productos_pos(agente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_pos_agente_fecha ON public.ventas_pos(agente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_venta_pos_venta   ON public.items_venta_pos(venta_id);

-- ── Función: registrar venta (atómica) ────────────────────────────────────────
-- SECURITY INVOKER: corre con los permisos del usuario, la RLS aplica.
-- Los precios SIEMPRE salen del catálogo — el cliente solo manda ids y cantidades.
CREATE OR REPLACE FUNCTION public.registrar_venta_pos(
  p_items          JSONB,              -- [{"producto_id": uuid, "cantidad": int}, ...]
  p_metodo         TEXT,
  p_monto_recibido NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_iva       CONSTANT NUMERIC := 0.19;  -- IVA Colombia
  v_item      RECORD;
  v_producto  RECORD;
  v_subtotal  NUMERIC := 0;
  v_impuesto  NUMERIC;
  v_total     NUMERIC;
  v_venta_id  UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_metodo NOT IN ('efectivo','tarjeta','transferencia') THEN
    RAISE EXCEPTION 'Método de pago inválido';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta debe tener al menos un producto';
  END IF;

  -- Validar items y acumular subtotal con precios del catálogo
  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items) AS x(producto_id UUID, cantidad INT)
  LOOP
    IF v_item.producto_id IS NULL OR v_item.cantidad IS NULL OR v_item.cantidad <= 0 THEN
      RAISE EXCEPTION 'Item inválido en la venta';
    END IF;

    SELECT id, nombre, precio, disponible INTO v_producto
    FROM public.productos_pos
    WHERE id = v_item.producto_id AND agente_id = auth.uid();

    IF NOT FOUND THEN RAISE EXCEPTION 'Producto no encontrado'; END IF;
    IF NOT v_producto.disponible THEN
      RAISE EXCEPTION 'El producto "%" no está disponible', v_producto.nombre;
    END IF;

    v_subtotal := v_subtotal + ROUND(v_producto.precio * v_item.cantidad, 2);
  END LOOP;

  IF v_subtotal <= 0 THEN RAISE EXCEPTION 'El total debe ser mayor a cero'; END IF;

  v_impuesto := ROUND(v_subtotal * v_iva, 2);
  v_total    := v_subtotal + v_impuesto;

  IF p_metodo = 'efectivo' AND p_monto_recibido IS NOT NULL AND p_monto_recibido < v_total THEN
    RAISE EXCEPTION 'El monto recibido es menor al total';
  END IF;

  INSERT INTO public.ventas_pos (agente_id, subtotal, impuesto, total, metodo, monto_recibido)
  VALUES (auth.uid(), v_subtotal, v_impuesto, v_total, p_metodo,
          CASE WHEN p_metodo = 'efectivo' THEN p_monto_recibido ELSE NULL END)
  RETURNING id INTO v_venta_id;

  INSERT INTO public.items_venta_pos (venta_id, producto_id, nombre, cantidad, precio_unitario)
  SELECT v_venta_id, p.id, p.nombre, x.cantidad, p.precio
  FROM jsonb_to_recordset(p_items) AS x(producto_id UUID, cantidad INT)
  JOIN public.productos_pos p ON p.id = x.producto_id AND p.agente_id = auth.uid();

  RETURN jsonb_build_object(
    'venta_id', v_venta_id,
    'subtotal', v_subtotal,
    'impuesto', v_impuesto,
    'total',    v_total,
    'vuelto',   CASE WHEN p_metodo = 'efectivo' AND p_monto_recibido IS NOT NULL
                     THEN GREATEST(p_monto_recibido - v_total, 0) ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_venta_pos(JSONB, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_venta_pos(JSONB, TEXT, NUMERIC) TO authenticated;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.productos_pos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas_pos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items_venta_pos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agente_own_productos_pos" ON public.productos_pos;
CREATE POLICY "agente_own_productos_pos" ON public.productos_pos
  FOR ALL TO authenticated
  USING      (agente_id = auth.uid() OR public.is_admin())
  WITH CHECK (agente_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "agente_own_ventas_pos" ON public.ventas_pos;
CREATE POLICY "agente_own_ventas_pos" ON public.ventas_pos
  FOR ALL TO authenticated
  USING      (agente_id = auth.uid() OR public.is_admin())
  WITH CHECK (agente_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "agente_own_items_venta_pos" ON public.items_venta_pos;
CREATE POLICY "agente_own_items_venta_pos" ON public.items_venta_pos
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.ventas_pos v WHERE v.id = venta_id AND v.agente_id = auth.uid())
    OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.ventas_pos v WHERE v.id = venta_id AND v.agente_id = auth.uid())
    OR public.is_admin()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Carga inicial de ejemplo (opcional): descomentar y reemplazar el email.
-- ─────────────────────────────────────────────────────────────────────────────
-- INSERT INTO public.productos_pos (agente_id, nombre, categoria, emoji, precio)
-- SELECT u.id, x.nombre, x.categoria, x.emoji, x.precio
-- FROM auth.users u,
-- (VALUES
--   ('Pan aliñado',        'panes',   '🍞',  1200),
--   ('Almojábana',         'panes',   '🫓',  2500),
--   ('Croissant',          'panes',   '🥐',  4500),
--   ('Buñuelo',            'postres', '🍩',  1800),
--   ('Torta de chocolate', 'postres', '🎂',  6500),
--   ('Café americano',     'bebidas', '☕',  3000),
--   ('Jugo de naranja',    'bebidas', '🍊',  5000),
--   ('Sandwich mixto',     'salados', '🥪',  8500),
--   ('Empanada de pollo',  'salados', '🥟',  3500),
--   ('Pizza personal',     'salados', '🍕', 12000)
-- ) AS x(nombre, categoria, emoji, precio)
-- WHERE u.email = 'TU_EMAIL_AQUI';
