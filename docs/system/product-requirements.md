# Product requirements

Status: approved business scope with explicitly open inputs. Updated 2026-10-23. The implementation baseline was inspected on 2026-10-22.

## 1. Purpose and application units

The Innovation Factory manages company onboarding, event proposal reviews, investment-document assessment and exhibition participation. The Fund owns the system. A company is the account holder; a person signs in and acts as its representative.

An event contains technology categories, each containing subtopics. Each subtopic has an RFP and one named employer reviewer. A company can apply to several subtopics, but **each subtopic produces an independent application**, tracking code, review round and outcome.

An exhibition contains identified booths with fixed prices. A company may request several booths up to a configurable exhibition limit, but **each booth has its own application and payment receipt**. There is no combined application or shared payment for multiple booths in the agreed scope.

## 2. Seven operational roles

Each person has one operational role. Event teams are assigned separately for each event. Existing CMS content privilege `editor` must be preserved or migrated deliberately; it is not an eighth operational workflow role.

| Role | Persian name | Scope and responsibilities | Messaging |
| --- | --- | --- | --- |
| System Owner | صاحب سیستم | Manage personnel, roles, events, exhibitions, categories, subtopics and employer assignments; inspect requests/history; exceptionally replace an employer reviewer or reopen a rejected application with a recorded reason | Any user |
| Central Secretariat | دبیرخانه مرکزی | Review company verification, answer support/cooperation correspondence, monitor workflow, obtain supplementary documents, publish results, approve exhibition attendance, verify receipts and handle later cancellations | Company support and authorized case correspondence |
| Chief Reviewer | سردبیر داوری | Triage applications for assigned events; return/reject; assign three reviewers; inspect four evaluations; decide whether to proceed; inspect necessary company/reviewer profiles | Any user, without gaining access to unrelated cases by messaging them |
| Reviewer | داور | Read assigned applications and necessary company profiles; draft and finalize own evaluations; no access to other reviewers' evaluations or financial-stage documents | Only the responsible chief reviewer |
| Employer Reviewer | کارفرما | Same evaluation behavior as a reviewer; a named person attached to the subtopic occupies the fixed fourth-review position | Same restriction as reviewer |
| Investment Reviewer | کمیته سرمایه‌گذاری | This role is **one person**, not a voting committee. Read cases assigned to that person, permitted review results and financial documents; write a memo and send it to Secretariat | Authorized participants in that assigned case only |
| Company Representative | شرکت درخواست‌دهنده | Manage own company information; apply, correct permitted submissions, upload financial records, request booths, submit receipts, follow status and view published results | Secretariat support only |

The owner has broad administrative authority. This must not silently give ordinary event staff access to every event. Assignment scope applies to searches, exports, counts, populated relationships and downloads as well as individual pages.

## 3. Visibility and confidentiality

| Information | Permitted audience |
| --- | --- |
| Public company-directory presentation | Explicitly selected public fields, distinct from the private company dossier |
| Company verification dossier | Own representative, Secretariat and System Owner; necessary profile information may be disclosed to assigned case participants |
| Application/proposal | Owning company and authorized assigned participants; administrative oversight as above |
| Individual reviewer evaluation | Its author; responsible chief reviewer; authorized investment reviewer and administrative oversight where required. Other reviewers cannot inspect it |
| Financial-stage records, URLs and sensitive metadata | Owning company, assigned investment reviewer, Secretariat and System Owner only. Chief reviewers and ordinary/employer reviewers are excluded |
| Internal investment memo | Authorized internal participants; company access begins only to the separate result published by Secretariat |
| Published outcome | Owning company and authorized staff |
| Letters and attachments | Authorized sender/recipient and case scope; sending a message does not grant dossier or document access |

The company sees its own submission data, progress, correspondence and published result. It does not receive internal scores or private deliberation. A shared request-detail response must filter fields server-side; hiding an attachment component is insufficient.

## 4. Authentication and progressive onboarding

Authentication uses phone/email plus password. An OTP implementation exists in the backend but connecting it to screens is not part of this scope. Initial signup grants panel access, not participation eligibility. Person and company creation remain atomic; an existing company national ID must not leave an orphan user or permit a second claim.

### Stage 1: initial registration

| Field | Purpose |
| --- | --- |
| Full legal company name | Identify the registered company |
| Company national ID | Unique company identity |
| Activity domain | Describe business activity |
| Representative full name and position | Identify the acting person |
| Representative phone | Contact and phone-based login |
| Email | Contact and email-based login |
| Password | Chosen authentication method |

The exact technical validation dictionary must be documented under T03. Preserve the existing one-company/one-representative baseline unless a later explicit requirement changes it; multiple representatives were not requested.

### Stage 2: company completion and verification

Capture: company classification, including knowledge-based status; establishment in research/technology centers; articles of association; establishment and amendment notices; products/services and catalogues; insured employee count; key members; past projects and customers; company location; requested services; website; legal entity type; founding year; certificates and licenses.

Legal entity type and knowledge-based status are separate concepts. Identity information and registration documents are required. Fields that may legitimately be absent, such as website, center residency, project history or certificates, support an explicit **Not available / Does not have** answer rather than automatically disqualifying the company. Define each field's type, conditional requirement and absence semantics in T03.

Secretariat reviews a particular submitted version. A returned/rejected verification submission may be corrected and resubmitted on the same company. Account suspension is a separate owner action. Changing identity information or registration documents after approval requires renewed verification; previous applications keep their original approved snapshot. Legal operating status, completeness and verification status are independent attributes.

