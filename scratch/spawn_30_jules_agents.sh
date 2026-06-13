#!/bin/bash
# Load .env if it exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

if [ -z "$JULES_API_KEY" ]; then
  echo "Error: JULES_API_KEY is not set. Add 'JULES_API_KEY=your_key' to your .env file."
  exit 1
fi

REPO="test4sayedjohon-byte/FBChatAuto"

# 10 UI/UX Tasks
UI_PROMPTS=(
  "Merge Dashboard and Credits area. Create a beautiful credit/tier card directly inside the main Dashboard layout. Loop: 1) Design layout, 2) Critique for clutter, 3) Implement polished React code."
  "Consolidate Content Monitoring and Messenger Inbox into a single split-pane reactive layout. Loop: 1) Create interface, 2) Critique usability/mobile, 3) Write final component."
  "Audit the Content Calendar page for dark mode aesthetics, checking color contrast, button states, and font hierarchy. Loop: 1) Scan CSS, 2) Critique contrast/spacing, 3) Refactor variables."
  "Add micro-animations, hover transitions, and progress loaders to all forms, tabs, and bulk actions. Loop: 1) Write CSS animations, 2) Critique performance, 3) Finalize."
  "Refactor Page Connections setup into a step-by-step wizard to guide users through the BYOA setup. Loop: 1) Design wizard steps, 2) Critique flow clarity, 3) Implement code."
  "Add responsive toast notifications and undo confirmation bars for all bulk operations. Loop: 1) Build hooks, 2) Critique visual timing, 3) Implement frontend."
  "Improve mobile responsiveness of side navigation and data table dashboards. Loop: 1) Check CSS media queries, 2) Critique mobile layout, 3) Refactor grid styles."
  "Implement a drag-and-drop file/image upload widget for the Super User prompt control. Loop: 1) Code drag-and-drop, 2) Critique error scenarios, 3) Finalize UI."
  "Optimize all modal dialogs to use native HTML5 popover/dialog API for clean DOM structures. Loop: 1) Replace dialog libs, 2) Critique focus states, 3) Complete code."
  "Add custom skeleton loading screens to all dashboard sub-pages to prevent layout shift. Loop: 1) Write skeleton UI, 2) Critique shift metrics, 3) Merge changes."
)

# 10 Security Tasks
SECURITY_PROMPTS=(
  "Audit Cloudflare Worker webhook signature verification (HMAC SHA-256) using tenant App Secrets. Loop: 1) Inspect crypto hooks, 2) Critique timing attacks, 3) Harden worker code."
  "Verify Supabase RLS (Row Level Security) policies on all tables to guarantee multi-tenant isolation. Loop: 1) Scan SQL rules, 2) Critique leaks, 3) Harden DDL scripts."
  "Sanitize and validate all webhook JSON payloads against XSS and SQL injection. Loop: 1) Implement validator, 2) Critique edge cases, 3) Merge validation layer."
  "Secure the Super User API routes to ensure only authenticated Super Admins can edit system prompts. Loop: 1) Check session tokens, 2) Critique bypass holes, 3) Secure endpoints."
  "Encrypt Facebook Access Tokens and secrets in the database. Loop: 1) Design encryption method, 2) Critique key safety, 3) Implement DB encrypt hooks."
  "Audit frontend state management for sensitive token leakages (localStorage/global state). Loop: 1) Audit token storage, 2) Critique security risk, 3) Refactor to safe cookies."
  "Implement strict Rate Limiting on the Cloudflare Worker webhook endpoints to prevent DoS. Loop: 1) Write rate-limiter, 2) Critique limits, 3) Finalize code."
  "Harden callback routes and protect against CSRF attacks in dashboard OAuth flows. Loop: 1) Audit state parameters, 2) Critique vulnerabilities, 3) Add token defenses."
  "Scan package dependencies for high/critical security CVEs and upgrade vulnerable packages. Loop: 1) Audit package.json, 2) Critique upgrade compatibility, 3) Deploy fixes."
  "Ensure complete SQL Injection protection across all raw database queries in the worker. Loop: 1) Scan raw queries, 2) Critique parameters, 3) Rewrite as parameterized SQL."
)

# 10 Feature Tasks
FEATURE_PROMPTS=(
  "Implement token-efficient session context retrieval, summarizing old chats dynamically. Loop: 1) Code summarizer, 2) Critique token savings, 3) Integrate with LLM router."
  "Build Cloudflare Worker Cron handler to schedule and post items automatically at user-defined hours. Loop: 1) Code scheduler, 2) Critique cron scaling, 3) Finalize."
  "Integrate auto-retry fallback mechanisms for OpenRouter and OpenAI API timeouts. Loop: 1) Code backoff logic, 2) Critique failure modes, 3) Deploy retries."
  "Add auto-tagging of conversations (e.g. Lead, Support) using AI intent classification. Loop: 1) Write prompt classifier, 2) Critique accuracy, 3) Save tags to DB."
  "Implement sequential content generation logic to create coherent multi-part post series. Loop: 1) Code context chain, 2) Critique coherence, 3) Implement database storage."
  "Add support for dynamic image generation using Flux/Banana models. Loop: 1) Add API client, 2) Critique prompt quality, 3) Store generated URLs."
  "Build a super admin usage dashboard showing active tenants, total messages, and model costs. Loop: 1) Query database stats, 2) Critique chart layouts, 3) Implement UI."
  "Implement bulk actions (Approve, Reschedule, Delete, Edit) on the Content Calendar page. Loop: 1) Write DB bulk commands, 2) Critique concurrency/race conditions, 3) Implement UI."
  "Research and add support for multiple bot personality profiles (Professional, Friendly). Loop: 1) Define system profiles, 2) Critique bot responses, 3) Add profile selector."
  "Implement a complete Undo history stack for content calendar updates. Loop: 1) Design undo log table, 2) Critique rollback reliability, 3) Add frontend undo buttons."
)

trigger_session() {
  local prompt="$1"
  local title="$2"
  
  curl -s 'https://jules.googleapis.com/v1alpha/sessions' \
      -X POST \
      -H "Content-Type: application/json" \
      -H "X-Goog-Api-Key: $JULES_API_KEY" \
      -d "{
        \"prompt\": \"$prompt\",
        \"sourceContext\": {
          \"source\": \"sources/github/$REPO\",
          \"githubRepoContext\": {
            \"startingBranch\": \"master\"
          }
        },
        \"automationMode\": \"AUTO_CREATE_PR\",
        \"requirePlanApproval\": false,
        \"title\": \"$title\"
      }"
}

echo "🔮 Spawning 10 UI/UX Agents..."
for i in "${!UI_PROMPTS[@]}"; do
  trigger_session "${UI_PROMPTS[$i]}" "UI Agent $((i+1))"
  sleep 1
done

echo "🔒 Spawning 10 Security Agents..."
for i in "${!SECURITY_PROMPTS[@]}"; do
  trigger_session "${SECURITY_PROMPTS[$i]}" "Security Agent $((i+1))"
  sleep 1
done

echo "⚡ Spawning 10 Feature Agents..."
for i in "${!FEATURE_PROMPTS[@]}"; do
  trigger_session "${FEATURE_PROMPTS[$i]}" "Feature Agent $((i+1))"
  sleep 1
done

echo "✅ All 30 Jules Agents triggered successfully!"
