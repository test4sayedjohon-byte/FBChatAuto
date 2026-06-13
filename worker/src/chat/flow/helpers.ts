import type { PageConnection } from '../../types';

/**
 * Replaces predefined template variables in a text string.
 */
export function replaceVariables(text: string, stateData: Record<string, any>, senderName?: string | null): string {
  if (!text) return text;
  
  let name = 'there';
  if (senderName) {
    name = senderName.split(' ')[0] || senderName;
  } else if (stateData.first_name) {
    name = stateData.first_name;
  } else if (stateData.name) {
    name = stateData.name;
  }

  const phone = stateData.phone || stateData.phone_number || 'not provided';
  const email = stateData.email || 'not provided';

  // Find last_choice: look for any keys starting with "choice_" and grab the last one
  const choiceKeys = Object.keys(stateData).filter(k => k.startsWith('choice_'));
  const lastChoiceKey = choiceKeys[choiceKeys.length - 1];
  const lastChoice = lastChoiceKey ? stateData[lastChoiceKey] : 'none';

  let resolvedText = text
    .replace(/\{\{name\}\}/gi, name)
    .replace(/\{\{phone\}\}/gi, phone)
    .replace(/\{\{email\}\}/gi, email)
    .replace(/\{\{last_choice\}\}/gi, lastChoice);

  // Dynamic variable interpolation: {{var_name}}
  resolvedText = resolvedText.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    if (stateData[trimmedKey] !== undefined && stateData[trimmedKey] !== null) {
      return String(stateData[trimmedKey]);
    }
    return match;
  });

  return resolvedText;
}

/**
 * Sends a Facebook Messenger interactive message with buttons.
 */
export async function sendFacebookButtons(
  accessToken: string,
  recipient: { id?: string; comment_id?: string },
  text: string,
  buttons: any[],
  pageId?: string,
  mediaUrl?: string
): Promise<boolean> {
  const url = pageId
    ? `https://graph.facebook.com/v21.0/${pageId}/messages`
    : 'https://graph.facebook.com/v21.0/me/messages';

  let messagePayload: any;

  if (mediaUrl) {
    // Generic Template card (visual image + text + buttons)
    messagePayload = {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: [
            {
              title: text.length > 80 ? text.substring(0, 77) + '...' : text,
              image_url: mediaUrl,
              subtitle: text.length > 80 ? text : undefined,
              buttons: buttons.map(btn => {
                if (btn.type === 'web_url') {
                  return { type: 'web_url', url: btn.url, title: btn.title };
                } else if (btn.type === 'phone_number') {
                  return { type: 'phone_number', payload: btn.payload, title: btn.title };
                } else {
                  return { type: 'postback', title: btn.title, payload: btn.payload };
                }
              })
            }
          ]
        }
      }
    };
  } else {
    // Standard Button Template
    messagePayload = {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text,
          buttons: buttons.map(btn => {
            if (btn.type === 'web_url') {
              return { type: 'web_url', url: btn.url, title: btn.title };
            } else if (btn.type === 'phone_number') {
              return { type: 'phone_number', payload: btn.payload, title: btn.title };
            } else {
              return { type: 'postback', title: btn.title, payload: btn.payload };
            }
          })
        }
      }
    };
  }

  const payload = {
    recipient,
    message: messagePayload,
    messaging_type: 'RESPONSE'
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error(`[Flow Engine] Facebook buttons send failed:`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Flow Engine] Facebook buttons send network error:`, err);
    return false;
  }
}

/**
 * Sends a Facebook Messenger quick reply message.
 */
export async function sendFacebookQuickReplies(
  accessToken: string,
  recipient: { id?: string; comment_id?: string },
  text: string,
  quickReplies: any[],
  pageId?: string
): Promise<boolean> {
  const url = pageId
    ? `https://graph.facebook.com/v21.0/${pageId}/messages`
    : 'https://graph.facebook.com/v21.0/me/messages';

  const payload = {
    recipient,
    messaging_type: 'RESPONSE',
    message: {
      text,
      quick_replies: quickReplies.map(qr => ({
        content_type: 'text',
        title: qr.title.substring(0, 20),
        payload: qr.payload
      }))
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error(`[Flow Engine] Facebook quick replies send failed:`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Flow Engine] Facebook quick replies send network error:`, err);
    return false;
  }
}

/**
 * Sends a Facebook Messenger Carousel (Generic Template with multiple elements).
 */
export async function sendFacebookCarousel(
  accessToken: string,
  recipient: { id?: string; comment_id?: string },
  elements: Array<{ title: string; subtitle?: string; imageUrl?: string; buttons?: any[] }>,
  pageId?: string
): Promise<boolean> {
  const url = pageId
    ? `https://graph.facebook.com/v21.0/${pageId}/messages`
    : 'https://graph.facebook.com/v21.0/me/messages';

  const payload = {
    recipient,
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          image_aspect_ratio: 'horizontal',
          elements: elements.map(el => ({
            title: el.title.substring(0, 80),
            subtitle: el.subtitle ? el.subtitle.substring(0, 80) : undefined,
            image_url: el.imageUrl || undefined,
            buttons: el.buttons ? el.buttons.map(btn => {
              if (btn.type === 'web_url') {
                return { type: 'web_url', url: btn.url, title: btn.title.substring(0, 20) };
              } else if (btn.type === 'phone_number') {
                return { type: 'phone_number', payload: btn.payload, title: btn.title.substring(0, 20) };
              } else {
                return { type: 'postback', title: btn.title.substring(0, 20), payload: btn.payload };
              }
            }) : undefined
          }))
        }
      }
    },
    messaging_type: 'RESPONSE'
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error(`[Flow Engine] Facebook carousel send failed:`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Flow Engine] Facebook carousel send network error:`, err);
    return false;
  }
}

/**
 * Sends a WhatsApp Interactive Reply Button message (max 3 buttons).
 */
export async function sendWhatsAppInteractiveButtons(
  phoneNumberId: string,
  accessToken: string,
  recipientPhoneNumber: string,
  text: string,
  buttons: any[]
): Promise<boolean> {
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhoneNumber,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text },
      action: {
        buttons: buttons.slice(0, 3).map(btn => ({
          type: 'reply',
          reply: { id: btn.id, title: btn.title.substring(0, 20) }
        }))
      }
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error(`[Flow Engine] WhatsApp buttons send failed:`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Flow Engine] WhatsApp buttons send network error:`, err);
    return false;
  }
}

/**
 * Sends a WhatsApp Interactive List message (max 10 rows).
 */
export async function sendWhatsAppInteractiveList(
  phoneNumberId: string,
  accessToken: string,
  recipientPhoneNumber: string,
  bodyText: string,
  buttonText: string,
  sections: any[]
): Promise<boolean> {
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhoneNumber,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: buttonText.substring(0, 20),
        sections: sections.map(sec => ({
          title: sec.title.substring(0, 24),
          rows: sec.rows.slice(0, 10).map((row: any) => ({
            id: row.id,
            title: row.title.substring(0, 24),
            description: row.description ? row.description.substring(0, 72) : undefined
          }))
        }))
      }
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error(`[Flow Engine] WhatsApp list send failed:`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Flow Engine] WhatsApp list send network error:`, err);
    return false;
  }
}
