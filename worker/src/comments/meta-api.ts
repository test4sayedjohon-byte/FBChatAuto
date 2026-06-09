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
  message: string
): Promise<any> {
  const url = `https://graph.facebook.com/v25.0/${commentId}/private_replies`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, access_token: accessToken }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Meta API Private Reply Failed: ${errText}`);
  }
  return await response.json();
}
