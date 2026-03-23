import { useState, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Image, Video, DollarSign, TrendingUp, ShoppingCart, MousePointer2,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight, ExternalLink,
  X, ThumbsUp, MessageCircle, Share2, Globe
} from 'lucide-react'
import { db } from '../lib/api'

// ── Sort helpers ───────────────────────────────────────────────────────────────
function useTableSort(defaultField: string, defaultDir: 'asc' | 'desc' = 'desc') {
  const [sortField, setSortField] = useState(defaultField)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultDir)
  const toggle = useCallback((field: string) => {
    setSortField(prev => {
      if (prev === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
      else setSortDir('desc')
      return field
    })
  }, [])
  const sortRows = (rows: any[]) =>
    [...rows].sort((a, b) => {
      const av = a[sortField] ?? 0, bv = b[sortField] ?? 0
      if (typeof av === 'string' && typeof bv === 'string')
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av)
    })
  return { sortField, sortDir, toggle, sortRows }
}

function SortTh({ label, field, sort, align = 'right' }: {
  label: string; field: string; sort: ReturnType<typeof useTableSort>; align?: 'left' | 'right'
}) {
  const active = sort.sortField === field
  const Icon = !active ? ArrowUpDown : sort.sortDir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th className={`px-3 py-3 text-xs font-medium text-gray-500 text-${align}`}>
      <button
        onClick={() => sort.toggle(field)}
        className={`flex items-center gap-1 text-xs font-medium uppercase hover:text-gray-800 ${align === 'right' ? 'ml-auto' : ''} ${active ? 'text-blue-600' : 'text-gray-500'}`}
      >
        {label}
        <Icon size={11} className={active ? 'text-blue-600' : 'text-gray-400'} />
      </button>
    </th>
  )
}

// ── Aggregation ────────────────────────────────────────────────────────────────
function aggregateCreatives(rows: any[]): any[] {
  const map = new Map<string, any>()
  for (const row of rows) {
    const key = row.ad_id || row.id
    if (!map.has(key)) {
      map.set(key, {
        _key: key,
        ad_id: row.ad_id,
        ad_name: row.ad_name,
        campaign_name: row.campaign_name,
        ad_set_name: row.ad_set_name,
        ad_set_id: row.ad_set_id,
        image_url: row.image_url,
        thumbnail_url: row.thumbnail_url,
        video_id: row.video_id,
        headline: row.headline,
        primary_copy: row.primary_copy,
        call_to_action_type: row.call_to_action_type,
        destination_url: row.destination_url,
        spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0,
      })
    }
    const entry = map.get(key)!
    entry.spend += Number(row.spend) || 0
    entry.impressions += Number(row.impressions) || 0
    entry.clicks += Number(row.clicks) || 0
    entry.conversions += Number(row.conversions) || 0
    entry.revenue += Number(row.revenue) || 0
    if (!entry.image_url && row.image_url) entry.image_url = row.image_url
    if (!entry.thumbnail_url && row.thumbnail_url) entry.thumbnail_url = row.thumbnail_url
    if (!entry.video_id && row.video_id) entry.video_id = row.video_id
    if (!entry.headline && row.headline) entry.headline = row.headline
    if (!entry.destination_url && row.destination_url) entry.destination_url = row.destination_url
  }
  return Array.from(map.values()).sort((a, b) => b.spend - a.spend)
}

function aggregateAdSets(rows: any[]): any[] {
  const map = new Map<string, any>()
  for (const row of rows) {
    const key = row.ad_set_id || row.ad_set_name || 'unknown'
    if (!map.has(key)) {
      map.set(key, {
        _key: key,
        ad_set_id: row.ad_set_id,
        ad_set_name: row.ad_set_name,
        campaign_name: row.campaign_name,
        spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0,
      })
    }
    const entry = map.get(key)!
    entry.spend += Number(row.spend) || 0
    entry.impressions += Number(row.impressions) || 0
    entry.clicks += Number(row.clicks) || 0
    entry.conversions += Number(row.conversions) || 0
    entry.revenue += Number(row.revenue) || 0
  }
  return Array.from(map.values()).sort((a, b) => b.spend - a.spend)
}

