# Fixed form and private document contracts (T03 / #17)

Status: Phase 0 specification, 2026-10-23. This document defines the fixed form vocabulary needed by Product, FE, BE and CMS. Business requirements marked **approved** come from [product requirements](product-requirements.md) and [workflows](workflows.md). Field keys, DTO envelopes and validation mechanics marked **proposed** are implementation contracts to reconcile before coding; they are not assertions about existing APIs. No event-specific form builder is in scope. A draft may be incomplete; the **submit** operation applies the requirements below.

## Shared field and submission semantics

| Term | Contract |
| --- | --- |
| Required (R) | A meaningful value or completed private document association is necessary at submit; whitespace, an empty array and a pending/failed upload do not satisfy it. |
| Conditional (C) | Required only when the named predicate is true. The backend evaluates the predicate from authoritative data, not a browser flag. |
| Optional (O) | May be omitted without changing eligibility. If supplied, type and policy validation still apply. |
| Absence answer (A) | A deliberate `not_available` / `does_not_have` response with a reason when the field describes something that may legitimately not exist. This differs from unanswered and from an empty string. It is available only on the rows that explicitly allow it. Which reasons require human follow-up is a Product/Secretariat decision, not an automatic rejection rule. |
| Document reference | A private, server-issued ID associated with an owner, category and context after upload validation. Filename, URL, MIME claim or browser `File` is not a submitted document. |
| Version | Immutable identifier of the exact form definition/policy/text used for a submitted record. Drafts may migrate deliberately; a submitted revision does not silently adopt later definitions. |

**Proposed envelope:** each form read returns `{ formKind, formVersion, recordId, revision, state, values, missingFields, allowedActions, documentPolicyVersion }`. A submit sends the expected record revision and validated document IDs; the server responds with the new authoritative revision/state and field-keyed errors. Use stable machine keys below as a starting contract. IDs, errors, date serialization and routes require BE/FE agreement. The server derives company, actor, assignment and permissions from the session. The client never supplies an effective role, score total, approved company snapshot or target workflow state.

Normalize Persian/Arabic digits for numeric identifiers at the API boundary while retaining their string type and leading zeroes. Trim textual inputs; do not treat the display label as the storage key. The FE can show immediate errors and the correct conditional fields, but BE/CMS validates types, uniqueness, policy, actor, current revision and stage again on save/submit. Validation errors identify stable keys, so RTL labels can change without breaking stored answers. Exact length bounds, allowed enum values and date wire format are technical contract decisions unless stated below; do not hard-code arbitrary limits as product rules.

## Stage 1 — atomic person and company signup

Approved: one representative, one company; signup grants panel access only. Phone **or** email plus password may be used at login, so both contact values are collected. Proposed keys map to the current `users/self-signup` body where noted.

| Proposed key | Type | Submit | Meaning / validation | Current mapping |
| --- | --- | --- | --- | --- |
| `companyName` | nonempty text | R | Full legal company name. | `companies.name` |
| `companyNationalId` | normalized digit string | R | Unique company national ID; preserve leading zeroes; duplicate is a recoverable conflict. Existing UI expects 11 digits; confirm that technical rule with identity owner before making it a permanent domain invariant. | `companies.nationalId` |
| `activityDomain` | text or controlled choice, final vocabulary open | R | Business activity domain. Do not infer from legal form or knowledge status. | **Missing** |
| `representativeName` | nonempty text | R | Acting person's full name. | existing body `name` → `users.name` |
| `representativePosition` | nonempty text | R | Position in company. | existing body `position` → `users.position` |
| `representativePhone` | normalized phone string | R | Contact and phone login; uniqueness and valid phone syntax checked server-side. | existing body `phone` → `users.phone`/username |
| `representativeEmail` | email string | R | Contact and email login; normalize case and validate server-side. | existing body `email` → `users.email` |
| `password` | secret string | R | Meets agreed authentication policy; never returned or snapshotted in form answers. | `users` auth password |
| `passwordConfirmation` | client-only secret string | R in UI | Must match before request; never persisted or sent as a profile field. | current UI only |

