// ─── Facebook Graph API: Send Reply ────────────────────────────────────────

export async function sendFacebookReply(
  accessToken: string,
  recipientId: string | { id?: string; comment_id?: string },
  messageText: string,
  pageId?: string
): Promise<{ success: boolean; error?: string }> {
  const recipient = typeof recipientId === 'string' ? { id: recipientId } : recipientId;
  const logRecipient = typeof recipientId === 'string' ? recipientId : JSON.stringify(recipientId);

  // Facebook Messenger has a 2000 character limit per message.
  // Split long responses into multiple messages.
  const MAX_LENGTH = 2000;
  const messages = splitMessage(messageText, MAX_LENGTH);
  let lastError: string | undefined;

  for (const msg of messages) {
    const url = pageId
      ? `https://graph.facebook.com/v21.0/${pageId}/messages`
      : 'https://graph.facebook.com/v21.0/me/messages';

    const payload = {
      recipient,
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
        lastError = errorBody;
      } else {
        console.log(`[Facebook] ✅ Reply sent to ${logRecipient}`);
      }
    } catch (error: any) {
      console.error('[Facebook] ❌ Network error sending reply:', error);
      lastError = error.message;
    }
  }

  if (lastError) {
    return { success: false, error: lastError };
  }
  return { success: true };
}

/**
 * Send Facebook Sender Actions (e.g. typing_on, typing_off, mark_seen)
 */
export async function sendFacebookSenderAction(
  accessToken: string,
  recipientId: string,
  senderAction: 'typing_on' | 'typing_off' | 'mark_seen',
  pageId?: string
): Promise<void> {
  const url = pageId
    ? `https://graph.facebook.com/v21.0/${pageId}/messages`
    : 'https://graph.facebook.com/v21.0/me/messages';

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
 * Send Facebook Attachment (image, video, audio, or file) via URL or cached media ID.
 */
export async function sendFacebookAttachment(
  accessToken: string,
  recipientId: string | { id?: string; comment_id?: string },
  attachmentType: 'image' | 'video' | 'audio' | 'file',
  attachmentUrl: string,
  mediaId?: string,
  pageId?: string,
  filename?: string
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  const recipient = typeof recipientId === 'string' ? { id: recipientId } : recipientId;
  const logRecipient = typeof recipientId === 'string' ? recipientId : JSON.stringify(recipientId);

  const url = pageId
    ? `https://graph.facebook.com/v21.0/${pageId}/messages`
    : 'https://graph.facebook.com/v21.0/me/messages';

  let finalUrl = attachmentUrl;
  if (!mediaId && filename && attachmentUrl.includes('.supabase.co/storage/')) {
    try {
      const urlObj = new URL(attachmentUrl);
      urlObj.searchParams.set('download', filename);
      finalUrl = urlObj.toString();
    } catch (_) {}
  }

  const payload: any = {
    recipient,
    message: {
      attachment: {
        type: attachmentType,
        payload: mediaId 
          ? { attachment_id: mediaId }
          : { url: finalUrl, is_reusable: true }
      }
    },
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
      console.error(`[Facebook] ❌ Failed to send attachment (${response.status}):`, errorBody);
      return { success: false, error: errorBody };
    }

    const result = await response.json() as any;
    console.log(`[Facebook] ✅ Attachment sent to ${logRecipient} (ID: ${result.attachment_id || 'reused'})`);
    return { success: true, mediaId: result.attachment_id };
  } catch (error: any) {
    console.error('[Facebook] ❌ Network error sending attachment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Helper: Calculate human-like reply delay based on response length.
 * Follows structured length-based logic 75% of the time, and completely
 * randomized copy-paste/arbitrary behavior 25% of the time.
 */
export function getReplyDelay(text: string, isVisionCanned: boolean): number {
  if (isVisionCanned) {
    // 3 to 6 seconds
    return Math.floor(Math.random() * 3000) + 3000;
  }

  // 25% chance of completely randomized behavior (simulating human copy-paste or erratic typing patterns)
  if (Math.random() < 0.25) {
    const randomChoice = Math.random();
    if (randomChoice < 0.40) {
      return 0; // 40% chance of instant reply (copy-paste)
    } else if (randomChoice < 0.70) {
      return Math.floor(Math.random() * 1000) + 500; // 30% chance of random medium delay (0.5-1.5s)
    } else {
      return Math.floor(Math.random() * 2000) + 2000; // 30% chance of random long delay (2-4s)
    }
  }

  // 75% chance of structured length-dependent delays:
  const length = text.length;
  if (length < 50) {
    return 200; // Short text: 0.2 seconds (instantaneous)
  } else if (length < 150) {
    return Math.floor(Math.random() * 1500) + 1000; // Medium text: 1 to 2.5s
  } else if (length < 300) {
    return Math.floor(Math.random() * 2000) + 2500; // Long text: 2.5 to 4.5s
  } else {
    return Math.floor(Math.random() * 3000) + 5000; // Very long text: 5 to 8s
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
