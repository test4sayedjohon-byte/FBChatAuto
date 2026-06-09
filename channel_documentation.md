# Meta Channel Automation & API Capabilities
This document outlines the messaging and content automation capabilities for **Facebook Messenger**, **Instagram Direct**, and the **WhatsApp Business Cloud API**. It details supported attachment formats, typing delays, interactive elements (buttons, quick replies, templates), and maps them against the current automation features implemented in **AutometaBot**.

---

## 1. Supported File Attachments & Media Limits

When sending media via Meta's Messaging APIs, you must adhere to specific formats and size limits. The table below compares the supported attachments across all three channels.

| Media Type | Facebook Messenger | Instagram Direct | WhatsApp Business Cloud API |
| :--- | :--- | :--- | :--- |
| **Images** | PNG, JPEG, GIF, TIFF, BMP<br>• *Size Limit:* 25 MB (8 MB recommended)<br>• *Dimensions:* Min 200x200px | PNG, JPEG, GIF<br>• *Size Limit:* 8 MB<br>• *Dimensions:* Aspect ratio 1:1 recommended | JPEG, PNG (8-bit, RGB/RGBA only)<br>• *Size Limit:* 5 MB |
| **Videos** | MP4, OGG, AVI, MOV, WEBM, WMV, 3GP<br>• *Size Limit:* 25 MB<br>• *Timeout:* 75s upload window | MP4, OGG, AVI, MOV, WEBM<br>• *Size Limit:* 25 MB<br>• *Re-encoding:* Recommended `moov` atom at front | MP4, 3GPP (H.264 codec + AAC audio only)<br>• *Size Limit:* 16 MB<br>• *Re-encoding:* No B-frames, single audio stream |
| **Audio** | AAC, M4A, WAV, MP4, FLAC, MP3, WMA<br>• *Size Limit:* 25 MB | AAC, M4A, WAV, MP4<br>• *Size Limit:* 25 MB | AAC, AMR, MP3, MP4 (audio), OGG (Opus only)<br>• *Size Limit:* 16 MB |
| **Documents / Files** | PDF, and most common MIME types<br>• *Size Limit:* 25 MB | PDF only<br>• *Size Limit:* 25 MB | PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT<br>• *Size Limit:* 100 MB |
| **Stickers** | PNG, GIF, WebP | PNG, GIF, WebP | WebP only (512x512px exactly)<br>• *Size limit:* 100 KB (static), 500 KB (animated) |

### Technical Guidelines
* **Signed CDN Links:** Meta CDN links (`lookaside.fbsbx.com`) generated via webhooks are self-authenticating, signed URLs that do not require appending tokens. They expire after a short duration (typically 1 hour to 7 days).
* **Attachment ID Reuse:** When sending the same media to multiple users, use the **Attachment Upload API** first to obtain a permanent `attachment_id`. Sending messages via `attachment_id` is much faster and bypasses repeat media processing:
  ```json
  // Request structure to send using attachment_id
  "message": {
    "attachment": {
      "type": "image",
      "payload": {
        "attachment_id": "YOUR_UPLOADED_ATTACHMENT_ID"
      }
    }
  }
  ```

---

## 2. Delays, Typing Indicators, & Human-like Behavior

To make conversational AI feel natural and prevent triggering Meta's automated spam filters, implementing proper delays and typing indicators is critical.

### Facebook Messenger & Instagram Direct
Both channels support **Sender Actions** to control the conversation thread status.
* **API Endpoint:** `/v21.0/me/messages` (Messenger) and `/v21.0/<PAGE_ID>/messages` (Instagram)
* **Supported Actions (`sender_action`):**
  * `mark_seen`: Marks the incoming message as read.
  * `typing_on`: Displays the typing bubble indicator (bubbles automatically turn off after 20s if no message is sent).
  * `typing_off`: Explicitly hides the typing bubbles.
* **Payload Structure:**
  ```json
  {
    "recipient": { "id": "<PSID>" },
    "sender_action": "typing_on"
  }
  ```

### WhatsApp Business Cloud API
* **Typing Status:** The standard WhatsApp Business API `/messages` endpoint does **not** natively support a simulated typing action (it only supports text, template, and interactive payloads).
* **Read Receipts:** You can mark a message as read by sending a POST request to update the status of the message ID:
  ```json
  {
    "messaging_product": "whatsapp",
    "status": "read",
    "message_id": "<MESSAGE_ID>"
  }
  ```

---

