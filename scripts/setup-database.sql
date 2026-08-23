-- =====================================================
-- SISTEMA DE ADMINISTRACIÓN SAAS - ESQUEMA DE BASE DE DATOS
-- =====================================================
-- Ejecutar este script en el SQL Editor de Supabase
-- =====================================================

-- 1. TABLA DE PERFILES
-- Almacena información extendida de usuarios
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('superadmin', 'admin', 'user')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TABLA DE PLANES DE MEMBRESÍA
-- Define los diferentes planes disponibles
CREATE TABLE IF NOT EXISTS public.membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  duration_days INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TABLA DE MEMBRESÍAS
-- Relación entre usuarios y planes con fechas de vigencia
CREATE TABLE IF NOT EXISTS public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.membership_plans(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. TABLA DE PORTALES
-- Portales empresariales disponibles
CREATE TABLE IF NOT EXISTS public.portals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  url TEXT,
  icon TEXT DEFAULT 'building',
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. TABLA DE ACCESO A PORTALES
-- Control de qué usuarios tienen acceso a qué portales
CREATE TABLE IF NOT EXISTS public.user_portal_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  portal_id UUID NOT NULL REFERENCES public.portals(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES public.profiles(id),
  UNIQUE(user_id, portal_id)
);

-- =====================================================
-- FUNCIÓN Y TRIGGER: Crear perfil automáticamente
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'user',
    true,
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger si existe y recrear
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- FUNCIÓN: Actualizar updated_at automáticamente
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_membership_plans_updated_at ON public.membership_plans;
CREATE TRIGGER update_membership_plans_updated_at
  BEFORE UPDATE ON public.membership_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_memberships_updated_at ON public.memberships;
CREATE TRIGGER update_memberships_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_portals_updated_at ON public.portals;
CREATE TRIGGER update_portals_updated_at
  BEFORE UPDATE ON public.portals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- HABILITAR RLS (Row Level Security)
-- =====================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_portal_access ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS RLS - PROFILES
-- ⚠ Las policies de admin de este bloque son auto-referenciales y causan
--   recursión de RLS (error 42P17). supabase/security_fixes.sql las
--   reemplaza por versiones basadas en is_admin() — ejecutarlo SIEMPRE
--   después de este script.
-- =====================================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- =====================================================
-- POLÍTICAS RLS - MEMBERSHIPS
-- =====================================================
DROP POLICY IF EXISTS "Users can view own memberships" ON public.memberships;
CREATE POLICY "Users can view own memberships" ON public.memberships
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all memberships" ON public.memberships;
CREATE POLICY "Admins can view all memberships" ON public.memberships
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Admins can insert memberships" ON public.memberships;
CREATE POLICY "Admins can insert memberships" ON public.memberships
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Admins can update memberships" ON public.memberships;
CREATE POLICY "Admins can update memberships" ON public.memberships
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete memberships" ON public.memberships;
CREATE POLICY "Admins can delete memberships" ON public.memberships
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- =====================================================
-- POLÍTICAS RLS - MEMBERSHIP PLANS
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.membership_plans;
CREATE POLICY "Anyone can view active plans" ON public.membership_plans
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can view all plans" ON public.membership_plans;
CREATE POLICY "Admins can view all plans" ON public.membership_plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Admins can insert plans" ON public.membership_plans;
CREATE POLICY "Admins can insert plans" ON public.membership_plans
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Admins can update plans" ON public.membership_plans;
CREATE POLICY "Admins can update plans" ON public.membership_plans
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete plans" ON public.membership_plans;
CREATE POLICY "Admins can delete plans" ON public.membership_plans
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- =====================================================
-- POLÍTICAS RLS - PORTALS
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view active portals" ON public.portals;
CREATE POLICY "Anyone can view active portals" ON public.portals
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can view all portals" ON public.portals;
CREATE POLICY "Admins can view all portals" ON public.portals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Admins can insert portals" ON public.portals;
CREATE POLICY "Admins can insert portals" ON public.portals
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Admins can update portals" ON public.portals;
CREATE POLICY "Admins can update portals" ON public.portals
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete portals" ON public.portals;
CREATE POLICY "Admins can delete portals" ON public.portals
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- =====================================================
-- POLÍTICAS RLS - USER PORTAL ACCESS
-- =====================================================
DROP POLICY IF EXISTS "Users can view own access" ON public.user_portal_access;
CREATE POLICY "Users can view own access" ON public.user_portal_access
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all access" ON public.user_portal_access;
CREATE POLICY "Admins can view all access" ON public.user_portal_access
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Admins can insert access" ON public.user_portal_access;
CREATE POLICY "Admins can insert access" ON public.user_portal_access
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete access" ON public.user_portal_access;
CREATE POLICY "Admins can delete access" ON public.user_portal_access
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- =====================================================
-- ÍNDICES PARA RENDIMIENTO
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_approved ON public.profiles(is_approved);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_plan_id ON public.memberships(plan_id);
CREATE INDEX IF NOT EXISTS idx_memberships_end_date ON public.memberships(end_date);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON public.memberships(status);

CREATE INDEX IF NOT EXISTS idx_portals_slug ON public.portals(slug);
CREATE INDEX IF NOT EXISTS idx_portals_is_active ON public.portals(is_active);

CREATE INDEX IF NOT EXISTS idx_user_portal_access_user ON public.user_portal_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_portal_access_portal ON public.user_portal_access(portal_id);

-- =====================================================
-- DATOS INICIALES
-- =====================================================

-- Planes de membresía de ejemplo
INSERT INTO public.membership_plans (name, description, duration_days, price, is_active) VALUES
  ('Plan Mensual', 'Acceso completo por 30 días', 30, 29.99, true),
  ('Plan Trimestral', 'Acceso completo por 90 días - Ahorra 20%', 90, 79.99, true),
  ('Plan Anual', 'Acceso completo por 365 días - Ahorra 30%', 365, 249.99, true)
ON CONFLICT DO NOTHING;

-- Portales de ejemplo
INSERT INTO public.portals (name, slug, description, url, icon, color, is_active) VALUES
  ('Portal Empresarial', 'empresarial', 'Gestión empresarial completa', 'https://empresarial.ejemplo.com', 'building', '#3b82f6', true),
  ('Portal Contable', 'contable', 'Sistema de contabilidad', 'https://contable.ejemplo.com', 'calculator', '#10b981', true),
  ('Portal RRHH', 'rrhh', 'Recursos Humanos', 'https://rrhh.ejemplo.com', 'users', '#8b5cf6', true),
  ('Portal Inventario', 'inventario', 'Control de inventario', 'https://inventario.ejemplo.com', 'package', '#f59e0b', true),
  ('Portal CRM', 'crm', 'Gestión de clientes', 'https://crm.ejemplo.com', 'contact', '#ef4444', true)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- NOTA: CREAR PRIMER SUPERADMIN
-- =====================================================
-- Después de registrarte con tu email, ejecuta:
-- 
-- UPDATE public.profiles 
-- SET role = 'superadmin', is_approved = true 
-- WHERE email = 'tu-email@ejemplo.com';
-- =====================================================