`companyRegistrationNumber`, `companyType`, province/city, establishment date, operating `companyStatus` and economic code are currently requested during signup. The approved progressive flow places full identity/completion in Stage 2; migration/UX must decide whether to keep these as optional early answers or move them to Stage 2, without making them hidden Stage 1 eligibility gates. A current registration submission must atomically create person and company; a duplicate national ID must not leave an orphan person or allow a second claim. No user-supplied role or CMS privilege is accepted.

## Stage 2 — company completion and verification

Submit creates an immutable dossier revision for Secretariat review. **Approved:** identity information and registration documents are required. The other `R`, `R/A` and `C/A` markings below are **proposed completion rules for Product/Secretariat sign-off**, not approved eligibility gates. In particular, requiring a value or absence answer for employee count, requested services, catalogues or key members must not silently become a reason to reject verification. `R/A` proposes a value **or** an explicit absence answer for Secretariat assessment; it is not an automatic waiver. `R` document categories cannot use absence. Field grouping and keys are also proposed.

| Proposed key | Type | Submit | Meaning / condition and absence |
| --- | --- | --- | --- |
| `legalName`, `nationalId` | text, digit string | R | Identity; prefilled from Stage 1. Changed identity after approval triggers renewed verification. |
| `registrationNumber`, `legalEntityType` | text, legal-form enum | R | Registration identity. Legal form excludes knowledge-based status. Final legal-form option list needs product/legal validation. |
| `foundingYear` | year integer or normalized year string | R | Establishment year; calendar and wire convention must be explicit. |
| `operatingStatus` | status enum | R | Legal operating status, independent of dossier completeness and verification decision. Option vocabulary remains to be approved. |
| `classification` | controlled choice | R | Company classification; taxonomy open. |
| `knowledgeBasedStatus` | independent choice | R | Knowledge-based status is separate from `legalEntityType`; exact statuses/evidence policy open. |
| `centerEstablishment` | structured center/residency text or A | R/A | Research/technology-center establishment or residency; `does_not_have` is valid. |
| `activityDomain` | text or controlled choice | R | Inherited from signup and editable under identity/reverification policy. |
| `productsServices` | nonempty list of text entries | R | Products and services; keep structured entries apart from catalogue files. |
| `catalogues` | private document reference list or A | R/A | Supporting product/service catalogues if available. |
| `insuredEmployeeCount` | nonnegative integer or A | R/A | Count as reported by company; if genuinely unavailable, an explicit answer and reason, subject to Secretariat review. |
| `keyMembers` | list of `{ name, role, relation? }` | R | Key people in company; person names and positions required per listed member. Minimum roster beyond representative is unresolved; do not invent one. |
| `pastProjectsCustomers` | list of `{ project, customer?, summary? }` or A | R/A | `does_not_have` covers no history; empty list alone is unanswered. |
| `locations` | list of structured addresses | R | At least one company location with address text; province, city, postal code and address shape to be settled with existing CMS array. |
| `requestedServices` | list of controlled service IDs or A | R/A | User's expressed interest; no requested service is a legitimate explicit answer, not verification failure. |
| `website` | URL or A | R/A | `does_not_have` permitted. Do not require a placeholder URL. |
| `certificatesLicenses` | list of metadata + private document refs or A | R/A | `does_not_have` permitted; certificate taxonomy/evidence requirements open. |
| `articlesOfAssociation` | private document refs | R | Registration document category. |
| `establishmentNotices` | private document refs | R | Establishment notice category. |
| `amendmentNotices` | private document refs or A | C/A | If amendments exist, provide notices; if none, record `does_not_have`. Whether an additional legal absence declaration is needed remains open. |