## 3. Interactive Messaging Elements (Selection Boxes & Templates)

Providing users with pre-configured selection options reduces friction, improves conversion rates, and guides conversation paths.

### 3.1. Quick Replies (Messenger & Instagram)
Quick replies display horizontal buttons above the keyboard.
* **Maximum Buttons:** Up to **13 quick replies** in a single message.
* **Title Limit:** Max **20 characters** per button (truncated if longer).
* **Behavior:** When tapped, the buttons disappear from the interface. The title is sent as text, and your webhook receives a `messaging_postbacks` event containing a custom developer-defined `payload`.
* **MIME Support:** Can pre-populate standard fields using `"content_type": "user_phone_number"` or `"content_type": "user_email"`.
* **Payload Example:**
  ```json
  {
    "recipient": { "id": "<PSID>" },
    "messaging_type": "RESPONSE",
    "message": {
      "text": "How can I help you today?",
      "quick_replies": [
        {
          "content_type": "text",
          "title": "Pricing Plans",
          "payload": "MENU_PRICING",
          "image_url": "https://example.com/icons/pricing.png"
        },
        {
          "content_type": "text",
          "title": "Contact Support",
          "payload": "MENU_SUPPORT"
        }
      ]
    }
  }
  ```

### 3.2. Button Templates (Messenger & Instagram)
Button templates send a text bubble containing up to 3 vertical call-to-action buttons. Unlike quick replies, these buttons remain permanently in the chat history.
* **Maximum Buttons:** Up to **3 buttons**.
* **Title Limit:** Max **20 characters** per button.
* **Button Types:**
  * `web_url`: Opens a web URL (supports launching a webview overlay with custom heights: `compact`, `tall`, or `full`).
  * `postback`: Sends a developer-defined payload back to your webhook.
  * `phone_number`: Prompts the user to place a phone call.
* **Payload Example:**
  ```json
  {
    "recipient": { "id": "<PSID>" },
    "message": {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "button",
          "text": "Need to talk to our team or browse our site?",
          "buttons": [
            {
              "type": "web_url",
              "url": "https://example.com",
              "title": "Visit Website"
            },
            {
              "type": "postback",
              "title": "Talk to Human",
              "payload": "TALK_TO_HUMAN"
            }
          ]
        }
      }
    }
  }
  ```

### 3.3. Generic (Carousel) Templates (Messenger & Instagram)
Carousels display a horizontally scrollable list of rich cards, each with an image, title, description, and action buttons.
* **Card Limit:** Max **10 cards (elements)** per carousel.
* **Title Limit:** Max **80 characters**.
* **Subtitle Limit:** Max **80 characters**.
* **Buttons per Card:** Max **3 buttons** per card.
* **Payload Example:**
  ```json
  {
    "recipient": { "id": "<PSID>" },
    "message": {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "image_aspect_ratio": "horizontal", // or "square"
          "elements": [
            {
              "title": "Product A",
              "image_url": "https://example.com/prod_a.jpg",
              "subtitle": "$49.99 - Best Seller",
              "buttons": [
                {
                  "type": "web_url",
                  "url": "https://example.com/buy-a",
                  "title": "Buy Now"
                }
              ]
            },
            {
              "title": "Product B",
              "image_url": "https://example.com/prod_b.jpg",
              "subtitle": "$79.99 - Premium Choice",
              "buttons": [
                {
                  "type": "web_url",
                  "url": "https://example.com/buy-b",
                  "title": "Buy Now"
                }
              ]
            }
          ]
        }
      }
    }
  }
  ```

### 3.4. WhatsApp List Messages
List messages present users with a clean structured menu. When clicked, it opens a full-screen vertical bottom sheet list.
* **Button Text:** Max **20 characters** (triggers opening the list).
* **Maximum Sections:** Up to **10 sections**.
* **Maximum Total Rows:** Up to **10 rows** across all sections.
* **Row Title Limit:** Max **24 characters**.
* **Row Description Limit:** Max **72 characters** (optional).
* **Payload Example:**
  ```json
  {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "<PHONE_NUMBER>",
    "type": "interactive",
    "interactive": {
      "type": "list",
      "header": { "type": "text", "text": "Product Menu" },
      "body": { "text": "Select a category to view items." },
      "footer": { "text": "Thank you for shopping!" },
      "action": {
        "button": "View Options",
        "sections": [
          {
            "title": "Electronics",
            "rows": [
              { "id": "ELECTRONICS_PHONES", "title": "Smartphones", "description": "Latest 5G mobile devices" },
              { "id": "ELECTRONICS_LAPTOPS", "title": "Laptops", "description": "Work and gaming notebooks" }
            ]
          },
          {
            "title": "Fashion",
            "rows": [
              { "id": "FASHION_SHOES", "title": "Running Shoes", "description": "Athletic and walking gear" }
            ]
          }
        ]
      }
    }
  }
  ```

