# Backend design and implementation contracts

**Proposed target design**, based on approved requirements. This is not a description of completed routes, schema migrations or a final OpenAPI contract. Technical owners should settle concrete names/types before implementation without changing the business rules.

## 1. Preserve the existing boundaries

The monorepo has `apps/frontend` (Next.js + Payload), `apps/backend` (Express) and `packages/cms-core` (shared CMS domain). PostgreSQL has `cms.*` definitions/identity and `dashboard.*` operational instances. Keep that split rather than moving tables to match obsolete aspirational prose.

Phase 0 correction, 2026-10-23: fresh [migration/config inspection](migration-inventory.md) establishes that current CMS tables are in `public`, not `cms`; `cms` in this proposed design names the ownership boundary. Preserve the existing `public`/`dashboard` storage split. This specification does not authorize a schema move.

CMS owns users, companies, content and event/exhibition definitions. Extend it with event teams, technology categories/subtopics and versioned RFP definitions. The backend owns applications, revisions, assignments, evaluations, operational transitions, correspondence, reservations and payment processing records. Decide one authoritative location for verification state and expose it consistently; do not maintain independently editable approval flags in both services.

The backend reads CMS definitions through Payload's API. Operations across that HTTP boundary are not automatically one SQL transaction. Use a documented ownership boundary and reliable event/outbox or equivalent coordination where needed; do not promise cross-service atomicity just because both schemas use PostgreSQL.

## 2. Proposed operational records

| Record | Important references and invariants |
| --- | --- |
| Company verification submission | Company, submitted profile/document revision, status, reviewer, timestamps, decision reason; immutable submitted snapshot |
| Event application | Company, acting user, event, subtopic, tracking code, current state/revision; no user-only ownership |
| Application revision | Fixed form version/answers, proposal documents, RFP version, approved company snapshot, agreement/rules version and acceptance actor/time |
| Application eligibility lock | Company + event + subtopic; terminal rejection and explicit owner reopen history |
| Review round | Application revision, responsible chief, current completion state |
| Reviewer assignment | Round, person, slot kind (employer/ordinary), active state, replaced-by and replacement reason; four distinct active people |
| Evaluation | Assignment, fixed rubric version, answers/calculated scores, draft/final state, submitted timestamp; normal editing ends at finalization |
| Financial submission | Application, fixed financial form version, category/document versions, completeness and submitted timestamp |
| Investment assignment/memo | Application, assigned investment person, internal memo versions and handoff time; no invented voting system |
| Published outcome | Application, company-visible text, publisher/time, internal source memo reference; independent from private memo |
| Correspondence and attachments | Sender/recipient, related case, document category and confidentiality; supplementary financial replies remain private |
| Transition history | Aggregate ID, actor, action, reason, old/new state, version and time; append-only under normal operations |
| Notification delivery work | Committed business event, recipient, deduplication key, attempts and delivery status |
| Booth application | Company, exhibition, exactly one booth, fixed price snapshot and explicit currency/unit, attendance/payment/cancellation state |
| Reservation | Booth application and booth, active/confirmed/released state; at most one active reservation per booth; no expiry job |
| Receipt version | Exactly one booth application, document, declared payment details and reviewer/decision; correction preserves earlier versions |
| Manual cancellation/refund record | Application, authorized actor, reason, amounts/unit, evidence/reference and inventory release history |

Unique constraints, guarded updates and explicit transactions should enforce invariants rather than relying on screen validation. Allocate tracking codes through an appropriate sequence/allocator, not a count of existing rows.

## 3. Proposed API operation families

Use explicit domain actions, not arbitrary client-supplied target statuses. Names below illustrate the contract surface; implementation routes may differ.

