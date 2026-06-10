# Connecting Meta Channels (Facebook & Instagram)
**AutometaBot - Multi-Tenant AI Automation**

This guide outlines the complete, step-by-step process for a Tenant (User) to connect their Facebook and Instagram Pages to their AutometaBot account. AI Agents can use this document to guide users through the setup process or debug webhook issues.

## Architecture Overview
AutometaBot uses a "Bring Your Own App" (BYOA) architecture for maximum multi-tenant isolation. 
Each user creates their own Meta Developer App and connects it to the platform.
- **Webhook URL:** `https://metachat.junoverseai.com/webhook/{USER_ID}`
- **Verify Token:** A custom string defined by the user in the AutometaBot dashboard.
- **App Secret:** Sourced from the user's Meta App, saved in the AutometaBot dashboard. This is used by the backend to verify the cryptographic signature (`X-Hub-Signature-256`) of incoming messages to ensure they are legitimately from Facebook.

## Required Token Permissions
Before connecting your channels, you must ensure that the generated Meta Access Tokens have the correct permissions. Missing permissions will cause posting or messaging automation to fail.

### Facebook & Instagram Pages (Page Access Token)
Your Page token must be generated with the following scopes (select **all** of these at once in the Explorer to prevent having to regenerate):
* **`pages_read_engagement`** (Required to read page info, test connectivity, and read posts/comments)
* **`pages_manage_posts`** (Required to publish scheduled feed posts on your page)
* **`pages_manage_engagement`** (Required to write/publish automated first comments and replies)
* **`pages_messaging`** (Required for chatbot automated messaging/DMs)
* **`pages_show_list`** (Required to discover pages linked to your account)
* **`pages_manage_metadata`** (Required for Comment Auto-Moderation; allows the app to subscribe the Page to `feed` and comment webhook events)
* **`read_page_mailboxes`** (Required to read inbox messages)
* **`instagram_basic`** (Required for Instagram channel integration)
* **`instagram_manage_messages`** (Required for Instagram DM/chat chatbot automation)
* **`instagram_manage_comments`** (Required for Instagram comment/reply automation)
* **`instagram_content_publish`** (Required to publish scheduled posts on Instagram)

### WhatsApp Business (System User Access Token)
Your System User token must be generated in Meta Business Manager with:
* **`whatsapp_business_messaging`** (Required to send automated WhatsApp messages/templates)
* **`whatsapp_business_management`** (Required to query phone number and WABA status)

