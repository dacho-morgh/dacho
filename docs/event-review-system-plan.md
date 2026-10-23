# Event, review, investment and exhibition delivery plan

Updated 2026-10-23. **Planning and acceptance specification; not a claim of completed implementation.**

All 55 implementation tasks exist in [Project 1](https://github.com/orgs/dacho-morgh/projects/1). Stable task IDs differ from issue numbers; see the [issue index](github-task-index.md). Human acceptance gates are separate issues and have not been executed merely by being documented.

The frontend breakdown adds 32 linked work-package issues, and the acceptance catalogue adds 42 human-test issues: **129 planned issues in total**. The frontend packages refine existing cross-layer tasks rather than adding 32 unrelated product features. Use the `frontend`, `backend` and `manual-test` labels to separate work. Shared original tasks can carry both engineering labels.

## Complete English documentation

- [Product requirements](system/product-requirements.md): purpose, seven roles, full form/document lists, permissions, approved rules and open inputs.
- [Workflows](system/workflows.md): diagrams, actors, preconditions, corrections, rejections, financial follow-up, booth/payment/cancellation state transitions.
- [Backend design](system/backend-design.md): proposed records and API operation families, service boundaries, authorization, concurrency, versioning and migration.
- [Implementation audit](system/current-state-audit.md): dated source evidence, reusable foundation, missing work, defects and historical test limits.
- [Frontend audit](system/frontend-audit.md), [frontend design/contracts](system/frontend-design.md) and [32 frontend work packages](system/frontend-plan.md): Figma coverage, existing routes, missing screens, original/backend links and frontend sequencing.
- [Persian frontend report](system/frontend-report.fa.md): findings and delivery sequence for the product team.
- [Manual acceptance tests](system/manual-acceptance-tests.md): human scripts, prerequisites, expected results, negative paths and evidence.
- [Documentation entry point](system/README.md).

## Delivery objective and order

First deliver the shared access, persistence and private-file foundation. Then deliver one complete event journey: company signup/verification, independent subtopic applications, four reviews including the employer, explicit chief advancement, private financial package, investment memo and Secretariat publication. Finally deliver the independent exhibition journey: specific booths, independent applications/receipts, attendance approval, manual payment verification and controlled cancellation.

Preserve the existing Next.js/Payload + Express + PostgreSQL architecture. No general workflow designer, per-event form builder, online gateway, ancillary exhibition services or interactive floor plan is required.

| Increment | Functional completion | Human gate |
| --- | --- | --- |
| A. Environment and contracts | Isolated fixtures, seven-role matrix, form contracts and known open inputs | UAT42 |
| B. Onboarding and access | Password login/signup, real profile persistence, private files and verification | UAT01–UAT07, each when its slice is ready |
| C. Event intake | Event/team/subtopic/RFP, independent applications, corrections/rejection/reopen | UAT08–UAT13 |
| D. Review | Four assignments, own evaluations, replacement, 4/4, chief action/new rounds | UAT14–UAT20 |
| E. Investment and disclosure | Financial package/privacy, memo, supplementary files and published result | UAT21–UAT27 |
| F. Shared quality and event release | Reliable history/notifications/counts, RTL/usability, migration/restore and whole journey | UAT28–UAT30, UAT38–UAT39, UAT41 |
| G. Exhibition | Booth catalogue/limit, independent reservations/receipts, approvals and cancellation | UAT31–UAT38, UAT40 |

Implementation completion is not human acceptance. A test starts **Not run**, becomes **Blocked** if its build/fixtures/product inputs are unavailable, and passes only with actual recorded evidence. Failed gates stay open with linked defects. A human race test does not prove database isolation; automated integration/concurrency tests remain required.

No staffing, dates or person-day estimates are agreed. Issue creation does not authorize production migration, deployment or real financial actions.

## Binding product decisions

Seven operational roles; one operational role per person; event-specific teams. One application per event subtopic. One employer reviewer person plus three other distinct reviewers; four finalized evaluations do not advance without the chief. Ordinary unfinished reviewers can be replaced by the chief; employer replacement is owner-only with reason. A corrected reviewed proposal starts a new round, retaining old scores as history.

Company verification supports correction/resubmission; identity edits need re-verification without rewriting historic application snapshots. Rejection locks only that company/event/subtopic; owner can reopen with reason. Forms are fixed system-wide but versioned. The investment role is one memo-writing person; Secretariat handles supplementary files and publication. Financial files exclude chiefs and reviewers; companies never receive private scores/memos.

Each booth has its own application, fixed toman price, receipt, state and cancellation history. Several booths are allowed up to the owner-set exhibition company limit. Reservation occurs with the request, has no timed expiry, and survives receipt correction. Attendance approval precedes payment. Before receipt, company cancellation is direct; afterward Secretariat handles cancellation and any manual refund with history.

## Backlog

BE = backend/data; CMS = Payload; FE = panel; QA = verification. Dependency links determine execution order, not numbering. T03 means readiness of the corresponding stage's form contract: remaining review-form interpretations block corresponding T24 assertions, not login/verification. Start T36/T37 early enough for the first business transition to have history and reliable notifications.


### Phase 0: Contracts and safe test environment

| ID / issue | Task / area | Prerequisites | Acceptance criteria |
| --- | --- | --- | --- |
| [T01 / #15](https://github.com/dacho-morgh/dacho/issues/15) | Record approved scope and open inputs / Product | None | Record both workflows, decisions, decision owners and affected tasks; keep unresolved values explicit. |
| [T02 / #16](https://github.com/dacho-morgh/dacho/issues/16) | Seven-role permission and scope matrix / BE,CMS | [T01](https://github.com/dacho-morgh/dacho/issues/15) | Specify own/other/unassigned visibility and operations, including CMS, API, populated fields, files, search and counts. |
| [T03 / #17](https://github.com/dacho-morgh/dacho/issues/17) | Fixed form and document specifications / Product,BE,FE | [T01](https://github.com/dacho-morgh/dacho/issues/15) | Define field types/requirements/absence semantics/conditions/versions; capture supplied ordinary/employer rubric and resolve remaining interpretations, file policy and agreement text; no form builder. |
| [T04 / #18](https://github.com/dacho-morgh/dacho/issues/18) | Isolated test environment and migration inventory / QA,Data | None | Separate test database/files from live data; inventory existing migrations/data and rehearse recovery. |

### Phase 1: Fixes and shared foundation

| ID / issue | Task / area | Prerequisites | Acceptance criteria |
| --- | --- | --- | --- |
| [T05 / #19](https://github.com/dacho-morgh/dacho/issues/19) | Persist company addresses and executives / BE | [T04](https://github.com/dacho-morgh/dacho/issues/18) | Real Payload adapter saves addresses/executives and fresh sessions reload them; in-memory tests alone are insufficient. |
| [T06 / #20](https://github.com/dacho-morgh/dacho/issues/20) | Protect private company and identity fields / CMS,BE | [T02](https://github.com/dacho-morgh/dacho/issues/16) | Deny unauthorized direct CMS/relationship reads and identity/representative changes; whitelist public directory fields. |
| [T07 / #21](https://github.com/dacho-morgh/dacho/issues/21) | Safe tracking allocation and atomic submit / BE | [T04](https://github.com/dacho-morgh/dacho/issues/18) | Replace count-based codes; concurrent creation/deletion cannot collide; parallel submit has one effective transition. |
| [T08 / #22](https://github.com/dacho-morgh/dacho/issues/22) | Single operational role and personnel management / CMS,BE,FE | [T02](https://github.com/dacho-morgh/dacho/issues/16), [T04](https://github.com/dacho-morgh/dacho/issues/18) | Owner creates/deactivates personnel with one operational role; block public privilege injection and deliberately preserve content privileges. |
| [T09 / #23](https://github.com/dacho-morgh/dacho/issues/23) | Shared role and assignment authorization / BE,FE | [T02](https://github.com/dacho-morgh/dacho/issues/16), [T08](https://github.com/dacho-morgh/dacho/issues/22) | Lists/details/actions/files/counts share scope; role or assignment changes revoke old access; allowed actions come from server. |
| [T10 / #24](https://github.com/dacho-morgh/dacho/issues/24) | Private document upload and download / BE,CMS | [T04](https://github.com/dacho-morgh/dacho/issues/18), [T09](https://github.com/dacho-morgh/dacho/issues/23) | Validate category/type/size/owner server-side; deny unauthorized direct URLs and financial leaks; failed upload cannot advance stage. Q39 remains open. |

### Phase 2: Signup, profile and verification

| ID / issue | Task / area | Prerequisites | Acceptance criteria |
| --- | --- | --- | --- |
| [T11 / #25](https://github.com/dacho-morgh/dacho/issues/25) | Progressive signup and password login / CMS,FE | [T03](https://github.com/dacho-morgh/dacho/issues/17), [T08](https://github.com/dacho-morgh/dacho/issues/22) | Capture Stage 1 fields; atomically create person/company; reject duplicate national ID with rollback; phone/email plus password works. |
| [T12 / #26](https://github.com/dacho-morgh/dacho/issues/26) | Company-owned applications and acting person / BE,Data | [T04](https://github.com/dacho-morgh/dacho/issues/18), [T11](https://github.com/dacho-morgh/dacho/issues/25) | Separate companyId from acting user; migrate old ownership safely; prevent cross-company access. |
| [T13 / #27](https://github.com/dacho-morgh/dacho/issues/27) | Complete company dossier and resume / BE,CMS,FE | [T03](https://github.com/dacho-morgh/dacho/issues/17), [T05](https://github.com/dacho-morgh/dacho/issues/19), [T10](https://github.com/dacho-morgh/dacho/issues/24), [T11](https://github.com/dacho-morgh/dacho/issues/25) | Persist Stage 2 fields/documents and permitted absence answers; separate legal entity type from knowledge-based status; show missing items. |
| [T14 / #33](https://github.com/dacho-morgh/dacho/issues/33) | Secretariat verification queue and decisions / BE,CMS,FE | [T06](https://github.com/dacho-morgh/dacho/issues/20), [T09](https://github.com/dacho-morgh/dacho/issues/23), [T13](https://github.com/dacho-morgh/dacho/issues/27), [T37](https://github.com/dacho-morgh/dacho/issues/32) | Store submitted revision/reviewer/time/reason; prohibit self-approval; returned documents can be corrected and resubmitted on same profile. |
| [T15 / #34](https://github.com/dacho-morgh/dacho/issues/34) | Re-verification and participation eligibility / BE,FE | [T12](https://github.com/dacho-morgh/dacho/issues/26), [T14](https://github.com/dacho-morgh/dacho/issues/33) | Incomplete/unapproved companies cannot formally apply or reserve; identity edits require approval again; preserve previous approved snapshots. |

### Phase 3: Event configuration and intake

| ID / issue | Task / area | Prerequisites | Acceptance criteria |
| --- | --- | --- | --- |
| [T16 / #28](https://github.com/dacho-morgh/dacho/issues/28) | Event configuration and responsible teams / CMS,FE | [T08](https://github.com/dacho-morgh/dacho/issues/22) | Owner defines event/registration window and event-specific chief/investment person; separate event responsibilities. |
| [T17 / #29](https://github.com/dacho-morgh/dacho/issues/29) | Technology categories, subtopics and employer / CMS,FE | [T16](https://github.com/dacho-morgh/dacho/issues/28) | Validate category/event relationships and one named employer reviewer person per subtopic; reject invalid assignments. |
| [T18 / #30](https://github.com/dacho-morgh/dacho/issues/30) | Versioned RFP and correct downloads / CMS,BE,FE | [T10](https://github.com/dacho-morgh/dacho/issues/24), [T17](https://github.com/dacho-morgh/dacho/issues/29) | Download correct subtopic RFP; later RFP changes do not rewrite submitted application snapshots. |
| [T19 / #35](https://github.com/dacho-morgh/dacho/issues/35) | Independent application per subtopic / BE,FE | [T12](https://github.com/dacho-morgh/dacho/issues/26), [T15](https://github.com/dacho-morgh/dacho/issues/34), [T17](https://github.com/dacho-morgh/dacho/issues/29) | Allow several subtopics with independent codes/state/results; prevent duplicate applications and cross-event subtopic misuse. |
| [T20 / #36](https://github.com/dacho-morgh/dacho/issues/36) | Fixed application, consent and proposal form / BE,FE | [T03](https://github.com/dacho-morgh/dacho/issues/17), [T10](https://github.com/dacho-morgh/dacho/issues/24), [T18](https://github.com/dacho-morgh/dacho/issues/30), [T19](https://github.com/dacho-morgh/dacho/issues/35) | Save drafts and validate final submission server-side; snapshot company/form/RFP/proposal; record agreement version/actor/time. |
| [T21 / #37](https://github.com/dacho-morgh/dacho/issues/37) | Chief triage, correction, rejection and reopen / BE,FE | [T09](https://github.com/dacho-morgh/dacho/issues/23), [T20](https://github.com/dacho-morgh/dacho/issues/36), [T37](https://github.com/dacho-morgh/dacho/issues/32) | Reasons required; corrections revise same application; rejection locks only company/event/subtopic; audited reopen is owner-only. |

### Phase 4: Four independent evaluations

| ID / issue | Task / area | Prerequisites | Acceptance criteria |
| --- | --- | --- | --- |
| [T22 / #38](https://github.com/dacho-morgh/dacho/issues/38) | Review rounds and four distinct assignments / BE,FE | [T17](https://github.com/dacho-morgh/dacho/issues/29), [T21](https://github.com/dacho-morgh/dacho/issues/37) | Capture fixed employer plus three distinct ordinary reviewers; round references exact proposal revision. |
| [T23 / #39](https://github.com/dacho-morgh/dacho/issues/39) | Assigned reviewer queue and dossier / BE,FE | [T09](https://github.com/dacho-morgh/dacho/issues/23), [T22](https://github.com/dacho-morgh/dacho/issues/38) | Reviewer/employer sees assigned cases and necessary company profiles only; financial files and other evaluations are excluded. |
| [T24 / #40](https://github.com/dacho-morgh/dacho/issues/40) | Fixed review rubric and score calculation / BE,FE | [T03](https://github.com/dacho-morgh/dacho/issues/17), [T23](https://github.com/dacho-morgh/dacho/issues/39) | Use supplied ordinary/employer questions, ceilings and 0.45*A+0.40*B+0.15*C (max 55.05); resolve rounding/requiredness; reject invalid/tampered values; no invented aggregation or automatic advancement. |
| [T25 / #41](https://github.com/dacho-morgh/dacho/issues/41) | Draft, finalization and locked evaluations / BE,FE | [T24](https://github.com/dacho-morgh/dacho/issues/40) | Drafts do not count; complete required review forms before finalizing; no normal edits to finalized evaluations or impersonation. |
| [T26 / #42](https://github.com/dacho-morgh/dacho/issues/42) | Reviewer replacement and assignment history / BE,FE | [T22](https://github.com/dacho-morgh/dacho/issues/38), [T25](https://github.com/dacho-morgh/dacho/issues/41) | Chief replaces unfinished ordinary reviewer; owner alone replaces employer with reason; revoke old access and preserve history. |
| [T27 / #43](https://github.com/dacho-morgh/dacho/issues/43) | Atomic 4/4 completion and confidentiality / BE,FE | [T25](https://github.com/dacho-morgh/dacho/issues/41), [T26](https://github.com/dacho-morgh/dacho/issues/42) | 1–3 evaluations stay incomplete; concurrent finalization produces one completion; every reviewer sees only own evaluation. |
| [T28 / #44](https://github.com/dacho-morgh/dacho/issues/44) | Chief decision and new correction rounds / BE,FE | [T21](https://github.com/dacho-morgh/dacho/issues/37), [T27](https://github.com/dacho-morgh/dacho/issues/43) | Require explicit chief advancement after 4/4; corrected proposal creates new revision/round; old evaluations stay historic and do not count. |

### Phase 5: Investment and publication

| ID / issue | Task / area | Prerequisites | Acceptance criteria |
| --- | --- | --- | --- |
| [T29 / #45](https://github.com/dacho-morgh/dacho/issues/45) | Invite company financial package / BE,FE | [T28](https://github.com/dacho-morgh/dacho/issues/44) | Only chief advancement opens financial stage; notify owning company with required document categories. |
| [T30 / #46](https://github.com/dacho-morgh/dacho/issues/46) | Versioned financial package and submission / BE,FE | [T03](https://github.com/dacho-morgh/dacho/issues/17), [T10](https://github.com/dacho-morgh/dacho/issues/24), [T29](https://github.com/dacho-morgh/dacho/issues/45) | Validate complete required package and younger-company since-establishment rule; incomplete uploads/package do not advance. |
| [T31 / #47](https://github.com/dacho-morgh/dacho/issues/47) | Scoped investment assignment and dossier / BE,FE | [T09](https://github.com/dacho-morgh/dacho/issues/23), [T30](https://github.com/dacho-morgh/dacho/issues/46) | Assigned investment person reads case/reviews; financial records restricted to company, assigned person, Secretariat and owner. |
| [T32 / #48](https://github.com/dacho-morgh/dacho/issues/48) | Record and send investment memo / BE,FE | [T31](https://github.com/dacho-morgh/dacho/issues/47) | Single investment person writes/sends memo to Secretariat; no separate approve/reject/return or voting controls; preserve history. |
| [T33 / #51](https://github.com/dacho-morgh/dacho/issues/51) | Secretariat follow-up and result publication / BE,FE | [T14](https://github.com/dacho-morgh/dacho/issues/33), [T32](https://github.com/dacho-morgh/dacho/issues/48), [T35](https://github.com/dacho-morgh/dacho/issues/50) | Obtain supplementary documents through correspondence if needed; disclose separate published text only; interim memos/requests never auto-publish. |

### Phase 6: Correspondence, history and panels

| ID / issue | Task / area | Prerequisites | Acceptance criteria |
| --- | --- | --- | --- |
| [T34 / #49](https://github.com/dacho-morgh/dacho/issues/49) | Authorized recipients and role messaging / BE,FE | [T09](https://github.com/dacho-morgh/dacho/issues/23), [T22](https://github.com/dacho-morgh/dacho/issues/38), [T31](https://github.com/dacho-morgh/dacho/issues/47) | Company to support, reviewer to responsible chief, investment to assigned-case participants; owner/chief general sending does not grant case access. |
| [T35 / #50](https://github.com/dacho-morgh/dacho/issues/50) | Case-linked letters and private attachments / BE,FE | [T10](https://github.com/dacho-morgh/dacho/issues/24), [T34](https://github.com/dacho-morgh/dacho/issues/49) | Send/read/download authorized files; preserve financial privacy/case association for supplementary company replies and authorized reviewer access. |
| [T36 / #31](https://github.com/dacho-morgh/dacho/issues/31) | Reliable transition history / BE,FE | [T09](https://github.com/dacho-morgh/dacho/issues/23), [T12](https://github.com/dacho-morgh/dacho/issues/26) | Record actor/time/action/reason/revision/old-new state; scope reads; deleting displayed letters cannot erase workflow history. |
| [T37 / #32](https://github.com/dacho-morgh/dacho/issues/32) | Consistent transitions and notification delivery / BE | [T36](https://github.com/dacho-morgh/dacho/issues/31) | Commit business change/history reliably; notification failures are retryable without repeated business effects or partial transitions. |
| [T38 / #52](https://github.com/dacho-morgh/dacho/issues/52) | Scoped queues, counts and overview / BE,FE | [T09](https://github.com/dacho-morgh/dacho/issues/23), [T21](https://github.com/dacho-morgh/dacho/issues/37), [T27](https://github.com/dacho-morgh/dacho/issues/43), [T31](https://github.com/dacho-morgh/dacho/issues/47), [T33](https://github.com/dacho-morgh/dacho/issues/51) | Counts match authorized lists; filters/search do not leak unrelated cases; show actual pending work for each role. |
| [T39 / #53](https://github.com/dacho-morgh/dacho/issues/53) | Shared dossier and role-specific actions / FE | [T20](https://github.com/dacho-morgh/dacho/issues/36), [T28](https://github.com/dacho-morgh/dacho/issues/44), [T33](https://github.com/dacho-morgh/dacho/issues/51), [T35](https://github.com/dacho-morgh/dacho/issues/50), [T36](https://github.com/dacho-morgh/dacho/issues/31) | Use real API responses filtered by role; no financial disclosure to chiefs/reviewers; remove actions pointing to absent routes. |
| [T40 / #54](https://github.com/dacho-morgh/dacho/issues/54) | Complete UI states and usability / FE,QA | [T39](https://github.com/dacho-morgh/dacho/issues/53) | Handle loading/empty/error/denied/saved/stale states; support Persian RTL, keyboard and phone-size main journeys. |

### Phase 7: Event release evidence

| ID / issue | Task / area | Prerequisites | Acceptance criteria |
| --- | --- | --- | --- |
| [T41 / #55](https://github.com/dacho-morgh/dacho/issues/55) | Migration rehearsal on isolated data / Data,QA | [T04](https://github.com/dacho-morgh/dacho/issues/18), [T12](https://github.com/dacho-morgh/dacho/issues/26), [T22](https://github.com/dacho-morgh/dacho/issues/38), [T31](https://github.com/dacho-morgh/dacho/issues/47) | Map old users/roles/applications without greenfield assumptions; rehearse migration and recovery on separate data. |
| [T42 / #56](https://github.com/dacho-morgh/dacho/issues/56) | Permission and document matrix tests / QA | [T06](https://github.com/dacho-morgh/dacho/issues/20), [T09](https://github.com/dacho-morgh/dacho/issues/23), [T10](https://github.com/dacho-morgh/dacho/issues/24), [T34](https://github.com/dacho-morgh/dacho/issues/49), [T39](https://github.com/dacho-morgh/dacho/issues/53) | Exercise seven roles against own/other/unassigned records across CMS/proxy/API/files/counts, including financial confidentiality. |
| [T43 / #57](https://github.com/dacho-morgh/dacho/issues/57) | Workflow branch integration tests / QA | [T15](https://github.com/dacho-morgh/dacho/issues/34), [T21](https://github.com/dacho-morgh/dacho/issues/37), [T28](https://github.com/dacho-morgh/dacho/issues/44), [T33](https://github.com/dacho-morgh/dacho/issues/51) | Cover unverified, reject/reopen/correct, incomplete review/replacement/new rounds, missing financial documents and publication. |
| [T44 / #58](https://github.com/dacho-morgh/dacho/issues/58) | Concurrency and failure tests / QA | [T07](https://github.com/dacho-morgh/dacho/issues/21), [T27](https://github.com/dacho-morgh/dacho/issues/43), [T37](https://github.com/dacho-morgh/dacho/issues/32) | Verify parallel submit/fourth evaluation/stale revision/file failure/notification retry with real persistence and idempotency. |
| [T45 / #59](https://github.com/dacho-morgh/dacho/issues/59) | Full event E2E with separate accounts / QA | [T40](https://github.com/dacho-morgh/dacho/issues/54), [T42](https://github.com/dacho-morgh/dacho/issues/56), [T43](https://github.com/dacho-morgh/dacho/issues/57), [T44](https://github.com/dacho-morgh/dacho/issues/58) | Complete signup through publication using real test DB/files/forms and role isolation; never mutate shared/live fixtures. |
| [T46 / #60](https://github.com/dacho-morgh/dacho/issues/60) | Release and restore readiness / Operations | [T41](https://github.com/dacho-morgh/dacho/issues/55), [T45](https://github.com/dacho-morgh/dacho/issues/59) | Prepare responsible accounts, configuration, DB/files backup/restore, health checks and support runbook; rehearse before release. |

### Phase 8: Exhibition and manual receipts

| ID / issue | Task / area | Prerequisites | Acceptance criteria |
| --- | --- | --- | --- |
| [T47 / #61](https://github.com/dacho-morgh/dacho/issues/61) | Booth catalogue, company limit and fixed prices / CMS,BE,FE | [T01](https://github.com/dacho-morgh/dacho/issues/15), [T08](https://github.com/dacho-morgh/dacho/issues/22), [T16](https://github.com/dacho-morgh/dacho/issues/28) | Owner configures booth ID/specification/status/final toman price and per-company exhibition limit; list/guide map is sufficient. |
| [T48 / #62](https://github.com/dacho-morgh/dacho/issues/62) | Independent booth requests and exclusive reservation / BE,FE | [T09](https://github.com/dacho-morgh/dacho/issues/23), [T15](https://github.com/dacho-morgh/dacho/issues/34), [T47](https://github.com/dacho-morgh/dacho/issues/61) | Reserve one booth per application; several independent applications allowed; enforce exclusivity and company limit under concurrency; no automatic expiry. |
| [T49 / #64](https://github.com/dacho-morgh/dacho/issues/64) | Independent price record for each booth request / BE,FE | [T48](https://github.com/dacho-morgh/dacho/issues/62), [T55](https://github.com/dacho-morgh/dacho/issues/63) | Each application has its own fixed price/unit/version; no combined payments; price edits do not silently rewrite previous agreed amount. |
| [T50 / #65](https://github.com/dacho-morgh/dacho/issues/65) | Independent receipt and payment history / BE,FE | [T10](https://github.com/dacho-morgh/dacho/issues/24), [T49](https://github.com/dacho-morgh/dacho/issues/64), [T55](https://github.com/dacho-morgh/dacho/issues/63) | Upload only after attendance approval; one receipt cannot be counted as independent payments for other booth requests; preserve correction versions. |
| [T51 / #66](https://github.com/dacho-morgh/dacho/issues/66) | Verify receipt and confirm that booth / BE,FE | [T14](https://github.com/dacho-morgh/dacho/issues/33), [T50](https://github.com/dacho-morgh/dacho/issues/65) | Secretariat confirms or returns receipt with reason; correction preserves reservation; duplicate confirmation has no second inventory/financial effect. |
| [T52 / #67](https://github.com/dacho-morgh/dacho/issues/67) | Cancellation, release and manual refund records / BE,FE | [T48](https://github.com/dacho-morgh/dacho/issues/62), [T51](https://github.com/dacho-morgh/dacho/issues/66) | Company cancels before receipt; later cancellation goes through Secretariat; retain financial history and release only that booth; no expiry job. |
| [T53 / #68](https://github.com/dacho-morgh/dacho/issues/68) | Company and Secretariat exhibition panels / FE | [T47](https://github.com/dacho-morgh/dacho/issues/61), [T48](https://github.com/dacho-morgh/dacho/issues/62), [T49](https://github.com/dacho-morgh/dacho/issues/64), [T50](https://github.com/dacho-morgh/dacho/issues/65), [T51](https://github.com/dacho-morgh/dacho/issues/66), [T52](https://github.com/dacho-morgh/dacho/issues/67), [T55](https://github.com/dacho-morgh/dacho/issues/63) | Show independent request/price/receipt/status/cancellation for each booth, company limit and guide map; distinguish attendance from payment approval. |
| [T54 / #69](https://github.com/dacho-morgh/dacho/issues/69) | Exhibition E2E and reconciliation / QA,Operations | [T53](https://github.com/dacho-morgh/dacho/issues/68), [T42](https://github.com/dacho-morgh/dacho/issues/56), [T44](https://github.com/dacho-morgh/dacho/issues/58) | Verify independence, limits/races, no expiry, attendance guard, receipt correction/duplicates and cancellation; reconcile booths/payments. |
| [T55 / #63](https://github.com/dacho-morgh/dacho/issues/63) | Separate exhibition attendance approval / BE,FE | [T09](https://github.com/dacho-morgh/dacho/issues/23), [T37](https://github.com/dacho-morgh/dacho/issues/32), [T48](https://github.com/dacho-morgh/dacho/issues/62) | Secretariat approves/rejects each reserved-booth request with reason; company verification alone cannot authorize receipt upload. |

## Evidence and open inputs

The October 22 backend unit run passed 9 files/42 tests. Destructive integration/frontend fixture suites were not run on the shared environment. This historical result is not acceptance of missing business behavior or a fresh certification of the current build.

The user supplied ordinary/employer reviewer forms and the per-review formula (maximum 55.05) on 2026-10-23; see [review rubric](system/review-rubric.md). Q39 file formats/sizes/counts, approved agreement/rules text and remaining rubric interpretations remain open. Do not derive authority from Figma examples or invent four-review aggregation. Backend record/API names are proposed technical contracts; the business rules above are confirmed scope. Team capacity and calendar commitments remain unspecified.

