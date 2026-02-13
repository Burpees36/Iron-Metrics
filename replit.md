# Iron Metrics

## Overview
Multi-tenant gym revenue intelligence platform. Empowers gyms with financial clarity and retention intelligence so they can remain pillars of strength, health, and transformation in their communities.

**Mission**: Make gyms financially resilient so they can stand at the center of preventative health for generations to come.

**Core Belief**: Retention is the heartbeat of a gym business.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Recharts
- **Backend**: Express.js + Drizzle ORM + PostgreSQL
- **Auth**: Replit Auth (OpenID Connect)
- **Routing**: wouter (frontend), Express routes (backend)

## The Iron Metrics Performance Stack
1. **RSI** (Retention Stability Index) - Score 1-100 from churn, early cancellation, membership age distribution
2. **RES** (Revenue Efficiency Score) - Revenue per member, tier distribution
3. **LTVE** (Lifetime Value Engine) - True LTV + impact of 1% churn reduction
4. **CII** (Coach Impact Index) - Retention by class type, attendance patterns
5. **MRR** (Member Risk Radar) - Early-stage risk flagging for new members

## Report Format
Every metric follows: Current / Target / Impact + "What This Means" + "Recommended Action"

## Key Features
- Replit Auth for authentication
- Multi-tenant gym management (each gym scoped by owner_id)
- CSV member import with idempotent upsert (by email)
- Performance Stack metrics computation (RSI, RES, LTVE, MRR)
- Interpretive reports with actionable recommendations
- Trend visualization with Recharts
- Dark steel / charcoal visual identity with dark mode

## Project Structure
```
client/src/
  pages/         - Landing, Dashboard, GymDetail, GymNew, CsvImport
  components/    - AppSidebar, ThemeProvider, ThemeToggle, shadcn ui
  hooks/         - use-auth, use-toast
  lib/           - queryClient, auth-utils, utils

server/
  routes.ts      - All API endpoints
  storage.ts     - DatabaseStorage (IStorage interface)
  metrics.ts     - Performance Stack computation + report generation
  csv-parser.ts  - CSV parsing for member imports
  db.ts          - Drizzle + pg pool
  replit_integrations/auth/ - Replit Auth module

shared/
  schema.ts      - Drizzle schemas (gyms, members, gym_monthly_metrics with RSI/RES/LTVE/MRR)
  models/auth.ts - Auth schemas (users, sessions)
```

## API Routes
- `GET /api/gyms` - List owner's gyms
- `POST /api/gyms` - Create gym
- `GET /api/gyms/:id` - Get gym detail
- `GET /api/gyms/:id/members` - List gym members
- `POST /api/gyms/:id/import/members` - CSV member import (multipart)
- `GET /api/gyms/:id/heartbeat?month=YYYY-MM-DD` - Monthly heartbeat metrics
- `GET /api/gyms/:id/metrics` - All monthly metrics history
- `GET /api/gyms/:id/report?month=YYYY-MM-DD` - Full report with interpretations
- `POST /api/gyms/:id/recompute` - Recompute all metrics

## Design Tokens
- Font: Inter (sans), Libre Baskerville (serif), JetBrains Mono (mono)
- Primary: Deep blue (210 60%)
- Sidebar: Dark steel/charcoal (215 20% 14%)
- Dark mode: True operational control room feel
- Red used minimally, only for risk alerts
- Border radius: Small (0.375rem)