### 3.5. WhatsApp Reply Buttons
Reply buttons provide up to 3 quick-tap options directly inline in the message thread.
* **Maximum Buttons:** Max **3 buttons**.
* **Button Title Limit:** Max **20 characters**.
* **Payload Example:**
  ```json
  {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "<PHONE_NUMBER>",
    "type": "interactive",
    "interactive": {
      "type": "button",
      "body": { "text": "Are you ready to finalize your order?" },
      "action": {
        "buttons": [
          {
            "type": "reply",
            "reply": { "id": "ORDER_YES", "title": "Yes, proceed" }
          },
          {
            "type": "reply",
            "reply": { "id": "ORDER_NO", "title": "No, cancel it" }
          }
        ]
      }
    }
  }
  ```

### 3.6. Persistent Menu & Ice Breakers (Messenger & Instagram)
These are configured at the profile level rather than sent inside single messages.
* **Ice Breakers:** A static list of up to **4 frequently asked questions** visible when a user opens the chat window for the first time. Question limit is 80 characters; trigger payload is 1000 characters.
* **Persistent Menu:** A permanent menu in the chat composer area. Supports nested items (up to 3 levels on Messenger) containing web URLs or postbacks.

---

## 4. Key Automation Segments

Automating messaging channels involves structuring interactions into logical workflows:

1. **New User Onboarding (Ice Breakers & Welcome Flows):**
   * Capture initial intent before the user types. Ice breakers prompt specific queries which trigger instant custom chatbot actions.
2. **Comment-to-DM (Comment Guard / Auto-Engagement):**
   * Triggering a private message sequence whenever a user comments on a specific Facebook Page post or Instagram post. This converts public engagement into private hot leads.
3. **Structured Interactive Flows (Self-Service Menus):**
   * Guiding users through standard decisions (e.g., booking slots, querying order status, viewing pricing) using carousels and lists, bypassing open-ended AI requests when concrete options are preferred.
