export type UserRole = 'superadmin' | 'admin' | 'user'

export type MembershipStatus = 'active' | 'expired' | 'cancelled' | 'suspended'

export interface Profile {
  id: string
  full_name: string | null
  email: string
  role: UserRole
  is_active: boolean
  is_approved: boolean
  created_at: string
  updated_at: string
}

export interface MembershipPlan {
  id: string
  name: string
  description: string | null
  duration_days: number
  price: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Membership {
  id: string
  user_id: string
  plan_id: string
  start_date: string
  end_date: string
  status: MembershipStatus
  created_at: string
  updated_at: string
  membership_plans?: MembershipPlan
}

export interface Portal {
  id: string
  name: string
  slug: string
  description: string | null
  url: string | null
  icon: string | null
  color: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserPortalAccess {
  id: string
  user_id: string
  portal_id: string
  granted_at: string
  granted_by: string | null
  portals?: Portal
}

export interface UserWithMembership extends Profile {
  memberships?: Membership[]
  user_portal_access?: UserPortalAccess[]
}

export interface PortalWithAccess extends Portal {
  user_portal_access?: { user_id: string }[]
}
