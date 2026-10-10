# Admin and review workflow plan

Planning only. Prepared 2026-10-09 from the supplied workflow image, the linked Figma file, and the current repository. No application code or Figma designs were changed.

## Evidence and scope

Figma file: [Dashboard — Admin](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard?node-id=30510-13146).

Inspected the Admin page (`30510:13146`), Reviewer page (`31411:7579`), and company/applicant page (`5:5018`). Retrieved design context and screenshots for the admin decision screen (`30851:15307`) and reviewer evaluation screen (`31422:21242`). Page inventory and text inspection supplied the remaining screen coverage; this is a workflow coverage assessment, not a visual audit of every frame.

Color ownership follows the user's mapping:

| Color | Role | Responsibility |
| --- | --- | --- |
| Blue | Company / applicant | Complete profile, apply to events, correct returned requests, supply financial information, view outcomes |
| Purple | Admin | Decide company verification; receive completed review handoff where applicable; record and publish committee/scientific-team results |
| Green | Review editor / سردبیر داوری | Triage requests; return, reject, or refer; select three reviewers; monitor completion; route completed reviews |
| Light orange | Reviewer / داور | Evaluate assigned requests; submit a score and comments |
| Dark gray | Investment editor / سردبیر سرمایه‌گذاری | Receive financial dossier with review results and files; refer it to دبیرخانه |

The workflow describes operational roles. Payload's `cmsRole=editor` is a separate content-management privilege and must not be used as either editorial workflow role.

## What Figma already covers

| Area | Inspected Figma coverage | What the supplied flow adds |
| --- | --- | --- |
| Company management | Company list, company profile/resume/account tabs, company requests and request detail | Verification queue; pending/approved/rejected states; decision reason; registration eligibility |
| Employees | Employee list, add employee, employee profile/account/request views | Functional role assignment and reviewer eligibility for assignment |
| Requests | Request list with default/loading/empty/menu states; request detail with company link and workflow; admin approve/reject evaluation form; create-request screens | Role-specific queues, return reasons, correction/resubmission, assignment controls, actual stage history |
| Letters | Received/sent lists, states and actions; compose letter | Request-linked workflow notifications and actions; internal recipients across editors/reviewers |
| Reviewer | Request list with due date, request/company detail, evaluation form with score **1–10**, comments and Send; letter screens | Assigned-only access; draft versus final evaluation; submitted/locked states; progress of the three-reviewer round |
| Company panel | Profiles, event listing, event request form, request tracking, letters | Verification gate, event rejection lock, correction form, financial form and final-result display |

There is no separate review-editor or investment-editor page in the file's top-level page inventory. I did not find dedicated three-reviewer assignment, review-round completion, financial-dossier handoff, or final committee-result entry screens in the inspected pages. Generic request and letter layouts can provide their visual foundation.

Reviewer designs also contain company editing/deletion and request deletion actions. Those controls need role-specific variants: the supplied flow authorizes reviewers to score assigned requests, not administer company accounts or reject a request by deleting it.

## Required pages and views

Keep the consolidated `/dashboard` hierarchy. The operational admin panel is separate from Payload's existing `/admin` content/configuration panel. Use shared layouts with backend-provided permitted actions rather than building five independent applications.

| Page/view | Roles | Work required |
| --- | --- | --- |
| Panel overview | Each role | Extend with own pending tasks, current stage and reviewer progress; counts must use the same permissions as lists |
| Company verification queue | Admin | New filtered view; open submitted profile/documents; approve or reject with reason |
| Company detail and verification tab | Admin; company sees own status | Extend existing detail; keep profile completeness distinct from approval |
| Request queue | Admin, review editor, investment editor, reviewer | Extend existing list with role/assignment scope, service/event, stage, deadline and search filters |
| Shared request detail | All roles within access scope | Extend with versioned answers, readable form labels, file access, workflow history, responsible role and permitted actions |
| Review-editor triage panel | Review editor | New request-detail variant: return to company, reject eligibility, or start reviewer assignment |
| Assign three reviewers | Review editor | New modal/panel: select three distinct eligible reviewers; set due dates; confirm assignment |
| Reviewer evaluation | Reviewer | Adapt Figma score/comment form; implement assigned-only access, save draft, submit and locked state |
| Review progress and summary | Review editor; authorized admin/investment editor | New request-detail tab: 0/3–3/3 completion, per-reviewer results, required route/return action |
| Financial form and dossier | Company; investment editor | New company form variant plus read-only dossier tab with financial answers, three results and attachments |
| Investment-editor handoff panel | Investment editor | New request-detail variant: inspect complete dossier and refer to دبیرخانه |
| Final result entry | Admin | New request-detail variant: record committee/scientific-team assessment, decision, reason and publish to company |
| Letters and letter detail | All roles within access scope | Extend recipient resolution, request links and actionable notifications |
| Staff/role management | Admin | Complete existing employee screens and role membership controls; reuse Payload definition management where appropriate |

