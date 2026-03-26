# Release Audit

Date: 2026-03-26

## Passed

- Manifest V3 architecture is already in place.
- Scope for public support is explicitly limited to verified ServiceNow contexts.
- Privacy, terms, support, and brand foundation docs already exist.
- The extension has a clear single purpose for store review: ServiceNow development assistance.
- Provider calls are centralized through the service worker.

## Hardened in this release-prep pass

- Removed remote Google Fonts dependency from the settings page.
- Moved provider secrets out of synced settings and into local browser storage.
- Added a toolbar action so public users have a clear way to open the product surface.
- Removed the unused `scripting` permission from the manifest.
- Added release operations docs for launch, smoke tests, listing copy, and monetization.

## Remaining external blockers

- Store screenshots and promo assets still need to be captured from the current UI.
- End-to-end provider validation still needs manual runtime testing.
- The public site routes now exist in-repo for Vercel and still need the normal deploy/push cycle before store submission.

## Remaining product risks to watch

- Browser-direct provider calls may receive stricter review scrutiny than a proxy-only model.
- `Custom Endpoint` can point to any backend, so privacy copy must stay explicit about third-party handling.
- `Local LLM` remains an advanced path and should stay clearly labeled.
- Update Set `Deep` mode may vary by instance customization and payload size.
