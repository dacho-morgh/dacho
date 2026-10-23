# Phase 0 scope and decision register

Recorded 2026-10-23 for T01 / #15. Authority: the approved decisions through Q38 already captured in [product requirements](product-requirements.md) and [workflows](workflows.md). This register records those decisions; it does not assert a new product sign-off or completed implementation.

## Scope and ownership

The Fund owns the product. “Product owner” below means the Fund's authorized decision maker; no named individual or approval date beyond the source documents has been supplied. Technical owners settle implementation names and contracts without changing approved business rules. QA records human acceptance independently of engineering completion.

| Decision | Confirmed scope | Decision owner / delivery responsibility | Affected original tasks |
| --- | --- | --- | --- |
| D01 — participation units | One company-owned application per event subtopic, with independent tracking, revisions and outcome. One application and payment history per booth. | Product owner / backend and frontend | T12, T19–T21, T47–T55 |
| D02 — identity | Person authenticates by phone/email and password; company is the account holder. Atomic signup, unique company national ID, one company representative in current scope. | Product owner / CMS and backend | T05–T06, T08, T11–T13 |
| D03 — responsibilities | Seven single operational roles, with event responsibility and case assignments. Preserve or deliberately migrate editorial privileges. | Product owner / CMS and backend; [permission matrix](permission-matrix.md) | T02, T06, T08–T09, T16, T23, T31, T34, T38, T42 |
| D04 — verification | Panel access precedes eligibility. Secretariat reviews an exact submitted revision; return/resubmit preserves company identity. Identity/document changes require renewed verification and preserve earlier application snapshots. | Product owner / CMS, backend and frontend | T13–T15 |
| D05 — event review | Fixed employer person plus three distinct ordinary reviewers. Finalized current-round evaluations alone count toward 4/4. Chief must explicitly decide. Corrections after review starts create a new revision and round. | Product owner / backend and frontend | T17–T18, T21–T29 |
| D06 — investment | One assigned investment person writes/sends a private memo. Secretariat obtains supplementary documents and separately publishes company-visible text. | Product owner / backend and frontend | T29–T35 |
| D07 — confidentiality | Company sees its submissions/progress and published result, not private scores/memos. Financial files and metadata exclude chiefs and reviewers. Messaging does not grant dossier access. | Product owner / CMS, backend and frontend | T02, T06, T09–T10, T23, T27, T31, T33–T35, T38–T39, T42 |
| D08 — booths | Exclusive reservation on submission with no expiry; configurable company cap; fixed explicit toman price per application; attendance approval before receipt; manual receipt verification. Receipt correction retains reservation. | Product owner / CMS, backend and frontend | T47–T51, T53–T55 |
| D09 — cancellation | Company cancels directly before receipt. After receipt, Secretariat decides cancellation/release and records any manual refund. Other booth applications remain independent. | Product owner / backend and frontend | T48, T51–T54 |
| D10 — forms and history | Fixed, versioned system forms; snapshot consent, RFP and submitted data. Guard stale/repeated mutations and preserve decision history and reliable in-app notifications. | Product owner / technical owners | T03, T07, T18, T20, T24–T25, T28, T30, T36–T37, T44 |
| D11 — delivery and evidence | Access/private files/persistence first, entire event path next, exhibition path afterward. Use isolated synthetic fixtures. Engineering completion does not pass human gates. | Product owner / engineering and QA | T04, T41–T46, T54; UAT01–UAT42 |

## Open inputs and bounded consequences

No placeholder in this table is a default production value. Implementation may proceed on independent foundations while the affected contract stays pending.

| Input | Required decision and owner | Affected implementation / acceptance |
| --- | --- | --- |
| Q39 — document policies | Product owner supplies formats, per-file size and any count limit for each document category; technical owner reviews enforceability. No universal 12 MB policy was approved. | T03, T10, T18, T20, T30, T35, T50; corresponding upload assertions in UAT05, UAT09, UAT11, UAT22, UAT25, UAT35 |
| Review-form interpretation | Product owner supplied ordinary/employer forms on 2026-10-23: shared 45/40/15 scoring, maxima 64/51/39, supplied weighted maximum 55.05, separate qualitative/risk questions. [Rubric contract](review-rubric.md) preserves this source. Four-review aggregation/ranking/ties, fractional scoring/rounding and incomplete field requiredness remain open; technical owner versions the reviewed contract. Figma alone is not authority. | T03, T24–T25, FE17 and the relevant scoring/finalization assertions in UAT16–UAT20 |
| Agreement and event rules | Product owner supplies approved non-compete agreement and event-rules text with identifiable versions. | T03, T20, FE12 and consent assertions in UAT11 |
| Technical form dictionary | Technical owners review the [fixed form contracts](fixed-form-contracts.md), including enum values, date representation, validation and category-specific absence semantics. Proposed details do not become approved business policy by being documented. | Stage-specific T03 readiness, T11, T13, T20, T24, T30 and frontend integration |
| Schedule and staffing | Delivery owner supplies team capacity and calendar commitments. | Calendar commitments only; dependency order remains usable |

## Boundaries and exclusions

Retain Next.js/Payload, Express, shared CMS domain and PostgreSQL `cms`/`dashboard` boundaries. Record/API names in technical design remain proposed. The approved scope excludes a workflow designer, per-event form builder, new OTP screens, multiple company representatives, investment voting or investment approve/reject controls, online payments, ancillary exhibition pricing, interactive floor plans and automatic reservation expiry.

Existing historical `admin/editor/representative/referee` code and general service forms remain implementation baseline, not the seven-role target. The root [glossary](../../CONTEXT.md) now uses approved domain language; the [dated implementation audit](current-state-audit.md) describes the legacy behavior. Older dynamic-role/three-review documents and conflicting Figma copy do not override this register's source requirements.

## Change control and completion

For a business-rule change, update the requirements, affected transitions, implementation criteria and human gates together. Keep original IDs and issue mappings stable. Technical-only changes must state their effect on permissions, versions and failure behavior where applicable.

T01's deliverable is this traceable scope/open-input record. T02 specifies policy; implementing that policy belongs to later issues. T03 remains incomplete until its relevant product inputs and technical review are supplied. T04 requires actual isolated-environment and recovery evidence; documentation alone cannot claim a rehearsal. No UAT gate is passed here.