// ── Creative Thumbnail ─────────────────────────────────────────────────────────
function CreativeThumb({ row }: { row: any }) {
  const imgSrc = row.thumbnail_url || row.image_url
  const isVideo = !!row.video_id
  const videoUrl = isVideo ? `https://www.facebook.com/videos/${row.video_id}` : null

  if (!imgSrc) {
    return (
      <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
        {isVideo ? <Video size={20} className="text-gray-400" /> : <Image size={20} className="text-gray-400" />}
      </div>
    )
  }

  const img = (
    <img
      src={imgSrc}
      alt="creative"
      className="w-14 h-14 object-cover rounded-lg shrink-0 border border-gray-100"
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )

  return videoUrl ? (
    <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="relative shrink-0 group">
      {img}
      <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-lg">
        <ExternalLink size={14} className="text-white" />
      </span>
    </a>
  ) : img
}

// Strip Meta CDN thumbnail resize params (e.g. stp=p64x64, stp=c0.5000x0.5000f_p64x64)
// Only strip when stp contains a resize spec (p\d+x\d+) — NOT format params like dst-jpg_tt6
// which are part of the signed request and cause 403 if removed
function hiResUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return url.replace(/([?&])stp=[^&]*p\d+x\d+[^&]*/g, (_match, sep, _offset, str) => {
    // If this was the first param (?stp=...) and there are more params, keep the ?
    if (sep === '?' && str.includes('&')) return '?'
    return ''
  }).replace(/\?&/, '?').replace(/[?&]$/, '') || url
}

