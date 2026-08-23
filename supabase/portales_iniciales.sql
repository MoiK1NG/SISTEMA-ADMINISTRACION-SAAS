-- ─────────────────────────────────────────────────────────────────────────────
-- Portales activos del catálogo comercial
-- Ejecutar en: Supabase → SQL Editor
--
-- Deja operativos los cuatro portales del lanzamiento (panadería, canchas,
-- préstamos y punto de venta) y apaga el resto sin borrar su información.
--
-- Los slugs deben coincidir EXACTAMENTE con las carpetas de app/portal/,
-- porque el middleware y las server actions buscan el portal por slug.
-- Idempotente: se puede ejecutar más de una vez.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Portales activos ───────────────────────────────────────────────────────
INSERT INTO public.portals (name, slug, description, url, icon, color, is_active)
VALUES
  ('Panadería',
   'panaderia',
   'Producción diaria, ventas, inventario de insumos y catálogo de productos con margen por unidad.',
   '/portal/panaderia',
   'croissant',
   '#f97316',
   TRUE),

  ('Canchas Sintéticas',
   'canchas',
   'Calendario de reservas por hora, control de pagos y señas, y ocupación por cancha.',
   '/portal/canchas',
   'dumbbell',
   '#10b981',
   TRUE),

  ('Préstamos',
   'prestamos',
   'Cartera de créditos con cuotas automáticas, interés sobre saldo, registro de pagos y control de mora.',
   '/portal/prestamos',
   'landmark',
   '#1d4ed8',
   TRUE),

  -- Complemento de Panadería: mientras ese portal maneja producción e
  -- inventario, el POS cobra en el mostrador.
  ('Punto de Venta',
   'pos',
   'Cobro rápido desde tablet o celular: catálogo táctil, carrito, IVA automático y vuelto en efectivo.',
   '/portal/pos',
   'store',
   '#8b5cf6',
   TRUE)

ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  url         = EXCLUDED.url,
  icon        = EXCLUDED.icon,
  color       = EXCLUDED.color,
  is_active   = TRUE,
  updated_at  = NOW();


-- ── 2. Todo lo que no esté en el catálogo se apaga ────────────────────────────
-- Lista blanca en vez de enumerar qué apagar: así no sobrevive activo ningún
-- portal viejo o creado a mano que no esté contemplado arriba.
-- Se apagan, no se borran: conservan sus datos y se reactivan poniendo
-- is_active en TRUE cuando se quieran ofrecer.
UPDATE public.portals
SET is_active = FALSE, updated_at = NOW()
WHERE slug NOT IN ('panaderia', 'canchas', 'prestamos', 'pos');


-- ── 3. Portales de ejemplo del seed inicial ───────────────────────────────────
-- Apuntan a ejemplo.com y no tienen código detrás: se eliminan.
-- El borrado arrastra sus filas de user_portal_access (ON DELETE CASCADE).
DELETE FROM public.portals
WHERE slug IN ('empresarial', 'contable', 'rrhh', 'inventario', 'crm')
  AND (url IS NULL OR url LIKE '%ejemplo.com%');


-- ── 4. Verificación ───────────────────────────────────────────────────────────
SELECT
  name,
  slug,
  CASE WHEN is_active THEN '✅ activo' ELSE '⏸ apagado' END AS estado,
  url,
  icon,
  color
FROM public.portals
ORDER BY is_active DESC, name;
