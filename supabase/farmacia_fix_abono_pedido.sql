-- ─────────────────────────────────────────────────────────────────────────────
-- FARMACIA · Arreglo de los pagos de encargos
-- Ejecutar en: Supabase → SQL Editor. Requiere farmacia_ajustes_cliente1.sql.
-- Idempotente: se puede correr más de una vez.
--
-- Qué resuelve (dos errores de la ronda 1):
--   1. abonar_pedido_farmacia insertaba el monto en la columna del método y el
--      método en la del monto. Todo abono y todo "Entregar y cobrar saldo"
--      fallaba con un error de tipo, así que ningún encargo con saldo se podía
--      entregar. Como fallaba entero, no dejó datos a medias.
--   2. El anticipo que se cobra al CREAR el encargo solo quedaba en
--      pedidos_farmacia.monto_pagado y nunca en pagos_pedido_farmacia, que es
--      lo que suma el cierre de caja. Esa plata entraba al cajón pero el cierre
--      no la esperaba (aparecía como sobrante). Ahora un trigger registra el
--      pago al crear el encargo, y el backfill completa los que faltan.
--
-- El backfill fecha cada pago con la creación del encargo. Si esa fecha cae en
-- un turno ya cerrado, ese cierre no cambia (los cierres no se recalculan); si
-- cae en el turno abierto, el próximo cierre lo cuenta, como corresponde.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Abono con las columnas en su lugar ────────────────────────────────────
-- Cuerpo vigente (farmacia_ajustes_cliente1.sql) sin otro cambio que el orden
-- de los VALUES. Misma firma: conserva los permisos.
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
  VALUES (p_pedido, p_metodo, p_monto, auth.uid());

  UPDATE public.pedidos_farmacia
  SET monto_pagado = monto_pagado + p_monto
  WHERE id = p_pedido;
END;
$$;

REVOKE ALL ON FUNCTION public.abonar_pedido_farmacia(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abonar_pedido_farmacia(UUID, NUMERIC, TEXT) TO authenticated;

-- ── 2. El anticipo inicial también es un pago ────────────────────────────────
-- Corre con los permisos de quien crea el encargo: la política de INSERT de
-- pagos_pedido_farmacia ya exige ser miembro del negocio del pedido.
CREATE OR REPLACE FUNCTION public.registrar_anticipo_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.monto_pagado > 0 THEN
    INSERT INTO public.pagos_pedido_farmacia (pedido_id, metodo, monto, user_id, created_at)
    VALUES (NEW.id, COALESCE(NEW.metodo_pago, 'efectivo'), NEW.monto_pagado,
            COALESCE(auth.uid(), NEW.user_id), NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedidos_farmacia_anticipo ON public.pedidos_farmacia;
CREATE TRIGGER trg_pedidos_farmacia_anticipo
  AFTER INSERT ON public.pedidos_farmacia
  FOR EACH ROW EXECUTE FUNCTION public.registrar_anticipo_pedido();

-- ── 3. Backfill: lo cobrado que no tiene su pago registrado ──────────────────
-- Por diferencia (monto_pagado menos lo ya registrado), así no duplica nada
-- aunque se corra dos veces.
INSERT INTO public.pagos_pedido_farmacia (pedido_id, metodo, monto, user_id, created_at)
SELECT p.id, COALESCE(p.metodo_pago, 'efectivo'),
       p.monto_pagado - COALESCE(r.registrado, 0), p.user_id, p.created_at
FROM public.pedidos_farmacia p
LEFT JOIN (
  SELECT pedido_id, SUM(monto) AS registrado
  FROM public.pagos_pedido_farmacia GROUP BY pedido_id
) r ON r.pedido_id = p.id
WHERE p.monto_pagado - COALESCE(r.registrado, 0) > 0;

-- ── Verificación ─────────────────────────────────────────────────────────────
-- Debe devolver: el INSERT con (p_pedido, p_metodo, p_monto), el trigger
-- creado, y 0 encargos con pagos faltantes.
SELECT 'abono_corregido' AS chequeo,
       (pg_get_functiondef('public.abonar_pedido_farmacia(uuid,numeric,text)'::regprocedure)
          LIKE '%VALUES (p_pedido, p_metodo, p_monto%')::text AS resultado
UNION ALL
SELECT 'trigger_anticipo',
       (EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pedidos_farmacia_anticipo'))::text
UNION ALL
SELECT 'encargos_con_pagos_faltantes',
       COUNT(*)::text
FROM public.pedidos_farmacia p
WHERE p.monto_pagado > (SELECT COALESCE(SUM(monto), 0) FROM public.pagos_pedido_farmacia WHERE pedido_id = p.id);
