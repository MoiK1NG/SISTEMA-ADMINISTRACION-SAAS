-- ─────────────────────────────────────────────────────────────────────────────
-- PRIVACIDAD · El equipo de LOMS 360 ve datos sensibles solo con permiso
-- Ejecutar en: Supabase → SQL Editor.
-- Requiere: farmacia_fase0..5, farmacia_ajustes_cliente1.sql,
--           farmacia_movimientos_caja.sql y farmacia_marca_y_equipo.sql.
-- Idempotente: se puede correr más de una vez.
--
-- Qué resuelve (reunión del 21 de octubre, opción "soporte limitado + permiso
-- del dueño"):
--   Hasta hoy la RLS dejaba a cualquier admin de la plataforma leer y
--   escribir TODAS las tablas de farmacia. Desde ahora:
--
--   · Sin permiso, un admin ve solo lo técnico: el negocio, su equipo, el
--     catálogo, los lotes y el stock (para dar soporte de inventario).
--   · Ventas, pagos, encargos, clientes, recetas, tratamientos, cierres,
--     retiros y gastos, cuentas por pagar y proveedores: solo con un permiso
--     que el DUEÑO activa por unas horas (24 por defecto) y puede revocar.
--     Activar y revocar queda en audit_logs.
--   · Aun con permiso, el admin solo LEE. Escribir en estas tablas queda
--     reservado al equipo del negocio.
--   · El permiso solo lo cambian autorizar_soporte / revocar_soporte: un
--     trigger impide fijar soporte_hasta por fuera (ni el admin ni un UPDATE
--     directo del dueño, que no quedaría auditado).
--
-- Cada política se reescribe COMPLETA desde su versión vigente (fase 1–4,
-- ajustes 1 y movimientos de caja) sacando "OR public.is_admin()".
-- La tarea diaria corre con la service role y no se ve afectada.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. El permiso ────────────────────────────────────────────────────────────
ALTER TABLE public.negocios ADD COLUMN IF NOT EXISTS soporte_hasta TIMESTAMPTZ;

-- ¿Quien consulta es admin Y el dueño autorizó soporte en ese negocio?
CREATE OR REPLACE FUNCTION public.soporte_autorizado(p_negocio UUID)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT public.is_admin() AND EXISTS (
    SELECT 1 FROM public.negocios WHERE id = p_negocio AND soporte_hasta > NOW()
  );
$$;

REVOKE ALL ON FUNCTION public.soporte_autorizado(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soporte_autorizado(UUID) TO authenticated;

-- soporte_hasta solo cambia por las dos funciones de abajo
CREATE OR REPLACE FUNCTION public.proteger_soporte_hasta()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.soporte_hasta IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.soporte_hasta IS DISTINCT FROM OLD.soporte_hasta) THEN
    IF current_setting('loms.soporte_rpc', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'El permiso de soporte solo lo da o lo quita el dueño desde su panel';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_negocios_soporte ON public.negocios;
CREATE TRIGGER trg_negocios_soporte
  BEFORE INSERT OR UPDATE ON public.negocios
  FOR EACH ROW EXECUTE FUNCTION public.proteger_soporte_hasta();

CREATE OR REPLACE FUNCTION public.autorizar_soporte(p_horas INTEGER DEFAULT 24)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio UUID;
  v_nombre  TEXT;
  v_hasta   TIMESTAMPTZ;
BEGIN
  IF p_horas IS NULL OR p_horas < 1 OR p_horas > 72 THEN
    RAISE EXCEPTION 'El permiso puede durar entre 1 y 72 horas';
  END IF;

  SELECT m.negocio_id, n.nombre INTO v_negocio, v_nombre
  FROM public.miembros_negocio m JOIN public.negocios n ON n.id = m.negocio_id
  WHERE m.user_id = auth.uid() AND m.rol = 'dueno'
  LIMIT 1;
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'Solo el dueño puede autorizar el acceso de soporte'; END IF;

  v_hasta := NOW() + make_interval(hours => p_horas);
  PERFORM set_config('loms.soporte_rpc', 'on', true);
  UPDATE public.negocios SET soporte_hasta = v_hasta WHERE id = v_negocio;

  INSERT INTO public.audit_logs (admin_id, action, entity_type, entity_id, entity_name, details)
  VALUES (auth.uid(), 'autorizar_soporte', 'negocio', v_negocio, v_nombre,
          jsonb_build_object('horas', p_horas, 'hasta', v_hasta));

  RETURN v_hasta;
END;
$$;

CREATE OR REPLACE FUNCTION public.revocar_soporte()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio UUID;
  v_nombre  TEXT;
BEGIN
  SELECT m.negocio_id, n.nombre INTO v_negocio, v_nombre
  FROM public.miembros_negocio m JOIN public.negocios n ON n.id = m.negocio_id
  WHERE m.user_id = auth.uid() AND m.rol = 'dueno'
  LIMIT 1;
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'Solo el dueño puede revocar el acceso de soporte'; END IF;

  PERFORM set_config('loms.soporte_rpc', 'on', true);
  UPDATE public.negocios SET soporte_hasta = NULL WHERE id = v_negocio;

  INSERT INTO public.audit_logs (admin_id, action, entity_type, entity_id, entity_name)
  VALUES (auth.uid(), 'revocar_soporte', 'negocio', v_negocio, v_nombre);
END;
$$;

REVOKE ALL ON FUNCTION public.autorizar_soporte(INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revocar_soporte()          FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.autorizar_soporte(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revocar_soporte()          TO authenticated;

-- ── 2. Políticas de las tablas sensibles ─────────────────────────────────────
-- Lectura: equipo del negocio, o admin con permiso vigente.
-- Escritura: solo el equipo del negocio (mismas reglas de rol que antes).

-- Ventas (fase 2)
DROP POLICY IF EXISTS "venta_select" ON public.ventas_farmacia;
CREATE POLICY "venta_select" ON public.ventas_farmacia
  FOR SELECT TO authenticated
  USING (public.es_miembro(negocio_id) OR public.soporte_autorizado(negocio_id));
DROP POLICY IF EXISTS "venta_insert" ON public.ventas_farmacia;
CREATE POLICY "venta_insert" ON public.ventas_farmacia
  FOR INSERT TO authenticated
  WITH CHECK (public.es_miembro(negocio_id) AND user_id = auth.uid());
DROP POLICY IF EXISTS "venta_update" ON public.ventas_farmacia;
CREATE POLICY "venta_update" ON public.ventas_farmacia
  FOR UPDATE TO authenticated
  USING (public.es_gestor(negocio_id)) WITH CHECK (public.es_gestor(negocio_id));

DROP POLICY IF EXISTS "item_venta_select" ON public.items_venta_farmacia;
CREATE POLICY "item_venta_select" ON public.items_venta_farmacia
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ventas_farmacia v
    WHERE v.id = venta_id AND (public.es_miembro(v.negocio_id) OR public.soporte_autorizado(v.negocio_id))
  ));
DROP POLICY IF EXISTS "item_venta_insert" ON public.items_venta_farmacia;
CREATE POLICY "item_venta_insert" ON public.items_venta_farmacia
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ventas_farmacia v
    WHERE v.id = venta_id AND public.es_miembro(v.negocio_id)
  ));

