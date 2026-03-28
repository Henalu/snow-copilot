# Smoke Test Checklist

## Clean profile setup

- Install the unpacked extension in a clean Chrome profile.
- Open the options page from the toolbar action.
- Confirm provider secrets persist locally after save and reload.
- Export settings and verify the warning about secrets is visible.
- Import the same file and confirm settings render correctly before save.

## Supported contexts

- Business Rule: `Explain`, `Ask`, `Comment`, `Refactor`, `Document`
- Script Include: `Explain`, `Ask`, `Comment`, `Refactor`, `Document`
- Client Script: `Explain`, `Ask`, `Comment`, `Refactor`, `Document`
- Fix Script: `Explain`, `Ask`, `Comment`, `Refactor`, `Document`
- UI Action: `Explain`, `Ask`, `Comment`, `Refactor`, `Document`
- Scripted REST Resource: `Explain`, `Ask`, `Comment`, `Refactor`, `Document`
- Scheduled Script: `Explain`, `Ask`, `Comment`, `Refactor`, `Document`
- Update Set: `Document UpdateSet`

## Promotion candidates (non-GA until proven)

- UI Scripts
- Transform Scripts
- Background Scripts

Promotion rule:

- Promote them into the public support promise only if they behave consistently in both Chrome and Edge.
- If one of them fails in a relevant browser or provider path, keep it labeled as evolving or non-GA.

## Provider coverage

- Anthropic
- OpenAI
- Gemini
- OpenRouter
- Custom Endpoint
- Local LLM

For each provider:

- Save configuration
- Run test connection
- Execute at least one script action
- Confirm the response returns or the error is clear

## Update Set coverage

- Run `Document UpdateSet` in `List-first`
- Run `Document UpdateSet` in `Deep`
- Verify execution trace progresses through prompt, generation, and download

## Cross-browser validation

- Repeat clean-profile install and basic smoke flow in Microsoft Edge
- Confirm toolbar action behavior matches Chrome
- Confirm the options page and injected sidebar styling load fully without remote dependencies

## Disclosure validation

- Privacy policy matches actual runtime behavior
- Terms match the free public release model
- Support page matches actual support channels
- README and wiki do not promise unsupported contexts
