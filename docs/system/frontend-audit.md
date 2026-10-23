# Frontend implementation and Figma audit

Inspected 2026-10-23. This is a source/design audit, not a deployed acceptance result. Existing unrelated landing-page edits were left untouched. No production data, database migration, product implementation or human acceptance test was run for this planning task.

## Conclusion

The frontend is a reusable Next.js dashboard foundation with real API integrations, not a complete implementation of the approved system. Login, signup, company/account editing, request lists, event listing, letters and support provide useful starting points. The seven-role authorization model, company verification, independent event applications, four-person review rounds, investment package/publication and independent booth payments require substantial work.

Do not infer completion from the presence of a route, a Figma frame, a mock file or a passing historical test. Each FE work package in [frontend-plan.md](frontend-plan.md) defines the browser deliverable and links its original system/backend contracts and human acceptance gates.

## Evidence and limitations

- Inspected the complete top-level section inventory of the applicant, Admin and reviewer pages and extracted visible design text; previous planning also inspected representative request/assignment/form screenshots. This is not a pixel-by-pixel comparison of every frame against a running application.
- Re-read source entry points for authentication, dashboard layout/navigation, profile/resume, generic request form, admin request actions, personnel controls, API mapping and server fetch behavior. No runtime credentials or production fixtures were used.
- Current source tests exist for auth return URLs, dashboard API/proxy/server, mobile sidebar, profile RTL, events, letters and support. Their existence is not evidence that the new workflow passes. No source suites were rerun for these documentation-only changes.
- The earlier backend audit's historical result (9 files / 42 tests) applies only to that earlier run and its scope. It does not establish frontend acceptance or database integration for this specification.

## Figma coverage and source mapping

All design nodes below belong to [Dashboard](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard). Section links are references, not proof that every business rule was finalized there.

| Journey | Figma reference | Current frontend evidence | Required change |
| --- | --- | --- | --- |
| Password login and company signup | [Login 242:11653](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=242-11653), [signup 242:12192](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=242-12192) | `src/components/auth/login-page.tsx:38` calls real login; `:54` still routes using admin/editor; recovery is a notice. `register-page.tsx:255` calls real self-signup. | Align initial fields and single-role destinations; retain safe return/session handling and duplicate recovery. FE02–FE03. |
| Dashboard shell | [applicant 5:5018](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=5-5018), [reviewer 31411:7579](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=31411-7579), [Admin 30510:13146](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=30510-13146) | Authenticated layout exists; `app-sidebar.tsx:96,118` and `utilities/dashboard-server.ts` treat admin as the operational distinction. | Seven-role navigation and event/case-scoped capabilities, with real denied/expired/error states. FE01, FE29–FE30. |
| Company profile/resume | [30510:12186](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=30510-12186), [30537:19416](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=30537-19416) | Company/account editing components exist; `profile/resume-profile-view.tsx:3` is a static empty panel. Backend profile whitelist also drops array changes (T05). | Complete approved stage-two fields/documents, persistent arrays, verification revision and return/resubmit. FE04–FE06. |
| Owner personnel/company management | [30722:2394](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=30722-2394), [31070:14855](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=31070-14855) | Employee list fetches real data at `employee-list.tsx:65`; shared list new/filter/view controls disabled at `admin-list-view.tsx:41,76,82`. | Functional owner-only creation, one operational role, event teams and verification workbench. FE05, FE08–FE10. |
| Events and registration | [56:14018](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=56-14018), [30599:21935](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=30599-21935) | Event listing exists. `new-request-form.tsx:20–35` creates then submits generic string answers, only input/textarea/select. Route `dashboard/new-request/page.tsx:30` seeds answers from event query text. | Verified-company guard, authoritative subtopic IDs/RFP, private proposal, consents, resumable drafts and independent applications. FE06–FE12. |
| Company request state | [50:9221](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=50-9221), [49:7968](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=49-7968) | Real DTO/list/detail foundation; `utilities/dashboard-api.ts:10` has only five broad statuses; request detail branches admin vs applicant. | Precise stages/next action, correction/revision/history, terminal rejection/reopen and published-result redaction. FE13. |
| Chief assignment and four reviews | [31885:20781](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=31885-20781), [31885:6681](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=31885-6681) | Generic `admin-request-evaluation.tsx:21` posts to an absent backend transition route; no complete review-round experience was established. | Distinct triage/assign/replace/reopen actions and current-round 4/4 readiness; chief explicitly advances. FE14–FE18. |
| Reviewer dossier/form | [31422:20716](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=31422-20716), [31881:36043](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=31881-36043), [31881:33737](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=31881-33737) | No complete assigned-only reviewer workspace/forms/finalization was established by source audit. | Own evaluation only, draft/final lock, exact proposal/rubric revision, revoked-access handling. FE16–FE17. |
| Investment and publication | Reviewer page includes investment sidebar `31964:72696`; generic admin dossier is only a partial reference. | No complete financial package, investment memo or Secretariat publication screen family established. | New screen/state design and real private-data contracts needed. FE19–FE21. |
| Correspondence | [53:12475](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=53-12475), [56:13200](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=56-13200), [30851:15785](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=30851-15785) | Real support/letters integrations. `new-letter-form.tsx:265` disables attachment control; `dashboard-api.ts:317` maps attachments to `[]`. | Authorized recipient/case scope, real private attachments, supplementary financial follow-up and history. FE07, FE22–FE23. |
| Exhibition | Event cards/general request frames are not an independent booth/payment specification. | No complete booth catalogue/reservation/attendance/manual receipt/cancellation workspace established. | New screen family FE24–FE28 and FE32. List + guide map is approved; interactive map unnecessary. |

