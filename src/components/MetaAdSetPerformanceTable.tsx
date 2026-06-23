import { Fragment, useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight } from 'lucide-react'
import { db } from '../lib/api'
import VirtualizedTableShell from './VirtualizedTableShell'

function useTableSort(defaultField: string, defaultDir: 'asc' | 'desc' = 'desc') {
  const [sortField, setSortField] = useState(defaultField)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultDir)
  const toggle = useCallback((field: string) => {
    setSortField(prev => {
      if (prev === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
      else setSortDir('desc')
      return field
    })
  }, [])
  const sortRows = (rows: any[]) =>
    [...rows].sort((a, b) => {
      const av = a[sortField] ?? 0
      const bv = b[sortField] ?? 0
      if (typeof av === 'string' && typeof bv === 'string')
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av)
    })
  return { sortField, sortDir, toggle, sortRows }
}

function SortTh({
  label,
  field,
  sort,
  align = 'right',
}: {
  label: string
  field: string
  sort: ReturnType<typeof useTableSort>
  align?: 'left' | 'right'
}) {
  const active = sort.sortField === field
  const Icon = !active ? ArrowUpDown : sort.sortDir === 'asc' ? ArrowUp : ArrowDown
  const alignClass = align === 'left' ? 'text-left' : 'text-right'
  return (
    <th className={`uni-data-table-th ${alignClass}`}>
      <button
        type="button"
        onClick={() => sort.toggle(field)}
        className={`flex items-center gap-1 hover:text-[var(--uni-text)] ${align === 'right' ? 'ml-auto' : ''} ${active ? 'text-[var(--brand-600)]' : ''}`}
      >
        {label}
        <Icon size={11} className={active ? 'text-[var(--brand-600)]' : 'text-gray-400'} />
      </button>
    </th>
  )
}