Most additions are tabs, panels or modals within existing pages. Workflow messages do not require separate routes. Every actionable view needs loading, empty, denied, validation-error, saved/submitted and stale-state variants, with RTL/mobile layouts.

## Flow to support

1. Company registers and completes its profile. Missing information returns the company to profile completion. A complete profile creates a pending verification case for admin.
2. Admin approves or rejects verification and the company receives the outcome in its letters. Approval permits the event application flow; the retry policy after verification rejection needs a business decision.
3. Verified company opens an event, completes the configured form, submits it, and can track the request.
4. Review editor receives the request and chooses one of three actions: return with corrections; reject eligibility and lock registration in the agreed scope; or refer to exactly three distinct reviewers.
5. Each reviewer independently opens their assignment, scores and comments, then submits. One or two completed evaluations must leave the round incomplete. The third final submission makes it ready for the review editor's next action.
6. Review editor examines all three results, then returns the request or routes it toward admin/investment processing. The financial-form request is sent to the company when the investment path is selected.
7. Company completes **and submits** the financial form. This submission step is necessary to connect the diagram's company notification to the investment editor's inbox; the diagram does not explicitly show it.
8. Investment editor receives the dossier with all required scores, forms and files, then refers it to دبیرخانه. Admin records the committee/scientific-team result and publishes the outcome to the company.

Keep verification state, request stage, company eligibility and individual reviewer-assignment state separate. Completing a workflow step is not necessarily final approval. Keep the original request identity across correction/resubmission.

## Current implementation and gaps

Reusable foundation:

- Express backend with request creation/submission, owner-scoped company reads, staff request reads, profiles, letters and activity history.
- Backend workflow supports linear role-gated `forward`, `return-to-company`, `return-to-previous`, and terminal rejection.
- Next.js dashboard already has company/employee/request lists, request detail, admin approve/reject actions, profiles and letters.
- Payload provides dynamic roles, service form definitions, and ordered workflow steps.

Required backend changes:

- Add company verification and event-specific eligibility. Current request submission has no verification gate.
- Persist event identity alongside service identity; do not depend on a title or unvalidated answer for event eligibility.
- Add edit/save and resubmit operations. Current submission accepts only `draft`; the existing `action_needed` return state cannot complete the correction loop.
- Add review rounds, three individual assignments and evaluations. A single `currentStepIndex` cannot model three parallel reviewers.
- Add financial submission, dossier readiness, investment handoff and final assessment/result publication.
- Extend letters to internal recipients. Current admin compose route accepts company/applicant recipients only.
- Replace broad `staff` access with explicit operational capabilities and request/assignment scope. Current frontend classifies all staff as senior managers, while staff request reads return the general queue.
- Ensure only authorized configuration managers can change role/workflow definitions; current Roles/Services collection mutations use generic authenticated access.
- Add actor, source stage, target stage, revision and reason to transition history. Preserve the existing activity view as a presentation layer.
- Validate stage and permissions under a transaction lock or optimistic version check, then commit the transition, history and notification together. Current engine reads state before its update transaction.
- Preserve workflow/form versions for submitted requests. Currently the engine consults the live service definition, so editing its ordered steps can change the interpretation of an active request.
- Strengthen typed form validation and file access checks. Current required-field validation mainly checks whether values are present.

Backend migrations currently put instances in the `dashboard` schema; Payload defines content and configuration. Extend that implemented separation. Some architecture prose describes a different target schema split and should not drive a schema move as part of this feature.

## Delivery phases

