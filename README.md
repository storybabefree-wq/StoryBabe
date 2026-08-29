# StoryBabe

StoryBabe is a peer storytelling community where people share authentic, real personal experiences as text stories (not fiction, advice, or commercial publishing). Stories can be Single (one-shot) or Series (structured as Season/Episode).

## Architecture Overview

StoryBabe is built as a distributed microservices monorepo with an API Gateway and Next.js frontend:

- **Gateway (:4000)**: Central reverse proxy with JWT authentication, security headers (Helmet), and rate limiting.
- **Auth Service (:4001)**: User identity, registration, login, private email protection, and username change cooldowns (1 free change, then 30-day cooldown).
- **Story Service (:4002)**: Story creation, episode management, OpenRouter image poster generator studio, active authors reels, and tag discovery.
- **Social Service (:4003)**: Comments, likes (resonance), bookmarks, and author follow graphs.
- **Moderation Service (:4004)**: Safety Desk triage, prioritized reports for non-consensual identification, and content action auditing.
- **Worker Service (:4005)**: Inactivity background worker (tags series with no updates for 60+ days without penalty).
- **Web App (:3000)**: Next.js 14 frontend with vanilla CSS design system, Instagram-style infinite progressive feed, fullscreen story reels, and interactive AI prompt studio.

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, SQLite (node:sqlite / @storybabe/database)
- **Frontend**: Next.js 14 (App Router), React, Vanilla CSS, Lucide React
- **AI Integration**: OpenRouter Image Generation API (FLUX.1 Schnell / Stable Diffusion) with Base64 inline persistence and curated fallbacks.
- **Monorepo Tooling**: Bun / npm workspaces, TypeScript Project References

## Quick Start

### 1. Install Dependencies
```bash
npm install
# or
bun install
```

### 2. Build TypeScript Packages
```bash
node ./node_modules/typescript/bin/tsc -b packages/types packages/security packages/database services/auth services/story services/social services/moderation services/worker apps/gateway
```

### 3. Run Development Stack
```bash
node scripts/dev.mjs
```

### 4. Run Automated End-to-End Test Suite
```bash
node --test tests/e2e.test.mjs
```

## Key Product Rules

1. **Identity & Auth**:
   - Username is unique. 1 free change is granted, after which a 30-day cooldown applies.
   - Private email is used strictly for authentication and recovery, never publicly visible.
   - The platform is auth-gated; visitors must sign in or create an account.

2. **Story Formats**:
   - Single: One-shot complete experience.
   - Series: Multi-part journey structured in Seasons and Episodes.

3. **Safety & Crisis Support**:
   - Content warnings and crisis resources (988 Lifeline, 741741 Crisis Text Line) are accessible on-demand via a discrete support button and three-dots menu.
   - Priority review queue for non-consensual identification reports.
