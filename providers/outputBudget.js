// providers/outputBudget.js -- Action-aware response size limits.

const ACTION_MAX_TOKENS = {
  documentUpdateSet: 1800
};

export function getMaxTokensForAction(action, fallback = 2048) {
  return ACTION_MAX_TOKENS[action] || fallback;
}
