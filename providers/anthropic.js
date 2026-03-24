// providers/anthropic.js — Anthropic Claude adapter

import { buildPrompt } from './prompts.js';
import { getMaxTokensForAction } from './outputBudget.js';
import { readSseEventData } from './streaming.js';

export const anthropicProvider = {
  id: 'anthropic',

  isConfigured(config) {
    return !!(config.enabled && config.apiKey?.trim());
  },

  /**
   * Async generator — yields text chunks as they stream from the API.
   * Caller: for await (const chunk of provider.sendPrompt(...))
   */
  async *sendPrompt({ action, code, question, context, config, model, prompt }) {
    const resolvedPrompt = prompt || buildPrompt(action, code, context, question);
    const modelId = model || config.model || 'claude-sonnet-4-6';
    const maxTokens = getMaxTokensForAction(action, 2048);

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        // Required header for direct browser-side Anthropic API usage
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: maxTokens,
        system: resolvedPrompt.system,
        messages: [{ role: 'user', content: resolvedPrompt.user }],
        stream: true
      })
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `Anthropic API error: HTTP ${resp.status}`);
    }

    yield* parseAnthropicStream(resp.body);
  },

  async testConnection(config) {
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: config.model || 'claude-haiku-4-5-20251001',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      });

      if (resp.status === 401) return { success: false, message: 'Invalid API key' };
      if (resp.status === 403) return { success: false, message: 'Access forbidden — check API key permissions' };
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

async function* parseAnthropicStream(body) {
  for await (const data of readSseEventData(body)) {
    if (!data) continue;
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
        yield parsed.delta.text;
      }
    } catch {
      // Ignore malformed partial events.
    }
  }
}
