-- ─────────────────────────────────────────────────────────────────────────────
-- FARMACIA · FASE 1 — Inventario y catálogo
-- Ejecutar en: Supabase → SQL Editor
-- Requiere: farmacia_fase0_negocios.sql ya aplicado.
-- Idempotente: se puede ejecutar más de una vez.
--
-- Reglas de rol (se hacen cumplir acá, en la base):
--   · Dueño y regente: crean y editan productos, lotes y movimientos.
--   · Cajero: solo lectura (consulta stock y equivalentes para vender).
--   · Eliminación definitiva de productos: solo dueño.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. Helper de rol: gestor = dueño o regente ────────────────────────────────
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
  );
$$;

-- ── 1. Catálogos de apoyo ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.proveedores_farmacia (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id  UUID        NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre      TEXT        NOT NULL,
  nit         TEXT,
  telefono    TEXT,
  email       TEXT,
  activo      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (negocio_id, nombre)
);

CREATE TABLE IF NOT EXISTS public.laboratorios_farmacia (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id  UUID        NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre      TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (negocio_id, nombre)
);

-- ── 2. Productos ──────────────────────────────────────────────────────────────
-- El stock NO vive acá: vive en los lotes (cada lote tiene su vencimiento).
CREATE TABLE IF NOT EXISTS public.productos_farmacia (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id        UUID        NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  codigo_barras     TEXT,
  nombre            TEXT        NOT NULL,
  principio_activo  TEXT,                 -- base de los equivalentes/genéricos
  concentracion     TEXT,                 -- ej: "500 mg"
  presentacion      TEXT,                 -- ej: "Caja x 30 tabletas"
  laboratorio_id    UUID        REFERENCES public.laboratorios_farmacia(id) ON DELETE SET NULL,
  proveedor_id      UUID        REFERENCES public.proveedores_farmacia(id)  ON DELETE SET NULL,
  categoria         TEXT        NOT NULL DEFAULT 'otros',
  registro_invima   TEXT,
  precio_venta      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (precio_venta >= 0),
  costo             NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (costo >= 0),
  requiere_receta   BOOLEAN     NOT NULL DEFAULT FALSE,  -- base de la Fase 4
  activo            BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un código de barras no se repite dentro del mismo negocio (permite NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_productos_farmacia_codigo
  ON public.productos_farmacia (negocio_id, codigo_barras)
  WHERE codigo_barras IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_productos_farmacia_negocio  ON public.productos_farmacia(negocio_id);
CREATE INDEX IF NOT EXISTS idx_productos_farmacia_nombre   ON public.productos_farmacia(negocio_id, nombre);
CREATE INDEX IF NOT EXISTS idx_productos_farmacia_activo   ON public.productos_farmacia(negocio_id, principio_activo);

DROP TRIGGER IF EXISTS trg_productos_farmacia_updated ON public.productos_farmacia;
CREATE TRIGGER trg_productos_farmacia_updated
  BEFORE UPDATE ON public.productos_farmacia
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. Lotes (el stock real, con vencimiento y ubicación) ─────────────────────
CREATE TABLE IF NOT EXISTS public.lotes_farmacia (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id        UUID        NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  producto_id       UUID        NOT NULL REFERENCES public.productos_farmacia(id) ON DELETE CASCADE,
  lote              TEXT        NOT NULL,
  fecha_vencimiento DATE        NOT NULL,
  cantidad_venta    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cantidad_venta  >= 0),
  cantidad_bodega   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cantidad_bodega >= 0),
  estanteria        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (producto_id, lote)
);

