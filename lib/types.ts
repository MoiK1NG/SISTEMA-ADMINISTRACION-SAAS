export type UserRole = 'superadmin' | 'admin' | 'user'

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
  duration_days: number
  price: number
  created_at: string
  updated_at: string
}

export interface Membership {
  id: string
  user_id: string
  plan_id: string
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
  updated_at: string
  membership_plans?: MembershipPlan
}

export interface Portal {
  id: string
  name: string
  slug: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserPortalAccess {
  id: string
  user_id: string
  portal_id: string
  created_at: string
  portals?: Portal
}

export interface UserWithMembership extends Profile {
  memberships?: Membership[]
}
