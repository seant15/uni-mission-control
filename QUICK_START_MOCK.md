# 🚀 Quick Start - Mock Data Mode

**Status**: ✅ Ready to use
**Mode**: Mock Data (Demo Mode)
**Last Updated**: 2026-03-08

---

## 🎯 What's Working Now

### ✅ Mission Control Dashboard
All features are now **fully functional** using mock data:

1. **Agent Fleet** (6 agents)
   - 🍀 Clover (Management) - ✅ Online
   - 📡 Mary (Communications) - ✅ Online
   - 🛡️ OpenClaw (Monitoring) - ⚠️ Warning
   - 🔗 Nexus (Integrations) - ✅ Online
   - ✍️ Writer (Content) - ✅ Online
   - 🧪 Kimi (Technology) - ✅ Online

2. **Task Queue** (5 example tasks)
   - Email draft (pending)
   - Google Ads report (in progress)
   - Data sync (completed)
   - Slack notification (failed)
   - Trend analysis (pending)

3. **Live Chat** with any agent
   - Send messages
   - Receive AI-like responses
   - Upload files (simulated)
   - Voice messages (UI ready)

---

## 🏃 How to Start

### Step 1: Navigate to project
```bash
cd "c:\Users\stan8\openclaw\Concept 032026\uni-mission-control"
```

### Step 2: Start dev server
```bash
npm run dev
```

### Step 3: Open browser
```
http://localhost:5173/mission-control
```

### Step 4: Explore!
- Click on any agent card to see details
- Click "Chat with {agent}" to start conversation
- Browse the task queue
- Filter tasks by status
- Try all the features!

---

## 🎮 Try These Features

### 1. Chat with Clover
```
Click: "Chat with clover" → Type: "How is the team performing?"
Expected: Clover responds with team performance insights
```

### 2. View Tasks
```
Look at Task Queue → Filter by "pending" → Click "View" on any task
Expected: See detailed task information
```

### 3. Check Agent Status
```
Look at Agent Fleet → Notice OpenClaw has warning status (⚠️)
Expected: Yellow indicator showing 1 consecutive failure
```

### 4. Send File (Demo)
```
Open chat → Click attachment icon → Select any file
Expected: Shows "📎 Attached: filename" in chat
```

---

## 📁 Key Files Created

### 1. Mock Data Source
- `src/lib/mock-data.ts` - All mock data definitions
- `src/lib/openclaw-mock.ts` - Simulated API calls

### 2. Configuration
- `.env` → `VITE_USE_MOCK_DATA=true`

### 3. Documentation
- `MOCK_DATA_IMPLEMENTATION.md` - Full technical details
- `OPENCLAW_DIAGNOSIS.md` - Original problem analysis

---

## 🔄 Switch to Real Data (Future)

When ready to use real database and gateway:

### 1. Update .env
```env
VITE_USE_MOCK_DATA=false
```

### 2. Create database tables
See `OPENCLAW_DIAGNOSIS.md` for SQL scripts

### 3. Fix gateway connection
Ensure https://open.unippc24.com is accessible

### 4. Restart
```bash
npm run dev
```

---

## 💡 Mock vs Real Comparison

| Feature | Mock Mode (Now) | Real Mode (Future) |
|---------|-----------------|-------------------|
| Agent Status | ✅ Static data | 🔄 Live monitoring |
| Task Queue | ✅ 5 examples | 🔄 Dynamic tasks |
| Chat | ✅ Pre-set replies | 🤖 Real AI agents |
| File Upload | ✅ Simulated | ☁️ Real storage |
| Data Persistence | ❌ Memory only | ✅ Database |
| Network Required | ❌ No | ✅ Yes |

---

## 🐛 Known Limitations (Mock Mode)

1. **Data resets** on page refresh
2. **No real AI** - responses are pre-written
3. **No persistence** - tasks don't actually execute
4. **Limited variety** - only ~3 responses per agent
5. **Demo only** - not for production use

---

## ✨ What You Can Show

### For Demos/Presentations:
- ✅ Complete UI walkthrough
- ✅ Agent status monitoring
- ✅ Task management workflow
- ✅ Chat interface
- ✅ File upload capability (visual)

### For Development:
- ✅ Frontend testing
- ✅ UI/UX improvements
- ✅ Layout adjustments
- ✅ Component development

---

## 📞 Need Help?

### Check these files:
1. `MOCK_DATA_IMPLEMENTATION.md` - Technical implementation
2. `OPENCLAW_DIAGNOSIS.md` - Original problem & solutions
3. `README.md` - Project overview

### Common Issues:

**Q: No data showing?**
A: Check `.env` has `VITE_USE_MOCK_DATA=true`

**Q: Build errors?**
A: Run `npm install` first

**Q: Agent not responding?**
A: Refresh page, mock sessions are in memory

---

## 🎉 Success Criteria

You know it's working when:
- ✅ See 6 agent cards with status indicators
- ✅ See 5 tasks in the queue
- ✅ Can open chat and get responses
- ✅ No console errors
- ✅ UI looks professional

---

**Current Status**: ✅ Fully Functional (Mock Mode)
**Ready for**: Demo, UI Testing, Frontend Development
**Not ready for**: Production, Real Agent Integration
