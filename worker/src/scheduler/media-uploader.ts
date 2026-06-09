// ============================================================================
// Media Uploader & Meta Content Publisher
// ============================================================================

export async function publishToFacebook(
  accessToken: string,
  pageId: string,
  message: string,
  mediaUrls?: string[]
): Promise<{ postId: string }> {
  if (accessToken === 'mock-token') {
    console.log(`[Scheduler Mock] Successfully published mock Facebook post`);
    return { postId: `mock_fb_post_${Date.now()}` };
  }
  // If there are photos, we upload to /photos first or use attachments.
  // For simplicity, if we have media URLs, we can use the multi-photo feed post or simple message + link
  const url = `https://graph.facebook.com/v25.0/${pageId}/feed`;
  const params: any = {
    message,
    access_token: accessToken,
  };

  if (mediaUrls && mediaUrls.length > 0) {
    // Facebook simple image attach uses link field or multi-attachments.
    // For single image, we can just pass the 'link' parameter.
    params.link = mediaUrls[0];
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Facebook Publish Failed: ${errText}`);
  }

  const result = await response.json() as any;
  return { postId: result.id };
}

export async function publishToInstagram(
  accessToken: string,
  igUserId: string,
  caption: string,
  mediaUrl: string,
  isVideo: boolean = false
): Promise<{ postId: string }> {
  if (accessToken === 'mock-token') {
    console.log(`[Scheduler Mock] Successfully published mock Instagram post`);
    return { postId: `mock_ig_post_${Date.now()}` };
  }
  // 1. Create Media Container
  const containerUrl = `https://graph.facebook.com/v25.0/${igUserId}/media`;
  const containerParams: any = {
    caption,
    access_token: accessToken,
  };

  if (isVideo) {
    containerParams.video_url = mediaUrl;
    containerParams.media_type = 'VIDEO';
  } else {
    containerParams.image_url = mediaUrl;
  }

  const containerRes = await fetch(containerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(containerParams),
  });

  if (!containerRes.ok) {
    const errText = await containerRes.text();
    throw new Error(`IG Container Creation Failed: ${errText}`);
  }

  const containerData = await containerRes.json() as any;
  const containerId = containerData.id;

  // 2. Poll Container Status untilFINISHED or FAILED
  let status = 'IN_PROGRESS';
  const maxPolls = 12; // 60 seconds max
  for (let poll = 0; poll < maxPolls; poll++) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // wait 5 seconds

    const pollUrl = `https://graph.facebook.com/v25.0/${containerId}?fields=status_code,error_message&access_token=${accessToken}`;
    const pollRes = await fetch(pollUrl);
    if (!pollRes.ok) continue;

    const pollData = await pollRes.json() as any;
    status = pollData.status_code;

    if (status === 'FINISHED') break;
    if (status === 'ERROR') {
      throw new Error(`IG Container Processing Error: ${pollData.error_message || 'Unknown processing failure.'}`);
    }
  }

  if (status !== 'FINISHED') {
    throw new Error(`IG Media Container Polling timed out (Media processing took too long).`);
  }

  // 3. Publish Container
  const publishUrl = `https://graph.facebook.com/v25.0/${igUserId}/media_publish`;
  const publishRes = await fetch(publishUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: accessToken,
    }),
  });

  if (!publishRes.ok) {
    const errText = await publishRes.text();
    throw new Error(`IG Container Publish Failed: ${errText}`);
  }

  const publishData = await publishRes.json() as any;
  return { postId: publishData.id };
}
