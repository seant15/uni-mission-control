import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { setScopedAgencyId } from '../lib/agencyScope'
import { useAuth } from './AuthContext'
import { normalizeRole } from '../lib/rbac'

const STORAGE_KEY = 'uni_current_agency_id'

export type AgencyRow = { id: string; name: string; slug: string }

type AgencyContextValue = {
  agencies: AgencyRow[]
  currentAgencyId: string | null
  currentAgency: AgencyRow | null
  setCurrentAgencyId: (id: string | null) => void
  canSwitchAgency: boolean
  loading: boolean
}

const AgencyContext = createContext<AgencyContextValue | null>(null)

function readStoredAgencyId(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY)?.trim() || null
  } catch {
    return null
  }
}

function writeStoredAgencyId(id: string | null) {
  try {
    if (id) sessionStorage.setItem(STORAGE_KEY, id)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}

async function fetchAgencies(): Promise<AgencyRow[]> {
  const { data, error } = await supabase.from('agencies').select('id, name, slug').order('name')
  if (error) {
    if (error.message?.includes('agencies') || error.code === '42P01') return []
    throw error
  }
  return (data ?? []) as AgencyRow[]
}

export function AgencyProvider({ children }: { children: ReactNode }) {
  const { appUser } = useAuth()
  const queryClient = useQueryClient()
  const role = normalizeRole(appUser?.role)
  const canSwitchAgency = role === 'super_admin'

  const { data: agencies = [], isLoading } = useQuery({
    queryKey: ['agencies'],
    queryFn: fetchAgencies,
    staleTime: 5 * 60_000,
  })

  const lockedAgencyId = !canSwitchAgency ? appUser?.agency_id ?? null : null

  const [pickedAgencyId, setPickedAgencyId] = useState<string | null>(() =>
    canSwitchAgency ? readStoredAgencyId() : null
  )

  useEffect(() => {
    if (!canSwitchAgency) return
    const stored = readStoredAgencyId()
    if (stored !== pickedAgencyId) setPickedAgencyId(stored)
  }, [canSwitchAgency, pickedAgencyId])

  const effectiveAgencyId = lockedAgencyId ?? pickedAgencyId

  useEffect(() => {
    setScopedAgencyId(effectiveAgencyId)
  }, [effectiveAgencyId])

  const setCurrentAgencyId = useCallback(
    (id: string | null) => {
      if (!canSwitchAgency) return
      writeStoredAgencyId(id)
      setPickedAgencyId(id)
      setScopedAgencyId(id)
      void queryClient.invalidateQueries()
    },
    [canSwitchAgency, queryClient]
  )

  const currentAgency = useMemo(
    () => agencies.find(a => a.id === effectiveAgencyId) ?? null,
    [agencies, effectiveAgencyId]
  )

  const value = useMemo(
    () => ({
      agencies,
      currentAgencyId: effectiveAgencyId,
      currentAgency,
      setCurrentAgencyId,
      canSwitchAgency,
      loading: isLoading,
    }),
    [agencies, effectiveAgencyId, currentAgency, setCurrentAgencyId, canSwitchAgency, isLoading]
  )

  return <AgencyContext.Provider value={value}>{children}</AgencyContext.Provider>
}

export function useAgency(): AgencyContextValue {
  const ctx = useContext(AgencyContext)
  if (!ctx) throw new Error('useAgency must be used within AgencyProvider')
  return ctx
}

export function useAgencyOptional(): AgencyContextValue | null {
  return useContext(AgencyContext)
}
