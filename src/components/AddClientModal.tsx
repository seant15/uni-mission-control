import { useState } from 'react'
import { X } from 'lucide-react'
import { db } from '../lib/api'
import { formatSupabaseError } from '../lib/supabaseErrors'

type Agency = { id: string; name: string; slug: string }

export default function AddClientModal({
  agencies,
  onClose,
  onCreated,
}: {
  agencies: Agency[]
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [businessType, setBusinessType] = useState<'leadgen' | 'ecommerce'>('ecommerce')
  const [agencyId, setAgencyId] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Client name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await db.createClientRecord({
        name: name.trim(),
        business_type: businessType,
        agency_id: agencyId || null,
        currency,
      })
      onCreated()
      onClose()
    } catch (err: unknown) {
      setError(formatSupabaseError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/40">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-md w-full p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900">Add client</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-stone-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Client name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2"
            placeholder="e.g. Acme Store"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Business type</label>
            <select
              value={businessType}
              onChange={e => setBusinessType(e.target.value as 'leadgen' | 'ecommerce')}
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2"
            >
              <option value="ecommerce">eCommerce</option>
              <option value="leadgen">Lead gen</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Currency</label>
            <input
              value={currency}
              onChange={e => setCurrency(e.target.value.toUpperCase())}
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2"
              maxLength={3}
            />
          </div>
        </div>

        {agencies.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Agency</label>
            <select
              value={agencyId}
              onChange={e => setAgencyId(e.target.value)}
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2"
            >
              <option value="">Default / unset</option>
              {agencies.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create client'}
          </button>
        </div>
      </form>
    </div>
  )
}
