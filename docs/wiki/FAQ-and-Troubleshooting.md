# FAQ and Troubleshooting

## FAQ

### Which provider should I use?

General recommendation:

- best overall quality: Anthropic Claude Sonnet
- fastest inexpensive usage: Claude Haiku or GPT-4o Mini
- many models with one key: OpenRouter
- no cloud API key: Local LLM
- server-side control: Custom Endpoint

### Is RAG supposed to be faster?

Not usually. RAG is primarily about grounding and answer quality, not raw latency.

It can add extra retrieval work and more prompt context, so it is usually a little slower. That is why the extension enables RAG selectively, not for every action.

### Why is `Document UpdateSet` not using RAG by default?

Because the Update Set itself is already the main source of truth. For this action, speed and reliability matter more than adding secondary retrieval context.

### What is the difference between `List-first` and `Deep`?

- `List-first`: faster, uses visible metadata from the Update Set and related list
- `Deep`: slower, tries to read more technical detail from `sys_update_xml`

### Can I change the language of the output?

Yes. The preferred response language can be set in Options. Current choices are English and Spanish.

### Does the extension support Update Sets now?

Yes. `Document UpdateSet` is available when a `sys_update_set` form is detected.

## Troubleshooting

### The trigger button does not appear

1. Open DevTools
2. Switch console context to `gsft_main` if needed
3. Run:

```js
detectRecordType()
```

4. Then run:

```js
detectScriptEditor()
```

If you are on an Update Set form instead of a script form, the relevant detection is the Update Set context, not Monaco editor detection.

### The extension shows `Extension context invalidated`

This usually means the extension was reloaded but the ServiceNow tab was not refreshed. Reload the extension in `chrome://extensions`, then refresh the ServiceNow tab completely.

### `Document UpdateSet` takes too long

Check the execution trace inside the panel.

The most useful checkpoints are:

- `Captured Update Set data`
- `Prompt prepared`
- `Model started responding`
- `Generation in progress`
- `Preparing Word download`

If the trace stops early, the issue is usually capture or prompt preparation. If it stops after model start, the issue is usually generation time or output size.

### `Document UpdateSet` output looks generic

Try these steps:

1. Make sure useful columns are visible in the Customer Updates related list
2. Add business or technical context in the sidebar textarea
3. Switch to `Deep` mode for richer technical evidence

### The answer looks like raw markdown

Reload the extension and hard-refresh the page. Recent builds render long outputs more defensively, but a stale content script can still show older behavior.

### Anthropic returns a direct browser access error

Update to the latest build. The provider adapter must send the required direct browser access header.

### The service worker shows no useful logs

Use the in-panel execution trace first for Update Set documentation. It is often more useful than the browser console for long actions.
