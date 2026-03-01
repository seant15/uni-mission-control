# UNI Mission Control

A unified dashboard for managing UNI Marketing's AI agent fleet and analytics.

## Features

- **Dashboard Overview**: System health, task stats, quick actions
- **Mission Control**: Agent fleet monitoring, task queue management
- **Analytics**: Performance charts, agent metrics
- **Settings**: Configuration, dark mode, notifications

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Query (data fetching)
- React Router
- Recharts (charts)
- Supabase (backend)

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start development server
npm run dev
```

## Environment Variables

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Deployment

### Vercel (Recommended)

```bash
npm run deploy
```

Or connect your GitHub repo to Vercel for auto-deployments.

## Project Structure

```
src/
├── pages/           # Page components
│   ├── Dashboard.tsx
│   ├── MissionControl.tsx
│   ├── Analytics.tsx
│   └── Settings.tsx
├── components/      # Shared components
├── hooks/           # Custom React hooks
├── lib/             # Utilities (Supabase client)
├── types/           # TypeScript types
└── stores/          # Zustand stores (if needed)
```

## License

Private - UNI Marketing
