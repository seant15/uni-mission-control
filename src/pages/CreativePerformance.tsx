import { useState, useCallback, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  Image, Video, DollarSign, TrendingUp, ShoppingCart, MousePointer2,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ExternalLink,
  X, ThumbsUp, MessageCircle, Share2, Globe, AlertTriangle
} from 'lucide-react'
import { db } from '../lib/api'
import AccountDateRangePicker from '../components/AccountDateRangePicker'
import FilterShell from '../components/FilterShell'
import { defaultCalendarRangeLastNDays, CREATIVE_DATE_PRESETS } from '../lib/dashboardDateRange'
import { getDashboardSettings } from '../lib/settings'
import { useAuth } from '../contexts/AuthContext'
import { scopedClientIdFromUser } from '../lib/rbac'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
} from 'recharts'

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
  const alignClass = align === 'left' ? 'text-left' : 'text-right'
  return (
    <th className={`px-3 py-3 text-xs font-medium text-gray-500 ${alignClass}`}>
      <button
        onClick={() => sort.toggle(field)}
        className={`flex items-center gap-1 text-xs font-medium uppercase hover:text-gray-800 ${align === 'right' ? 'ml-auto' : ''} ${active ? 'text-[var(--brand-600)]' : 'text-gray-500'}`}
      >
        {label}
        <Icon size={11} className={active ? 'text-[var(--brand-600)]' : 'text-gray-400'} />
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
        description: row.description,
        call_to_action_type: row.call_to_action_type,
        destination_url: row.destination_url,
        instagram_permalink_url: row.instagram_permalink_url,
        facebook_post_url: row.facebook_post_url,
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
    if (!entry.primary_copy && row.primary_copy) entry.primary_copy = row.primary_copy
    if (!entry.description && row.description) entry.description = row.description
    if (!entry.destination_url && row.destination_url) entry.destination_url = row.destination_url
    if (!entry.instagram_permalink_url && row.instagram_permalink_url) entry.instagram_permalink_url = row.instagram_permalink_url
    if (!entry.facebook_post_url && row.facebook_post_url) entry.facebook_post_url = row.facebook_post_url
  }
  return Array.from(map.values()).sort((a, b) => b.spend - a.spend)
}

// ── Creative Thumbnail ─────────────────────────────────────────────────────────
function postLink(row: { instagram_permalink_url?: string | null; facebook_post_url?: string | null }) {
  if (row.instagram_permalink_url) return { href: row.instagram_permalink_url, label: 'View on IG' as const }
  if (row.facebook_post_url) return { href: row.facebook_post_url, label: 'View Post' as const }
  return null
}

