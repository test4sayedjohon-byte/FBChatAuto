// ============================================================================
// Facebook Webhook Signature Verification
// ============================================================================
// Facebook sends an X-Hub-Signature-256 header with every webhook POST.
// We must verify this signature using the App Secret to ensure authenticity.
// ============================================================================

/**
 * Verify the X-Hub-Signature-256 header from Facebook.
 * Uses the Web Crypto API available in Cloudflare Workers.
 *
 * @param body     - Raw request body as string
 * @param signature - Value of the X-Hub-Signature-256 header
 * @param secret   - Facebook App Secret
 * @returns true if the signature is valid
 */
export async function verifyFacebookSignature(
  body: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) {
    console.warn('[Webhook] Missing X-Hub-Signature-256 header');
    return false;
  }

  // Header format: "sha256=<hex_digest>"
  const expectedPrefix = 'sha256=';
  if (!signature.startsWith(expectedPrefix)) {
    console.warn('[Webhook] Invalid signature format');
    return false;
  }

  const signatureHex = signature.slice(expectedPrefix.length);

  // Import the secret as an HMAC key
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Compute the HMAC digest
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(body)
  );

  // Convert to hex string
  const computedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Timing-safe comparison (length-constant)
  if (computedHex.length !== signatureHex.length) {
    return false;
  }

  // Use subtle comparison to avoid timing attacks
  let mismatch = 0;
  for (let i = 0; i < computedHex.length; i++) {
    mismatch |= computedHex.charCodeAt(i) ^ signatureHex.charCodeAt(i);
  }

  return mismatch === 0;
}
