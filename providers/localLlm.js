// providers/localLlm.js — Local LLM adapter (Ollama-compatible API)
//
// Targets the Ollama API format: POST /api/chat with streaming NDJSON.
// Most local LLM servers (LM Studio, etc.) support the same Ollama format.

import { buildPrompt } from './prompts.js';
import { readNdjsonLines } from './streaming.js';

export const localLlmProvider = {
  id: 'localLlm',

  isConfigured(config) {
    return !!(config.enabled && config.baseUrl?.trim() && config.model?.trim());
  },

  async *sendPrompt({ action, code, question, context, config, model, prompt }) {
    const resolvedPrompt = prompt || buildPrompt(action, code, context, question);
    const baseUrl = normalizeBaseUrl(config.baseUrl);
    const modelId = model || config.model;

    const resp = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: resolvedPrompt.system },
          { role: 'user',   content: resolvedPrompt.user }
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
  for await (const line of readNdjsonLines(body)) {
    try {
      const parsed = JSON.parse(line);
      const text = parsed.message?.content;
      if (text) yield text;
      if (parsed.done) return;
    } catch {
      // Ignore malformed partial lines.
    }
  }
}
