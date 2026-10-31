# System documentation

Updated: 2026-10-26. This is the English specification for the event, review, investment and exhibition system. It records approved product decisions; it does not claim those features are implemented.

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
| [Scope and decision register](scope-decisions.md) | T01 approved decisions, decision ownership, open inputs and affected tasks |
| [Permission matrix](permission-matrix.md) | T02 target role/ownership/assignment policy and current implementation gaps |
| [Fixed form contracts](fixed-form-contracts.md) | T03 typed fields, conditional/absence semantics, versions and multi-file policy |
| [Approved document policy](document-policy.json) | Temporary Word/PDF-only, 10 MB per file, multiple files in one field |
| [Supplied review rubric](review-rubric.md) | Ordinary/employer forms, shared scoring up to 55.05 and remaining interpretation questions |
| [Isolated test environment](test-environment.md) | T04 guarded disposable database/files and recorded recovery checks |
| [Migration inventory](migration-inventory.md) | Current migration streams, schema discrepancy and rollout limits |
| [Migration rehearsal](migration-rehearsal.md) | T41 upgrade from the `main` level on separate populated data, disposition of old accounts and cases, and recovery |
| [Phase 0 Figma evidence](phase-0-figma-evidence.md) | Fresh read-only design evidence and conflicts with approved product rules |
| [Phase 0 execution record](phase-0-execution.md) | Work allocation, branch, evidence, limitations and handoff for T01–T04 |
| [Personnel foundation](personnel-foundation.md) | T08 scalar operational role, editorial/service separation, deactivation and explicit legacy mapping |
| [Company profile foundation](company-profile-foundation.md) | T05/T06 persistence, private dossier access, public projection and validation boundaries |
| [Request tracking foundation](request-tracking-foundation.md) | T07 sequence allocation, atomic submit, synthetic migration rehearsal and rollout boundaries |
| [Evaluation foundation](evaluation-foundation.md) | T25 author-owned drafts, final locking, scoped oversight, revision/revocation guards and remaining round dependencies |
| [Review rounds](review-rounds.md) / [Replacement](review-replacement.md) | T22 round and four assignments; T26 ordinary-reviewer and owner-only employer replacement with retained history |
| [Four-of-four completion](review-completion.md) | T27 atomic round completion, readiness for the chief's decision and evaluation confidentiality |
| [Chief decision](chief-decision.md) | T28 explicit advance, return or reject after 4/4, correction rounds and readable past rounds |
| [Financial invitation](financial-invitation.md) | T29 invitation and fixed checklist on chief advancement, and the gate on the company's financial files |
| [Financial package](financial-package.md) | T30 versioned submission of the financial files, statement-year coverage and the freeze that follows |
| [Investment handoff](investment-handoff.md) | T31 automatic handoff to the event's investment person, the scoped queue and dossier, and financial confidentiality |
| [Investment memo](investment-memo.md) | T32 versioned memo written by the person holding the case and sent to the Secretariat, with no decision controls |
| [Secretariat follow-up](secretariat-follow-up.md) | T33 queue, supplementary documents delivered to the investment person and the separately published result |
| [Shared authorization](authorization.md) | T09 seven-role/assignment scope, server-derived actions, CMS/proxy projections and current denials |
| [Private documents](private-documents.md) | T10 private storage, document policy, access audiences, API contract, migrations and FE07 scope |
| [Reviewer queue and case file](reviewer-queue.md) | T23 assignment-derived queue, reviewer case file, pinned proposal/RFP files and necessary company profile |
| [Scoped queues and overview](work-queues.md) | T38 each role's state-derived work queues, counts equal to their lists, and search and filters inside the row scope |
| [Shared dossier and role actions](request-dossier.md) | T39 one case page for seven roles, sections and controls per role, financial slots absent for the chief and reviewers, and the removed transition route |

## Reading and execution order

Read requirements and workflows before implementing a feature. Consult the audit to distinguish reusable code from missing behavior. Implement the delivery-plan prerequisites, then run the relevant manual gate on a deployed test build. Completing implementation is not equivalent to passing human acceptance.

Human-test issues belong to the existing [project](https://github.com/orgs/dacho-morgh/projects/1). Their bodies are self-contained so a tester does not need an unpublished local document. Do not mark a test passed because an implementation issue closed or an automated suite passed.

## Authority and change control

Direct decisions in the planning conversation through Q38, followed by the user-supplied ordinary/employer forms recorded in [review-rubric.md](review-rubric.md), override conflicting older documents or Figma copy. Implementation details explicitly marked **proposed** are recommendations requiring technical review. **Open input** means no final business value was supplied; do not invent one. Existing user-interface text remains Persian; the documentation language is English.

Changes to product rules should update the requirements, affected state transitions, implementation acceptance criteria and human tests together. Keep original task IDs and existing issue numbers stable. No product deployment, production migration or human test execution has been performed by writing these documents. GitHub issue publication is recorded separately below.

## Rebuilding planning indexes

Run `python docs/system/build_frontend_plan.py`, then `python docs/system/build_documents.py`. These scripts only write planning documents/JSON; they never create GitHub issues or run tests. The checked-in issue-map JSON files record verified issue numbers. Frontend prerequisite links and human-gate associations derive from the task data. Keep the original task table/index present because the system generator preserves their existing IDs and dependency map.

## Current decisions and outstanding inputs

- Q39 formats/size are now supplied: Word/PDF only, 10 MB per file, multiple representations on the same field; images deferred. No numerical count cap was requested. This is an implementation-ready policy, not a pending product blocker.
- Review clarification is now supplied: articles contribute 2 points total; all qualitative/risk questions are mandatory at finalization. The chief sees four separate evaluations; aggregation is not requested. See [review-rubric.md](review-rubric.md).
- Approved non-compete agreement and event-rules text.
- Team capacity and calendar commitments. Delivery ordering is specified; dates and effort estimates are not.

Missing approved agreement text blocks its consent assertions; unspecified staffing blocks calendar commitments. The supplied file/review decisions and technical contract choices do not block unrelated implementation.
