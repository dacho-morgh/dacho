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

## Request page data for the Figma frames (#288)

`GET /requests/:id` and `GET /admin/requests/:id` (internal roles) return the same body, built in `apps/backend/src/dashboard/request-detail.ts`. `request`, `owner` and the `timeline` rows keep their earlier projection; the rest is new. Owner, Secretariat, the event's chief and the investment person holding the case are the **supervisory** roles below.

```ts
{
  request, owner,                       // unchanged
  timeline: (ActivityDto & { actorName: string | null; actorRole: OperationalRole | null })[],
  workflow: { key, title, role, roleName, order, state }[],
  event: { id, title, category: { id, title } | null, subtopic: { id, title } | null,
           image: { url, alt } | null, startDate, endDate, location, status } | null,
  company: { id, name, type, province, city, status, active, foundingYear, ageYears,
             logo: { url } | null, source: 'profile' | 'submission' } | null,
  companyProfile: { company, activityDomain, province, city, executives, addresses, dossier } | null,
}
```

| Field | Supervisory roles | Reviewer, employer | Company |
| --- | --- | --- | --- |
| `owner` | `{ id, name }` of the submitting representative (unchanged) | `null` (unchanged) | `{ id, name }` (unchanged) |
| `event` | Event, category, subtopic; poster, dates, place and status from the public CMS page | Same (public, and already in their queue) | Same |
| `company` | Live company record: name (the company's own, not the representative's), type, province, city, `status` («وضعیت شرکت» text), `active` (representative account not deactivated), `foundingYear` (dossier year, else establishment date), `ageYears`, `logo.url` when a logo is set; `source: 'profile'` | Only `name`, `type`, `province`, `city` from the profile pinned at submission (the necessary profile they already read); `id`, `status`, `active`, `foundingYear`, `ageYears` and `logo` are `null`; `source: 'submission'` | Its own live card; `logo` is `null` because the logo collection belongs to the Secretariat and owner |
| `companyProfile` | `null` | `null` | Its own live profile and resume: basic info, executives, addresses and the stage-2 dossier (products, key members, past projects, certificates…) |
| `timeline[].actorName` / `actorRole` | Name and operational role of whoever took each step | Not present; rows still carry no `actorId` (unchanged) | Name and `actorId` only for steps its own account took; Fund staff steps carry `actorRole` with `actorName: null` and no `actorId`, so no chief or reviewer is identified. The same `actorId` rule applies to `GET /requests/:id/history` and `GET /activities` (before #288 the company received staff account ids there) |
| `workflow` | Event applications: the fixed stages below with `state`. Other services: the CMS workflow if one exists, else `[]` | Same | Same |

`ageYears` compares a Persian founding year (1200–1450) with the current Persian year and a Gregorian one with the current Gregorian year. The logo is served by `GET /requests/:id/company/logo` (`image/png|jpeg|webp`, `private, no-store`, `nosniff`) to supervisory roles that can read the case; reviewers, employers and the company get `403`, and a supervisory role outside the case gets the same `404` as an unknown id. Accounts carry no picture, so the frontend draws initials for people.

The CMS no longer stores service workflows, so an event application's stages come from the backend. Step `state` is `done`, `current`, `upcoming` or `rejected`:

| Recorded state | Current step |
| --- | --- |
| `draft`, `action_needed` | `submission` («ثبت و ارسال درخواست») |
| `in_review` + `chief_triage` | `chief_triage` («بررسی اولیه سردبیر») |
| `in_review` + `triaged` | `review` («داوری و تصمیم سردبیر») |
| `in_review` + `advanced` | `investment` («بررسی سرمایه‌گذاری») |
| published result | `result` («اعلام نتیجه») |
| `rejected` | `chief_triage` or `review` (by the last reject action), state `rejected` |
| `approved` | every step `done` |

The step keys never name the financial package, which the chief and reviewers may not see.

The round's reviewer list (`GET /requests/:id/review-round`, `GET /requests/:id/review-rounds`) adds to each slot `name`, `avatarUrl` (always `null`), `viewedAt` and `status`: `not_viewed` («مشاهده نشده») until the holder first opens the case (`GET /review/cases/:id` or `GET /requests/:id`, recorded in `case_assignments.viewed_at`, migration `1780511400041`), `in_review` («درحال بررسی») once opened or with a draft, `final` («نهایی») once their evaluation of the round's revision is final. Oversight still sees all four slots and a reviewer or employer only their own; the company and the investment person still get `403`. Only the state is exposed, never draft answers.

`apps/backend/tests/int/request-detail.int.spec.ts` proves each row of the table above per role, including that reviewers and the employer still receive no owner, representative, account id or staff name.

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
| `submit` | FE12 | Final submission lives on the event application workspace; acceptance uses the unapproved placeholder agreement versions until approved text is supplied |
| `submitFinancialPackage` | FE19 | The file field cannot record a statement year yet, so a package could never complete |
| `replaceReviewer`, `replaceEmployer` | FE15 | The round response had no names; since #288 each slot carries `name` and `status`, so this screen can now be built |
| Evaluation form | FE17 | The fixed rubric form does not exist |

The company's `correct` action is built (FE13): the company's case page shows a tracking section (stage, next action, submitted proposal revision, the chief's return or rejection reason, an owner's reopen and the published result) and, while the server lists `correct`, a correction form that patches the same case and calls `POST /requests/:id/resubmit`. That form owns the proposal upload while correcting. Acceptance is recorded with the server's current agreement versions, which remain unapproved placeholders until the approved text is supplied.

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
