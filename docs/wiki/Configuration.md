# Configuration

Open extension settings from the Chrome toolbar icon, then choose **Options**.

## Behavior

### Preferred response language

Choose the default language for generated answers and documents:

- `English`
- `Spanish`

This applies to `Explain`, `Comment`, `Refactor`, `Ask`, `Document`, and `Document UpdateSet`.

### Auto-show

Controls whether the extension shows its trigger automatically when a supported context is detected.

## Update Set documentation

### Documentation mode

- `List-first`: fastest option, uses the Update Set form plus visible Customer Updates metadata
- `Deep`: slower but richer, attempts to read `sys_update_xml` payloads and script previews when possible

### Deep mode limits

The current settings also expose:

- fetch limit
- fetch concurrency

These keep `Deep` mode useful without overwhelming the browser tab.

## RAG

RAG is designed to improve grounding quality for ServiceNow answers, especially `Explain` and `Ask`.

Current source:

- Breaking Trail

Current controls include:

- enable or disable RAG
- enable or disable the bundled source
- chunk and context limits
- show retrieval trace in the panel
- debug logging
- enable RAG by action

Current default policy:

- `Explain`: on
- `Ask`: on
- `Comment`: off
- `Refactor`: off
- `Document`: off
- `Document UpdateSet`: off

## Providers

You can enable one or more providers and route different actions to different models.

### Anthropic Claude

Recommended default for high-quality coding and documentation tasks.

### OpenAI

Good general-purpose alternative with strong model variety.

### Google Gemini

Good speed/quality balance.

### OpenRouter

Useful when you want access to many models through one API key.

### Custom Endpoint

Use your own backend or proxy if you want:

- centralized logging
- server-side key handling
- custom auth
- custom business logic

### Local LLM

Use Ollama or LM Studio for local-only usage.

## Routing

The extension supports:

- a default provider
- optional action-based routing
- recommended provider/model combinations

This lets you keep fast models for lightweight work and stronger models for documentation or complex analysis.

## Data and privacy

- API keys are stored in `chrome.storage.sync`
- keys are only sent to the provider you choose
- the RAG index is bundled locally inside the extension package
- `Deep` Update Set mode reads additional XML payload data from the active ServiceNow instance
