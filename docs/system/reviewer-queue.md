# Assigned reviewer queue and case file (T23 / #39)

Backend slice only. Human acceptance (UAT15) has not been run and the frontend (FE16) is not built.

Ordinary reviewers and employer reviewers get a queue and a case file that are derived from their own active server-side assignment, and from nothing the browser sends. The assignments come from the review round (T22), so the people on a queue are the four chosen for the case revision. Hand-made owner grants, where they still exist, appear the same way.

## API

| Route | Who | Behaviour |
| --- | --- | --- |
| `GET /review/queue` | Reviewer, employer reviewer | Active assignments of the caller only, newest first. `view=open` (default), `closed` or `all`; `page`, `limit` (max 100). Returns `items`, `total`, `page`, `totalPages` and `counts {open, closed, all}` over every assignment. Any other role: `403`. |
| `GET /review/cases/:id` | Reviewer, employer reviewer | The case file for an active assignment, else `404` (a guessed or foreign id confirms nothing). Any other role: `403`. |

A queue item carries the tracking code, title, event and subtopic titles, the company name, the case state and revision, the caller's own role and slot, the round (`current` is true while it reviews the request's present revision), the proposal revision the caller reviews, `actionable` and the caller's **own** evaluation state (`draft` or `final`, never answers or scores).

`actionable` is true while the case is `in_review` and the caller's round covers the current request revision. A case that was returned, rejected, decided, or moved on to a newer revision stays in the queue as closed work until its assignment ends (a new round supersedes the old assignments, T22).

The case file adds:

- the proposal at the reviewed revision: form version, application team, submitted answers and the proposal files pinned to that revision, each with a download link;
- the RFP version pinned to the application, with its files;
- the necessary company profile only: name, national id, type, province, city, legal entity type, classification, activity domain, products and services.

It never carries the owner or representative, the private verification dossier or its files, financial files, the round roster, the chief's or other reviewers' identities, or anyone else's evaluation.

## Rules enforced

- The queue and the case read `case_assignments` joined to the actor's id **and current operational role**. A role change, deactivation or revoked/superseded assignment removes access on the next request.
- The proposal revision comes from the round (`review_rounds.proposal_revision`). A reviewer of an older round keeps reading exactly what was reviewed, not a newer unreviewed revision. Hand-made grants without a round read the latest submitted revision at or below the request revision.
- The evaluation join is pinned to the actor's user id, so another reviewer's evaluation cannot reach the projection.
- On event applications, `GET /documents`, `GET /documents/:id` and the download route let reviewers and employer reviewers read only the proposal files pinned to the revision they review. Files added after submission (for example a correction in progress), other revisions and financial files are `404`. Requests of other services have no pinned proposal and keep plain case-assignment access.
- `GET /requests/:id/proposal` shows these roles only the reviewed revision (`revisions` lists just that one; another `revision` is `404`). `GET /requests/:id/verification` uses the same necessary-profile projection as the case file.
- Responses are `Cache-Control: private, no-store`.

## Generic request routes

`GET /requests`, `GET /admin/requests`, their `/:id` details, `/requests/:id/history` and `GET /activities` also return only a minimal view to reviewers and employers: no `ownerId`, `companyId`, `submittedBy` or `owner`, and timeline entries without account ids or decision reasons. Event applications show the reviewed revision's `answers` on the detail routes; lists carry empty `answers`. Requests of other services with nothing pinned keep their own answers. Oversight roles and the owning company are unchanged. The existing dashboard pages read `owner` and `ownerId` with optional chaining, so they show a dash instead of a company link for these roles.

## Not in this slice

The reviewer frontend (FE16), the rubric/evaluation screens, replacing a reviewer or the employer (T26), the chief's decision (T27–T29) and notifications. The chief and investment roles keep their own surfaces. Reviewer screens should use the two routes above.
