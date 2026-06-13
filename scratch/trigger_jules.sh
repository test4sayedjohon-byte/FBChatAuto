#!/bin/bash
# Load .env if it exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

if [ -z "$JULES_API_KEY" ]; then
  echo "Error: JULES_API_KEY is not set. Add 'JULES_API_KEY=your_key' to your .env file."
  exit 1
fi

PROMPT="$1"
if [ -z "$PROMPT" ]; then
  echo "Usage: ./scratch/trigger_jules.sh \"Your prompt here (e.g. 'audit security')\""
  exit 1
fi

echo "🚀 Starting Jules session..."
RESPONSE=$(curl -s 'https://jules.googleapis.com/v1alpha/sessions' \
    -X POST \
    -H "Content-Type: application/json" \
    -H "X-Goog-Api-Key: $JULES_API_KEY" \
    -d "{
      \"prompt\": \"$PROMPT\",
      \"sourceContext\": {
        \"source\": \"sources/github/test4sayedjohon-byte/FBChatAuto\",
        \"githubRepoContext\": {
          \"startingBranch\": \"main\"
        }
      },
      \"automationMode\": \"AUTO_CREATE_PR\",
      \"requirePlanApproval\": false,
      \"title\": \"Jules Audit & Fix\"
    }")

echo "Jules Response: $RESPONSE"