---

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
7. **Important Requirements (Required to make the App Live later):**
   - In the same **Basic Settings** page, you **MUST** fill in the **Privacy Policy URL** and **Terms of Service URL** (e.g., `https://autometabot.com/privacy` and `https://autometabot.com/terms`).
   - *Tip:* Fill these in now so you don't get blocked when switching to Live mode later. If you don't have privacy/terms pages set up yet, you can temporarily copy and paste the Privacy and Terms links from another public website, though using your own domain's links is best practice.
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
   - `feed` (Required for FB Comment Automation - triggers the AI for page comments and feed posts)
   - `messaging_handovers` (Optional - used if implementing Meta's official Handover protocol between Page Inbox and our Bot)
7. Click **Confirm** to save the subscriptions.
   
> [!IMPORTANT]
> **Webhook Field Order Order:** You must subscribe to the `feed` and `messages` fields in the App Dashboard **before** connecting the Page in the AutometaBot dashboard. 
> If you turned them on in the developer portal *after* connecting your page, you **must disconnect and reconnect your Page** in the dashboard so that Facebook registers the new webhook fields for the Page.

8. **For Instagram Automation:**
   - In the Meta Developer Portal, go to the left sidebar, click **Webhooks** (under Products).
   - In the dropdown list at the top, select **Instagram**.
   - Click **Subscribe to this object** and subscribe to the `comments` field (for Instagram comment automation) and `messages` / `messaging_postbacks` (for Instagram DMs/chat automation).
   - Ensure the verify token and webhook URL match what was set up in Messenger.
9. Click the **Generate** button next to the connected Page to get your **Page Access Token**. Copy this token.

### Phase 4: Page Connection & Access Tokens

> [!IMPORTANT]
> **Understanding Token Types (Crucial for Chatbot Delivery):**
> * **User Access Token / System User Token:** Represents *you* as a person or system user. It cannot send messages on behalf of a Page. Do not save this in the chatbot database.
> * **Page Access Token:** Represents the *Facebook Page* itself. This token authorizes the chatbot to send messages, reply to comments, and post updates on behalf of your Page. This is the token you must save in the database.

> [!WARNING]
> **STRICT REQUIREMENT — TOKEN EXTENSION:**
> By default, standard Page Access Tokens generated by Facebook expire in **1 to 2 hours**. If you do not follow Step 3 below to extend the token, your chatbot and comment auto-moderation **will stop working** shortly after configuration. 
> You **must** extend the token using the [Meta Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/) to get a permanent token that never expires.

To get a **Permanent (Long-Lived) Page Access Token** that never expires and has all the necessary permissions, follow these steps:

#### Step 1: Generate a User Token with Scopes
1. Open the [Meta Graph API Explorer](https://developers.facebook.com/tools/explorer/).
2. Select your App (**PhoneFarmingConnect**) in the **Meta App** dropdown on the right.
3. In the **User or Page** dropdown, select **User Token**.
4. In the **Permissions** search box, add **all** of the following permissions (this covers both Facebook and Instagram at once):
   * `pages_show_list`
   * `pages_messaging`
   * `pages_read_engagement`
   * `pages_manage_posts`
   * `pages_manage_engagement`
   * `pages_manage_metadata`
   * `read_page_mailboxes`
   * `instagram_basic`
   * `instagram_manage_messages`
   * `instagram_manage_comments`
   * `instagram_content_publish`
5. Click the blue **Generate Access Token** button. Log in and authorize all selected permissions for your Pages.

#### Step 2: Extract the Page Access Token
1. After authorization, go back to the **User or Page** dropdown in the Graph API Explorer.
2. Select your target Facebook Page (e.g., **Phone Farming Bangladesh**).
3. The explorer will automatically swap the token in the **Access Token** field to a Page-specific token.
4. Copy this token.

#### Step 3: Make the Token Permanent (Long-Lived)
1. Go to the [Meta Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/).
2. Paste the copied Page Access Token into the box and click **Debug**.
3. Scroll to the bottom of the details page and click the blue **Extend Access Token** button.
4. Copy the resulting extended token. This token will **never expire** (it will say `Expires: Never` or `Expires: Keep Alive`).

#### Step 4: Connect the Page to AutometaBot
1. Copy the **Page ID** of your Facebook Page.
2. Go to your AutometaBot Dashboard -> **Meta Channels** tab in the sidebar.
3. Click the orange **+ Connect FB/IG** button in the top right.
4. Paste the **Page ID**, type the **Page Name**, and paste the **Extended Page Access Token** you copied in Step 3.
5. Click **Connect Page** to save. Your chatbot is now active with a permanent, fully authorized connection!

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

## WhatsApp Connection Guide

Connecting WhatsApp Business Cloud API requires setting up the WhatsApp product in your Meta Developer App.

### Step 1: Add WhatsApp to Meta App
1. Go to the [Meta Developer Portal](https://developers.facebook.com/) and click on your App.
2. Scroll down on the left sidebar to **Add Product** -> Find **WhatsApp** -> Click **Set Up**.
3. Meta will automatically link/create a WhatsApp Business Account.

### Step 2: Retrieve IDs & Sandbox Testing
1. In the sidebar, expand **WhatsApp** and click **Step 1. Try it out**.
2. **Retrieve Credentials:**
   - Copy the **Phone Number ID** (e.g., from the text box).
   - Copy the **WhatsApp Business Account ID** (e.g., from the text box next to it).
3. **Generate Temporary Token:**
   - Click the blue **Generate token** button under the **Access token** section. Keep this token handy for testing.
4. **Sandbox Testing (For Development):**
   - Under **Send a message from your test number**, select or add your personal number in the **Recipient** field.
   - Click **Send Message** to verify the sandbox works.

### Step 3: Webhook Configuration
1. In the sidebar, scroll down to **Webhooks** (under Products in the sidebar menu).
2. Ensure you have selected **WhatsApp Business Account** in the dropdown at the top.
3. Under **Webhook**, click **Edit**:
   - **Callback URL:** Paste your webhook URL: `https://metachat.junoverseai.com/webhook/{USER_ID}`
   - **Verify Token:** Paste the same Custom Verify Token from Phase 1.
   - Click **Verify and Save**.
4. Under **Webhook Fields**, subscribe to **messages**.

### Step 4: Register Production Phone Number (For Going Live)
1. In the sidebar, go to **WhatsApp > Step 2. Production setup**.
2. Click **Register your WhatsApp phone number** to open the setup wizard.
3. Fill in your **Business information** (Business name, website/profile page, country) and click **Next**.
4. Configure your **WA Business Profile**, enter your phone number, and verify it via SMS or voice call.
5. Once complete, copy the new production **Phone Number ID** and **WhatsApp Business Account ID** to use in the dashboard.

### Step 5: Generate Permanent System User Access Token
*Temporary tokens expire in 24 hours. For production, generate a permanent token:*
1. Go to your [Meta Business Suite Settings](https://business.facebook.com/settings/).
2. Under **Users**, click **System Users**. Add a system user if you don't have one.
3. Select the System User and click **Generate New Token**.
4. Select your Developer App, and select the following permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. Click **Generate** and copy the long-lived token.

### Step 6: Connect WhatsApp in AutometaBot
1. Go to AutometaBot Dashboard -> **Meta Channels**.
2. Click **Connect Channel** -> Select **WhatsApp Business**.
3. Fill in the fields:
   - **WhatsApp Display Name:** Enter a label (e.g., "Support Line").
   - **WhatsApp Phone Number ID:** Paste the production ID from Step 4.
   - **WhatsApp Business Account ID:** Paste the production ID from Step 4.
   - **Access Token:** Paste the permanent System User Token from Step 5.
4. Click **Connect Page** to activate.

---

## Troubleshooting Guide

- **Webhook fails to verify ("Validation Failed" or 500 / 403 error):** 
  - **Check Cloudflare Worker Secrets:** If the worker throws a **500 error**, it means the newly deployed Cloudflare Worker is missing its environment secrets (`SUPABASE_URL` and `SUPABASE_SERVICE_KEY`), causing it to crash when fetching user settings. Ensure you run `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_SERVICE_KEY` (and `FB_APP_SECRET`, `FB_VERIFY_TOKEN`) on the deployed worker.
  - Ensure the `fb_verify_token` saved in your AutometaBot dashboard perfectly matches what you pasted into Facebook.
  - Ensure the Cloudflare worker is running correctly at `metachat.junoverseai.com`.
  
- **Webhook verified, but bot doesn't reply (messages or comments):** 
  - Check if the `fb_app_secret` matches perfectly. If the signature validation fails in the Cloudflare worker, it silently drops the request to prevent malicious traffic.
  - Ensure you subscribed to the `messages` and `feed` fields in the webhook settings.
  - **Important:** If you turned on the `feed` or `messages` fields in the developer portal *after* you connected the Page in the dashboard, you must **disconnect and reconnect** the Page in the dashboard to refresh the subscription.
  - Ensure you connected the page in the AutometaBot dashboard with the correct Page Access Token.
  
- **Bot replies to you, but not to public customers:** 
  - The Meta App is still in Development mode or missing the advanced `pages_messaging` permission.


