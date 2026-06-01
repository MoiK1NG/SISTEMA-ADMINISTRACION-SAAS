'use client'

import { useSearchParams } from 'next/navigation'
import { AlertTriangle, ShieldX, CreditCard, PowerOff } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { PortalErrorCode } from '@/lib/supabase/middleware'

const ERROR_CONFIG: Record<
  PortalErrorCode,
  { icon: React.ElementType; title: string; description: string; variant: 'destructive' | 'default' }
> = {
  no_access: {
    icon: ShieldX,
    title: 'Sin acceso a este portal',
    description:
      'No tienes permiso para acceder a este portal. Contacta al administrador para solicitar acceso.',
    variant: 'destructive',
  },
  membership_expired: {
    icon: CreditCard,
    title: 'Membresía expirada o inactiva',
    description:
      'Tu membresía no está vigente. Renueva tu plan para recuperar el acceso a los portales.',
    variant: 'destructive',
  },
  portal_inactive: {
    icon: PowerOff,
    title: 'Portal no disponible',
    description:
      'Este portal está temporalmente desactivado. Por favor, intenta más tarde.',
    variant: 'default',
  },
  unauthorized: {
    icon: AlertTriangle,
    title: 'Sesión requerida',
    description: 'Debes iniciar sesión para acceder a los portales.',
    variant: 'destructive',
  },
}

const VALID_CODES = new Set<PortalErrorCode>([
  'no_access',
  'membership_expired',
  'portal_inactive',
  'unauthorized',
])

export function PortalAccessAlert() {
  const searchParams = useSearchParams()
  const errorCode = searchParams.get('error') as PortalErrorCode | null

  if (!errorCode || !VALID_CODES.has(errorCode)) return null

  const { icon: Icon, title, description, variant } = ERROR_CONFIG[errorCode]

  return (
    <Alert variant={variant} className="mb-6">
      <Icon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  )
}
