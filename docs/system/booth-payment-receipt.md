# Booth Payment Receipt and Payment History (T50)

Backend implementation for issue #65 (T50) on branch `codex/t50-booth-payment-receipt`.

## Key Rules & Capabilities

1. **Attendance Gating**:
   - Receipt submission is strictly permitted only when `attendance_status = 'approved'` and `active = true`.
   - Pending attendance returns `403 attendance_not_approved`.
   - Rejected attendance returns `403 attendance_rejected`.
   - Inactive reservation returns `409 reservation_inactive`.

2. **Per-Request Receipt Uniqueness & Duplicate Protection**:
   - Reusing a tracking code (`trackingCode`) across different booth reservations is rejected with `409 duplicate_receipt` (`tracking_code_already_used`).
   - Reusing identical receipt file contents (`fileHash`) across different booth reservations is rejected with `409 duplicate_receipt` (`file_already_used`).
   - The same reservation may submit updated/corrected receipts without triggering duplicate errors.

3. **Verification Workflow State (Not Payment Confirmation)**:
   - Submitting a receipt transitions `payment_status` to `'pending_verification'`.
   - Payment is NOT confirmed (`confirmed` is reserved for T51 Secretariat verification).
   - The reservation remains active and exclusive (booth stays unavailable to other companies in the catalogue).

4. **Correction Versions & History**:
   - Initial submission creates version 1.
   - Subsequent submissions for the same reservation increment the version number (`version: 2`, `version: 3`, ...).
   - Previous versions, metadata, and files remain immutable in history.
   - `GET /exhibitions/:exhibitionId/reservations/:id/receipts` returns full chronological history.
   - `GET /exhibitions/:exhibitionId/reservations/:id/receipt` returns the latest version.

5. **File Policy & Security**:
   - Adheres to Q39 / D12 document policy: Word (`.doc`, `.docx`) and PDF (`.pdf`) only, max 10,000,000 bytes per file.
   - Multiple representations (e.g. Word and PDF together) can be uploaded in one receipt submission.
   - Files are stored in private storage with content-disposition and private cache/sandbox headers on download:
     `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`.
   - Only owning representative, System Owner, and Central Secretariat can download.

## Database Migration

- `1780511400025_booth_payment_receipts.ts`:
  - Adds `payment_status` to `dashboard.booth_reservations` (`unpaid`, `pending_verification`, `returned`, `confirmed`, `cancelled`).
  - Creates `dashboard.booth_payment_receipts` table with `(reservation_id, version)` uniqueness.
  - Creates `dashboard.booth_receipt_files` table with SHA-256 `file_hash` and private storage keys.
