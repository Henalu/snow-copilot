// providers/customEndpoint.js
//
// Wraps the current Vercel backend (and any compatible proxy).
// The old "backendUrl" setting is migrated here as customEndpoint.url.
//
// Expected backend contract (matches the existing api/chat.js):
//   POST /api/chat  { action, code, question, context, model? }
//   Response: text/event-stream with  data: {"delta":{"text":"..."}}  chunks

export const customEndpointProvider = {
  id: 'customEndpoint',

  isConfigured(config) {
    return !!(config.enabled && config.url?.trim());
  },

  async *sendPrompt({ action, code, question, context, config, model }) {
    const url = normalizeUrl(config.url);
    const headers = buildHeaders(config);
    const bodyData = { action, code, question, context };
    if (model || config.model?.trim()) bodyData.model = model || config.model;

    const resp = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyData)
    });

    if (!resp.ok) throw new Error(`Custom endpoint error: HTTP ${resp.status}`);

    yield* parseBackendStream(resp.body);
  },

  async testConnection(config) {
    try {
      const url = normalizeUrl(config.url);
      const headers = buildHeaders(config);

      const resp = await fetch(`${url}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'explain', code: '// test', context: {} })
      });

      // 400 means the endpoint is reachable (bad payload is OK for a ping)
      if (resp.status === 400) return { success: true, message: 'Endpoint reachable' };
      if (!resp.ok) return { success: false, message: `HTTP ${resp.status}` };

      // Drain minimal response
      const reader = resp.body.getReader();
      await reader.cancel();

      return { success: true, message: 'Connected successfully' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
};

function normalizeUrl(raw) {
  let url = (raw || '').trim().replace(/\/$/, '');
  if (url && !url.startsWith('http')) url = 'https://' + url;
  return url;
}

function buildHeaders(config) {
  const headers = { 'Content-Type': 'application/json' };
  if (config.apiKey?.trim()) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }
  if (config.headersJson?.trim()) {
    try {
      Object.assign(headers, JSON.parse(config.headersJson));
    } catch { /* invalid JSON — silently skip */ }
  }
  return headers;
}

async function* parseBackendStream(body) {
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
        if (parsed.error) throw new Error(parsed.error);
        const text = parsed.delta?.text;
        if (text) yield text;
      } catch (err) {
        if (err.message !== 'Unexpected end of JSON input') throw err;
      }
    }
  }
}
