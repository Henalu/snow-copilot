# Actions Reference

SN Assistant shows different actions depending on the detected context.

## Script actions

These appear when a supported script editor is detected.

### Explain

Explains what the current script does:

- overall purpose
- logic flow
- important APIs
- side effects
- ServiceNow constraints and patterns

When RAG is enabled for this action, the answer can be grounded with Breaking Trail content.

### Comment

Adds JSDoc and inline comments to help future maintainers understand the script.

### Refactor

Improves the structure and ServiceNow implementation quality of the current script.

### Ask

Lets you ask a free-form question about the current script. This is the most flexible action and one of the main places where RAG grounding adds value.

### Document

Generates technical documentation for the current script and downloads it automatically as a Word document.

## Update Set action

This appears when a `sys_update_set` form is detected.

### Document UpdateSet

Generates change documentation for the Update Set and downloads it automatically as a Word document.

Current flow:

1. The extension detects the Update Set form
2. The user can add optional business or technical context in the textarea
3. The extension captures visible Customer Updates
4. The provider generates the document
5. The Word file downloads automatically

### List-first mode

Uses:

- Update Set metadata from the form
- visible Customer Updates list metadata

Best for:

- faster documentation
- lower browser overhead
- first-pass summaries

### Deep mode

Builds on `List-first` and tries to enrich updates with:

- `sys_update_xml` payload details
- inferred artifact metadata
- script previews
- field summaries

Best for:

- technical handover
- deeper release notes
- documentation that needs stronger grounding

## Panel controls

| Element | Function |
|---|---|
| Toolbar action | Toggles the assistant on supported ServiceNow tabs, or opens Options elsewhere |
| Trigger button | Opens or closes the panel |
| `X` button | Closes the panel |
| Reset button | Restores default position and size |
| Header | Drag to move the panel |
| Left edge | Resize horizontally |
| Bottom edge | Resize vertically |
| Bottom-left corner | Resize both dimensions |
