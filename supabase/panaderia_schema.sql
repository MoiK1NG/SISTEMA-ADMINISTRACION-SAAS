-- ─────────────────────────────────────────────────────────────────────────────
-- Portal Panadería — producción, ventas e inventario
-- Ejecutar en: Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.productos_pan (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id       UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre          TEXT    NOT NULL,
  categoria       TEXT    NOT NULL DEFAULT 'pan' CHECK (categoria IN ('pan','bizcocho','reposteria','bebida','otro')),
  precio_venta    NUMERIC(10,2) NOT NULL DEFAULT 0,
  costo_produccion NUMERIC(10,2) NOT NULL DEFAULT 0,
  unidad          TEXT    NOT NULL DEFAULT 'unidad',
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.insumos_pan (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre       TEXT    NOT NULL,
  unidad       TEXT    NOT NULL DEFAULT 'lb',
  stock_actual NUMERIC(10,3) NOT NULL DEFAULT 0,
  stock_minimo NUMERIC(10,3) NOT NULL DEFAULT 0,
  precio_unidad NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ordenes_produccion (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id   UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha       DATE    NOT NULL DEFAULT CURRENT_DATE,
  estado      TEXT    NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_proceso','completada','cancelada')),
  notas       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.items_produccion (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  orden_id     UUID    NOT NULL REFERENCES public.ordenes_produccion(id) ON DELETE CASCADE,
  producto_id  UUID    NOT NULL REFERENCES public.productos_pan(id) ON DELETE RESTRICT,
  cantidad_plan   INTEGER NOT NULL DEFAULT 1,
  cantidad_real   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ventas_pan (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id   UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha       DATE    NOT NULL DEFAULT CURRENT_DATE,
  total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  notas       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.items_venta_pan (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  venta_id        UUID    NOT NULL REFERENCES public.ventas_pan(id) ON DELETE CASCADE,
  producto_id     UUID    NOT NULL REFERENCES public.productos_pan(id) ON DELETE RESTRICT,
  cantidad        INTEGER NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(10,2) NOT NULL,
  subtotal        NUMERIC(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

CREATE TABLE IF NOT EXISTS public.movimientos_insumos (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  insumo_id   UUID    NOT NULL REFERENCES public.insumos_pan(id) ON DELETE CASCADE,
  agente_id   UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo        TEXT    NOT NULL CHECK (tipo IN ('entrada','salida','ajuste')),
  cantidad    NUMERIC(10,3) NOT NULL,
  fecha       DATE    NOT NULL DEFAULT CURRENT_DATE,
  nota        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_productos_pan_agente       ON public.productos_pan(agente_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_prod_agente_fecha  ON public.ordenes_produccion(agente_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_pan_agente_fecha    ON public.ventas_pan(agente_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_insumos_pan_agente         ON public.insumos_pan(agente_id);

-- ── Trigger: actualizar total de venta ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.actualizar_total_venta_pan()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.ventas_pan
  SET total = (SELECT COALESCE(SUM(subtotal),0) FROM public.items_venta_pan WHERE venta_id = COALESCE(NEW.venta_id, OLD.venta_id))
  WHERE id = COALESCE(NEW.venta_id, OLD.venta_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_total_venta_pan
  AFTER INSERT OR UPDATE OR DELETE ON public.items_venta_pan
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_total_venta_pan();

-- ── Trigger: movimiento actualiza stock ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.actualizar_stock_insumo()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.insumos_pan SET
    stock_actual = stock_actual + CASE NEW.tipo
      WHEN 'entrada' THEN  NEW.cantidad
      WHEN 'salida'  THEN -NEW.cantidad
      ELSE 0
    END
  WHERE id = NEW.insumo_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_stock_insumo
  AFTER INSERT ON public.movimientos_insumos
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_stock_insumo();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.productos_pan       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos_pan         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes_produccion  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items_produccion    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas_pan          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items_venta_pan     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agente_own_productos_pan"      ON public.productos_pan      USING (agente_id = auth.uid());
CREATE POLICY "agente_own_insumos_pan"        ON public.insumos_pan        USING (agente_id = auth.uid());
CREATE POLICY "agente_own_ordenes_prod"       ON public.ordenes_produccion USING (agente_id = auth.uid());
CREATE POLICY "agente_own_items_prod"         ON public.items_produccion   USING (EXISTS (SELECT 1 FROM public.ordenes_produccion o WHERE o.id = orden_id AND o.agente_id = auth.uid()));
CREATE POLICY "agente_own_ventas_pan"         ON public.ventas_pan         USING (agente_id = auth.uid());
CREATE POLICY "agente_own_items_venta_pan"    ON public.items_venta_pan    USING (EXISTS (SELECT 1 FROM public.ventas_pan v WHERE v.id = venta_id AND v.agente_id = auth.uid()));
CREATE POLICY "agente_own_movimientos_ins"    ON public.movimientos_insumos USING (agente_id = auth.uid());
