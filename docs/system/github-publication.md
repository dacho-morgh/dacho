# GitHub planning publication record

Verified 2026-10-23 in the authenticated GitHub web interface for the private repository. This records planning publication, not implementation or test execution.

Project: [Event and exhibition delivery board](https://github.com/orgs/dacho-morgh/projects/1/views/1?layout=board).

| Issue family | Count | Published issue numbers | Source of detailed mapping |
| --- | --- | --- | --- |
| Original system tasks | 55 | #15–#69 | [Original issue index](../github-task-index.md) |
| Frontend work packages | 32 | #70–#101 | [Frontend plan](frontend-plan.md), `frontend-issue-map.json` |
| Human acceptance gates | 42 | #102–#143 | [Manual test catalogue](manual-acceptance-tests.md), `manual-test-issue-map.json` |
| Total project items | 129 | All open / Todo at publication | Project board visibly showed Todo (129) |

Issue numbers follow creation order, not stable task-ID order. Use the maps, not arithmetic, to resolve FE IDs. New frontend issue bodies contain actual original/backend issue links, actual earlier frontend issue links, Figma references, source entry points and acceptance criteria. Human-test bodies contain actual original/backend and frontend prerequisite links, actors, fixtures, action/expected-result steps and an execution/evidence template.

## Labels

- `frontend`: 76 issues: 32 new work packages plus 44 original issues with browser or cross-layer test scope.
- `backend`: 52 original service/CMS/data/integration/readiness issues. The three original frontend-only tasks T39, T40 and T53 are excluded.
- `manual-test`: 42 separate human execution gates.

Shared original engineering issues can have both labels; label counts therefore overlap. The original task titles and bodies were preserved. GitHub issue mentions provide reciprocal timeline references; these are ordinary issue links, not native blocking/dependency relationships or a claim that linked work is complete.

## Verification limits

The board count and label-filtered project searches were inspected, and the login human-test issue #102 was read back to verify its backend/frontend links, four expected-result steps, Not run execution record, label and Todo project membership. Every creation returned its own issue URL before the local maps were saved. A stale bulk-label interface was recovered and final label counts were checked after the updates completed.

All human gates remain **Not run**. No source implementation, production deployment, migration, financial action or human acceptance execution occurred. Documentation files are saved in the local checkout; this record does not claim a Git commit/push or pull request was created.
