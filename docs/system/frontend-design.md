# Frontend design and integration specification

Updated 2026-10-24. The product rules are approved; route names, DTO shapes and module boundaries below are **proposed implementation design** unless an implementation update says otherwise. Read [requirements](product-requirements.md), [workflows](workflows.md), [backend design](backend-design.md) and [frontend audit](frontend-audit.md) first.

Implementation update (FE07 usable portion, 2026-10-24): the shared
`PrivateDocumentField` is connected to the real authorized document API on the
company-profile and request screens. It supports multiple files, Word/PDF
validation, per-file progress, retry, denied/expired-session states and blocks
final request submission while an upload is pending or a required proposal is
missing. Company dossier uploads and draft request files are immediate; RFP,
finance-package completeness, correspondence attachments and booth receipts
remain later workflow integrations, so issue #71 stays open. See
[private documents](private-documents.md).

Implementation update (FE23/FE13/FE30 scoped queues, 2026-10-28): the applicant
dashboard and `/dashboard/requests` now read real `/stats`, `/requests` and
`/activities` responses and keep the queue filter in the URL (`?status=`), so
back navigation, refresh and shared links preserve scope. `status` is validated
against the DTO enum before it reaches the queue query; unknown values are
dropped rather than forwarded. Stat cards link to the status queue they count.

Supported read contracts used by these screens:

| Endpoint | Response | Notes |
| --- | --- | --- |
| `/stats` | `RequestStats`: `total`, `in_review`, `approved`, `action_needed`, `rejected` | Role-scoped aggregates; never filtered by the UI |
| `/requests?status&page&limit` | `Paginated<RequestDto>`; item adds `trackingCode`, `currentStep`, `assignedRole`, `allowedActions` | Scope enforced server-side; `status` is one of the five DTO statuses |
| `/requests/:id` | `RequestDetail`: `request`, `workflow[]`, `timeline[]` | `timeline` carries `type`, `title`, `description`, `at` |
| `/activities?page&limit` | `Paginated<ActivityDto>` with optional `requestId` | Only activities bound to a request link to that request |

Error contract: `serverDashboardFetchResult` preserves `401 → expired`, `403 →
denied`, everything else non-2xx or a transport failure → `unavailable`, and
only a 2xx read produces `ok`. `unavailableReasonFor` maps those kinds to the
`OfflineNotice` surfaces, so a denied or failed read is never rendered as an
empty queue; `Loading`/`Failed`/`Empty` are three separate visual states on
every queue and on the request dossier. Regression coverage lives in
`tests/int/dashboard-api-contracts.int.spec.ts` and
`tests/int/permission-matrix.int.spec.ts`.

Still open on these tickets: submitting a corrected revision (no
`PATCH /requests/:id` exists on `staging`), the company-visible published
result text (no released-result field in `RequestDetail`), and a submitted
revision counter (internal `revision` is not part of the public DTO). The
tracking table, stage/next-action summary, timeline and role-scoped queues are
delivered; FE13/FE23 stay open for those three backend dependencies.

## Design boundaries

Keep the existing Next.js App Router, same-origin dashboard proxy, Payload session and shared UI primitives. Reuse existing lists, profile editing, support, layout and loading components where their semantics fit. Avoid a second browser workflow engine or browser-maintained access grants. The server owns eligibility, allowed actions, active revision, review completion, reservation exclusivity, price, receipt verification and publication.

One account has one operational role. A reviewer and employer use the same review capabilities where assigned, while the employer slot remains identifiable and replacement-restricted. Event responsibility scopes chiefs and the single investment person. Owner/global messaging permission never implies every recipient can read the case being discussed.

## Route and workspace inventory

Existing routes can be adapted; proposed new paths are illustrative and should be reconciled with navigation before coding. These are UI routes, not new backend endpoint promises.

