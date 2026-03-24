# ServiceNow RAG

## Goal

Provide grounded, ServiceNow-specific answers without turning the extension into a slow or fragile wrapper around generic models.

Current goals:

- improve answer quality for ServiceNow work
- reduce invented APIs and invalid platform advice
- leverage Breaking Trail as a differentiated knowledge source
- stay incremental and fast enough for browser usage

## Current architecture

### Ingestion

Primary source:

- Breaking Trail markdown articles from the local Astro repository

Build step:

```bash
npm run rag:build
```

Output:

- `rag/indexes/breaking-trail.json`

### Index

The bundled index stores flat chunks with:

- article metadata
- heading and URL
- tags and versions
- normalized terms
- ServiceNow-aware signals

This keeps runtime retrieval local and cheap.

### Retrieval

Current strategy:

- `servicenow-hybrid-v1`

Signals include:

- lexical overlap
- ServiceNow API overlap
- artifact hints
- scope hints
- source priority
- diversity limits per document

This is deliberately heuristic, local, and provider-agnostic. No embedding API is required in V1.

### Prompt assembly

Grounding is injected before the provider call. The prompt layer also adds guardrails to:

- avoid made-up APIs
- respect client/server boundaries
- prefer retrieved ServiceNow context over generic advice
- state uncertainty explicitly when evidence is weak

## Action policy

RAG is intentionally selective.

Current default action policy:

- `Explain`: enabled
- `Ask`: enabled
- `Refactor`: disabled
- `Comment`: disabled
- `Document`: disabled
- `Document UpdateSet`: disabled

Why:

- `Explain` and `Ask` benefit most from retrieved ServiceNow context
- `Comment` and `Refactor` often need speed more than extra prompt context
- `Document UpdateSet` already has a strong primary source of truth in the Update Set and Customer Updates

## Performance philosophy

RAG improves grounding, not raw latency.

Tradeoffs:

- retrieval adds work
- more context increases prompt size
- stronger grounding often leads to longer outputs

To keep the extension responsive, the current build uses:

- small chunk limits
- bounded context size
- per-action enablement
- no RAG for Update Set documentation by default

## Runtime controls

Stored in `chrome.storage.sync`:

- global RAG enable/disable
- active sources
- max chunks
- max chunks per document
- max prompt context characters
- trace visibility in panel
- debug logging
- enablement by action

Defaults live in `rag/config.js`.

## Traceability

When trace is enabled, the panel can show:

- selected sources
- matched terms or signals
- retrieval reasoning

This is meant for debugging and trust, not for a full citation UI yet.

## Roadmap

### Near term

- better action-aware retrieval tuning
- more explicit citations in answers
- evaluation set for ServiceNow hallucination control

### Mid term

- hybrid lexical plus embeddings
- additional internal knowledge sources
- ranking improvements for freshness and confidence

### Longer term

- historical implementation knowledge
- update-set-derived internal knowledge bases
- stronger grounding controls for enterprise use cases
