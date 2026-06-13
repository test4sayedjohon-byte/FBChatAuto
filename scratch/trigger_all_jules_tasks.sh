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

# List of prompts covering all the fixes and features discussed
PROMPTS=(
  "Perform a deep audit of the codebase for performance, token efficiency, and security bottlenecks. Specifically check the Cloudflare Worker webhook signature verification and RLS database policies, refactor code into separate files, and optimize token usage."
  "Implement backend and database logic for the content calendar including bulk selection, bulk delete, bulk undo actions, sequential content creation (generating batches of 5-10 posts with sequential delays), and configurable post frequency (once/twice/three times daily starting at custom hours)."
  "Build a new dedicated Dashboard page for the Content Creator/Calendar AI Agent instead of using a popup. Add visual selectors for start/end dates, post frequency (daily/weekly/monthly), twice/three times daily times selectors, bulk selection check-boxes, and undo buttons. Follow premium dark mode design aesthetics."
  "Add a Super User control panel in the dashboard to set system prompts, blocks of content ideation prompts, and product/image prompts. Ensure the batch generation logic integrates these system prompts and product assets to generate image prompts automatically."
)

for i in "${!PROMPTS[@]}"; do
  PROMPT="${PROMPTS[$i]}"
  TITLE="Jules Feature Task $((i+1))"
  echo "🚀 Triggering Jules task $((i+1)): $TITLE..."
  
  RESPONSE=$(curl -s 'https://jules.googleapis.com/v1alpha/sessions' \
      -X POST \
      -H "Content-Type: application/json" \
      -H "X-Goog-Api-Key: $JULES_API_KEY" \
      -d "{
        \"prompt\": \"$PROMPT\",
        \"sourceContext\": {
          \"source\": \"sources/github/$REPO\",
          \"githubRepoContext\": {
            \"startingBranch\": \"master\"
          }
        },
        \"automationMode\": \"AUTO_CREATE_PR\",
        \"requirePlanApproval\": false,
        \"title\": \"$TITLE\"
      }")
      
  echo "Response: $RESPONSE"
  echo "------------------------------------------------"
  sleep 2 # Pause between requests
done
