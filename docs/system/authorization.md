# Shared role and assignment authorization (T09 / #23, T16 / #28)

Status: implemented 2026-10-26 for the resources that currently exist. This
document is the authorization contract for the backend dashboard API, the
dashboard proxy and the CMS records it protects. Product rules remain in the
[permission matrix](permission-matrix.md) and [product requirements](product-requirements.md).

## Authority input

Every request is authorized from the **current persisted account**:

- `users.operationalRole` must be one of the seven roles and `isActive` must be
  true. Service, inactive and role-less accounts are denied.
- The proxy resolves the Payload session and forwards only the acting user id
  plus the shared internal secret. The backend reloads the account and ignores
  the forwarded compatibility `x-user-roles` header.
- Ownership comes from persisted relationships: `requests.owner_id` and
  `companies.representative`.
- Assignment comes from `dashboard.case_assignments`, which records one active
  row per `(request, user, role)`. Historical rows remain inactive evidence.
- Event responsibility comes from the persisted `dashboard.events` row. A chief
  or investment reviewer has event scope only when their current user id matches
  that event's responsible person.
- Browser-supplied roles, owner ids, company ids, event ids, recipient lists,
  assignment claims and target states are never authority.

## Row scope

Request lists, search filters, detail reads, pagination totals, stats, activity
history and document parents use one scope predicate. Event configuration uses
the persisted-responsibility predicate below.

| Role | Request scope | Company dossier | Event configuration |
| --- | --- | --- | --- |
| System Owner | all | all | all; manage |
| Central Secretariat | all for workflow/support | all (read) | all (read) |
| Chief Reviewer | assigned requests only | assigned case's necessary profile only, not the CMS dossier | assigned event only |
| Reviewer | assigned requests only | assigned case's necessary profile only | none |
| Employer Reviewer | assigned requests only | assigned subtopic/case profile only | none |
| Investment Reviewer | assigned requests only | assigned case profile; financial package only after the [T31 handoff](investment-handoff.md) | assigned event only |
| Company Representative | `owner_id = current user` | own company only | none |

`dashboard.case_assignments.role` must exactly match the person's current
operational role. Changing the role, deactivating the account or revoking the
assignment removes access on the next request; no cached page, document id or
previously rendered link keeps access.

Event configuration follows the same fresh-read rule. System Owner reads and
writes every event; Central Secretariat reads every event; an assigned chief or
investment reviewer reads only that event; every other role is denied. Event
responsibility does not import request, dossier or document authority.

Every event update is revision-checked and audited. `PATCH /admin/events/:id`
requires the current `revision` plus a non-empty administrative `reason`; a
stale revision returns `409 stale_event` without writing. The update and its
`dashboard.event_audit` row commit in one transaction. The audit row stores the
acting owner, reason, new revision, changed field names and full before/after
snapshots. The existing `dashboard.activities` table is request/letter-specific
and has no event or before/after shape, so event history uses a dedicated table.
Client-supplied ids, actors and revisions are requests, never authority: the
row lock and `WHERE revision = $n` check decide whether the write applies.

## Server-derived actions

Request responses carry `allowedActions`, computed by the same
`allowedRequestActions()` function the endpoints use:

| Actor/state | Actions |
| --- | --- |
| System Owner | `read`, `assign`, `uploadDocument`, `deleteDocument` |
| Central Secretariat | `read`, `uploadDocument` |
| Chief / Reviewer / Employer / Investment (assigned) | `read` |
| Representative, own draft | `read`, `submit`, `uploadDocument`, `deleteDocument` |
| Representative, own submitted | `read` |
| Representative, another company | no access (404) |

Event responses carry the same shape for their implemented actions: System
Owner has `read` and `manage`, Central Secretariat has `read`, and the assigned
chief or investment reviewer has `read`. Future triage, evaluation, memo,
reopen, publication and receipt actions are not advertised because their
backing workflows do not exist yet. A hidden button is never treated as an
access check.

## Current endpoints