Paths above are relative to `apps/frontend/`; line numbers identify inspection anchors and may move. Where a row says “not established,” it describes the inspected implementation, not a claim that no reusable component anywhere exists.

## Important frontend defects and gaps

1. **Authorization shape mismatch:** the current four-role, potentially multi-role model cannot express the seven single operational roles and event-specific case assignments. A frontend-only role check cannot repair backend access.
2. **Incomplete application creation:** create followed by submit can leave a saved draft if submit fails. A retry must resume that draft, not create another application. The approved target also requires company/subtopic/revision and consent/file records.
3. **Lost evidence in UI:** letter attachments are dropped by the mapping and cannot be uploaded from the composer. The resume view is an empty placeholder; it is not persistent company history.
4. **Unsupported decision control:** generic admin evaluation calls an unimplemented transition endpoint. Do not enable a button just because the design shows an action.
5. **Error masked as no data:** `serverDashboardFetch` returns `undefined` for failed/unauthorized fetches. A denied or unavailable service can resemble an empty/404 state. Proposed adapters must preserve the reason.
6. **Missing operating panels:** Secretariat verification, scoped chief/reviewer work, investment and booth payment/cancellation require new views and role-specific actions.
7. **UI conventions:** dashboard shell and some existing views use literal colors/icons outside current frontend conventions. Apply theme/shared primitives as the affected dashboard components are touched; unrelated landing-page work is outside this plan.

## Conflicts resolved by approved conversation

| Figma/legacy suggestion | Approved requirement |
| --- | --- |
| A proposal for multiple selected titles | One independent application per subtopic; multi-selection may be a convenience only. |
| 45/40/15 weights and sample question copy | Final questions/ceilings/formula are unresolved; no hard-coded scoring and no automatic advancement. |
| Proposal formats with a universal 12 MB caption | User requires category-specific limits; values still missing. |
| Generic “send to admin” | Chief explicitly advances after four finalized reviews; company completes financial package; assigned investment person sends memo; Secretariat publishes. |
| Investment committee label | One investment person; memo only, no vote/approve/reject controls. |
| Reusable delete-company controls for reviewers/admin-like screens | Access follows approved role/assignment policy. Do not grant destructive powers from a visual reference. |
| Event/exhibition presented together | Distinct workflows; one application and receipt for each booth, prior attendance approval and no automatic expiry. |

## How completion will be assessed

Use [frontend-design.md](frontend-design.md) for the proposed route/contract/state model and [frontend-plan.md](frontend-plan.md) for the 32 linked deliverables. Run each associated [human gate](manual-acceptance-tests.md) after a real usable slice is deployed, then the full event/exhibition gates. Keep all gates Not run until a named tester records actual outcomes. No completion percentage or calendar estimate is justified by the present evidence.
