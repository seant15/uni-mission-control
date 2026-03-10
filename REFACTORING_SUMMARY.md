# UNI Mission Control - Refactoring Summary

## 🎯 Overview

Mission Control has been completely refactored from an OpenClaw agent management system to a **Marketing Performance Hub** focused on analytics, alerts, and client account management.

---

## ✅ What Changed

### 1. **Removed OpenClaw Agent Content**
   - ❌ Deleted "Mission Control" tab (agent fleet management)
   - ❌ Deleted "Task Analytics" tab
   - ❌ Removed all agent-related UI components from Overview
   - ✅ Kept only Marketing metrics in Overview (spend, ROAS, impressions, etc.)

### 2. **New Tab Structure**

   | Tab | Route | Description |
   |-----|-------|-------------|
   | **Marketing Overview** | `/` | Main dashboard showing marketing metrics across all platforms |
   | **Alerts** | `/alerts` | Performance alerts with filtering, notes, and status tracking |
   | **Clients Overview** | `/clients-overview` | Client account comparison dashboard with charts |
   | **Data Analytics** | `/data-analytics` | (Existing) Advanced analytics tools |
   | **Settings** | `/settings` | (Existing) Application settings |

### 3. **New Features**

#### 📊 Marketing Overview
- Period selector: 7d / 30d / 90d
- **Primary Metrics**: Total Spend, Total Revenue, ROAS, Conversions
- **Secondary Metrics**: Impressions, Clicks, CTR, CPC
- **Cost Metrics**: Conversion Rate, CPA
- **Platform Breakdown Table**: Performance by ad platform
- Change indicators showing trends vs previous period

#### 🚨 Alerts Page
- **Summary Cards**: Total, New, In Progress, Critical, High severity alerts
- **Filtering**: By severity (low/medium/high/critical) and status (new/in_progress/resolved/ignored)
- **Features**:
  - Add notes to each alert
  - Mark alerts as resolved or ignored
  - Group alerts by account
  - Sort by detection time (newest first)
  - Color-coded severity badges
  - Error handling with Supabase connection status

#### 👥 Clients Overview
- **Period Selector**: 7d / 30d / 90d / **1yr** (newly added)
- **Summary Cards**: Total accounts, spend, revenue, average ROAS, conversions
- **Charts**:
  - Bar chart: Top 10 performers by ROAS
  - Pie chart: Spend distribution by platform
- **Sortable Table**: All client accounts with metrics
  - Click column headers to sort
  - Visual indicators for ROAS (green ≥2x, blue ≥1x, red <1x)
- **Error handling** with user-friendly messages

---

## 📁 Files Created

### Type Definitions
- `src/types/alerts.ts` - Alert data structures and enums
- `src/types/clients.ts` - Client account and metrics types
- `src/types/marketing.ts` - Marketing metrics types
- `src/types/index.ts` - Re-exports all types

### Pages
- `src/pages/MarketingOverview.tsx` - Marketing dashboard (replaces Dashboard)
- `src/pages/Alerts.tsx` - Alerts management page
- `src/pages/ClientsOverview.tsx` - Client comparison dashboard

### API Layer
- `src/lib/supabase-api.ts` - Centralized Supabase API functions
  - Alerts API: fetch, update status, update notes, get summary
  - Clients API: fetch accounts, get summary
  - Marketing Metrics API: fetch metrics, calculate from accounts
  - Real-time subscriptions for alerts and client updates

### Testing
- `scripts/check-supabase-tables.ts` - Verify Supabase table structure

---

## 📁 Files Modified

- `src/App.tsx` - Updated routing and navigation
  - Changed subtitle to "Marketing Performance Hub"
  - Updated navigation items
  - Updated search placeholder
  - Removed old routes, added new ones

---

## 🗄️ Database Structure (实际使用的表)

### ✅ 实际数据源映射

根据 `SUPABASE_SCHEMA_REFERENCE.md`，以下是**实际使用**的表：

1. **`daily_performance`** - 主要性能数据源
   - MarketingOverview: 实时聚合所有数据
   - ClientsOverview: 按 client_id 分组聚合

2. **`clients`** - 客户主表
   - ClientsOverview: 提供客户名称和基本信息

3. **`alerts`** - 警报数据
   - Alerts 页面: 直接查询

详细映射请参考: [DATA_SOURCE_MAPPING.md](DATA_SOURCE_MAPPING.md)

---

### Expected Supabase Tables

#### `daily_performance` Table (主数据源)
```sql
- id: uuid (primary key)
- client_id: uuid (foreign key → clients.id)
- client_name: text
- date: date
- platform: text (meta_ads, google_ads, etc.)
- ad_account_id: text
- impressions: integer
- clicks: integer
- conversions: integer
- cost: decimal (USD)
- revenue: decimal (USD)
- created_at: timestamptz
- updated_at: timestamptz
```

