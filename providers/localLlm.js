// providers/localLlm.js — Local LLM adapter (Ollama-compatible API)
//
// Targets the Ollama API format: POST /api/chat with streaming NDJSON.
// Most local LLM servers (LM Studio, etc.) support the same Ollama format.

import { buildPrompt } from './prompts.js';

export const localLlmProvider = {
  id: 'localLlm',

  isConfigured(config) {
    return !!(config.enabled && config.baseUrl?.trim() && config.model?.trim());
  },

  async *sendPrompt({ action, code, question, context, config, model }) {
    const prompt = buildPrompt(action, code, context, question);
    const baseUrl = normalizeBaseUrl(config.baseUrl);
    const modelId = model || config.model;

    const resp = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user',   content: prompt.user }
        ],
        stream: true
      })
    });

    if (!resp.ok) throw new Error(`Local LLM error: HTTP ${resp.status}`);

    yield* parseOllamaStream(resp.body);
  },

  async testConnection(config) {
    try {
      const baseUrl = normalizeBaseUrl(config.baseUrl);
      // /api/tags lists available models — lightweight check
      const resp = await fetch(`${baseUrl}/api/tags`);
      if (!resp.ok) return { success: false, message: `HTTP ${resp.status}` };
      return { success: true, message: 'Local LLM reachable' };
    } catch (err) {
      return { success: false, message: `Cannot reach local LLM: ${err.message}` };
    }
  }
};

function normalizeBaseUrl(raw) {
  let url = (raw || '').trim().replace(/\/$/, '');
  if (!url) url = 'http://localhost:11434';
  return url;
}

async function* parseOllamaStream(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        const text = parsed.message?.content;
        if (text) yield text;
        if (parsed.done) return;
      } catch { /* incomplete line */ }
    }
  }
}
