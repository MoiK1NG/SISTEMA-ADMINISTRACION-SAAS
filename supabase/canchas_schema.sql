-- =============================================================================
-- SCHEMA: Portal de Canchas Sintéticas
-- =============================================================================
-- Ejecutar en: Supabase SQL Editor
-- Dependencias: is_admin(), set_updated_at() ya deben existir
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. ENUMs
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE estado_pago_reserva AS ENUM ('pagado', 'debe_sena', 'pendiente');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE estado_reserva AS ENUM ('confirmada', 'cancelada', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- -----------------------------------------------------------------------------
-- 2. TABLA: canchas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.canchas (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id   uuid    NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  nombre      text    NOT NULL,
  tipo        text    NOT NULL DEFAULT 'Fútbol 5',   -- "Fútbol 5", "Fútbol 7", etc.
  descripcion text,
  precio_hora numeric(10,2) NOT NULL DEFAULT 0,
  orden       int     NOT NULL DEFAULT 0,            -- posición en el grid
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_canchas_agente_id ON public.canchas(agente_id);
CREATE INDEX IF NOT EXISTS idx_canchas_orden     ON public.canchas(orden);


-- -----------------------------------------------------------------------------
-- 3. TABLA: reservas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservas (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id        uuid    NOT NULL REFERENCES public.profiles(id)  ON DELETE RESTRICT,
  cancha_id        uuid    NOT NULL REFERENCES public.canchas(id)   ON DELETE RESTRICT,

  -- Cliente (desnormalizado para velocidad; sin FK para no requerir tabla clientes)
  cliente_nombre   text    NOT NULL,
  cliente_telefono text,

  -- Horario
  fecha            date    NOT NULL,
  hora_inicio      int     NOT NULL CHECK (hora_inicio >= 0  AND hora_inicio < 24),
  hora_fin         int     NOT NULL CHECK (hora_fin    > 0   AND hora_fin    <= 24),

  -- Financiero
  monto            numeric(10,2) NOT NULL DEFAULT 0,
  monto_pagado     numeric(10,2) NOT NULL DEFAULT 0,
  estado_pago      estado_pago_reserva NOT NULL DEFAULT 'pendiente',

  -- Estado de la reserva
  estado           estado_reserva      NOT NULL DEFAULT 'confirmada',

  nota             text,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- No se puede solapar la misma cancha en el mismo horario
  CONSTRAINT reservas_sin_solapamiento EXCLUDE USING gist (
    cancha_id WITH =,
    fecha     WITH =,
    int4range(hora_inicio, hora_fin) WITH &&
  )
);

CREATE INDEX IF NOT EXISTS idx_reservas_agente_id  ON public.reservas(agente_id);
CREATE INDEX IF NOT EXISTS idx_reservas_cancha_id  ON public.reservas(cancha_id);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha       ON public.reservas(fecha);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha_agente ON public.reservas(agente_id, fecha);


-- -----------------------------------------------------------------------------
-- 4. EXTENSIÓN para la restricción EXCLUDE (anti-solapamiento)
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;


-- =============================================================================
-- 5. VISTA: kpis_canchas_agente
-- =============================================================================
-- security_invoker: la vista respeta la RLS de `reservas` del usuario que consulta
CREATE OR REPLACE VIEW public.kpis_canchas_agente
WITH (security_invoker = true) AS
SELECT
  r.agente_id,
  r.fecha,
  COUNT(*)                                                    AS total_reservas,
  COALESCE(SUM(r.monto), 0)                                   AS ingresos_brutos,
  COALESCE(SUM(r.monto_pagado), 0)                            AS ingresos_cobrados,
  COUNT(*) FILTER (WHERE r.estado_pago = 'pagado')            AS reservas_pagadas,
  COUNT(*) FILTER (WHERE r.estado_pago = 'debe_sena')         AS reservas_con_sena,
  COUNT(*) FILTER (WHERE r.estado_pago = 'pendiente')         AS reservas_pendientes,
  COUNT(*) FILTER (WHERE r.estado      = 'cancelada')         AS reservas_canceladas,
  SUM(r.hora_fin - r.hora_inicio)                             AS horas_reservadas
FROM public.reservas r
WHERE r.estado != 'cancelada'
GROUP BY r.agente_id, r.fecha;

REVOKE ALL ON public.kpis_canchas_agente FROM anon;


-- =============================================================================
-- 6. FUNCIÓN: reservas_del_dia
-- Devuelve las reservas de un agente para una fecha específica,
-- con el nombre de la cancha incluido (para evitar un JOIN en el cliente).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reservas_del_dia(p_fecha date)
RETURNS TABLE (
  id               uuid,
  cancha_id        uuid,
  cancha_nombre    text,
  cancha_tipo      text,
  cliente_nombre   text,
  cliente_telefono text,
  hora_inicio      int,
  hora_fin         int,
  monto            numeric,
  monto_pagado     numeric,
  estado_pago      estado_pago_reserva,
  estado           estado_reserva,
  nota             text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    r.id,
    r.cancha_id,
    c.nombre   AS cancha_nombre,
    c.tipo     AS cancha_tipo,
    r.cliente_nombre,
    r.cliente_telefono,
    r.hora_inicio,
    r.hora_fin,
    r.monto,
    r.monto_pagado,
    r.estado_pago,
    r.estado,
    r.nota
  FROM public.reservas r
  JOIN public.canchas  c ON c.id = r.cancha_id
  WHERE r.agente_id = auth.uid()
    AND r.fecha     = p_fecha
    AND r.estado   != 'cancelada'
  ORDER BY r.hora_inicio, c.orden;
$$;


-- =============================================================================
-- 7. ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.canchas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

-- ── canchas ──
DROP POLICY IF EXISTS "canchas_agente" ON public.canchas;
CREATE POLICY "canchas_agente" ON public.canchas
  FOR ALL TO authenticated
  USING    (agente_id = auth.uid() OR public.is_admin())
  WITH CHECK (agente_id = auth.uid() OR public.is_admin());

-- ── reservas ──
DROP POLICY IF EXISTS "reservas_agente" ON public.reservas;
CREATE POLICY "reservas_agente" ON public.reservas
  FOR ALL TO authenticated
  USING    (agente_id = auth.uid() OR public.is_admin())
  WITH CHECK (agente_id = auth.uid() OR public.is_admin());


-- =============================================================================
-- 8. TRIGGERS: updated_at
-- =============================================================================
DROP TRIGGER IF EXISTS trg_canchas_updated_at  ON public.canchas;
CREATE TRIGGER trg_canchas_updated_at
  BEFORE UPDATE ON public.canchas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_reservas_updated_at ON public.reservas;
CREATE TRIGGER trg_reservas_updated_at
  BEFORE UPDATE ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- 9. DATOS DE EJEMPLO (opcional — comentar si no quieres datos de prueba)
-- =============================================================================
DO $$
DECLARE
  v_agente uuid;
  v_c1 uuid; v_c2 uuid; v_c3 uuid; v_c4 uuid;
  v_hoy date := CURRENT_DATE;
BEGIN
  -- Usar el primer superadmin como agente de prueba
  SELECT id INTO v_agente FROM public.profiles
  WHERE role = 'superadmin' LIMIT 1;

  IF v_agente IS NULL THEN
    RAISE NOTICE 'No se encontró superadmin — omitiendo datos de ejemplo';
    RETURN;
  END IF;

  -- Canchas
  INSERT INTO public.canchas (agente_id, nombre, tipo, precio_hora, orden) VALUES
    (v_agente, 'Cancha 1', 'Fútbol 5  · Sintética',  1500, 1),
    (v_agente, 'Cancha 2', 'Fútbol 7  · Sintética',  1800, 2),
    (v_agente, 'Cancha 3', 'Fútbol 5  · Sintética',  1500, 3),
    (v_agente, 'Cancha 4', 'Fútbol 11 · Natural',    2500, 4)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_c1;

  -- Re-obtener IDs por nombre (INSERT…RETURNING solo devuelve la última)
  SELECT id INTO v_c1 FROM public.canchas WHERE agente_id = v_agente AND nombre = 'Cancha 1';
  SELECT id INTO v_c2 FROM public.canchas WHERE agente_id = v_agente AND nombre = 'Cancha 2';
  SELECT id INTO v_c3 FROM public.canchas WHERE agente_id = v_agente AND nombre = 'Cancha 3';
  SELECT id INTO v_c4 FROM public.canchas WHERE agente_id = v_agente AND nombre = 'Cancha 4';

  -- Reservas de hoy
  INSERT INTO public.reservas
    (agente_id, cancha_id, cliente_nombre, fecha, hora_inicio, hora_fin, monto, monto_pagado, estado_pago)
  VALUES
    (v_agente, v_c1, 'Carlos Méndez',      v_hoy, 16, 17, 1500, 1500, 'pagado'),
    (v_agente, v_c1, 'Equipo Los Primos',   v_hoy, 18, 20, 3000,  500, 'debe_sena'),
    (v_agente, v_c1, 'María González',      v_hoy, 21, 22, 1500, 1500, 'pagado'),
    (v_agente, v_c2, 'FC Barrio Norte',     v_hoy, 17, 19, 2800, 2800, 'pagado'),
    (v_agente, v_c2, 'Juan Pérez',          v_hoy, 20, 21, 1400,    0, 'pendiente'),
    (v_agente, v_c2, 'Empresa Torneo',      v_hoy, 22, 23, 1400, 1400, 'pagado'),
    (v_agente, v_c3, 'Los Cracks FC',       v_hoy, 16, 18, 2200, 1000, 'debe_sena'),
    (v_agente, v_c3, 'Ana Rodríguez',       v_hoy, 19, 20, 1100, 1100, 'pagado'),
    (v_agente, v_c3, 'Peña Deportiva Sur',  v_hoy, 21, 23, 2200, 2200, 'pagado'),
    (v_agente, v_c4, 'Torneo Empresarial',  v_hoy, 17, 21, 8000, 8000, 'pagado'),
    (v_agente, v_c4, 'Club Deportivo Este', v_hoy, 22, 23, 2000, 1000, 'debe_sena')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Datos de ejemplo creados para agente %', v_agente;
END $$;
