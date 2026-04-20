# TrackMyContainer.ai

> Global sea container & air cargo tracking platform with WhatsApp alerts, Messenger bot, and paid dashboard.

## Tech Stack

| Layer          | Technology               |
|----------------|--------------------------|
| Framework      | Next.js 15 (App Router)  |
| Language       | TypeScript               |
| Database       | PostgreSQL (Supabase)    |
| ORM            | Prisma                   |
| Auth           | NextAuth.js v5           |
| Payments       | Stripe                   |
| Queue          | BullMQ + Redis (Upstash) |
| WhatsApp       | Twilio                   |
| Messenger      | Meta Graph API           |
| Hosting        | Vercel + Railway (worker)|
| Email          | Resend                   |

## Brand Colors

| Name    | Hex       | Usage                             |
|---------|-----------|-----------------------------------|
| Navy    | `#1B2B5E` | Primary — headings, sidebar, text |
| Orange  | `#F5821F` | Accent — ".ai", CTA, air freight  |
| Teal    | `#00B4C4` | Secondary — sea freight, accents  |

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env.local
# Fill in all values
```

### 3. Set up database
```bash
npx prisma migrate dev --name init
npx prisma db seed
```

### 4. Set up Stripe products (run once)
```bash
npx tsx scripts/setup-stripe-products.ts
# Copy price IDs back into .env.local
```

### 5. Run development server
```bash
npm run dev
```

### 6. Run background worker (separate terminal)
```bash
npm run worker
```

## Data Sources

| Provider      | Type | Cost          | Coverage         |
|---------------|------|---------------|------------------|
| Shipsgo       | Sea  | ~$2/shipment  | 160+ carriers    |
| Maersk API    | Sea  | Free          | Maersk containers|
| TimeToCargo   | Sea  | Free          | 100+ lines       |
| AirRates      | Air  | ~$100-200/mo  | 75+ airlines     |
| TrackCargo    | Air  | Free          | 75+ airlines     |

## Subscription Plans

| Plan     | Price   | Tracked Shipments | WhatsApp | API   |
|----------|---------|-------------------|----------|-------|
| Free     | $0/mo   | Lookup only       | No       | No    |
| Pro      | $29/mo  | 50                | Yes      | No    |
| Business | $99/mo  | Unlimited         | Yes      | Yes   |

## WhatsApp Templates (requires Meta approval)

1. `ETA_IMMINENT` — Shipment arriving in 3 days
2. `DELAY_ALERT` — Shipment delayed
3. `ARRIVAL_NOTICE` — Shipment arrived
4. `STATUS_CHANGE` — General status update
5. `CUSTOMS_HOLD` — Customs hold alert

## Architecture

```
Next.js App (Vercel)
  ├── /track                    Free tier
  ├── /dashboard                Paid tier
  ├── /api/track                Public tracking API
  ├── /api/webhooks/stripe      Subscription sync
  ├── /api/webhooks/twilio      WhatsApp incoming
  └── /api/messenger            Messenger bot

BullMQ Worker (Railway/Render)
  ├── tracking-poll             Poll APIs every 6h
  └── notification-send         Route WhatsApp/email

External APIs
  ├── Shipsgo (sea freight)
  ├── Maersk Developer (free)
  └── AirRates (air freight)
```

## Deployment

1. **Vercel** — connect GitHub repo, set env vars, deploy
2. **Railway/Render** — deploy `worker/index.ts` as a background service
3. **Supabase** — create production PostgreSQL database
4. **Upstash** — create Redis instance for caching + BullMQ
5. **Stripe** — switch to live mode keys
6. **Twilio** — provision WhatsApp Business number, get templates approved
