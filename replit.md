# Iron Metrics

## Overview
The Stability Command Center for CrossFit gyms. A financial resilience operating system designed to reduce revenue volatility, improve retention stability, lower owner stress, and strengthen community longevity.

**Identity**: Not an analytics dashboard. Not a reporting tool. A decision engine.

**Core Belief**: Retention is the heartbeat of a gym business.

**Tone**: Declarative. Calm. Minimal. Authoritative. Precise. Intentional.

## TODO (Next Session)
- Update churn metrics
- Consider adding attendance trend charts (weekly attendance frequency per member)

## Recent Changes (2026-02-22)
- Renamed "Member Risk" → "Member Intelligence" in sidebar navigation
- Added "Rising" engagement category (sky blue, Sparkles icon) — members with low churn, recent attendance, <90 days tenure
- Added clickable category filters on Member Intelligence page (click segment card → filter table, "Clear filter" to reset)
- Added detailed tooltips on all 5 engagement category cards (Core, Rising, Drifter, At-Risk, Ghost)
- Fixed Reports page card text truncation (break-words + md:grid-cols-3)
- 5 engagement classes: core, rising, drifter, at-risk, ghost

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
6. **Predictive Intelligence Stack** - Member-level churn prediction (0-1 probability, engagement classification, intervention types), cohort survival analysis, revenue scenario modeling (Monte Carlo-style), strategic brief generator with economically-quantified CrossFit-aware recommendations, execution checklists, stability verdict visual (strong/moderate/fragile with progress bar), enriched member alerts (tenure, last contact, outreach status, suggested action), and revenue outlook bar comparison.
7. **Ranked Intervention Engine** - Every recommendation is mathematically scored: interventionScore = expectedRevenueImpact × confidenceWeight × urgencyFactor, where expectedRevenueImpact = churnReductionEstimate × membersAffected × avgLtvRemaining. Confidence is data-quality-based (data months, member count, retention windows). Urgency is timeframe-driven with context multipliers. Priority labels (critical/high/medium/low) derived from score percentile thresholds. Top-scored intervention surfaces as "Focus Recommendation" hero card.

### Intelligence Philosophy
- All insights presented as Iron Metrics intelligence — no external coach attributions
- Coaching concepts (onboarding structure, awareness, trust-building, identity transformation) are embedded natively
- Strategic brief limited to TOP 3 ranked recommendations sorted by interventionScore descending; priority labels derived from score percentiles
- **Scope Discipline Layer**: Each recommendation = ONE lever only; checklists 4-6 items max; detail paragraph under 120 words; execution standard 1 sentence max
- **Distinct Category Selection**: Top 3 recommendations prefer distinct execution categories (Retention, Acquisition, Community Depth, Coaching Quality); duplicate categories only allowed when critical risk conditions override
- **Scope Audit**: Before final render, every checklist is validated against the recommendation's pillar — off-topic items (onboarding in coaching recs, upsells in retention recs, etc.) are removed automatically
- Language is direct, human, gym-owner-friendly — no MBA jargon
- Core member interventions include: quarterly goal-setting, skill progression tracking, competition participation, movement quality reinforcement
- CrossFit event recommendations rotate seasonally (Open, Hero WODs, seminars, nutrition challenges, holiday events, yoga/mobility clinics, bring-a-friend days)
- Stability verdicts are clear and actionable (strong/moderate/fragile)
- Doctrine Library content (Two-Brain, BHOTD, CrossFit HQ) is woven invisibly into recommendation copy — no citations, source chips, or "based on" references shown to users
- Optional "Execution Standard:" line on recommendation cards with 1 sentence derived from doctrine
- Internal audit trail logs which doctrine chunks informed each recommendation (recommendation_chunk_audit table)

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
- **Attendance-Based Disengagement Detection**:
  - Primary signal: `lastAttendedDate` on members table — disengaged = no class in 14+ days
  - Wodify connector attempts to fetch attendance data via multiple endpoint patterns (graceful 404 fallback)
  - CSV import supports `lastAttendedDate` with 20+ column name synonyms (last_attended, last_visit, last_class, etc.)
  - Fallback: if no attendance data exists for a gym, reverts to contact-based disengagement detection
- **Robust Data Ingestion System** (Import Wizard):
  - Multi-step wizard: Upload → Map Columns → Validate → Import
  - Intelligent column auto-detection with confidence indicators (high/medium/low)
  - Supports 50+ column name synonyms (Wodify, PushPress, Zen Planner, etc.)
  - Multi-format date parsing (ISO, US, EU, named months, short years)
  - Row-level validation with actionable error messages and partial success
  - File fingerprinting for duplicate file detection
  - Raw CSV preservation in import_jobs table for audit/reprocessing
  - Import history tracking with status, counts, and error details
  - Idempotent upsert by email to prevent data duplication
  - Input sanitization (CSV injection protection, email validation)
  - 10 MB file size limit with file type enforcement
