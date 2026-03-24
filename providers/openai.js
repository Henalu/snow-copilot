// providers/openai.js — OpenAI adapter (also compatible with OpenAI-format endpoints)

import { buildPrompt } from './prompts.js';
import { getMaxTokensForAction } from './outputBudget.js';
import { readSseEventData } from './streaming.js';

export const openaiProvider = {
  id: 'openai',

  isConfigured(config) {
    return !!(config.enabled && config.apiKey?.trim());
  },

  async *sendPrompt({ action, code, question, context, config, model, prompt }) {
    const resolvedPrompt = prompt || buildPrompt(action, code, context, question);
    const modelId = model || config.model || 'gpt-4o-mini';
    const baseUrl = normalizeBaseUrl(config.baseUrl, 'https://api.openai.com/v1');
    const maxTokens = getMaxTokensForAction(action, 2048);

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: resolvedPrompt.system },
          { role: 'user',   content: resolvedPrompt.user }
        ],
        stream: true
      })
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `OpenAI API error: HTTP ${resp.status}`);
    }

    yield* parseOpenAIStream(resp.body);
  },

  async testConnection(config) {
    try {
      const baseUrl = normalizeBaseUrl(config.baseUrl, 'https://api.openai.com/v1');
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model || 'gpt-4o-mini',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      });

      if (resp.status === 401) return { success: false, message: 'Invalid API key' };
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        return { success: false, message: body.error?.message || `HTTP ${resp.status}` };
      }

      return { success: true, message: 'Connected successfully' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
};

function normalizeBaseUrl(url, fallback) {
  if (!url?.trim()) return fallback;
  return url.trim().replace(/\/$/, '');
}

export async function* parseOpenAIStream(body) {
  for await (const data of readSseEventData(body)) {
    if (data === '[DONE]' || !data) continue;
    try {
      const parsed = JSON.parse(data);
      const text = parsed.choices?.[0]?.delta?.content;
      if (text) yield text;
    } catch {
      // Ignore malformed partial events.
    }
  }
}
