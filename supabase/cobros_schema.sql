-- ─────────────────────────────────────────────────────────────────────────────
-- Portal de Cobros — cuentas por cobrar a clientes
-- Ejecutar en: Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clientes_cobro (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      TEXT        NOT NULL,
  cedula      TEXT,
  telefono    TEXT,
  direccion   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cobros (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id       UUID        NOT NULL REFERENCES public.clientes_cobro(id) ON DELETE RESTRICT,
  descripcion      TEXT        NOT NULL,
  monto_total      NUMERIC(12,2) NOT NULL CHECK (monto_total > 0),
  monto_pagado     NUMERIC(12,2) NOT NULL DEFAULT 0,
  saldo_pendiente  NUMERIC(12,2) GENERATED ALWAYS AS (monto_total - monto_pagado) STORED,
  estado           TEXT        NOT NULL DEFAULT 'pendiente'
                               CHECK (estado IN ('pendiente','parcial','pagado','vencido','cancelado')),
  fecha_vencimiento DATE,
  notas           TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pagos_cobro (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  cobro_id    UUID        NOT NULL REFERENCES public.cobros(id) ON DELETE CASCADE,
  agente_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monto       NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  fecha       DATE        NOT NULL DEFAULT CURRENT_DATE,
  nota        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clientes_cobro_agente  ON public.clientes_cobro(agente_id);
CREATE INDEX IF NOT EXISTS idx_cobros_agente          ON public.cobros(agente_id);
CREATE INDEX IF NOT EXISTS idx_cobros_cliente         ON public.cobros(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cobros_estado          ON public.cobros(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_cobro_cobro_id   ON public.pagos_cobro(cobro_id);

-- ── Función: aplicar pago ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.aplicar_pago_cobro(
  p_cobro_id  UUID,
  p_monto     NUMERIC,
  p_fecha     DATE DEFAULT CURRENT_DATE,
  p_nota      TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cobro        RECORD;
  v_nuevo_pagado NUMERIC;
  v_pago_id      UUID;
BEGIN
  SELECT * INTO v_cobro FROM public.cobros WHERE id = p_cobro_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobro no encontrado'; END IF;
  IF v_cobro.estado IN ('pagado','cancelado') THEN
    RAISE EXCEPTION 'El cobro ya está % ', v_cobro.estado;
  END IF;

  v_nuevo_pagado := LEAST(v_cobro.monto_pagado + p_monto, v_cobro.monto_total);

  INSERT INTO public.pagos_cobro (cobro_id, agente_id, monto, fecha, nota)
  VALUES (p_cobro_id, v_cobro.agente_id, p_monto, p_fecha, p_nota)
  RETURNING id INTO v_pago_id;

  UPDATE public.cobros SET
    monto_pagado = v_nuevo_pagado,
    estado = CASE
      WHEN v_nuevo_pagado >= monto_total THEN 'pagado'
      WHEN v_nuevo_pagado > 0            THEN 'parcial'
      ELSE estado
    END
  WHERE id = p_cobro_id;

  RETURN v_pago_id;
END;
$$;

-- ── Vista KPIs ────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.kpis_cobros AS
SELECT
  agente_id,
  COUNT(*)                                          AS total_cobros,
  COALESCE(SUM(monto_total),    0)                  AS total_facturado,
  COALESCE(SUM(monto_pagado),   0)                  AS total_cobrado,
  COALESCE(SUM(saldo_pendiente) FILTER (WHERE estado NOT IN ('pagado','cancelado')), 0) AS saldo_por_cobrar,
  COUNT(*) FILTER (WHERE estado = 'vencido')        AS cobros_vencidos,
  COALESCE(SUM(saldo_pendiente) FILTER (WHERE estado = 'vencido'), 0) AS monto_vencido
FROM public.cobros
GROUP BY agente_id;

-- ── Trigger: marcar vencidos ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.marcar_cobros_vencidos()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado IN ('pendiente','parcial') AND NEW.fecha_vencimiento IS NOT NULL
     AND NEW.fecha_vencimiento < CURRENT_DATE THEN
    NEW.estado := 'vencido';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_cobros_vencidos
  BEFORE UPDATE ON public.cobros
  FOR EACH ROW EXECUTE FUNCTION public.marcar_cobros_vencidos();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.clientes_cobro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobros          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_cobro     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agente_own_clientes_cobro" ON public.clientes_cobro
  USING (agente_id = auth.uid());
CREATE POLICY "agente_own_cobros" ON public.cobros
  USING (agente_id = auth.uid());
CREATE POLICY "agente_own_pagos_cobro" ON public.pagos_cobro
  USING (agente_id = auth.uid());
