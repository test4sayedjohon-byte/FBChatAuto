import type { Env } from './types';
import { createSupabaseAdmin } from './supabase';
import { executeWeeklyPlanner, executeVariationsPlanner } from './agent';

export async function processSocialPosterQueue(batch: MessageBatch<any>, env: Env): Promise<void> {
  const supabase = createSupabaseAdmin(env);
  let consecutiveErrors = 0;

  for (const message of batch.messages) {
    // Circuit Breaker check
    if (consecutiveErrors >= 5) {
      console.warn(`[Circuit Breaker] Tripped! Halting queue processing for batch. Remaining messages will be retried later.`);
      message.retry();
      continue;
    }

    try {
      const payload = message.body;

      if (payload && payload.task === 'generate_ideas') {
        console.log(`[Social Poster Queue] Executing content ideas generation for tenant: ${payload.tenantId}`);
        const result = await executeWeeklyPlanner(supabase, payload.tenantId, env, env.DB);
        if (result.success) {
          console.log(`[Social Poster Queue] ✅ Successfully generated ideas/post for tenant ${payload.tenantId}: ${result.message}`);
          consecutiveErrors = 0;
          message.ack();
        } else {
          const isUnrecoverable = result.message.includes('not found') || 
                                  result.message.includes('Insufficient') || 
                                  result.message.includes('No active connected');
          if (isUnrecoverable) {
            console.error(`[Social Poster Queue] Unrecoverable error in generate_ideas: ${result.message}. Acking message.`);
            message.ack();
          } else {
            throw new Error(result.message);
          }
        }
        continue;
      }

      if (payload && payload.task === 'generate_variations') {
        console.log(`[Social Poster Queue] Executing post variations generation for tenant: ${payload.tenantId}, post: ${payload.ideaId}`);
        const result = await executeVariationsPlanner(supabase, payload.tenantId, payload.ideaId, env, env.DB);
        if (result.success) {
          console.log(`[Social Poster Queue] ✅ Successfully generated variations for post ${payload.ideaId}: ${result.message}`);
          consecutiveErrors = 0;
          message.ack();
        } else {
          const isUnrecoverable = result.message.includes('not found') || 
                                  result.message.includes('Insufficient');
          if (isUnrecoverable) {
            console.error(`[Social Poster Queue] Unrecoverable error in generate_variations: ${result.message}. Acking message.`);
            await supabase
              .from('scheduled_posts')
              .update({ status: 'failed', error_message: result.message })
              .eq('id', payload.ideaId);
            message.ack();
          } else {
            throw new Error(result.message);
          }
        }
        continue;
      }

      console.log(`[Social Poster Queue] Processing post: ${payload.postId} for page: ${payload.pageId}`);

      // TODO: Actual Meta Graph API call to publish the post.
      // This will be expanded later, but the queue mechanics are implemented.
      
      // Simulate success
      consecutiveErrors = 0;
      message.ack();

      // Update database status
      await supabase
        .from('scheduled_posts')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', payload.postId);

    } catch (err: any) {
      console.error(`[Social Poster Queue] Error processing queue message: ${err.message}`);
      consecutiveErrors++;
      
      // If error is unrecoverable (e.g. account restricted), drop it and mark failed.
      if (err.message?.includes('OAuthException') || err.message?.includes('restricted') || err.message?.includes('not found')) {
        if (message.body && message.body.postId) {
          await supabase
            .from('scheduled_posts')
            .update({ status: 'failed', error_message: err.message })
            .eq('id', message.body.postId);
        }
        message.ack();
      } else {
        // Transient error, trigger rate-limit backoff by retrying
        message.retry();
      }
    }
  }
}
