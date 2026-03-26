# Monetization Strategy

## Public v1

- Product model: free browser extension
- Account model: no SN Assistant account required
- Billing model: none in the extension
- Usage model: user brings their own provider, key, or endpoint

## Why this comes first

- Fastest route to public distribution
- Lowest product and compliance surface area
- Easiest store review story
- Best fit for the current architecture

## Future paid offer

The first paid plan should be a managed service, not a paywall around the current free feature set.

Suggested offers:

- `Pro`: hosted SN Assistant endpoint with included usage and simpler setup
- `Team`: shared billing, support priority, and usage controls

## Commercial architecture

- Reuse the existing `Custom Endpoint` path as the bridge to SN Assistant Cloud
- Authenticate with a fixed endpoint plus bearer token
- Handle usage metering and model routing in the backend
- Run billing outside browser stores with Stripe Checkout and a customer portal

## Store impact when paid launches

- Chrome listing should be marked as containing in-app purchases
- Terms should gain commercial billing and refund language
- Privacy policy should describe account, billing, and hosted-request handling
- Support page should define paid support expectations separately from best-effort public support
