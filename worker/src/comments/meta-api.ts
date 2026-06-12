// ============================================================================
// Meta Graph API Client — Comments & Direct Message Handshakes
// ============================================================================

export async function sendCommentReply(
  accessToken: string,
  commentId: string,
  message: string
): Promise<any> {
  const url = `https://graph.facebook.com/v25.0/${commentId}/comments`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, access_token: accessToken }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Meta API Reply Failed: ${errText}`);
  }
  return await response.json();
}

export async function hideComment(
  accessToken: string,
  commentId: string
): Promise<any> {
  const url = `https://graph.facebook.com/v25.0/${commentId}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_hidden: true, access_token: accessToken }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Meta API Hide Failed: ${errText}`);
  }
  return await response.json();
}

export async function sendPrivateReply(
  accessToken: string,
  commentId: string,
  message: string,
  imageUrl?: string | null,
  fileUrl?: string | null,
  fileName?: string | null
): Promise<any> {
  const url = `https://graph.facebook.com/v25.0/me/messages?access_token=${accessToken}`;

  const cleanMsg = message.trim();

  // A. Image attachment handling
  if (imageUrl) {
    try {
      let payload: any;

      if (!cleanMsg) {
        // Send as a regular expandable image bubble if there is no accompanying text
        payload = {
          recipient: { comment_id: commentId },
          message: {
            attachment: {
              type: 'image',
              payload: {
                url: imageUrl,
                is_reusable: true
              }
            }
          }
        };
      } else {
        // Send as a Generic Template card if both text and image are present
        const title = cleanMsg.substring(0, 80) || 'Attachment';
        const subtitle = cleanMsg.length > 80 ? cleanMsg.substring(80, 160) : undefined;

        payload = {
          recipient: { comment_id: commentId },
          message: {
            attachment: {
              type: 'template',
              payload: {
                template_type: 'generic',
                elements: [
                  {
                    title,
                    subtitle,
                    image_url: imageUrl
                  }
                ]
              }
            }
          }
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return await response.json();
      }

      const errText = await response.text();
      console.warn(`[Comments Webhook] Image/Template private reply failed, falling back to text. Error: ${errText}`);
    } catch (e: any) {
      console.warn(`[Comments Webhook] Image/Template private reply failed with exception, falling back to text: ${e.message}`);
    }
  }

  // B. Document/File attachment handling (e.g. PDFs)
  if (fileUrl) {
    try {
      let payload: any;

      if (!cleanMsg) {
        // Send as native file attachment
        payload = {
          recipient: { comment_id: commentId },
          message: {
            attachment: {
              type: 'file',
              payload: {
                url: fileUrl,
                is_reusable: true
              }
            }
          }
        };
      } else {
        // Send as Generic Template card with action button
        const title = cleanMsg.substring(0, 80) || 'Attachment';
        const subtitle = cleanMsg.length > 80 ? cleanMsg.substring(80, 160) : undefined;
        
        let btnTitle = fileName || 'Open File';
        if (btnTitle.length > 20) {
          const dotIndex = btnTitle.lastIndexOf('.');
          if (dotIndex !== -1 && btnTitle.length - dotIndex <= 5) {
            const ext = btnTitle.substring(dotIndex);
            const base = btnTitle.substring(0, dotIndex);
            btnTitle = base.substring(0, 20 - ext.length) + ext;
          } else {
            btnTitle = btnTitle.substring(0, 20);
          }
        }

        payload = {
          recipient: { comment_id: commentId },
          message: {
            attachment: {
              type: 'template',
              payload: {
                template_type: 'generic',
                elements: [
                  {
                    title,
                    subtitle,
                    buttons: [
                      {
                        type: 'web_url',
                        url: fileUrl,
                        title: btnTitle
                      }
                    ]
                  }
                ]
              }
            }
          }
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return await response.json();
      }

      const errText = await response.text();
      console.warn(`[Comments Webhook] File private reply template failed, falling back to text link. Error: ${errText}`);
    } catch (e: any) {
      console.warn(`[Comments Webhook] File private reply template failed with exception: ${e.message}`);
    }
  }

  // Fallback to text message
  let textPayload = message;
  if (imageUrl && !textPayload.includes(imageUrl)) {
    if (textPayload) {
      textPayload += `\n\nImage: ${imageUrl}`;
    } else {
      textPayload = imageUrl;
    }
  }

  if (fileUrl && !textPayload.includes(fileUrl)) {
    if (textPayload) {
      textPayload += `\n\nLink: ${fileUrl}`;
    } else {
      textPayload = fileUrl;
    }
  }

  if (!textPayload.trim()) {
    textPayload = 'Thanks for your comment!';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message: { text: textPayload }
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Meta API Private Reply Failed: ${errText}`);
  }
  return await response.json();
}

export async function deleteComment(
  accessToken: string,
  commentId: string
): Promise<any> {
  const url = `https://graph.facebook.com/v25.0/${commentId}?access_token=${accessToken}`;
  const response = await fetch(url, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Meta API Delete Failed: ${errText}`);
  }
  return await response.json();
}

export async function blockUserOnPage(
  accessToken: string,
  pageId: string,
  userId: string
): Promise<any> {
  const url = `https://graph.facebook.com/v25.0/${pageId}/blocked`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: userId, access_token: accessToken }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Meta API Block User Failed: ${errText}`);
  }
  return await response.json();
}

export async function likeComment(
  accessToken: string,
  commentId: string
): Promise<any> {
  const url = `https://graph.facebook.com/v25.0/${commentId}/likes`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: accessToken }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Meta API Like Comment Failed: ${errText}`);
  }
  return await response.json();
}

export async function fetchPostContext(
  accessToken: string,
  postId: string,
  platform: 'facebook' | 'instagram'
): Promise<string> {
  const fields = platform === 'instagram' ? 'caption' : 'message';
  const url = `https://graph.facebook.com/v25.0/${postId}?fields=${fields}&access_token=${accessToken}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Meta API Fetch Post Context Failed: ${errText}`);
  }
  const data = await response.json() as any;
  return (platform === 'instagram' ? data.caption : data.message) || '';
}

