import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, CheckCircle, Clock, Filter,
  Edit2, X, AlertCircle, Info
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Alert, AlertSeverity, AlertStatus } from '../types'

export default function Alerts() {
  const [selectedSeverity, setSelectedSeverity] = useState<AlertSeverity[]>([])
  const [selectedStatus, setSelectedStatus] = useState<AlertStatus[]>([])
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const queryClient = useQueryClient()

  // Fetch alerts
  const { data: alerts, isLoading, error } = useQuery({
    queryKey: ['alerts', selectedSeverity, selectedStatus],
    queryFn: async () => {
      let query = supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })

      if (selectedSeverity.length > 0) {
        query = query.in('severity', selectedSeverity)
      }

      if (selectedStatus.length > 0) {
        query = query.in('status', selectedStatus)
      }

      const { data, error } = await query

      if (error) throw new Error(error.message)
      return data as Alert[]
    },
  })

  // Update alert status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AlertStatus }) => {
      const updates: any = {
        status,
        updated_at: new Date().toISOString(),
      }

      if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('alerts')
        .update(updates)
        .eq('id', id)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })

  // Update alert notes
  const updateNotesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from('alerts')
        .update({ notes, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      setEditingNote(null)
      setNoteText('')
    },
  })

  const handleSaveNote = (id: string) => {
    updateNotesMutation.mutate({ id, notes: noteText })
  }

  // Calculate summary stats
  const summary = alerts?.reduce(
    (acc, alert) => {
      acc.total++
      if (alert.status === 'new') acc.new++
      if (alert.status === 'in_progress') acc.inProgress++
      if (alert.severity === 'critical') acc.critical++
      if (alert.severity === 'high') acc.high++
      return acc
    },
    { total: 0, new: 0, inProgress: 0, critical: 0, high: 0 }
  ) || { total: 0, new: 0, inProgress: 0, critical: 0, high: 0 }

  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical': return 'text-red-700 bg-red-100'
      case 'high': return 'text-orange-700 bg-orange-100'
      case 'medium': return 'text-yellow-700 bg-yellow-100'
      case 'low': return 'text-blue-700 bg-blue-100'
    }
  }

  const getStatusColor = (status: AlertStatus) => {
    switch (status) {
      case 'new': return 'text-red-700 bg-red-50'
      case 'in_progress': return 'text-blue-700 bg-blue-50'
      case 'resolved': return 'text-green-700 bg-green-50'
      case 'ignored': return 'text-gray-700 bg-gray-50'
    }
  }

  const getStatusIcon = (status: AlertStatus) => {
    switch (status) {
      case 'new': return <AlertCircle size={16} />
      case 'in_progress': return <Clock size={16} />
      case 'resolved': return <CheckCircle size={16} />
      case 'ignored': return <X size={16} />
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Performance Alerts</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Alerts</div>
          <div className="text-2xl font-bold mt-1">{summary.total}</div>
        </div>
        <div className="bg-red-50 rounded-lg shadow p-4">
          <div className="text-sm text-red-700">New Alerts</div>
          <div className="text-2xl font-bold text-red-700 mt-1">{summary.new}</div>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4">
          <div className="text-sm text-blue-700">In Progress</div>
          <div className="text-2xl font-bold text-blue-700 mt-1">{summary.inProgress}</div>
        </div>
        <div className="bg-orange-50 rounded-lg shadow p-4">
          <div className="text-sm text-orange-700">Critical</div>
          <div className="text-2xl font-bold text-orange-700 mt-1">{summary.critical}</div>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-4">
          <div className="text-sm text-yellow-700">High Priority</div>
          <div className="text-2xl font-bold text-yellow-700 mt-1">{summary.high}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <span className="text-sm font-medium">Filters:</span>
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Severity:</span>
            {(['critical', 'high', 'medium', 'low'] as AlertSeverity[]).map(severity => (
              <button
                key={severity}
                onClick={() => {
                  setSelectedSeverity(prev =>
                    prev.includes(severity)
                      ? prev.filter(s => s !== severity)
                      : [...prev, severity]
                  )
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                  selectedSeverity.includes(severity)
                    ? getSeverityColor(severity)
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {severity}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Status:</span>
            {(['new', 'in_progress', 'resolved', 'ignored'] as AlertStatus[]).map(status => (
              <button
                key={status}
                onClick={() => {
                  setSelectedStatus(prev =>
                    prev.includes(status)
                      ? prev.filter(s => s !== status)
                      : [...prev, status]
                  )
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                  selectedStatus.includes(status)
                    ? getStatusColor(status)
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>

          {(selectedSeverity.length > 0 || selectedStatus.length > 0) && (
            <button
              onClick={() => {
                setSelectedSeverity([])
                setSelectedStatus([])
              }}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle size={20} />
            <div>
              <div className="font-medium">Failed to load alerts</div>
              <div className="text-sm">{error.message}</div>
              <div className="text-xs mt-1 text-red-600">
                Please check your Supabase configuration in environment variables
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <div className="mt-2 text-gray-600">Loading alerts...</div>
        </div>
      )}

      {/* Alerts Table */}
      {!isLoading && alerts && alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Severity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Account</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Alert</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Detected</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Notes</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {alerts.map(alert => (
                <tr key={alert.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getSeverityColor(alert.severity)}`}>
                      {alert.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{alert.account_name}</td>
                  <td className="px-4 py-3 text-sm">
                    <div>{alert.message}</div>
                    {alert.metric_change && (
                      <div className="text-xs text-gray-500 mt-1">
                        {alert.metric_name}: {alert.metric_change}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                    {alert.alert_type.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(alert.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(alert.status)}`}>
                      {getStatusIcon(alert.status)}
                      {alert.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {editingNote === alert.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          className="border rounded px-2 py-1 text-sm flex-1"
                          placeholder="Add note..."
                        />
                        <button
                          onClick={() => handleSaveNote(alert.id)}
                          className="text-green-600 hover:text-green-700"
                        >
                          <CheckCircle size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingNote(null)
                            setNoteText('')
                          }}
                          className="text-gray-600 hover:text-gray-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">{alert.notes || '-'}</span>
                        <button
                          onClick={() => {
                            setEditingNote(alert.id)
                            setNoteText(alert.notes || '')
                          }}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {alert.status !== 'resolved' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: alert.id, status: 'resolved' })}
                          className="text-green-600 hover:text-green-700 text-sm"
                          title="Mark as resolved"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                      {alert.status === 'new' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: alert.id, status: 'in_progress' })}
                          className="text-blue-600 hover:text-blue-700 text-sm"
                          title="Mark in progress"
                        >
                          <Clock size={16} />
                        </button>
                      )}
                      {alert.status !== 'ignored' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: alert.id, status: 'ignored' })}
                          className="text-gray-600 hover:text-gray-700 text-sm"
                          title="Ignore"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && alerts && alerts.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Info className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts found</h3>
          <p className="text-gray-600">
            {selectedSeverity.length > 0 || selectedStatus.length > 0
              ? 'Try adjusting your filters to see more alerts.'
              : 'All clear! No performance alerts at this time.'}
          </p>
        </div>
      )}
    </div>
  )
}