Before submit, the UI shows a per-field missing checklist and lets the company save a partial draft. A returned or rejected verification submission is corrected on the same company; resubmission creates a new immutable revision. Secretariat's approve/return decision names the submitted revision, actor, time and reason (where applicable). An approved company identity or registration-document edit starts re-verification; earlier event applications retain their approved company snapshot. Suspension is a separate owner action. Do not collapse `operatingStatus`, `verificationState` and form completeness into one status.

## Stage 3 — independent event application and consent

One application is bound to one event **subtopic**. Its category is derived from the subtopic, not independently trusted. A company may have several applications to distinct subtopics. The exact agreement and event-rules text has **not** been approved; acceptance UI and UAT requiring it remain blocked until Product supplies published versions.

| Proposed key | Type | Submit | Meaning / validation |
| --- | --- | --- | --- |
| `eventId`, `subtopicId` | server-resolved IDs | R | IDs belong to same open event; subtopic has its RFP and named employer reviewer. Each company has one application/tracking code for its selected event subtopic. |
| `companySnapshotId` | server-generated immutable reference | R (server) | Approved company revision at submission. Never chosen by client. |
| `applicationTeam` | list of member references or `{ name, role, relation }` | R | Key members relevant to this proposal; final minimum beyond a nonempty team is unresolved. Preserve submitted names/roles in revision. |
| `rfpVersionId` | server-provided version ID | R | Exact downloadable RFP for the selected subtopic; submit checks it is still valid or gives a stale-version response. |
| `proposalDocuments` | private document reference list | R | Matching proposal category linked to this application revision, not another subtopic. File count/format/size open under Q39. |
| `nonCompeteAcceptance` | `{ textVersionId, accepted: true }` | R | Actual checked acceptance; server records actor/time and immutable text version. Never prechecked. |
| `eventRulesAcceptance` | `{ textVersionId, accepted: true }` | R | Same treatment, separately versioned. |
| `formVersion` | version ID | R (server) | Fixed application schema used for answers, even when the schema later changes. |

The proposed application form has no extra free-form question until Product supplies one. A proposal correction after reviews begin makes a new application revision and review round; the earlier documents/evaluations remain history and do not count in the current 4/4. A failed final submit must leave a resumable draft ID rather than causing another application on retry.

## Fixed reviewer evaluation — two supplied form variants

Four **distinct** active people evaluate the same current round: three assigned ordinary reviewers and the subtopic's named employer reviewer. Each can draft and finalize only their own evaluation. The user supplied the two fixed forms on 2026-10-23; [review-rubric.md](review-rubric.md) now records their shared A/B/C scoring rows, the ordinary 13 yes/no questions, the employer risk checklist, recommendation, identity and sensitive administrative fields. The confirmed formula is `0.45 × A + 0.40 × B + 0.15 × C`, with raw maxima 64, 51 and 39 and weighted maximum **55.05**. It must not be normalized to 100 or used for automatic advancement. Remaining subitem, requiredness, aggregation and rounding questions are listed in that document.

| Proposed key | Type | Submit/finalize | Meaning |
| --- | --- | --- | --- |
| `reviewRoundId`, `assignmentId` | server-resolved IDs | R | Active assignment for the exact application/proposal revision; employer slot is marked separately. |
| `rubricVersionId`, `formVariant` | immutable version ID; `ordinary` or `employer` | R | Exact supplied fixed form and version used for the active slot; versioned implementation must settle remaining ambiguities. |
| `answers` | keyed typed score/qualitative map | R per finalized validation policy | A/B/C score rows and variant-specific qualitative items from [review-rubric.md](review-rubric.md); drafts may be incomplete. |
| `rowComments` | optional keyed text map | O | Source says comments may be added if needed; keep them outside arithmetic. |
| `calculatedScores` | server result | R (server) | Server calculates section totals and weighted total, validates score ranges/tier consistency and rejects tampered client totals. |
| `evaluationState` | `draft` / `finalized` | R (server) | Finalization checks current assignment/rubric and locks ordinary editing. |

Only finalized valid evaluations of current active slots count toward 4/4. The chief sees the authorized summary and must explicitly decide advancement; the count is not an automatic threshold. Other reviewers' individual evaluations and financial files are absent from a reviewer response, rather than merely hidden by the page.

