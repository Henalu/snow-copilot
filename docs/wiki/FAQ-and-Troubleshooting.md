# FAQ & Troubleshooting

---

## Frequently Asked Questions

### Which AI provider should I use?

| Use case | Recommended |
|---|---|
| Best overall quality | Anthropic Claude Sonnet 4.6 |
| Fastest responses | Claude Haiku 4.5 or GPT-4o Mini |
| No API key / free | Local LLM with Ollama |
| Multiple models with one key | OpenRouter |
| Keep keys server-side | Custom Endpoint (your own Vercel proxy) |

The **Smart Defaults** feature in Settings → Smart Defaults can recommend the best provider per action based on your enabled providers.

---

### Is my API key safe?

Yes. API keys are stored in `chrome.storage.sync`, which is local to your Chrome browser profile. They are only sent directly to the AI provider you configured (Anthropic, OpenAI, etc.) — SN Assistant does not have a backend that receives your keys.

The only exception is if you use **Custom Endpoint**, in which case your own server receives the requests.

---

### Which ServiceNow record types are supported?

Business Rules, Script Includes, Client Scripts, Fix Scripts, UI Actions, Scripted REST Resources, and Scheduled Scripts are verified. UI Scripts, Transform Scripts, and Background Scripts are in progress.

If a record type isn't detected, see [The trigger button doesn't appear](#the-trigger-button-does-not-appear).

---

### Does it work with ServiceNow Polaris (Next Experience)?

Yes. SN Assistant supports both Classic UI and Polaris. The detection logic automatically handles the different DOM structures.

---

### Can I use it on multiple ServiceNow instances?

Yes. The extension activates on any domain that matches `*.service-now.com`. Your settings apply across all instances.

---

### Why does the Document action download a `.doc` file instead of `.docx`?

The `.doc` format is generated as an HTML document with Word-compatible markup — no external libraries required. Microsoft Word and Google Docs open it correctly. If you need `.docx` format, open the `.doc` in Word and save as `.docx`.

---

## Troubleshooting

### The trigger button does not appear

**Step 1:** Open DevTools (F12). In ServiceNow, you may need to switch the DevTools context from `top` to `gsft_main` (dropdown in the Console tab header).

**Step 2:** Run this in the console to check detection:
```js
detectRecordType()
```
If `isKnown: false` is returned, the record type is not yet in the extension's map. [Open a feature request](https://github.com/Henalu/snow-copilot/issues/new?template=feature_request.yml) to add support for it.

**Step 3:** Run:
```js
detectScriptEditor()
```
If this returns `null`, the Monaco editor was not detected. Try listing visible textareas:
```js
Array.from(document.querySelectorAll('textarea')).map(t => t.id)
```

**Step 4:** Make sure you are on the script editor form, not a list view.

---

### The trigger appears but nothing happens when I click it

- Check the service worker console: go to `chrome://extensions` → SN Assistant → **Service Worker** → Inspect → Console
- Look for errors related to the AI provider (network errors, invalid API key, etc.)
- Verify your API key in Options → the provider should show **Configured** in green

---

### I get a "CSP error" or "Refused to execute inline script" in the console

These errors are from **ServiceNow itself**, not from SN Assistant. ServiceNow uses inline event handlers internally which violate its own CSP — this is expected and does not affect the extension. Ignore errors that reference ServiceNow URLs.

---

### The AI response looks like raw markdown (asterisks, hashes)

This should not happen with v0.4+. If you see raw markdown:
- Reload the extension: `chrome://extensions` → SN Assistant → refresh icon (↻)
- Hard-reload the ServiceNow page (Ctrl+Shift+R)

---

### The Anthropic provider returns a 400 error: "direct browser access not allowed"

This means the `anthropic-dangerous-direct-browser-access: true` header is not being sent. This would indicate an older version of the extension. Update to the latest version.

---

### The panel appears but stays in the wrong position after dragging

Click the **⊞ button** in the panel header to reset the panel to its original position and size.

---

### Local LLM (Ollama) doesn't connect

1. Make sure Ollama is running: `ollama serve`
2. Verify the model is pulled: `ollama list`
3. Test the endpoint manually: `curl http://localhost:11434/api/tags`
4. Chrome extensions cannot reach `localhost` in some configurations — try `http://127.0.0.1:11434` as the Base URL instead

---

### My settings disappeared after updating the extension

This can happen if the extension ID changes (e.g. after removing and re-adding in developer mode). Settings are tied to the extension ID in `chrome.storage.sync`.

If you previously exported a backup (Options → Data → Export settings), you can restore it with Import settings.

---

## Still stuck?

[Open a bug report](https://github.com/Henalu/snow-copilot/issues/new?template=bug_report.yml) with as much detail as possible — especially the console output from DevTools and the service worker inspector.