**计算指标** (应用层计算):
- CTR = (clicks / impressions) * 100
- ROAS = revenue / cost
- CPA = cost / conversions
- CPC = cost / clicks
- Conversion Rate = (conversions / clicks) * 100

#### `clients` Table
```sql
- id: uuid (primary key)
- name: text
- industry: text
- business_type: text (leadgen, ecommerce)
- meta_ad_account_id: text
- meta_ad_account_id_2: text
- google_ads_customer_id: text
- status: text (active, paused)
- created_at: timestamptz
- updated_at: timestamptz
```

#### `alerts` Table
```sql
- id: uuid (primary key)
- account_name: text
- account_id: text
- alert_type: text (performance_drop, budget_alert, ctr_decline, etc.)
- severity: text (low, medium, high, critical)
- message: text
- metric_name: text (optional)
- metric_change: text (optional)
- detected_at: timestamp
- status: text (new, in_progress, resolved, ignored)
- notes: text (optional)
- resolved_at: timestamp (optional)
- created_at: timestamp
- updated_at: timestamp
```

---

### ⚠️ 注意: 不使用的表

以下表格**不存在**或**不使用**:
- ~~`client_accounts`~~ - 改用 `clients` + `daily_performance` 实时聚合
- ~~`account_metrics`~~ - 不存在
- ~~`marketing_metrics`~~ - 可选的预聚合表，当前使用 `daily_performance` 实时计算

---

## 🔧 Setup Instructions

### 1. Configure Environment Variables

Add these to your Vercel environment variables (or `.env` file locally):

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2. Set up Supabase Tables

Run the SQL scripts to create the required tables in your Supabase project (see database structure above).

### 3. Build and Deploy

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Deploy to Vercel
vercel --prod
```

---

## 🎨 UI Improvements

### Color Coding
- **ROAS**: Green (≥2x), Blue (≥1x), Red (<1x)
- **Alert Severity**:
  - Critical: Red background, white text
  - High: Orange background, white text
  - Medium: Yellow background, dark text
  - Low: Blue background, white text
- **Alert Status**:
  - New: Blue badge
  - In Progress: Yellow badge
  - Resolved: Green badge
  - Ignored: Gray badge

### Charts
- **Recharts** library for data visualization
- Bar charts for top performers
- Pie charts for platform distribution
- Responsive containers
- Custom tooltips with currency formatting

### Error Handling
- User-friendly error messages
- Supabase connection status indicators
- Empty state messages when no data available

---

## 📊 Key Metrics Tracked

### Marketing Overview
- Total Spend, Revenue, ROAS, Conversions
- Impressions, Clicks, CTR, CPC
- Conversion Rate, CPA (Cost Per Acquisition)
- Platform breakdown by spend/revenue/ROAS

### Alerts
- Total alerts count
- New alerts requiring attention
- In-progress alerts being worked on
- Critical and high-severity alerts

### Clients
- Total client accounts
- Total spend across all accounts
- Total revenue generated
- Average ROAS across accounts
- Total conversions

---

## 🚀 Next Steps

1. **Configure Supabase**:
   - Set up environment variables with your Supabase credentials
   - Create the required tables using the schema above
   - Optionally set up Row Level Security (RLS) policies

2. **Populate Data**:
   - Import historical marketing data
   - Set up automated data pipelines to update metrics
   - Configure alert generation rules

3. **Deploy**:
   - Push to your Git repository
   - Deploy via Vercel
   - Verify all pages load correctly

4. **Test**:
   - Check Supabase connection
   - Verify data displays correctly
   - Test filtering and sorting functionality
   - Validate error handling

---

## 🐛 Troubleshooting

### "Invalid API key" Error
- Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly
- Verify the environment variables in Vercel dashboard
- Redeploy after updating environment variables

### No Data Showing
- Check Supabase tables have data
- Verify table names match exactly (case-sensitive)
- Check browser console for error messages
- Verify RLS policies allow reads

### Charts Not Rendering
- Ensure data is in correct format
- Check browser console for Recharts errors
- Verify responsive container parent has height

---

## 📝 Notes

- **No Mock Data**: All pages connect directly to Supabase. Error messages are shown if connection fails.
- **Real-time Updates**: Supabase subscriptions are available via `supabase-api.ts` for live updates
- **Type Safety**: Full TypeScript coverage for all data structures
- **Responsive Design**: All pages are mobile-friendly with Tailwind CSS

---

**🎉 Refactoring Complete!**

All OpenClaw agent content has been removed and replaced with a comprehensive marketing analytics platform.
