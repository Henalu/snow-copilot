# Actions Reference

SN Assistant provides five actions, accessible from the sidebar panel that appears when a script editor is detected.

---

## Explain

**What it does:** Analyzes the script and produces a plain-language explanation covering:
- What the script does overall
- The main logic flow
- ServiceNow APIs and GlideRecord calls used
- Triggers, inputs, and outputs
- Any notable side effects

**When to use it:**
- When you inherit a script written by someone else
- When reviewing a Business Rule or Script Include you haven't seen before
- When onboarding to a new ServiceNow instance

**Tips:**
- Works best with complete scripts rather than fragments
- For complex scripts, the explanation may include a numbered walkthrough of the main steps

---

## Comment

**What it does:** Adds documentation to the script:
- JSDoc block at the top of functions
- Inline comments explaining non-obvious logic
- Parameter and return type annotations where applicable

**When to use it:**
- Before handing off code to another developer
- When preparing for a code review
- When you want to document a script you wrote

**Tips:**
- Review the generated comments before saving — the AI may occasionally misinterpret intent
- Works particularly well on Script Includes and Business Rules

---

## Refactor

**What it does:** Rewrites the script to improve:
- Code readability and structure
- Adherence to ServiceNow development best practices
- Performance (e.g. proper use of GlideRecord queries, avoiding client-side GlideRecord)
- Error handling
- Naming conventions

**When to use it:**
- When cleaning up legacy scripts
- When preparing a script for production
- When optimizing for performance

**Tips:**
- Always test the refactored code in a dev/test instance before applying to production
- The refactored version preserves the original business logic — verify this before deploying

---

## Ask

**What it does:** Opens a free-form question input where you can ask anything about the script. The AI has the full script as context.

Example questions:
- "What happens if the user field is empty?"
- "Is there a race condition here?"
- "How would I add support for the change_request table?"
- "Why is this calling GlideRecord inside a loop?"

**When to use it:**
- When you have a specific question that the other actions don't cover
- When debugging unexpected behavior
- When exploring how to extend the script

---

## Document

**What it does:** Generates a full technical documentation document for the script, covering eight sections:

1. **Overview** — Purpose and scope
2. **Trigger / Entry Point** — When and how the script executes
3. **Inputs & Parameters** — Data the script receives
4. **Logic Description** — Step-by-step walkthrough
5. **ServiceNow APIs Used** — GlideRecord, GlideScopedEvaluator, etc.
6. **Dependencies** — Other scripts, tables, or system properties
7. **Side Effects & Outputs** — What the script changes or returns
8. **Notes & Recommendations** — Edge cases, warnings, suggestions

The document is automatically downloaded as a `.doc` file (Word-compatible) when the AI finishes generating it.

**When to use it:**
- When creating formal technical documentation for a client or team
- Before handing off a ServiceNow implementation
- For compliance or audit requirements
- When building a technical runbook

**Tips:**
- The `.doc` file can be opened directly in Microsoft Word or Google Docs
- Use a premium model (Claude Sonnet, GPT-4.1) for best results — the Smart Defaults recommendation engine assigns Document to higher-quality models automatically

---

## Panel Controls

| Element | Function |
|---|---|
| ⚡ trigger button | Opens / closes the panel |
| × button | Closes the panel (trigger remains visible) |
| ⊞ button | Resets panel to original position and size |
| Panel header | Drag to move the panel freely |
| Left edge | Drag to resize horizontally |
| Bottom edge | Drag to resize vertically |
| Bottom-left corner | Drag to resize both dimensions |
