// ─── Facebook Graph API: Send Reply ────────────────────────────────────────

export async function sendFacebookReply(
  accessToken: string,
  recipientId: string,
  messageText: string
): Promise<void> {
  // Facebook Messenger has a 2000 character limit per message.
  // Split long responses into multiple messages.
  const MAX_LENGTH = 2000;
  const messages = splitMessage(messageText, MAX_LENGTH);

  for (const msg of messages) {
    const url = 'https://graph.facebook.com/v21.0/me/messages';

    const payload = {
      recipient: { id: recipientId },
      message: { text: msg },
      messaging_type: 'RESPONSE',
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[Facebook] ❌ Failed to send reply (${response.status}):`, errorBody);
      } else {
        console.log(`[Facebook] ✅ Reply sent to ${recipientId}`);
      }
    } catch (error) {
      console.error('[Facebook] ❌ Network error sending reply:', error);
    }
  }
}

/**
 * Send Facebook Sender Actions (e.g. typing_on, typing_off, mark_seen)
 */
export async function sendFacebookSenderAction(
  accessToken: string,
  recipientId: string,
  senderAction: 'typing_on' | 'typing_off' | 'mark_seen'
): Promise<void> {
  const url = 'https://graph.facebook.com/v21.0/me/messages';

  const payload = {
    recipient: { id: recipientId },
    sender_action: senderAction,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Facebook] ❌ Failed to send sender action ${senderAction} (${response.status}):`, errorBody);
    } else {
      console.log(`[Facebook] ✅ Sender action ${senderAction} sent to ${recipientId}`);
    }
  } catch (error) {
    console.error(`[Facebook] ❌ Network error sending sender action ${senderAction}:`, error);
  }
}

/**
 * Split a long message into chunks that respect word boundaries.
 */
function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find the last space or newline before the limit
    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = maxLength; // Force split at limit
    }

    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }

  return chunks;
}
