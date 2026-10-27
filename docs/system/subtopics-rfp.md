# Subtopics and private RFP versions (T17 / T18)

Backend definitions extend the existing T16 `dashboard.events` authority. Public
Payload `events` and editorial `categories` remain separate content collections;
no duplicate CMS write path or public media relationship is introduced. Current
person/company eligibility comes from the existing CMS-backed stores. All routes
use the authenticated dashboard proxy and reload current role/active status.

## HTTP contract

| Endpoint | Input/result |
| --- | --- |
| `POST /admin/events/:eventId/categories` | Owner only; `{ title }`; returns `category` |
| `GET /admin/events/:eventId/categories` | Owner category list |
| `POST /admin/events/:eventId/subtopics` | Owner only; `{ title, categoryId, employerId }`; returns `subtopic` |
| `GET /admin/events/:eventId/subtopics` | Owner subtopic list |
| `GET /events/:eventId/subtopics` | Current company representative, Owner or Secretariat; category/subtopic names, employer person ID and current RFP version ID |
| `POST /admin/events/:eventId/subtopics/:subtopicId/rfp` | Owner only; multipart `files` (one or more), `expectedVersionId` (empty string for initial publication), nonempty `reason`; atomically publishes complete new version |
| `GET /events/:eventId/subtopics/:subtopicId/rfp` | Current RFP safe metadata and ordered `files` |
| `GET /events/:eventId/subtopics/:subtopicId/rfp/:versionId/files/:fileId` | Current company reads only current matching version; Owner/Secretariat can inspect historical matching versions |
| `GET /requests/:requestId/rfp` | Request-scoped pinned version metadata |
| `GET /requests/:requestId/rfp/files/:fileId` | Request-scoped pinned version bytes |

Each subtopic belongs to one event/category pair and exactly one current eligible
`employer-reviewer` person. Cross-event categories fail validation; composite SQL
foreign keys enforce relationships independently. Employer is not a company or
new organization entity. New definitions have no generic update/delete API.

Every publish supplies the complete file set. Multiple PDF/Word representations
share one immutable version; no numerical file-count cap. Reuse T10 validation
and private storage: `.pdf`, `.doc`, `.docx`, matching MIME/magic, maximum
10,000,000 bytes **per file**, inclusive. No private storage key/public URL in
responses. Download responses are attachments, private/no-store, nosniff and
sandboxed. Missing bytes return `410 document_unavailable`; unauthorized or
mismatched context returns `404`. Files are not served by generic `/documents`;
that API continues rejecting RFP uploads. Company proposal uploads remain
`category=proposal` on the existing request document API.

## Request binding and history

Existing `POST /requests` accepts optional top-level `eventId`, `subtopicId` and
`rfpVersionId` **together**. It validates current matching RFP under a subtopic
share lock, then inserts request and immutable `dashboard.request_rfps` context in
one transaction. Invalid/missing relationships roll back; malformed partial
context returns `400 invalid_rfp_context`, changed/mismatched context returns
`409 stale_rfp`. Generic legacy service requests remain unchanged; event
application uniqueness, eligibility/consent/forms and corrected revisions remain
T19/T20, not implied by this T18 binding extension.

Submission locks and authorizes current company-owned request, then share-locks
its subtopic before checking current RFP. Replacement takes an exclusive lock on
that same subtopic. A draft with stale RFP returns `409 stale_rfp`; create a fresh
draft against the new RFP (draft refresh UI/workflow belongs to T19/T20). Submitted
request context never changes when administrator publishes another RFP. Repeated
submission remains `409 already_submitted`, preserves original tracking/history,
and never repins. Request RFP read/download uses existing current company or
active role-matching case assignment scope. Old public discovery URLs do not
grant historical access; authorized request route supplies historical bytes.

Versions, file metadata and request context reject SQL UPDATE. No HTTP mutation
or deletion of published files is exposed. Request references prevent deleting
referenced subtopic/version definitions. Additive migrations `1780511400014`
through `1780511400016` create no inferred mapping for legacy requests.

## Verification and deployment limits

Guarded synthetic integration covers persistence across app instances, cross-event
and ineligible assignments, distinguishable downloads, three files per version,
size/type rejection without publication, concurrent stale publishers, immutable
metadata, submitted pinning and stale drafts, company/assignment revocation.
Unit tests cover Express 4 rejected promises, rollback and failed-file cleanup.
Ordered migration rehearsal starts with current staging journal ending in
`1780511400013_company_owned_requests`, uses ordinary startup ordering, and
restores additive migrations after rollback. Remote-ref inventory includes the
historical unpublished `1780511400010`; no existing file or journal is renamed.

No real-data migration, production/staging deployment, FE10 completion, human
UAT09 execution, approved consent text or T19/T20 completion is claimed.
