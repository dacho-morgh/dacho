# System documentation

Updated: 2026-10-23. This is the English specification for the event, review, investment and exhibition system. It records approved product decisions; it does not claim those features are implemented.

| Document | Purpose |
| --- | --- |
| [Delivery plan](../event-review-system-plan.md) | Delivery sequence, 55 implementation tasks, dependencies and acceptance criteria |
| [Product requirements](product-requirements.md) | Purpose, seven roles, permissions, fixed forms, documents, confirmed rules and unresolved inputs |
| [Workflows](workflows.md) | Company verification, event applications, four reviews, investment follow-up and independent booth applications |
| [Backend design](backend-design.md) | Proposed data boundaries, records, operations, access enforcement and consistency requirements |
| [Implementation audit](current-state-audit.md) | What the October 22 code inspection actually established |
| [Frontend audit](frontend-audit.md) | October 23 source findings, Figma references, gaps and design conflicts |
| [Frontend design and integration](frontend-design.md) | Proposed route/workspace map, modules, DTO requirements, action/file/state/error handling |
| [Frontend delivery plan](frontend-plan.md) | 32 frontend issues linked to original/backend tasks and human gates |
| [Persian frontend report](frontend-report.fa.md) | Product-facing Persian findings and delivery sequence |
| [Manual acceptance tests](manual-acceptance-tests.md) | Human-executable acceptance gates, prerequisites, expected outcomes and evidence |
| [GitHub task index](../github-task-index.md) | Stable implementation IDs mapped to existing issues |
| [GitHub publication record](github-publication.md) | Published issue ranges, label scope, project verification and execution limits |

## Reading and execution order

Read requirements and workflows before implementing a feature. Consult the audit to distinguish reusable code from missing behavior. Implement the delivery-plan prerequisites, then run the relevant manual gate on a deployed test build. Completing implementation is not equivalent to passing human acceptance.

Human-test issues belong to the existing [project](https://github.com/orgs/dacho-morgh/projects/1). Their bodies are self-contained so a tester does not need an unpublished local document. Do not mark a test passed because an implementation issue closed or an automated suite passed.

## Authority and change control

Direct decisions in the planning conversation through Q38 override conflicting older documents or Figma copy. Implementation details explicitly marked **proposed** are recommendations requiring technical review. **Open input** means no final business value was supplied; do not invent one. Existing user-interface text remains Persian; the documentation language is English.

Changes to product rules should update the requirements, affected state transitions, implementation acceptance criteria and human tests together. Keep original task IDs and existing issue numbers stable. No product deployment, production migration or human test execution has been performed by writing these documents. GitHub issue publication is recorded separately below.

## Rebuilding planning indexes

Run `python docs/system/build_frontend_plan.py`, then `python docs/system/build_documents.py`. These scripts only write planning documents/JSON; they never create GitHub issues or run tests. The checked-in issue-map JSON files record verified issue numbers. Frontend prerequisite links and human-gate associations derive from the task data. Keep the original task table/index present because the system generator preserves their existing IDs and dependency map.

## Outstanding inputs

- Q39: allowed formats, maximum size and any count limit for RFP/proposals, company records, financial records and payment receipts. A universal 12 MB policy was explicitly not accepted.
- Final reviewer questions, score ceilings and scoring formula. Figma's 45/40/15 weights are reference material, not approved rules.
- Approved non-compete agreement and event-rules text.
- Team capacity and calendar commitments. Delivery ordering is specified; dates and effort estimates are not.

These inputs block their respective acceptance assertions, not the entire documentation or access-control foundation.
