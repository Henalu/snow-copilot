// SN Assistant — api/chat.js
// Vercel Serverless Function — Edge Runtime
// Recibe { action, code, question, context } y hace streaming a Claude API

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// ─── Prompts ──────────────────────────────────────────────────────────────────

const SYSTEM_BASE = `You are an expert ServiceNow developer assistant. 
You have deep knowledge of:
- ServiceNow JavaScript (GlideRecord, GlideSystem, GlideDateTime, etc.)
- Business Rules, Script Includes, UI Actions, UI Scripts, Fix Scripts
- ServiceNow best practices, performance considerations, and security
- Glide APIs and the ServiceNow platform architecture

Be concise, practical, and precise. Format code blocks when relevant.`;

function buildPrompt(action, code, context, question) {
  const scriptType = context?.scriptType || 'script';

  switch (action) {
    case 'explain':
      return {
        system: SYSTEM_BASE,
        user: `Explain the following ${scriptType} from a ServiceNow instance.

Be clear and structured:
1. What this script does (2-3 sentences max)
2. Key logic breakdown (step by step)
3. Notable ServiceNow APIs or patterns used
4. Potential issues or things to watch out for

Script:
\`\`\`javascript
${code}
\`\`\``
      };

    case 'comment':
      return {
        system: SYSTEM_BASE,
        user: `Add JSDoc and inline comments to this ${scriptType}.

Rules:
- Add a JSDoc block at the top
- Add inline comments for non-obvious logic
- Keep existing code exactly as-is, only add comments
- Be concise — do not over-comment obvious lines

Return ONLY the commented code, no explanation.

Script:
\`\`\`javascript
${code}
\`\`\``
      };

    case 'refactor':
      return {
        system: SYSTEM_BASE,
        user: `Refactor this ${scriptType} following ServiceNow best practices.

Focus on:
- Performance (avoid queries inside loops, use GlideRecord efficiently)
- Readability (clear variable names, consistent style)
- Error handling (try/catch where appropriate)
- Security (avoid string concatenation in queries)

Return the refactored code first, then a brief bullet list of what changed and why.

Script:
\`\`\`javascript
${code}
\`\`\``
      };

    case 'ask':
      return {
        system: SYSTEM_BASE,
        user: `Question about this ${scriptType}: ${question}

Script:
\`\`\`javascript
${code}
\`\`\`

Answer concisely and directly. Include code examples if helpful.`
      };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const config = {
  runtime: 'edge'
};

export default async function handler(req) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers });
  }

  const { action, code, question = '', context = {} } = body;

  if (!action || !code) {
    return new Response('Missing action or code', { status: 400, headers });
  }

  let prompt;
  try {
    prompt = buildPrompt(action, code, context, question);
  } catch (err) {
    return new Response(err.message, { status: 400, headers });
  }

  // Streaming response via SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        const anthropicStream = await client.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: prompt.system,
          messages: [{ role: 'user', content: prompt.user }]
        });

        for await (const event of anthropicStream) {
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            const data = JSON.stringify({ delta: { text: event.delta.text } });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        const errData = JSON.stringify({ error: err.message });
        controller.enqueue(encoder.encode(`data: ${errData}\n\n`));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      ...headers,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no'
    }
  });
}
