# Iron Metrics

## Overview
The Stability Command Center for CrossFit gyms. A financial resilience operating system designed to reduce revenue volatility, improve retention stability, lower owner stress, and strengthen community longevity.

**Identity**: Not an analytics dashboard. Not a reporting tool. A decision engine.

**Core Belief**: Retention is the heartbeat of a gym business.

**Tone**: Declarative. Calm. Minimal. Authoritative. Precise. Intentional.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Recharts
- **Backend**: Express.js + Drizzle ORM + PostgreSQL
- **Auth**: Replit Auth (OpenID Connect)
- **Routing**: wouter (frontend), Express routes (backend)

## Core Modules
1. **Retention Stability Index (RSI)** - Primary north star. Composite score 1-100 from churn, early cancellation, membership age distribution, growth rate.
2. **Revenue Stability Panel** - Monthly churn %, net member growth, revenue per member (ARM), volatility indicators.
3. **Member Risk Radar** - Predictive early-warning. Risk tiers (Low/Moderate/High), intervention windows, outreach priority.
4. **Lifetime Value Engine (LTVE)** - True LTV, revenue unlocked per 1% churn improvement, scenario projections.
5. **Coach Impact Layer** - Retention leverage by class type and attendance patterns (future: requires attendance data).
6. **Predictive Intelligence Stack** - Member-level churn prediction (0-1 probability, engagement classification, intervention types), cohort survival analysis, revenue scenario modeling (Monte Carlo-style), strategic brief generator with economically-quantified CrossFit-aware recommendations.

## Report Format
Every metric block contains:
- Metric value
- Target benchmark
- 90-day trend (direction + percentage)
- "What This Means" (interpretation)
- "Why It Matters" (context)
- "What To Do Next" (recommended action)

If it does not drive action, it is not shown.

## Key Features
- Replit Auth for authentication
- Multi-tenant gym management (each gym scoped by owner_id)
- CSV member import with idempotent upsert (by email)
- Performance Stack metrics computation with 90-day trend tracking
- 7 report cards: Monthly Churn, RSI, Revenue/Member, LTVE, Risk Radar, Net Growth
- LTVE scenario visualization ("If churn drops from X to Y: +$Z per member")
- Risk tier classification (Low/Moderate/High)
- Trend charts: RSI, MRR, Active Members, Churn, Revenue/Member, Net Growth
- Dark steel / charcoal visual identity

## Project Structure
```
client/src/
  pages/         - Landing, Dashboard (Command Center), GymDetail, GymNew, CsvImport
  components/    - AppSidebar, ThemeProvider, ThemeToggle, shadcn ui
  hooks/         - use-auth, use-toast
  lib/           - queryClient, auth-utils, utils

server/
  routes.ts      - All API endpoints
  storage.ts     - DatabaseStorage (IStorage interface)
  metrics.ts     - Metrics computation + report generation + 90-day trends
  predictive.ts  - Predictive intelligence engine (member churn prediction, cohort analysis, revenue scenarios, strategic briefs)
  csv-parser.ts  - CSV parsing for member imports
  db.ts          - Drizzle + pg pool
  replit_integrations/auth/ - Replit Auth module

shared/
  schema.ts      - Drizzle schemas (gyms, members, gym_monthly_metrics)
  models/auth.ts - Auth schemas (users, sessions)
```

## API Routes
- `GET /api/gyms` - List owner's gyms
- `POST /api/gyms` - Create gym
- `GET /api/gyms/:id` - Get gym detail
- `GET /api/gyms/:id/members` - List gym members (raw)
- `GET /api/gyms/:id/members/enriched` - Enriched members with risk scores, tenure, contact recency, high-value flags
- `GET /api/gyms/:id/members/:memberId/contacts` - Contact history for a member
- `POST /api/gyms/:id/members/:memberId/contact` - Log a touchpoint/contact
- `POST /api/gyms/:id/import/members` - CSV member import (multipart)
- `GET /api/gyms/:id/heartbeat?month=YYYY-MM-DD` - Monthly heartbeat metrics
- `GET /api/gyms/:id/metrics` - All monthly metrics history
- `GET /api/gyms/:id/report?month=YYYY-MM-DD` - Full report with 90-day trends, forecast, interpretations, actions
- `GET /api/gyms/:id/trends/intelligence` - Trend intelligence with insights, projections, correlations, stability verdict
- `GET /api/gyms/:id/predictive` - Full predictive intelligence (member predictions, cohort intelligence, revenue scenarios, strategic brief)
- `POST /api/gyms/:id/recompute` - Recompute all metrics

## Design Tokens
- Font: Inter (sans), Libre Baskerville (serif), JetBrains Mono (mono)
- Primary: Deep blue (210 60%)
- Sidebar: Dark steel/charcoal (215 20% 14%)
- Dark mode: True operational control room feel
- Red used minimally, only for risk alerts
- Border radius: Small (0.375rem)

## Feature Filter
Before implementing any feature, validate:
- Does this improve financial stability?
- Does this improve retention clarity?
- Does this reduce owner stress?
- Does this strengthen community longevity?
If no, exclude.
