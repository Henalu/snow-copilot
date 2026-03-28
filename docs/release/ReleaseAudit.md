# Release Audit

Date: 2026-03-28

## Passed

- Manifest V3 architecture is already in place.
- Scope for public support is explicitly limited to verified ServiceNow contexts.
- Privacy, terms, support, and brand foundation docs already exist.
- The extension has a clear single purpose for store review: ServiceNow development assistance.
- Provider calls are centralized through the service worker.
- The packaging command completes and stages `dist/sn-assistant-extension` for submission.

## Hardened in this release-prep pass

- Removed remote Google Fonts dependency from the settings page.
- Removed remote Google Fonts dependency from the injected ServiceNow sidebar.
- Moved provider secrets out of synced settings and into local browser storage.
- Added a toolbar action so public users have a clear way to open the product surface.
- Removed the unused `scripting` permission from the manifest.
- Added release operations docs for launch, smoke tests, listing copy, and monetization.
- Removed the duplicate root `chat.js` so `api/chat.js` is the single backend reference point.
- Confirmed the public site routes are live at the final launch URLs.

## Current manual validation status

- Chrome clean-profile flow passed: unpacked install, options access, save, export, import, and visual sanity checks.
- Anthropic, OpenAI, Gemini, OpenRouter, Custom Endpoint, and Local LLM passed save, test-connection, and at least one real script action in Chrome.
- Verified contexts passed in Chrome: Business Rules, Script Includes, Client Scripts, Fix Scripts, UI Actions, Scripted REST Resources, Scheduled Scripts, and Update Sets.
- UI Scripts and Transform Scripts behaved successfully in the current Chrome validation pass.
- Background Scripts were not detected in Chrome and remain outside the public support promise.
- Chrome Web Store publisher account is ready.

## Remaining external blockers

- Microsoft Partner Center release account still needs to be ready for submission.
- Edge validation still needs to be completed for launch parity.
- UI Scripts and Transform Scripts still need Edge validation before any public support-scope promotion.
- Final store screenshots set and promo assets still need to be finalized from the current UI.

## Remaining product risks to watch

- Browser-direct provider calls may receive stricter review scrutiny than a proxy-only model.
- `Custom Endpoint` can point to any backend, so privacy copy must stay explicit about third-party handling.
- `Local LLM` remains an advanced path and should stay clearly labeled.
- Update Set `Deep` mode may vary by instance customization and payload size.
