import { useMemo } from 'react'

interface DailyPerformance {
  id: string
  client_id: string
  client_name?: string
  date: string
  platform: string
  impressions: number
  clicks: number
  conversions: number
  cost: number
  revenue: number
}

export interface PerformanceMetrics {
  cost: number
  impressions: number
  clicks: number
  conversions: number
  revenue: number
  roas: string
  cpa: string
  ctr: string
  cpc: string
}

/**
 * Hook to calculate performance metrics from raw data
 */
export function usePerformanceMetrics(performanceData: DailyPerformance[]): PerformanceMetrics {
  return useMemo(() => {
    const totals = performanceData.reduce(
      (acc, day) => ({
        cost: acc.cost + (day.cost || 0),
        impressions: acc.impressions + (day.impressions || 0),
        clicks: acc.clicks + (day.clicks || 0),
        conversions: acc.conversions + (day.conversions || 0),
        revenue: acc.revenue + (day.revenue || 0),
      }),
      { cost: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }
    )

    return {
      ...totals,
      roas: totals.cost > 0 ? (totals.revenue / totals.cost).toFixed(2) : '0.00',
      cpa: totals.conversions > 0 ? (totals.cost / totals.conversions).toFixed(2) : '0.00',
      ctr: totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : '0.00',
      cpc: totals.clicks > 0 ? (totals.cost / totals.clicks).toFixed(2) : '0.00',
    }
  }, [performanceData])
}

export interface ChartDataPoint {
  date: string
  cost: number
  revenue: number
  roas: number
}

/**
 * Hook to transform performance data for charts
 */
export function useChartData(performanceData: DailyPerformance[]): ChartDataPoint[] {
  return useMemo(() => {
    const dailyData = performanceData.reduce((acc: ChartDataPoint[], day) => {
      const existing = acc.find(d => d.date === day.date)
      const cost = day.cost || 0
      const revenue = day.revenue || 0

      if (existing) {
        existing.cost += cost
        existing.revenue += revenue
        existing.roas = existing.cost > 0 ? parseFloat((existing.revenue / existing.cost).toFixed(2)) : 0
      } else {
        acc.push({
          date: day.date,
          cost: cost,
          revenue: revenue,
          roas: cost > 0 ? parseFloat((revenue / cost).toFixed(2)) : 0
        })
      }
      return acc
    }, [])

    return dailyData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [performanceData])
}
