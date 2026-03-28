# SN Assistant Support

Last updated: 2026-03-26

## Current support channels

At the current stage, SN Assistant support is handled through:

- [GitHub Issues](https://github.com/Henalu/snow-copilot/issues) for bugs and reproducible problems
- [GitHub Discussions](https://github.com/Henalu/snow-copilot/discussions) for questions, usage help, and product feedback

## What to include in a bug report

To get useful help quickly, include:

- ServiceNow UI context
  - Classic UI or Polaris
  - table or record type
- action used
  - `Explain`, `Ask`, `Document`, `Document UpdateSet`, etc.
- provider and model used
- whether RAG was enabled
- whether Update Set mode was `List-first` or `Deep`
- what happened
- what you expected
- any execution trace details
- any relevant console or service worker errors

## Recommended debug details

For script actions:

- detected record type
- whether the editor was visible
- whether the issue reproduces after reloading the extension and refreshing the tab

For Update Set documentation:

- last visible line in `Execution Trace`
- `updateCount`, `deepFetched`, `outputChars`, or other visible trace values

## Current support scope

Priority support scope for the current build:

- verified script contexts
- Update Set documentation
- provider configuration
- RAG settings and grounding behavior
- language settings

## Known limitations

Current boundary for what is still validating versus what remains outside the guaranteed scope:

- UI Scripts and Transform Scripts passed the current Chrome validation pass, but they still need Edge validation before moving into the public support promise
- Background Scripts are not currently detected reliably and remain outside the guaranteed scope
- unusual ServiceNow layout edge cases and heavily customized instances can still behave differently

## Response expectations

Support is currently best-effort. There is no guaranteed SLA yet.

If paid plans are introduced later, support tiers can be separated more clearly.

## Public release note

The initial public release is expected to remain self-serve:

- free extension distribution
- user-managed provider setup
- best-effort product support through the public channels above

## Safety note

Do not post sensitive customer data, production secrets, or confidential scripts in public issue threads.

If a future private support inbox is introduced, sensitive reports should go there instead.