## Stage 4 — financial package and investment follow-up

Only explicit chief advancement invites the owning company to submit this fixed package. Read/write audience: owning company, assigned investment reviewer, Secretariat and System Owner. Chief and ordinary/employer reviewers receive no financial file references, URLs or sensitive metadata. The checklist is server-derived for the specific company and application; supplementary requests create case-linked correspondence, not a new public result.

| Proposed key / category | Type | Submit | Meaning / condition and absence |
| --- | --- | --- | --- |
| `financialStatements` | year-indexed private refs | R | At least the last three years, or every year since establishment if younger. Backend determines expected period from approved founding data; missing years require explicit resolution, not silent shortening. Exact fiscal-year/calendar interpretation is open. |
| `currentDebtFacilities` | structured declaration + private refs or A | R/A | Current debts and credit facilities; `does_not_have` if none. Evidence requirement for a zero declaration is open. |
| `taxReturnReport` | private refs or A | R/A | Tax return/report; absence reason if legally unavailable, with Secretariat review. |
| `insuranceStatus` | structured status + private refs or A | R/A | Relevant insurance status; explicit absence reason if no applicable record. |
| `contractsOrdersMousCommitments` | structured list + private refs or A | R/A | Contracts, purchase orders, MOUs and current commitments; `does_not_have` if none. |
| `projectFinancialEstimate` | private refs | R | Project estimate for this application. |
| `useOfFundsPlan` | private refs | R | Planned use of requested funds. |
| `guaranteeCollateral` | private refs or A | R/A | Available guarantees/collateral; `does_not_have` permitted. |
| `supplementaryDocuments` | case/request-linked private refs | C | Only when Secretariat requests them; requested category, due context and response revision remain linked to same application. |
| `packageVersion`, `submissionRevision` | server version IDs | R (server) | Freeze checklist, declarations and accepted file versions at submit. |

`R/A` is a proposed non-fabricated absence representation for potentially inapplicable records, **not** an approved waiver or automatic investment decision. Product/Secretariat must decide which categories permit formal absence and whether an evidence declaration is required before T30 acceptance can assert package completeness. An incomplete or failed upload does not hand off to investment review. The one assigned investment person writes/sends an internal memo; Secretariat separately publishes company-visible result text.

## Exhibition receipt and correspondence inputs

The booth catalogue, application, attendance decision and price are separate backend records. A receipt belongs to exactly **one booth application** after Secretariat approves attendance; its correction keeps earlier receipt versions and the reservation. No online gateway or shared payment is in scope.

| Proposed key | Type | Submit | Meaning |
| --- | --- | --- | --- |
| `boothApplicationId` | server-resolved ID | R | Resolves one exhibition/booth/company and the fixed price snapshot. |
| `receiptDocument` | private document reference | R | Proof for that application; Q39 policy still open. |
| `declaredPayment` | amount + unit + payment reference/date, if requested | C | Exact declaration fields are unresolved; server compares to its price snapshot, never trusts client price. Display is in toman; storage/conversion unit must be explicit. |
| `receiptVersion` | server version ID | R (server) | A correction adds a version; prior decisions and files remain history. |

Correspondence uses `threadId`, optional `caseId`, authorized `recipientId`, nonempty `subject` and `body`, and a list of private attachment references where allowed. Proposed `messageKind` distinguishes general support, case discussion, supplementary financial request/reply and outcome publication; publication remains a separate explicit Secretariat action. Recipient and case linkage are validated server-side. Message delivery does not grant dossier access. A supplementary financial attachment retains financial confidentiality even inside a letter. Letter deletion from a display must not erase audit/history.

## Category-specific private document policy (Q39 open)

Product has **not supplied** accepted formats, maximum per-file size or count limits for these categories. The Figma 12 MB PDF/Word example must not be copied into the policy. Each row needs a versioned decision and server validation before its corresponding submission gate can be accepted. A generic fallback is not an approved substitute.

