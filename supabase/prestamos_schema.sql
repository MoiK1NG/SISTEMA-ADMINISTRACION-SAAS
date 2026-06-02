-- =============================================================================
-- SCHEMA: Portal de Préstamos
-- Modelo: Interés sobre saldo | Frecuencias: diario/semanal/quincenal/mensual
-- =============================================================================
-- Ejecutar en: Supabase SQL Editor
-- Orden: ejecutar TODO de una vez (las dependencias están ordenadas)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. ENUM: frecuencia de pago
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE frecuencia_pago AS ENUM ('diario', 'semanal', 'quincenal', 'mensual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE estado_prestamo AS ENUM ('pendiente', 'activo', 'al_dia', 'en_mora', 'pagado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE estado_cuota AS ENUM ('pendiente', 'pagada', 'parcial', 'vencida');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- -----------------------------------------------------------------------------
-- 2. TABLA: clientes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clientes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  nombre       text NOT NULL,
  cedula       text,
  telefono     text,
  direccion    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT clientes_cedula_agente_unique UNIQUE (agente_id, cedula)
);

CREATE INDEX IF NOT EXISTS idx_clientes_agente_id ON public.clientes(agente_id);
CREATE INDEX IF NOT EXISTS idx_clientes_cedula    ON public.clientes(cedula);


