-- ─────────────────────────────────────────────────────────────────────────────
-- Portal Restaurante — mesas, menú, órdenes, caja
-- Ejecutar en: Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mesas_rest (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id   UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero      INTEGER NOT NULL,
  capacidad   INTEGER NOT NULL DEFAULT 4,
  estado      TEXT    NOT NULL DEFAULT 'libre' CHECK (estado IN ('libre','ocupada','reservada','cerrada')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (agente_id, numero)
);

CREATE TABLE IF NOT EXISTS public.menu_categorias (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id   UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      TEXT    NOT NULL,
  orden       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.menu_items_rest (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria_id UUID    REFERENCES public.menu_categorias(id) ON DELETE SET NULL,
  nombre       TEXT    NOT NULL,
  descripcion  TEXT,
  precio       NUMERIC(10,2) NOT NULL DEFAULT 0,
  disponible   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ordenes_rest (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id   UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mesa_id     UUID    REFERENCES public.mesas_rest(id) ON DELETE SET NULL,
  estado      TEXT    NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','pagada','cancelada')),
  total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  notas       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  cerrada_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.items_orden_rest (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  orden_id        UUID    NOT NULL REFERENCES public.ordenes_rest(id) ON DELETE CASCADE,
  menu_item_id    UUID    NOT NULL REFERENCES public.menu_items_rest(id) ON DELETE RESTRICT,
  cantidad        INTEGER NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(10,2) NOT NULL,
  subtotal        NUMERIC(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  estado          TEXT    NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','preparando','listo','entregado')),
  nota            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pagos_rest (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  orden_id    UUID    NOT NULL REFERENCES public.ordenes_rest(id) ON DELETE CASCADE,
  agente_id   UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monto       NUMERIC(12,2) NOT NULL,
  metodo      TEXT    NOT NULL DEFAULT 'efectivo' CHECK (metodo IN ('efectivo','tarjeta','transferencia')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mesas_rest_agente        ON public.mesas_rest(agente_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_agente        ON public.menu_items_rest(agente_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_rest_agente      ON public.ordenes_rest(agente_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_rest_mesa        ON public.ordenes_rest(mesa_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_rest_estado      ON public.ordenes_rest(estado);

-- ── Trigger: recalcular total de orden ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.actualizar_total_orden_rest()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.ordenes_rest
  SET total = (SELECT COALESCE(SUM(subtotal),0) FROM public.items_orden_rest WHERE orden_id = COALESCE(NEW.orden_id, OLD.orden_id))
  WHERE id = COALESCE(NEW.orden_id, OLD.orden_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_total_orden_rest
  AFTER INSERT OR UPDATE OR DELETE ON public.items_orden_rest
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_total_orden_rest();

-- ── Trigger: liberar mesa al cerrar orden ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gestionar_estado_mesa()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado IN ('pagada','cancelada') AND OLD.estado = 'abierta' THEN
    NEW.cerrada_at := NOW();
    IF NEW.mesa_id IS NOT NULL THEN
      UPDATE public.mesas_rest SET estado = 'libre' WHERE id = NEW.mesa_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_gestionar_mesa
  BEFORE UPDATE ON public.ordenes_rest
  FOR EACH ROW EXECUTE FUNCTION public.gestionar_estado_mesa();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.mesas_rest        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categorias   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items_rest   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes_rest      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items_orden_rest  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_rest        ENABLE ROW LEVEL SECURITY;

-- Requiere public.is_admin() (definida en security_fixes.sql).
-- Admin/superadmin ven y gestionan los datos de todos los agentes.
DROP POLICY IF EXISTS "agente_own_mesas" ON public.mesas_rest;
CREATE POLICY "agente_own_mesas" ON public.mesas_rest
  FOR ALL TO authenticated
  USING      (agente_id = auth.uid() OR public.is_admin())
  WITH CHECK (agente_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "agente_own_menu_cat" ON public.menu_categorias;
CREATE POLICY "agente_own_menu_cat" ON public.menu_categorias
  FOR ALL TO authenticated
  USING      (agente_id = auth.uid() OR public.is_admin())
  WITH CHECK (agente_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "agente_own_menu_items" ON public.menu_items_rest;
CREATE POLICY "agente_own_menu_items" ON public.menu_items_rest
  FOR ALL TO authenticated
  USING      (agente_id = auth.uid() OR public.is_admin())
  WITH CHECK (agente_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "agente_own_ordenes_rest" ON public.ordenes_rest;
CREATE POLICY "agente_own_ordenes_rest" ON public.ordenes_rest
  FOR ALL TO authenticated
  USING      (agente_id = auth.uid() OR public.is_admin())
  WITH CHECK (agente_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "agente_own_items_orden" ON public.items_orden_rest;
CREATE POLICY "agente_own_items_orden" ON public.items_orden_rest
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.ordenes_rest o WHERE o.id = orden_id AND o.agente_id = auth.uid())
    OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.ordenes_rest o WHERE o.id = orden_id AND o.agente_id = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "agente_own_pagos_rest" ON public.pagos_rest;
CREATE POLICY "agente_own_pagos_rest" ON public.pagos_rest
  FOR ALL TO authenticated
  USING      (agente_id = auth.uid() OR public.is_admin())
  WITH CHECK (agente_id = auth.uid() OR public.is_admin());
