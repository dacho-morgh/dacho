# Phase 0 project board status

Verified in the authenticated GitHub UI on 2026-10-23 for [Event and exhibition delivery board](https://github.com/orgs/dacho-morgh/projects/1/views/1?layout=board), repository `dacho-morgh/dacho`.

## Status changes

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
- T03 still lacks the final rubric/questions, Q39 policy, and agreement text; these were explicitly recorded as unresolved in issue #17 and were not invented. T04’s status indicates active work only; it does not claim its checklist is complete.
- GitHub’s private issue/project connector returned 404, so the authenticated browser UI was used. The local publication record remains [github-publication.md](github-publication.md). This file records observed planning state and does not claim a commit or push.

## Screenshot

The final board view was captured in the browser after verification. The browser-use screenshot was rendered in the task transcript; a standalone local PNG could not be saved from the available browser screenshot API.

## Follow-up — 2026-10-23

After the initial issue read, the user supplied the ordinary/employer forms and the core review questions, ceilings, weights, and formula. The supplied maximum is **55.05**. Therefore, the initial table above is a historical snapshot of the inputs visible at the time, not a statement that the review rubric remains wholly unspecified.

Q39/file policy, agreement text, and interpretation remain open. Keep those as explicit decisions; do not infer their contents from the supplied forms or score formula. T03 remains In Progress pending these open inputs and review of the updated specification.

The exact T02 acceptance items read from issue #16 are:

- «نتیجه مجوز و فیلدهای قابل مشاهده برای پرونده خود، دیگران و بدون انتساب مشخص باشد»
- «کنترل در CMS مستقیم، proxy، API، فایل و آمار اعمال شود»

These acceptance items require defining the permission and visible-field outcomes for own, others’, and unassigned records, then applying those controls across direct CMS access, proxy, API, files, and statistics. They do not state that T02 implements the seven-role controls itself: the issue’s context defines the seven-role model, while implementation work is split into later tasks such as T08/T09.