DROP POLICY IF EXISTS "pago_venta_select" ON public.pagos_venta_farmacia;
CREATE POLICY "pago_venta_select" ON public.pagos_venta_farmacia
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ventas_farmacia v
    WHERE v.id = venta_id AND (public.es_miembro(v.negocio_id) OR public.soporte_autorizado(v.negocio_id))
  ));
DROP POLICY IF EXISTS "pago_venta_insert" ON public.pagos_venta_farmacia;
CREATE POLICY "pago_venta_insert" ON public.pagos_venta_farmacia
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ventas_farmacia v
    WHERE v.id = venta_id AND public.es_miembro(v.negocio_id)
  ));

-- Encargos (fase 2) y sus pagos (ajustes 1)
DROP POLICY IF EXISTS "pedido_select" ON public.pedidos_farmacia;
CREATE POLICY "pedido_select" ON public.pedidos_farmacia
  FOR SELECT TO authenticated
  USING (public.es_miembro(negocio_id) OR public.soporte_autorizado(negocio_id));
DROP POLICY IF EXISTS "pedido_insert" ON public.pedidos_farmacia;
CREATE POLICY "pedido_insert" ON public.pedidos_farmacia
  FOR INSERT TO authenticated
  WITH CHECK (public.es_miembro(negocio_id) AND user_id = auth.uid());
