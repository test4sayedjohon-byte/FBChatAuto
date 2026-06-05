# fbchatauto — Multi-Tenant AI Chatbot for Facebook Pages

A serverless, SaaS-style platform that automates Facebook Messenger conversations using RAG (Retrieval-Augmented Generation).

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│  Cloudflare Pages   │     │  Cloudflare Worker    │     │    Supabase      │
│  (React Dashboard)  │────▶│  (Hono.js Webhook)    │────▶│  (PostgreSQL +   │
│                     │     │                       │     │   pgvector)      │
└─────────────────────┘     └──────────┬────────────┘     └──────────────────┘
                                       │
                            ┌──────────▼────────────┐
                            │  Facebook Graph API   │
                            │  (Messenger Webhooks) │
                            └───────────────────────┘
```

## Project Structure

```
fbchatauto/
├── supabase/
│   └── schema.sql          # Database schema (tables, functions, RLS)
├── worker/                 # Cloudflare Worker (webhook handler)
│   ├── src/
│   │   ├── index.ts        # Main Hono.js app & routes
│   │   ├── types.ts        # TypeScript type definitions
│   │   ├── verify.ts       # Facebook signature verification
│   │   └── supabase.ts     # Supabase client & DB helpers
│   ├── wrangler.toml       # Worker configuration
│   ├── tsconfig.json
│   └── package.json
├── dashboard/              # (Phase 3) React frontend
└── README.md
```

## Development Phases

- [x] **Phase 1:** Database schema + Webhook foundation
- [ ] **Phase 2:** RAG pipeline + AI response logic
- [ ] **Phase 3:** Dashboard frontend

## Setup

### 1. Supabase
1. Create a new Supabase project
2. Enable the `pgvector` extension (Database → Extensions)
3. Run `supabase/schema.sql` in the SQL Editor

### 2. Cloudflare Worker
```bash
cd worker
npm install

# Set secrets
npx wrangler secret put FB_VERIFY_TOKEN
npx wrangler secret put FB_APP_SECRET
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_KEY

# Local development
npm run dev

# Deploy
npm run deploy
```

### 3. Facebook App
1. Create a Facebook App at [developers.facebook.com](https://developers.facebook.com)
2. Add the Messenger product
3. Set the webhook URL to your Worker URL + `/webhook`
4. Subscribe to `messages` and `messaging_postbacks` events
