// providers/prompts.js — Shared prompt templates

import { augmentPromptWithRag } from '../rag/prompt.js';

const SYSTEM_BASE = `You are an expert ServiceNow developer assistant.
You have deep knowledge of:
- ServiceNow JavaScript (GlideRecord, GlideSystem, GlideDateTime, etc.)
- Business Rules, Script Includes, UI Actions, UI Scripts, Fix Scripts
- ServiceNow best practices, performance considerations, and security
- Glide APIs and the ServiceNow platform architecture

Be concise, practical, and precise. Format code blocks when relevant.

Important reliability rules:
- Prefer valid ServiceNow platform patterns over generic JavaScript advice.
- Do not invent Glide APIs, helper objects, unsupported methods, or fake platform capabilities.
- Respect server-side vs client-side execution constraints explicitly.
- If the context is incomplete, say what is uncertain instead of guessing.`;

const RESPONSE_LANGUAGE_META = {
  en: {
    label: 'English',
    documentInstruction: 'Write the document in English and keep the section headings in English.'
  },
  es: {
    label: 'Spanish',
    documentInstruction: 'Write the document in Spanish and translate the section headings naturally into Spanish.'
  }
};

function resolveResponseLanguage(responseLanguage) {
  return RESPONSE_LANGUAGE_META[responseLanguage] || RESPONSE_LANGUAGE_META.en;
}

function buildSystemPrompt(action, responseLanguage) {
  const language = resolveResponseLanguage(responseLanguage);
  const languageInstruction = action === 'comment'
    ? `Write all code comments, JSDoc blocks, and any explanatory prose in ${language.label}. Keep code, identifiers, APIs, tables, and field names unchanged unless the source already localizes them.`
    : `Write all natural-language output in ${language.label}. Keep code, identifiers, APIs, tables, and field names unchanged unless the source already localizes them.`;

  return `${SYSTEM_BASE}\n\nPreferred response language:\n- ${languageInstruction}`;
}

export function buildPrompt(action, code, context, question = '', promptContext = {}) {
  const scriptType = context?.scriptType || 'script';
  const responseLanguage = resolveResponseLanguage(promptContext.responseLanguage);
  const systemPrompt = buildSystemPrompt(action, promptContext.responseLanguage);
  let prompt = null;

  switch (action) {
    case 'explain':
      prompt = {
        system: systemPrompt,
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
      break;

    case 'comment':
      prompt = {
        system: systemPrompt,
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
      break;

    case 'refactor':
      prompt = {
        system: systemPrompt,
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
      break;

    case 'ask':
      prompt = {
        system: systemPrompt,
        user: `Question about this ${scriptType}: ${question}

Script:
\`\`\`javascript
${code}
\`\`\`

Answer concisely and directly. Include code examples if helpful.`
      };
      break;

    case 'document':
      prompt = {
        system: systemPrompt,
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

${responseLanguage.documentInstruction}
Be thorough but concise. Use markdown formatting throughout.`
      };
      break;

    case 'documentUpdateSet':
      prompt = {
        system: systemPrompt,
        user: `Generate change documentation for this ServiceNow Update Set.

Your goal is to document the package as a coherent change set, not as isolated records.

Use the following structure exactly:

# [Descriptive title for the change package]

## Executive Summary
Summarize the change in plain language and explain what it enables.

## Functional Scope
Describe the business capability or workflow affected by this package.

## Change Inventory
Group the captured updates by artifact type and explain what changed in each group.

## Technical Implementation Notes
Explain important implementation details, ServiceNow artifacts, and platform patterns involved.

## Dependencies and Risks
List dependencies, assumptions, rollout risks, and areas that may need validation.

## Suggested Validation
Describe how a team should test or validate the package after deployment.

## Open Questions / Unknowns
Be explicit about anything that cannot be inferred from the captured metadata alone.

Writing constraints:
- Keep the full document concise and delivery-ready.
- Target roughly 600-900 words.
- Use short paragraphs or bullets.
- Avoid markdown tables and blockquotes.
- Do not narrate every customer update individually.
- When many similar records exist, summarize them as counts and mention at most 2-3 representative examples per group.
- Always include every required section. If the response is getting long, shorten each section instead of omitting the final sections.

Captured update-set brief:
\`\`\`text
${code}
\`\`\`

Additional context:
- Captured source: update set form with related customer updates
- Inferred purpose: ${context?.inferredPurpose || 'Not inferred'}
- Update count: ${context?.packageStats?.updateCount ?? 0}
- Group count: ${context?.packageStats?.groupCount ?? 0}
- Deep payload updates captured: ${context?.packageStats?.deepUpdateCount ?? 0}
- Updates with script previews: ${context?.packageStats?.scriptedUpdateCount ?? 0}

Interpretation notes:
- The Update count refers to visible Customer Updates captured from the related list.
- If deep payload updates captured is 0, that does NOT mean there were 0 Customer Updates. It only means XML-level enrichment was unavailable for this run.
- Do not say that the package lacks Customer Updates unless Update count is actually 0.

${responseLanguage.documentInstruction}
Be grounded, practical, and explicit when metadata is insufficient.
If deep payload details or script previews are present, treat them as the strongest technical evidence.
Prefer grouped summaries over record-by-record narration.
Keep the document reasonably compact and avoid unnecessary verbosity.`
      };
      break;

    default:
      throw new Error(`Unknown action: ${action}`);
  }

  return augmentPromptWithRag(prompt, promptContext.rag);
}