- Performance Stack metrics computation with 90-day trend tracking
- 7 report cards: Monthly Churn, RSI, Revenue/Member, LTVE, Risk Radar, Net Growth
- LTVE scenario visualization ("If churn drops from X to Y: +$Z per member")
- Risk tier classification (Low/Moderate/High)
- Trend charts: RSI, MRR, Active Members, Churn, Revenue/Member, Net Growth
- Dark steel / charcoal visual identity
- **Wodify Integration**:
  - Direct API connection to Wodify gym management platform
  - API key encrypted at rest (AES-256-GCM), never stored in plaintext
  - Raw data landing zone (wodify_raw_clients, wodify_raw_memberships) preserves source data
  - Automatic transformation from Wodify clients/memberships to canonical members table
  - Backfill (full historical pull) and incremental sync support
  - Rate limiting with exponential backoff retries (3 attempts max)
  - Paginated data fetching for large gym rosters
  - Sync run history with error tracking and status reporting
  - Automatic metrics recompute after sync completes
  - Frontend: connection form, test connection, sync trigger, sync history display
  - Navigation: Wodify button on gym detail page header, route at /gyms/:id/wodify

## Project Structure
```
client/src/
  pages/         - Landing, Dashboard (Command Center), GymDetail, GymNew, CsvImport, WodifyIntegration, PredictiveIntelligence
  components/    - AppSidebar, ThemeProvider, ThemeToggle, shadcn ui
  hooks/         - use-auth, use-toast
  lib/           - queryClient, auth-utils, utils

server/
  routes.ts              - All API endpoints
  storage.ts             - DatabaseStorage (IStorage interface)
  metrics.ts             - Metrics computation + report generation + 90-day trends
  predictive.ts          - Predictive intelligence engine (member churn prediction, cohort analysis, revenue scenarios, strategic briefs)
  knowledge-ingestion.ts - Doctrine Library ingestion engine (chunking, embedding, taxonomy auto-tagging) — internal only, no user-facing UI
  knowledge-retrieval.ts - Doctrine Library retrieval (hybrid vector/text search, detail augmentation, execution standards) — internal only
  seed-knowledge.ts      - Pre-built CrossFit affiliate doctrine content (Two-Brain, BHOTD, CrossFit HQ) for seeding doctrine library
  csv-parser.ts          - CSV parsing for member imports
  wodify-connector.ts    - Wodify API client (auth, pagination, rate limiting, retries, data extraction/transform)
  wodify-sync.ts         - Sync engine (backfill/incremental orchestrator, raw data landing, transform to canonical members, metrics recompute trigger)
  db.ts                  - Drizzle + pg pool
  replit_integrations/auth/ - Replit Auth module

shared/
  schema.ts      - Drizzle schemas (gyms, members, import_jobs, gym_monthly_metrics, wodify_connections, wodify_sync_runs, wodify_raw_clients, wodify_raw_memberships, knowledge_sources, knowledge_documents, knowledge_chunks, recommendation_chunk_audit, ingest_jobs)
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
- `POST /api/gyms/:id/import/preview` - Preview CSV with auto-detected mapping, validation summary, duplicate check
- `POST /api/gyms/:id/import/commit` - Commit import with confirmed column mapping, creates import job
- `POST /api/gyms/:id/import/members` - Legacy direct CSV import (multipart)
- `GET /api/gyms/:id/imports` - Import history (list of past import jobs)
- `GET /api/gyms/:id/imports/:jobId` - Import job details with errors
- `GET /api/gyms/:id/heartbeat?month=YYYY-MM-DD` - Monthly heartbeat metrics
- `GET /api/gyms/:id/metrics` - All monthly metrics history
- `GET /api/gyms/:id/report?month=YYYY-MM-DD` - Full report with 90-day trends, forecast, interpretations, actions
- `GET /api/gyms/:id/trends/intelligence` - Trend intelligence with insights, projections, correlations, stability verdict
- `GET /api/gyms/:id/predictive` - Full predictive intelligence (member predictions, cohort intelligence, revenue scenarios, strategic brief)
- `POST /api/gyms/:id/recompute` - Recompute all metrics
- `POST /api/gyms/:id/wodify/test` - Test Wodify API key connectivity
- `POST /api/gyms/:id/wodify/connect` - Connect Wodify with encrypted API key
- `DELETE /api/gyms/:id/wodify/disconnect` - Remove Wodify connection
- `GET /api/gyms/:id/wodify/status` - Connection status + recent sync runs
- `POST /api/gyms/:id/wodify/sync` - Trigger sync (incremental or backfill)
- `GET /api/gyms/:id/wodify/sync-history` - Full sync run history

### Doctrine Library (Internal Only — No User-Facing UI)
- Doctrine content is stored in knowledge_chunks table, retrieved by the predictive engine
- Doctrine augments recommendation copy (detail paragraph + optional Execution Standard line)
- No citations, source chips, or article titles shown to the user
- Internal audit trail: recommendation_chunk_audit table logs which chunks informed each recommendation
- Backend API routes (/api/knowledge/*) retained for internal/dev ingestion only — not navigable from the app

## Design Tokens
- Font: Inter (sans), Libre Baskerville (serif), JetBrains Mono (mono)
- Primary: Near-black (244 81% 4%) in light mode, near-white (0 0% 98%) in dark mode
- Sidebar: Light neutral (0 0% 98%) in light mode, dark neutral (0 0% 11%) in dark mode
- Clean neutral palette — pure grays, no blue tint
- Dark mode: Pure neutral dark (0 0% 7% background)
- Red used minimally, only for risk alerts
- Border radius: 0.625rem (lg), 0.5rem (md), 0.375rem (sm)

## Feature Filter
Before implementing any feature, validate:
- Does this improve financial stability?
- Does this improve retention clarity?
- Does this reduce owner stress?
- Does this strengthen community longevity?
If no, exclude.
