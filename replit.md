# Iron Metrics

## Overview
Iron Metrics is a financial resilience operating system designed for CrossFit gyms. Its primary purpose is to stabilize revenue, enhance member retention, alleviate owner stress, and foster community longevity by acting as a decision engine. The project aims to deliver precise, actionable insights with a declarative, calm, and minimal tone, focusing on retention as the core business driver.

## User Preferences
Not an analytics dashboard. Not a reporting tool. A decision engine.
Retention is the heartbeat of a gym business.
Tone: Declarative. Calm. Minimal. Authoritative. Precise. Intentional.
Every metric block contains:
- Metric value
- Target benchmark
- 90-day trend (direction + percentage)
- "What This Means" (interpretation)
- "Why It Matters" (context)
- "What To Do Next" (recommended action)

If it does not drive action, it is not shown.

## System Architecture

### UI/UX Decisions
The application uses a dark steel/charcoal visual identity with a clean, neutral palette. Fonts include Inter, Libre Baskerville, and JetBrains Mono. Red is reserved for risk alerts. Consistent border radii (0.625rem, 0.5rem, 0.375rem) are applied. The design is mobile-responsive and includes print-friendly CSS.

### Technical Implementations
The system utilizes React, Vite, Tailwind CSS, shadcn/ui, and Recharts for the frontend. The backend is built with Express.js, Drizzle ORM, and PostgreSQL. Authentication is handled by Supabase Auth (email/password with JWT tokens), with wouter for frontend routing and Express for backend routes.

### Authentication Architecture (Supabase Auth)
- **Frontend**: `@supabase/supabase-js` v2.98 client with PKCE flow (`flowType: "pkce"`, `detectSessionInUrl: true`). Handles login, signup, password reset, and automatic token refresh. Auth state managed exclusively via `supabase.auth.onAuthStateChange()` in the `useAuth` hook (handles `INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `PASSWORD_RECOVERY` events).
- **Backend**: Stateless JWT verification via `supabase.auth.getUser(token)`. The `isAuthenticated` middleware extracts the Bearer token from the Authorization header, verifies it with Supabase, and upserts the user into the app `users` table. Sets `req.user = { id, email, firstName, lastName }`.
- **User identity**: `req.user.id` (Supabase UUID) is the primary identity throughout the backend.
- **Demo mode**: Uses express-session cookies (separate from Supabase JWT flow). Demo user stored in `req.session.demoUser`.
- **Staff invites**: `staff_invites` table with token-based invite flow. Owner creates invite → email sent via Supabase Admin API → invited user signs up and accepts invite → `gym_staff` record created.
- **Frontend auth pages**: `/login`, `/signup`, `/reset-password`, `/invite/:token` (all client-side routes, registered in both authenticated and unauthenticated route switches).
- **PKCE callback**: Supabase redirects with `?code=...` after email verification/password reset. The Supabase JS client auto-detects and exchanges the code for a session via `detectSessionInUrl: true`.
- **Environment variables**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (secrets); `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (shared env vars for frontend — must be the anon/public key, never the service role key).
- **Supabase dashboard**: Site URL must be `https://iron-metrics.replit.app`. Redirect URLs must include `https://iron-metrics.replit.app/**` and the dev domain.

### Feature Specifications
Iron Metrics provides a Stability Command Center dashboard with key financial and retention metrics, encompassing:
-   **Retention Stability Index (RSI)**: A composite score for financial health.
-   **Revenue Stability Panel**: Monitors churn, growth, and revenue per member.
-   **Member Risk Radar**: Predicts churn and prioritizes interventions.
-   **Lifetime Value Engine (LTVE)**: Calculates LTV and models revenue impact.
-   **Predictive Intelligence Stack**: Offers member-level churn probability, cohort analysis, revenue scenarios, and strategic recommendations.
-   **Ranked Intervention Engine**: Scores recommendations based on revenue impact, confidence, and urgency.
-   **Sales Intelligence**: A comprehensive dashboard with sales funnel analytics, conversion rates, bottleneck detection, Data Quality Score, Stale Leads recovery, operational follow-up tracking, and a refined Sales Health Score.
-   **Lead Pipeline**: A CRM-style Kanban board for managing leads through 5 stages, supporting creation, transitions, and automatic record generation.
-   **Resources Library**: A curated collection of gym operations playbooks organized by category.
-   **AI Operator**: A workflow assistant generating action plans, outreach drafts, and playbooks based on Iron Metrics signals. It features tiered context, prompt injection protection, a computed confidence engine, output risk filtering, and rate limiting. It integrates with a Quantified Impact Engine to project revenue impact for tasks and provides an Active Tasks Dashboard.
-   **Billing Intelligence**: Tracks member payments, collection schedules, and provides a summary of expected, collected, pending, and overdue payments.
-   **Attendance-Based Disengagement Detection**: Identifies at-risk members using attendance data.
-   **Robust Data Ingestion System**: A multi-step CSV import wizard for members and leads, with auto-detection, validation, and deduplication.
-   **Wodify Integration**: Direct API connection for data synchronization.
-   **Demo Mode**: Allows unauthenticated users to explore the app with sample data in read-only mode.

### Multi-User Gym Access (Authorization Model)
The system supports `owner`, `admin`, and `coach` roles, managed via a `gym_staff` table. `owner` has full access, `admin` has read/write data access (excluding billing/settings/exports with PII), and `coach` has read-only access (can view all data, export aggregate metrics/reports, log member contacts). Access is granted based on `gym.ownerId` (always resolves to "owner" first) or `gym_staff` role. Fine-grained permissions are enforced at the route level for all mutating operations. Export permissions: billing export is owner-only, member/lead exports are owner+admin only, report/metrics exports are available to all roles. Knowledge base mutating routes (create/delete sources, ingest, seed) are restricted to platform admins via `PLATFORM_ADMIN_IDS` env var (defaults to user ID `54700016`).

### Production Readiness & Security
Security headers are implemented via `helmet`. API rate limiting is applied globally and specifically for the AI Operator. Tenant isolation is ensured through ownership validation. A health endpoint monitors database connectivity. Error handling includes database pool error listeners and a global React ErrorBoundary. Stripe integration manages subscriptions with a 14-day free trial. The application includes an onboarding wizard, legal pages, and data export functionalities.

### Intelligence Philosophy
All insights are presented as Iron Metrics intelligence, embedding coaching concepts. Strategic briefs are limited to the top 3 ranked recommendations, focusing on distinct execution categories with concise checklists and action items, using direct, gym-owner-friendly language. Recommendations align with improving financial stability, retention clarity, reducing owner stress, and strengthening community longevity.

## External Dependencies
-   **Supabase Auth**: User authentication (email/password, JWT tokens, password reset, invite-by-email).
-   **PostgreSQL**: Primary database.
-   **Stripe**: Payment processing for SaaS subscriptions.
-   **Wodify**: Third-party gym management platform integration.
-   **Tailwind CSS**: Utility-first CSS framework.
-   **shadcn/ui**: UI component library.
-   **Recharts**: React charting library.
-   **Vite**: Frontend build tool.
-   **Express.js**: Backend web application framework.
-   **Drizzle ORM**: TypeScript ORM.
-   **wouter**: React routing library.
-   **helmet**: Security headers middleware.
-   **express-rate-limit**: API rate limiting.
