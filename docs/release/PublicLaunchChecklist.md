# Public Launch Checklist

## Product and scope

- Confirm the public promise stays limited to verified contexts:
  - Business Rules
  - Script Includes
  - Client Scripts
  - Fix Scripts
  - UI Actions
  - Scripted REST Resources
  - Scheduled Scripts
  - Update Sets
- Keep UI Scripts, Transform Scripts, and Background Scripts labeled as evolving or non-GA.
- Only promote UI Scripts, Transform Scripts, or Background Scripts into the public support promise after they pass manual validation in both Chrome and Edge.
- Keep the launch model free and accountless for v1 public release.

## Store readiness

- Create or verify the Chrome Web Store publisher account.
- Create or verify the Microsoft Partner Center account for Edge Add-ons.
- Final public URLs:
  - product homepage: `https://snow-copilot.vercel.app/`
  - privacy policy: `https://snow-copilot.vercel.app/privacy/`
  - terms of use: `https://snow-copilot.vercel.app/terms/`
  - support page: `https://snow-copilot.vercel.app/support/`
- Finalize store screenshots from the current real UI.
- Finalize the 128x128 icon, small promo tile, and release notes.

## Product trust and disclosures

- Verify the privacy policy matches the actual storage model:
  - non-sensitive preferences in `chrome.storage.sync`
  - provider secrets in `chrome.storage.local`
- Verify the listing copy clearly says users bring their own provider or endpoint in v1.
- Verify support is described as best-effort.
- Verify no claim implies guaranteed correctness, code safety, or official ServiceNow affiliation.

## Submission packaging

- Run `npm run package:extension`.
- Zip the contents of `dist/sn-assistant-extension` instead of zipping the full repository root.
- Check that `manifest.json` version and listing version notes match.
- Confirm the options page and injected sidebar have no remote font or stylesheet dependency.
- Confirm requested permissions are still justified for store review.

## Post-submission

- Track review status daily in Chrome Web Store and Partner Center.
- Prepare a short launch post with install, setup, and support links.
- Triage first issues within 24 hours of public availability.
