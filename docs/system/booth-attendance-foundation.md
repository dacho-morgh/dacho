# Booth attendance foundation (T55)

PR #176 implements a separate attendance decision for each booth reservation.
The authoritative rules are [workflows](workflows.md#4-independent-booth-applications)
and [T55](../event-review-system-plan.md). Attendance approval is independent
of company verification and payment confirmation.

Only the System Owner and Central Secretariat can list the attendance queue,
read decision history or approve/reject attendance. Representatives can read
their company's reservations. Decisions require an active pending reservation;
rejection requires a non-empty reason, records actor/time and releases that
reservation. PostgreSQL locks the reservation while updating its state and
inserting history in one transaction. An inactive pending reservation cannot
be approved, including after another company has reserved the released booth.

## Integration boundaries

- The reservation API requires an authoritative `BoothCompanyEligibility`
  provider in the application dependencies. An unverified company receives
  `403 company_not_verified`; without a provider the API returns
  `503 company_verification_unavailable`. Production does not yet wire a
  provider: the verification lifecycle remains a dependency. Profile
  completeness and the free-text company operating status are not proof of
  verification. Tests explicitly supply verified-company fixtures.
- The receipt POST checks ownership, exhibition, attendance and active state
  using the repository's eligibility policy. Pending/rejected attendance
  receives 403. An approved active reservation reaches
  `501 receipt_upload_not_implemented`, never a successful upload response.
  T50 must add policy-valid file persistence and receipt versions before this
  endpoint can acknowledge a receipt. The generic private-document API still
  denies `boothPaymentReceipt`.
- The `submit_receipt` action describes attendance eligibility. Actual upload
  remains unavailable until T50. No payment confirmation, cancellation UI or
  frontend attendance panel is claimed by this backend slice.

## Local verification

The review fixes passed 2,181 backend unit tests, 101 PostgreSQL integration
tests through `scripts/phase0-test.ps1 -Action Backend`, backend typecheck and
backend build. Frontend lint passed with 14 existing warnings and no errors
when run directly; the workspace Turbo wrapper could not create its local
`.turbo` log directory. Integration used the guarded disposable database on port
55439 with a fresh PR-specific test volume; an earlier run against a database
containing another branch's migration journal was incompatible. CI was not
inspected, changed or manually rerun, and this work does not claim deployment
or human acceptance.
