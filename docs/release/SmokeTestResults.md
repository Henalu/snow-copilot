# Smoke Test Results

Date: 2026-03-28

## Current recorded outcome

These notes capture the latest manual validation shared for release prep.

## Chrome validation passed

- Unpacked install completed successfully.
- Options page opened from the toolbar correctly.
- Settings save worked.
- Settings export and import worked.
- The settings UI still rendered correctly after those flows.

## Provider validation passed in Chrome

The following providers passed save, test connection, and at least one real script action in Chrome:

- Anthropic
- OpenAI
- Gemini
- OpenRouter
- Custom Endpoint
- Local LLM

## Supported contexts passed in Chrome

- Business Rules
- Script Includes
- Client Scripts
- Fix Scripts
- UI Actions
- Scripted REST Resources
- Scheduled Scripts
- Update Sets

## Promotion candidates status

- UI Scripts: passed in Chrome, still pending Edge validation before promotion
- Transform Scripts: passed in Chrome, still pending Edge validation before promotion
- Background Scripts: not detected in Chrome, keep experimental and outside the public support promise

## Store-readiness notes

- Chrome Web Store publisher account is ready.
- Current UI screenshots have already started to be captured.

## Still pending

- Microsoft Partner Center account readiness
- Edge validation
- Final screenshot selection and promo assets
