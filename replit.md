# Iron Metrics

## Overview
Iron Metrics is a financial resilience operating system for CrossFit gyms, designed to stabilize revenue, improve member retention, reduce owner stress, and foster community longevity. It acts as a decision engine, focusing on retention as the core business driver, rather than just an analytics or reporting tool. The project aims to provide precise, actionable insights with a declarative, calm, and minimal tone.

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
The application features a dark steel/charcoal visual identity with a clean, neutral palette. It uses Inter, Libre Baskerville, and JetBrains Mono fonts. Red is used minimally for risk alerts. Border radii are consistently applied (0.625rem, 0.5rem, 0.375rem). The design is mobile-responsive and includes print-friendly CSS.

### Technical Implementations
The system is built with React, Vite, Tailwind CSS, shadcn/ui, and Recharts for the frontend, and Express.js with Drizzle ORM and PostgreSQL for the backend. Authentication is handled via Replit Auth (OpenID Connect), and routing uses wouter on the frontend and Express routes on the backend.

### Feature Specifications
Iron Metrics includes a Stability Command Center dashboard with key financial and retention metrics. Core modules include:
-   **Retention Stability Index (RSI)**: A composite score indicating financial health.
-   **Revenue Stability Panel**: Monitors churn, growth, and revenue per member.
-   **Member Risk Radar**: Predicts churn and prioritizes interventions.
-   **Lifetime Value Engine (LTVE)**: Calculates LTV and models revenue impact of churn changes.
-   **Predictive Intelligence Stack**: Provides member-level churn probability, cohort analysis, revenue scenarios, and strategic recommendations.
-   **Ranked Intervention Engine**: Mathematically scores recommendations based on expected revenue impact, confidence, and urgency, surfacing top priorities.
-   **Sales Intelligence**: Offers a dedicated page with sales funnel analytics, lead tracking, conversion rates, and bottleneck detection.
-   **Attendance-Based Disengagement Detection**: Identifies at-risk members using attendance data, with fallback to contact-based detection.
-   **Robust Data Ingestion System**: A multi-step CSV import wizard with intelligent column auto-detection, validation, and idempotent upsert.
-   **Wodify Integration**: Direct API connection for data synchronization, including backfill and incremental sync.

### Intelligence Philosophy
All insights are presented as Iron Metrics intelligence, embedding coaching concepts without external attribution. Strategic briefs are limited to the top 3 ranked recommendations, focusing on distinct execution categories with concise checklists and action items. Language is direct and gym-owner-friendly, avoiding jargon. Recommendations are validated against the project's core objectives: improving financial stability, retention clarity, reducing owner stress, and strengthening community longevity.

## External Dependencies
-   **Replit Auth**: For user authentication (OpenID Connect).
-   **PostgreSQL**: Primary database for all application data.
-   **Wodify**: Third-party gym management platform for attendance and membership data integration.
-   **Tailwind CSS**: Utility-first CSS framework.
-   **shadcn/ui**: UI component library.
-   **Recharts**: React charting library for data visualization.
-   **Vite**: Frontend build tool.
-   **Express.js**: Backend web application framework.
-   **Drizzle ORM**: TypeScript ORM for database interaction.
-   **wouter**: Small routing library for React.