| Phase | Backend | Frontend | Completion evidence |
| --- | --- | --- | --- |
| 0 — Flow and contracts | Agree role/action matrix, stable stages, company/event identity, transition rules, score policy and DTOs; choose form/workflow snapshot approach | Map existing frames to routes; define missing role variants, tabs, modals and error states | Each diagram action has an owner, state change, API contract and view |
| 1 — Shared workflow foundation | Add capability and ownership/assignment checks, workflow snapshots, transition history, concurrency control and allowed-action responses; secure CMS definition mutations | Reuse dashboard shell; role-aware navigation, shared request detail/history and permitted-action controls | Each role can see and perform only its authorized work |
| 2 — Verification and event submission | Add verification lifecycle, completeness/eligibility checks, event reference, rejection reason/lock scope, edit/save/resubmit and notification links | Verification queue/detail, company banners, event registration gates, corrections and request tracking | Company can be approved, apply, receive corrections and resubmit the same request; rejected eligibility is enforced by API |
| 3 — Review-editor triage and assignment | Add triage actions, review rounds, exactly-three-distinct-reviewer validation, assignment status/due date and internal notifications | Triage action panel, assignment modal, editor queue and initial 0/3 progress view | Eligible request reaches three distinct reviewers; unauthorized or duplicate assignment is refused |
| 4 — Parallel evaluation and completion | Add evaluation drafts/final submission, agreed score validation, assignment scope, final-result locking and atomic 3/3 completion; preserve round history on replacement/re-review | Reviewer queue and score form, submitted state, editor progress/results view and route/return actions | 1/3 and 2/3 remain pending; 3/3 enables handoff exactly once; correction/re-review preserves previous results |
| 5 — Financial and investment handoff | Add financial form version/submission, protected attachments, dossier readiness and investment-to-secretariat routing | Company financial form, investment queue, dossier/results tab and refer/return controls | Investment editor receives a complete, authorized dossier and refers it to دبیرخانه |
| 6 — Final decision and full-flow verification | Record assessment source, result and publication; test role isolation, return/reject paths, retries and concurrent transitions against real persistence | Final-result editor, published company outcome and complete status/notification states; RTL/mobile/accessibility checks | All five roles complete the supplied workflow and each branch has a visible, consistent outcome |

Backend contracts precede dependent frontend integration in each phase. Existing Figma layouts can guide frontend work while the backend is developed, but a phase is complete only when its UI and API work together.

## Suggested data and API scope

Backend-owned records: verification cases; requests with event/service reference, definition versions and stage; submission revisions; transition history; review rounds; reviewer assignments; evaluations; financial submissions; final assessments. Reuse existing letters and activity records rather than inventing a second messaging system.

Conceptual API operations: verify/deny company; list role queue; read authorized request dossier; save/resubmit company answers; return/reject/referral actions; assign reviewers; save/submit evaluation; read review completion; request/save/submit financial information; refer to secretariat; record/publish final decision. Read responses should expose `allowedActions`, stage/version and review progress so the frontend does not calculate business permission rules.

CMS remains the owner of service/form/role/workflow definitions. Extend existing definitions with the step kinds and references this flow requires; a general visual workflow builder is outside this plan.

## Business decisions still needed

These are specification gaps, not reasons to postpone the shared foundation:

1. Does verification rejection permit corrected profile resubmission? Does admin check identity manually, or is an external verification service intended?
2. Does the green rejection lock registration for this event, this service, or the whole company? Who may reverse that lock?
3. Does “three scores” mean three finalized evaluations only, or is there also a passing threshold/aggregation rule? Figma suggests a 1–10 score range, but does not specify weights or a pass rule.
4. How are a declining, overdue or replaced reviewer and a corrected request handled? Is a new review round required, and who can see other reviewers' scores?
5. Does every completed event review need financial information, or only requests sent down an investment branch?
6. Is دبیرخانه represented by the purple admin role for the investment handoff? Who supplies the committee/scientific-team assessment, and who has authority to publish it?
7. Which financial fields/files are required, and which information is visible to the company versus internal staff?

Until resolved, use the image's three-reviewer requirement for assignment and completion, treat financial-form submission as a required handoff step, and leave pass thresholds and terminal-rejection scope explicit rather than inventing them.