// ── Ad Preview Modal ───────────────────────────────────────────────────────────
function AdPreviewModal({ row, onClose }: { row: any; onClose: () => void }) {
  // Use image_url (not thumbnail_url) for popup — higher res source
  // For videos, fall back to thumbnail_url
  const rawSrc = row.image_url || row.thumbnail_url
  const imgSrc = hiResUrl(rawSrc)
  const isVideo = !!row.video_id
  const roas = row.spend > 0 ? row.revenue / row.spend : 0
  const ctr = row.impressions > 0 ? row.clicks / row.impressions : 0

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const ctaLabel = row.call_to_action_type
    ? row.call_to_action_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    : 'Shop Now'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{row.ad_name || row.ad_id}</p>
            <p className="text-xs text-gray-400 truncate mt-0.5">{row.campaign_name}</p>
          </div>
          <button onClick={onClose} className="ml-3 p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto">
          {/* FB Post Mockup */}
          <div className="bg-white">
            {/* Post header */}
            <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">Ad</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 leading-tight">Sponsored Page</p>
                <div className="flex items-center gap-1 text-gray-400">
                  <span className="text-xs">Sponsored</span>
                  <span className="text-xs">·</span>
                  <Globe size={11} />
                </div>
              </div>
              <div className="text-gray-400">···</div>
            </div>

            {/* Primary copy */}
            {row.primary_copy && (
              <div className="px-4 pb-2">
                <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap line-clamp-4">
                  {row.primary_copy}
                </p>
              </div>
            )}

            {/* Creative image/video */}
            <div className="w-full bg-gray-100 relative" style={{ minHeight: 240 }}>
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt="creative"
                  className="w-full object-cover"
                  style={{ maxHeight: 320 }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <div className="w-full flex items-center justify-center bg-gray-100" style={{ height: 240 }}>
                  {isVideo
                    ? <Video size={40} className="text-gray-300" />
                    : <Image size={40} className="text-gray-300" />}
                </div>
              )}
              {isVideo && (
                <a
                  href={`https://www.facebook.com/videos/${row.video_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 flex items-center justify-center group"
                  title="Watch on Facebook"
                >
                  <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center group-hover:bg-black/70 transition-colors">
                    <div className="w-0 h-0 border-t-[8px] border-b-[8px] border-l-[14px] border-t-transparent border-b-transparent border-l-white ml-1" />
                  </div>
                </a>
              )}
              <div className={`absolute top-2 left-2 text-xs px-1.5 py-0.5 rounded font-medium ${isVideo ? 'bg-purple-600/80 text-white' : 'bg-blue-600/80 text-white'}`}>
                {isVideo ? 'VID' : 'IMG'}
              </div>
            </div>

            {/* Headline + CTA bar */}
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                {row.headline && (
                  <p className="text-xs font-semibold text-gray-900 truncate">{row.headline}</p>
                )}
                <p className="text-xs text-gray-400 truncate">{row.ad_set_name || '—'}</p>
              </div>
              {row.destination_url ? (
                <a
                  href={row.destination_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition-colors"
                >
                  {ctaLabel}
                </a>
              ) : (
                <button className="shrink-0 px-3 py-1.5 bg-gray-200 text-gray-500 text-xs font-semibold rounded-md cursor-default">
                  {ctaLabel}
                </button>
              )}
            </div>

            {/* Engagement bar (decorative) */}
            <div className="flex items-center border-t border-gray-100 px-4 py-2 gap-4">
              <button className="flex items-center gap-1.5 text-gray-500 hover:text-blue-600 transition-colors">
                <ThumbsUp size={14} />
                <span className="text-xs">Like</span>
              </button>
              <button className="flex items-center gap-1.5 text-gray-500 hover:text-blue-600 transition-colors">
                <MessageCircle size={14} />
                <span className="text-xs">Comment</span>
              </button>
              <button className="flex items-center gap-1.5 text-gray-500 hover:text-blue-600 transition-colors">
                <Share2 size={14} />
                <span className="text-xs">Share</span>
              </button>
            </div>
          </div>

          {/* Performance metrics */}
          <div className="border-t border-gray-100 px-4 py-3 grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-xs text-gray-400">Spend</p>
              <p className="text-sm font-bold text-gray-900">{row.spend >= 1000 ? `$${(row.spend/1000).toFixed(1)}k` : `$${row.spend.toFixed(0)}`}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">ROAS</p>
              <p className={`text-sm font-bold ${roas >= 3 ? 'text-green-600' : roas >= 1.5 ? 'text-yellow-600' : roas > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                {roas > 0 ? `${roas.toFixed(2)}x` : '—'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">CTR</p>
              <p className="text-sm font-bold text-gray-900">{ctr > 0 ? `${(ctr * 100).toFixed(2)}%` : '—'}</p>
            </div>
            {row.conversions > 0 && (
              <div className="text-center">
                <p className="text-xs text-gray-400">Conversions</p>
                <p className="text-sm font-bold text-gray-900">{row.conversions}</p>
              </div>
            )}
            {row.revenue > 0 && (
              <div className="text-center">
                <p className="text-xs text-gray-400">Revenue</p>
                <p className="text-sm font-bold text-gray-900">{row.revenue >= 1000 ? `$${(row.revenue/1000).toFixed(1)}k` : `$${row.revenue.toFixed(0)}`}</p>
              </div>
            )}
            <div className="text-center">
              <p className="text-xs text-gray-400">Impressions</p>
              <p className="text-sm font-bold text-gray-900">{row.impressions >= 1000 ? `${(row.impressions/1000).toFixed(1)}k` : row.impressions}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Date Presets ───────────────────────────────────────────────────────────────
const DATE_PRESETS = [
  { label: '1D',  days: 1 },
  { label: '3D',  days: 3 },
  { label: '7D',  days: 7 },
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
]

function getPresetDates(days: number) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days + 1)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

// ── Formatters ─────────────────────────────────────────────────────────────────
const fmt$ = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`
const fmtN = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))
const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`
const fmtRoas = (v: number) => `${v.toFixed(2)}x`

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color }: {
  label: string; value: string; icon: any; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  )
}

const CHART_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6']

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CreativePerformance() {
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [dateRange, setDateRange] = useState(() => getPresetDates(7))
  const [activePreset, setActivePreset] = useState(7)
  const [showClientDrop, setShowClientDrop] = useState(false)
  const [creativePage, setCreativePage] = useState(0)
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set())
  const [chartMode, setChartMode] = useState<'spend' | 'roas'>('spend')
  const [selectedAd, setSelectedAd] = useState<any>(null)
  const PAGE_SIZE = 20

  const creativeSort = useTableSort('spend')
  const adsetSort = useTableSort('spend')

  // Clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => db.getClients(),
    staleTime: 5 * 60 * 1000,
  })

  // Creative data (meta_ads_ads with creative fields)
  const { data: rawCreatives = [], isLoading: loadingCreatives } = useQuery({
    queryKey: ['meta-creatives', selectedClient, dateRange.start, dateRange.end],
    queryFn: () => db.getMetaCreatives(
      selectedClient === 'all' ? undefined : selectedClient,
      dateRange.start,
      dateRange.end
    ),
    staleTime: 5 * 60 * 1000,
  })

  // Ad Set data
  const { data: rawAdsets = [], isLoading: loadingAdsets } = useQuery({
    queryKey: ['meta-adsets', selectedClient, dateRange.start, dateRange.end],
    queryFn: () => db.getMetaAdsets({
      clientId: selectedClient === 'all' ? undefined : selectedClient,
      startDate: dateRange.start,
      endDate: dateRange.end,
    }),
    staleTime: 5 * 60 * 1000,
  })

  // Aggregate
  const allCreatives = aggregateCreatives(rawCreatives as any[])
  const allAdSets = aggregateAdSets(rawAdsets as any[])

  const sortedCreatives = creativeSort.sortRows(allCreatives)

  const pagedCreatives = sortedCreatives.slice(creativePage * PAGE_SIZE, (creativePage + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(sortedCreatives.length / PAGE_SIZE)

  // KPIs
  const totalSpend = allCreatives.reduce((s, r) => s + r.spend, 0)
  const totalRevenue = allCreatives.reduce((s, r) => s + r.revenue, 0)
  const totalConversions = allCreatives.reduce((s, r) => s + r.conversions, 0)
  const totalClicks = allCreatives.reduce((s, r) => s + r.clicks, 0)
  const totalImpressions = allCreatives.reduce((s, r) => s + r.impressions, 0)
  const portfolioRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0
  const portfolioCpa = totalConversions > 0 ? totalSpend / totalConversions : 0
  const portfolioCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0
  const adsWithSpend = allCreatives.filter(r => r.spend > 0).length


  const selectedClientName = selectedClient === 'all'
    ? 'All Clients'
    : clients.find((c: any) => c.id === selectedClient)?.name || selectedClient

  const isLoading = loadingCreatives || loadingAdsets

  return (
    <div className="space-y-6">
      {/* Ad Preview Modal */}
      {selectedAd && <AdPreviewModal row={selectedAd} onClose={() => setSelectedAd(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Creative Performance</h1>
          <p className="text-sm text-gray-500 mt-1">Meta Ads creative analytics — {selectedClientName}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
          <span>{dateRange.start}</span>
          <span>→</span>
          <span>{dateRange.end}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="sticky top-[52px] z-30 bg-white/95 backdrop-blur-sm shadow-md border-b border-gray-200 rounded-xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Client Picker */}
          <div className="relative">
            <button
              onClick={() => setShowClientDrop(v => !v)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm hover:bg-gray-100 transition-colors min-w-[160px]"
            >
              <span className="font-medium text-gray-700 truncate">{selectedClientName}</span>
              <ChevronDown size={14} className="text-gray-500 ml-auto shrink-0" />
            </button>
            {showClientDrop && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 min-w-[200px] py-1">
                <button
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${selectedClient === 'all' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                  onClick={() => { setSelectedClient('all'); setShowClientDrop(false); setCreativePage(0) }}
                >
                  All Clients
                </button>
                {clients.map((c: any) => (
                  <button
                    key={c.id}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${selectedClient === c.id ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                    onClick={() => { setSelectedClient(c.id); setShowClientDrop(false); setCreativePage(0) }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date Presets */}
          <div className="flex gap-1">
            {DATE_PRESETS.map(p => (
              <button
                key={p.days}
                onClick={() => { const d = getPresetDates(p.days); setDateRange(d); setActivePreset(p.days); setCreativePage(0) }}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activePreset === p.days ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom date range */}
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="date"
              value={dateRange.start}
              onChange={e => { setDateRange(d => ({ ...d, start: e.target.value })); setActivePreset(0); setCreativePage(0) }}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50"
            />
            <span className="text-gray-400 text-xs">→</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={e => { setDateRange(d => ({ ...d, end: e.target.value })); setActivePreset(0); setCreativePage(0) }}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Ads with Spend" value={String(adsWithSpend)} icon={Image} color="bg-blue-500" />
        <KpiCard label="Total Spend" value={fmt$(totalSpend)} icon={DollarSign} color="bg-indigo-500" />
        <KpiCard label="Portfolio ROAS" value={portfolioRoas > 0 ? fmtRoas(portfolioRoas) : '—'} icon={TrendingUp} color="bg-green-500" />
        <KpiCard label="Portfolio CPA" value={portfolioCpa > 0 ? fmt$(portfolioCpa) : '—'} icon={ShoppingCart} color="bg-orange-500" />
      </div>

      {/* Top Creatives Visual Chart */}
      {allCreatives.length > 0 && (() => {
        const chartData = chartMode === 'spend'
          ? allCreatives.filter(r => r.spend > 0).slice(0, 8)
          : allCreatives.filter(r => r.spend > 0 && r.revenue > 0).sort((a, b) => (b.revenue / b.spend) - (a.revenue / a.spend)).slice(0, 8)
        const maxBarValue = chartMode === 'spend'
          ? (chartData[0]?.spend || 1)
          : Math.max(...chartData.map(r => r.spend > 0 ? r.revenue / r.spend : 0), 1)

        return (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            {/* Header + toggle */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-gray-700">Top Creatives</h2>
              <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
                <button
                  onClick={() => setChartMode('spend')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${chartMode === 'spend' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Top Spend
                </button>
                <button
                  onClick={() => setChartMode('roas')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${chartMode === 'roas' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Top Performing
                </button>
              </div>
            </div>

            {/* Thumbnail cards grid */}
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${chartData.length}, minmax(0, 1fr))` }}>
              {chartData.map((row, i) => {
                const roas = row.spend > 0 ? row.revenue / row.spend : 0
                const imgSrc = row.thumbnail_url || row.image_url
                const isVideo = !!row.video_id
                const roasColor = roas >= 3 ? 'text-green-600' : roas >= 1.5 ? 'text-yellow-600' : 'text-red-500'
                const barValue = chartMode === 'spend' ? row.spend : roas
                return (
                  <div key={row._key} className="flex flex-col gap-1.5">
                    {/* Bar */}
                    <div className="flex items-end justify-center" style={{ height: 40 }}>
                      <div
                        className="rounded-t-sm w-full max-w-[40px] mx-auto transition-all"
                        style={{
                          height: `${Math.max(6, (barValue / maxBarValue) * 40)}px`,
                          background: chartMode === 'spend' ? CHART_COLORS[i % CHART_COLORS.length] : (roas >= 3 ? '#22c55e' : roas >= 1.5 ? '#eab308' : '#f97316'),
                          opacity: 0.85,
                        }}
                      />
                    </div>

                    {/* Thumbnail — clickable */}
                    <button
                      onClick={() => setSelectedAd(row)}
                      className="relative overflow-hidden rounded-lg bg-gray-100 w-full group cursor-pointer focus:outline-none"
                      style={{ height: 80 }}
                      title="Click to preview ad"
                    >
                      {imgSrc ? (
                        <img src={imgSrc} alt="creative" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {isVideo ? <Video size={18} className="text-gray-300" /> : <Image size={18} className="text-gray-300" />}
                        </div>
                      )}
                      <div className={`absolute top-1 left-1 text-xs px-1 py-0.5 rounded font-medium ${isVideo ? 'bg-purple-600/80 text-white' : 'bg-blue-600/80 text-white'}`}>
                        {isVideo ? 'VID' : 'IMG'}
                      </div>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <ExternalLink size={14} className="text-white drop-shadow" />
                      </div>
                    </button>

                    {/* Metrics */}
                    <div className="text-center space-y-0.5">
                      <p className="text-xs font-bold text-gray-900">{fmt$(row.spend)}</p>
                      {roas > 0 && <p className={`text-xs font-semibold ${roasColor}`}>{fmtRoas(roas)}</p>}
                      <p className="text-xs text-gray-400 truncate leading-tight px-1" title={row.ad_name}>
                        {(row.ad_name || '').slice(0, 18)}{(row.ad_name || '').length > 18 ? '…' : ''}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Creative Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Meta Creative Performance</h2>
            <p className="text-xs text-gray-400 mt-0.5">{allCreatives.length} unique ads</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <MousePointer2 size={12} />
            <span>Portfolio CTR: {fmtPct(portfolioCtr)}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
        ) : allCreatives.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
            <Image size={32} className="opacity-30" />
            <p className="text-sm">No creative data found for this selection</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-16">Visual</th>
                    <SortTh label="Ad Name" field="ad_name" sort={creativeSort} align="left" />
                    <SortTh label="Spend" field="spend" sort={creativeSort} />
                    <SortTh label="Impressions" field="impressions" sort={creativeSort} />
                    <SortTh label="Clicks" field="clicks" sort={creativeSort} />
                    <SortTh label="CTR" field="ctr" sort={creativeSort} />
                    <SortTh label="Conversions" field="conversions" sort={creativeSort} />
                    <SortTh label="Revenue" field="revenue" sort={creativeSort} />
                    <SortTh label="ROAS" field="roas" sort={creativeSort} />
                    <SortTh label="CPA" field="cpa" sort={creativeSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pagedCreatives.map(row => {
                    const ctr = row.impressions > 0 ? row.clicks / row.impressions : 0
                    const roas = row.spend > 0 ? row.revenue / row.spend : 0
                    const cpa = row.conversions > 0 ? row.spend / row.conversions : 0
                    const isVideo = !!row.video_id
                    return (
                      <tr key={row._key} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-3 py-2.5">
                          <button onClick={() => setSelectedAd(row)} className="group relative focus:outline-none">
                            <CreativeThumb row={row} />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <ExternalLink size={12} className="text-white drop-shadow" />
                            </div>
                          </button>
                        </td>
                        <td className="px-3 py-2.5 max-w-[220px]">
                          <div className="flex items-start gap-2">
                            <span className={`mt-0.5 shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${isVideo ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              {isVideo ? 'VID' : 'IMG'}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 truncate text-xs leading-tight">{row.ad_name || row.ad_id}</p>
                              {row.headline && <p className="text-xs text-gray-500 truncate mt-0.5">{row.headline}</p>}
                              {row.ad_set_name && <p className="text-xs text-gray-400 truncate">{row.ad_set_name}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold text-gray-900">{fmt$(row.spend)}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-gray-600">{fmtN(row.impressions)}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-gray-600">{fmtN(row.clicks)}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-gray-600">{fmtPct(ctr)}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-gray-600">{row.conversions > 0 ? fmtN(row.conversions) : '—'}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-gray-600">{row.revenue > 0 ? fmt$(row.revenue) : '—'}</td>
                        <td className="px-3 py-2.5 text-right text-xs">
                          {roas > 0 ? (
                            <span className={`font-semibold ${roas >= 3 ? 'text-green-600' : roas >= 1.5 ? 'text-yellow-600' : 'text-red-500'}`}>
                              {fmtRoas(roas)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs text-gray-600">{cpa > 0 ? fmt$(cpa) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  Showing {creativePage * PAGE_SIZE + 1}–{Math.min((creativePage + 1) * PAGE_SIZE, sortedCreatives.length)} of {sortedCreatives.length}
                </p>
                <div className="flex gap-1">
                  <button
                    disabled={creativePage === 0}
                    onClick={() => setCreativePage(p => p - 1)}
                    className="px-3 py-1 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Prev
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const pg = totalPages <= 7 ? i : Math.max(0, Math.min(creativePage - 3, totalPages - 7)) + i
                    return (
                      <button
                        key={pg}
                        onClick={() => setCreativePage(pg)}
                        className={`w-7 h-7 text-xs rounded-lg border transition-colors ${pg === creativePage ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}
                      >
                        {pg + 1}
                      </button>
                    )
                  })}
                  <button
                    disabled={creativePage >= totalPages - 1}
                    onClick={() => setCreativePage(p => p + 1)}
                    className="px-3 py-1 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Ad Set Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Ad Set Performance</h2>
          <p className="text-xs text-gray-400 mt-0.5">{allAdSets.length} ad sets</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Loading...</div>
        ) : allAdSets.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm">No ad set data</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-3 w-8" />
                  <SortTh label="Ad Set" field="ad_set_name" sort={adsetSort} align="left" />
                  <SortTh label="Campaign" field="campaign_name" sort={adsetSort} align="left" />
                  <SortTh label="Spend" field="spend" sort={adsetSort} />
                  <SortTh label="Impressions" field="impressions" sort={adsetSort} />
                  <SortTh label="Clicks" field="clicks" sort={adsetSort} />
                  <SortTh label="Conversions" field="conversions" sort={adsetSort} />
                  <SortTh label="Revenue" field="revenue" sort={adsetSort} />
                  <SortTh label="ROAS" field="roas" sort={adsetSort} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {adsetSort.sortRows(allAdSets).map(row => {
                  const roas = row.spend > 0 ? row.revenue / row.spend : 0
                  const expanded = expandedAdSets.has(row._key)
                  // Creatives in this ad set
                  const adsetCreatives = allCreatives.filter(c => c.ad_set_id === row.ad_set_id || c.ad_set_name === row.ad_set_name)

                  return (
                    <>
                      <tr key={row._key} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-3 py-2.5">
                          {adsetCreatives.length > 0 && (
                            <button
                              onClick={() => setExpandedAdSets(prev => {
                                const next = new Set(prev)
                                next.has(row._key) ? next.delete(row._key) : next.add(row._key)
                                return next
                              })}
                              className="p-0.5 text-gray-400 hover:text-gray-600"
                            >
                              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-gray-900 text-xs max-w-[200px] truncate">{row.ad_set_name || row.ad_set_id}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[180px] truncate">{row.campaign_name}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold text-gray-900">{fmt$(row.spend)}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-gray-600">{fmtN(row.impressions)}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-gray-600">{fmtN(row.clicks)}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-gray-600">{row.conversions > 0 ? fmtN(row.conversions) : '—'}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-gray-600">{row.revenue > 0 ? fmt$(row.revenue) : '—'}</td>
                        <td className="px-3 py-2.5 text-right text-xs">
                          {roas > 0 ? (
                            <span className={`font-semibold ${roas >= 3 ? 'text-green-600' : roas >= 1.5 ? 'text-yellow-600' : 'text-red-500'}`}>
                              {fmtRoas(roas)}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                      {expanded && adsetCreatives.length > 0 && adsetCreatives.slice(0, 5).map(cr => {
                        const crRoas = cr.spend > 0 ? cr.revenue / cr.spend : 0
                        return (
                          <tr key={`sub-${cr._key}`} className="bg-blue-50/40">
                            <td className="px-3 py-2" />
                            <td colSpan={2} className="px-3 py-2">
                              <div className="flex items-center gap-2 pl-4">
                                <CreativeThumb row={cr} />
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-gray-700 truncate">{cr.ad_name || cr.ad_id}</p>
                                  {cr.headline && <p className="text-xs text-gray-400 truncate">{cr.headline}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-xs text-gray-700">{fmt$(cr.spend)}</td>
                            <td className="px-3 py-2 text-right text-xs text-gray-500">{fmtN(cr.impressions)}</td>
                            <td className="px-3 py-2 text-right text-xs text-gray-500">{fmtN(cr.clicks)}</td>
                            <td className="px-3 py-2 text-right text-xs text-gray-500">{cr.conversions > 0 ? fmtN(cr.conversions) : '—'}</td>
                            <td className="px-3 py-2 text-right text-xs text-gray-500">{cr.revenue > 0 ? fmt$(cr.revenue) : '—'}</td>
                            <td className="px-3 py-2 text-right text-xs">
                              {crRoas > 0 ? (
                                <span className={`font-semibold ${crRoas >= 3 ? 'text-green-600' : crRoas >= 1.5 ? 'text-yellow-600' : 'text-red-500'}`}>
                                  {fmtRoas(crRoas)}
                                </span>
                              ) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
