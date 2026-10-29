# Independent booth request cost (T49)

Each `dashboard.booth_reservations` row is an independent booth request. Its
`price_version_id` pins the fixed amount and `toman` unit in the existing
`dashboard.booth_price_versions` record. The reservation ID identifies the
request cost; no aggregate invoice, new cost table or second snapshot is needed.

Creation, detail, company/exhibition lists and attendance decision responses
expose `priceVersionId`, `priceAmount` and `priceUnit`. Creation and attendance
updates read the reservation's pinned version, not the booth's current price.
Catalogue price edits append a version and change the booth's current pointer;
existing requests retain their original amount and version, including rejected
requests after the booth is reserved again at a newer price.

No receipt upload, receipt history, payment confirmation, gateway or additional
services are implemented here. Receipt/payment work remains T50. Existing
reservation ownership and attendance authorization are unchanged. No migration
or production data change is required.

Regression coverage: `apps/backend/tests/int/booth-reservations.int.spec.ts`
checks separate same-company requests, creation prices, detail/list projections,
price edits, attendance approval/rejection and a later reservation at a new price.
