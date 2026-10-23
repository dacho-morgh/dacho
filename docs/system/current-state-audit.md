# Implementation baseline audit

Phase 0 follow-up, 2026-10-23: [migration inventory](migration-inventory.md) verified that the current Payload config and migrations use `public`, while backend tables use `dashboard`. References to `cms` below reflect the earlier audit/design expectation; this batch does not move schemas. Isolated synthetic integration and recovery checks are recorded separately in [test-environment.md](test-environment.md).

Inspection date: **2026-10-22**. Documented in English on 2026-10-23. This is a historical source inspection, not a fresh certification that the current checkout or production is unchanged. The planning and acceptance-test work did not implement these capabilities or rerun the application suites.

| Area | Observed implementation | Required work / evidence |
| --- | --- | --- |
| Architecture | Next.js/Payload frontend, Express backend, shared CMS package, PostgreSQL `cms`/`dashboard` schemas | Reuse the structure; no complete rewrite justified by the audit |
| Identity | Atomic user/company signup, unique national ID; password UI | Adapt progressive forms; `packages/cms-core/src/collections/Users/index.ts` |
| Roles | `admin`, `editor`, `representative`, `referee`; operational route gates mainly admin/representative | Seven operational roles and event/case scopes missing; `packages/cms-core/src/access/roles.ts:11`, `apps/backend/src/dashboard/router.ts:43` |
| Company verification | Company CRUD and free-text operating status | No approval lifecycle/revision/reason/eligibility gate; `packages/cms-core/src/collections/Companies.ts:106` |
| Company privacy | Public company reads | Separate public directory from private dossier; `Companies.ts:48`; protect identity/representative updates too |
| Profile persistence | Real Payload store serializes string whitelist | Addresses/executives excluded by `apps/backend/src/auth/company-store.ts:69` and `:127`; in-memory tests mask real persistence gap |
| Event/exhibition definitions | Content title, dates, image, location and status | Subtopics, RFP/employer/team and booth domain absent; `collections/Events.ts`, `Exhibitions.ts` |
| Applications | Generic service request CRUD/submit, user owner ID | Company/event/subtopic identity, versions, duplicate eligibility and complete domain actions needed |
| Workflow | Actual `draft` to `in_review` submit | Other enum states are not functioning transitions; `apps/backend/src/dashboard/request-repo.ts:187` |
| Tracking/concurrency | Count-based tracking allocation, read-then-update submit | Replace `COUNT + 1` and guard concurrent submit; `request-repo.ts:74`, `:193` |
| Forms | Generic service answers and required-value checks | Typed fixed forms, document validation and snapshots needed; `router.ts:81` |
| Review | No operational rounds, assignments or evaluations | Four independent evaluations and chief action are new work |
| Existing evaluation UI | Admin note + forward/reject calls | Frontend references an absent backend transition route; `apps/frontend/src/components/dashboard/admin-request-evaluation.tsx:21` |
| Investment | No operational financial package/memo/publication model | New scoped dossier, memo handoff and Secretariat publication |
| Files | Public editorial media, image/video types | Private document store needed; `packages/cms-core/src/collections/Media.ts:23`, `:45` |
| Messaging | Real letters/support foundation | Full recipient rules and attachments missing; `new-letter-form.tsx:265` disables upload, `dashboard-api.ts:317` discards received attachments |
| Timeline | Read APIs/table exist | Writer absent; `apps/backend/src/dashboard/activity-repo.ts`; `tests/int/stats-activities.int.spec.ts:112` expects empty timeline after submit |
| Personnel/resume | Personnel listing, disabled creation controls, static empty resume screen | Operational staff management and real company resume needed |
| Exhibition | Content record only | Booth inventory, independent applications/receipts, manual verification and cancellations absent |

## Test evidence and limits

The earlier backend unit run passed **9 files / 42 tests**. The initial attempt hit esbuild `spawn EPERM`; an authorized rerun succeeded. Those tests cover auth/OTP/JWT, configuration, health, store/catalog mapping and profile behavior with in-memory stores. They do not establish the requested business workflow.

Backend integration fixtures and the frontend integration suite can create/delete database records and run migrations. They were not run against the shared environment. A disposable database and file area are prerequisites for their execution. Existing frontend tests include signup/role-injection protection, CMS write gates, event rendering and some panel mappings, but the target four-review/financial/booth flows were not implemented and therefore not accepted.

## Stale references

`docs/admin-workflow-plan.md` and parts of `docs/wayfinder-fog-analysis.md` describe removed dynamic roles/workflow behavior and/or three reviewers. They must not override the present requirements. The current scope is four people including the employer, fixed forms, an explicit chief decision, a single memo-writing investment person and separate booth receipts. Aspirational architecture and old issue completion are not evidence of current operational behavior.