| Endpoint | Rule |
| --- | --- |
| `POST /requests` | active representative only; owner is the acting user |
| `GET /requests`, `GET /requests/:id` | shared row scope; detail returns safe `owner {id,name}` only |
| `POST /requests/:id/submit` | owner representative and `draft`; a retry returns `409 already_submitted`; other roles `403` |
| `GET /admin/requests`, `GET /admin/requests/:id` | internal roles only, still using the same row scope |
| `POST /admin/requests/:id/assignments` | System Owner only; target must be active and its current role must match the assignment role; duplicate active assignment `409` |
| `DELETE /admin/requests/:id/assignments/:userId` | System Owner only; stores revoker, time and reason; access ends immediately |
| `GET /admin/requests/:id/assignments` | System Owner / Central Secretariat |
| `GET /admin/events`, `GET /admin/events/:id` | internal roles only; System Owner / Central Secretariat all, assigned chief/investment reviewer own event, other internal roles empty/404 |
| `POST /admin/events`, `PATCH /admin/events/:id` | System Owner only; responsible people must be active and currently hold chief-reviewer / investment-reviewer respectively; registration close must be after open; PATCH requires the current revision and a reason, records an atomic audit entry and returns `409` for a stale revision |
| `GET /letters`, `GET /letters/:id`, `DELETE /letters/:id` | case letters require current case ownership/assignment and sender-or-recipient participation; deletion additionally requires recipient scope. Non-case personal letters retain sender/recipient scope; all-scope oversight remains explicit |
| `GET /stats`, `GET /activities` | identical scope as the request list |
| `GET /admin/companies`, `GET /admin/companies/:id` | System Owner / Central Secretariat; explicit projection with no raw user, credential, API key, session or personnel history |
| `GET /admin/employees` | System Owner / Central Secretariat; id/name/role/active only |
| `GET /support`, `POST /support`, responses and close | representative's own ticket or System Owner / Central Secretariat |
| `GET /exhibitions/:id/catalogue` | any active operational role; active booths and public catalogue fields only |
| `GET /admin/exhibitions/:id/catalogue` | System Owner only; includes inactive booths |
| `PUT /admin/exhibitions/:id/settings`, `POST|PATCH /admin/exhibitions/:id/booths` | System Owner only; validated catalogue writes |
| `GET/PATCH /profile` and addresses | active representative with an existing company; identity fields remain protected |

The booth catalogue contract, explicit toman unit and immutable price-version
snapshot are documented in [exhibition booth catalogue](exhibition-booth-catalogue.md).

Inaccessible request and event ids return `404`, so a guessed id does not
confirm existence. Privileged adapters return explicit projections rather than raw CMS
records.

## CMS boundaries

- `companies` reads: System Owner and Central Secretariat read all; a
  representative reads only its own company; chief/reviewer/employer/investment
  and editorial-only accounts receive no direct CMS dossier read. Assigned case
  staff receive only the backend necessary-profile projection.
- `companies` writes: System Owner any; representative its own non-identity
  fields. National id and representative relationship stay owner-only.
- `users` reads: System Owner all, Central Secretariat all for operations, and
  every active account may read itself. API keys, sessions and personnel history
  stay owner-only. Role, activation, editorial and service fields remain
  owner-managed; the T08 service-credential restrictions are unchanged.
- `hasCmsRole` now admits the System Owner, Central Secretariat and the
  independent editorial desk. Editorial privilege still never grants an
  operational role or workflow authority.
- Public `events`/`exhibitions` CMS content remains separate from the backend
  event configuration. The configuration record stores the registration window
  and responsible people; it does not publish content or grant CMS edit access.

## Deliberately denied / future integration

These resource types have no implemented prerequisite, so their operations are
absent or denied rather than stubbed permissively:

- Subtopic, RFP and event-team definition workflows (T17–T18).
  T16 implements only the event configuration record and its owner-only
  commands. The existing `events`/`exhibitions` collections remain public
  content only. T47
  booth definition and catalogue reads are implemented separately in the
  backend, as documented in [exhibition booth catalogue](exhibition-booth-catalogue.md).
- Application revisions, triage, review rounds, four evaluations, replacement
  and chief decisions (T19–T28).
