-- ─────────────────────────────────────────────────────────────────────────────
-- FARMACIA · AJUSTES DEL CLIENTE (ronda 1 de feedback real)
-- Ejecutar en: Supabase → SQL Editor
-- Requiere: farmacia_fase0..4 ya aplicados.
-- Idempotente: se puede ejecutar más de una vez.
--
-- Qué resuelve:
--   1. Pagos de encargos como tabla propia (anticipo + cobro del saldo al
--      entregar), y el cierre de caja los suma por la FECHA DEL PAGO.
--   2. Al agregar un miembro al equipo, su cuenta queda aprobada — el dueño
--      ya no depende del superadmin para activar a un cajero.
--   3. Auditoría de accesos: cuándo inició y cerró sesión cada miembro
--      (lee el log de Supabase Auth; solo dueño/regente).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Pagos de encargos ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pagos_pedido_farmacia (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id  UUID        NOT NULL REFERENCES public.pedidos_farmacia(id) ON DELETE CASCADE,
  metodo     TEXT        NOT NULL CHECK (metodo IN ('efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia')),
  monto      NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagos_pedido_farmacia ON public.pagos_pedido_farmacia(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pagos_pedido_fecha    ON public.pagos_pedido_farmacia(created_at);

ALTER TABLE public.pagos_pedido_farmacia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pago_pedido_select" ON public.pagos_pedido_farmacia;
CREATE POLICY "pago_pedido_select" ON public.pagos_pedido_farmacia
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pedidos_farmacia p
    WHERE p.id = pedido_id AND (public.es_miembro(p.negocio_id) OR public.is_admin())
  ));
DROP POLICY IF EXISTS "pago_pedido_insert" ON public.pagos_pedido_farmacia;
CREATE POLICY "pago_pedido_insert" ON public.pagos_pedido_farmacia
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.pedidos_farmacia p
    WHERE p.id = pedido_id AND (public.es_miembro(p.negocio_id) OR public.is_admin())
  ));
-- Sin UPDATE/DELETE: los pagos no se reescriben.

-- Backfill: los anticipos ya registrados pasan a la tabla de pagos
-- (con la fecha del pedido, que era el supuesto del cierre hasta hoy)
INSERT INTO public.pagos_pedido_farmacia (pedido_id, metodo, monto, user_id, created_at)
SELECT p.id, COALESCE(p.metodo_pago, 'efectivo'), p.monto_pagado, p.user_id, p.created_at
FROM public.pedidos_farmacia p
WHERE p.monto_pagado > 0
  AND NOT EXISTS (SELECT 1 FROM public.pagos_pedido_farmacia pg WHERE pg.pedido_id = p.id);