DROP POLICY IF EXISTS "pedido_update" ON public.pedidos_farmacia;
CREATE POLICY "pedido_update" ON public.pedidos_farmacia
  FOR UPDATE TO authenticated
  USING (public.es_miembro(negocio_id)) WITH CHECK (public.es_miembro(negocio_id));

DROP POLICY IF EXISTS "pago_pedido_select" ON public.pagos_pedido_farmacia;
CREATE POLICY "pago_pedido_select" ON public.pagos_pedido_farmacia
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pedidos_farmacia p
    WHERE p.id = pedido_id AND (public.es_miembro(p.negocio_id) OR public.soporte_autorizado(p.negocio_id))
  ));
DROP POLICY IF EXISTS "pago_pedido_insert" ON public.pagos_pedido_farmacia;
CREATE POLICY "pago_pedido_insert" ON public.pagos_pedido_farmacia
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.pedidos_farmacia p
    WHERE p.id = pedido_id AND public.es_miembro(p.negocio_id)
  ));

-- Clientes (fase 2)
DROP POLICY IF EXISTS "cli_select" ON public.clientes_farmacia;
CREATE POLICY "cli_select" ON public.clientes_farmacia
  FOR SELECT TO authenticated
  USING (public.es_miembro(negocio_id) OR public.soporte_autorizado(negocio_id));
DROP POLICY IF EXISTS "cli_insert" ON public.clientes_farmacia;
CREATE POLICY "cli_insert" ON public.clientes_farmacia
  FOR INSERT TO authenticated
  WITH CHECK (public.es_miembro(negocio_id));
DROP POLICY IF EXISTS "cli_update" ON public.clientes_farmacia;
CREATE POLICY "cli_update" ON public.clientes_farmacia
  FOR UPDATE TO authenticated
  USING (public.es_miembro(negocio_id)) WITH CHECK (public.es_miembro(negocio_id));
DROP POLICY IF EXISTS "cli_delete" ON public.clientes_farmacia;
CREATE POLICY "cli_delete" ON public.clientes_farmacia
  FOR DELETE TO authenticated
  USING (public.es_gestor(negocio_id));

-- Recetas y tratamientos (fase 4)
DROP POLICY IF EXISTS "receta_select" ON public.recetas_farmacia;
CREATE POLICY "receta_select" ON public.recetas_farmacia
  FOR SELECT TO authenticated
  USING (public.es_miembro(negocio_id) OR public.soporte_autorizado(negocio_id));
DROP POLICY IF EXISTS "receta_insert" ON public.recetas_farmacia;
CREATE POLICY "receta_insert" ON public.recetas_farmacia
  FOR INSERT TO authenticated
  WITH CHECK (public.es_miembro(negocio_id) AND user_id = auth.uid());

DROP POLICY IF EXISTS "trat_select" ON public.tratamientos_farmacia;
CREATE POLICY "trat_select" ON public.tratamientos_farmacia
  FOR SELECT TO authenticated
  USING (public.es_miembro(negocio_id) OR public.soporte_autorizado(negocio_id));
DROP POLICY IF EXISTS "trat_insert" ON public.tratamientos_farmacia;
CREATE POLICY "trat_insert" ON public.tratamientos_farmacia
  FOR INSERT TO authenticated
  WITH CHECK (public.es_miembro(negocio_id) AND user_id = auth.uid());
DROP POLICY IF EXISTS "trat_update" ON public.tratamientos_farmacia;
CREATE POLICY "trat_update" ON public.tratamientos_farmacia
  FOR UPDATE TO authenticated
  USING (public.es_miembro(negocio_id)) WITH CHECK (public.es_miembro(negocio_id));
DROP POLICY IF EXISTS "trat_delete" ON public.tratamientos_farmacia;
CREATE POLICY "trat_delete" ON public.tratamientos_farmacia
  FOR DELETE TO authenticated
  USING (public.es_gestor(negocio_id));

