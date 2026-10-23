# Phase 0 project board status

Verified in the authenticated GitHub UI on 2026-10-23 for [Event and exhibition delivery board](https://github.com/orgs/dacho-morgh/projects/1/views/1?layout=board), repository `dacho-morgh/dacho`.

## Status changes

The acceptance descriptions in this initial table predate the user's later reviewer-form and upload-policy decisions. For the current contract, see the follow-up sections and [fixed forms](fixed-form-contracts.md).

| Task | Issue | Previous project status | Current project status | Issue state | Acceptance snapshot |
| --- | --- | --- | --- | --- | --- |
| T01 — ثبت تصمیم‌های باز و محدودهٔ دو مسیر | [#15](https://github.com/dacho-morgh/dacho/issues/15) | Todo | In Progress | Open | Six acceptance items remain unchecked. Scope includes event and exhibition flows, seven roles, four-reviewer assignment and editor gate, investment notes, booth/payment rules, and unresolved Q39/formula/agreement inputs. |
| T02 — ماتریس هفت نقش × عملیات × محدوده | [#16](https://github.com/dacho-morgh/dacho/issues/16) | Todo | In Progress | Open | Both acceptance items remain unchecked: define visibility and permission outcomes for own/other/unassigned cases, and apply controls across CMS, proxy, API, files, and statistics. Depends on T01. |
| T03 — مشخصات فرم‌های ثابت و مدارک | [#17](https://github.com/dacho-morgh/dacho/issues/17) | Todo | In Progress | Open | Five acceptance items remain unchecked. Field type/requiredness/conditions/scope, explicit “none” choices, and version retention are in scope; final review questions/formula, Q39 file policy, and contract text remain missing inputs. No form builder is requested. Depends on T01. |
| T04 — محیط تست جدا و موجودی مهاجرت | [#18](https://github.com/dacho-morgh/dacho/issues/18) | Todo | In Progress | Open | Four acceptance items remain unchecked: isolate test database/files from real data, identify previous migrations/data, prepare recovery, and keep destructive fixtures confined to test. No issue dependency listed. |

## Verification and limits

- Each issue page showed the Project `Status` field change to `In Progress` after the update; the board then showed T01–T04 in the In Progress column (4 items), Todo at 125, and Done at 0.
- Issue states remain Open. Existing labels and issue bodies were observed before and after status edits and were not changed. The update changed only each card’s project status.
- No other project cards were moved. Human acceptance/UAT gates, including the linked UAT42 issue #143, were left unchanged and remain separate execution gates. This status update does not record UAT execution or acceptance.
- At the initial verification, T03 lacked the final rubric/questions, Q39 policy, and agreement text, as recorded in issue #17. Those are historical inputs, subsequently narrowed by the user decisions below. T04's initial status indicated active work rather than completed acceptance.
- GitHub’s private issue/project connector returned 404, so the authenticated browser UI was used. The local publication record remains [github-publication.md](github-publication.md). This file records observed planning state and does not claim a commit or push.

## Screenshot

The final board view was captured in the browser after verification. The browser-use screenshot was rendered in the task transcript; a standalone local PNG could not be saved from the available browser screenshot API.

## Follow-up — 2026-10-23

After the initial issue read, the user supplied the ordinary/employer forms and the core review questions, ceilings, weights, and formula. The supplied maximum is **55.05**. Therefore, the initial table above is a historical snapshot of the inputs visible at the time, not a statement that the review rubric remains wholly unspecified.

At this intermediate point, Q39/file policy, agreement text, and interpretation remained open. The later clarification below supersedes that intermediate input state. T03 remains In Progress pending the still-missing approved consent text and review of the updated specification.

The exact T02 acceptance items read from issue #16 are:

- «نتیجه مجوز و فیلدهای قابل مشاهده برای پرونده خود، دیگران و بدون انتساب مشخص باشد»
- «کنترل در CMS مستقیم، proxy، API، فایل و آمار اعمال شود»

These acceptance items require defining the permission and visible-field outcomes for own, others’, and unassigned records, then applying those controls across direct CMS access, proxy, API, files, and statistics. They do not state that T02 implements the seven-role controls itself: the issue’s context defines the seven-role model, while implementation work is split into later tasks such as T08/T09.

## Git handoff and final update limits

The branch was committed (`dc46563`) and pushed, and [draft PR #145](https://github.com/dacho-morgh/dacho/pull/145) was created and read back with base `main` and head `codex/phase-0-system-foundation`. T01's scope register, T02's policy matrix and T04's isolated harness/rehearsal are ready for review; this is not a claim that all seven-role enforcement is deployed. T03 remains partial after incorporating the supplied reviewer forms. Every human UAT gate stays Not run.

The browser operator inspected the status menu: it exposes exactly **Todo**, **In Progress**, and **Done**. All four selected cards remain In Progress/open while this draft is reviewed and inputs remain outstanding; no new status options were created. Last verified board totals were **Todo 125 / In Progress 4 / Done 0**.

The browser tool became unavailable during the final handoff, and the connected GitHub tool still returned 404 for the private repository. The manager created the PR using the existing standard Git credential interface and GitHub REST API, without exposing or persisting credentials. A read-only Project API attempt was refused because that credential lacks `read:project`; no permission expansion was performed. No issue comments were posted and no issue bodies, checkboxes, labels or other project cards were changed. The PR links all four issues and the checked-in execution record provides the detailed update.

## Later T03 input clarification — 2026-10-23

The user approved mandatory qualitative/risk answers, a total article contribution of 2 points, and a temporary all-category Word/PDF upload policy of 10 MB per file. A field may hold both formats simultaneously; images are deferred and no numerical count cap was supplied. The remaining consent source is approved non-compete/event-rules text. Technical choices and unrequested four-review aggregation are not extra product blockers.

The corresponding contract changes are delivered on the existing Phase 0 branch and draft PR #145. The T03 card stays open/In Progress and human acceptance remains Not run. No new Project field mutation is needed for this clarification.

After pushing specification commit `94e24c0`, the manager updated and read back the bodies of [draft PR #145](https://github.com/dacho-morgh/dacho/pull/145) and [T03 issue #17](https://github.com/dacho-morgh/dacho/issues/17) through the existing authenticated repository API. A marked follow-up section records the approved decisions and supersedes the original missing-input snapshot. The PR remains draft and #17 remains open; acceptance checkboxes, labels, project fields and other issues were preserved. No issue comments were posted. These later body updates are distinct from the initial board-only changes described above.