export function aggregateAdSets(rows: any[]): any[] {
  const map = new Map<string, any>()
  for (const row of rows) {
    const key = row.ad_set_id || row.ad_set_name || 'unknown'
    if (!map.has(key)) {
      map.set(key, {
        _key: key,
        ad_set_id: row.ad_set_id,
        ad_set_name: row.ad_set_name,
        campaign_name: row.campaign_name,
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
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

const fmt$ = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`)
const fmtN = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)))
const fmtRoas = (v: number) => `${v.toFixed(2)}x`

type Props = {
  clientId?: string
  startDate: string
  endDate: string
  scopedClientId?: string
  nestedCreatives?: any[]
  compact?: boolean
  className?: string
}

export default function MetaAdSetPerformanceTable({
  clientId,
  startDate,
  endDate,
  scopedClientId,
  nestedCreatives,
  compact = false,
  className = '',
}: Props) {
  const adsetSort = useTableSort('spend')
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(() => new Set())

  const { data: rawAdsets = [], isLoading } = useQuery({
    queryKey: ['meta-adsets', clientId ?? 'all', startDate, endDate, scopedClientId ?? ''],
    queryFn: () =>
      db.getMetaAdsets({
        clientId: clientId && clientId !== 'all' ? clientId : undefined,
        startDate,
        endDate,
        scopedClientId,
      }),
    enabled: !!startDate && !!endDate,
    staleTime: 5 * 60_000,
  })

  const allAdSets = aggregateAdSets(rawAdsets as any[])
  const sortedAdSets = useMemo(
    () => adsetSort.sortRows(allAdSets.map(row => ({ ...row, roas: row.spend > 0 ? row.revenue / row.spend : 0 }))),
    [allAdSets, adsetSort.sortField, adsetSort.sortDir],
  )

  const renderAdSetRow = (row: any) => {
    const roas = row.spend > 0 ? row.revenue / row.spend : 0
    const expanded = expandedAdSets.has(row._key)
    const adsetCreatives =
      nestedCreatives?.filter(
        c => c.ad_set_id === row.ad_set_id || c.ad_set_name === row.ad_set_name
      ) ?? []

    return (
      <Fragment key={row._key}>
        <tr className="hover:bg-gray-50/50 transition-colors">
          {nestedCreatives && (
            <td className="px-3 py-2.5">
              {adsetCreatives.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedAdSets(prev => {
                      const next = new Set(prev)
                      if (next.has(row._key)) next.delete(row._key)
                      else next.add(row._key)
                      return next
                    })
                  }
                  className="p-0.5 text-gray-400 hover:text-gray-600"
                >
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              )}
            </td>
          )}
          <td className="px-3 py-2.5 font-medium text-gray-900 text-xs max-w-[200px] truncate">
            {row.ad_set_name || row.ad_set_id}
          </td>
          <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[180px] truncate">{row.campaign_name}</td>
          <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold text-gray-900">{fmt$(row.spend)}</td>
          <td className="px-3 py-2.5 text-right text-xs text-gray-600">{fmtN(row.impressions)}</td>
          <td className="px-3 py-2.5 text-right text-xs text-gray-600">{fmtN(row.clicks)}</td>
          <td className="px-3 py-2.5 text-right text-xs text-gray-600">
            {row.conversions > 0 ? fmtN(row.conversions) : '—'}
          </td>
          <td className="px-3 py-2.5 text-right text-xs text-gray-600">
            {row.revenue > 0 ? fmt$(row.revenue) : '—'}
          </td>
          <td className="px-3 py-2.5 text-right text-xs">
            {roas > 0 ? (
              <span
                className={`font-semibold ${roas >= 3 ? 'text-green-600' : roas >= 1.5 ? 'text-yellow-600' : 'text-red-500'}`}
              >
                {fmtRoas(roas)}
              </span>
            ) : (
              '—'
            )}
          </td>
        </tr>
        {expanded &&
          nestedCreatives &&
          adsetCreatives.slice(0, 5).map(cr => {
            const crRoas = cr.spend > 0 ? cr.revenue / cr.spend : 0
            return (
              <tr key={`sub-${cr._key}`} className="bg-[var(--brand-50)]/50">
                <td className="px-3 py-2" />
                <td colSpan={2} className="px-3 py-2 text-xs text-gray-700 truncate pl-6">
                  {cr.ad_name || cr.ad_id}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-gray-700">{fmt$(cr.spend)}</td>
                <td className="px-3 py-2 text-right text-xs text-gray-500">{fmtN(cr.impressions)}</td>
                <td className="px-3 py-2 text-right text-xs text-gray-500">{fmtN(cr.clicks)}</td>
                <td className="px-3 py-2 text-right text-xs text-gray-500">
                  {cr.conversions > 0 ? fmtN(cr.conversions) : '—'}
                </td>
                <td className="px-3 py-2 text-right text-xs text-gray-500">
                  {cr.revenue > 0 ? fmt$(cr.revenue) : '—'}
                </td>
                <td className="px-3 py-2 text-right text-xs">
                  {crRoas > 0 ? (
                    <span
                      className={`font-semibold ${crRoas >= 3 ? 'text-green-600' : crRoas >= 1.5 ? 'text-yellow-600' : 'text-red-500'}`}
                    >
                      {fmtRoas(crRoas)}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            )
          })}
      </Fragment>
    )
  }

  const tableHead = (
    <tr>
      {nestedCreatives && <th className="px-3 py-2.5 w-8" />}
      <SortTh label="Ad Set" field="ad_set_name" sort={adsetSort} align="left" />
      <SortTh label="Campaign" field="campaign_name" sort={adsetSort} align="left" />
      <SortTh label="Spend" field="spend" sort={adsetSort} />
      <SortTh label="Impressions" field="impressions" sort={adsetSort} />
      <SortTh label="Clicks" field="clicks" sort={adsetSort} />
      <SortTh label="Conversions" field="conversions" sort={adsetSort} />
      <SortTh label="Revenue" field="revenue" sort={adsetSort} />
      <SortTh label="ROAS" field="roas" sort={adsetSort} />
    </tr>
  )

  return (
    <div className={className}>
      {!compact && (
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">Ad Set Performance</h2>
          <p className="text-xs text-gray-400 mt-0.5">{allAdSets.length} ad sets</p>
        </div>
      )}

      {isLoading ? (
        <div className={`flex items-center justify-center text-gray-400 text-sm ${compact ? 'py-8' : 'py-12'}`}>
          Loading ad sets…
        </div>
      ) : allAdSets.length === 0 ? (
        <div className={`flex items-center justify-center text-gray-400 text-sm ${compact ? 'py-8' : 'py-12'}`}>
          No ad set data for this selection
        </div>
      ) : nestedCreatives ? (
        <div className="uni-data-table-shell">
          <table className="uni-data-table text-sm">
            <thead className="uni-data-table-head">{tableHead}</thead>
            <tbody className="divide-y divide-gray-50">
              {sortedAdSets.map(row => renderAdSetRow(row))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="uni-data-table-shell">
          <VirtualizedTableShell
            rows={sortedAdSets}
            colSpan={8}
            maxHeight={520}
            rowHeight={42}
            tableClassName="uni-data-table text-sm"
            tbodyClassName="divide-y divide-gray-50"
            thead={tableHead}
            renderRow={row => renderAdSetRow(row)}
          />
        </div>
      )}
    </div>
  )
}