-- Cierres de caja (fase 3)
DROP POLICY IF EXISTS "cierre_select" ON public.cierres_caja_farmacia;
CREATE POLICY "cierre_select" ON public.cierres_caja_farmacia
  FOR SELECT TO authenticated
  USING (public.es_gestor(negocio_id) OR user_id = auth.uid() OR public.soporte_autorizado(negocio_id));
DROP POLICY IF EXISTS "cierre_insert" ON public.cierres_caja_farmacia;
CREATE POLICY "cierre_insert" ON public.cierres_caja_farmacia
  FOR INSERT TO authenticated
  WITH CHECK (public.es_miembro(negocio_id) AND user_id = auth.uid());

-- Retiros y gastos de caja (movimientos de caja)
DROP POLICY IF EXISTS "mov_caja_select" ON public.movimientos_caja_farmacia;
CREATE POLICY "mov_caja_select" ON public.movimientos_caja_farmacia
  FOR SELECT TO authenticated
  USING (public.es_gestor(negocio_id) OR user_id = auth.uid() OR public.soporte_autorizado(negocio_id));
-- mov_caja_insert ya era solo del equipo: no cambia.

-- Cuentas por pagar y sus abonos (fase 3)
DROP POLICY IF EXISTS "cxp_all" ON public.cuentas_pagar_farmacia;
CREATE POLICY "cxp_all" ON public.cuentas_pagar_farmacia
  FOR ALL TO authenticated
  USING (public.es_gestor(negocio_id))
  WITH CHECK (public.es_gestor(negocio_id) AND user_id = auth.uid());
DROP POLICY IF EXISTS "cxp_select_soporte" ON public.cuentas_pagar_farmacia;
CREATE POLICY "cxp_select_soporte" ON public.cuentas_pagar_farmacia
  FOR SELECT TO authenticated
  USING (public.soporte_autorizado(negocio_id));

DROP POLICY IF EXISTS "abono_select" ON public.abonos_cxp_farmacia;
CREATE POLICY "abono_select" ON public.abonos_cxp_farmacia
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cuentas_pagar_farmacia c
    WHERE c.id = cuenta_id AND (public.es_gestor(c.negocio_id) OR public.soporte_autorizado(c.negocio_id))
  ));
DROP POLICY IF EXISTS "abono_insert" ON public.abonos_cxp_farmacia;
CREATE POLICY "abono_insert" ON public.abonos_cxp_farmacia
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cuentas_pagar_farmacia c
    WHERE c.id = cuenta_id AND public.es_gestor(c.negocio_id)
  ));

-- Proveedores (fase 1)
DROP POLICY IF EXISTS "prov_select" ON public.proveedores_farmacia;
CREATE POLICY "prov_select" ON public.proveedores_farmacia
  FOR SELECT TO authenticated
  USING (public.es_miembro(negocio_id) OR public.soporte_autorizado(negocio_id));
DROP POLICY IF EXISTS "prov_write" ON public.proveedores_farmacia;
CREATE POLICY "prov_write" ON public.proveedores_farmacia
  FOR ALL TO authenticated
  USING (public.es_gestor(negocio_id)) WITH CHECK (public.es_gestor(negocio_id));

-- ── Verificación ─────────────────────────────────────────────────────────────
-- Debe devolver 0 filas: ninguna política de una tabla sensible deja pasar a
-- un admin sin permiso. Si aparece alguna (por ejemplo, creada a mano con otro
-- nombre), hay que revisarla antes de dar esto por cerrado.
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'ventas_farmacia', 'items_venta_farmacia', 'pagos_venta_farmacia',
    'pedidos_farmacia', 'pagos_pedido_farmacia', 'clientes_farmacia',
    'recetas_farmacia', 'tratamientos_farmacia', 'cierres_caja_farmacia',
    'movimientos_caja_farmacia', 'cuentas_pagar_farmacia', 'abonos_cxp_farmacia',
    'proveedores_farmacia'
  )
  AND (COALESCE(qual, '') LIKE '%is_admin%' OR COALESCE(with_check, '') LIKE '%is_admin%');
