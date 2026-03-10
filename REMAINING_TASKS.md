# 🚧 剩余任务清单

**创建时间**: 2026-03-10
**状态**: 进行中
**最新 Commit**: `05712cb`

---

## ✅ 已完成

1. ✅ **修复 Alerts 页面 - detected_at 列错误**
   - 将 `detected_at` 改为 `created_at`
   - 解决了 "column alerts.detected_at does not exist" 错误

2. ✅ **修复 Clients Overview - campaigns 列显示 0**
   - 移除了 "Campaigns" 列（数据在 daily_performance 表中不可用）
   - 表格现在显示: Account, Platform, Spend, Revenue, ROAS, CTR, CPC, Conversions, Status

---

## 🔄 待完成任务

### 3️⃣ ✅ 修复 Data Analytics - Ad Account 过滤逻辑

**问题描述**:
- 目前 Ad Account 选项只在选择特定 Platform 时出现
- 显示的是所有 ad accounts，应该只显示属于当前选中 Client 的 ad accounts
- Ad Account 选项应该一直显示（不依赖 Platform 选择）

**需要修改的文件**: `src/pages/DataAnalytics.tsx`

**修改内容**:
```typescript
// 1. Ad Account 查询应该根据 selectedClient 过滤，而不是 selectedPlatform
const { data: adAccountsFromDB } = useQuery({
  queryKey: ['ad_accounts', selectedClient, selectedPlatform],
  queryFn: async () => {
    let query = supabase
      .from('daily_performance')
      .select('ad_account_id, platform')

    // 按 client 过滤
    if (selectedClient && selectedClient !== 'all') {
      query = query.eq('client_id', selectedClient)
    }

    // 可选：按 platform 过滤
    if (selectedPlatform && selectedPlatform !== 'all') {
      query = query.eq('platform', selectedPlatform)
    }

    const { data, error } = await query
    if (error) throw error

    const accounts = [...new Set(data?.map(item => item.ad_account_id).filter(Boolean))]
    return accounts.map(account => ({
      id: account,
      label: `${account}`
    }))
  },
  enabled: true, // 始终启用，不依赖 selectedPlatform
})

// 2. Ad Account 下拉菜单应该始终显示
// 移除条件: {selectedPlatform !== 'all' && ...}
<div>
  <label>Ad Account</label>
  <select value={selectedAdAccount} onChange={...}>
    <option value="">All Accounts</option>
    {adAccountsFromDB?.map(...)}
  </select>
</div>
```

---

### 4️⃣ 为 Marketing Overview 添加过滤器

**问题描述**:
Marketing Overview 页面需要和 Data Analytics 一样的过滤功能

**需要添加的过滤器**:
1. **Time Period** (已有: 7d/30d/90d)
2. **Business Type** (新增: Lead Gen / eCommerce)
3. **Client** (新增: 下拉选择)
4. **Platform** (新增: All / Meta Ads / Google Ads)
5. **Ad Account** (新增: 根据 Client 和 Platform 筛选)

**需要修改的文件**: `src/pages/MarketingOverview.tsx`

**参考**: 复制 DataAnalytics.tsx 的过滤逻辑

---

### 5️⃣ 分离 Google Keywords 和 Search Terms

**问题描述**:
- 当前只显示一个表 "Google Search Term / Keyword Performance"
- 应该分为两个独立的表，对应两个 Supabase 表

**Supabase 表**:
1. `public.google_ads_keywords` - 关键词数据
2. `public.google_ads_search_terms` - 搜索词数据

**显示逻辑**:
- 两个表应该只在以下条件下显示：
  - 选择了单个 Client (不是 "All Clients")
  - 该 Client 包含 Google Ads 数据
  - Platform 选择为 "all" 或 "google_ads"

**需要修改的文件**:
- `src/pages/DataAnalytics.tsx` (添加搜索词表)
- `src/lib/api.ts` (添加 `getGoogleSearchTerms()` 函数)

**新增 API 函数**:
```typescript
async getGoogleSearchTerms(clientId?: string) {
  let query = supabase
    .from('google_ads_search_terms')
    .select('*')
    .order('cost_micros', { ascending: false })
    .limit(50)

  if (clientId && clientId !== 'all') {
    query = query.eq('client_id', clientId)
  }

  const { data, error } = await query
  if (error) throw error

  return data?.map(item => ({
    ...item,
    spend: item.cost_micros ? item.cost_micros / 1000000 : 0
  }))
}
```

---

### 6️⃣ 添加动画 GIF Logo

**问题描述**:
将静态 "U" logo 替换为动画 GIF

**GIF 文件位置**: `D:\UNI\MARKETING\LOGO\uni-face-123-bg.gif`

**需要修改的文件**: `src/App.tsx`

**步骤**:
1. 复制 GIF 文件到项目:
   ```bash
   cp "D:\UNI\MARKETING\LOGO\uni-face-123-bg.gif" "c:\Users\stan8\openclaw\Concept 032026\uni-mission-control\public\uni-logo.gif"
   ```

2. 修改 App.tsx:
   ```tsx
   // 当前代码 (删除):
   <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg">
     U
   </div>

   // 新代码 (替换为):
   <img
     src="/uni-logo.gif"
     alt="UNI Logo"
     className="w-10 h-10 rounded-xl shadow-lg object-cover"
   />
   ```

---

### 7️⃣ 简化通知图标

**问题描述**:
- 右上角的通知 icon 有红点但点不开
- 建议移除红点，之后用右下角对话窗口做提醒

**需要修改的文件**: `src/App.tsx`

**修改内容**:
```tsx
// 当前代码:
<button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
  <Bell size={20} />
  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
</button>

// 修改为 (移除红点):
<button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
  <Bell size={20} />
</button>
```

或者完全移除通知按钮（如果不需要）:
```tsx
// 删除整个 button 元素
```

---

## 📝 额外建议

### 优化建议
1. **性能优化**:
   - MarketingOverview 和 ClientsOverview 都在前端聚合数据
   - 考虑创建 Supabase Views 或存储过程进行后端聚合

2. **错误处理**:
   - 所有 Supabase 查询添加更友好的错误消息
   - 添加 loading skeleton UI

3. **数据验证**:
   - 确保 Supabase RLS 策略正确配置
   - 验证所有表都有必需的字段

### 下一步行动
1. 依次完成任务 3-7
2. 测试所有修改
3. 提交并推送到 GitHub
4. 验证 Vercel 部署成功
5. 在生产环境测试所有功能

---

**参考文档**:
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)
- [REFACTORING_SUMMARY.md](REFACTORING_SUMMARY.md)
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- [DATA_SOURCE_MAPPING.md](DATA_SOURCE_MAPPING.md)
