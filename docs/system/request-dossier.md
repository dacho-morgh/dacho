# Shared dossier and role actions (T39 / #53)

`/dashboard/requests/:id` is one server-rendered page for all seven roles. Human acceptance (UAT29) has not been run, and no Figma design exists for the action or round sections. They use the existing dashboard components.

## The rule

The page shows what the API returned for this person. `GET /requests/:id` is the only source of the case, its actions and its history, so a reviewer's response has no owner and a file the role may not read never reaches the browser. The role only chooses which sections exist, and a control exists only for an entry of `allowedActions`. Every command re-checks on the server.

## Sections by role

| Section | Owner, Secretariat | Chief | Reviewer, employer | Investment person | Company |
| --- | --- | --- | --- | --- | --- |
| Summary, stage, revision, answers, proposal revision, team | Yes | Yes | Reviewed revision only | Yes | Yes |
| Proposal files | Yes | Read only | Pinned files, read only | Read only | Yes |
| Financial file slots | Yes | **None** | **None** | Read only; the server lists nothing before the handoff | Yes |
| Round progress and final evaluation totals | Yes | Yes | None | None | None |
| Follow-up and result text | Yes | None | None | None | Published text only |
| History | Yes | Yes | Without actor or reason | Yes | Yes |
| Company profile link | Yes | None | None | None | None |

The server already withholds financial files from the chief and reviewers. The page also omits their slots and the sentence about them, so the screen does not suggest they exist for that reader.

## Actions

| `allowedActions` entry | Who | Control | Command |
| --- | --- | --- | --- |
| `triage` | Responsible chief | Accept, return or reject | `POST /requests/:id/triage` |
| `startReview` | Responsible chief | Three distinct reviewers | `POST /requests/:id/review-round` |
| `decideReview` | Responsible chief | Advance, return or reject | `POST /requests/:id/review-decision` |
| `reopen` | Owner | Reason | `POST /admin/requests/:id/reopen` |
| `assign` | Owner | Case assignment | `/admin/requests/:id/assignments` |
| none (own route) | Investment person, after the handoff | Save a memo version, send it | `/investment/cases/:id/memo`, `/memo/send` |

Return and reject require a reason. Each command sends the case revision. A stale or closed command keeps what was typed, explains what happened and rereads the case.

Allowed actions with no screen yet get a sentence and no button:

| Action | Owner of the screen | Why it is not here |
| --- | --- | --- |
| `submit`, `correct` | FE12, FE13 | Resubmission needs the approved agreement text, which has not been supplied |
| `submitFinancialPackage` | FE19 | The file field cannot record a statement year yet, so a package could never complete |
| `replaceReviewer`, `replaceEmployer` | FE15 | The round response has no names, so the chief could not tell who is being replaced |
| Evaluation form | FE17 | The fixed rubric form does not exist |

## Removed

- `admin-request-evaluation.tsx` posted to `POST /admin/requests/:id/transition`, which does not exist. It is deleted, and a test fails if any frontend source calls that path again.
- `admin-request-detail.tsx` is replaced. It showed all seven financial slots to every internal role, had no history, stage or tracking code, and showed "loading" forever after a failed read.
- The raw event type and raw action keys no longer appear. The old `/evaluation` address still returns to the dossier.

## Assumptions to confirm

- **The chief sees each final evaluation's total as soon as it is final.** `GET /requests/:id/evaluations` already allows it. The full answers stay for FE18.
- **The investment person's files are read only.** The policy gives this role no upload right.

## Verification

- `apps/frontend/tests/int/request-dossier.int.spec.ts` covers the sections per role, financial absence, failed reads, each command and the removed route, against stubbed responses.
- `apps/frontend/tests/int/dashboard-queue-routes.int.spec.ts` checks which API reads each of the seven roles makes.
- `apps/backend/tests/int` remains the evidence that the server enforces these rules. The frontend tests are not evidence of the real integration.
