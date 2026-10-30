# Reviewer replacement and assignment history (T26 / #42)

Backend slice only. Human acceptance has not been run and the frontend is not built. It builds on the [review rounds (T22)](review-rounds.md) and the [evaluation guard (T25)](evaluation-foundation.md). It changes who holds a slot of the current round; it never moves the case, counts evaluations or decides anything (T27–T29).

## API

| Route | Who | Behaviour |
| --- | --- | --- |
| `POST /requests/:id/review-round/reviewers/:userId/replace` | The event's responsible chief | Body `{ replacementId, reason?, expectedRevision? }`. Replaces one **unfinished ordinary** reviewer. |
| `GET /requests/:id/review-round/candidates` | Responsible chief | Unchanged route; once a round exists it also leaves out everybody who already held a slot of that round. |
| `POST /requests/:id/review-round/employer/replace` | System Owner only | Body `{ employerId, reason, expectedRevision? }`. `reason` is mandatory. Replaces the case's employer. |
| `GET /requests/:id/review-round/employer-candidates` | System Owner only | Active employer-reviewers who have not held a slot of the round. |
| `GET /requests/:id/review-round` | Owner, Secretariat, the case's chief | Now also returns `replacements` (slot, outgoing and incoming person, actor, reason, time). A reviewer sees only their own active slot and no replacements. |

Case responses advertise `replaceReviewer` only to the responsible chief and `replaceEmployer` only to the System Owner, and only on an `in_review` / `triaged` case with a round for its current revision.

## Rules enforced

- **Authority.** Only the responsible chief replaces ordinary reviewers; only the System Owner replaces the employer. The chief can never touch the employer slot, and the owner cannot replace ordinary reviewers. Authority, state (`in_review`/`triaged`), revision (`stale_revision`) and the current round (`round_not_started`) are re-read under the request lock.
- **Reason.** An employer change without a non-blank reason is refused (`reason_required`), also by a database check on both the replacement and the activity row. The chief's reason is optional (at most 1000 characters) and a blank one is stored as none.
- **Unfinished only.** An ordinary reviewer who already finalized an evaluation for the current revision cannot be replaced (`evaluation_final`). The check runs under the same request lock as the evaluation write guard, so a finalization racing a replacement either commits first (and blocks it) or finds the access already gone. The owner's exceptional employer replacement is not limited this way; the earlier employer's evaluation stays stored and attributable but no longer belongs to an active assignment, so it does not count toward the current round.
- **Eligibility.** The incoming person must be an active person with the slot's own role (`reviewer` or `employer-reviewer`), and cannot already hold a slot of the round (`already_assigned`). A person who already left this round cannot come back (`previously_assigned`), so an old draft or locked evaluation never silently returns. Four distinct active people always remain.
- **Access.** The outgoing assignment is revoked in the same transaction (`replaced_reviewer` / `replaced_employer`, with actor and time). Its holder loses the round view, the evaluation endpoints and the scoped queue at the next request. The incoming person gets an ordinary round-bound `case_assignments` row for the same slot, so the T25 guard, the scoped queues and the constraints from T22 apply unchanged. Generic owner assignment commands still cannot add or revoke round slots.
- **History.** Assignments are never rewritten. Each replacement writes a `dashboard.review_replacements` row (one per replaced assignment) and a transition-history entry (`chief_replace_reviewer`, `owner_replace_employer`) carrying actor, reason, revision and time. Evaluations of the outgoing person are kept.
- **Employer scope.** Replacing the employer is recorded against the case. The event subtopic's configured employer and the RFP are unchanged. The round's `employerId` follows the new person. A later round for a new revision of the same case keeps the owner's substitute while that person is still an active employer-reviewer, and otherwise falls back to the subtopic's employer.

## Not in this slice

The chief's/owner's frontend (FE15), notifications to the replaced and incoming people, 4/4 completion and the chief's decision (T27–T29), the assigned reviewer queue/dossier (T23), and replacing the investment person. No automatic expiry or reassignment exists; a replacement is always an explicit command.
