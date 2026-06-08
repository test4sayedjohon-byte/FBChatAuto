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
 * Helper: Calculate human-like reply delay based on response length.
 * Follows structured length-based logic 75% of the time, and completely
 * randomized copy-paste/arbitrary behavior 25% of the time.
 */
export function getReplyDelay(text: string, isVisionCanned: boolean): number {
  if (isVisionCanned) {
    // 10 to 20 seconds
    return Math.floor(Math.random() * 10000) + 10000;
  }

  // 25% chance of completely randomized behavior (simulating human copy-paste or erratic typing patterns)
  if (Math.random() < 0.25) {
    const randomChoice = Math.random();
    if (randomChoice < 0.40) {
      return 0; // 40% chance of instant reply (copy-paste)
    } else if (randomChoice < 0.70) {
      return Math.floor(Math.random() * 4000) + 1000; // 30% chance of random medium delay (1-5s)
    } else {
      return Math.floor(Math.random() * 9000) + 6000; // 30% chance of random long delay (6-15s)
    }
  }

  // 75% chance of structured length-dependent delays:
  const length = text.length;
  if (length < 50) {
    return Math.floor(Math.random() * 1500) + 1000; // Short text: 1 to 2.5s
  } else if (length < 150) {
    return Math.floor(Math.random() * 3000) + 3000; // Medium text: 3 to 6s
  } else if (length < 300) {
    return Math.floor(Math.random() * 4000) + 7000; // Long text: 7 to 11s
  } else {
    return Math.floor(Math.random() * 6000) + 12000; // Very long text: 12 to 18s
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