-- -----------------------------------------------------------------------------
-- 3. TABLA: prestamos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prestamos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id         uuid NOT NULL REFERENCES public.profiles(id)  ON DELETE RESTRICT,
  cliente_id        uuid NOT NULL REFERENCES public.clientes(id)  ON DELETE RESTRICT,

  -- Términos financieros
  monto_principal   numeric(12,2) NOT NULL CHECK (monto_principal > 0),
  tasa_interes      numeric(6,4)  NOT NULL CHECK (tasa_interes >= 0),  -- tasa por período (ej: 0.05 = 5%)
  frecuencia        frecuencia_pago NOT NULL DEFAULT 'mensual',
  num_cuotas        int           NOT NULL CHECK (num_cuotas > 0),

  -- Saldo vivo
  saldo_pendiente   numeric(12,2) NOT NULL,

  -- Fechas
  fecha_inicio      date          NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento date          NOT NULL,  -- calculada al crear

  -- Estado
  estado            estado_prestamo NOT NULL DEFAULT 'activo',

  -- Totales calculados (desnormalizados para KPIs rápidos)
  total_interes     numeric(12,2) NOT NULL DEFAULT 0,
  total_pagado      numeric(12,2) NOT NULL DEFAULT 0,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prestamos_agente_id   ON public.prestamos(agente_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_cliente_id  ON public.prestamos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_estado      ON public.prestamos(estado);
CREATE INDEX IF NOT EXISTS idx_prestamos_fecha_vcto  ON public.prestamos(fecha_vencimiento);


-- -----------------------------------------------------------------------------
-- 4. TABLA: cuotas  (plan de pagos generado automáticamente)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cuotas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestamo_id      uuid NOT NULL REFERENCES public.prestamos(id) ON DELETE CASCADE,
  agente_id        uuid NOT NULL REFERENCES public.profiles(id)  ON DELETE RESTRICT,

  numero           int          NOT NULL,  -- 1, 2, 3 … num_cuotas
  fecha_vencimiento date        NOT NULL,
  saldo_inicial    numeric(12,2) NOT NULL,  -- saldo al inicio de este período
  interes          numeric(12,2) NOT NULL,  -- saldo_inicial × tasa
  capital          numeric(12,2) NOT NULL,  -- porción que reduce el saldo
  monto_cuota      numeric(12,2) NOT NULL,  -- interes + capital
  monto_pagado     numeric(12,2) NOT NULL DEFAULT 0,
  fecha_pago       date,
  estado           estado_cuota NOT NULL DEFAULT 'pendiente',

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  UNIQUE (prestamo_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_cuotas_prestamo_id        ON public.cuotas(prestamo_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_agente_id          ON public.cuotas(agente_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_fecha_vencimiento  ON public.cuotas(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_cuotas_estado             ON public.cuotas(estado);


-- -----------------------------------------------------------------------------
-- 5. TABLA: pagos  (registro de cada abono recibido)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pagos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cuota_id      uuid NOT NULL REFERENCES public.cuotas(id)    ON DELETE RESTRICT,
  prestamo_id   uuid NOT NULL REFERENCES public.prestamos(id) ON DELETE RESTRICT,
  agente_id     uuid NOT NULL REFERENCES public.profiles(id)  ON DELETE RESTRICT,

  monto         numeric(12,2) NOT NULL CHECK (monto > 0),
  fecha_pago    date          NOT NULL DEFAULT CURRENT_DATE,
  nota          text,

  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagos_cuota_id    ON public.pagos(cuota_id);
CREATE INDEX IF NOT EXISTS idx_pagos_prestamo_id ON public.pagos(prestamo_id);
CREATE INDEX IF NOT EXISTS idx_pagos_agente_id   ON public.pagos(agente_id);


-- =============================================================================
-- 6. FUNCIÓN: generar_cuotas_interes_saldo
-- Genera el plan de pagos completo usando interés sobre saldo decreciente.
-- Se llama automáticamente después de insertar en prestamos.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.generar_cuotas_interes_saldo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo       numeric(12,2);
  v_interes     numeric(12,2);
  v_capital     numeric(12,2);
  v_cuota       numeric(12,2);
  v_fecha       date;
  v_dias        int;
  i             int;
  v_total_int   numeric(12,2) := 0;
BEGIN
  v_saldo := NEW.monto_principal;
  v_fecha := NEW.fecha_inicio;

  -- Días entre cuotas según frecuencia
  v_dias := CASE NEW.frecuencia
    WHEN 'diario'     THEN 1
    WHEN 'semanal'    THEN 7
    WHEN 'quincenal'  THEN 15
    WHEN 'mensual'    THEN 30
  END;

  -- Cuota fija de capital (igual para todas las cuotas)
  v_capital := ROUND(NEW.monto_principal / NEW.num_cuotas, 2);

  FOR i IN 1..NEW.num_cuotas LOOP
    v_fecha   := NEW.fecha_inicio + (v_dias * i);
    v_interes := ROUND(v_saldo * NEW.tasa_interes, 2);

    -- Última cuota: ajuste por redondeo
    IF i = NEW.num_cuotas THEN
      v_capital := v_saldo;
    END IF;

    v_cuota := v_interes + v_capital;
    v_total_int := v_total_int + v_interes;

    INSERT INTO public.cuotas (
      prestamo_id, agente_id, numero,
      fecha_vencimiento, saldo_inicial,
      interes, capital, monto_cuota, estado
    ) VALUES (
      NEW.id, NEW.agente_id, i,
      v_fecha, v_saldo,
      v_interes, v_capital, v_cuota, 'pendiente'
    );

    v_saldo := v_saldo - v_capital;
  END LOOP;

  -- Actualizar totales en el préstamo
  UPDATE public.prestamos SET
    total_interes    = v_total_int,
    fecha_vencimiento = v_fecha,      -- última fecha de cuota
    updated_at       = now()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generar_cuotas ON public.prestamos;
CREATE TRIGGER trg_generar_cuotas
  AFTER INSERT ON public.prestamos
  FOR EACH ROW EXECUTE FUNCTION public.generar_cuotas_interes_saldo();


-- =============================================================================
-- 7. FUNCIÓN: registrar_pago
-- Aplica un abono a la cuota más antigua pendiente/vencida del préstamo.
-- Actualiza estado de cuota y saldo del préstamo.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.registrar_pago(
  p_prestamo_id uuid,
  p_monto       numeric,
  p_fecha       date DEFAULT CURRENT_DATE,
  p_nota        text DEFAULT NULL
)
RETURNS uuid   -- devuelve el id del pago creado
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cuota       record;
  v_pago_id     uuid;
  v_restante    numeric := p_monto;
  v_nuevo_pagado numeric;
BEGIN
  -- Verificar que el agente sea dueño del préstamo
  IF NOT EXISTS (
    SELECT 1 FROM public.prestamos
    WHERE id = p_prestamo_id AND agente_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Aplicar el monto a cuotas en orden (la más antigua primero)
  FOR v_cuota IN
    SELECT * FROM public.cuotas
    WHERE prestamo_id = p_prestamo_id
      AND estado IN ('pendiente', 'vencida', 'parcial')
    ORDER BY numero ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_restante <= 0;

    v_nuevo_pagado := v_cuota.monto_pagado + LEAST(v_restante, v_cuota.monto_cuota - v_cuota.monto_pagado);
    v_restante     := v_restante - (v_nuevo_pagado - v_cuota.monto_pagado);

    UPDATE public.cuotas SET
      monto_pagado = v_nuevo_pagado,
      fecha_pago   = CASE WHEN v_nuevo_pagado >= monto_cuota THEN p_fecha ELSE NULL END,
      estado       = CASE
                       WHEN v_nuevo_pagado >= monto_cuota           THEN 'pagada'
                       WHEN v_nuevo_pagado > 0                       THEN 'parcial'
                       ELSE estado
                     END,
      updated_at   = now()
    WHERE id = v_cuota.id;
  END LOOP;

  -- Insertar registro de pago
  INSERT INTO public.pagos (cuota_id, prestamo_id, agente_id, monto, fecha_pago, nota)
  SELECT
    (SELECT id FROM public.cuotas
     WHERE prestamo_id = p_prestamo_id
       AND estado IN ('pagada','parcial')
     ORDER BY numero DESC LIMIT 1),
    p_prestamo_id,
    auth.uid(),
    p_monto,
    p_fecha,
    p_nota
  RETURNING id INTO v_pago_id;

  -- Actualizar totales y estado del préstamo
  UPDATE public.prestamos SET
    total_pagado    = total_pagado + p_monto,
    saldo_pendiente = saldo_pendiente - p_monto,
    estado = CASE
      WHEN saldo_pendiente - p_monto <= 0 THEN 'pagado'
      WHEN EXISTS (
        SELECT 1 FROM public.cuotas
        WHERE prestamo_id = p_prestamo_id
          AND estado = 'vencida'
      ) THEN 'en_mora'
      ELSE 'al_dia'
    END,
    updated_at = now()
  WHERE id = p_prestamo_id;

  RETURN v_pago_id;
END;
$$;


-- =============================================================================
-- 8. FUNCIÓN: actualizar_mora  (ejecutar via cron diario)
-- Marca como 'vencida' cualquier cuota cuya fecha ya pasó y no se pagó.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.actualizar_mora()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vencer cuotas atrasadas
  UPDATE public.cuotas SET
    estado     = 'vencida',
    updated_at = now()
  WHERE estado IN ('pendiente', 'parcial')
    AND fecha_vencimiento < CURRENT_DATE;

  -- Marcar préstamos en mora
  UPDATE public.prestamos SET
    estado     = 'en_mora',
    updated_at = now()
  WHERE estado = 'al_dia'
    AND id IN (
      SELECT DISTINCT prestamo_id FROM public.cuotas WHERE estado = 'vencida'
    );
END;
$$;


-- =============================================================================
-- 9. ROW LEVEL SECURITY
-- Agente: solo ve y modifica sus propios registros.
-- Admin/Superadmin: acceso total.
-- =============================================================================

ALTER TABLE public.clientes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuotas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos     ENABLE ROW LEVEL SECURITY;

-- ── clientes ──
DROP POLICY IF EXISTS "clientes_agente"  ON public.clientes;
CREATE POLICY "clientes_agente" ON public.clientes
  FOR ALL TO authenticated
  USING    (agente_id = auth.uid() OR public.is_admin())
  WITH CHECK (agente_id = auth.uid() OR public.is_admin());

-- ── prestamos ──
DROP POLICY IF EXISTS "prestamos_agente" ON public.prestamos;
CREATE POLICY "prestamos_agente" ON public.prestamos
  FOR ALL TO authenticated
  USING    (agente_id = auth.uid() OR public.is_admin())
  WITH CHECK (agente_id = auth.uid() OR public.is_admin());

-- ── cuotas ──
DROP POLICY IF EXISTS "cuotas_agente" ON public.cuotas;
CREATE POLICY "cuotas_agente" ON public.cuotas
  FOR ALL TO authenticated
  USING    (agente_id = auth.uid() OR public.is_admin())
  WITH CHECK (agente_id = auth.uid() OR public.is_admin());

-- ── pagos ──
DROP POLICY IF EXISTS "pagos_agente" ON public.pagos;
CREATE POLICY "pagos_agente" ON public.pagos
  FOR ALL TO authenticated
  USING    (agente_id = auth.uid() OR public.is_admin())
  WITH CHECK (agente_id = auth.uid() OR public.is_admin());


-- =============================================================================
-- 10. TRIGGERS: updated_at automático
-- =============================================================================
DROP TRIGGER IF EXISTS trg_clientes_updated_at  ON public.clientes;
CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_prestamos_updated_at ON public.prestamos;
CREATE TRIGGER trg_prestamos_updated_at
  BEFORE UPDATE ON public.prestamos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_cuotas_updated_at    ON public.cuotas;
CREATE TRIGGER trg_cuotas_updated_at
  BEFORE UPDATE ON public.cuotas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- 11. VISTA: kpis_agente  (para el dashboard del portal, query de 1 línea)
-- =============================================================================
CREATE OR REPLACE VIEW public.kpis_agente AS
SELECT
  p.agente_id,
  COUNT(*)                                          AS total_prestamos,
  COALESCE(SUM(p.monto_principal), 0)               AS total_prestado,
  COALESCE(SUM(p.total_pagado), 0)                  AS capital_recuperado,
  COALESCE(SUM(p.saldo_pendiente), 0)               AS cartera_vigente,
  COUNT(*) FILTER (WHERE p.estado = 'en_mora')       AS prestamos_en_mora,
  COALESCE(SUM(p.saldo_pendiente)
    FILTER (WHERE p.estado = 'en_mora'), 0)          AS monto_en_mora,
  COUNT(*) FILTER (WHERE p.estado = 'al_dia')        AS prestamos_al_dia,
  COUNT(*) FILTER (WHERE p.estado = 'pagado')        AS prestamos_pagados
FROM public.prestamos p
GROUP BY p.agente_id;

-- RLS en la vista: cada agente solo ve sus propios KPIs
ALTER VIEW public.kpis_agente OWNER TO postgres;