| Workspace / route family | Actors | Main view and allowed actions | Packages |
| --- | --- | --- | --- |
| `/login`, `/register` | Public / company | Password login and initial signup; safe return URL, duplicate recovery | FE02–FE03 |
| `/dashboard` | All authenticated roles | Role-scoped counts, pending work and useful next action | FE01, FE23 |
| `/dashboard/profile/company`, `/resume`, `/account` | Own company | Full profile/arrays/documents, verification submit/resubmit and account details | FE04 |
| `/dashboard/companies`, `/companies/:id/verification` (extension) | Secretariat / owner | Verification queue and submitted revision; approve/return with reason | FE05 |
| `/dashboard/employees` and event assignment controls | Owner | Create personnel, assign one role and event responsibilities | FE08 |
| Event authoring or authorized CMS entry | Owner | Event details/window, chief/investment person, categories, subtopics/employer/RFP | FE09–FE10 |
| `/dashboard/events` and event detail | Company | Real event/subtopic discovery, RFP download, verification gate | FE06, FE11 |
| `/dashboard/new-request` or event/subtopic-specific registration | Verified company | Fixed form, team, consents, proposal, draft/resume/submit per subtopic | FE12 |
| `/dashboard/requests`, `/requests/:id` | Company / responsible staff | Role-filtered list/dossier, revisions and visible next actions | FE13–FE16, FE23 |
| Request review/assignment/summary subviews | Chief / assigned reviewer / owner for exceptional actions | Triage, four assignments, own evaluation, replacement, 4/4 summary and explicit chief advance | FE14–FE18 |
| Request financial-package subview | Own invited company | Draft, required-category checklist, versioned financial submission | FE19 |
| Investment queue and case memo subview | Assigned investment person | Authorized dossier/reviews/finance, memo save/send only | FE20 |
| Secretariat result subview | Secretariat | Supplementary correspondence, company-facing preview and explicit publication | FE21 |
| `/dashboard/inbox`, `/letters`, `/letters/new`, detail/thread | Authorized role/case participants | Scoped recipients, private attachments, replies and read state | FE22 |
| Exhibition authoring and booth list | Owner / company in distinct modes | Booth specifications, cap, guide map, availability and explicit toman prices | FE24–FE25 |
| Booth application detail / Secretariat queues | Owning company / Secretariat | Independent attendance decision, receipt versions/verification, cancellation | FE26–FE28 |

Do not make company financial files available from chief/reviewer dossier tabs, global search, correspondence previews or cached prefetches. A shared route must receive a role-filtered payload; client-side concealment after downloading private fields is insufficient.

## Proposed modules

| Module boundary | Responsibility | Must not own |
| --- | --- | --- |
| Session/capability adapter | Typed current role, event assignments, safe redirect and allowed actions | Assign roles or infer permission from a URL |
| Profile/verification | Current editable profile, submitted revision, missing fields and review decisions | Rewrite previously approved application snapshots |
| Event application | Event/subtopic identity, fixed form, draft/revision and consent/file references | Calculate eligibility or silently combine applications |
| Review round | Round/revision context, four slots, own form and chief summary | Reuse an old round's final score as a current review |
| Investment/publication | Restricted financial package, internal memo and separate public result | Publish internal memo automatically |
| Correspondence | Authorized recipients, case-linked threads and classified file references | Broaden dossier access because a user is messaged |
| Exhibition | Independent booth application, attendance, price, receipt and cancellation state | Local inventory locks, automatic expiry or shared payment |
| Shared document controls | Category policy, upload status, authorized download and errors | Public media fallback or invented format/size limits |

## Proposed API adapter contracts

Coordinate these logical requirements with backend issues; reconcile exact names/paths before implementation. Current broad `RequestStatus` and untyped attachments need extensions. Prefer discriminated DTOs for event applications and booth applications. Public company projections and financial projections must be separate server responses where access differs.

| Read model | Required information | Security/state constraints |
| --- | --- | --- |
| Session/navigation | Operational role, permitted workspaces, event responsibility | Exactly one operational role; CMS editing permissions may be an implementation detail, not another operational role |
| Company verification | Editable profile version, submitted/approved version, missing fields, state/reason | Own company can edit/resubmit; Secretariat reviews exact submitted version; identity edit triggers new eligibility state |
| Event/subtopic | IDs, hierarchy, registration state, employer person, RFP version/document | Reject cross-event IDs and stale RFP/subtopic context server-side |
| Application dossier | Company/event/subtopic IDs, tracking code, stage, active revision, visible history, `allowedActions` | Own/assigned projection only; internal reviews/memos absent from company data |
| Review round | Round ID, proposal revision, four assignments, own evaluation or privileged summary, finalized count | Other evaluations absent from reviewer DTO; historical scores not counted in current 4/4 |
| Financial package | Category checklist, file references, revision, draft/submitted state | Company, assigned investment person, Secretariat and owner only |
| Investment memo/public result | Distinct internal memo and published result records/times | Company response includes published text only; investment actions are memo save/send |
| Correspondence | Thread/case ID, permitted recipients, messages, classified attachments, read state | Recipient lookup, send and download enforce the same case/privacy policy |
| Booth catalogue/application | Exhibition cap, available booth ID/specs, explicit price/unit, captured application price, attendance/payment/cancel states | One application per booth; server enforces cap/exclusive reservation; no expiry |
| Queue/history | Paginated items, authorized counts, filters, actor/action/time/reason/revision | Do not leak denied cases through counts, search snippets or notification bodies |

