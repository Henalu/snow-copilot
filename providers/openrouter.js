// providers/openrouter.js — OpenRouter adapter (OpenAI-compatible format)

import { buildPrompt } from './prompts.js';
import { parseOpenAIStream } from './openai.js';

export const openrouterProvider = {
  id: 'openrouter',

  isConfigured(config) {
    return !!(config.enabled && config.apiKey?.trim() && config.model?.trim());
  },

  async *sendPrompt({ action, code, question, context, config, model }) {
    const prompt = buildPrompt(action, code, context, question);
    const modelId = model || config.model;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'HTTP-Referer': 'https://sn-assistant.extension',
      'X-Title': config.siteName?.trim() || 'SN Assistant'
    };

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
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
      throw new Error(errBody.error?.message || `OpenRouter error: HTTP ${resp.status}`);
    }

    yield* parseOpenAIStream(resp.body);
  },

  async testConnection(config) {
    try {
      // Use the models endpoint for a lightweight auth check
      const resp = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': `Bearer ${config.apiKey}` }
      });

      if (resp.status === 401) return { success: false, message: 'Invalid API key' };
      if (!resp.ok) return { success: false, message: `HTTP ${resp.status}` };

      return { success: true, message: 'Connected successfully' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
};
