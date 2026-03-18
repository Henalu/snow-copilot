// providers/gemini.js — Google Gemini adapter

import { buildPrompt } from './prompts.js';

export const geminiProvider = {
  id: 'gemini',

  isConfigured(config) {
    return !!(config.enabled && config.apiKey?.trim());
  },

  async *sendPrompt({ action, code, question, context, config, model }) {
    const prompt = buildPrompt(action, code, context, question);
    const modelId = model || config.model || 'gemini-2.0-flash';

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?key=${config.apiKey}&alt=sse`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: prompt.system }] },
          contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
          generationConfig: { maxOutputTokens: 2048 }
        })
      }
    );

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `Gemini API error: HTTP ${resp.status}`);
    }

    yield* parseGeminiStream(resp.body);
  },

  async testConnection(config) {
    try {
      const modelId = config.model || 'gemini-2.0-flash';
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${config.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
            generationConfig: { maxOutputTokens: 5 }
          })
        }
      );

      if (resp.status === 400) {
        const body = await resp.json().catch(() => ({}));
        const msg = body.error?.message || 'Bad request';
        // 400 often means invalid API key for Gemini
        return { success: false, message: msg.includes('API key') ? 'Invalid API key' : msg };
      }
      if (resp.status === 403) return { success: false, message: 'Invalid API key or insufficient permissions' };
      if (!resp.ok) return { success: false, message: `HTTP ${resp.status}` };

      return { success: true, message: 'Connected successfully' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
};

async function* parseGeminiStream(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data) continue;
      try {
        const parsed = JSON.parse(data);
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) yield text;
      } catch { /* incomplete chunk */ }
    }
  }
}