| Category / context | Submit expectation | Formats | Per-file maximum | Count limit | Policy owner/input still needed |
| --- | --- | --- | --- | --- | --- |
| RFP, event/subtopic, owner upload | One versioned RFP available for download per active subtopic | Open | Open | Open | Product/owner approves publisher and replacement rules |
| Proposal, event application revision | Required matching private proposal | Open | Open | Open | Q39 |
| Articles of association | Required verification evidence | Open | Open | Open | Q39 |
| Establishment notices | Required verification evidence | Open | Open | Open | Q39 |
| Amendment notices | Conditional verification evidence | Open | Open | Open | Q39 and absence declaration |
| Catalogues | If available | Open | Open | Open | Q39 |
| Certificates/licenses | If available | Open | Open | Open | Q39 |
| Financial statements | Required applicable years | Open | Open | Open | Q39 and fiscal-period convention |
| Debt/facility evidence | Conditional to declaration | Open | Open | Open | Q39 and absence/evidence rule |
| Tax and insurance records | Conditional to applicability | Open | Open | Open | Q39 and absence/evidence rule |
| Contracts/orders/MOUs/commitments | If present | Open | Open | Open | Q39 |
| Project estimate/use-of-funds | Required package evidence | Open | Open | Open | Q39 |
| Guarantee/collateral | If available | Open | Open | Open | Q39 |
| Supplementary case files | If requested | Open | Open | Open | Q39 and request-specific category |
| Booth payment receipt | Required after attendance approval | Open | Open | Open | Q39 |
| General/case correspondence attachment | Conditional to message | Open | Open | Open | Q39; financial subtype remains restricted |

For every accepted file store category, owner company, uploader, exact case/stage, associated record/revision, document-policy version, safe metadata and authorized audience. Validate server-side before associating it; authorize metadata and download at use time after reassignment or role removal. Keep private files out of Payload's public editorial `media` collection and out of public URLs. Replacing a file makes a new association/version; preserve the historic submitted reference. The UI displays category-specific policy returned by the server and distinguishes pending, failed, accepted and rejected upload states.

## Existing implementation mapping and required contracts

This table records source shapes inspected on 2026-10-23; it is not a runtime acceptance claim.

| Existing source | Actual shape / behavior | Target contract gap |
| --- | --- | --- |
| `apps/frontend/src/components/auth/register-page.tsx`; `packages/cms-core/src/auth/self-signup.ts` | UI posts `company*`, `name`, `position`, `phone`, `email`, `password`; server only requires name/national ID/phone/password, while UI requires extra company fields. | Add approved activity domain and enforce the agreed Stage 1 dictionary on server; reconcile early Stage 2 fields. Keep atomic person/company creation and duplicate recovery. |
| `packages/cms-core/src/collections/Companies.ts` | `type` options mix legal forms with `دانش‌بنیان`/`استارتاپ`; `status` is free text; executives/addresses exist as arrays; collection read is `anyone`. | Separate legal form, classification, knowledge status, operating status and private verification dossier; restrict private fields/relationships independently of public directory projection. |
| `apps/frontend/src/utilities/dashboard-api.ts` | `ProfileDto` has basic company/contact/executive/address only. `RequestDto.answers` is `Record<string, unknown>` with five broad statuses. `LetterDto.attachments` is `unknown[]`, then mapper returns `[]`. | Typed form/revision/verification, application/booth discriminator, redacted role DTOs, classified attachment refs and explicit missing/allowed actions. |
| `apps/frontend/src/components/dashboard/new-request-form.tsx`; `packages/cms-core/src/collections/Services.ts` | Generic service form renders string answers and immediately creates then submits; CMS service can point at a general `forms` relationship. | Fixed application form with subtopic/RFP/consents/proposal, resumable draft ID and version; do not use per-service form builder as event workflow authority. |
| `apps/frontend/src/components/dashboard/admin-request-evaluation.tsx` | Text note plus generic forward/reject action; no implementation of the now-supplied fixed forms, assignment or round shape. | Implement typed own evaluation from [review-rubric.md](review-rubric.md) after the listed interpretation decisions, and a separate chief decision with current-round 4/4. |
| `apps/frontend/src/components/dashboard/profile/resume-profile-view.tsx` | Static empty panel. | Persistent projects/customers, key people, catalogues and evidence with explicit absence and verification status. |
| `apps/frontend/src/components/dashboard/new-letter-form.tsx`; `packages/cms-core/src/collections/Media.ts` | Letter composer sends text without file refs; media collection is publicly readable and stores editorial images/video. | Private category-specific upload, authorized correspondence attachments and financial subtype redaction; no fallback to editorial media. |