| Family | Operations and required guards |
| --- | --- |
| Identity and personnel | Atomic signup; existing password login/logout; owner-managed personnel and single operational role; deliberate migration of existing roles/content editors |
| Company verification | Read/update own profile; submit revision; Secretariat queue; approve/return with reason; re-verification on identity change |
| Event definitions | Owner creates event/team/category/subtopic; associates named employer and RFP version; validates all relationships |
| Applications | Create/save/submit owned subtopic application; read authorized dossier/history; return/reject/reopen with actor-specific guards |
| Reviews | Start round; assign four slots; read own assignment; save/finalize own evaluation; replace unfinished reviewer; owner-only exceptional employer change; read authorized progress |
| Chief decisions | After 4/4, explicitly advance, reject or request correction; corrected proposal creates a new round |
| Investment | Invite financial submission; save/submit own package; scoped assignment/dossier; save/send internal memo; Secretariat obtains extra documents and publishes outcome |
| Documents | Upload and associate by authorized category/owner/case; validate policy; authorize downloads and metadata independently of the shared case page |
| Messaging | Resolve permitted recipients server-side; send/read case-linked letters and attachments; company support; reviewer-to-chief and committee-case restrictions |
| Exhibition | Configure booth/price/limit; reserve one booth/application; attendance approve/reject; independent price/receipt; receipt return/confirm; cancellation request/handling |
| Read models | Role-specific queues, counts, history and allowed actions use the same authorization scope as write operations |

Responses should identify current revision/version, state, allowed actions, missing required inputs and review progress where relevant. Never send confidential fields and expect the frontend to hide them.

## 4. Authorization enforcement

Compute permissions from authenticated identity, operational role, event responsibility, active assignment, ownership, document category and current state. The existing dashboard proxy forwards user identity/roles using a shared secret; test both that proxy and backend guards. Do not trust a browser-supplied company ID, role, recipient, score total or target state.

Payload's Local API requires deliberate access enforcement when acting for a user. Secure direct CMS reads/writes, field updates, relationships and populated responses as well as backend endpoints. Broad service-account access must not turn a user request into a privileged read.

On reassignment or role removal, effective download and case access must be revoked. An already rendered page, old URL, cached count or message attachment must not bypass the new scope. Public company-directory fields need a separate whitelist.

## 5. Concurrency and failure handling

For an event transition, lock or version-guard the aggregate, validate current actor/state/revision, write the business change and history, and enqueue deduplicated notification work. For evaluation completion, count valid finalized evaluations only for the current revision and active slots. Competing fourth submissions must produce one completion event.

For a booth request, lock the relevant booth and company/exhibition capacity context or use an equivalent serializable constraint strategy. Check both exclusive availability and the company limit in the same consistent operation. Independent applications do not imply independent capacity checks. Receipt confirmation and inventory confirmation must not be double-applied. A rejected receipt preserves the reservation; only a separate attendance rejection or authorized cancellation releases it.

Persist uploaded-file metadata safely, associate documents only after validation and define cleanup/retry handling for failed associations. A failed upload cannot satisfy a required document. Notification retries must not rerun business transitions.

## 6. Versioning and migration

Snapshot company verification, RFP, agreements, fixed form versions and application revisions. Do not read current definitions to reinterpret historic submissions. Corrected proposals create new review rounds rather than rewriting earlier scores.

Inventory existing data and rehearse migrations on a disposable copy. Earlier role/company migrations assumed greenfield data and removed old workflow tables. Map existing users/companies/requests explicitly and preserve editorial privileges deliberately. Review backup/restore across database and private files together. Do not run destructive fixture suites or migration rehearsals on shared/live databases.

## 7. Verification strategy

Automated tests cover atomicity, access, validation, versioning and retries. Human acceptance covers usable flows, role navigation, understandable messages, real file downloads, persistence after fresh sessions, correspondence and business outcomes. A two-browser race is a useful human smoke test, not proof of database isolation; retain T44 and database integration tests.

See [manual acceptance tests](manual-acceptance-tests.md) and [delivery plan](../event-review-system-plan.md). No human gate has passed merely because it has been written or added to the board.
