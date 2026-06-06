# Connecting Meta Channels (Facebook & Instagram)
**AutometaBot - Multi-Tenant AI Automation**

This guide outlines the complete, step-by-step process for a Tenant (User) to connect their Facebook and Instagram Pages to their AutometaBot account. AI Agents can use this document to guide users through the setup process or debug webhook issues.

## Architecture Overview
AutometaBot uses a "Bring Your Own App" (BYOA) architecture for maximum multi-tenant isolation. 
Each user creates their own Meta Developer App and connects it to the platform.
- **Webhook URL:** `https://metachat.junoverseai.com/webhook/{USER_ID}`
- **Verify Token:** A custom string defined by the user in the AutometaBot dashboard.
- **App Secret:** Sourced from the user's Meta App, saved in the AutometaBot dashboard. This is used by the backend to verify the cryptographic signature (`X-Hub-Signature-256`) of incoming messages to ensure they are legitimately from Facebook.

## Step-by-Step Setup Guide

### Phase 0: Meta Developer Account Registration
*Skip this if you already have a Meta Developer account.*
1. Go to the [Meta for Developers](https://developers.facebook.com/) portal.
2. Click **Log In** in the top right and sign in with your personal Facebook account.
3. Once logged in, click **Get Started** (or **My Apps**) in the top right corner.
4. Complete the registration wizard:
   - Accept the Meta Platform Terms and Developer Policies.
   - Verify your phone number via SMS.
   - Select your occupation/role (e.g., Developer, Product Manager, or Owner).
5. Upon completion, you will be redirected to your new Meta Apps Dashboard.

### Phase 1: Dashboard Configuration
1. Log into the AutometaBot Dashboard.
2. Navigate to **Meta App Settings**:
   - Look at the bottom-left corner of the dashboard where your profile/username is located.
   - Click the **Chevron Up (^) icon** next to your profile picture to open the user menu.
   - Click **Meta App Settings** in the popup menu.
3. Create a **Custom Verify Token** (e.g., a secure random string or password).
4. Keep this page open. You will need to copy the custom Webhook URL shown here and come back to paste your Meta App Secret.

### Phase 2: Meta Developer App Creation & Credential Retrieval
1. Go to the [Meta Developer Portal](https://developers.facebook.com/).
2. Click **Create App** -> Select **Other** -> Click **Next**.
3. Select **Business** as the app type (this is required to access the Messenger API for Pages) and click **Next**.
4. Set the app details:
   - **App Display Name**: E.g., `AutometaBot Integration`
   - **App Contact Email**: Your email.
   - Click **Create App** (you may be prompted to re-enter your Facebook password).
5. Once in your new App Dashboard, go to the left sidebar, click **App Settings** to expand it, and select **Basic**.
6. **Save Credentials for Quick Reference:**
   - Copy the **App ID** (located at the top of the page).
   - Find the **App Secret** field, click **Show**, enter your password, and copy the App Secret.
   - Paste both the **App ID** and **App Secret** into a Notepad/Text Editor file on your computer for easy access later.
7. **Important Requirements for Later (Making App Live):**
   - In the same **Basic Settings** page, you must fill in the **Privacy Policy URL** (e.g., `https://autometabot.com/privacy`) and **Terms of Service URL** (e.g., `https://autometabot.com/terms`).
   - Select a Category (e.g., "Business and Pages").
   - Click **Save changes** at the bottom.
8. Go back to your AutometaBot dashboard (under settings), paste the new App Secret into the field, and click **Save App Settings**.

### Phase 3: Webhook Configuration & Page Subscriptions
1. In the Meta Developer Portal, scroll down to "Add a Product" and set up **Messenger**.
2. Under **Messenger > Settings** (or **Messenger API Settings**), scroll to the **Webhooks** (Configure Webhooks) section and click **Add Callback URL** (or **Configure**).
3. Paste the Webhook URL and Custom Verify Token, then click **Verify and Save**.
4. Go to the **Generate Access Tokens** section (right below Webhooks):
   - Click **Connect** (or **Add Page**).
   - Log in with your Facebook account and select the Pages you wish to link.
5. Once your page is listed, click the **Manage** / **Edit Subscription** button next to it.
6. A checklist of webhook fields will pop up. Check the boxes for:
   - `messages` (Required - triggers the AI for incoming customer messages)
   - `messaging_postbacks` (Required - triggers actions for button clicks/quick replies)
   - `message_echoes` (Recommended - alerts our server if you manually reply to a user directly from the Facebook Business Suite/Page Inbox, keeping the chat history synchronized)
   - `messaging_handovers` (Optional - used if implementing Meta's official Handover protocol between Page Inbox and our Bot)
7. Click **Confirm** to save the subscriptions.
8. Click the **Generate** button next to the connected Page to get your **Page Access Token**. Copy this token.

### Phase 4: Page Connection & Access Tokens
1. Still in the Meta Developer Portal (under Messenger > Settings > Access Tokens), click **Add or Remove Pages** (or use the Page generation list we configured in Phase 3).
2. Authenticate with Facebook and select the Facebook/Instagram pages you want the AI to manage.
3. Once linked, click **Generate Token** next to the connected page. Copy this long Page Access Token.
4. Copy the **Page ID** (available under the page name).
5. Go back to the AutometaBot Dashboard -> **Meta Channels** tab in the sidebar.
6. Click the orange **+ Connect FB/IG** button in the top right.
7. Paste the **Page ID**, type the **Page Name**, and paste the **Page Access Token**.
8. Click **Connect Page** to save the connection.

### Phase 5: Go Live
1. **Prepare Bot Settings & Content First:** Do not set the Meta App to live mode immediately. First, finish configuring your:
   - **System Prompts / Bot Settings**: Set your bot's behavior and personality.
   - **Documents & Knowledge Base**: Upload your business files and process them to train the bot.
   - *Tip:* You can use our specialized [AutometaBot Training Custom GPT](https://gemini.google.com/gem/1yHjGZWpGIn2qTRQkwhKWo85zyId-S2TW?usp=sharing) to easily format your business documents, rules, and system prompts!
2. **Perform Sandbox & Admin Testing:** Test the chatbot in Development Mode from your administrator/tester accounts to ensure responses are accurate.
3. **Turn App Live:** Once you are fully satisfied with the behavior:
   - In the Meta Developer Portal, go to **App Review** -> **Permissions and Features** and request advanced access for `pages_messaging`.
   - Switch the app toggle at the top of the Meta console from **Development** to **Live** mode.
4. **Control Directly From Dashboard:** Once the app is Live, you do not need to change Meta console settings to pause the chatbot. You can instantly turn the AI agent on or off using the **Enable/Disable** toggle buttons directly inside your AutometaBot Dashboard -> **Meta Channels** list.

---

## Troubleshooting Guide

- **Webhook fails to verify ("Validation Failed" or 500 / 403 error):** 
  - **Check Cloudflare Worker Secrets:** If the worker throws a **500 error**, it means the newly deployed Cloudflare Worker is missing its environment secrets (`SUPABASE_URL` and `SUPABASE_SERVICE_KEY`), causing it to crash when fetching user settings. Ensure you run `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_SERVICE_KEY` (and `FB_APP_SECRET`, `FB_VERIFY_TOKEN`) on the deployed worker.
  - Ensure the `fb_verify_token` saved in your AutometaBot dashboard perfectly matches what you pasted into Facebook.
  - Ensure the Cloudflare worker is running correctly at `metachat.junoverseai.com`.
  
- **Webhook verified, but bot doesn't reply:** 
  - Check if the `fb_app_secret` matches perfectly. If the signature validation fails in the Cloudflare worker, it silently drops the request to prevent malicious traffic.
  - Ensure you subscribed to the `messages` field in the webhook settings.
  - Ensure you connected the page in the AutometaBot dashboard with the correct Page Access Token.
  
- **Bot replies to you, but not to public customers:** 
  - The Meta App is still in Development mode or missing the advanced `pages_messaging` permission.


