---
description: Comprehensive architecture, authorization, and coding guidelines for StoryBabe
always_on: true
---

# StoryBabe Architecture and Development Rules

## Core Platform Identity
StoryBabe is a peer storytelling community where users share real, personal experiences as text stories (not fiction, advice, or commercial publishing). Stories can be Single (one-shot) or Series (Season/Episode structure).

## Strict Coding Constraints
1. No Emojis in Code: Never use emoji characters directly inside source code, JSX strings, backend logs, or templates. Use SVG icons from `lucide-react` for UI icons.
2. Mandatory Authentication: The platform is private and auth-gated. All visitors must be authenticated before accessing the feed, story studio, and profile.
3. Database Migrations: Use `PRAGMA table_info(stories)` before executing `ALTER TABLE` in SQLite.
4. Identity Cooldown Rules: Authors have 1 free username change, followed by a strict 30-day cooldown period.

## Microservices Architecture
- Gateway (:4000) -> Reverse proxy, JWT verification, rate limiting.
- Auth Service (:4001) -> User management, JWT tokens, username cooldowns.
- Story Service (:4002) -> Stories, episodes, poster generator studio, active authors.
- Social Service (:4003) -> Comments, likes, bookmarks, follows.
- Moderation Service (:4004) -> Safety desk triage, prioritized reports, actions.
- Worker Service (:4005) -> Inactivity scans (60+ days), background jobs.
- Web (:3000) -> Next.js 14 frontend with vanilla CSS design system.

## Poster Studio & OpenRouter Integration
- Endpoint `POST /stories/suggest-prompt`: Extracts emotional essence and creates visual prompt for 35mm film scene.
- Endpoint `POST /stories/generate-poster`: Generates 4:5 vertical posters using OpenRouter Image API (`black-forest-labs/flux-1-schnell`), converting output to durable Base64 data URIs stored in the `posterUrl` column.
