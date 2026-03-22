import { useState, useEffect } from 'react'
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

  const unresolvedCount = data.filter(r => r.status === 'new' || r.status === 'acknowledged').length

  if (!appUser || appUser.role !== 'super_admin') return null

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <MessageSquarePlus size={22} className="text-blue-600" />
        <h1 className="text-xl font-bold text-gray-900">Feedback</h1>
        {unresolvedCount > 0 && (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold">
            {unresolvedCount > 99 ? '99+' : unresolvedCount}
          </span>
        )}
      </div>

      {/* KPI tiles */}
      <FeedbackStats rows={data} />

      {/* Filter bar */}
      <FeedbackFiltersBar filters={filters} onChange={setFilters} />

      {/* Loading / error states */}
      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 py-16 flex items-center justify-center">
          <p className="text-sm text-gray-400">Loading feedback...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 rounded-xl border border-red-200 py-8 px-6 text-sm text-red-700">
          Failed to load feedback. {(error as Error).message}
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && (
        <FeedbackTable
          rows={data}
          onViewDetail={setSelectedRow}
        />
      )}

      {/* Detail drawer */}
      <FeedbackDrawer
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  )
}