4. **Trigger Word Intercept & Human Handovers:**
   * Detecting keywords (e.g., "human", "agent", "complain", "refund") to immediately pause AI automation, update the thread metadata, and alert a live support agent (via Meta's Handover Protocol or internal dashboard toggles).
5. **Drip Campaigns & Broadcasts (Within 24hr Window):**
   * Sending automated schedules, product announcements, or follow-ups to users who have engaged within the last 24 hours.

---

## 5. Summary of Automations Applied in our System

Our Cloudflare Worker, Database, and Scheduler currently orchestrate the following automations:

### 1. Multi-Tenant Webhook Routing & App Isolation (BYOA)
* **File:** [worker/src/routes/webhook.ts](file:///Users/sayedjohon/Documents/DEV_AREA/fbchatauto/worker/src/routes/webhook.ts), [worker/src/webhook-processor.ts](file:///Users/sayedjohon/Documents/DEV_AREA/fbchatauto/worker/src/webhook-processor.ts)
* **Status:** **Active / Applied**
* **Details:** Every tenant receives a unique webhook route `https://<WORKER>/webhook/:userId`. The worker dynamically retrieves the tenant's stored Page access tokens, verify tokens, and App secrets from the Supabase Database (`page_connections` and `users` tables). It validates signatures using `X-Hub-Signature-256` to secure incoming payloads.

### 2. Conversational AI & OpenRouter Integration
* **File:** [worker/src/chat/index.ts](file:///Users/sayedjohon/Documents/DEV_AREA/fbchatauto/worker/src/chat/index.ts), [worker/src/agent/index.ts](file:///Users/sayedjohon/Documents/DEV_AREA/fbchatauto/worker/src/agent/index.ts)
* **Status:** **Active / Applied**
* **Details:** Incoming messages are routed to LLM routers (such as OpenRouter). It extracts conversation context from PostgreSQL (`sessions` and `messages` tables) and applies RAG/embeddings for personalized tenant knowledge lookup.

### 3. Human-like Delay & Typing Indicators (Messenger)
* **File:** [worker/src/facebook.ts](file:///Users/sayedjohon/Documents/DEV_AREA/fbchatauto/worker/src/facebook.ts), [worker/src/webhook-processor.ts](file:///Users/sayedjohon/Documents/DEV_AREA/fbchatauto/worker/src/webhook-processor.ts)
* **Status:** **Active / Applied**
* **Details:** While the LLM processes replies, the worker triggers simulated typing indicators. A custom function (`getReplyDelay`) calculates human-realistic delays based on character length:
  * `< 50 chars`: 0.2 seconds delay.
  * `< 150 chars`: 1 to 2.5 seconds delay.
  * `< 300 chars`: 2.5 to 4.5 seconds delay.
  * `> 300 chars`: 5 to 8 seconds delay.
  * 25% chance of random override simulating copy-paste or instant responses.
  * Loop continuously triggers `typing_on` and `typing_off` until the message sends.

### 4. Debouncing & Concurrency Locks
* **File:** [worker/src/webhook-processor.ts](file:///Users/sayedjohon/Documents/DEV_AREA/fbchatauto/worker/src/webhook-processor.ts)
* **Status:** **Active / Applied**
* **Details:** A 1.5-second debounce window delays processing when multiple quick DMs/images are sent consecutively. A D1/PostgreSQL SQLite session lock (`acquireSessionLockFallback`) prevents race conditions by blocking multiple worker threads from updating the same chat session simultaneously.

### 5. AI Vision Pipeline (Image Attachment Parsing)
* **File:** [worker/src/webhook-processor.ts](file:///Users/sayedjohon/Documents/DEV_AREA/fbchatauto/worker/src/webhook-processor.ts), [worker/src/whatsapp.ts](file:///Users/sayedjohon/Documents/DEV_AREA/fbchatauto/worker/src/whatsapp.ts)
* **Status:** **Active / Applied**
* **Details:** FB Messenger webhook image links are short-lived lookaside CDN URLs. The worker immediately downloads incoming images in the background and converts them to base64 data URLs. These are stored locally, enabling vision-compatible LLMs to inspect the image content inline even after CDN links expire.

### 6. Interactive WhatsApp Parsing & Contact Naming
* **File:** [worker/src/whatsapp.ts](file:///Users/sayedjohon/Documents/DEV_AREA/fbchatauto/worker/src/whatsapp.ts)
* **Status:** **Active / Applied**
* **Details:** The worker parses incoming WhatsApp interactive selections (e.g. `button_reply` or `list_reply` titles) and records them as text inputs for LLM continuation. It also extracts the WhatsApp contact's profile name (`value.contacts[0].profile.name`) and synchronizes it to the chat session metadata.

### 7. Trigger Word Bot Pausing & Handovers
* **File:** [worker/src/webhook-processor.ts](file:///Users/sayedjohon/Documents/DEV_AREA/fbchatauto/worker/src/webhook-processor.ts), [worker/src/whatsapp.ts](file:///Users/sayedjohon/Documents/DEV_AREA/fbchatauto/worker/src/whatsapp.ts)
* **Status:** **Active / Applied**
* **Details:** If triggers are enabled and a user message hits configured words, the bot pauses automation (`bot_paused = true`), updates Supabase/SQLite state, and replies with a custom canned handover reply (e.g. *"Transferring to a human agent"*).

### 8. Feed Comment & Reply Automation
* **File:** [worker/src/comments/index.ts](file:///Users/sayedjohon/Documents/DEV_AREA/fbchatauto/worker/src/comments/index.ts), [worker/src/comments/autopilot.ts](file:///Users/sayedjohon/Documents/DEV_AREA/fbchatauto/worker/src/comments/autopilot.ts)
* **Status:** **Active / Applied**
* **Details:** Subscribes to the `feed` webhook object (Facebook) and `comments` webhook object (Instagram). When users comment on page posts, the bot replies to the comment or executes automation rules based on configuration.

### 9. Scheduled Post Publisher (Content Automation)
* **File:** [worker/src/scheduler/index.ts](file:///Users/sayedjohon/Documents/DEV_AREA/fbchatauto/worker/src/scheduler/index.ts), [worker/src/scheduler/media-uploader.ts](file:///Users/sayedjohon/Documents/DEV_AREA/fbchatauto/worker/src/scheduler/media-uploader.ts)
* **Status:** **Active / Applied**
* **Details:** Periodically queries the database for scheduled posts and uploads/publishes media and text updates to Facebook and Instagram pages.
