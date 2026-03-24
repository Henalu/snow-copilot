# Change Documentation

## Goal

Generate useful functional and technical documentation from ServiceNow changes, starting with Update Sets.

## Current state

Implemented today:

- `Document UpdateSet` action on `sys_update_set` forms
- one-click flow with no extra questionnaire
- optional free-text context from the user
- automatic Word download
- in-panel execution trace for debugging long runs

Current modes:

- `List-first`
- `Deep`

## Source model

Primary records:

- `sys_update_set`
- visible `sys_update_xml` related list rows

Optional enrichment in `Deep` mode:

- fetch `sys_update_xml` payload details
- extract artifact hints, field summaries, and script previews

## Current flow

1. Detect Update Set context in `content.js`
2. Capture form metadata
3. Capture visible Customer Updates
4. Optionally enrich records in `Deep` mode
5. Normalize and group updates in `change-documentation/planner.js`
6. Build a package brief
7. Generate the document through the normal provider pipeline
8. Download the Word file automatically

## List-first mode

Strengths:

- faster
- less browser overhead
- works well for first-pass summaries

Limits:

- depends on visible columns
- does not guarantee script internals
- may stay more inferential

## Deep mode

Strengths:

- richer technical grounding
- better artifact-level evidence
- more specific notes for Business Rules, Script Includes, and similar records

Limits:

- slower
- depends on what `sys_update_xml` can be fetched from the active instance
- still not a true full diff engine

## Execution trace

The panel exposes key phases such as:

- captured data
- prompt prepared
- model started responding
- generation in progress
- preparing Word download

This is the main debugging surface for Update Set documentation.

## Current priorities

- keep `List-first` as the default fast mode
- keep `Deep` as the richer technical mode
- improve the balance between narrative polish and technical evidence

## Next steps

### Short term

- improve `Deep` narrative polish
- reduce output clipping at the end of long documents
- enrich more artifact types from XML payloads

### Medium term

- support direct documentation from selected Customer Updates
- add a `Document Solution` or package-level variant
- let the user choose technical depth more explicitly

### Longer term

- XML-first or diff-aware documentation
- better application-level synthesis
- links between code documentation, Update Sets, and RAG knowledge
