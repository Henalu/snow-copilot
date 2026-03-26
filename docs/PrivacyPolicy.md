# SN Assistant Privacy Policy

Last updated: 2026-03-26

## Overview

SN Assistant is a browser extension for ServiceNow developers. This policy explains what data the extension handles, where that data goes, and what choices users have.

## What SN Assistant stores locally

SN Assistant stores configuration in two browser storage areas:

- `chrome.storage.sync` for non-sensitive preferences such as enabled providers, selected models, routing, preferred language, RAG settings, and Update Set documentation settings
- `chrome.storage.local` for provider secrets such as API keys and custom authentication headers

Provider secrets stay on the current browser profile and do not sync across browsers by default.

## What content SN Assistant reads from ServiceNow

Depending on the action used, SN Assistant may read:

- script content from supported ServiceNow editor forms
- page metadata such as table, `sys_id`, and detected record type
- Update Set form fields
- visible Customer Updates related-list data
- `sys_update_xml` payload details when `Deep` Update Set mode is enabled

## Where user content is sent

SN Assistant does not have to send content to a central SN Assistant server.

By default, content is sent only to the AI provider or endpoint chosen by the user, such as:

- Anthropic
- OpenAI
- Google Gemini
- OpenRouter
- a user-configured Custom Endpoint
- a local model endpoint such as Ollama or LM Studio

If the user selects `Custom Endpoint`, the destination and its privacy practices are controlled by that endpoint owner.

If the user selects `Local LLM`, content may remain entirely on the local machine.

## RAG and local knowledge

The current RAG knowledge base bundled with the extension is local to the extension package.

- Breaking Trail content is indexed ahead of time and shipped inside the extension package
- retrieval happens locally inside the extension runtime
- the bundled knowledge base does not require sending data to a separate retrieval service

## Data we do not intentionally collect

SN Assistant does not intentionally collect, sell, or broker:

- analytics tied to a named SN Assistant account
- central behavioral profiles
- ad tracking data
- unrelated browsing activity

At the current stage, the extension does not require a user account to function.

## Third-party services

When a user configures an external AI provider, that provider receives the request content necessary to generate a response. Each provider has its own terms and privacy practices.

Users are responsible for reviewing the policies of the providers and endpoints they choose to use.

## Support and user-submitted information

If a user contacts support through GitHub issues, discussions, or a future support inbox, any information voluntarily shared in that support request may be used to troubleshoot the reported issue.

Users should avoid posting sensitive production data in public support channels.

## Security notes

- provider secrets are stored in the user's local browser profile storage
- requests are made from the extension runtime to the configured provider or endpoint
- the extension is designed so provider calls happen through the service worker, not through the ServiceNow page DOM
- exported settings files include secrets and should be handled like credentials

No system can guarantee absolute security, and users remain responsible for choosing where and how they send sensitive data.

## User choices

Users can:

- choose which provider to use
- disable providers
- use a local model
- disable RAG
- disable `Deep` Update Set mode
- remove the extension and its stored settings

## Changes to this policy

This policy may be updated as the product evolves. The latest version should be published at the public policy URL referenced by the product documentation and store listing.

## Contact

Current support surface:

- [GitHub Issues](https://github.com/Henalu/snow-copilot/issues)
- [GitHub Discussions](https://github.com/Henalu/snow-copilot/discussions)
