# TG Subscription Bot - Prototype

This is a fasted prototype Telegram bot for managing paid subscriptions and course purchases.
It uses grammY, drizzle (Postgres), Redis for sessions/caching, zod for validation, pino for logging,
and local storage for screenshots.

See `.env.example` for environment variables.

Run locally:
1. Install dependencies: `npm install`
2. Fill `.env` (copy `.env.example`)
3. Run Postgres and Redis
4. Run: `npm run dev`


Если вам нужен этот бот как шаблон без лишних данных, обратитесь ко мне в ТГ @rmdanilov