function CreativeThumb({
  row,
  adKey,
  onImageError,
}: {
  row: any
  adKey: string
  onImageError?: (key: string) => void
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const imgSrc = row.thumbnail_url || row.image_url
  const isVideo = !!row.video_id
  const videoUrl = isVideo ? `https://www.facebook.com/videos/${row.video_id}` : null
  const pl = postLink(row)
  const extOpen = pl?.href || row.destination_url || imgSrc

  const handleImgError = () => {
    setImgFailed(true)
    onImageError?.(adKey)
  }

  const fallback = (
    <div className="w-14 h-14 rounded-lg bg-gray-100 flex flex-col items-center justify-center shrink-0 gap-0.5 p-1 border border-gray-100">
      {pl ? (
        <a
          href={pl.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-semibold text-[var(--brand-600)] hover:underline text-center leading-tight"
          onClick={e => e.stopPropagation()}
        >
          {pl.label}
        </a>
      ) : (
        <>
          {isVideo ? <Video size={20} className="text-gray-400" /> : <Image size={20} className="text-gray-400" />}
        </>
      )}
    </div>
  )

  if (!imgSrc || imgFailed) {
    return fallback
  }

  const img = (
    <div className="relative shrink-0">
      <img
        src={imgSrc}
        alt="creative"
        className="w-14 h-14 object-cover rounded-lg shrink-0 border border-gray-100"
        onError={handleImgError}
        loading="lazy"
        decoding="async"
      />
      {extOpen && (
        <a
          href={extOpen}
          target="_blank"
          rel="noopener noreferrer"
          title="Open post"
          className="absolute bottom-0.5 right-0.5 p-0.5 rounded bg-white/90 text-gray-600 hover:text-[var(--brand-600)] shadow-sm"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink size={12} />
        </a>
      )}
    </div>
  )

  return videoUrl ? (
    <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="relative shrink-0 group">
      {img}
      <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-lg">
        <ExternalLink size={14} className="text-white" />
      </span>
    </a>
  ) : (
    img
  )
}

// ── Ad Preview Modal ───────────────────────────────────────────────────────────
function AdPreviewModal({ row, onClose }: { row: any; onClose: () => void }) {
  const [modalImgFailed, setModalImgFailed] = useState(false)
  // Use image_url (not thumbnail_url) for popup — higher res source
  // For videos, fall back to thumbnail_url. Keep URL exactly as stored — hiResUrl() can break Meta signed URLs.
  const rawSrc = row.image_url || row.thumbnail_url
  const imgSrc = rawSrc
  const isVideo = !!row.video_id
  const videoPostUrl = row.instagram_permalink_url || row.facebook_post_url || null
  const pl = postLink(row)
  const roas = row.spend > 0 ? row.revenue / row.spend : 0
  const ctr = row.impressions > 0 ? row.clicks / row.impressions : 0

  useEffect(() => {
    setModalImgFailed(false)
  }, [row.ad_id, row._key])

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
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
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
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--brand-500)] to-[var(--brand-700)] flex items-center justify-center shrink-0">
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
            {row.description && (
              <div className="px-4 pb-2">
                <p className="text-[11px] text-gray-500 leading-relaxed whitespace-pre-wrap line-clamp-3">
                  {row.description}
                </p>
              </div>
            )}

            {/* Creative image/video */}
            <div className="w-full bg-gray-100 relative" style={{ minHeight: 240 }}>
              {imgSrc && !modalImgFailed ? (
                <img
                  src={imgSrc}
                  alt="creative"
                  className="w-full object-cover"
                  style={{ maxHeight: 320 }}
                  onError={() => setModalImgFailed(true)}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="w-full flex flex-col items-center justify-center bg-gray-100 gap-3 px-4 py-10" style={{ minHeight: 240 }}>
                  {pl ? (
                    <a
                      href={pl.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-600)] hover:underline"
                    >
                      <ExternalLink size={16} />
                      {pl.label}
                    </a>
                  ) : (
                    <>
                      {isVideo
                        ? <Video size={40} className="text-gray-300" />
                        : <Image size={40} className="text-gray-300" />}
                      <p className="text-xs text-gray-500 text-center">Preview unavailable</p>
                    </>
                  )}
                </div>
              )}
              {isVideo && (
                videoPostUrl ? (
                  <a
                    href={videoPostUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 flex items-center justify-center group"
                    title={row.instagram_permalink_url ? 'View on Instagram' : 'View on Facebook'}
                  >
                    <div className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center group-hover:bg-black/70 transition-colors">
                      <div className="w-0 h-0 border-t-[8px] border-b-[8px] border-l-[14px] border-t-transparent border-b-transparent border-l-white ml-1" />
                    </div>
                  </a>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center">
                      <div className="w-0 h-0 border-t-[8px] border-b-[8px] border-l-[14px] border-t-transparent border-b-transparent border-l-white ml-1" />
                    </div>
                  </div>
                )
              )}
              <div className={`absolute top-2 left-2 text-xs px-1.5 py-0.5 rounded font-medium ${isVideo ? 'bg-purple-600/80 text-white' : 'bg-[var(--brand-600)]/90 text-white'}`}>
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
                  className="shrink-0 px-3 py-1.5 bg-[var(--brand-600)] text-white text-xs font-semibold rounded-md hover:bg-[var(--brand-700)] transition-colors"
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
              <button className="flex items-center gap-1.5 text-gray-500 hover:text-[var(--brand-600)] transition-colors">
                <ThumbsUp size={14} />
                <span className="text-xs">Like</span>
              </button>
              <button className="flex items-center gap-1.5 text-gray-500 hover:text-[var(--brand-600)] transition-colors">
                <MessageCircle size={14} />
                <span className="text-xs">Comment</span>
              </button>
              <button className="flex items-center gap-1.5 text-gray-500 hover:text-[var(--brand-600)] transition-colors">
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4">
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

const CHART_COLORS = ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#c2410c', '#9a3412', '#78716c', '#ca8a04', '#16a34a', '#0d9488']

const PIE_COLORS = ['#ea580c', '#8b5cf6', '#0d9488', '#64748b', '#ca8a04', '#16a34a', '#f43f5e']

function classifyCreativeType(row: any): string {
  const cta = String(row.call_to_action_type || '').toUpperCase()
  const dest = String(row.destination_url || '').toLowerCase()
  const adName = String(row.ad_name || '').toLowerCase()
  const headline = String(row.headline || '').toLowerCase()

  if (
    cta.includes('CATALOG') ||
    cta.includes('SHOP_COLLECTION') ||
    adName.includes('catalog') ||
    adName.includes('dpa') ||
    adName.includes('advantage+') ||
    headline.includes('catalog')
  ) {
    return 'Catalog'
  }
  if (row.video_id) return 'Video'
  if (dest.includes('facebook.com/products') || dest.includes('/collections/')) {
    return 'Catalog'
  }
  if (row.image_url || row.thumbnail_url) return 'Image'
  if (row.thumbnail_url && !row.image_url && (cta.includes('SHOP') || cta.includes('BUY'))) {
    return 'Catalog'
  }
  if (String(row.headline || row.primary_copy || row.description || '').trim()) return 'Text / link'
  return 'Unknown'
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CreativePerformance() {
  const { appUser } = useAuth()
  const scopedClientId = useMemo(() => scopedClientIdFromUser(appUser), [appUser])
  const [searchParams] = useSearchParams()
  const clientFromUrl = searchParams.get('client')
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [selectedPlatform] = useState<string>('meta_ads')
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>('')
  const [dateRange, setDateRange] = useState(() => defaultCalendarRangeLastNDays(30))
  const [showClientDrop, setShowClientDrop] = useState(false)
  const [creativePage, setCreativePage] = useState(0)
  const [chartMode, setChartMode] = useState<'spend' | 'roas'>('spend')
  const [selectedAd, setSelectedAd] = useState<any>(null)
  const [failedThumbKeys, setFailedThumbKeys] = useState<Set<string>>(() => new Set())
  const PAGE_SIZE = 20

  useEffect(() => {
    if (scopedClientId) setSelectedClient(scopedClientId)
  }, [scopedClientId])

  useEffect(() => {
    if (scopedClientId) return
    if (!clientFromUrl) return
    setSelectedClient(prev => (prev === clientFromUrl ? prev : clientFromUrl))
    setCreativePage(0)
  }, [clientFromUrl, scopedClientId])

  useEffect(() => {
    getDashboardSettings('default_user').then(loaded => {
      setDateRange(defaultCalendarRangeLastNDays(loaded.defaultDateRange))
    })
  }, [])

  useEffect(() => {
    setFailedThumbKeys(new Set())
  }, [selectedClient, dateRange.start, dateRange.end])

  const reportThumbFail = useCallback((key: string) => {
    setFailedThumbKeys(prev => {
      if (prev.has(key)) return prev
      const n = new Set(prev)
      n.add(key)
      return n
    })
  }, [])

  const creativeSort = useTableSort('spend')

  // Clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', scopedClientId ?? 'all'],
    queryFn: () => db.getClients(scopedClientId ? { scopedClientId } : undefined),
    staleTime: 5 * 60 * 1000,
  })

  const { data: adAccountsFromDB } = useQuery({
    queryKey: ['ad_accounts', selectedClient, selectedPlatform, scopedClientId ?? ''],
    queryFn: () =>
      db.getAdAccounts({
        clientId: selectedClient,
        platform: selectedPlatform,
        scopedClientId: scopedClientId || undefined,
      }),
    staleTime: 5 * 60 * 1000,
  })

  // Creative data (meta_ads_ads with creative fields)
  const { data: rawCreatives = [], isLoading: loadingCreatives } = useQuery({
    queryKey: ['meta-creatives', selectedClient, dateRange.start, dateRange.end, scopedClientId ?? ''],
    queryFn: () => db.getMetaCreatives(
      selectedClient === 'all' ? undefined : selectedClient,
      dateRange.start,
      dateRange.end,
      scopedClientId || undefined
    ),
    staleTime: 5 * 60 * 1000,
  })

  // Aggregate
  const allCreatives = aggregateCreatives(rawCreatives as any[])

  const thumbWithUrlCount = useMemo(
    () => allCreatives.filter((r: any) => r.thumbnail_url || r.image_url).length,
    [allCreatives]
  )
  const showCdnStaleBanner =
    thumbWithUrlCount > 0 && failedThumbKeys.size / thumbWithUrlCount > 0.6

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

  const creativesMissingImages =
    allCreatives.length > 0 &&
    allCreatives.every((r: any) => !r.image_url && !r.thumbnail_url)

  const selectedClientName = selectedClient === 'all'
    ? 'All Clients'
    : clients.find((c: any) => c.id === selectedClient)?.name || selectedClient

  const creativeTypePie = useMemo(() => {
    const m = new Map<string, number>()
    for (const row of allCreatives) {
      const k = classifyCreativeType(row)
      m.set(k, (m.get(k) || 0) + (Number(row.spend) || 0))
    }
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [allCreatives])

  const totalPieSpend = useMemo(
    () => creativeTypePie.reduce((s, x) => s + x.value, 0),
    [creativeTypePie]
  )

  const isLoading = loadingCreatives

  return (
    <div className="space-y-4">
      {/* Ad Preview Modal */}
      {selectedAd && <AdPreviewModal row={selectedAd} onClose={() => setSelectedAd(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meta Ads — Creative Performance</h1>
          <p className="text-sm text-gray-500 mt-1">
            Creative analytics for {selectedClientName}. Google Ads and other sources will appear here when connected.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
          <span>{dateRange.start}</span>
          <span>→</span>
          <span>{dateRange.end}</span>
        </div>
      </div>

      {showCdnStaleBanner && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex gap-2 items-start">
          <AlertTriangle className="shrink-0 mt-0.5" size={18} />
          <p>
            Many ad image URLs from Meta have expired (CDN signatures). Use the links on each row to open the live post on
            Instagram or Facebook.
          </p>
        </div>
      )}

      {!isLoading && creativesMissingImages && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          No image or thumbnail URLs are stored for these ads. The daily marketing sync must run with creative enrichment
          (for example <code className="text-xs bg-amber-100 px-1 rounded">--with-creatives</code> on{' '}
          <code className="text-xs bg-amber-100 px-1 rounded">sync_marketing_data.py</code>) so Meta Graph returns{' '}
          <code className="text-xs bg-amber-100 px-1 rounded">image_url</code> /{' '}
          <code className="text-xs bg-amber-100 px-1 rounded">thumbnail_url</code>.
        </div>
      )}

      {/* Filter Bar */}
      <FilterShell className="z-30 !top-[52px]">
        <div className="flex flex-wrap items-center gap-2 w-full">
          {/* Client Picker */}
          {scopedClientId ? (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md text-xs text-slate-700 min-w-[140px]">
              <span className="font-medium truncate">{selectedClientName}</span>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowClientDrop(v => !v)}
                className="flex items-center gap-2 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-md text-xs hover:bg-gray-100 transition-colors min-w-[140px]"
              >
                <span className="font-medium text-gray-700 truncate">{selectedClientName}</span>
                <ChevronDown size={14} className="text-gray-500 ml-auto shrink-0" />
              </button>
              {showClientDrop && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 min-w-[200px] py-1">
                  <button
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${selectedClient === 'all' ? 'text-[var(--brand-600)] font-medium' : 'text-gray-700'}`}
                    onClick={() => { setSelectedClient('all'); setShowClientDrop(false); setCreativePage(0) }}
                  >
                    All Clients
                  </button>
                  {clients.map((c: any) => (
                    <button
                      key={c.id}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${selectedClient === c.id ? 'text-[var(--brand-600)] font-medium' : 'text-gray-700'}`}
                      onClick={() => { setSelectedClient(c.id); setShowClientDrop(false); setCreativePage(0) }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Platform">
            <button
              type="button"
              className="px-2 py-1 rounded-md text-xs font-medium border bg-[var(--brand-600)] text-white border-transparent"
            >
              Meta Ads
            </button>
          </div>
          {adAccountsFromDB && adAccountsFromDB.length > 0 && (
            <select
              value={selectedAdAccount}
              onChange={e => { setSelectedAdAccount(e.target.value); setCreativePage(0) }}
              className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-md text-xs min-w-[160px]"
            >
              <option value="">All Accounts</option>
              {adAccountsFromDB.map((account: any) => (
                <option key={account.id} value={account.id}>{account.label}</option>
              ))}
            </select>
          )}
          <AccountDateRangePicker
            dateRange={dateRange}
            onChange={d => { setDateRange(d); setCreativePage(0) }}
            className="w-full sm:w-auto sm:ml-auto"
            presets={CREATIVE_DATE_PRESETS}
          />
        </div>
      </FilterShell>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Ads with Spend" value={String(adsWithSpend)} icon={Image} color="bg-[var(--brand-600)]" />
        <KpiCard label="Total Spend" value={fmt$(totalSpend)} icon={DollarSign} color="bg-violet-600" />
        <KpiCard label="Portfolio ROAS" value={portfolioRoas > 0 ? fmtRoas(portfolioRoas) : '—'} icon={TrendingUp} color="bg-green-500" />
        <KpiCard label="Portfolio CPA" value={portfolioCpa > 0 ? fmt$(portfolioCpa) : '—'} icon={ShoppingCart} color="bg-orange-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {!isLoading && creativeTypePie.length > 0 && totalPieSpend > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 h-full">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Creative mix by type (spend-weighted)</h2>
          <p className="text-xs text-gray-500 mb-3">Video vs image vs catalog-style CTAs vs text-only rows in the current date range.</p>
          <div className="h-[240px] w-full max-w-lg mx-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={creativeTypePie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {creativeTypePie.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value: number, _n, item: any) => {
                    const pct = totalPieSpend > 0 ? ((value as number) / totalPieSpend) * 100 : 0
                    return [`$${(value as number).toFixed(0)} (${pct.toFixed(1)}%)`, item?.payload?.name ?? 'Spend']
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top Creatives Visual Chart */}
      {allCreatives.length > 0 && (() => {
        const chartData = chartMode === 'spend'
          ? allCreatives.filter(r => r.spend > 0).slice(0, 8)
          : allCreatives.filter(r => r.spend > 0 && r.revenue > 0).sort((a, b) => (b.revenue / b.spend) - (a.revenue / a.spend)).slice(0, 8)
        const maxBarValue = chartMode === 'spend'
          ? (chartData[0]?.spend || 1)
          : Math.max(...chartData.map(r => r.spend > 0 ? r.revenue / r.spend : 0), 1)

        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 h-full">
            {/* Header + toggle */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-gray-700">Top Creatives</h2>
              <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
                <button
                  onClick={() => setChartMode('spend')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${chartMode === 'spend' ? 'bg-white text-[var(--brand-600)] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
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
                const barMaxPx = 112
                return (
                  <div key={row._key} className="flex flex-col gap-1.5">
                    {/* Bar */}
                    <div className="flex items-end justify-center h-28">
                      <div
                        className="rounded-t-md w-full max-w-[48px] mx-auto transition-all min-h-[10px]"
                        style={{
                          height: `${Math.max(10, (barValue / maxBarValue) * barMaxPx)}px`,
                          background: chartMode === 'spend' ? CHART_COLORS[i % CHART_COLORS.length] : (roas >= 3 ? '#22c55e' : roas >= 1.5 ? '#eab308' : '#f97316'),
                          opacity: 0.9,
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
                      <div className={`absolute top-1 left-1 text-xs px-1 py-0.5 rounded font-medium ${isVideo ? 'bg-purple-600/80 text-white' : 'bg-[var(--brand-600)]/90 text-white'}`}>
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
      </div>

      {/* Creative Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
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
                <thead className="bg-gray-50 border-b border-gray-200">
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
                            <CreativeThumb row={row} adKey={row._key} onImageError={reportThumbFail} />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <ExternalLink size={12} className="text-white drop-shadow" />
                            </div>
                          </button>
                        </td>
                        <td className="px-3 py-2.5 max-w-[220px]">
                          <div className="flex items-start gap-2">
                            <span className={`mt-0.5 shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${isVideo ? 'bg-purple-100 text-purple-700' : 'bg-[var(--brand-50)] text-[var(--brand-700)]'}`}>
                              {isVideo ? 'VID' : 'IMG'}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 truncate text-xs leading-tight">{row.ad_name || row.ad_id}</p>
                              {row.headline && <p className="text-xs text-gray-500 truncate mt-0.5">{row.headline}</p>}
                              {row.primary_copy && (
                                <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5 leading-snug">{row.primary_copy}</p>
                              )}
                              {row.description && (
                                <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5 leading-snug">{row.description}</p>
                              )}
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
                        className={`w-7 h-7 text-xs rounded-lg border transition-colors ${pg === creativePage ? 'bg-[var(--brand-600)] text-white border-[var(--brand-600)]' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}
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

    </div>
  )
}
