-- ─────────────────────────────────────────────────────────────────────────────
-- AUDITORÍA · crear audit_logs y dejar que cada usuario registre sus acciones
-- Ejecutar en: Supabase → SQL Editor. Idempotente: se puede correr varias veces.
--
-- Por qué: audit_schema.sql nunca se aplicó en producción (2026-10-01: "relation
-- public.audit_logs does not exist"). La app no falla porque cada registro de
-- auditoría ignora su error, pero NO se guardó ninguno: ni las acciones del
-- panel admin ni las de la farmacia (equipo, anulaciones, eliminaciones).
--
-- Además, la política original solo dejaba INSERTAR a admins/superadmins, y las
-- acciones de farmacia las registra el dueño o el regente (rol 'user'): aun con
-- la tabla creada, sus registros se habrían rechazado en silencio.
--
-- Este script reemplaza a audit_schema.sql:
--   · Misma tabla e índices.
--   · LEER: solo admins/superadmins (sin cambios).
--   · INSERTAR: admins/superadmins, y cualquier usuario autenticado SOLO a su
--     propio nombre (admin_id = auth.uid()): nadie puede firmar por otro.
--   · Sin UPDATE ni DELETE: el log no se reescribe.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,  -- quien hizo la acción
  action       VARCHAR(100) NOT NULL,
  entity_type  VARCHAR(50)  NOT NULL,  -- 'user' | 'membership' | 'portal' | 'plan' | 'producto_farmacia' | ...
  entity_id    UUID,
  entity_name  TEXT,
  details      JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id    ON public.audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON public.audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action      ON public.audit_logs(action);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_read_audit_logs" ON public.audit_logs;
CREATE POLICY "admins_read_audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "admins_insert_audit_logs" ON public.audit_logs;
CREATE POLICY "admins_insert_audit_logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Dueño, regente o cajero registran SUS propias acciones (equipo, anulaciones…)
DROP POLICY IF EXISTS "usuarios_insert_propio_audit_log" ON public.audit_logs;
CREATE POLICY "usuarios_insert_propio_audit_log" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (admin_id = auth.uid());

-- Verificación
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'audit_logs'
ORDER BY policyname;
