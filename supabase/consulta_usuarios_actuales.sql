-- ─────────────────────────────────────────────────────────────────────────────
-- ¿QUÉ USUARIOS HAY HOY? · solo lectura
-- Ejecutar en: Supabase → SQL Editor. No modifica nada.
--
-- Una fila por usuario: correo, rol de plataforma, estado de la cuenta,
-- membresía, portales habilitados y, si pertenece a un negocio, el negocio
-- y su rol dentro de él. Las contraseñas no se pueden leer (Supabase guarda
-- solo el hash); para QA hay que asignar una nueva.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  u.email,
  p.full_name                                        AS nombre,
  p.role                                             AS rol_plataforma,
  CASE WHEN NOT p.is_approved THEN 'pendiente'
       WHEN NOT p.is_active   THEN 'suspendida'
       ELSE 'activa' END                             AS estado_cuenta,
  u.email_confirmed_at IS NOT NULL                   AS correo_confirmado,
  m.status                                           AS membresia,
  m.end_date::date                                   AS membresia_hasta,
  (SELECT string_agg(po.slug, ', ' ORDER BY po.slug)
     FROM public.user_portal_access upa
     JOIN public.portals po ON po.id = upa.portal_id
    WHERE upa.user_id = u.id)                        AS portales,
  n.nombre                                           AS negocio,
  mn.rol                                             AS rol_negocio,
  u.last_sign_in_at::timestamp(0)                    AS ultimo_login,
  u.created_at::date                                 AS creado
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN LATERAL (
  SELECT status, end_date
    FROM public.memberships
   WHERE user_id = u.id
   ORDER BY end_date DESC
   LIMIT 1
) m ON TRUE
LEFT JOIN public.miembros_negocio mn ON mn.user_id = u.id
LEFT JOIN public.negocios n ON n.id = mn.negocio_id
ORDER BY p.role, n.nombre NULLS LAST, mn.rol, u.email;