-- RPC: abonar a un encargo (anticipo extra o cobro del saldo al entregar)
CREATE OR REPLACE FUNCTION public.abonar_pedido_farmacia(
  p_pedido UUID,
  p_monto  NUMERIC,
  p_metodo TEXT
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_p RECORD;
BEGIN
  SELECT * INTO v_p FROM public.pedidos_farmacia WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  IF NOT (public.es_miembro(v_p.negocio_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;
  IF v_p.estado IN ('entregado', 'cancelado') THEN
    RAISE EXCEPTION 'Este encargo ya está cerrado';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN RAISE EXCEPTION 'El monto debe ser mayor a cero'; END IF;
  IF p_metodo NOT IN ('efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia') THEN
    RAISE EXCEPTION 'Método inválido';
  END IF;
  IF v_p.monto_pagado + p_monto > v_p.total THEN
    RAISE EXCEPTION 'El pago supera el saldo (debe %)', v_p.total - v_p.monto_pagado;
  END IF;

  INSERT INTO public.pagos_pedido_farmacia (pedido_id, metodo, monto, user_id)
  VALUES (p_pedido, p_monto, p_metodo, auth.uid());

  UPDATE public.pedidos_farmacia
  SET monto_pagado = monto_pagado + p_monto
  WHERE id = p_pedido;
END;
$$;

REVOKE ALL ON FUNCTION public.abonar_pedido_farmacia(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abonar_pedido_farmacia(UUID, NUMERIC, TEXT) TO authenticated;

-- ── 2. Cierre de caja: los pagos de encargos entran por su FECHA DE PAGO ──────
CREATE OR REPLACE FUNCTION public.cerrar_caja_farmacia(
  p_declarado JSONB,
  p_notas     TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_negocio  UUID;
  v_desde    TIMESTAMPTZ;
  v_hasta    TIMESTAMPTZ := NOW();
  v_esp      JSONB;
  v_dec      JSONB;
  v_dif      JSONB;
  v_ventas   INTEGER;
  v_id       UUID;
  v_metodo   TEXT;
  v_esp_m    NUMERIC;
  v_dec_m    NUMERIC;
  v_dif_tot  NUMERIC := 0;
BEGIN
  SELECT negocio_id INTO v_negocio FROM public.miembros_negocio
  WHERE user_id = auth.uid() LIMIT 1;
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No perteneces a ningún negocio'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('cierre_caja:' || v_negocio::text));

  SELECT COALESCE(MAX(periodo_hasta), '-infinity'::timestamptz) INTO v_desde
  FROM public.cierres_caja_farmacia WHERE negocio_id = v_negocio;

  WITH ventas_periodo AS (
    SELECT v.id, v.total,
           COALESCE(SUM(p.monto), 0)                                        AS pagado,
           COALESCE(SUM(p.monto) FILTER (WHERE p.metodo = 'efectivo'), 0)   AS efectivo,
           COALESCE(SUM(p.monto) FILTER (WHERE p.metodo = 'tarjeta_debito'), 0)  AS debito,
           COALESCE(SUM(p.monto) FILTER (WHERE p.metodo = 'tarjeta_credito'), 0) AS credito,
           COALESCE(SUM(p.monto) FILTER (WHERE p.metodo = 'transferencia'), 0)   AS transf
    FROM public.ventas_farmacia v
    JOIN public.pagos_venta_farmacia p ON p.venta_id = v.id
    WHERE v.negocio_id = v_negocio
      AND v.estado = 'completada'
      AND v.created_at > v_desde AND v.created_at <= v_hasta
    GROUP BY v.id, v.total
  ),
  -- Pagos de encargos por la fecha en que ENTRÓ la plata (anticipo o saldo)
  pedidos_periodo AS (
    SELECT COALESCE(SUM(pg.monto) FILTER (WHERE pg.metodo = 'efectivo'), 0)        AS efectivo,
           COALESCE(SUM(pg.monto) FILTER (WHERE pg.metodo = 'tarjeta_debito'), 0)  AS debito,
           COALESCE(SUM(pg.monto) FILTER (WHERE pg.metodo = 'tarjeta_credito'), 0) AS credito,
           COALESCE(SUM(pg.monto) FILTER (WHERE pg.metodo = 'transferencia'), 0)   AS transf
    FROM public.pagos_pedido_farmacia pg
    JOIN public.pedidos_farmacia p ON p.id = pg.pedido_id
    WHERE p.negocio_id = v_negocio
      AND pg.created_at > v_desde AND pg.created_at <= v_hasta
  )
  SELECT jsonb_build_object(
           'efectivo',        ROUND(COALESCE(SUM(vp.efectivo - GREATEST(vp.pagado - vp.total, 0)), 0) + MAX(pp.efectivo), 2),
           'tarjeta_debito',  ROUND(COALESCE(SUM(vp.debito), 0)  + MAX(pp.debito), 2),
           'tarjeta_credito', ROUND(COALESCE(SUM(vp.credito), 0) + MAX(pp.credito), 2),
           'transferencia',   ROUND(COALESCE(SUM(vp.transf), 0)  + MAX(pp.transf), 2)
         ),
         COUNT(vp.id)
  INTO v_esp, v_ventas
  FROM pedidos_periodo pp
  LEFT JOIN ventas_periodo vp ON TRUE;

  v_dec := jsonb_build_object(
    'efectivo',        GREATEST(COALESCE((p_declarado->>'efectivo')::numeric, 0), 0),
    'tarjeta_debito',  GREATEST(COALESCE((p_declarado->>'tarjeta_debito')::numeric, 0), 0),
    'tarjeta_credito', GREATEST(COALESCE((p_declarado->>'tarjeta_credito')::numeric, 0), 0),
    'transferencia',   GREATEST(COALESCE((p_declarado->>'transferencia')::numeric, 0), 0)
  );

  v_dif := '{}'::jsonb;
  FOR v_metodo IN SELECT unnest(ARRAY['efectivo','tarjeta_debito','tarjeta_credito','transferencia'])
  LOOP
    v_esp_m := COALESCE((v_esp->>v_metodo)::numeric, 0);
    v_dec_m := COALESCE((v_dec->>v_metodo)::numeric, 0);
    v_dif := v_dif || jsonb_build_object(v_metodo, ROUND(v_dec_m - v_esp_m, 2));
    v_dif_tot := v_dif_tot + (v_dec_m - v_esp_m);
  END LOOP;
  v_dif := v_dif || jsonb_build_object('total', ROUND(v_dif_tot, 2));

  INSERT INTO public.cierres_caja_farmacia
    (negocio_id, user_id, periodo_desde, periodo_hasta, declarado, esperado, diferencia, num_ventas, notas)
  VALUES
    (v_negocio, auth.uid(), v_desde, v_hasta, v_dec, v_esp, v_dif, v_ventas,
     NULLIF(trim(COALESCE(p_notas, '')), ''))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'cierre_id', v_id, 'esperado', v_esp, 'declarado', v_dec,
    'diferencia', v_dif, 'num_ventas', v_ventas
  );
END;
$$;

-- ── 3. Agregar miembro = cuenta aprobada (sin esperar al superadmin) ──────────
CREATE OR REPLACE FUNCTION public.agregar_miembro_negocio(
  p_negocio UUID,
  p_email   TEXT,
  p_rol     TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perfil RECORD;
  v_portal UUID;
BEGIN
  IF NOT (public.es_dueno(p_negocio) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Solo el dueño puede gestionar el equipo';
  END IF;
  IF p_rol NOT IN ('dueno', 'regente', 'cajero') THEN
    RAISE EXCEPTION 'Rol inválido';
  END IF;

  SELECT id, full_name, email, is_approved INTO v_perfil
  FROM public.profiles WHERE lower(email) = lower(trim(p_email));

  IF v_perfil.id IS NULL THEN
    RAISE EXCEPTION 'No hay ninguna cuenta registrada con ese correo. La persona debe crear su cuenta en la página de registro primero.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.miembros_negocio WHERE negocio_id = p_negocio AND user_id = v_perfil.id) THEN
    RAISE EXCEPTION 'Esa persona ya es parte del equipo';
  END IF;

  INSERT INTO public.miembros_negocio (negocio_id, user_id, rol)
  VALUES (p_negocio, v_perfil.id, p_rol);

  -- El dueño responde por su empleado: la cuenta queda aprobada y activa
  UPDATE public.profiles
  SET is_approved = TRUE, is_active = TRUE
  WHERE id = v_perfil.id AND (NOT is_approved OR NOT is_active);

  SELECT id INTO v_portal FROM public.portals WHERE slug = 'farmacia';
  IF v_portal IS NOT NULL THEN
    INSERT INTO public.user_portal_access (user_id, portal_id, granted_by)
    VALUES (v_perfil.id, v_portal, auth.uid())
    ON CONFLICT (user_id, portal_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'user_id', v_perfil.id,
    'nombre',  COALESCE(v_perfil.full_name, v_perfil.email),
    'aprobado', TRUE
  );
END;
$$;

-- ── 4. Auditoría de accesos (login/logout) del equipo ─────────────────────────
-- Lee el log de Supabase Auth. Solo dueño/regente del negocio (o superadmin).
CREATE OR REPLACE FUNCTION public.accesos_equipo(p_negocio UUID)
RETURNS TABLE (
  fecha   TIMESTAMPTZ,
  accion  TEXT,
  email   TEXT
)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT a.created_at AS fecha,
         a.payload->>'action' AS accion,
         COALESCE(p.email, a.payload->>'actor_username') AS email
  FROM auth.audit_log_entries a
  JOIN public.miembros_negocio m ON m.user_id = (a.payload->>'actor_id')::uuid
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.negocio_id = p_negocio
    AND a.payload->>'action' IN ('login', 'logout')
    AND (public.es_gestor(p_negocio) OR public.is_admin())
  ORDER BY a.created_at DESC
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.accesos_equipo(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accesos_equipo(UUID) TO authenticated;

-- ── 5. Verificación ───────────────────────────────────────────────────────────
SELECT 'pagos_pedido_farmacia' AS tabla,
       CASE WHEN rowsecurity THEN '✅ RLS' ELSE '❌ SIN RLS' END AS seguridad
FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pagos_pedido_farmacia';
