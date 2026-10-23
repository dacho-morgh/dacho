"""Build English planning tables and self-contained human-test documents. No product/DB writes."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / 'docs/event-review-system-plan.md'
INDEX = ROOT / 'docs/github-task-index.md'
old_plan = PLAN.read_text(encoding='utf-8-sig')
old_index = INDEX.read_text(encoding='utf-8-sig')
issue_map = dict(re.findall(r'\| (T\d{2}) \|.*?\| \[#(\d+)\]', old_index))
dependencies = {}
for line in old_plan.splitlines():
    cells = [c.strip() for c in line.split('|')]
    if len(cells) >= 6 and re.search(r'\bT\d{2}\b', cells[1]):
        dependencies[re.search(r'\bT\d{2}\b', cells[1])[0]] = re.findall(r'T\d{2}', cells[3])

TASKS = [
('T01','Record approved scope and open inputs','Product','Record both workflows, decisions, decision owners and affected tasks; keep unresolved values explicit.'),
('T02','Seven-role permission and scope matrix','BE,CMS','Specify own/other/unassigned visibility and operations, including CMS, API, populated fields, files, search and counts.'),
('T03','Fixed form and document specifications','Product,BE,FE','Define field types/requirements/absence semantics/conditions/versions; capture supplied ordinary/employer rubric, required qualitative/risk answers, 2-point article cap and Word/PDF multi-file policy (10 MB each); obtain agreement text; no form builder.'),
('T04','Isolated test environment and migration inventory','QA,Data','Separate test database/files from live data; inventory existing migrations/data and rehearse recovery.'),
('T05','Persist company addresses and executives','BE','Real Payload adapter saves addresses/executives and fresh sessions reload them; in-memory tests alone are insufficient.'),
('T06','Protect private company and identity fields','CMS,BE','Deny unauthorized direct CMS/relationship reads and identity/representative changes; whitelist public directory fields.'),
('T07','Safe tracking allocation and atomic submit','BE','Replace count-based codes; concurrent creation/deletion cannot collide; parallel submit has one effective transition.'),
('T08','Single operational role and personnel management','CMS,BE,FE','Owner creates/deactivates personnel with one operational role; block public privilege injection and deliberately preserve content privileges.'),
('T09','Shared role and assignment authorization','BE,FE','Lists/details/actions/files/counts share scope; role or assignment changes revoke old access; allowed actions come from server.'),
('T10','Private document upload and download','BE,CMS','Validate category/type/size/owner server-side; deny unauthorized direct URLs and financial leaks; failed upload cannot advance stage. Enforce approved Word/PDF-only policy, 10 MB per file, multiple files on one field.'),
('T11','Progressive signup and password login','CMS,FE','Capture Stage 1 fields; atomically create person/company; reject duplicate national ID with rollback; phone/email plus password works.'),
('T12','Company-owned applications and acting person','BE,Data','Separate companyId from acting user; migrate old ownership safely; prevent cross-company access.'),
('T13','Complete company dossier and resume','BE,CMS,FE','Persist Stage 2 fields/documents and permitted absence answers; separate legal entity type from knowledge-based status; show missing items.'),
('T14','Secretariat verification queue and decisions','BE,CMS,FE','Store submitted revision/reviewer/time/reason; prohibit self-approval; returned documents can be corrected and resubmitted on same profile.'),
('T15','Re-verification and participation eligibility','BE,FE','Incomplete/unapproved companies cannot formally apply or reserve; identity edits require approval again; preserve previous approved snapshots.'),
('T16','Event configuration and responsible teams','CMS,FE','Owner defines event/registration window and event-specific chief/investment person; separate event responsibilities.'),
('T17','Technology categories, subtopics and employer','CMS,FE','Validate category/event relationships and one named employer reviewer person per subtopic; reject invalid assignments.'),
('T18','Versioned RFP and correct downloads','CMS,BE,FE','Download correct subtopic RFP; later RFP changes do not rewrite submitted application snapshots.'),
('T19','Independent application per subtopic','BE,FE','Allow several subtopics with independent codes/state/results; prevent duplicate applications and cross-event subtopic misuse.'),
('T20','Fixed application, consent and proposal form','BE,FE','Save drafts and validate final submission server-side; snapshot company/form/RFP/proposal; record agreement version/actor/time.'),
('T21','Chief triage, correction, rejection and reopen','BE,FE','Reasons required; corrections revise same application; rejection locks only company/event/subtopic; audited reopen is owner-only.'),
('T22','Review rounds and four distinct assignments','BE,FE','Capture fixed employer plus three distinct ordinary reviewers; round references exact proposal revision.'),
('T23','Assigned reviewer queue and dossier','BE,FE','Reviewer/employer sees assigned cases and necessary company profiles only; financial files and other evaluations are excluded.'),
('T24','Fixed review rubric and score calculation','BE,FE','Use supplied ordinary/employer questions, ceilings and 0.45*A+0.40*B+0.15*C (max 55.05); require all qualitative/risk answers and cap articles at 2 total; reject invalid/tampered values; no invented aggregation or automatic advancement.'),
('T25','Draft, finalization and locked evaluations','BE,FE','Drafts do not count; complete required review forms before finalizing; no normal edits to finalized evaluations or impersonation.'),
('T26','Reviewer replacement and assignment history','BE,FE','Chief replaces unfinished ordinary reviewer; owner alone replaces employer with reason; revoke old access and preserve history.'),
('T27','Atomic 4/4 completion and confidentiality','BE,FE','1–3 evaluations stay incomplete; concurrent finalization produces one completion; every reviewer sees only own evaluation.'),
('T28','Chief decision and new correction rounds','BE,FE','Require explicit chief advancement after 4/4; corrected proposal creates new revision/round; old evaluations stay historic and do not count.'),
('T29','Invite company financial package','BE,FE','Only chief advancement opens financial stage; notify owning company with required document categories.'),
('T30','Versioned financial package and submission','BE,FE','Validate complete required package and younger-company since-establishment rule; incomplete uploads/package do not advance.'),
('T31','Scoped investment assignment and dossier','BE,FE','Assigned investment person reads case/reviews; financial records restricted to company, assigned person, Secretariat and owner.'),
('T32','Record and send investment memo','BE,FE','Single investment person writes/sends memo to Secretariat; no separate approve/reject/return or voting controls; preserve history.'),
('T33','Secretariat follow-up and result publication','BE,FE','Obtain supplementary documents through correspondence if needed; disclose separate published text only; interim memos/requests never auto-publish.'),
('T34','Authorized recipients and role messaging','BE,FE','Company to support, reviewer to responsible chief, investment to assigned-case participants; owner/chief general sending does not grant case access.'),
('T35','Case-linked letters and private attachments','BE,FE','Send/read/download authorized files; preserve financial privacy/case association for supplementary company replies and authorized reviewer access.'),
('T36','Reliable transition history','BE,FE','Record actor/time/action/reason/revision/old-new state; scope reads; deleting displayed letters cannot erase workflow history.'),
('T37','Consistent transitions and notification delivery','BE','Commit business change/history reliably; notification failures are retryable without repeated business effects or partial transitions.'),
('T38','Scoped queues, counts and overview','BE,FE','Counts match authorized lists; filters/search do not leak unrelated cases; show actual pending work for each role.'),
('T39','Shared dossier and role-specific actions','FE','Use real API responses filtered by role; no financial disclosure to chiefs/reviewers; remove actions pointing to absent routes.'),
('T40','Complete UI states and usability','FE,QA','Handle loading/empty/error/denied/saved/stale states; support Persian RTL, keyboard and phone-size main journeys.'),
('T41','Migration rehearsal on isolated data','Data,QA','Map old users/roles/applications without greenfield assumptions; rehearse migration and recovery on separate data.'),
('T42','Permission and document matrix tests','QA','Exercise seven roles against own/other/unassigned records across CMS/proxy/API/files/counts, including financial confidentiality.'),
('T43','Workflow branch integration tests','QA','Cover unverified, reject/reopen/correct, incomplete review/replacement/new rounds, missing financial documents and publication.'),
('T44','Concurrency and failure tests','QA','Verify parallel submit/fourth evaluation/stale revision/file failure/notification retry with real persistence and idempotency.'),
('T45','Full event E2E with separate accounts','QA','Complete signup through publication using real test DB/files/forms and role isolation; never mutate shared/live fixtures.'),
('T46','Release and restore readiness','Operations','Prepare responsible accounts, configuration, DB/files backup/restore, health checks and support runbook; rehearse before release.'),
('T47','Booth catalogue, company limit and fixed prices','CMS,BE,FE','Owner configures booth ID/specification/status/final toman price and per-company exhibition limit; list/guide map is sufficient.'),
('T48','Independent booth requests and exclusive reservation','BE,FE','Reserve one booth per application; several independent applications allowed; enforce exclusivity and company limit under concurrency; no automatic expiry.'),
('T49','Independent price record for each booth request','BE,FE','Each application has its own fixed price/unit/version; no combined payments; price edits do not silently rewrite previous agreed amount.'),
('T50','Independent receipt and payment history','BE,FE','Upload only after attendance approval; one receipt cannot be counted as independent payments for other booth requests; preserve correction versions.'),
('T51','Verify receipt and confirm that booth','BE,FE','Secretariat confirms or returns receipt with reason; correction preserves reservation; duplicate confirmation has no second inventory/financial effect.'),
('T52','Cancellation, release and manual refund records','BE,FE','Company cancels before receipt; later cancellation goes through Secretariat; retain financial history and release only that booth; no expiry job.'),
('T53','Company and Secretariat exhibition panels','FE','Show independent request/price/receipt/status/cancellation for each booth, company limit and guide map; distinguish attendance from payment approval.'),
('T54','Exhibition E2E and reconciliation','QA,Operations','Verify independence, limits/races, no expiry, attendance guard, receipt correction/duplicates and cancellation; reconcile booths/payments.'),
('T55','Separate exhibition attendance approval','BE,FE','Secretariat approves/rejects each reserved-booth request with reason; company verification alone cannot authorize receipt upload.')]

assert len(TASKS) == 55 and len(issue_map) == 55 and len(dependencies) == 55
overview = '''# Event, review, investment and exhibition delivery plan

Updated 2026-10-23. **Planning and acceptance specification; not a claim of completed implementation.**

All 55 implementation tasks exist in [Project 1](https://github.com/orgs/dacho-morgh/projects/1). Stable task IDs differ from issue numbers; see the [issue index](github-task-index.md). Human acceptance gates are separate issues and have not been executed merely by being documented.

The frontend breakdown adds 32 linked work-package issues, and the acceptance catalogue adds 42 human-test issues: **129 planned issues in total**. The frontend packages refine existing cross-layer tasks rather than adding 32 unrelated product features. Use the `frontend`, `backend` and `manual-test` labels to separate work. Shared original tasks can carry both engineering labels.

## Complete English documentation

- [Product requirements](system/product-requirements.md): purpose, seven roles, full form/document lists, permissions, approved rules and open inputs.
- [Workflows](system/workflows.md): diagrams, actors, preconditions, corrections, rejections, financial follow-up, booth/payment/cancellation state transitions.
- [Backend design](system/backend-design.md): proposed records and API operation families, service boundaries, authorization, concurrency, versioning and migration.
- [Implementation audit](system/current-state-audit.md): dated source evidence, reusable foundation, missing work, defects and historical test limits.
- [Frontend audit](system/frontend-audit.md), [frontend design/contracts](system/frontend-design.md) and [32 frontend work packages](system/frontend-plan.md): Figma coverage, existing routes, missing screens, original/backend links and frontend sequencing.
- [Persian frontend report](system/frontend-report.fa.md): findings and delivery sequence for the product team.
- [Manual acceptance tests](system/manual-acceptance-tests.md): human scripts, prerequisites, expected results, negative paths and evidence.
- [Documentation entry point](system/README.md).

## Delivery objective and order

First deliver the shared access, persistence and private-file foundation. Then deliver one complete event journey: company signup/verification, independent subtopic applications, four reviews including the employer, explicit chief advancement, private financial package, investment memo and Secretariat publication. Finally deliver the independent exhibition journey: specific booths, independent applications/receipts, attendance approval, manual payment verification and controlled cancellation.

Preserve the existing Next.js/Payload + Express + PostgreSQL architecture. No general workflow designer, per-event form builder, online gateway, ancillary exhibition services or interactive floor plan is required.

| Increment | Functional completion | Human gate |
| --- | --- | --- |
| A. Environment and contracts | Isolated fixtures, seven-role matrix, form contracts and known open inputs | UAT42 |
| B. Onboarding and access | Password login/signup, real profile persistence, private files and verification | UAT01–UAT07, each when its slice is ready |
| C. Event intake | Event/team/subtopic/RFP, independent applications, corrections/rejection/reopen | UAT08–UAT13 |
| D. Review | Four assignments, own evaluations, replacement, 4/4, chief action/new rounds | UAT14–UAT20 |
| E. Investment and disclosure | Financial package/privacy, memo, supplementary files and published result | UAT21–UAT27 |
| F. Shared quality and event release | Reliable history/notifications/counts, RTL/usability, migration/restore and whole journey | UAT28–UAT30, UAT38–UAT39, UAT41 |
| G. Exhibition | Booth catalogue/limit, independent reservations/receipts, approvals and cancellation | UAT31–UAT38, UAT40 |

Implementation completion is not human acceptance. A test starts **Not run**, becomes **Blocked** if its build/fixtures/product inputs are unavailable, and passes only with actual recorded evidence. Failed gates stay open with linked defects. A human race test does not prove database isolation; automated integration/concurrency tests remain required.

No staffing, dates or person-day estimates are agreed. Issue creation does not authorize production migration, deployment or real financial actions.

## Binding product decisions

Seven operational roles; one operational role per person; event-specific teams. One application per event subtopic. One employer reviewer person plus three other distinct reviewers; four finalized evaluations do not advance without the chief. Ordinary unfinished reviewers can be replaced by the chief; employer replacement is owner-only with reason. A corrected reviewed proposal starts a new round, retaining old scores as history.

Company verification supports correction/resubmission; identity edits need re-verification without rewriting historic application snapshots. Rejection locks only that company/event/subtopic; owner can reopen with reason. Forms are fixed system-wide but versioned. The investment role is one memo-writing person; Secretariat handles supplementary files and publication. Financial files exclude chiefs and reviewers; companies never receive private scores/memos.

Each booth has its own application, fixed toman price, receipt, state and cancellation history. Several booths are allowed up to the owner-set exhibition company limit. Reservation occurs with the request, has no timed expiry, and survives receipt correction. Attendance approval precedes payment. Before receipt, company cancellation is direct; afterward Secretariat handles cancellation and any manual refund with history.

## Backlog

BE = backend/data; CMS = Payload; FE = panel; QA = verification. Dependency links determine execution order, not numbering. T03 means readiness of the corresponding stage's form contract: missing agreement text blocks consent assertions, not supplied review/file policy or login/verification. Start T36/T37 early enough for the first business transition to have history and reliable notifications.
'''
groups = [(0,'Contracts and safe test environment',1,4),(1,'Fixes and shared foundation',5,10),(2,'Signup, profile and verification',11,15),(3,'Event configuration and intake',16,21),(4,'Four independent evaluations',22,28),(5,'Investment and publication',29,33),(6,'Correspondence, history and panels',34,40),(7,'Event release evidence',41,46),(8,'Exhibition and manual receipts',47,55)]
parts=[overview]
for phase,title,lo,hi in groups:
    parts += [f'\n### Phase {phase}: {title}\n','| ID / issue | Task / area | Prerequisites | Acceptance criteria |','| --- | --- | --- | --- |']
    for tid,title,area,criteria in TASKS:
        if lo <= int(tid[1:]) <= hi:
            deps=', '.join(f'[{d}](https://github.com/dacho-morgh/dacho/issues/{issue_map[d]})' for d in dependencies[tid]) or 'None'
            parts.append(f'| [{tid} / #{issue_map[tid]}](https://github.com/dacho-morgh/dacho/issues/{issue_map[tid]}) | {title} / {area} | {deps} | {criteria} |')
parts.append('''
## Evidence and open inputs

The October 22 backend unit run passed 9 files/42 tests. Destructive integration/frontend fixture suites were not run on the shared environment. This historical result is not acceptance of missing business behavior or a fresh certification of the current build.

The user supplied ordinary/employer reviewer forms and the per-review formula (maximum 55.05) on 2026-10-23; see [review rubric](system/review-rubric.md). The user further supplied Word/PDF-only uploads, 10 MB per file, multiple representations per field, all qualitative/risk answers required at finalization and a 2-point total article cap. Approved agreement/rules text remains open; technical representation is not an additional product blocker. Do not derive authority from Figma examples or invent four-review aggregation. Backend record/API names are proposed technical contracts; the business rules above are confirmed scope. Team capacity and calendar commitments remain unspecified.
''')
PLAN.write_text('\n'.join(parts)+'\n',encoding='utf-8')
index=['# GitHub implementation task index','','Registered 2026-10-23: 55 issues with acceptance criteria and prerequisite links. Human acceptance issues are indexed separately in [the manual test catalogue](system/manual-acceptance-tests.md).','','[Project](https://github.com/orgs/dacho-morgh/projects/1) · [Project issue search](https://github.com/dacho-morgh/dacho/issues?q=is%3Aissue+state%3Aopen+project%3Adacho-morgh%2F1)','','| ID | Task | Issue |','| --- | --- | --- |']
for tid,title,_,_ in TASKS:
    index.append(f'| {tid} | {title} | [#{issue_map[tid]}](https://github.com/dacho-morgh/dacho/issues/{issue_map[tid]}) |')
index.append('\n## Frontend and human-test indexes\n\n- [32 frontend issues and their original/backend prerequisites](system/frontend-plan.md).\n- [42 human acceptance issues and full procedures](system/manual-acceptance-tests.md).\n- [Frontend findings in Persian](system/frontend-report.fa.md).\n\nLabels describe scope: original service/CMS/data/integration tasks use `backend`; browser deliverables use `frontend`; cross-layer originals can use both. Human execution gates use `manual-test` and stay open until evidence is recorded. Dependencies in descriptions are explicit issue links, not GitHub-native blocking relations.\n')
INDEX.write_text('\n'.join(index)+'\n',encoding='utf-8')

# Each step is Action => Expected result. These cases are acceptance specifications, not executions.
CASES = [
('UAT01','Password login, logout and session access','T11','Company A representative','A registered company account with known test password.',[
'Sign in with phone and password, then repeat in a fresh session with email => Both identify the same company and open its panel.',
'Try an incorrect password and an unknown account => No authenticated panel or account data is disclosed; a usable error appears.',
'Log out and open the saved private panel URL in a fresh tab => Authentication is required again; browser navigation does not restore private access.',
'Sign back in => The same company profile and prior data load, without duplicate accounts.']),
('UAT02','Atomic signup and duplicate company protection','T11','New company representative','Unused synthetic company national ID; separate administrator browser session.',[
'Register full company name, national ID, activity, representative name/position/phone/email and password => One person and one company are created; panel access works.',
'Observe participation before verification => Panel/profile completion is available, formal event/booth application is blocked.',
'Repeat signup with the same company national ID => Clear duplicate error; no second company or stranded user is created.',
'Repeat public signup while an administrator session exists in another browser => New account remains a company representative and receives no internal privileges.']),
('UAT03','Personnel creation and single operational role','T08','System Owner; newly created reviewer','Owner account and synthetic staff identity.',[
'Create an internal user and assign Reviewer => User can sign in with only the assigned operational role.',
'Attempt to grant a second operational role => The system prevents multiple operational roles and explains the constraint.',
'Use the reviewer account to open personnel administration => Access is denied; the owner can still manage personnel.',
'Deactivate the reviewer and retry its private URLs in a fresh session => Active access is removed while historical attribution is retained.']),
('UAT04','Company dossier, addresses and executives persist','T05,T13','Company A representative','Company account and approved synthetic document fixtures.',[
'Complete company classification, legal type, location, needs, founding year, key members, projects/customers, insured employee count and available documents => Required missing items are identified; legal type and knowledge-based status remain separate.',
'Add and edit multiple addresses and executives; mark absent website/certificates/residency as Does not have => Explicit absence is accepted where permitted and data saves.',
'Sign out, sign back in and open profile/resume => Saved addresses, people and document references survive real storage/reload.',
'Open the company from an authorized Secretariat account => The same submitted data appears without missing arrays or placeholder-only resume content.']),
('UAT05','Private company documents and direct download isolation','T06,T10','Companies A and B; authorized Secretariat','A and B have separate accounts and synthetic private documents.',[
'Upload valid Word (.doc/.docx) and PDF files together to one company-document field as A and download each => Both coexist with correct content and ownership under one field; the per-file limit is 10 MB, not a combined-field cap.',
'Copy the document and private profile URLs into B and a logged-out browser => Both private reads are denied; no sensitive metadata is exposed.',
'Inspect public company-directory presentation => Only intentionally public fields appear; registration/verification dossier is absent.',
'Upload a valid file of exactly 10,000,000 bytes, then one byte above the limit, an image and a falsely renamed file; retry an interrupted upload => The valid boundary file is accepted; oversized/disallowed/mismatched content is rejected with a usable error; failed files do not satisfy submission.']),
('UAT06','Verification return, correction, resubmission and approval','T14','Company A; Secretariat','A completed synthetic company dossier awaiting verification.',[
'Submit the profile for verification => Secretariat receives the submitted revision; company sees pending status.',
'Return or reject documents with a reason => Company sees that reason and can edit the same company profile.',
'Correct and resubmit => Same company identity is used; previous submission/decision remains in history.',
'Approve as Secretariat and inspect the company account => Approval actor/time and eligibility are visible; company cannot approve itself.']),
('UAT07','Eligibility gate and identity re-verification','T15','Company A; Secretariat','One incomplete company and one approved company with an existing application.',[
'Attempt formal event application and booth reservation as incomplete/pending company => Both are refused with a route to profile completion.',
'Approve the complete company and repeat valid participation => Event/booth actions become available within their other rules.',
'Change approved identity or registration documents => Renewed verification is required for new participation.',
'Open an application submitted before the edit => It retains the approved company snapshot from its original submission.']),
('UAT08','Event creation, registration window and event teams','T16','Owner; Chiefs E1 and E2','Two synthetic events and separate chief/investment accounts.',[
'Create E1 and E2 with registration windows and separate responsible teams => Correct definitions persist and appear in the panel.',
'Open E1 work as its responsible chief, then as the E2 chief => Only authorized event work is available.',
'Attempt application outside the configured registration window => Formal submission is blocked with a clear message.',
'Reload event configuration => Responsible people, dates and event identity remain correct.']),
('UAT09','Categories, subtopics, employer and correct RFP','T17,T18','Owner; Company A','E1 with two technology categories and distinguishable RFP fixture files.',[
'Create subtopics and assign one employer reviewer plus the correct RFP per subtopic => Relationships persist and company sees the matching names/files.',
'Attach Word and PDF to one RFP version, switch company selection between subtopics and download each representation => Both representations are available for the correct subtopic/version; neither overwrites the other or creates another application.',
'Attempt an invalid cross-event category/subtopic or ineligible employer assignment => Configuration is rejected rather than silently mismatched.',
'Change the current RFP after an application was submitted => Earlier application still references its submitted RFP version.']),
('UAT10','Independent subtopic applications and company ownership','T12,T19','Company A; Company B','Approved A/B; two E1 subtopics and one E2 subtopic.',[
'Apply as A to two E1 subtopics => Two separate application IDs/tracking codes, statuses and dossiers appear.',
'Change or reject one application => The other application remains independent.',
'Attempt another active duplicate or a mismatched event/subtopic request => Duplicate/invalid selection is rejected.',
'Open A application URL as B and inspect B counts => No case data or counts from A are disclosed.']),
('UAT11','Proposal draft, fixed form and versioned consent','T03,T20','Company A','Approved company, valid subtopic/RFP, approved form and agreement text.',[
'Enter application answers, key members and proposal, save draft and reload => Saved draft is recoverable and not yet a submitted review case.',
'Try final submit without required answer/file or agreement acceptance => Submission is blocked and missing items are identified.',
'Accept non-compete/rules and submit a policy-valid proposal => One submitted revision records actor/time and text/form/RFP versions.',
'Double-click submit or refresh the result => No duplicate application, tracking code or effective submission is created.']),
('UAT12','Chief return and same-case correction','T21','Responsible chief; Company A','A submitted application in initial chief triage.',[
'Open the application as responsible chief and return it with specific corrections => Company sees correction-required status and reason.',
'Open as company, correct permitted answers/proposal and resubmit => Same application/tracking identity receives a new revision.',
'Inspect both versions and transition history => Prior contents and actors remain traceable.',
'Try editing a submitted case without an authorized correction state => Ordinary company edits are refused.']),
('UAT13','Terminal rejection scope and owner reopen','T21','Chief; Company A; Owner','Two independent applications by A to different E1 subtopics.',[
'Reject one application with reason => It is terminal for that company/event/subtopic and the reason is visible.',
'Try applying again to that rejected subtopic, then use the other subtopic => Reapplication is blocked only in the rejected scope; the other remains usable.',
'Try reopen as company or ordinary reviewer => Reopen is denied.',
'Reopen as Owner with reason => The same case/history reopens and owner action is recorded.']),
('UAT14','Assign fixed employer and three distinct reviewers','T22','Responsible chief; employer; Reviewers R1–R3','A triaged application and eligible reviewer accounts.',[
'Start the review round => Subtopic employer automatically occupies the fixed employer slot.',
'Select three distinct ordinary reviewers and submit => Four distinct active assignments are created for the proposal revision.',
'Try duplicate people, fewer than three ordinary reviewers or replacing the fixed employer as chief => Invalid assignment is refused.',
'Open each assigned reviewer account => The correct case appears once in each queue.']),
('UAT15','Assigned-only reviewer dossier and own-evaluation privacy','T23,T09','Reviewer R1; unassigned reviewer; Company B','One active assignment for R1 and another case not assigned to R1.',[
'Open R1 assigned application and necessary company profile => Correct proposal/RFP and permitted profile data are readable.',
'Open unassigned case/company URLs as R1 => Access is denied even with copied URLs.',
'Open another reviewer evaluation or financial-stage document => R1 cannot see others scores, memo or financial files.',
'Compare reviewer queue and counts => They include assigned authorized cases only.']),
('UAT16','Review rubric validation and score computation','T24','Assigned reviewer; QA','User-supplied ordinary/employer rubric in docs/system/review-rubric.md; deployed scoring slice implementing supplied row ranges, the 2-point total article cap and mandatory qualitative/risk answers. Use versioned technical precision; no four-review aggregate is requested.',[
'Test both role forms with A=64, B=51, C=39 and all-zero answers, then a known mixed answer set => Scores match 0.45*A+0.40*B+0.15*C: maximum 55.05, zero 0; ordinary qualitative questions and employer risk checklist remain distinct.',
'Compare no articles, one article and several articles; try missing required answers and out-of-range scores => Article contribution is 0, 2 and 2 respectively; invalid/missing answers are refused with field-level guidance.',
'Change a displayed total/client value while keeping answers unchanged using a QA-provided controlled test method => Server does not trust the tampered total.',
'Inspect completion before chief action => Even a high final score does not automatically advance the application.']),
('UAT17','Evaluation draft, final submission and lock','T25','Assigned reviewer; Chief','Supplied role-specific rubric with every qualitative/risk answer required, and an assigned application.',[
'Fill part of evaluation, save draft and reload => Own draft persists and completion count does not increase.',
'Leave one ordinary qualitative answer or one employer risk-checklist item unanswered, then repeat with a valid negative answer => Unanswered blocks finalization; a valid no answer satisfies requiredness without forcing a positive assessment.',
'Complete all quantitative and qualitative/risk answers, including recommendation and top-five response/rationale, and finalize => One finalized evaluation is recorded and count increases once; optional row comments or administrative fields do not add a new gate.',
'Retry finalization and attempt ordinary editing => No duplicate count; finalized content is locked.']),
('UAT18','Reviewer replacement and employer exception','T26','Chief; Owner; old/new reviewers','Incomplete ordinary assignment and an employer assignment.',[
'Replace an unfinished ordinary reviewer as chief => Replacement receives the case and old assignment is retained as history.',
'Open saved case/file URLs as the replaced reviewer => Current access is denied.',
'Try changing employer as chief => Action is denied.',
'Replace employer as Owner with a reason => New fixed assignee is recorded with actor/reason/history, without erasing earlier attribution.']),
('UAT19','Four-of-four readiness without automatic advancement','T27','Four assigned reviewers; Chief','Supplied role-specific rubric with every qualitative/risk answer required, and active current-round assignments.',[
'Finalize one, then two, then three evaluations => Progress reads 1/4, 2/4 and 3/4 and advancement remains unavailable.',
'Inspect each reviewer account => Each sees only own evaluation, even when the chief sees aggregate progress.',
'Finalize the fourth valid evaluation => Current round becomes ready exactly once.',
'Open company and chief panels before chief approval => Company has not advanced to financial intake automatically; chief must explicitly decide.']),
('UAT20','Chief decision and corrected-proposal review round','T28','Chief; Company A; reviewers','One 4/4 case and one case requiring a proposal correction.',[
'Approve advancement as responsible chief on complete case => Financial stage opens only after this explicit action.',
'Return another reviewed case for proposal correction and resubmit as company => Same application gets new proposal revision and new review round.',
'Inspect history and progress => Old evaluations remain readable to authorized staff but do not count in the new round.',
'Try using an old reviewer page/action on the superseded round => It cannot alter current-round completion.']),
('UAT21','Financial-stage invitation and timing','T29','Company A; Chief','One case before chief advancement and another advanced case.',[
'Try opening/submitting financial stage before chief approval => Action is unavailable/denied.',
'Approve advancement as chief => Owning company receives an in-app invitation linked to the correct case.',
'Open the invitation as company => Required financial categories and next action are clear.',
'Open the same invitation/case as another company => Financial intake is denied.']),
('UAT22','Financial package completion, versions and younger company','T30','Company A; assigned investment person','Advanced case; synthetic financial files; younger-company fixture.',[
'Upload financial statements, debts/facilities, tax/insurance records, contracts/orders/commitments, estimate/use of funds and available guarantees => Correct categories persist.',
'Omit a required category or use an invalid file => Final package submission is blocked without handing an incomplete package to investment review.',
'Submit a complete package, including since-establishment records for the younger-company fixture => Authorized investment queue receives the correct version.',
'Reload and inspect documents => Submitted package and file versions remain consistent.']),
('UAT23','Investment assignment and financial confidentiality','T31','Assigned/unassigned investment people; Chief; reviewer; Company A; Secretariat; Owner','A submitted financial package and separate event responsibilities.',[
'Open as assigned investment person => Case, permitted four reviews and financial files are available.',
'Open same financial file/URL as chief, employer reviewer, ordinary reviewer or unassigned investment person => File, sensitive metadata and case access beyond scope are denied.',
'Open as owning company, Secretariat and Owner => Authorized financial records are available.',
'Inspect another event queue and copied URLs => Investment access remains case-assignment scoped.']),
('UAT24','Investment memo handoff without decision controls','T32','Assigned investment person; Secretariat; Company A','A complete assigned financial dossier.',[
'Write and send an internal investment memo => Secretariat receives the case-linked memo with author/time.',
'Inspect investment actions => There are no separate investment approve/reject/return or multi-member voting actions.',
'Open the company account before publication => Private memo is not visible and no final outcome auto-publishes.',
'Reload the internal dossier/history => Memo and handoff remain attributable and persistent.']),
('UAT25','Supplementary financial documents through Secretariat','T33,T35','Investment person; Secretariat; Company A; reviewer','An internal memo requesting extra evidence.',[
'As Secretariat send a case-linked request for supplementary documents => Company receives an actionable support message, not a published final outcome.',
'Reply as company with authorized private attachments => Files remain linked to the case and financial category.',
'Open as assigned investment person => Supplementary files can be reviewed and another memo can be provided.',
'Try the supplementary-file URL as ordinary reviewer/chief/another company => Financial confidentiality remains enforced.']),
('UAT26','Secretariat publication and company-visible outcome','T33','Secretariat; Company A; investment person','Internal memo ready for disclosure.',[
'Inspect company view before publication => Only permitted status/correspondence is visible, without memo or private scores.',
'Publish a separate company-visible result text as Secretariat => Publication actor/time and disclosed text are recorded.',
'Open the company case and notification => Correct published result appears for that company only.',
'Inspect internal dossier => Private memo, prior versions and review evidence remain distinct from published text.']),
('UAT27','Role-specific messaging and attachment permissions','T34,T35','All seven roles across two events/companies','Scoped cases and synthetic attachments.',[
'Send as company, ordinary reviewer and employer => Company can contact Secretariat support; reviewers only the responsible chief.',
'Try unrelated recipients as investment person => Only authorized participants in assigned case are selectable/accepted.',
'Send as owner/chief and inspect unrelated case visibility => General sending does not grant access to unrelated dossiers.',
'Send/download an authorized attachment then copy its URL to an unauthorized account => Delivery works for intended audience and download is denied elsewhere.']),
('UAT28','History, notifications and retry visibility','T36,T37','Company; Secretariat; Chief; QA','A staging build with controlled notification-failure fixture or operator support.',[
'Perform verification, return/resubmit and assignment actions => History includes actor/time/reason/revision/old-new state; recipients receive case-linked in-app work.',
'Delete a displayed letter => Workflow history remains intact.',
'Use the controlled notification failure and operator retry => Business state remains committed and notification arrives without repeated business transition.',
'Reload each authorized account => State/history/counts agree; unauthorized accounts cannot read the history.']),
('UAT29','Queues, counts and shared dossier actions','T38,T39','All roles with own and unrelated cases','Known fixture counts for two companies and two events.',[
'Compare each role overview count with its filtered list => Counts equal authorized list items.',
'Search/filter by event, stage and title, then open cases => No unrelated case leaks through count, search or populated company fields.',
'Open each permitted shared dossier => Correct revision/files/history/actions appear and no removed-route button remains.',
'Change responsibility/assignment and refresh => Lists, counters, detail actions and old URLs reflect revoked/new access.']),
('UAT30','RTL, mobile, keyboard and error states','T40','Company; reviewer; Secretariat','Supported test browsers and phone-size viewport/device; empty/loading/error fixtures.',[
'Use login, profile, request, evaluation, letters and receipt screens by keyboard => Focus, labels and submit/error guidance are usable.',
'Repeat core forms at phone width with Persian names, long text and mixed numbers => RTL layout remains readable with reachable controls and no lost input.',
'Exercise loading, empty, validation, denied and network-error states => Each has a clear recoverable outcome.',
'Open a stale form while another actor changes the case => Conflict/refresh guidance prevents silent overwrite.']),
('UAT31','Booth catalogue, prices, guide map and company limit','T47','Owner; Company A','A synthetic exhibition with identifiable booths.',[
'Configure booth IDs/specifications/availability/final prices in toman and company limit => Definitions persist and appear correctly.',
'Open booth list and guide map as company => Correct numbers, sizes, prices and availability are understandable; clickable floor map is not required.',
'Edit a current booth price => New selection uses the new price while previous recorded application price remains unchanged.',
'Inspect available features => No required gateway, ancillary-service pricing or automatic-expiry controls are introduced.']),
('UAT32','Independent booth requests, reservations and company cap','T48','Approved Companies A and B','Exhibition limit two for A; at least three free booths.',[
'Apply as A for two specific booths => Two independent requests/tracking identities and exclusive reservations appear.',
'Try a third active booth request => Company limit blocks it, including repeated tabs.',
'Try selecting an A-reserved booth as B => B cannot reserve the same booth.',
'Reload after time passes without a decision => Reservations persist; changing one request does not alter the other.']),
('UAT33','Separate attendance approval before payment','T55','Company A; Secretariat','A reserved booth application with attendance pending.',[
'Try submitting receipt as the verified company before attendance approval => Receipt action/API is denied; company verification alone is insufficient.',
'Approve attendance as Secretariat => Payment/receipt becomes available for that application only.',
'Reject attendance on a separate application with reason => That booth releases with history; unrelated application is unchanged.',
'Reload the company view => Attendance state, reason and next step are clear and distinct from paid/confirmed state.']),
('UAT34','Independent booth price snapshot and currency','T49','Owner; Company A; Secretariat','Two booth applications with different fixed toman prices.',[
'Inspect each approved application price => Each shows only its own booth amount and explicit currency/unit.',
'Change catalogue price as Owner => Existing recorded application amount/version does not silently change.',
'Compare UI amount to the test operator financial record => No toman/rial or rounding conversion error exists.',
'Inspect payment requirements for both requests => No combined invoice/receipt substitutes for independent booth payments.']),
('UAT35','Independent receipt submission and duplicate protection','T50','Company A; Secretariat','Two attendance-approved booth applications and synthetic receipt fixtures.',[
'Upload a valid Word and PDF representation together for the first request receipt => Both files attach to one receipt version for that application; pending-verification status appears and upload alone does not confirm the booth.',
'Open the second request => It still needs its own independent receipt.',
'Attempt to count the same payment receipt as a second independent payment => Duplicate/misassociated payment is prevented or flagged for refusal before confirmation.',
'Reload and inspect file/transaction details => Correct request association and receipt history persist with private access.']),
('UAT36','Receipt correction preserves reservation; confirmation is idempotent','T51','Company A; Secretariat; Company B','One submitted booth receipt awaiting verification.',[
'Return receipt with reason as Secretariat => Company sees correction action; booth remains reserved against Company B.',
'Submit corrected receipt as company => Same request receives a new receipt version and old version remains in history.',
'Verify/confirm payment as Secretariat => Exactly that booth becomes confirmed once.',
'Retry confirmation or refresh/reopen another tab => No duplicate financial effect or changed unrelated booth appears.']),
('UAT37','Cancellation before/after receipt and manual refund record','T52','Company A; Secretariat','One reserved request without receipt and another with submitted/confirmed receipt.',[
'Cancel the no-receipt request as company => Only its booth releases and company active count updates.',
'Request cancellation after receipt/payment => Request goes to Secretariat; company cannot directly release the booth.',
'Process authorized cancellation and any synthetic manual refund record as Secretariat => Actor/reason/reference/amount are retained and inventory releases consistently.',
'Inspect other booth request and prior payment history => Other request is unchanged; financial/history records are not physically erased.']),
('UAT38','Two-session concurrency smoke test','T07,T27,T44,T48','Two human testers; company/reviewer/Secretariat fixtures','Disposable staging data; synchronized browser sessions; supporting automated concurrency results.',[
'From two company sessions submit for the same free booth at the same time => At most one active reservation is confirmed; the losing user receives a clear conflict.',
'Submit concurrent requests near the company booth cap and double-submit a draft => Cap remains respected; one effective submission/tracking identity per request.',
'Synchronize final evaluation submissions on a current round => Progress reaches valid 4/4 once without automatic chief advancement.',
'Record observed states and compare operator audit/automated results => No duplicate effect is visible; human smoke evidence is not substituted for DB isolation tests.']),
('UAT39','Full event human acceptance walkthrough','T42,T43,T45,T46','Owner; Secretariat; Chief; employer; three reviewers; investment person; Company A','All corresponding individual event gates passed; final forms/policies/text supplied.',[
'Create the event/team/subtopic/RFP and register/verify company => Owner and Secretariat actions establish a usable eligible company.',
'Submit proposal, return/correct once, assign employer plus three reviewers and finalize all four => Same case/history and correct 4/4 are retained; chief explicitly advances.',
'Submit financial package, send memo and obtain one supplementary document through Secretariat => Scoped privacy and authorized handoffs work across separate accounts.',
'Publish result as Secretariat and inspect company plus unrelated accounts => Company sees correct result; scores/memo/financial files remain protected; release evidence is complete.']),
('UAT40','Full exhibition human acceptance walkthrough','T53,T54','Owner; Secretariat; Companies A and B','Individual exhibition gates passed; catalogue limit/prices and valid synthetic receipts.',[
'Configure exhibition and apply for several specific booths => Independent requests/reservations respect exclusivity and company cap.',
'Approve attendance then submit separate receipts => No preapproval payment or combined payment path is used.',
'Return one receipt, correct it and confirm payment; cancel another through the appropriate pre/post-receipt path => Reservations, states and inventory remain independent and consistent.',
'Reconcile booth list, company counts and payment records => Confirmed/released inventory matches evidence; nothing expires automatically.']),
('UAT41','Operator migration and backup/restore rehearsal','T41,T46','Test operator; Owner; QA witness','Disposable database/files snapshot and reviewed migration/recovery runbook; no live system.',[
'Inventory fixture users/roles/companies/applications/documents before migration => Expected identities and counts are recorded.',
'Run the reviewed migration on the disposable copy => Mapping preserves records and editorial privileges without assuming empty data.',
'Restore database and private files from the test backup => The same documented application/file relationships and permitted downloads work.',
'Run login/ownership/document smoke checks with QA witness => Evidence records build/runbook versions, recovery result and defects; production was untouched.']),
('UAT42','Human readiness review: scope, permissions and safe test fixtures','T01,T02,T03,T04','Product Owner; QA lead; technical operator','English requirements, role matrix, staging build details and synthetic fixture manifest.',[
'Review seven roles and event/booth flow with product owner => Approved decisions and current open inputs are explicit; no invented scoring/file limits.',
'Review test environment URL/database/file location with operator => It is isolated and safe for fixture creation/deletion and receipt simulations.',
'Provision separate role accounts, two companies/events and distinguishable synthetic files => Tester can identify actor, ownership and expected visibility.',
'Record which slices are ready and which tests are blocked => Tests remain Not run or Blocked until executed; implementation completion is not a claimed UAT pass.'])]

map_file=ROOT/'docs/system/manual-test-issue-map.json'
manual_issue_map=json.loads(map_file.read_text(encoding='utf-8-sig')) if map_file.exists() else {}
tests=[]
for uid,title,deps,roles,pre,steps in CASES:
    tests.append({'id':uid,'title':title,'implementationTasks':deps.split(','),'roles':roles,'preconditions':pre,'steps':[{'action':s.split(' => ',1)[0],'expected':s.split(' => ',1)[1]} for s in steps],'status':'Not run','issueNumber':manual_issue_map.get(uid)})
assert len(tests)==42 and len({t['id'] for t in tests})==42
assert all(d in issue_map for t in tests for d in t['implementationTasks'])
covered={d for t in tests for d in t['implementationTasks']}
assert covered==set(issue_map), sorted(set(issue_map)-covered)

def issue_body(t):
    deps='\n'.join(f'- [{d} — #{issue_map[d]}](https://github.com/dacho-morgh/dacho/issues/{issue_map[d]})' for d in t['implementationTasks'])
    frontend = json.loads((ROOT/'docs/system/frontend-tasks.json').read_text(encoding='utf-8')) if (ROOT/'docs/system/frontend-tasks.json').exists() else []
    t['frontendTasks'] = [f['id'] for f in frontend if t['id'] in f['manualGates']]
    fe_links='\n'.join(f"- [{f['id']} — #{f['issueNumber']}](https://github.com/dacho-morgh/dacho/issues/{f['issueNumber']})" for f in frontend if t['id'] in f['manualGates'] and f.get('issueNumber'))
    if fe_links:
        deps+='\n\nFrontend implementation slices:\n'+fe_links
    steps='\n'.join(f"{i}. **Action:** {s['action']}\n   **Expected:** {s['expected']}" for i,s in enumerate(t['steps'],1))
    return f"""Human acceptance gate for **{t['title']}**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
{deps}

