# Investment handoff and dossier (T31 / #47)

Backend slice that hands a submitted [financial package (T30)](financial-package.md) to the event's investment person. Human acceptance (UAT23) has not been run, and the screens (FE19, FE20, FE30) are not built. The memo is [T32](investment-memo.md); correspondence is T34; supplementary files are in [follow-up and publication (T33)](secretariat-follow-up.md).

## The handoff

Submitting a complete package hands the case off in the same transaction, under the request row lock:

- The event's `responsible_investment_id` gets an active `dashboard.case_assignments` row with `assigned_by = 'system'`.
- Any hand-made grant to another investment person ends, with `revoke_reason = 'investment_handoff'`. The role is one person per case, and the package now opens the files to whoever holds it.
- A history row with action `investment_handoff` is written. A repeated submit changes nothing.

There is no separate handoff table. The handoff is the pair of an active assignment and a package on the case's latest invitation, and either one missing closes the files. A package of an earlier invitation does not count, so a later advancement closes them again until the company resubmits.

The person is read once, at submission. Changing the event's responsible person later does not move a case already handed off. If that person has since been deactivated or changed role, the assignment still lands but gives no access until the owner reassigns. A package is never stored without an event to hand it to.

## API

| Route | Who | Behaviour |
| --- | --- | --- |
| `GET /investment/queue` | Investment person | `{ items, total, page, totalPages }`: the cases handed off to them, newest package first. An assignment without a package does not appear. Every other role gets `403`. |
| `GET /investment/cases/:id` | Investment person holding the case | `{ case, proposal, rfp, company, package, evaluations }`. `404` without an active assignment or a package. Every other role gets `403`. |
| `GET /documents`, `/documents/:id`, `/documents/:id/download` | Investment person holding the case | Financial categories open after the handoff. Everyone else outside the audience gets `404`, as before. |
| `POST /admin/requests/:id/assignments` | Owner | A second investment person gets `409 investment_person_assigned`. To reassign, the owner revokes the current person first, then grants the new one. |

`proposal` and `rfp` are the revision the chief advanced, with download routes. `company` is the necessary profile reviewers get, not the private verification dossier. `package` is the frozen snapshot with download routes.

`evaluations` holds the final evaluations of the advanced round whose author still holds an active slot, which is the same rule the 4/4 count uses. Drafts and evaluations of people who left their slot stay out. `userId` is removed: the investment person needs what the four reviews say, not who wrote each one.

The routes for the invitation, the package and the evaluations (`/requests/:id/financial-invitation`, `/financial-package`, `/evaluations`) keep their `403` for the investment person. The dossier is their one read of those records.

## Confidentiality

| Reader | Financial files | `financial_package_submit` history | `investment_handoff` history |
| --- | --- | --- | --- |
| Owner, Secretariat | Yes | Yes | Yes |
| Investment person holding the case | Yes | Yes | Yes |
| Owning company | Yes | Yes | No |
| Chief, reviewer, employer, another investment person | No | No | No |

Hiding the two history rows from chiefs and reviewers closes a gap from T30, where the timeline showed them that a package had been submitted. The permission matrix confines package status to the financial audience. The history row shows no names.

Revoking the assignment, deactivating the account or changing its role ends access on the next request.

## Migration

`1780511400032_investment_handoff` adds no schema. It hands off packages already submitted: it ends other active investment grants on those cases and assigns the event's person. They get no history row. Its rollback revokes the system-made assignments and keeps hand-made ones.

## Assumptions to confirm

- **The event's responsible person receives every case automatically.** The issue says "the event's investment person", and no step for choosing someone else was approved.
- **Evaluation authors stay unnamed to the investment person.** The rules allow the evaluations; they do not say whether names are included.

## Verification

- `tests/int/investment-handoff.int.spec.ts` runs on real Postgres: no handoff before a complete package, one handoff on a retry, the dossier and files for the holder, denial for each role outside the audience, hand-made grants, reassignment, a later event change, deactivation and the migration backfill.
- `tests/access-policy.spec.ts` covers the file rule.

## Not in this slice

The [memo (T32)](investment-memo.md), correspondence with the investment person (T34), supplementary files, covered by [follow-up and publication (T33)](secretariat-follow-up.md), the screens (FE19, FE20, FE30), a notification to the investment person when a case arrives, and a dedicated reassign command.
