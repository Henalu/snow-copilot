// providers/prompts.js — Shared prompt templates (formerly in api/chat.js)

const SYSTEM_BASE = `You are an expert ServiceNow developer assistant.
You have deep knowledge of:
- ServiceNow JavaScript (GlideRecord, GlideSystem, GlideDateTime, etc.)
- Business Rules, Script Includes, UI Actions, UI Scripts, Fix Scripts
- ServiceNow best practices, performance considerations, and security
- Glide APIs and the ServiceNow platform architecture

Be concise, practical, and precise. Format code blocks when relevant.`;

/**
 * Build the system + user prompt for a given action.
 * @param {string} action  — 'explain' | 'comment' | 'refactor' | 'ask'
 * @param {string} code    — the script content
 * @param {object} context — { scriptType, table, hostname }
 * @param {string} question — free-text question (only used by 'ask')
 * @returns {{ system: string, user: string }}
 */
export function buildPrompt(action, code, context, question = '') {
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

    case 'document':
      return {
        system: SYSTEM_BASE,
        user: `Generate complete technical documentation for this ${scriptType}.

Use the following structure exactly (markdown headings):

# [Descriptive title for the script]

## Overview
What this script does and why it exists (2-4 sentences, business context).

## Trigger / Entry Point
When and how this script executes (e.g. Business Rule timing, Client Script event, REST endpoint, scheduler frequency).

## Inputs & Parameters
Table or list of inputs: variables read from current record, parameters, system properties, etc.

## Logic Description
Numbered step-by-step walkthrough of what the script does, written so both developers and functional consultants can understand it.

## ServiceNow APIs Used
Brief list of Glide APIs, platform objects, or GlideAjax calls (e.g. GlideRecord, gs.getProperty, GlideAggregate).

## Dependencies
Script Includes, tables queried or updated, system properties, other records this script relies on.

## Side Effects & Outputs
What records, fields, or external systems are created/modified/notified as a result.

## Notes & Recommendations
Known limitations, performance considerations, security notes, or suggested improvements.

---

Script (${scriptType}):
\`\`\`javascript
${code}
\`\`\`

Write in English. Be thorough but concise. Use markdown formatting throughout.`
      };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
