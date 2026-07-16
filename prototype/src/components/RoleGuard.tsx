import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { Role } from '../types'
import { useAuth } from '../context/AuthContext'

interface RoleGuardProps {
  allow: Role[]
  children: ReactNode
}

/** Redirects to '/' when the current user's role isn't in `allow`. Wraps
 * every account/curator/admin route per the IA's access-level column. */
export function RoleGuard({ allow, children }: RoleGuardProps) {
  const { role } = useAuth()
  if (!allow.includes(role)) return <Navigate to="/" replace />
  return <>{children}</>
}
