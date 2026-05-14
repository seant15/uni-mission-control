import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { normalizeRole, type EffectiveRole } from '../lib/rbac'

export function RoleGuard({
  allowed,
  children,
  redirectTo = '/',
}: {
  allowed: EffectiveRole[]
  children: ReactNode
  redirectTo?: string
}) {
  const { appUser, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-500 text-sm">
        Loading…
      </div>
    )
  }
  const r = normalizeRole(appUser?.role)
  if (!allowed.includes(r)) return <Navigate to={redirectTo} replace />
  return <>{children}</>
}
