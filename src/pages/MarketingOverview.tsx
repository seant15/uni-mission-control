import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  DollarSign, TrendingUp, Target, MousePointer,
  Eye, AlertTriangle, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { MarketingMetrics } from '../types'

export default function MarketingOverview() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')

  // Calculate date range based on period
  const getDateRange = (period: '7d' | '30d' | '90d') => {
    const endDate = new Date()
    const startDate = new Date()

    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7)
        break
      case '30d':
        startDate.setDate(startDate.getDate() - 30)
        break
      case '90d':
        startDate.setDate(startDate.getDate() - 90)
        break
    }

    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    }
  }

  // Fetch and aggregate from daily_performance
  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ['daily_performance_aggregate', period],
    queryFn: async () => {
      const dateRange = getDateRange(period)

      const { data, error } = await supabase
        .from('daily_performance')
        .select('*')
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)

      if (error) throw new Error(error.message)
      return data
    },
  })

  // Aggregate metrics from daily_performance
  const metrics: MarketingMetrics | null = rawData ? (() => {
    const total_spend = rawData.reduce((sum, row) => sum + (Number(row.cost) || 0), 0)
    const total_revenue = rawData.reduce((sum, row) => sum + (Number(row.revenue) || 0), 0)
    const total_impressions = rawData.reduce((sum, row) => sum + (Number(row.impressions) || 0), 0)
    const total_clicks = rawData.reduce((sum, row) => sum + (Number(row.clicks) || 0), 0)
    const total_conversions = rawData.reduce((sum, row) => sum + (Number(row.conversions) || 0), 0)

    const roas = total_spend > 0 ? total_revenue / total_spend : 0
    const ctr = total_impressions > 0 ? (total_clicks / total_impressions) * 100 : 0
    const cpc = total_clicks > 0 ? total_spend / total_clicks : 0
    const cpa = total_conversions > 0 ? total_spend / total_conversions : 0
    const conversion_rate = total_clicks > 0 ? (total_conversions / total_clicks) * 100 : 0

    // Platform breakdown
    const platformMap = rawData.reduce((acc: any, row) => {
      const platform = row.platform || 'Unknown'
      if (!acc[platform]) {
        acc[platform] = { platform, spend: 0, revenue: 0, roas: 0 }
      }
      acc[platform].spend += Number(row.cost) || 0
      acc[platform].revenue += Number(row.revenue) || 0
      return acc
    }, {})

    const platform_breakdown = Object.values(platformMap).map((p: any) => ({
      ...p,
      roas: p.spend > 0 ? p.revenue / p.spend : 0,
    }))

    return {
      period,
      total_spend,
      spend_change: 0, // Would need previous period data
      total_revenue,
      roas,
      roas_change: 0,
      total_impressions,
      impressions_change: 0,
      total_clicks,
      clicks_change: 0,
      ctr,
      ctr_change: 0,
      total_conversions,
      conversions_change: 0,
      conversion_rate,
      conversion_rate_change: 0,
      cpc,
      cpc_change: 0,
      cpa,
      cpa_change: 0,
      platform_breakdown,
      updated_at: new Date().toISOString(),
    } as MarketingMetrics
  })() : null

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatNumber = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`
    }
    return value.toFixed(0)
  }

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  const getPeriodLabel = () => {
    switch (period) {
      case '7d': return 'Last 7 Days'
      case '30d': return 'Last 30 Days'
      case '90d': return 'Last 90 Days'
    }
  }

  const MetricCard = ({
    title,
    value,
    change,
    icon: Icon,
    color,
    format = 'number',
  }: {
    title: string
    value: number | string
    change?: number
    icon: any
    color: string
    format?: 'currency' | 'number' | 'percent' | 'raw'
  }) => {
    const isPositive = change !== undefined && change >= 0
    const formattedValue =
      format === 'currency'
        ? formatCurrency(value as number)
        : format === 'number'
        ? formatNumber(value as number)
        : format === 'percent'
        ? `${(value as number).toFixed(2)}%`
        : value

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-lg ${color}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          {change !== undefined && (
            <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              {formatPercent(Math.abs(change))}
            </div>
          )}
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">{formattedValue}</div>
          <div className="text-sm text-gray-600 mt-1">{title}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Marketing Overview</h1>
          <p className="text-gray-600 mt-1">Performance metrics across all platforms</p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle size={20} />
            <div>
              <div className="font-medium">Failed to load marketing metrics</div>
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
          <div className="mt-2 text-gray-600">Loading metrics...</div>
        </div>
      )}

      {/* Main Metrics */}
      {metrics && (
        <>
          <div className="grid grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Total Spend"
              value={metrics.total_spend}
              change={metrics.spend_change}
              icon={DollarSign}
              color="bg-blue-600"
              format="currency"
            />
            <MetricCard
              title="Total Revenue"
              value={metrics.total_revenue}
              change={metrics.roas_change}
              icon={TrendingUp}
              color="bg-green-600"
              format="currency"
            />
            <MetricCard
              title="ROAS"
              value={`${metrics.roas.toFixed(2)}x`}
              change={metrics.roas_change}
              icon={Target}
              color="bg-purple-600"
              format="raw"
            />
            <MetricCard
              title="Conversions"
              value={metrics.total_conversions}
              change={metrics.conversions_change}
              icon={TrendingUp}
              color="bg-orange-600"
              format="number"
            />
          </div>

          {/* Secondary Metrics */}
          <div className="grid grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Impressions"
              value={metrics.total_impressions}
              change={metrics.impressions_change}
              icon={Eye}
              color="bg-indigo-600"
              format="number"
            />
            <MetricCard
              title="Clicks"
              value={metrics.total_clicks}
              change={metrics.clicks_change}
              icon={MousePointer}
              color="bg-cyan-600"
              format="number"
            />
            <MetricCard
              title="CTR"
              value={metrics.ctr}
              change={metrics.ctr_change}
              icon={Target}
              color="bg-teal-600"
              format="percent"
            />
            <MetricCard
              title="CPC"
              value={metrics.cpc}
              change={metrics.cpc_change}
              icon={DollarSign}
              color="bg-pink-600"
              format="currency"
            />
          </div>

          {/* Cost Metrics */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <MetricCard
              title="Conversion Rate"
              value={metrics.conversion_rate}
              change={metrics.conversion_rate_change}
              icon={Target}
              color="bg-emerald-600"
              format="percent"
            />
            <MetricCard
              title="CPA (Cost Per Acquisition)"
              value={metrics.cpa}
              change={metrics.cpa_change}
              icon={DollarSign}
              color="bg-rose-600"
              format="currency"
            />
          </div>

          {/* Platform Breakdown */}
          {metrics.platform_breakdown && metrics.platform_breakdown.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-6">Performance by Platform</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Platform</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Spend</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Revenue</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">ROAS</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Share of Spend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {metrics.platform_breakdown.map((platform, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{platform.platform}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(platform.spend)}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                          {formatCurrency(platform.revenue)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span className={`font-semibold ${
                            platform.roas >= 2 ? 'text-green-600' :
                            platform.roas >= 1 ? 'text-blue-600' :
                            'text-red-600'
                          }`}>
                            {platform.roas.toFixed(2)}x
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">
                          {((platform.spend / metrics.total_spend) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Last Updated */}
          <div className="mt-6 text-center text-sm text-gray-500">
            Last updated: {new Date(metrics.updated_at).toLocaleString()}
          </div>
        </>
      )}

      {/* Empty State */}
      {!isLoading && !error && !metrics && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No metrics available</h3>
          <p className="text-gray-600">
            Marketing metrics will appear here once data is available for {getPeriodLabel()}.
          </p>
        </div>
      )}
    </div>
  )
}
