import { Fragment, useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight } from 'lucide-react'
import { db } from '../lib/api'
import VirtualizedTableShell from './VirtualizedTableShell'
import ResizableColgroup from './ResizableColgroup'
import ResizableTh from './ResizableTh'
import { useResizableColumns } from '../hooks/useResizableColumns'
import { META_ADSET_COL_WIDTHS } from '../lib/tableResizeDefaults'
import { normalizeBusinessType, type BusinessType } from '../lib/businessType'
import type { MouseEvent as ReactMouseEvent } from 'react'

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
  colId,
  widths,
  startResize,
}: {
  label: string
  field: string
  sort: ReturnType<typeof useTableSort>
  align?: 'left' | 'right'
  colId?: string
  widths?: Record<string, number>
  startResize?: (colId: string, e: ReactMouseEvent) => void
}) {
  const active = sort.sortField === field
  const Icon = !active ? ArrowUpDown : sort.sortDir === 'asc' ? ArrowUp : ArrowDown
  const alignClass = align === 'left' ? 'text-left' : 'text-right'
  const button = (
    <button
      type="button"
      onClick={() => sort.toggle(field)}
      className={`flex items-center gap-1 hover:text-[var(--uni-text)] ${align === 'right' ? 'ml-auto' : ''} ${active ? 'text-[var(--brand-600)]' : ''}`}
    >
      {label}
      <Icon size={11} className={active ? 'text-[var(--brand-600)]' : 'text-gray-400'} />
    </button>
  )
  if (colId && widths && startResize) {
    return (
      <ResizableTh id={colId} widths={widths} startResize={startResize} align={align} variant="data-table">
        {button}
      </ResizableTh>
    )
  }
  return (
    <th className={`uni-data-table-th ${alignClass}`}>
      {button}
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
  businessType?: BusinessType | string | null
  targetCpa?: number | null
}

export default function MetaAdSetPerformanceTable({
  clientId,
  startDate,
  endDate,
  scopedClientId,
  nestedCreatives,
  compact = false,
  className = '',
  businessType,
  targetCpa,
}: Props) {
  const bt = normalizeBusinessType(businessType)
  const isLeadGen = bt === 'leadgen'
  const adsetSort = useTableSort(isLeadGen ? '_cpa' : 'spend')
  const adsetTableCols = useMemo(() => {
    const base = nestedCreatives
      ? ['expand', 'ad_set', 'campaign', 'spend', 'impressions', 'clicks', 'conv']
      : ['ad_set', 'campaign', 'spend', 'impressions', 'clicks', 'conv']
    if (isLeadGen) return [...base, 'cpa']
    return [...base, 'revenue', 'roas']
  }, [nestedCreatives, isLeadGen])
  const { widths: adsetColW, startResize: adsetColResize } = useResizableColumns(
    'meta-adset-v1',
    META_ADSET_COL_WIDTHS,
  )
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
    () =>
      adsetSort.sortRows(
        allAdSets.map(row => ({
          ...row,
          roas: row.spend > 0 ? row.revenue / row.spend : 0,
          _cpa: row.conversions > 0 ? row.spend / row.conversions : 0,
        })),
      ),
    [allAdSets, adsetSort.sortField, adsetSort.sortDir],
  )

  const cpaTone = (cpa: number) => {
    if (cpa <= 0 || !targetCpa) return 'text-gray-700'
    if (cpa > targetCpa * 1.25) return 'text-red-600 font-semibold'
    if (cpa > targetCpa) return 'text-amber-600 font-semibold'
    return 'text-green-700 font-semibold'
  }

  const renderAdSetRow = (row: any) => {
    const roas = row.spend > 0 ? row.revenue / row.spend : 0
    const cpa = row.conversions > 0 ? row.spend / row.conversions : 0
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
          {isLeadGen ? (
            <td className={`px-3 py-2.5 text-right text-xs ${cpaTone(cpa)}`}>
              {cpa > 0 ? fmt$(cpa) : '—'}
            </td>
          ) : (
            <>
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
            </>
          )}
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
                {isLeadGen ? (
                  <td className="px-3 py-2 text-right text-xs text-gray-500">
                    {cr.conversions > 0 ? fmt$(cr.spend / cr.conversions) : '—'}
                  </td>
                ) : (
                  <>
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
                  </>
                )}
              </tr>
            )
          })}
      </Fragment>
    )
  }

  const tableHead = (
    <tr>
      {nestedCreatives && (
        <ResizableTh id="expand" widths={adsetColW} startResize={adsetColResize} variant="data-table" />
      )}
      <SortTh label="Ad Set" field="ad_set_name" sort={adsetSort} align="left" colId="ad_set" widths={adsetColW} startResize={adsetColResize} />
      <SortTh label="Campaign" field="campaign_name" sort={adsetSort} align="left" colId="campaign" widths={adsetColW} startResize={adsetColResize} />
      <SortTh label="Spend" field="spend" sort={adsetSort} colId="spend" widths={adsetColW} startResize={adsetColResize} />
      <SortTh label="Impressions" field="impressions" sort={adsetSort} colId="impressions" widths={adsetColW} startResize={adsetColResize} />
      <SortTh label="Clicks" field="clicks" sort={adsetSort} colId="clicks" widths={adsetColW} startResize={adsetColResize} />
      <SortTh label={isLeadGen ? 'Leads' : 'Conversions'} field="conversions" sort={adsetSort} colId="conv" widths={adsetColW} startResize={adsetColResize} />
      {isLeadGen ? (
        <SortTh label="CPL" field="_cpa" sort={adsetSort} colId="cpa" widths={adsetColW} startResize={adsetColResize} />
      ) : (
        <>
          <SortTh label="Revenue" field="revenue" sort={adsetSort} colId="revenue" widths={adsetColW} startResize={adsetColResize} />
          <SortTh label="ROAS" field="roas" sort={adsetSort} colId="roas" widths={adsetColW} startResize={adsetColResize} />
        </>
      )}
    </tr>
  )

  const tableColgroup = <ResizableColgroup cols={adsetTableCols} widths={adsetColW} />

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
          <table className="uni-data-table text-sm table-fixed">
            {tableColgroup}
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
            colSpan={adsetTableCols.length}
            colgroup={tableColgroup}
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
