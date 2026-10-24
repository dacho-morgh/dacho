# Safe tracking allocation and atomic submit — T07

Date: 2026-10-24. Issue: [#21](https://github.com/dacho-morgh/dacho/issues/21). Branch: `codex/t07-atomic-request-submit`, base `staging`.

## Delivered behavior

Request creation uses the PostgreSQL bigint sequence `dashboard.request_tracking_code_seq` instead of counting request rows. Codes retain the `DCH-<year>-<number>` shape. The numeric suffix increases globally across years; it is not a yearly count and gaps are expected after rolled-back inserts. Sequence values stay strings in JavaScript to preserve bigint precision. Concurrent creators cannot receive the same allocation, and deleting requests does not rewind allocation. The existing unique constraint remains in place.

Backend migration `1780511400005_safe-request-tracking` locks request writes while initializing the sequence above the largest existing canonical numeric suffix across all years. It preserves every existing request/code, including noncanonical legacy codes. An empty database starts at one. Re-running normal migrations does not reset the sequence. Previously deleted historic codes cannot be recovered from current rows; a sanitized real-data rehearsal must account for any external archive before rollout.

Submission uses one conditional `UPDATE` matching request ID, owner and `status = 'draft'`. Exactly one competing caller can stamp the submission time and initial workflow step. A losing/repeated caller receives the existing `409 already_submitted` response and cannot rewrite the winner's fields. Absent or other-owner requests still produce `404 not_found`. Other workflow states stay untouched.

## Migration and rollback boundaries

The backend startup already applies its migrations before serving traffic. For an eventual multi-instance rollout, pause request creation and stop all old backend instances before applying the migration and starting the new version: an old `COUNT+1` allocator must not keep writing alongside the sequence allocator. The migration's table lock only covers initialization, not the remainder of a rolling deployment.

The down migration drops only the new sequence and preserves request rows. It is for isolated rehearsal; it does not make the unsafe old allocator suitable for continued writes. A rollback/reapply can lose the sequence high-water mark for deleted rows. Prefer a forward repair; any real rollback needs a coordinated database backup/restore and write freeze. Keep the sequence state in database backups. No live migration or release is authorized by this implementation.

## Validation and scope

The guarded PostgreSQL integration suite covers twelve concurrent HTTP creates, deletion without code reuse, a deterministic two-submit race, retry preservation, wrong-owner/missing-record denial and all non-draft states. The race holds a row lock until both HTTP handlers are waiting at their updates, then verifies exactly one success and one conflict plus a fresh persisted read equal to the winner. Migration tests revert/reapply only this migration on disposable synthetic data, covering empty initialization, repeated startup, legacy row preservation, cross-year seeding and suffixes above JavaScript's safe integer range.

Local backend integration passed **7 files / 41 tests** and unit tests passed **9 files / 46 tests**. The **6-test CI isolation contract** passed with the guard unchanged. Shared PR CI remains responsible for lint, workspace typechecks, database-free build, integration and E2E results; the PR records their final status.

This completes the T07 engineering slice only. Company-owned event/subtopic applications and snapshot validation remain T12/T19/T20. Durable workflow history and notification delivery remain T36/T37; this change adds no such side effects. T44 and the human two-session gate [#139](https://github.com/dacho-morgh/dacho/issues/139) remain open for their wider prerequisites and evidence.
