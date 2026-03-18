// providers/openai.js — OpenAI adapter (also compatible with OpenAI-format endpoints)

import { buildPrompt } from './prompts.js';

export const openaiProvider = {
  id: 'openai',

  isConfigured(config) {
    return !!(config.enabled && config.apiKey?.trim());
  },

  async *sendPrompt({ action, code, question, context, config, model }) {
    const prompt = buildPrompt(action, code, context, question);
    const modelId = model || config.model || 'gpt-4o-mini';
    const baseUrl = normalizeBaseUrl(config.baseUrl, 'https://api.openai.com/v1');

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 2048,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user',   content: prompt.user }
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
  const reader = body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]' || !data) continue;
      try {
        const parsed = JSON.parse(data);
        const text = parsed.choices?.[0]?.delta?.content;
        if (text) yield text;
      } catch { /* incomplete chunk */ }
    }
  }
}
