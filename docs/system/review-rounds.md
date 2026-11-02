# Review rounds and the four assignments (T22 / #38)

Backend slice only. Human acceptance (UAT14) has not been run and the frontend (FE15) is not built.

A triaged event application (`status = in_review`, `review_stage = triaged`) is reviewed by exactly four distinct active people: the **fixed employer** of the case's subtopic and **three ordinary reviewers** chosen by the event's responsible chief. A round binds those four assignments to one request revision and to the proposal revision it reviews. Starting a round never changes the case state or revision, never advances the case and never counts or decides anything; completion and the chief's decision remain T27–T29.

## API

| Route | Who | Behaviour |
| --- | --- | --- |
| `GET /requests/:id/review-round/candidates` | Responsible chief | Active ordinary reviewers (excluding the case's employer) the chief may pick, plus `employerId`. |
| `POST /requests/:id/review-round` | Responsible chief | Body `{ reviewerIds: [3 ids], expectedRevision? }`. Creates the round and four assignments in one transaction (`201`). |
| `GET /requests/:id/review-round` | Owner, Secretariat, the case's chief: all slots. Assigned reviewer/employer: only their own slot. Company and investment: `403`. | `{ round: null }` before a round exists. |

Case responses advertise the chief action `startReview` only to the event's current responsible chief on a triaged case with no round for its current revision. The owner and Secretariat can never start a round; owner-only employer replacement is [T26](review-replacement.md).

## Rules enforced

- The employer slot is read from the subtopic (`event_subtopics.employer_id`) under lock and snapshotted on the round; the chief cannot choose or replace it. A subtopic employer who is missing, inactive or no longer an `employer-reviewer` stops the start (`employer_unavailable`).
- The three ordinary slots need three distinct people with the `reviewer` role who are active and are not the employer (`three_reviewers_required`, `duplicate_people`, `reviewer_not_eligible`).
- Authority, state and revision are re-read under lock (`403`, `invalid_round_state`, `stale_revision`). One round exists per request revision (`round_already_started`, also under a race).
- Four assignments are ordinary `case_assignments` rows with `round_id` and `slot`, so the T25 evaluation guard and scoped queues work unchanged. Database constraints keep one active employer slot per round, one active row per person per round, and slot/role pairing.
- A round for a new revision revokes the previous round's active slot assignments (`superseded_by_new_round`) and keeps them as history; earlier evaluations stay stored but do not count for the new revision.
- Hand-made reviewer/employer grants made through the generic owner assignment commands block a start (`existing_assignments`); round-owned slots cannot be added or revoked through those commands (`managed_by_review_round`).
- Starting a round writes a `review_round_start` history row naming the chief and revision; reviewers' identities are not exposed to other reviewers or to the company.

The assigned people's queue and case file are in [reviewer-queue.md](reviewer-queue.md) (T23).

## Not in this slice

Replacing an unfinished reviewer or the employer (done in [T26](review-replacement.md)), 4/4 completion (done in [T27](review-completion.md)), the chief's advance/reject/correct decision (done in [T28](chief-decision.md)), and notifications to the assigned people.