- The [investment memo (T32)](investment-memo.md) and
  [follow-up and publication (T33)](secretariat-follow-up.md) are
  implemented on their own routes. Financial files open to the
  investment person only with an active assignment after the
  [T31 handoff](investment-handoff.md); a generic assignment alone stays denied.
- Correspondence attachment workflow and booth receipts (T35, T50).
- Any dashboard action that has no backend command is not advertised in
  `allowedActions`.

## Verification

- Backend unit: 12 files / 73 tests, including the seven-role matrix,
  allowedActions, revocation, document audience, event validation/scoping,
  revision conflicts and audit history.
- Backend Postgres integration: 9 files / 57 tests, including real persisted
  requests, assignments, event configuration and audit history, concurrent
  event updates, role changes, deactivation, lists/details/counts, letters,
  safe projections and file isolation.
- Frontend Postgres integration: 49 files passed + 1 skipped; 202 tests passed +
  1 skipped, including direct CMS/Local API dossier denial and the shared
  document controls.
- `pnpm typecheck`, `pnpm lint` (0 errors), database-free Next.js build and
  backend build passed locally on 2026-10-24. Backend typecheck, unit and the
  guarded isolated Postgres integration suite passed on 2026-10-26.

UAT gates remain **Not run**. This implementation does not pass a human
acceptance test, deploy staging or migrate real data.


## Role-scoped correspondence — T34

`POST /letters` accepts current operational recipients and applies the role policy before writing. Company representatives can contact Secretariat; ordinary/employer reviewers can contact the uniquely active chief on a case for which both hold current access. Owner/chief general letters do not assign a case or broaden dossier/file access. Case-linked sends authorize both parties in the INSERT statement and hold shared locks on active assignment rows so committed/concurrent revocations cannot be bypassed by earlier route reads. Reading a sent/oversight letter leaves its unread flag unchanged; only its recipient marks it read.

The investment person writes only case-linked letters, only on a case they hold, and only with the Secretariat and the System Owner; those two can write back on that case. Holding means the [T31 handoff](investment-handoff.md): an active assignment and a package on the latest invitation, checked in the INSERT statement. A generic assignment opens no letters, and revoking the assignment ends sending and reading on the next request. Owner and chief general letters to the investment person stay open and carry no case.

A case letter from the investment person shows that a package was handed off, and package status is confined to the financial audience. So the chief, reviewers and employer are not recipients, even though they are assigned to the case. The company stays with Secretariat support, as the permission matrix requires. The product owner confirmed this reading of "assigned-case participants" on 2026-10-31.

A letter opens no file: an attachment needs both parties in its audience, so a correspondence file reaches the investment person only after the [Secretariat delivers it](secretariat-follow-up.md).

### Permitted recipients

`GET /letters/recipients` answers `{ items: [{ id, name, operationalRole }] }` with no contact details, and leaves out the actor. Sending re-checks every rule, so the list is a convenience and not permission.

| Query | Behaviour |
| --- | --- |
| none | People the actor may write to without a case. Optional `search` matches the name, and each role returns at most the user store's 100-row page, so a composer should search rather than treat the list as complete. |
| `requestId` | The owner and Secretariat, then the case's active assignees and its company, each filtered by the role policy. `400 invalid_request_id`; `404` for a case outside the actor's scope. The investment person gets an empty list before the handoff, and a reviewer or employer gets an empty list without one active chief. |

| Actor | Without a case | On a case in their scope |
| --- | --- | --- |
| Owner | Everyone | Secretariat, company, assignees, and the investment person after the handoff |
| Secretariat | Companies | Owner, company, assignees, and the investment person after the handoff |
| Chief | Everyone | Owner, Secretariat, company, and reviewers on the case; not the investment person |
| Reviewer, employer | Nobody | The case's one active chief |
| Investment person | Nobody | Owner and Secretariat, after the handoff |
| Company | Secretariat | Secretariat |

T22 assignments and the unique-chief check decide the reviewer's chief. Screens are [FE22](frontend-plan.md), and human acceptance (UAT27) has not been run.
