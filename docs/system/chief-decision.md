# Chief decision and correction rounds (T28 / #44)

Backend slice only. Human acceptance (UAT20) has not been run and the frontend (FE13, FE14, FE18) is not built. It builds on [chief triage (T21)](../event-review-system-plan.md), the [review rounds (T22)](review-rounds.md) and [four-of-four completion (T27)](review-completion.md).

A complete round moves nothing by itself. The event's responsible chief explicitly advances the case, returns the proposal for correction or rejects it. The decision is recorded on the round it decided.

## API

| Route | Who | Behaviour |
| --- | --- | --- |
| `POST /requests/:id/review-decision` | Responsible chief | Body `{ action, reason?, expectedRevision? }`. `action` is `advance`, `return` or `reject`; the last two need a `reason` (`reason_required`). Returns the request. |
| `GET /requests/:id/review-rounds` | Owner, Secretariat, the case's chief | Every round, newest first, each with `completion`, `decision`, `supersededAt`, slots and replacements. Reviewers, employers, investment people and the company get `403`; another chief gets `404`. |
| `GET /requests/:id/evaluations?revision=N` | Owner, Secretariat, the case's chief | The evaluations of that revision, so a past round stays readable. Without `revision` it is the current revision, which is empty until a new round has final evaluations. |
| `GET /requests/:id/review-round` | Same oversight roles | The round gains `decision: { action, decidedBy, decidedAt, reason } \| null`. Assigned reviewers and employers do not get it. |

Case responses advertise `decideReview` only to the responsible chief on a round whose four evaluations are final. `replaceReviewer` is no longer advertised on such a round, since every slot in it is final.

## Outcomes

Every decision raises the revision and commits the state, the round's decision, a history row and one notification to the company together.

| Action | Request | History | What follows |
| --- | --- | --- | --- |
| `advance` | `in_review`, stage `advanced` | `chief_review_advance` | The financial stage (T29) opens from here. This slice opens nothing else; the chief has no further action. |
| `return` | `action_needed`, stage `chief_triage` | `chief_review_return` with reason | The company corrects the proposal and resubmits on the same application and tracking code, with a new proposal revision. It goes through triage again ([workflows](workflows.md), `J --> D`), then the chief starts a new round. |
| `reject` | `rejected`, stage `chief_triage` | `chief_review_reject` with reason | Terminal for this company, event and subtopic. The owner's reopen goes back through triage to a new round. |

A return or rejection deliberately reuses the triage states, so correction, resubmission, document rules and reopen behave exactly as they do at triage.

## Rules enforced

- **Explicit and ready.** `round_not_ready` (`409`) unless the current revision's round has `completed_at` and still counts four finals. Both are re-read under the request lock, which finalizations and the owner's employer replacement also take, so readiness cannot change before the decision commits. An employer replacement that took completion back refuses the decision until the new employer finishes.
- **One decision.** A racing or repeated decision finds the case moved (`invalid_decision_state`) or a newer revision (`stale_revision`). The race test sends three at once and expects one success, one history row and one notification.
- **Old scores stay and do not count.** Evaluations belong to their revision, so a new round starts at 0/4 and the earlier round keeps its own four, readable through `?revision=`. The same people can be picked again and start with no evaluation.
- **A past round keeps its count.** `countRoundFinals` counts active slots and slots ended by `superseded_by_new_round`, so a superseded round still reports the 4/4 it was decided on. Replaced people never count.
- **Old slots cannot write.** After a decision the round no longer covers the current revision, so the write guard answers `409 stale_evaluation`, including for a body naming the newer revision. Once a new round supersedes the slot, the person gets `403`.
- **Assignments end with the next round, not the decision.** As in [T23](reviewer-queue.md), a decided case stays closed work in the queue. The reviewer keeps reading what they reviewed, and `GET /requests/:id/evaluation` returns their own evaluation of that round, never a corrected proposal in progress.
- **Nothing writes into an advanced case.** The write guard also refuses a hand-made grant once the stage is `advanced`, and the queue does not show it as actionable.
- **Database checks.** `review_rounds_decision_consistent` requires all decision fields together, a complete round and a reason for `return` and `reject`. The activity reason check now covers `chief_review_return` and `chief_review_reject`.

## Confidentiality

The company sees the decision and the reason for a return or rejection in its history, not who reviewed or when 4/4 happened. Reviewers and employers see a decision entry without actor or reason. No score is aggregated for the decision: the chief reads the four evaluations separately.

## Verification

`tests/int/chief-decision.int.spec.ts` runs these rules through HTTP on real Postgres, and `tests/access-policy.spec.ts` covers the advertised action. The race test depends on timing, so it can miss a regression in a given run.

## Not in this slice

The financial package invitation and its required categories (T29), any gate on financial uploads by stage (T30), the screens (FE13, FE14, FE18), and a notification to the chief when a round completes or to the people of a closed round.
