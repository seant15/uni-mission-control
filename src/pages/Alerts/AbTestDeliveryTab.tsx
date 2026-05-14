import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { db } from '../../lib/api'
import type { ClientAbTestConfig, AbTestPlatform, AbTestEntityType, AbTestCadence } from '../../types/abTestDelivery'

interface Props {
  currentUserId: string
}

export default function AbTestDeliveryTab({ currentUserId }: Props) {
  const queryClient = useQueryClient()
  const [clientId, setClientId] = useState<string>('')

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list-ab'],
    queryFn: () => db.getClients(),
    staleTime: 300_000,
  })

  useEffect(() => {
    if (!clientId && clients.length > 0) {
      setClientId((clients as { id: string }[])[0].id)
    }
  }, [clients, clientId])

  const { data: configs = [], isLoading: loadingConfigs, error: errConfigs } = useQuery({
    queryKey: ['ab-test-configs', clientId],
    queryFn: () => db.listAbTestConfigs(clientId),
    enabled: !!clientId,
  })

  const { data: delivery, isLoading: loadingDelivery } = useQuery({
    queryKey: ['client-alert-delivery', clientId],
    queryFn: () => db.getClientAlertDelivery(clientId),
    enabled: !!clientId,
  })

  const [abName, setAbName] = useState('')
  const [abPlatform, setAbPlatform] = useState<AbTestPlatform>('meta_ads')
  const [abEntityType, setAbEntityType] = useState<AbTestEntityType>('campaign')
  const [abEntityName, setAbEntityName] = useState('')
  const [abCadence, setAbCadence] = useState<AbTestCadence>('daily')
  const [abNotes, setAbNotes] = useState('')
  const [abIsActive, setAbIsActive] = useState(true)
  const [editingAbId, setEditingAbId] = useState<string | null>(null)

  const [notifyInApp, setNotifyInApp] = useState(true)
  const [slackUrl, setSlackUrl] = useState('')
  const [slackChannel, setSlackChannel] = useState('')
  const [notifyEmails, setNotifyEmails] = useState('')

  useEffect(() => {
    if (!delivery) {
      setNotifyInApp(true)
      setSlackUrl('')
      setSlackChannel('')
      setNotifyEmails('')
      return
    }
    setNotifyInApp(delivery.notify_in_app)
    setSlackUrl(delivery.slack_webhook_url ?? '')
    setSlackChannel(delivery.slack_channel ?? '')
    setNotifyEmails(delivery.notify_emails ?? '')
  }, [delivery])

  function resetAbForm() {
    setAbName('')
    setAbEntityName('')
    setAbNotes('')
    setEditingAbId(null)
    setAbCadence('daily')
    setAbPlatform('meta_ads')
    setAbEntityType('campaign')
    setAbIsActive(true)
  }

  function loadAbForEdit(c: ClientAbTestConfig) {
    setEditingAbId(c.id)
    setAbName(c.name)
    setAbPlatform(c.platform)
    setAbEntityType(c.entity_type)
    setAbEntityName(c.entity_name)
    setAbCadence(c.cadence)
    setAbNotes(c.notes ?? '')
    setAbIsActive(c.is_active)
  }

  const saveAbMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error('Select a client')
      if (!abName.trim() || !abEntityName.trim()) throw new Error('Name and object name are required')
      if (editingAbId) {
        await db.updateAbTestConfig(editingAbId, {
          name: abName.trim(),
          platform: abPlatform,
          entity_type: abEntityType,
          entity_name: abEntityName.trim(),
          cadence: abCadence,
          notes: abNotes.trim(),
          is_active: abIsActive,
        })
      } else {
        await db.createAbTestConfig({
          client_id: clientId,
          name: abName.trim(),
          platform: abPlatform,
          entity_type: abEntityType,
          entity_name: abEntityName.trim(),
          cadence: abCadence,
          is_active: true,
          notes: abNotes.trim(),
          created_by: currentUserId || null,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ab-test-configs', clientId] })
      toast.success(editingAbId ? 'A/B config updated' : 'A/B config created')
      resetAbForm()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleAbMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => db.updateAbTestConfig(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ab-test-configs', clientId] }),
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteAbMutation = useMutation({
    mutationFn: (id: string) => db.deleteAbTestConfig(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ab-test-configs', clientId] })
      toast.success('Removed')
      if (editingAbId) resetAbForm()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const saveDeliveryMutation = useMutation({
    mutationFn: () =>
      db.upsertClientAlertDelivery({
        client_id: clientId,
        notify_in_app: notifyInApp,
        slack_webhook_url: slackUrl.trim() || null,
        slack_channel: slackChannel.trim() || null,
        slack_notify_alert_rules: delivery?.slack_notify_alert_rules ?? false,
        notify_emails: notifyEmails.trim() || null,
        updated_by: currentUserId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-alert-delivery', clientId] })
      toast.success('Delivery settings saved')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const { data: lastJob, error: jobRunError, isLoading: jobRunLoading } = useQuery({
    queryKey: ['job-runs-last-ab'],
    queryFn: () => db.getLastAbJobRun(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">A/B tests & alert delivery</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">
            Presets are stored per client for Meta and Google. Hourly/daily cadence is used by your Python or automation jobs to
            build reports and optional Slack/email sends. One delivery profile per client applies to everyone who can see that client.
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
          <select
            value={clientId}
            onChange={e => { setClientId(e.target.value); resetAbForm() }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-w-[220px] bg-white"
            disabled={clients.length === 0}
          >
            {(clients as { id: string; name: string }[]).length === 0 ? (
              <option value="">No clients</option>
            ) : (
              (clients as { id: string; name: string }[]).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))
            )}
          </select>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 text-sm text-slate-800">
        <h3 className="font-semibold text-gray-900 mb-1">A/B reports job (VPS cron)</h3>
        <p className="text-xs text-slate-600 mb-3">
          Last run of <code className="rounded bg-white px-1 border border-slate-200">ab_test_reports</code> from{' '}
          <code className="rounded bg-white px-1 border border-slate-200">job_runs</code>. Needs Supabase migration{' '}
          <code className="rounded bg-white px-1 border border-slate-200">20260516210000_job_runs.sql</code>.
        </p>
        {jobRunLoading && <p className="text-slate-500">Loading last run…</p>}
        {jobRunError && (
          <p className="text-amber-800 text-xs">
            {(jobRunError as Error).message}. If the table or policy is missing, apply the migrations listed in{' '}
            <code className="rounded bg-amber-100 px-1">docs/FRONTEND_DEV_ADAPTER_JOB_RUNS_RLS_2026-05-16.md</code>.
          </p>
        )}
        {!jobRunLoading && !jobRunError && !lastJob && (
          <p className="text-slate-600 text-xs">No runs recorded yet (or no SELECT access).</p>
        )}
        {!jobRunLoading && lastJob && (
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                <span className="text-slate-500">Finished:</span>{' '}
                {lastJob.finished_at
                  ? new Date(lastJob.finished_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                  : '—'}
              </span>
              <span>
                <span className="text-slate-500">Status:</span>{' '}
                <span className={lastJob.status === 'failed' ? 'font-semibold text-red-700' : 'font-medium text-green-700'}>
                  {lastJob.status ?? '—'}
                </span>
              </span>
              {lastJob.scope != null && lastJob.scope !== '' && (
                <span>
                  <span className="text-slate-500">Scope:</span> {lastJob.scope}
                </span>
              )}
              {lastJob.duration_ms != null && (
                <span>
                  <span className="text-slate-500">Duration:</span> {lastJob.duration_ms} ms
                </span>
              )}
              {lastJob.exit_code != null && (
                <span>
                  <span className="text-slate-500">Exit code:</span> {lastJob.exit_code}
                </span>
              )}
            </div>
            {typeof lastJob.meta?.reports_written === 'number' && (
              <p>
                <span className="text-slate-500">Reports this run:</span> {lastJob.meta.reports_written}
              </p>
            )}
            {lastJob.status === 'failed' && lastJob.error_message && (
              <p className="text-red-800 break-words" title={lastJob.error_message}>
                {lastJob.error_message.length > 280 ? `${lastJob.error_message.slice(0, 280)}…` : lastJob.error_message}
              </p>
            )}
          </div>
        )}
      </section>

      {errConfigs && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {(errConfigs as Error).message}. If tables are missing, run{' '}
          <code className="rounded bg-amber-100 px-1">supabase/migrations/20260512160000_ab_test_configs_and_delivery.sql</code>.
        </div>
      )}

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Alert delivery (this client)</h3>
        {loadingDelivery && <p className="text-sm text-gray-500">Loading…</p>}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={notifyInApp} onChange={e => setNotifyInApp(e.target.checked)} />
          In-app alerts (default)
        </label>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Slack incoming webhook (optional)</label>
          <input
            type="url"
            value={slackUrl}
            onChange={e => setSlackUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full max-w-xl px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Slack channel label (optional)</label>
          <input
            type="text"
            value={slackChannel}
            onChange={e => setSlackChannel(e.target.value)}
            placeholder="#alerts-client"
            className="w-full max-w-xl px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email recipients (optional, comma-separated)</label>
          <textarea
            value={notifyEmails}
            onChange={e => setNotifyEmails(e.target.value)}
            rows={2}
            placeholder="ops@company.com, lead@company.com"
            className="w-full max-w-xl px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <button
          type="button"
          disabled={!clientId || saveDeliveryMutation.isPending}
          onClick={() => saveDeliveryMutation.mutate()}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          Save delivery settings
        </button>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-gray-900">A/B monitoring presets</h3>
          {editingAbId && (
            <button type="button" onClick={resetAbForm} className="text-sm text-blue-600 hover:underline">
              Cancel edit
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
            <input value={abName} onChange={e => setAbName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="e.g. Q2 creative test" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Platform</label>
            <select value={abPlatform} onChange={e => setAbPlatform(e.target.value as AbTestPlatform)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="meta_ads">Meta</option>
              <option value="google_ads">Google</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Object level</label>
            <select value={abEntityType} onChange={e => setAbEntityType(e.target.value as AbTestEntityType)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="campaign">Campaign</option>
              <option value="ad_set">Ad set</option>
              <option value="ad">Ad / creative</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Object name (match in reports)</label>
            <input value={abEntityName} onChange={e => setAbEntityName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Exact or stable name as in ad platform" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Report cadence</label>
            <select value={abCadence} onChange={e => setAbCadence(e.target.value as AbTestCadence)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="daily">Daily</option>
              <option value="hourly">Hourly</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm pb-2">
              <input type="checkbox" checked={abIsActive} onChange={e => setAbIsActive(e.target.checked)} />
              Preset active
            </label>
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (plain text / links)</label>
            <textarea value={abNotes} onChange={e => setAbNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Hypothesis, links to brief, etc." />
          </div>
        </div>
        <button
          type="button"
          disabled={!clientId || saveAbMutation.isPending}
          onClick={() => saveAbMutation.mutate()}
          className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 disabled:opacity-50"
        >
          {editingAbId ? 'Update preset' : 'Add preset'}
        </button>

        <div className="border-t border-gray-100 pt-4 mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Saved presets</h4>
          {loadingConfigs && <p className="text-sm text-gray-500">Loading…</p>}
          {!loadingConfigs && (configs as ClientAbTestConfig[]).length === 0 && (
            <p className="text-sm text-gray-500">No presets yet for this client.</p>
          )}
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
            {(configs as ClientAbTestConfig[]).map(c => (
              <li key={c.id} className="flex flex-col gap-2 py-3 px-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium text-gray-900 text-sm">{c.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {c.platform === 'meta_ads' ? 'Meta' : 'Google'} · {c.entity_type.replace('_', ' ')} · {c.entity_name} · {c.cadence}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => toggleAbMutation.mutate({ id: c.id, is_active: !c.is_active })}
                    className={`text-xs px-2 py-1 rounded-lg border ${c.is_active ? 'border-green-200 text-green-800 bg-green-50' : 'border-gray-200 text-gray-600'}`}
                  >
                    {c.is_active ? 'Active' : 'Paused'}
                  </button>
                  <button type="button" onClick={() => loadAbForEdit(c)} className="text-xs px-2 py-1 text-blue-600 hover:underline">Edit</button>
                  <button type="button" onClick={() => deleteAbMutation.mutate(c.id)} className="text-xs px-2 py-1 text-red-600 hover:underline">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
