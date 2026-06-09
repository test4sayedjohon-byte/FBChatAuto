import type { SupabaseClient } from '@supabase/supabase-js';

export interface OmnichannelPayload {
  userId: string;
  senderId: string;
  platform: string;
  userName?: string;
  email?: string;
  phone?: string;
}

/**
 * Merges identities across platforms (e.g. FB vs IG) into a single omnichannel profile
 * based on extracted email or phone numbers.
 */
export async function syncOmnichannelIdentity(
  supabase: SupabaseClient,
  payload: OmnichannelPayload
): Promise<void> {
  if (!payload.email && !payload.phone) return;

  try {
    // Check if an omnichannel profile already exists with this email or phone
    const query = supabase.from('customer_profiles').select('id, metadata').eq('user_id', payload.userId);
    
    if (payload.email) {
      query.or(`metadata->>email.eq.${payload.email}`);
    } else if (payload.phone) {
      query.or(`metadata->>phone.eq.${payload.phone}`);
    }

    const { data: profiles, error } = await query;
    if (error) throw error;

    let targetProfileId = null;
    let existingMetadata: any = {};

    if (profiles && profiles.length > 0) {
      // Profile exists, we merge this sender_id into it
      targetProfileId = profiles[0].id;
      existingMetadata = typeof profiles[0].metadata === 'string' ? JSON.parse(profiles[0].metadata) : profiles[0].metadata || {};
      
      // Merge platforms
      const platforms = existingMetadata.platforms || [];
      if (!platforms.includes(payload.platform)) {
        platforms.push(payload.platform);
      }
      
      const senderIds = existingMetadata.sender_ids || {};
      senderIds[payload.platform] = payload.senderId;

      existingMetadata.platforms = platforms;
      existingMetadata.sender_ids = senderIds;
      if (payload.email) existingMetadata.email = payload.email;
      if (payload.phone) existingMetadata.phone = payload.phone;

      await supabase
        .from('customer_profiles')
        .update({ metadata: existingMetadata })
        .eq('id', targetProfileId);

      console.log(`[Omnichannel] Merged ${payload.platform} sender ${payload.senderId} into existing profile ${targetProfileId}`);
    } else {
      // Create new omnichannel profile
      existingMetadata = {
        platforms: [payload.platform],
        sender_ids: { [payload.platform]: payload.senderId },
        email: payload.email,
        phone: payload.phone,
        name: payload.userName
      };

      await supabase
        .from('customer_profiles')
        .insert({
          user_id: payload.userId,
          page_id: 'omnichannel', // Indicates cross-platform
          sender_id: payload.senderId,
          summary: `Unified profile created via ${payload.platform}`,
          metadata: existingMetadata
        });

      console.log(`[Omnichannel] Created new unified profile for ${payload.email || payload.phone}`);
    }
  } catch (err: any) {
    console.error(`[Omnichannel] Error syncing identity: ${err.message}`);
  }
}
