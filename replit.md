# Iron Metrics

## Overview
Multi-tenant gym revenue intelligence platform. Gives gym owners financial clarity, retention intelligence, and revenue stability through heartbeat metrics.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Recharts
- **Backend**: Express.js + Drizzle ORM + PostgreSQL
- **Auth**: Replit Auth (OpenID Connect)
- **Routing**: wouter (frontend), Express routes (backend)

## Key Features
- Replit Auth for authentication
- Multi-tenant gym management (each gym scoped by owner_id)
- CSV member import with idempotent upsert (by email)
- Monthly heartbeat metrics computation (active members, churn, MRR, ARM, LTV)
- Trend visualization with Recharts
- Dark mode support

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
  metrics.ts     - Monthly metrics computation engine
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
- `GET /api/gyms/:id/members` - List gym members
- `POST /api/gyms/:id/import/members` - CSV member import (multipart)
- `GET /api/gyms/:id/heartbeat?month=YYYY-MM-DD` - Monthly heartbeat metrics
- `GET /api/gyms/:id/metrics` - All monthly metrics history
- `POST /api/gyms/:id/recompute` - Recompute all metrics

## Design Tokens
- Font: Inter (sans), Libre Baskerville (serif), JetBrains Mono (mono)
- Primary: Deep blue (210 85%)
- Dark mode fully supported
