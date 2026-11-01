# Four-of-four completion and confidentiality (T27 / #43)

Backend slice only. Human acceptance (UAT19, UAT38) has not been run and the frontend (FE15, FE16, FE18) is not built. It builds on the [review rounds (T22)](review-rounds.md), the [evaluation guard (T25)](evaluation-foundation.md) and [reviewer replacement (T26)](review-replacement.md).

A round is complete when its four **active** slots each hold a final evaluation for the round's request revision. Completion is readiness for the chief's decision and nothing more: it changes neither the case state nor its revision, and it opens no action except the chief's explicit decision, which is [T28](chief-decision.md).

## API

| Route | Who | Behaviour |
| --- | --- | --- |
| `GET /requests/:id/review-round` | Owner, Secretariat, the case's chief | The round now carries `completion`: `{ required: 4, finalized, ready, completedAt }`. |
| `GET /requests/:id/review-round` | Assigned reviewer/employer | Unchanged: own slot only, no `completion`. |
| `GET /requests/:id/evaluations` | Owner, Secretariat, the case's chief | Adds `requiredCount` and `readyForChiefDecision` beside `completedCount`. |
| `GET /requests/:id/evaluation` | Assigned reviewer/employer | Returns only `{ evaluation, revision }`. `completedEvaluationsCount` is **removed**: the frontend never read it, and it told a reviewer how far the other three had got. |

`ready` is true only while `completedAt` is set, the round covers the request's current revision and the case is `in_review`. T28 re-checks it under the request lock when the chief decides.

## Rules enforced

- **1/4 to 3/4 stay incomplete.** `dashboard.review_rounds.completed_at` (migration `1780511400028`) stays null, and no history is written.
- **One completion.** `syncRoundCompletion` runs inside the finalize transaction, after the evaluation is written. It locks the round row and only then counts, so the last finalizer to get the lock sees everyone who committed before it. A second finalize by the same person returns `evaluation_locked` before reaching it.
- **Who counts.** Only final evaluations of the round's revision whose author still holds an active slot with the same role. Drafts, revoked or replaced people and earlier revisions do not count; their rows stay stored.
- **Completion follows the slots.** The owner's exceptional employer replacement can take back a finished slot (T26). The same function runs in that transaction: `completed_at` is cleared and the new employer has to finish. Their finalization is a new completion with its own history row, so a case can have more than one such row, but never two for one reaching of 4/4.
- **Earlier locked evaluations.** Starting a round runs the same function. A person picked for the round may already hold a locked final evaluation of this revision from an earlier hand-made grant, which can never be sent again, so without this the round could wait forever.
- **Old slots cannot write forward.** The evaluation write guard refuses a slot whose round reviews another revision (`409 stale_evaluation`), even if the request has moved on and no new round has started yet. T28's return for correction reaches this state.

## Confidentiality

- A reviewer or employer gets only their own evaluation and own slot. `GET /requests/:id/evaluations` stays `403` for them, and the queue, case file, request detail, history and activity feed name no other member of the panel.
- The `review_round_complete` history row is oversight-only, like the T26 replacement rows: the owner, Secretariat and the case's chief see it; the company and assigned reviewer, employer and investment people do not. It names the fourth finalizer as actor.
- The company and investment people get `403` from the evaluation and round routes. Another chief gets `404`.

## Verification

`tests/int/review-completion.int.spec.ts` runs these rules through HTTP on real Postgres. The race test starts all four finalizations at once and expects one completion: it passed 5 of 5 runs with the round lock and failed 4 of 5 with the lock removed. It depends on timing, so it can miss a regression in a given run.

## Not in this slice

The chief's advance, reject and correct decision, its action and historical rounds in the chief's view ([T28](chief-decision.md)), the screens (FE15, FE16, FE18), and a notification to the chief when a round completes.