## Version, validation and readiness by task

Submitted verification, application, evaluation, financial package and receipt revisions each capture their own fixed form version and exact accepted file versions. Application revisions also capture the approved company snapshot, RFP and the separately published consent-text versions with actor/time. Corrections append revisions. UI can render old submissions from their frozen schema/text and must label a stale draft; backend validates current form and record revision on each mutation. A schema change needs an explicit migration or a new version, never reinterpretation of historic values. Audit trails preserve actor, timestamp, reason and before/after state for consequential decisions.

| Task / dependency | Ready now from this document | Still needed before implementation or acceptance |
| --- | --- | --- |
| T01 / #15 scope | Approved workflow and open inputs are recorded in requirements/workflows; this dictionary is consistent with them. The user supplied reviewer forms on 2026-10-23. | Product decision owners should record Q39, agreement/rules approval and remaining rubric interpretation decisions. |
| T02 / #16 permissions | Document-category audiences and filtered DTO obligations are specified here and in backend design. | Final seven-role matrix/access tests across CMS, API, files, search, counts and populated records; technical ownership with BE/CMS. |
| T03 / #17 fixed forms | Stage 1–4, the supplied two review forms and scoring formula in [review-rubric.md](review-rubric.md), receipt/correspondence and absence/version semantics can guide schema/API design. | Remaining rubric subitem/qualitative/aggregation/rounding decisions; category-specific Q39 values; approved non-compete and event-rules text; tax/insurance/debt absence rules, exact enum/date/period conventions and final API/error names. T03 is **partially ready by stage**, not globally complete. |
| T04 / #18 isolated environment | No data mutation or migration is required by this contract. | QA/Data establish isolated DB/files, migration inventory and recovery rehearsal before persistence/destructive tests. |
| T11 / #25 signup | Stage 1 field list and atomicity are ready for FE/BE implementation. | Agree technical identity format/password policy and migrate current UI/server field mismatch. Remaining review-form decisions do not block signup. |
| T13–T15 verification | Dossier structure, explicit absence and revisions are ready for design. | Resolve technical enums/conditional evidence and private file policy before final document-upload acceptance. |
| T20 / #36 application | One-subtopic form, proposal and consent recording are defined. | Approved agreement/rules text and proposal Q39 policy before full submit/UAT; RFP policy before owner upload. |
| T24–T25 / #40–41 evaluation | Assignment/round/finalization invariants and both source forms' rows, score ranges, weights and formula are defined in [review-rubric.md](review-rubric.md). | Resolve A3 evidence/subitem scoring, qualitative/checklist finalization requirements, precision and aggregation before full acceptance. No score or pass threshold is inferred from Figma. |
| T30 / #46 financial package | Category checklist and three-year/younger-company rule are defined. | Financial Q39 limits and absence/period decisions before complete-package acceptance. |
| Receipt/correspondence slices | Independent receipt version and private attachment classification are defined. | Receipt/correspondence Q39 policy and exact declared-payment fields before final gate. |

Source references: [requirements](product-requirements.md), [workflows](workflows.md), [backend design](backend-design.md), [frontend design](frontend-design.md), [frontend audit](frontend-audit.md), [delivery plan](../event-review-system-plan.md). This is a documentation contract, not proof of implemented validation or passed human tests.