### Stage 3: event application

Select technology category and subtopic/need; accept the non-compete agreement and event rules; identify key members relevant to the application; download the correct RFP; upload the matching proposal. Record accepted text version, actor and timestamp. RFP is supplied by the administrator; proposal is supplied by the company.

### Stage 4: investment documents

- Financial statements for at least the last three years, or since establishment for a younger company.
- Current debts and credit facilities.
- Tax return/report and relevant insurance status.
- Contracts, purchase orders, memoranda of understanding and current commitments.
- Project financial estimate and use-of-funds plan.
- Available guarantee/collateral documents.
- Supplementary documents subsequently obtained through Secretariat correspondence.

Do not treat these document names as authorization for automatic lending decisions. The investment role writes a memo; no independent investment approve/reject/return command was requested.

## 5. Fixed forms and document policy

Application, review and financial forms are fixed across the system. A per-event form builder or general workflow designer is outside scope. Fixed forms still have versions so deployed schema changes cannot reinterpret historic answers or evaluations.

On 2026-10-23 the product owner supplied the ordinary-reviewer and employer-reviewer forms. The fixed forms share innovation (45%, maximum 64), commercialization/market (40%, maximum 51), and documentation (15%, maximum 39) sections. The supplied per-review formula is `0.45 × A + 0.40 × B + 0.15 × C`, with maximum **55.05**; do not silently normalize it to 100. Ordinary reviewers answer the qualitative questionnaire; the employer answers the separate risk checklist and concluding qualitative questions. See [the supplied rubric contract](review-rubric.md) for exact questions, bands and source row IDs.

Cross-review aggregation/ranking/ties, permitted fractional scores/rounding, and requiredness/answer types for some qualitative, evidence, signature and administrative fields remain open. The source requests a one-week turnaround; automatic expiry or an enforced deadline was not specified. Review completion is four finalized valid evaluations; advancement still requires the chief reviewer's explicit action. No automatic score threshold or top-five selection may be invented. File policy and approved agreement/rules text remain unavailable.

Q39 remains open for each document category's formats, per-file size and any count limit. The 12 MB PDF/Word example in Figma is not the approved new policy. Server-side validation must implement the eventual policy. Store category, owner, application/stage, version, uploader and authorized audience with each document. Public editorial media is not the private document store.

## 6. Confirmed event rules

1. Each subtopic has exactly one employer reviewer person, not a separate employer organization model.
2. The chief assigns three other distinct eligible reviewers; four distinct people occupy active positions.
3. An unfinished ordinary reviewer may be replaced by the responsible chief. Replacing the employer reviewer requires System Owner authority and a reason.
4. An individual draft evaluation does not count toward 4/4. Finalization validates required fields and locks that evaluation against normal editing.
5. At 4/4 the case becomes ready for a chief decision; it does not advance automatically.
6. A corrected proposal after review starts creates a new revision and new review round. Earlier evaluations remain in history but do not count toward the new round.
7. Returning for correction preserves the application identity. Terminal rejection prevents reapplying only to that subtopic in that event. The owner may reopen with history.
8. After the chief approves advancement, the company submits a complete financial package before investment review handoff.
9. The assigned investment person writes a memo and sends it to Secretariat. Secretariat can obtain extra files through case-linked support correspondence and make them available to that same authorized person.
10. Secretariat publishes the company-visible outcome. Internal notes and document requests must not publish themselves as the final result.

## 7. Confirmed exhibition rules

| Rule | Approved behavior |
| --- | --- |
| Selection | Company chooses a specific booth while submitting its application |
| Multiple booths | Allowed up to a per-exhibition company limit configured by the owner |
| Independence | One application, price, receipt, approval and cancellation history per booth |
| Reservation | Exclusive on application submission; no automatic expiry or timed release |
| Attendance approval | Separate Secretariat approval before payment becomes available |
| Price | Administrator-defined fixed final price per booth, displayed in toman; storage unit must be explicit and conversion tested |
| Payment | Upload receipt; Secretariat manually verifies it. No online gateway |
| Receipt correction | Preserve the reservation and previous receipt versions while the company corrects the receipt |
| Confirmation | Only verified payment confirms the booth; attendance approval or receipt upload alone does not |
| Cancellation before receipt | Company can cancel directly and release its booth |
| Cancellation after receipt | Request goes to Secretariat; release and any refund are handled manually with history |
| Presentation | Booth list with identifiers/specifications/prices/status and a guide map is enough |
| Excluded | Clickable interactive floor plan, ancillary service pricing, online payment and automatic reservation expiry |

Simultaneous requests cannot exceed the company's active/confirmed booth limit or reserve one booth twice. A rejected/cancelled booth application does not automatically change another booth application owned by the same company.

## 8. Cross-cutting requirements and exclusions

Use the existing panel architecture with role-specific actions and queues. Provide loading, empty, validation, unauthorized, saved/submitted and stale-state behavior. Persian RTL presentation, keyboard use and phone-size layouts are acceptance concerns. Notifications remain in-app under the current baseline; email expansion was not requested.

Preserve actor, reason, timestamp, revision and before/after state for significant actions. Deleting a displayed letter must not delete workflow history. Administrative changes, reviewer replacement, reopen, attendance decisions, receipt decisions and refunds need traceability.

Implementation starts with the access/file/persistence foundation, delivers the entire event path, then the independent exhibition path. No deployment date or staffing estimate is agreed. This specification does not authorize executing real production migrations, financial transactions or manual test scenarios against live company data.