For mutations, return the updated authoritative record/revision and the next permitted actions. Document expected stale-version/conflict, denied, unauthenticated, validation, unavailable and duplicate/idempotent responses; exact HTTP/error codes remain a backend contract decision. A frontend cannot assume an arbitrary POST was safe to repeat.

## Common mutation and file behavior

1. Load authoritative case/profile/booth state and render only actions provided for the active role/stage. State labels and available buttons should derive from the same response.
2. Keep the form draft in component state and preserve it on recoverable errors. Disable duplicate submit while pending. Keep mutation state separate from loading the dossier.
3. For create-then-submit flows, retain the created draft ID if final submission fails. Refresh/resume that ID; do not POST a fresh application on every retry. Coordinate idempotency with backend.
4. Send the version/round/assignment and any idempotency token required by the agreed API. On stale/conflict, refresh and explain what changed; do not silently replay a decision on the new revision.
5. On success, update/refresh relevant dossier, queue and counts. A notification delivery delay does not undo a committed business action.
6. An upload is a pending operation until the server returns an authorized document reference. Do not submit a category as complete while upload failed/pending. Replace files only through permitted draft/revision operations, preserving historic references.
7. Render the approved temporary [document policy](document-policy.json): Word (.doc/.docx) and PDF only, 10 MB per file, multiple files on one field including Word + PDF together. Images are deferred; no numerical business count cap was supplied. Apply the limit per file rather than to the entire request. Preserve one RFP/receipt version with its complete list of representations.
8. Do not place protected financial content in public media, localStorage, analytics, console logs or route query strings. On revoked access/session change discard sensitive cached data and revalidate document access.

## UI states and Persian wording

| State | Expected presentation |
| --- | --- |
| Loading | Section-specific skeleton/progress with an accessible label; prevent stale action clicks |
| Empty | Explain no authorized records or no filter matches; offer only a meaningful permitted next step |
| Failed read | Explicit unavailable/retry state; never render it as successful empty data |
| Unauthenticated | Safe login return flow and no private-data flash |
| Denied/revoked | Clear no-access state; no protected payload/download link remains available |
| Incomplete verification | Required items and link to exact profile section; keep registration context |
| Pending verification/attendance | Explain who acts next; company approval and booth attendance are distinct |
| Returned for correction | Reason and editable current revision; retain same case/tracking code |
| Finally rejected | Reason and bounded event/subtopic restriction; owner-only reopen when authorized |
| Draft/saved | Visible save status; refresh restores persisted data without pretending final submission |
| Stale/conflict | Explain another change/reservation; refresh authoritative state with recoverable user input |
| Awaiting fourth review | Correct finalized count; no automatic advance even when 4/4 becomes ready |
| Investment memo sent | Secretariat is next; company still sees no unpublished memo/result |
| Receipt returned | Correction reason; booth remains reserved; separate receipt versions |
| Cancellation requested | Show pending manual decision; no premature released booth/refund success |

Use existing Typography and Button primitives, generated icon barrel, Tailwind utilities and theme tokens under `apps/frontend/AGENTS.md`. UI copy remains Persian and RTL. Handle mixed-direction identifiers, national IDs, email, tracking codes and filenames without corrupting values. Monetary displays explicitly say toman and parse/format without unit ambiguity; the server owns the amount. Preserve keyboard access, visible focus, modal focus restoration and screen-reader labels/errors. Support small phone-width registration, documents, queues and receipt correction; a horizontally overflowing desktop table alone is not a complete mobile flow.

## Testing and delivery

Contract/render tests should prove behavior that can regress: redacted fields, distinct denied/error/empty states, role actions, independent subtopic/booth payloads, attachment mapping, stale responses and resume-after-partial-failure. Integration tests must verify real persistence and authorization on an isolated environment. UI permission tests supplement backend/CMS/proxy/file permission tests.

FE31 and FE32 provide real-backed multi-account E2E. They cannot replace named human execution of UAT01–UAT42. Each slice can enter manual testing as soon as it is deployable, with linked prerequisites ready. Record a build, test URL, synthetic fixture IDs, tester, step outcomes and evidence; retain failures and rerun records. The ordinary/employer question sets and per-review scoring are now supplied in [review-rubric.md](review-rubric.md); all qualitative/risk questions are now required at finalization, articles are capped at 2 total, and the Word/PDF upload policy is supplied. Missing approved agreement text blocks consent assertions, not unrelated implementation. Technical DTO/precision choices and unrequested aggregation are not product blockers.
