// ============================================================================
// RAG Pipeline — Document Processing & Vector Search
// ============================================================================
// Handles the full RAG flow:
//   1. Chunk text → generate embeddings → store in Supabase pgvector
//   2. Query: embed question → similarity search → return relevant chunks
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AIProviderConfig } from '../ai/types';
import { callEmbedding, callEmbeddingWithFailover } from '../ai/client';
import { chunkText, type ChunkOptions } from './chunker';

/**
 * Process a document: chunk text, generate embeddings, store in Supabase.
 *
 * @param supabase   - Admin Supabase client
 * @param provider   - Embedding provider config
 * @param userId     - Tenant ID
 * @param documentId - Parent document ID (must already exist in `documents` table)
 * @param text       - Raw document text to process
 * @param options    - Chunking options
 */
export async function processDocument(
  supabase: SupabaseClient,
  provider: AIProviderConfig | AIProviderConfig[],
  userId: string,
  documentId: string,
  text: string,
  options?: ChunkOptions
): Promise<{ chunksCreated: number; totalTokens: number }> {
  console.log(`[RAG] Processing document ${documentId} for user ${userId}`);

  // 1. Chunk the text
  const chunks = chunkText(text, options);
  console.log(`[RAG] Created ${chunks.length} chunks`);

  if (chunks.length === 0) {
    return { chunksCreated: 0, totalTokens: 0 };
  }

  // 2. Generate embeddings in batches (most APIs support batch input)
  const BATCH_SIZE = 20; // Process 20 chunks at a time
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.content);

    const chain = Array.isArray(provider) ? provider : [provider];
    const embeddings = await callEmbeddingWithFailover(chain, texts);
    allEmbeddings.push(...embeddings);

    console.log(`[RAG] Embedded batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}`);
  }

  // 3. Delete existing chunks for this document (re-processing support)
  await supabase
    .from('document_chunks')
    .delete()
    .eq('document_id', documentId);

  // 4. Insert chunks with embeddings
  const rows = chunks.map((chunk, index) => ({
    document_id: documentId,
    user_id: userId,
    chunk_index: chunk.index,
    content: chunk.content,
    token_count: chunk.tokenEstimate,
    embedding: JSON.stringify(allEmbeddings[index]), // pgvector accepts JSON array strings
    metadata: {},
  }));

  // Insert in batches to avoid payload size limits
  const INSERT_BATCH = 50;
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const batch = rows.slice(i, i + INSERT_BATCH);
    const { error } = await supabase.from('document_chunks').insert(batch);

    if (error) {
      console.error(`[RAG] ❌ Failed to insert chunk batch:`, error.message);
      throw new Error(`Failed to store document chunks: ${error.message}`);
    }
  }

  // 5. Update the parent document's chunk count
  await supabase
    .from('documents')
    .update({ chunk_count: chunks.length })
    .eq('id', documentId);

  const totalTokens = chunks.reduce((sum, c) => sum + c.tokenEstimate, 0);
  console.log(`[RAG] ✅ Stored ${chunks.length} chunks (~${totalTokens} tokens) for document ${documentId}`);

  return { chunksCreated: chunks.length, totalTokens };
}

/**
 * Perform a RAG similarity search against a user's document chunks.
 *
 * @param supabase   - Admin Supabase client
 * @param provider   - Embedding provider config
 * @param userId     - Tenant ID
 * @param query      - User's question to search for
 * @param pageId     - Facebook Page ID to filter by (or null for global documents)
 * @param threshold  - Minimum similarity score (0.0-1.0, default 0.7)
 * @param maxResults - Maximum number of chunks to return (default 5)
 */
export async function searchDocuments(
  supabase: SupabaseClient,
  provider: AIProviderConfig | AIProviderConfig[],
  userId: string,
  query: string,
  pageId: string | null = null,
  threshold: number = 0.7,
  maxResults: number = 5
): Promise<RAGResult[]> {
  console.log(`[RAG] Searching documents for: "${query.substring(0, 80)}..."`);

  // 1. Generate embedding for the query
  const chain = Array.isArray(provider) ? provider : [provider];
  const [queryEmbedding] = await callEmbeddingWithFailover(chain, query);

  // 2. Call the Supabase match_documents function
  const { data, error } = await supabase.rpc('match_documents', {
    p_user_id: userId,
    p_query_embedding: JSON.stringify(queryEmbedding),
    p_page_id: pageId,
    p_match_threshold: threshold,
    p_match_count: maxResults,
  });

  if (error) {
    console.error('[RAG] ❌ Vector search failed:', error.message);
    return [];
  }

  const results: RAGResult[] = (data ?? []).map((row: any) => ({
    id: row.id,
    content: row.content,
    similarity: row.similarity,
    documentId: row.document_id,
    metadata: row.metadata,
  }));

  console.log(`[RAG] Found ${results.length} relevant chunks (threshold: ${threshold})`);

  return results;
}

/**
 * Result from a RAG similarity search.
 */
export interface RAGResult {
  id: string;
  content: string;
  similarity: number;
  documentId: string;
  metadata: Record<string, unknown>;
}