**Actors:** {t['roles']}.

**Fixture/precondition:** {t['preconditions']}

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
{steps}

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:{t['id']} -->
"""

for t in tests:
    t['body']=issue_body(t)
(ROOT/'docs/system/manual-test-cases.json').write_text(json.dumps(tests,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

intro='''# Human acceptance test catalogue

Updated 2026-10-23. **42 manual gates; none executed by writing this catalogue.** All 55 implementation tasks are covered by one or more gates. Technical foundations use an operator/review gate where a browser-only test would be misleading.

## Execution process

1. Product Owner and QA review scope and open inputs (UAT42). Operator confirms an isolated staging URL, database and document area. Never use real company documents or real bank transfers.
2. Engineering deploys a coherent slice and records build/commit. A login gate can run as soon as T11 is ready; it does not wait for the entire event system.
3. A human tester uses the stated role accounts and performs each Action. Compare actual behavior with each Expected result; do not infer results from code or issue status.
4. Record Pass, Fail or Blocked with evidence. Missing build, approved agreement text or fixture is Blocked, never Pass. Reviewer questions/scoring/requiredness are supplied in review-rubric.md; temporary multi-file Word/PDF limits are supplied in document-policy.json.
5. Keep failed/blocked test issues open, link defects, fix and rerun against a recorded build. Close a gate only after all expected results pass. Independent slice gates do not replace the full event/exhibition walkthrough.

## Shared synthetic fixture pack

- Separate browser sessions: System Owner, Central Secretariat, Chiefs E1/E2, employer reviewer, ordinary reviewers R1/R2/R3 plus a replacement/unassigned reviewer, investment people E1/E2, Companies A/B.
- Companies: incomplete, pending, returned and approved; include a recently established company. Use unused synthetic national IDs and test-only credentials.
- Events E1/E2 with separate responsible teams; at least two subtopics in E1 with distinct RFP files and different employers where needed.
- Exhibition X1 with at least three distinguishable booths/prices and configurable company limit (use two for cap tests).
- Distinguishable valid Word/PDF company/proposal/financial/receipt files, including a Word+PDF pair on one field and per-file sizes at 10,000,000 bytes and one byte above; include images and spoofed extensions as invalid fixtures under document-policy.json.
- Known expected list counts, application revisions and review rounds. Use the supplied ordinary/employer forms and independently calculated expected values (all maxima yield 55.05); include the 2-point article cap and every qualitative/risk answer, and record the versioned technical score representation.
- Operator-assisted notification failure and disposable migration/restore fixtures. Human concurrency smoke requires two testers/sessions and companion automated evidence.

## Evidence template

| Field | Record |
| --- | --- |
| Gate / related implementation | UAT ID and linked issues |
| Build / environment | Commit/build and staging URL |
| Tester / date | Named human and execution date |
| Roles / fixtures | Account roles, synthetic company/event/case/booth IDs; never passwords |
| Per-step result | Actual outcome against every expected result |
| Evidence | Screenshot/recording, relevant IDs, visible state and time |
| Outcome | Not run / In progress / Pass / Fail / Blocked |
| Defects or missing input | Linked issue IDs and reason |
| Rerun | Fix/build/date and rerun result; retain earlier failures |

## Gate index

| Gate | Human acceptance slice | Engineering prerequisites |
| --- | --- | --- |
'''
md=[intro]
for t in tests:
    links=', '.join(f'[{d}](https://github.com/dacho-morgh/dacho/issues/{issue_map[d]})' for d in t['implementationTasks'])
    front_map = json.loads((ROOT/'docs/system/frontend-issue-map.json').read_text()) if (ROOT/'docs/system/frontend-issue-map.json').exists() else {}
    links+= ('; frontend: '+', '.join(f'[{d}](https://github.com/dacho-morgh/dacho/issues/{front_map[d]})' for d in t.get('frontendTasks',[]) if d in front_map)) if t.get('frontendTasks') else ''
    gate_link=f"https://github.com/dacho-morgh/dacho/issues/{t['issueNumber']}" if t['issueNumber'] else f"#{t['id'].lower()}"
    md.append(f"| [{t['id']}]({gate_link}) | {t['title']} | {links} |")
for t in tests:
    md += [f"\n<a id=\"{t['id'].lower()}\"></a>\n\n## {t['id']} — {t['title']}\n",t['body']]
(ROOT/'docs/system/manual-acceptance-tests.md').write_text('\n'.join(md)+'\n',encoding='utf-8')
print(json.dumps({'implementationTasks':len(TASKS),'manualGates':len(tests),'coveredImplementationTasks':len(covered),'status':'All manual gates Not run'}))
