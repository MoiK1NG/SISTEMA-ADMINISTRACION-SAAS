-- ─────────────────────────────────────────────────────────────────────────────
-- Cliente de prueba con membresía anual
--
-- REQUISITO PREVIO: el usuario debe existir en Auth.
--   Supabase → Authentication → Users → "Add user"
--     · Email: panaderia.prueba@ejemplo.com
--     · Password: la que quieras usar para entrar
--     · ✅ Marcar "Auto Confirm User" (evita el correo de confirmación)
--
-- Después ejecutar este script en el SQL Editor. Es idempotente.
--
-- Para crear un SEGUNDO cliente de prueba y comprobar el aislamiento,
-- cambiar v_email y v_negocio al final del archivo (sección 6).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_email    TEXT := 'panaderia.prueba@ejemplo.com';   -- ← el usuario creado en Auth
  v_negocio  TEXT := 'Panadería La Espiga';            -- ← nombre que verá en su perfil
  v_uid      UUID;
  v_plan     UUID;
  v_prod_pan UUID;
  v_prod_caf UUID;
BEGIN
  -- ── 1. Ubicar el usuario ───────────────────────────────────────────────────
  SELECT id INTO v_uid FROM auth.users WHERE email = v_email;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No existe el usuario % en Auth. Crealo primero en Authentication → Users.', v_email;
  END IF;

  -- ── 2. Perfil aprobado y activo, rol de usuario normal ─────────────────────
  INSERT INTO public.profiles (id, email, full_name, role, is_active, is_approved)
  VALUES (v_uid, v_email, v_negocio, 'user', TRUE, TRUE)
  ON CONFLICT (id) DO UPDATE SET
    full_name   = EXCLUDED.full_name,
    role        = 'user',
    is_active   = TRUE,
    is_approved = TRUE;

  -- ── 3. Plan anual (se crea si no existe) ───────────────────────────────────
  SELECT id INTO v_plan FROM public.membership_plans
  WHERE duration_days = 365 AND is_active ORDER BY created_at LIMIT 1;

  IF v_plan IS NULL THEN
    INSERT INTO public.membership_plans (name, description, duration_days, price, is_active)
    VALUES ('Plan Anual', 'Acceso completo por 12 meses', 365, 1200000, TRUE)
    RETURNING id INTO v_plan;
  END IF;

  -- ── 4. Membresía activa por un año ─────────────────────────────────────────
  UPDATE public.memberships SET status = 'expired'
  WHERE user_id = v_uid AND status = 'active';

  INSERT INTO public.memberships (user_id, plan_id, start_date, end_date, status)
  VALUES (v_uid, v_plan, CURRENT_DATE, CURRENT_DATE + 365, 'active');

  -- ── 5. Acceso a Panadería y Punto de Venta ─────────────────────────────────
  INSERT INTO public.user_portal_access (user_id, portal_id)
  SELECT v_uid, p.id FROM public.portals p
  WHERE p.slug IN ('panaderia', 'pos') AND p.is_active
  ON CONFLICT (user_id, portal_id) DO NOTHING;

  -- ── 6. Datos de ejemplo, para que el portal no se vea vacío ────────────────
  -- Catálogo de panadería
  INSERT INTO public.productos_pan (agente_id, nombre, categoria, precio_venta, costo_produccion, unidad)
  SELECT v_uid, x.nombre, x.cat, x.precio, x.costo, 'unidad'
  FROM (VALUES
    ('Pan aliñado',  'pan',        1200,  500),
    ('Almojábana',   'pan',        2500, 1100),
    ('Buñuelo',      'reposteria', 1800,  700),
    ('Pandebono',    'pan',        2000,  850)
  ) AS x(nombre, cat, precio, costo)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.productos_pan WHERE agente_id = v_uid AND nombre = x.nombre
  );

  -- Insumos con uno bajo mínimo, para ver la alerta de stock
  INSERT INTO public.insumos_pan (agente_id, nombre, unidad, stock_actual, stock_minimo, precio_unidad)
  SELECT v_uid, x.nombre, x.unidad, x.actual, x.minimo, x.precio
  FROM (VALUES
    ('Harina',    'kg', 45.0, 20.0, 4200),
    ('Azúcar',    'kg', 12.0, 10.0, 3800),
    ('Mantequilla','kg', 3.0,  8.0, 18000),   -- bajo mínimo a propósito
    ('Levadura',  'kg',  2.5,  1.0, 22000)
  ) AS x(nombre, unidad, actual, minimo, precio)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.insumos_pan WHERE agente_id = v_uid AND nombre = x.nombre
  );

  -- Catálogo del POS
  INSERT INTO public.productos_pos (agente_id, nombre, categoria, emoji, precio)
  SELECT v_uid, x.nombre, x.cat, x.emoji, x.precio
  FROM (VALUES
    ('Almojábana',     'panes',   '🫓', 2500),
    ('Pandebono',      'panes',   '🍞', 2000),
    ('Buñuelo',        'postres', '🍩', 1800),
    ('Café americano', 'bebidas', '☕', 3000),
    ('Jugo de naranja','bebidas', '🍊', 5000)
  ) AS x(nombre, cat, emoji, precio)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.productos_pos WHERE agente_id = v_uid AND nombre = x.nombre
  );

  RAISE NOTICE 'Cliente de prueba listo: % (%). Plan anual hasta %.',
    v_negocio, v_email, CURRENT_DATE + 365;
END $$;

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT
  p.full_name                        AS negocio,
  p.email,
  p.role                             AS rol,
  CASE WHEN p.is_approved THEN 'sí' ELSE 'no' END AS aprobado,
  mp.name                            AS plan,
  m.end_date                         AS vence,
  (SELECT string_agg(po.name, ', ' ORDER BY po.name)
     FROM public.user_portal_access a
     JOIN public.portals po ON po.id = a.portal_id
    WHERE a.user_id = p.id)          AS portales,
  (SELECT COUNT(*) FROM public.productos_pan  WHERE agente_id = p.id) AS prod_panaderia,
  (SELECT COUNT(*) FROM public.productos_pos  WHERE agente_id = p.id) AS prod_pos
FROM public.profiles p
LEFT JOIN public.memberships m  ON m.user_id = p.id AND m.status = 'active'
LEFT JOIN public.membership_plans mp ON mp.id = m.plan_id
WHERE p.email = 'panaderia.prueba@ejemplo.com';
