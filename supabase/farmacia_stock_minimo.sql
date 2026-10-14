-- ─────────────────────────────────────────────────────────────────────────────
-- FARMACIA · Stock mínimo por producto
-- Ejecutar en: Supabase → SQL Editor. Requiere farmacia_fase5_multimoneda.sql.
-- Idempotente: se puede correr más de una vez.
--
-- Qué resuelve: nada avisaba cuando un producto se estaba acabando (solo el
-- filtro "Sin stock" = 0 unidades). Cada producto puede tener un stock mínimo
-- (0 = sin alerta). La vista stock_farmacia dice si está por debajo, el
-- inventario lo filtra y el inicio del portal lo muestra en "Alertas de hoy".
--
-- Correr ANTES de desplegar el PR de alertas: el inicio y el inventario leen
-- las columnas nuevas de la vista.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Columna ────────────────────────────────────────────────────────────────
ALTER TABLE public.productos_farmacia
  ADD COLUMN IF NOT EXISTS stock_minimo NUMERIC(12,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'productos_farmacia_stock_minimo_check') THEN
    ALTER TABLE public.productos_farmacia
      ADD CONSTRAINT productos_farmacia_stock_minimo_check CHECK (stock_minimo >= 0);
  END IF;
END $$;

-- ── 2. Vista de stock: columnas nuevas AL FINAL (CREATE OR REPLACE no deja
--      tocar las existentes). p.id es PK: activo y stock_minimo se seleccionan
--      sin sumarlos al GROUP BY.
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
  ) AS lotes_sin_fecha,
  p.activo,                                                              -- ★ nuevo
  p.stock_minimo,                                                        -- ★ nuevo
  (p.activo AND p.stock_minimo > 0
     AND COALESCE(SUM(l.cantidad_venta), 0) + COALESCE(SUM(l.cantidad_bodega), 0) < p.stock_minimo
  ) AS bajo_minimo                                                       -- ★ nuevo
FROM public.productos_farmacia p
LEFT JOIN public.lotes_farmacia l ON l.producto_id = p.id
GROUP BY p.id, p.negocio_id;

-- ── 3. Historial: el trigger registra también stock_minimo ────────────────────
-- Misma función de farmacia_fase5_multimoneda.sql con un campo más. El trigger
-- trg_productos_farmacia_historial ya apunta acá: no se recrea.
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
    'requiere_receta', 'activo', 'laboratorio_id', 'proveedor_id',
    'stock_minimo'                                                       -- ★ nuevo
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

-- ── 4. Verificación: las 3 últimas columnas deben ser activo, stock_minimo, bajo_minimo
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'stock_farmacia'
ORDER BY ordinal_position;
