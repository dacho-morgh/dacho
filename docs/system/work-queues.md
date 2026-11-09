# Scoped queues, counts and overview (T38 / #52)

Each role's work queue, the status counts and the request filters. Human acceptance (UAT28, UAT29) has not been run, and no Figma design exists for the new overview cards or filter form. They use the existing dashboard components and await design review under FE23.

## The rule

A queue is a predicate over `dashboard.requests`, added to the actor's [row scope](authorization.md#row-scope). The list and its count run the same predicate in [`work-queues.ts`](../../apps/backend/src/dashboard/work-queues.ts), so the two cannot disagree. A filter only narrows the scope.

## Queues

| Role | Queue key | A case is in it while |
| --- | --- | --- |
| Owner | `reopen_rejected` | It is rejected at the chief's stage and can be reopened |
| Secretariat | `follow_up_unpublished` | A memo was sent and no result has been published |
| Secretariat | `supplementary_undelivered` | The company uploaded a file after the latest request, and nothing has been delivered since that request |
| Chief | `chief_triage` | It awaits triage, on an event the chief currently runs |
| Chief | `chief_start_review` | It was accepted and has no round for its current revision |
| Chief | `chief_decide` | Its current round is complete |
| Reviewer, employer | `evaluation_pending` | The person's assignment covers the current revision and their own evaluation is not final. A draft stays in the queue |
| Investment person | `memo_pending` | They hold the case, and no memo on the current package was sent after the last delivered file |
| Company | `company_draft` | It is a draft |
| Company | `company_correction` | The chief returned it |
| Company | `company_financial_package` | It was advanced and the latest invitation has no package |
| Company | `company_supplementary` | The latest request has no later correspondence file from the company |

The Secretariat, investment and supplementary queues also require the stage in which their commands accept a write: advanced, with a package on the latest invitation.

Three counts have no request list behind them, and each comes from the list that role already reads: `verification_pending` (Secretariat, `GET /admin/verifications?status=pending`), `support_open` (owner and Secretariat, `GET /support?status=open`) and `company_verification_returned` (the company's current verification, shown as 1 when returned or rejected).

## API

| Route | Who | Behaviour |
| --- | --- | --- |
| `GET /stats/overview` | Any active role | `{ counts, queues: [{ key, count }], events: [{ id, title }] }`. `events` holds only events with a case in the actor's scope, and is the filter's option list. `private, no-store`. |
| `GET /requests`, `GET /admin/requests` | As before | Also accept `search`, `eventId`, `stage`, `phase` and `queue`. |
| `GET /stats` | Any active role | Accepts the same five filters, so a status tab counts what it opens. `{ total, in_review, approved, action_needed, rejected, phases: { verification, reviewing, finished } }`. |

- `search` matches the title and tracking code only, which every reader of the row already sees. It is case-insensitive, `%` and `_` are literal, and at most 100 characters are accepted (`400 invalid_search`).
- `eventId` must be a UUID (`400 invalid_event_id`). Another event's id returns an empty list, so it confirms nothing.
- `stage` is `chief_triage`, `triaged` or `advanced` (`400 invalid_stage`).
- `phase` is `verification`, `reviewing` or `finished` (`400 invalid_phase`; a repeated parameter is invalid too). See [Company phases](#company-phases).
- `queue` must belong to the actor's role (`400 invalid_queue`).

`GET /stats/overview` used to return the same body as `/stats`. No caller read it, so its shape changed. Its `counts` now also carry `phases`.

## Company phases

Design QA #280 shows a company three phases only: «احراز هویت» (`verification`), «در حال داوری» (`reviewing`) and «تمام‌شده (نتیجهٔ نهایی)» (`finished`). The status and review stage fold into them by one table, [`company-request-phase.ts`](../../apps/backend/src/dashboard/company-request-phase.ts):

| Status | Review stage | Phase |
| --- | --- | --- |
| `draft` | any | `verification` |
| `in_review`, `action_needed` | `chief_triage` | `verification` |
| `in_review`, `action_needed` | `triaged`, `advanced` or none | `reviewing` |
| `approved`, `rejected` | any | `finished` |
| anything else | any | `reviewing` |

- The list filter and the counts run the same SQL expression, generated from that table, so `phases.<p>` of `GET /stats` equals `total` of `GET /requests?phase=<p>` with the same other filters.
- `phase` is a filter like the others: it narrows `GET /stats` too. A screen that shows a count per phase reads `/stats` without `phase`, as the status tabs read it without `status`.
- `phase` only narrows the row scope. A company still sees only its own cases, and staff lists are unchanged when it is absent. Staff may pass it, but their screens filter by the real status and stage.
- The frontend's copy of the table, `apps/frontend/src/utilities/company-request-stage.ts`, names each request's phase on the screen. `apps/backend/tests/company-request-phase.spec.ts` asserts both tables, and the SQL, agree for every status × review stage, including no stage and unknown values. Change both together.

## Confidentiality

- A queue reveals nothing its reader's list does not already show. The investment queue requires the handoff, and the chief's and reviewers' queues never read the financial tables.
- Role change, deactivation, a revoked assignment or a replacement take effect on the next request, because every count reads current assignments.
- Status counts remain whole-scope: they count all a role can read, including work that is not theirs to act on.

## Screens

- `/dashboard` shows "کارهای نیازمند اقدام" for every role, above the role's existing surface. Queues at zero and unknown keys are hidden. A failed read shows the unavailable notice, never "nothing to do".
- `/dashboard/requests` keeps status, search, event, stage, queue and page in the URL. Tabs and pagination carry them.
- The internal list now filters and pages through the API. Its in-browser search looked only at the first 100 rows, so a total above that disagreed with the list, and it is removed.

The verification and support cards do not link: no screen lists exactly those rows yet. FE05 adds the verification workbench. Exhibition queues (T47–T52) are not in this slice, as T38 does not depend on them.

## Assumptions to confirm

- **The owner's queue holds cases that may be reopened.** Reopening is an exception rather than a duty, so a rejected case stays there until reopened. No other state-derived owner action was approved.
- **A published result closes `follow_up_unpublished`, even if a newer memo arrives later.** The memo stays readable on the case, but it does not bring the case back to the queue.
- **A delivered file reopens `memo_pending`.** T33 says the investment person "can then write another memo". It does not say they must.
- **One delivery clears `supplementary_undelivered`.** The Secretariat cannot dismiss a file, and the company can upload unrelated correspondence, so counting each undelivered file would leave a number that never reaches zero.
- **Search does not cover company names.** Reviewers' generic rows omit company fields, so matching them would let a search reveal more than the row shows.

## Verification

- `apps/backend/tests/int/stats-activities.int.spec.ts` seeds every status × review stage for two companies on real Postgres and checks the phase list, its pages, `/stats` phase counts, company isolation, staff totals and `400 invalid_phase`.
- `apps/backend/tests/int/work-queues.int.spec.ts` runs on real Postgres: one case through every queue with list, overview and `/stats` compared at each step, each chief's own event, search and filter isolation for five roles, revocation, replacement and invalid input.
- `apps/frontend/tests/int/work-queue-overview.int.spec.ts` covers the cards, the empty and failed states, and filters carried across tabs and pages against a stubbed API. It is not evidence of the real integration.
