function formatRetrievedChunk(chunk) {
  return [
    `[${chunk.rank}] ${chunk.title}`,
    chunk.heading ? `Section: ${chunk.heading}` : '',
    chunk.matchedTerms?.length ? `Signals: ${chunk.matchedTerms.slice(0, 4).join(', ')}` : '',
    `Excerpt: ${chunk.excerpt || chunk.text || ''}`
  ].filter(Boolean).join('\n');
}

export function augmentPromptWithRag(prompt, rag) {
  if (!rag?.enabled) return prompt;

  const system = [
    prompt.system,
    '',
    'Grounding rules for ServiceNow responses:',
    '- Prefer retrieved ServiceNow context when it is relevant to the request.',
    '- Do not invent Glide APIs, table names, methods, helper objects, or platform features.',
    '- Respect server-side vs client-side constraints explicitly.',
    '- If the retrieved context is incomplete or conflicting, say what is uncertain instead of improvising.',
    '- Use the retrieved material as technical grounding, not as a source of long verbatim quotes.'
  ].join('\n');

  if (!rag.selectedChunks?.length) {
    return {
      system,
      user: [
        prompt.user,
        '',
        'Knowledge base retrieval result:',
        '- No highly relevant ServiceNow knowledge-base chunk matched this request.',
        '- Answer carefully using platform-safe reasoning and clearly flag uncertainty where needed.'
      ].join('\n')
    };
  }

  const retrievalBlock = rag.selectedChunks.map(formatRetrievedChunk).join('\n\n');

  return {
    system,
    user: [
      prompt.user,
      '',
      'Retrieved ServiceNow knowledge base context:',
      retrievalBlock,
      '',
      'Use the retrieved context to ground your answer whenever it helps. If it does not fully answer the question, combine it with careful ServiceNow reasoning and state any uncertainty.'
    ].join('\n')
  };
}
