# Private document storage and access (T10 / #24)

Status: implemented 2026-10-24 for existing request and company parents. The
approved policy is [document-policy.json](document-policy.json); this document
records the runtime contract and the explicit future integration boundary.

## Approved policy enforced by the server

- PDF (`.pdf`, `application/pdf`), Word `.doc` (`application/msword`) and Word
  `.docx` (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`).
- Maximum **10,000,000 bytes per file**, boundary inclusive.
- Multiple files may coexist on one logical field. There is **no numerical file
  count cap**.
- Images are not accepted.
- Every uploaded file is validated on the server for category, extension,
  declared MIME type, magic bytes (PDF/OLE/ZIP) and size. Browser checks are only
  fast feedback.

## Storage boundary

Private bytes live under `PRIVATE_DOCUMENTS_DIR`, mounted as a dedicated
persistent volume in development, staging and production Compose:

| Environment | Location |
| --- | --- |
| Local/default | `.private-documents/` (ignored) |
| Phase 0 integration | `.phase0-test-files/private-documents/` (guarded) |
| Compose | `/data/private-documents` (separate volume) |

The server generates a UUID storage key plus the approved extension. The original
filename is stored only as display metadata and is never used as a path. No
static route, redirect, thumbnail or public media URL serves these bytes.
Editorial `media` remains public and is not a private document store.

Metadata lives in `dashboard.private_documents`:

| Column | Purpose |
| --- | --- |
| `storage_key` | opaque server-generated file key |
| `category` | one of the 16 approved categories |
| `original_filename`, `mime_type`, `size_bytes` | safe metadata |
| `logical_version` | the logical field version; multiple files share it |
| `request_id`, `company_id` | owning resource; at least one is required |
| `uploader_id`, timestamps | attribution |

Files for one logical field share the current version by default. Opening a new
revision belongs to the later versioned application/financial workflows
(T20/T30); this batch does not invent that transition.

## Access rules

Download and metadata access are re-evaluated on every request from the current
role, ownership and active assignment. A document id or URL is never authority.

| Category audience | Who may read |
| --- | --- |
| Company dossier (`articlesOfAssociation`, notices, catalogues, certificates) | owning representative, System Owner, Central Secretariat. Chief/reviewer/employer/investment are denied even when assigned to a case |
| Case (`proposal`) | owning representative, System Owner, Central Secretariat, and an actively assigned chief/reviewer/employer/investment reviewer |
| Financial (`financialStatements`, debts, tax/insurance, contracts, use-of-funds, guarantees) | owning representative, System Owner and Central Secretariat. Investment reviewer access requires an authorized persisted handoff; T29/T30 have not delivered that state, so investment access currently fails closed. Chief, ordinary reviewer and employer reviewer are explicitly denied |
| Correspondence (`correspondenceAttachment`) | owning representative, System Owner and Central Secretariat. Supplementary financial replies retain the financial audience restrictions, including denying investment access until a persisted handoff exists |
| Future workflow (`rfp`, `supplementaryCaseFiles`, `boothPaymentReceipt`) | denied with `422 unsupported_category` until T18/T33/T50 provide the parent workflow |

Uploads: an active representative may add files to its own draft request or own
company dossier; System Owner and Central Secretariat may add to an authorized
parent. Other roles cannot upload here. Deleting a request file is limited to
the owner representative while the request is `draft`, or System Owner.
Company-dossier deletion is not exposed in this slice.
Correspondence uploads require a request parent and may be added after submission;
they do not replace or mutate existing submitted/financial files.

Unknown and unauthorized document ids both return `404`; a missing stored file
returns `410 document_unavailable`.

Letter attachment metadata and both download routes use this same current
category, ownership and assignment policy. A historic letter never grants
additional document access. Sending an attachment checks both sender and
recipient; a request document must be sent with its exact request id. Existing
letters omit attachment metadata when current document access is denied.
Company-dossier attachments on a case letter must belong to that case's company,
including legacy requests whose company is resolved through their representative.
Malformed attachment lists are rejected in full; sending never silently drops
invalid entries. Repeated document ids are persisted once.

## API

| Endpoint | Behavior |
| --- | --- |
| `GET /documents?requestId=...` | list authorized metadata for an authorized request; `allowedActions` is per document |
| `GET /documents?companyId=...` | company dossier metadata; representative may only request its own company |
| `POST /documents` | multipart `file` + `category` + exactly one parent (`requestId` or `companyId`), optional `logicalVersion`; returns safe metadata |
| `GET /documents/:id` | authorized metadata only; `allowedActions` may include `download` and, while the request is a draft and the actor owns it, `delete` |
| `GET /documents/:id/download` | authorized bytes with `Content-Disposition`, `Cache-Control: private, no-store`, `nosniff` and a sandbox CSP |
| `DELETE /documents/:id` | draft-owner or System Owner request file |

The same-origin `/api/dashboard/*` proxy forwards multipart bytes without
corrupting the boundary, preserves the authorized download headers, and never
falls back to a public media URL.

## Failure and workflow rules

- The file is written before the metadata row. If metadata insert fails, the
  written file is removed. A failed, invalid or oversized upload creates no
  metadata row.
- Uploading or failing an upload never changes the request status or any
  workflow state. Financial/files completeness remains T30 work.
- Request document uploads/deletes serialize on the current request row and
  recheck its owner/status after acquiring the lock, so submission cannot race
  with a draft mutation.
- Existing submitted/financial snapshots are not mutated by this slice.
- Deleting a displayed document removes the private bytes and metadata; broader
  audit/history retention is a later workflow concern.

## Migrations

Backend migration `1780511400006_shared_access_and_private_documents` creates
`dashboard.case_assignment_role`, `dashboard.case_assignments` and
`dashboard.private_documents` with constraints/indexes. It is additive. Phase 0
rehearsal applied all seven backend migrations on the disposable database.

## Deliberately not delivered

- RFP version/download workflow (T18), proposal/revision workflow (T20),
  financial package completeness/handoff (T30/T31), supplementary result
  publication (T33) and booth receipt workflow (T50). T35 supports company and
  Secretariat supplementary replies; investment inspection remains dependent
  on the persisted handoff.
- Image uploads, OCR, virus scanning, signed URLs, resumable uploads, retention
  automation or a numerical file-count cap.
- A deployed staging runtime or real-data migration.

## Verification

- Exact 10,000,000-byte acceptance and 10,000,001-byte rejection.
- Word/PDF acceptance; image, spoofed extension, MIME/magic mismatch and empty
  file rejection.
- Multiple files on one logical field; no count cap.
- Anonymous/direct route denial, cross-company and unassigned denial,
  financial exclusion for chief/reviewer/employer, assignment revocation and
  role-change/deactivation revocation.
- Failed uploads leave the request `draft` with no metadata row.
- Private storage keys are not present in responses and path traversal is
  rejected.
- Frontend component tests cover progress, retry, local type/size errors,
  denied/expired sessions and pending-upload submit blocking, plus category,
  version, parent and delayed-upload scope changes.
- Integration tests cover submit-versus-upload/delete row-lock ordering,
  participant-only case letters, recipient-only deletion and revocation.

UAT05/UAT09/UAT11/UAT22/UAT25/UAT35 remain **Not run**. Issue #71 stays open for
the RFP, finance-package, correspondence and receipt integrations.
