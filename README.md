# Threads Account Dashboard

A Next.js dashboard for managing multiple Instagram Threads accounts: link accounts, publish or schedule posts, and track engagement analytics — all through the official [Threads API](https://developers.facebook.com/docs/threads).

## Features

- **Multi-account linking** — connect any number of Threads accounts via OAuth and switch between them.
- **Compose & publish** — post text content immediately or schedule it for later.
- **Scheduled publishing** — scheduled posts are picked up by a cron-triggered endpoint.
- **Analytics** — pull views/likes/replies/reposts/follower insights per account and chart trends over time.

## Tech stack

- Next.js 16 (App Router, TypeScript, Tailwind CSS)
- Prisma 7 + PostgreSQL (via the `@prisma/adapter-pg` driver adapter)
- Recharts for analytics charts

## Setup

### 1. Create a Meta App with Threads API access

1. Go to the [Meta for Developers](https://developers.facebook.com/apps) console and create an app (type: "Other" → "Business").
2. Add the **Threads API** product to the app.
3. Under the Threads API settings, add an OAuth redirect URI matching `THREADS_REDIRECT_URI` below (e.g. `http://localhost:3000/api/auth/threads/callback` for local dev).
4. Note your **App ID** and **App Secret** from the app's Basic Settings.
5. Add the Threads accounts you want to manage as testers/users of the app while it's in development mode (required until the app passes App Review for the `threads_basic`, `threads_content_publish`, `threads_manage_insights`, `threads_manage_replies`, and `threads_read_replies` scopes).

### 2. Configure environment variables

Copy `.env.example` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (e.g. from Prisma Postgres, Neon, Supabase, or Vercel Postgres) |
| `THREADS_APP_ID` | Meta App ID |
| `THREADS_APP_SECRET` | Meta App Secret |
| `THREADS_REDIRECT_URI` | Must exactly match the redirect URI configured in the Meta App |
| `CRON_SECRET` | Shared secret required (as `Authorization: Bearer <secret>`) to call `/api/cron/publish-due` |
| `NEXT_PUBLIC_APP_URL` | Base URL of the deployed app |

### 3. Install dependencies and set up the database

Point `DATABASE_URL` at a Postgres database (a free one from [Prisma Postgres](https://console.prisma.io) works well), then:

```bash
npm install
npx prisma migrate dev
```

### 4. Run the dev server

```bash
npm run dev
```

Visit `http://localhost:3000/dashboard`, go to **Accounts**, and click **Link Threads account** to connect your first account.

## Quick deploy to Vercel

`scripts/deploy-to-vercel.ps1` provisions a free Prisma Postgres database and deploys this app to Vercel end-to-end, so you can click through the live pages before wiring up a real Meta App. Run it from a local clone of this repo (requires Node.js and the [Vercel CLI](https://vercel.com/docs/cli) — the script invokes it via `npx`, no separate install needed):

```powershell
.\scripts\deploy-to-vercel.ps1 -PrismaServiceToken "<prisma console service token>" -VercelToken "<vercel account token>"
```

- Get a Prisma service token: [console.prisma.io](https://console.prisma.io) → Workspace Settings → Service Tokens.
- Get a Vercel token: [vercel.com/account/tokens](https://vercel.com/account/tokens).

The script prints the deployed URL when done. `THREADS_APP_ID` / `THREADS_APP_SECRET` are left unset until you have a Meta App — the OAuth linking flow will error until then, but every other page and CRUD flow works. See the script's own `-?`/comment-based help for what each step does.

## Scheduled posts

Scheduled posts are stored with `status = SCHEDULED` and a `scheduledFor` timestamp. Nothing publishes them automatically — you need an external scheduler (e.g. [Vercel Cron](https://vercel.com/docs/cron-jobs), GitHub Actions, or any cron service) to call:

```
POST /api/cron/publish-due
Authorization: Bearer <CRON_SECRET>
```

on a regular interval (e.g. every minute). It publishes any due posts and marks them `PUBLISHED` or `FAILED`.

## Project structure

```
prisma/schema.prisma          Account / Post / AnalyticsSnapshot models
src/lib/threads.ts             Threads API client (OAuth, publishing, insights)
src/lib/prisma.ts              Prisma client singleton (pg adapter)
src/app/api/auth/threads/      OAuth start + callback routes
src/app/api/accounts/          Account CRUD
src/app/api/posts/             Post creation, listing, cancellation
src/app/api/cron/publish-due/  Publishes due scheduled posts
src/app/api/analytics/[id]/    Fetch/refresh insight snapshots
src/app/dashboard/             Dashboard UI (overview, accounts, compose, analytics)
```
