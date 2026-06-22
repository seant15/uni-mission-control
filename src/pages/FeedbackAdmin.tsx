import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquarePlus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { FeedbackRow, FeedbackFilters } from '../types/feedback'
import FeedbackStats from './FeedbackAdmin/FeedbackStats'
import FeedbackFiltersBar from './FeedbackAdmin/FeedbackFilters'
import FeedbackTable from './FeedbackAdmin/FeedbackTable'
import FeedbackDrawer from './FeedbackAdmin/FeedbackDrawer'
import TabPageShell from '../components/ui/TabPageShell'
import DashboardSection from '../components/ui/DataTable'

export default function FeedbackAdmin() {
  const { appUser } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Redirect non-admins
  useEffect(() => {
    if (appUser && appUser.role !== 'super_admin') {
      navigate('/', { replace: true })
    }
  }, [appUser, navigate])

  const [filters, setFilters] = useState<FeedbackFilters>({})
  const [selectedRow, setSelectedRow] = useState<FeedbackRow | null>(null)

  const { data = [], isLoading, error } = useQuery<FeedbackRow[]>({
    queryKey: ['feedback', filters],
    queryFn: () => db.getFeedback(filters),
    enabled: appUser?.role === 'super_admin',
    staleTime: 30_000,
  })

  const statusFilterActive = (filters.status?.length ?? 0) > 0
  const listRows = useMemo(() => {
    if (statusFilterActive) return data
    const hide = new Set(['resolved', 'wont_fix', 'duplicate'] as const)
    return data.filter(r => !hide.has(r.status as 'resolved' | 'wont_fix' | 'duplicate'))
  }, [data, statusFilterActive])

  // Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('feedback-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feedback' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['feedback'] })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [queryClient])

  const unresolvedCount = useMemo(
    () => data.filter(r => r.status === 'new' || r.status === 'acknowledged').length,
    [data]
  )

  if (!appUser || appUser.role !== 'super_admin') return null

  return (
    <TabPageShell
      title="Feedback"
      icon={<MessageSquarePlus size={22} />}
      headerExtra={
        unresolvedCount > 0 ? (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold -mt-8 sm:mt-0">
            {unresolvedCount > 99 ? '99+' : unresolvedCount}
          </span>
        ) : undefined
      }
    >
      <FeedbackStats rows={data} />

      {/* Filter bar */}
      <FeedbackFiltersBar filters={filters} onChange={setFilters} />

      {/* Loading / error states */}
      {isLoading && (
        <DashboardSection bodyClassName="py-16 flex items-center justify-center">
          <p className="text-sm text-[var(--uni-text-muted)]">Loading feedback...</p>
        </DashboardSection>
      )}

      {error && (
        <div className="bg-red-50 rounded-xl border border-red-200 py-8 px-6 text-sm text-red-700">
          Failed to load feedback. {(error as Error).message}
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && (
        <FeedbackTable
          rows={listRows}
          onViewDetail={setSelectedRow}
        />
      )}

      {/* Detail drawer */}
      <FeedbackDrawer
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
      />
    </TabPageShell>
  )
}