CREATE INDEX IF NOT EXISTS idx_lotes_farmacia_producto ON public.lotes_farmacia(producto_id, fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_lotes_farmacia_negocio  ON public.lotes_farmacia(negocio_id, fecha_vencimiento);

DROP TRIGGER IF EXISTS trg_lotes_farmacia_updated ON public.lotes_farmacia;
CREATE TRIGGER trg_lotes_farmacia_updated
  BEFORE UPDATE ON public.lotes_farmacia
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4. Movimientos de inventario (historial auditable) ────────────────────────
CREATE TABLE IF NOT EXISTS public.movimientos_farmacia (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id  UUID        NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  producto_id UUID        NOT NULL REFERENCES public.productos_farmacia(id) ON DELETE CASCADE,
  lote_id     UUID        REFERENCES public.lotes_farmacia(id) ON DELETE SET NULL,
  tipo        TEXT        NOT NULL CHECK (tipo IN (
                'entrada_venta', 'entrada_bodega',
                'traslado_a_venta', 'traslado_a_bodega',
                'merma_venta', 'merma_bodega',
                'salida_venta'            -- lo usará el POS en la Fase 2
              )),
  cantidad    NUMERIC(12,2) NOT NULL CHECK (cantidad > 0),
  motivo      TEXT,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movimientos_farmacia_producto ON public.movimientos_farmacia(producto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_farmacia_negocio  ON public.movimientos_farmacia(negocio_id, created_at DESC);

-- ── 5. RPC: crear lote (alta de mercancía, atómica) ───────────────────────────
CREATE OR REPLACE FUNCTION public.crear_lote_farmacia(
  p_producto   UUID,
  p_lote       TEXT,
  p_vencimiento DATE,
  p_cant_venta  NUMERIC DEFAULT 0,
  p_cant_bodega NUMERIC DEFAULT 0,
  p_estanteria  TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_negocio UUID;
  v_lote_id UUID;
BEGIN
  SELECT negocio_id INTO v_negocio FROM public.productos_farmacia WHERE id = p_producto;
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'Producto no encontrado'; END IF;
  IF NOT (public.es_gestor(v_negocio) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Solo dueño o regente pueden ingresar mercancía';
  END IF;
  IF COALESCE(p_cant_venta, 0) < 0 OR COALESCE(p_cant_bodega, 0) < 0
     OR (COALESCE(p_cant_venta, 0) + COALESCE(p_cant_bodega, 0)) = 0 THEN
    RAISE EXCEPTION 'Las cantidades deben ser cero o positivas y al menos una mayor a cero';
  END IF;
  IF trim(COALESCE(p_lote, '')) = '' THEN RAISE EXCEPTION 'El número de lote es obligatorio'; END IF;

  INSERT INTO public.lotes_farmacia
    (negocio_id, producto_id, lote, fecha_vencimiento, cantidad_venta, cantidad_bodega, estanteria)
  VALUES
    (v_negocio, p_producto, trim(p_lote), p_vencimiento,
     COALESCE(p_cant_venta, 0), COALESCE(p_cant_bodega, 0), NULLIF(trim(COALESCE(p_estanteria, '')), ''))
  RETURNING id INTO v_lote_id;

  IF COALESCE(p_cant_venta, 0) > 0 THEN
    INSERT INTO public.movimientos_farmacia (negocio_id, producto_id, lote_id, tipo, cantidad, motivo, user_id)
    VALUES (v_negocio, p_producto, v_lote_id, 'entrada_venta', p_cant_venta, 'Ingreso de lote ' || trim(p_lote), auth.uid());
  END IF;
  IF COALESCE(p_cant_bodega, 0) > 0 THEN
    INSERT INTO public.movimientos_farmacia (negocio_id, producto_id, lote_id, tipo, cantidad, motivo, user_id)
    VALUES (v_negocio, p_producto, v_lote_id, 'entrada_bodega', p_cant_bodega, 'Ingreso de lote ' || trim(p_lote), auth.uid());
  END IF;

  RETURN v_lote_id;
END;
$$;

-- ── 6. RPC: movimiento sobre un lote existente (atómico, sin stock negativo) ──
CREATE OR REPLACE FUNCTION public.registrar_movimiento_farmacia(
  p_lote     UUID,
  p_tipo     TEXT,
  p_cantidad NUMERIC,
  p_motivo   TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_l RECORD;
  v_delta_venta  NUMERIC := 0;
  v_delta_bodega NUMERIC := 0;
BEGIN
  SELECT * INTO v_l FROM public.lotes_farmacia WHERE id = p_lote FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote no encontrado'; END IF;
  IF NOT (public.es_gestor(v_l.negocio_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Solo dueño o regente pueden mover inventario';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a cero';
  END IF;

  CASE p_tipo
    WHEN 'entrada_venta'     THEN v_delta_venta :=  p_cantidad;
    WHEN 'entrada_bodega'    THEN v_delta_bodega :=  p_cantidad;
    WHEN 'merma_venta'       THEN v_delta_venta := -p_cantidad;
    WHEN 'merma_bodega'      THEN v_delta_bodega := -p_cantidad;
    WHEN 'traslado_a_venta'  THEN v_delta_venta :=  p_cantidad; v_delta_bodega := -p_cantidad;
    WHEN 'traslado_a_bodega' THEN v_delta_venta := -p_cantidad; v_delta_bodega :=  p_cantidad;
    ELSE RAISE EXCEPTION 'Tipo de movimiento inválido';
  END CASE;

  IF v_l.cantidad_venta + v_delta_venta < 0 THEN
    RAISE EXCEPTION 'Stock insuficiente en el área de venta (hay %)', v_l.cantidad_venta;
  END IF;
  IF v_l.cantidad_bodega + v_delta_bodega < 0 THEN
    RAISE EXCEPTION 'Stock insuficiente en bodega (hay %)', v_l.cantidad_bodega;
  END IF;

  UPDATE public.lotes_farmacia SET
    cantidad_venta  = cantidad_venta  + v_delta_venta,
    cantidad_bodega = cantidad_bodega + v_delta_bodega
  WHERE id = p_lote;

  INSERT INTO public.movimientos_farmacia (negocio_id, producto_id, lote_id, tipo, cantidad, motivo, user_id)
  VALUES (v_l.negocio_id, v_l.producto_id, p_lote, p_tipo, p_cantidad, NULLIF(trim(COALESCE(p_motivo, '')), ''), auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.crear_lote_farmacia(UUID, TEXT, DATE, NUMERIC, NUMERIC, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_movimiento_farmacia(UUID, TEXT, NUMERIC, TEXT)      FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_lote_farmacia(UUID, TEXT, DATE, NUMERIC, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_movimiento_farmacia(UUID, TEXT, NUMERIC, TEXT)      TO authenticated;

-- ── 7. Vista de stock por producto (semáforo y totales) ───────────────────────
CREATE OR REPLACE VIEW public.stock_farmacia
WITH (security_invoker = true) AS
SELECT
  p.id            AS producto_id,
  p.negocio_id,
  COALESCE(SUM(l.cantidad_venta),  0) AS stock_venta,
  COALESCE(SUM(l.cantidad_bodega), 0) AS stock_bodega,
  MIN(l.fecha_vencimiento) FILTER (
    WHERE l.cantidad_venta + l.cantidad_bodega > 0
  ) AS proximo_vencimiento
FROM public.productos_farmacia p
LEFT JOIN public.lotes_farmacia l ON l.producto_id = p.id
GROUP BY p.id, p.negocio_id;

REVOKE ALL ON public.stock_farmacia FROM anon;

-- ── 8. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.proveedores_farmacia  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laboratorios_farmacia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos_farmacia    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes_farmacia        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_farmacia  ENABLE ROW LEVEL SECURITY;

-- Todo el equipo LEE (el cajero necesita consultar stock y equivalentes)
DROP POLICY IF EXISTS "prov_select" ON public.proveedores_farmacia;
CREATE POLICY "prov_select" ON public.proveedores_farmacia
  FOR SELECT TO authenticated USING (public.es_miembro(negocio_id) OR public.is_admin());
DROP POLICY IF EXISTS "lab_select" ON public.laboratorios_farmacia;
CREATE POLICY "lab_select" ON public.laboratorios_farmacia
  FOR SELECT TO authenticated USING (public.es_miembro(negocio_id) OR public.is_admin());
DROP POLICY IF EXISTS "prod_select" ON public.productos_farmacia;
CREATE POLICY "prod_select" ON public.productos_farmacia
  FOR SELECT TO authenticated USING (public.es_miembro(negocio_id) OR public.is_admin());
DROP POLICY IF EXISTS "lote_select" ON public.lotes_farmacia;
CREATE POLICY "lote_select" ON public.lotes_farmacia
  FOR SELECT TO authenticated USING (public.es_miembro(negocio_id) OR public.is_admin());
DROP POLICY IF EXISTS "mov_select" ON public.movimientos_farmacia;
CREATE POLICY "mov_select" ON public.movimientos_farmacia
  FOR SELECT TO authenticated USING (public.es_miembro(negocio_id) OR public.is_admin());

-- Solo GESTORES (dueño/regente) escriben catálogos, productos y lotes
DROP POLICY IF EXISTS "prov_write" ON public.proveedores_farmacia;
CREATE POLICY "prov_write" ON public.proveedores_farmacia
  FOR ALL TO authenticated
  USING      (public.es_gestor(negocio_id) OR public.is_admin())
  WITH CHECK (public.es_gestor(negocio_id) OR public.is_admin());
DROP POLICY IF EXISTS "lab_write" ON public.laboratorios_farmacia;
CREATE POLICY "lab_write" ON public.laboratorios_farmacia
  FOR ALL TO authenticated
  USING      (public.es_gestor(negocio_id) OR public.is_admin())
  WITH CHECK (public.es_gestor(negocio_id) OR public.is_admin());

DROP POLICY IF EXISTS "prod_insert" ON public.productos_farmacia;
CREATE POLICY "prod_insert" ON public.productos_farmacia
  FOR INSERT TO authenticated
  WITH CHECK (public.es_gestor(negocio_id) OR public.is_admin());

DROP POLICY IF EXISTS "prod_update" ON public.productos_farmacia;
CREATE POLICY "prod_update" ON public.productos_farmacia
  FOR UPDATE TO authenticated
  USING      (public.es_gestor(negocio_id) OR public.is_admin())
  WITH CHECK (public.es_gestor(negocio_id) OR public.is_admin());

-- Eliminación definitiva: SOLO dueño (el regente inactiva, no borra)
DROP POLICY IF EXISTS "prod_delete" ON public.productos_farmacia;
CREATE POLICY "prod_delete" ON public.productos_farmacia
  FOR DELETE TO authenticated
  USING (public.es_dueno(negocio_id) OR public.is_admin());

DROP POLICY IF EXISTS "lote_write" ON public.lotes_farmacia;
CREATE POLICY "lote_write" ON public.lotes_farmacia
  FOR ALL TO authenticated
  USING      (public.es_gestor(negocio_id) OR public.is_admin())
  WITH CHECK (public.es_gestor(negocio_id) OR public.is_admin());

-- Movimientos: se INSERTAN (por las RPC) pero NUNCA se editan ni se borran.
-- Historial imborrable: sin policy de UPDATE/DELETE no hay forma de tocarlos.
DROP POLICY IF EXISTS "mov_insert" ON public.movimientos_farmacia;
CREATE POLICY "mov_insert" ON public.movimientos_farmacia
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.es_gestor(negocio_id) OR public.is_admin())
    AND user_id = auth.uid()
  );

-- ── 9. Verificación ───────────────────────────────────────────────────────────
SELECT tablename,
       CASE WHEN rowsecurity THEN '✅ RLS' ELSE '❌ SIN RLS' END AS seguridad
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE '%farmacia%'
ORDER BY tablename;
