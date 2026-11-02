# Slice plan

Accepted 2026-11-02. Replaces one-issue-at-a-time delivery with vertical slices, owned by two parallel agents. Milestones `S1`–`S8`, slice issues and the Project board follow this document. Every new issue from this plan carries the label **`slice-plan`**, so `label:slice-plan` filters it apart from the older FE/T/UAT backlog.

**Design check.** Every slice that changes a screen runs the `design-check-figma` skill before its PR is marked ready. See [docs/agents/design-check-figma.md](agents/design-check-figma.md) for installing it in Claude Code and other agents.

Inputs: open issues and PRs, `staging` history, `docs/system/frontend-plan.md`, and the Figma file [Dashboard](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard).

## 0. Starting point

**`origin/staging` @ `dde27be` (FE08, #236).** FE05, FE10, FE11 and FE22 are already squash-merged (#184–#187). Their leftover `codex/*` branches are older than `staging`, so they are not unmerged work. Delete them so nobody branches off them by mistake.

These issues are done in `staging` but still open: FE03 #80, FE05 #84, FE06 #85, FE07 #71, FE10 #83, FE11 #74, FE12 #86, FE13 #88, FE14 #90, FE15 #92, FE16 #94, FE17 #96, FE18 #97, FE22 #75, T24 #40. Close them with a link to their PR. Gaps found against the design go into the slice that owns the screen; the old issues don't get reopened.

Only one PR is open: #183 (T50, exhibition backend). It goes to Agent R.

## 1. Two agents, claimed by slice

| | **Agent L — local (this machine)** | **Agent R — remote (codex)** |
| --- | --- | --- |
| Focus | Figma-driven frontend, plus the backend it directly needs | Backend-heavy domains, plus their own screens |
| Owns, in order | S1 Inbox → S2 UI foundation (frontend freeze) → S4 Account & company | S7 Exhibition basics (backend first) → S3 Role dashboards (gaps after #247) → S6 Financial → investment → result → S5 Owner event/exhibition admin |
| Frontend dirs | `dashboard/letters/**`, `dashboard/inbox/**`, `dashboard/profile/**`, `dashboard/companies/**`, `components/ui/**`, `components/dashboard/{*letter*,inbox-*,mail-*,support-*,app-sidebar,account-*,company-*,staff-profile-*}` | `dashboard/exhibitions/**`, `dashboard/events/**`, `dashboard/follow-ups/**`, `dashboard/requests/[id]/**` (financial/investment parts), `components/dashboard/{exhibition-*,booth-*,owner-events*,events-view,financial-*,investment-*,secretariat-follow-up-*,stat-cards,recent-*}`, `components/dashboard/owner-overview/**`, `dashboard/page.tsx` |
| Backend dirs | `dashboard/letter-*`, `dashboard/notification-outbox.ts`, the profile/company parts of `dashboard/*`, `access/*` (company re-verification) | `exhibitions/**`, `reviews/**` (investment), `dashboard/secretariat-follow-up-repo.ts`, `dashboard/stats-repo.ts`, `dashboard/routes/stats.ts`, `catalog/**` |

Why this split has the fewest conflicts:

- **S2 (buttons, forms, toasts, layout) touches about 20 shared frontend files.** It runs while Agent R works on S7's backend (PR #183 and receipt confirmation), which touches no frontend files. Agent R only starts exhibition screens (FE25–FE28) after S2 merges, so it builds on the new components and never has to rework them.
- **T61 ("notify the next role") crosses every domain.** Agent L builds it as **one function**, `notifyNextRole(caseRef, stage, recipients)`, in `notification-outbox.ts`, and wires the event-review path. Agent R calls the same function from exhibition and investment code. The contract lands in S1's first PR, so Agent R only depends on its signature.

### Hot files: split before the split

| File | Size, touches in the last 5 days | Fix |
| --- | --- | --- |
| `apps/backend/src/dashboard/router.ts` | 3,948 lines, 35 commits | Split into per-domain routers (`letters`, `requests`, `reviews`, `profile`, `follow-ups`…) mounted from `router.ts`. Mechanical change, no behaviour change. |
| `apps/frontend/src/utilities/dashboard-api.ts` | 1,240 lines, 17 commits | Split into `dashboard-api/<domain>.ts` with an `index.ts` barrel, so existing imports keep working. |
| `apps/backend/migrations/1780511400NNN_*` | Sequential numbers | Number the migration when rebasing just before merge, not when creating it. `tests/int/migrations.int.spec.ts` catches duplicates. |
| `docs/system/README.md`, `migration-inventory.md` | Edited by every PR | Each slice appends a single line, at merge time only. |
| `packages/cms-core/src/payload-types.ts` | Generated | Regenerate after rebasing, never hand-merge it. |

**These two file splits are the work for the 30-minute exclusive window.** They are pure moves, and the existing test suites prove nothing changed.

### Claiming protocol

1. The GitHub Project has a **Slice** field and an **Agent** field (`L` / `R`). An agent may start a slice only once its card shows that agent's letter.
2. The first commit on `slice/<name>` opens a **draft PR**. Its description lists the claimed directories, copied from the table above.
3. Before touching a file outside its claim, an agent checks open draft PRs. If another slice owns the file, it posts a comment on that PR and waits, or asks the human.
4. Rebase on `staging` daily and before marking the PR ready. Squash-merge only, which is the current practice.
5. A bug goes to the slice that owns the screen: label `bug` + `slice:<name>`, fixed on that slice's branch. Bugs in screens no open slice owns go on `fix/sweep-<date>`, which Agent L holds by default.

## 2. Slice S1 — Inbox (کارتابل) — detailed

**Milestone:** S1 · Inbox. **Agent:** L. **Branch:** `slice/inbox` from `staging@dde27be`.

### Design (Figma)

| Node | What it specifies |
| --- | --- |
| `30851:15785` Letters list | Toolbar: received/sent tabs (نامه‌های دریافتی / ارسالی), search, filter button, **New letter**. Columns: type badge, subject, sender (avatar, name, role), date, row ⋮ menu. States: default (applicant and internal variants), loading skeleton, empty, open row menu. |
| `56:13200` Letter detail | Breadcrumb, sender card, date and time, body, attachment download, ⋮ menu. States: default, loading, **with history** (earlier messages in the thread collapsed above the current one). |
| `53:12475` Letters section | The same list states, plus the **compose to support** screen. |
| `31650:41` Workflow letters | Case-linked items: title, status (جدید / نیازمند اقدام / خوانده شده), sender, **action** (مشاهده / تکمیل فرم / اصلاح) that opens the related request. Note: "Every message is linked to its request". |

### Current state on `staging`

- `/dashboard/letters` merges formal letters, CMS form submissions and support tickets into one client-side list (`limit=100`), filtered on the client. There are two separate views, `AdminLettersView` and `ApplicantLettersView`, built on `InboxListView`.
- `/dashboard/inbox` only redirects to `/dashboard/letters`.
- Missing compared to the design: received/sent tabs, a thread view with history, unread/read state with mark-read, a row ⋮ menu (mark read, hide), and case-linked **action items**. Server-side search and pagination are also missing.
- Backend: `letter-repo`, `letter-policy` (recipients, attachments, mailbox hide idempotency, migration 035) and `notification-outbox` exist. The outbox only serves `request-repo` and `secretariat-follow-up-repo`, and mostly notifies the request owner. Review stages send no notifications.

### Scope (absorbs)

FE22 #75 (finish to design), FE23 #76 (actionable notifications and history), T61 #223 (event-review path; exhibition and investment wiring goes to Agent R), FE35 #226 (letters and support lists only). Human gates: UAT27 #128, UAT28 #129.

### Deliverables, in PR-sized steps on one branch

1. **Contract.** Backend: a `notifyNextRole()` outbox API, plus an inbox item DTO `{id, kind: letter|action|support, title, status: new|action_required|read, sender, caseRef?, action?: {label, href}, createdAt}`. Add `GET /inbox` with `box=received|sent`, `q`, `status`, `kind`, cursor pagination. Add `POST /inbox/:id/read` and `POST /inbox/:id/hide`. Write the contract tests first.
2. **Event-review wiring.** Every transition already in `transition-history` (submission, chief triage, return, assignment, evaluation finalized, 4/4 complete, chief decision, financial invitation, publication) produces an inbox item for the next role, idempotently per transition.
3. **List screen.** Rebuild `/dashboard/inbox` as the real کارتابل (the sidebar entry points here) and turn `/dashboard/letters` into a redirect. Tabs, search, filter button, the four list states, unread styling, the ⋮ menu and the action column all follow the design. Use one view for every role; the role only changes the data and the compose permission.
4. **Detail and thread.** The detail page shows history, attachments through FE07's private download component, a reply that keeps case scope, and mark-read on open.
5. **Compose.** New letter (authorized recipients only) and compose to support. Keep submit-once and retry protection.
6. **SMS/email hook.** Behind `notifyNextRole`, an adapter for the console and Kavenegar providers. Email waits until a provider exists, so log it and leave a TODO linked to T61.
7. **Tests.** Integration tests per role (who sees which item, the action link respects access), plus one Playwright happy path: company submits → chief sees action → chief acts → company sees result item.

### Out of scope

Global button and form refactors (S2), dashboard cards (S3), notification wiring for exhibition and investment (Agent R calls `notifyNextRole`).

### Definition of done

The `design-check-figma` report is posted on the PR with no open high-severity findings. All four Figma frames match at both desktop and mobile widths. Every event-review transition produces exactly one item for the right role. Action links open the case and are re-checked server-side. UAT27 and UAT28 can be run by a human.

## 3. The other slices (summary)

| Slice | Agent | Absorbs | Figma |
| --- | --- | --- | --- |
| S2 UI foundation | L (frontend freeze) | FE42 #233, FE43 #234, FE44 #235, FE29 #78, FE36 #227, FE39 #230, FE35 #226 (rest) | Style page `2:26` |
| S3 Role dashboards | R | FE33 #224, T56 #218 (most delivered in #247) | Shell frames per role |
| S4 Account & company | L | FE37 #228 + T58 #220, FE38 #229 + T59 #221, FE34 #225 + T57 #219, design gaps in FE05 | 16, 22–24 (Missing Screens) |
| S5 Owner event/exhibition admin | R | FE40 #231, FE41 #232, T60 #222, design gaps in FE10/FE11 | Admin page |
| S6 Financial → investment → result | R | FE19 #98, FE20 #99, FE21 #100, FE31 #101 | 03, 04, 13, 14, 15, 19, 20, 25 |
| S7 Exhibition basics | R | T48 #62, T50 #65 / PR #183, T51 #66 (basic), FE25 #87, FE26 #89, FE27 #91 (basic) | Exhibition frames |
| S8 Release & hardening | whoever is free | FE30 #79, T45 #59, T46 #60, T02 #16, T03 #17, T04 #18 | — |

UAT issues stay as separate human gates and are linked to their slice's milestone.

### S7 — Exhibition basics only

Already merged: booth catalogue (T47), owner booth admin (FE24), reservations backend (T48 migration 018), attendance approval backend (T55), booth cost (T49).

In scope:
1. **Company:** list open exhibitions, see booths with price and availability, request one booth, which creates the reservation, and see the request's status (FE25, basic).
2. **Secretariat:** a queue of booth requests with approve/reject attendance (FE26).
3. **Receipt:** merge PR #183 after renumbering its migration (`…025` collides with `staging`, which is at `…035`). The company uploads one receipt after approval; Secretariat confirms or rejects it (T51/FE27, basic).

Deferred, still open, out of the milestone: T52 #67 and FE28 #93 (cancellation, release, refund), receipt correction versions, T53 #68 (extra panels), T54 #69 and FE32 #95 (full E2E), UAT36–UAT38.

## 4. On GitHub

- Milestones `S1 · Inbox` … `S8 · Release`.
- One **slice issue** per milestone, labelled `slice-plan` + `slice:<name>` + `agent:L|R`, with the absorbed issues as a task list. The absorbed issues close as *superseded*. Deferred S7 issues stay open, with no milestone.
- Done-but-open issues are closed with a link to their PR.
- Org Project **dacho delivery** holds the slice issues, with Agent and Slice fields.
- The stale `codex/*` branches are kept until the remote agent's owner confirms they can go.
