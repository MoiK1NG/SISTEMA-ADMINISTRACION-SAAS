-- ─────────────────────────────────────────────────────────────────────────────
-- FARMACIA · Editar un lote: número, fecha de vencimiento y estantería
-- Ejecutar en: Supabase → SQL Editor. Requiere farmacia_fase5_multimoneda.sql.
-- Idempotente: se puede correr más de una vez.
--
-- Por qué: un lote ya ingresado no se podía corregir, y la carga inicial dejó
-- todos los lotes "Sin fecha" a la espera de que alguien les ponga la fecha.
--
-- Reglas:
--   · Solo dueño o regente del negocio (o un admin).
--   · Un lote CON fecha no puede quedar sin fecha: los lotes sin fecha pasan el
--     filtro de vencimiento del POS, así que borrarle la fecha a un lote vencido
--     lo volvería vendible.
--   · El número de lote no puede repetirse dentro del mismo producto.
--   · Cada cambio queda en historial_productos_farmacia (quién, cuándo, antes y
--     después), visible en el detalle del producto.
--   · No cambia cantidades: para eso están los movimientos (entradas, mermas,
--     traslados), que tienen su propio historial imborrable.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.editar_lote_farmacia(
  p_lote        UUID,
  p_numero      TEXT,
  p_vencimiento DATE,
  p_estanteria  TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actual     RECORD;
  v_numero     TEXT;
  v_estanteria TEXT;
BEGIN
  SELECT * INTO v_actual FROM public.lotes_farmacia WHERE id = p_lote;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote no encontrado'; END IF;

  IF NOT (public.es_gestor(v_actual.negocio_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Solo el dueño o el regente pueden editar lotes';
  END IF;

  v_numero := trim(COALESCE(p_numero, ''));
  IF v_numero = '' THEN RAISE EXCEPTION 'El número de lote es obligatorio'; END IF;
  v_estanteria := NULLIF(trim(COALESCE(p_estanteria, '')), '');

  IF v_actual.fecha_vencimiento IS NOT NULL AND p_vencimiento IS NULL THEN
    RAISE EXCEPTION 'Un lote con fecha de vencimiento no puede quedar sin fecha';
  END IF;

  IF v_numero <> v_actual.lote AND EXISTS (
    SELECT 1 FROM public.lotes_farmacia
    WHERE producto_id = v_actual.producto_id AND lote = v_numero
  ) THEN
    RAISE EXCEPTION 'Este producto ya tiene un lote con el número %', v_numero;
  END IF;

  UPDATE public.lotes_farmacia
  SET lote = v_numero, fecha_vencimiento = p_vencimiento, estanteria = v_estanteria
  WHERE id = p_lote;

  -- Historial: una fila por dato cambiado, con el número de lote para ubicarlo
  IF v_numero IS DISTINCT FROM v_actual.lote THEN
    INSERT INTO public.historial_productos_farmacia
      (negocio_id, producto_id, user_id, campo, valor_anterior, valor_nuevo)
    VALUES (v_actual.negocio_id, v_actual.producto_id, auth.uid(), 'lote_numero',
            v_actual.lote, v_numero);
  END IF;

  IF p_vencimiento IS DISTINCT FROM v_actual.fecha_vencimiento THEN
    INSERT INTO public.historial_productos_farmacia
      (negocio_id, producto_id, user_id, campo, valor_anterior, valor_nuevo)
    VALUES (v_actual.negocio_id, v_actual.producto_id, auth.uid(), 'lote_vencimiento',
            'Lote ' || v_numero || ': ' || COALESCE(v_actual.fecha_vencimiento::TEXT, 'sin fecha'),
            'Lote ' || v_numero || ': ' || COALESCE(p_vencimiento::TEXT, 'sin fecha'));
  END IF;

  IF v_estanteria IS DISTINCT FROM v_actual.estanteria THEN
    INSERT INTO public.historial_productos_farmacia
      (negocio_id, producto_id, user_id, campo, valor_anterior, valor_nuevo)
    VALUES (v_actual.negocio_id, v_actual.producto_id, auth.uid(), 'lote_estanteria',
            'Lote ' || v_numero || ': ' || COALESCE(v_actual.estanteria, '—'),
            'Lote ' || v_numero || ': ' || COALESCE(v_estanteria, '—'));
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.editar_lote_farmacia(UUID, TEXT, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.editar_lote_farmacia(UUID, TEXT, DATE, TEXT) TO authenticated;

-- Verificación
SELECT proname, prosecdef AS security_definer
FROM pg_proc WHERE proname = 'editar_lote_farmacia';
