/**
 * Compresses Brand Voice Profile by trimming excess whitespace.
 */
export function compressBrandVoice(profile: string | null | undefined): string {
  if (!profile) return 'Friendly, professional, and clear.';
  return profile.replace(/\s+/g, ' ').trim();
}

/**
 * Formats QA fields into a dense key-value format.
 */
export function compressQaContext(qas: { field_name: string; field_value: string }[] | null | undefined): string {
  if (!qas || qas.length === 0) return '';
  return qas
    .map(q => `${q.field_name.trim()}: ${q.field_value.trim()}`)
    .join('\n')
    .slice(0, 1500);
}

/**
 * Formats RAG documents cleanly, stripping extra whitespace and capping overall character length.
 */
export function compressRagDocs(docs: string | null | undefined, maxChars: number = 2500): string {
  if (!docs) return '';
  return docs
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}
