# Evaluation persistence (T25 / #41)

The evaluation API supports reviewer-owned drafts and immutable final evaluations
using the fixed T24 rubric. Review-round creation and the four distinct review
slots are covered by [review rounds (T22)](review-rounds.md) and reviewer/employer
replacement by [review replacement (T26)](review-replacement.md). It does not
implement the chief's advancement decision. Those
workflow dependencies remain separate; a numeric completion count never advances
a request automatically. Human acceptance has not been run.

`GET /requests/:id/evaluation` requires a current assignment matching the actor's
reviewer or employer-reviewer role. It returns only that person's evaluation and
the current request `revision`. Progress across the panel is oversight-only; see
[four-of-four completion (T27)](review-completion.md).

`PUT /requests/:id/evaluation` and
`POST /requests/:id/evaluation/finalize` require that returned `revision` in the
request body. Missing/invalid revisions return `400 invalid_revision`; stale
revisions or a request outside `in_review` return `409 stale_evaluation`.
Finalization validates the complete appropriate rubric, including qualitative
and employer-risk answers. Locked evaluations return `409 evaluation_locked`.
Postgres locks the current request revision/state and matching assignment inside
the write transaction so concurrent revision changes or revocation cannot turn
an authorized snapshot into an unauthorized write.

`GET /requests/:id/evaluations` permits owner/Secretariat oversight and chiefs
assigned to that request. Unfinished answers and scores remain author-only;
oversight receives draft metadata. Final evaluations remain attributable to
their authors. Revoked assignments and older request revisions do not contribute
to current completion. Historical evaluations remain stored when excluded from
that count.

The current persistence key is `(request_id, user_id, revision)`. The dedicated
review-round workflow must bind its proposal revision and active slots to this
boundary before claiming complete event-review readiness. This slice uses the
existing case-assignment authority and never infers event-wide case access from
an unscoped chief role.

Unit HTTP and repository regressions cover scope, draft projection, expected
revision, revocation, required forms and locking. Guarded Postgres regressions
cover persistence, competing finalizations, immutable answers, stale contexts
and concurrent assignment revocation. Local Docker was unavailable during this
review; execution of those database regressions is delegated to required CI.
