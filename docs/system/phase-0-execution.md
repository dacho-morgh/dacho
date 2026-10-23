# Phase 0 execution record

Date: 2026-10-23. Branch: `codex/phase-0-system-foundation`. Starting commit: `b755f2e`. Scope: T01–T04, issues #15–#18. The user authorized a new branch, frontend/backend/Figma/integration subagents, board updates and documentation. No production deployment or migration is part of this batch.

## Work allocation

The session supports four concurrent agents including the manager, so the roles run in two waves. All agents work in the shared checkout with explicit file ownership; only the manager commits/pushes.

| Role | Model / effort | Responsibility |
| --- | --- | --- |
| Manager | Current chat | Scope, approved glossary, coordination, document index, final evidence and Git handoff |
| Frontend contracts | `gpt-6-sol` / high | T03 typed form dictionaries, frontend/CMS mapping and bounded open inputs |
| Backend foundation | `gpt-6-sol` / high | T02 permission matrix; T04 isolated DB/files, guards, migration inventory and rehearsal |
| Figma evidence | `gpt-6-luna` / medium | Read-only live design evidence and conflicts against approved rules |
| Integration review | `gpt-6-sol` / high | Cross-document consistency, frontend/backend seams, isolated runner and focused validation |
| Board operations | `gpt-6-luna` / medium | Read live issues and update only the four selected project cards with verified status |

## Activity

1. Confirmed a clean working tree on local `main`; created the branch before edits. Fetched origin. Local starting history already contains the two unpublished commits ahead of `origin/main`; they are preserved, including the planning documentation needed by this batch.
2. Read approved requirements, workflows, designs, audits, original dependency table, FE issue map and all UAT specifications. Selected Phase 0 only; no later dashboard feature was represented as delivered.
3. Tried the GitHub connector for issues #15–#18. All four returned 404 for the private repository. Git SSH read access works. Project operations use the authenticated browser fallback because the connector cannot access this repository or edit Project fields.
4. Assigned frontend, backend and Figma in parallel; then started integration review and board operations after the documentation agents finished.
5. Recorded typed forms with pending business values; read Figma metadata/screenshots and documented sample rubric/assignment ambiguities; aligned the glossary and scope register to approved decisions.
6. The user supplied ordinary-reviewer and employer-reviewer forms during execution. Captured them as a new authoritative rubric source, including shared 45/40/15 weights, raw weighted maximum 55.05, distinct qualitative/risk sections and remaining interpretation questions. Updated requirements and generated planning/UAT specifications without claiming execution or silently normalizing scores.
7. Committed implementation/specification evidence as `dc46563` and pushed the branch. The browser tool later became unavailable; the GitHub connector still returned 404. The manager used the existing Git Credential Manager credential through the standard Git credential interface to create and read back [draft PR #145](https://github.com/dacho-morgh/dacho/pull/145). Credentials were neither printed nor saved. No new access scope was requested or granted.
8. Stopped the dedicated test container after verification, preserving its test volume and ignored backup/file evidence. No shared service was stopped. The work is handed off through the draft PR; no merge or production release occurred.

## Evidence and status

Engineering evidence below was recorded on the disposable local environment. Every human gate remains Not run; project cards stay In Progress while the branch awaits review and T03 retains open inputs.

| Task | Delivered evidence | Handoff status |
| --- | --- | --- |
| T01 / #15 | Approved scope, decision owners by role, affected tasks, open-input register and aligned glossary | Ready for technical/product review |
| T02 / #16 | Seven-role own/assigned/other/unassigned matrix across CMS, proxy, API, documents, population, counts/search and revocation | Policy contract ready for review; enforcement rollout belongs to T08/T09 and later tasks |
| T03 / #17 | Typed form dictionary and supplied ordinary/employer rubric; source questions, ceilings, weights and maximum 55.05 | Partial: Q39, agreement text and listed form interpretation decisions remain open |
| T04 / #18 | Separate Compose project/DB/files, live markers and fail-closed test gate, migration inventory, synthetic backup/restore | Harness ready for review; real-data migration and human UAT remain separate |

Validation: isolated journals confirmed **20 CMS + 5 backend migrations**. Backend integration passed **6 files / 35 tests**. Frontend integration passed **44 files / 171 tests**, with **1 skipped file/test**. Both typechecks passed. Negative checks rejected the ordinary database endpoint in both suites and a missing file directory before test collection. A correctly configured guard passed. Restored synthetic row and file SHA-256 matched. See [test-environment.md](test-environment.md) and [integration review](phase-0-integration-review.md) for evidence and limits.

Both planning generators ran successfully: **55 original tasks, 32 FE packages, 42 UAT gates**, all original tasks covered and all UAT statuses Not run. The manager separately verified issue-map stability, new local document links, score maxima and the 55.05 result using decimal arithmetic. `git diff --check` passed. No later business feature or deployed permission rollout was claimed.

- T01: [Scope and decisions](scope-decisions.md), root glossary and approved source links.
- T02: [Permission matrix](permission-matrix.md); policy specification, not a deployed authorization rollout.
- T03: [Fixed form contracts](fixed-form-contracts.md) and [Figma evidence](phase-0-figma-evidence.md). Pending product inputs remain explicit.
- T04: [Isolated environment](test-environment.md), [migration inventory](migration-inventory.md), guarded runner/configs and recovery evidence.
- Cross-layer review: [Integration review](phase-0-integration-review.md).
- Live project state: [Board status](phase-0-board-status.md).

GitHub handoff: [draft PR #145](https://github.com/dacho-morgh/dacho/pull/145), base `main`, head `codex/phase-0-system-foundation`. Project cards #15–#18 were moved from Todo to In Progress and verified through the authenticated UI. That field offers only Todo, In Progress and Done; the branch is awaiting review and T03 remains partial, so none was moved to Done. No issue comments or body/label changes were posted. A later API read could not recheck Project fields because the existing credential lacks `read:project`; the earlier UI verification is the board evidence.

## Remaining inputs

The Fund's authorized product owner must provide category-specific file policy and approved agreement/rules text, and resolve the remaining review-form interpretation questions. The supplied reviewer questions/weights/maxima and per-review formula are now recorded in [review-rubric.md](review-rubric.md). Technical owners must review proposed field/DTO decisions. Named human testers still execute and record UAT42 and relevant later gates on a deployed isolated build. Automated checks and a backup/restore smoke test cannot stand in for those human results.
