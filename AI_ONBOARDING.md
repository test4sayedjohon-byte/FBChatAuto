# AutometaBot — AI Developer Onboarding Guide

Hello fellow AI Agent! If you have been provided this document, you are assisting a developer in managing, scaling, or troubleshooting **AutometaBot**, a Multi-Tenant Facebook Messenger AI automation platform.

This document contains the entire architectural context and setup process.

## 1. System Overview
AutometaBot is a multi-tenant SaaS platform where users can automate their Facebook Pages using AI (like OpenAI, OpenRouter, etc.). 
- **Frontend:** React + Vite (Dashboard)
- **Backend/Router:** Cloudflare Worker (Hono.js)
- **Database/Auth:** Supabase (PostgreSQL)

## 2. The BYOA (Bring Your Own App) Architecture
To completely bypass the restrictive and slow Facebook App Review process for SaaS applications, this platform utilizes a **Bring Your Own App (BYOA)** architecture. 

### How it works for Tenants (Users):
1. **No Central App:** The platform does NOT use a single central Facebook App.
2. **Tenant Setup:** Each tenant creates their own App in the Facebook Developer Portal and keeps it in **Development Mode** (which allows infinite messaging to their own pages without Facebook review).
3. **Unique Webhooks:** The Cloudflare worker routes traffic dynamically. Every tenant gets a unique webhook URL formatted as:
   `https://<WORKER_URL>/webhook/<USER_ID>`
4. **Secrets Management:** The tenant inputs their personal `fb_app_secret` and a custom `fb_verify_token` into the React Dashboard. These are saved into the Supabase `users` table under the `settings` JSONB column.
5. **Page Connections:** The tenant generates a "Page Access Token" in their Facebook Developer Portal and inputs it into the dashboard. It is saved in the `page_connections` table.

## 3. Cloudflare Worker Webhook Flow (`worker/src/index.ts`)
The Cloudflare Worker is the heart of the platform. It handles thousands of concurrent Facebook Webhooks securely.

1. **GET Verification:** Facebook sends a `GET /webhook/:userId` request. The worker extracts the `userId`, queries Supabase for the tenant's `fb_verify_token`, and if it matches, responds with the `hub.challenge`.
2. **POST Messaging:** Facebook sends a `POST /webhook/:userId`.
3. **Signature Verification:** The worker queries Supabase for the tenant's `fb_app_secret`. It hashes the raw request body with HMAC SHA-256 and compares it to the `X-Hub-Signature-256` header. If invalid, it returns `403 Forbidden`.
4. **Tenant Routing:** The worker checks the `page_connections` table to see if the recipient `page_id` is linked.
5. **AI Processing:** It fetches the AI provider assigned to the user, grabs the conversation history from the `sessions` and `messages` tables, and hits the LLM (e.g., OpenRouter).
6. **Graph API Reply:** It uses the tenant's stored `access_token` to send the AI's reply back to the Facebook Graph API (`/me/messages`).

## 4. Supabase Database Schema Context
- **`users`:** Stores tenant info, `is_super_admin` flags, and a `settings` JSONB column containing their Facebook App secrets and bot toggle status (`is_bot_active`).
- **`ai_providers`:** Stores API keys for LLMs. Super Admins can set `is_global = true` to share a provider across all tenants.
- **`page_connections`:** Maps a `page_id` to a `user_id` and stores the Facebook `access_token`. RLS ensures users can only insert/read their own pages.
- **`sessions` & `messages`:** Stores chat history for context injection into the AI.

## 5. Deployment & Setup Commands
If you need to re-deploy or configure the environment for the developer, use the following:

**1. Cloudflare Secrets (Platform Level):**
The worker requires the Supabase Service Role key to bypass RLS during webhook execution (since webhooks aren't authenticated by the frontend user).
```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_KEY
```

**2. Worker Deployment:**
```bash
npx wrangler deploy
```

**3. Tailing Live Logs:**
If a user says "the bot isn't replying", your first step should always be tailing the worker to see if Facebook is dropping the request due to signature mismatch or Development Mode restrictions.
```bash
npx wrangler tail
```

## 6. Common Troubleshooting for AI Agents
*   **"Error 404 on Webhook":** The user is using the legacy `/webhook` URL in Facebook. Tell them to use `/webhook/:userId`.
*   **"Invalid Signature":** The user updated their App Secret in Facebook but didn't update it in the React Dashboard. The worker is hashing with an old secret.
*   **"No Logs / Nothing Happens":** The user's Facebook App is in Development Mode, and they are messaging the page from an account that is NOT an App Tester or Admin. Facebook silently drops the webhook. Tell them to add the account as a Tester in the App Roles.
*   **"RLS Policy Violation on Page Insert":** The dashboard must explicitly include `user_id` in the Supabase `insert()` payload, otherwise Postgres rejects it.

---
*End of AI Context. You are now equipped to build upon this multi-tenant architecture!*
