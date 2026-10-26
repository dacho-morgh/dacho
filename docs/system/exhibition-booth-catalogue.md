# Exhibition booth catalogue (T47 / #61)

Status: backend implementation, 2026-10-26. This slice defines the sellable
catalogue and per-company cap only. Reservations, booth applications,
attendance approval, receipts and cancellation remain T48/T49/T50/T51/T55.

## Ownership boundary

CMS `exhibitions` remains the public content record (title, description,
location, dates and status). The operational catalogue is owned by the backend
in `dashboard.*` and is keyed by the CMS exhibition id. The catalogue tables are
separate from Payload's `public` schema, matching the existing storage split.

## Stored records

| Table | Purpose |
| --- | --- |
| `dashboard.exhibition_catalogue_settings` | One row per exhibition with `company_booth_limit` and an optional `guide_map_reference`. |
| `dashboard.exhibition_booths` | Booth identifier, specification, optional location, status, active flag, current fixed price, price unit and current price-version reference. |
| `dashboard.booth_price_versions` | Append-only price history. Every create and every price change inserts a new row; earlier rows are never updated. |

A booth identifier is unique per exhibition, compared case-insensitively after
trimming. The database enforces this with a unique index. A price is a positive
integer amount in **toman** and the stored unit is explicit (`price_unit =
'toman'`). No rial/toman conversion is performed; the stored unit is the
displayed unit.

Booth `status` is `available` or `unavailable`. `available` in responses is
derived as `active AND status = 'available'`. The owner sets both values; this
slice does not derive reservation state.

## Price snapshot contract for T48/T49

`dashboard.exhibition_booths.price_version_id` points at the current immutable
`dashboard.booth_price_versions` row. A booth application must store that
version id (and the amount/unit copied from that version) when the application
is created. Editing the catalogue later appends a new version and moves the
booth's current pointer; it does not mutate the version an application already
captured. No application table is introduced in this slice.

## Endpoints

| Endpoint | Rule |
| --- | --- |
| `GET /exhibitions/:exhibitionId/catalogue` | Any active operational role. Returns the company cap, guide-map reference and active booths with identifiers, specifications, prices and availability. Inactive booths are omitted. |
| `GET /admin/exhibitions/:exhibitionId/catalogue` | System Owner only. Same projection plus inactive booths. |
| `PUT /admin/exhibitions/:exhibitionId/settings` | System Owner only. Validates a positive integer `companyBoothLimit`; optional `guideMapReference`. |
| `POST /admin/exhibitions/:exhibitionId/booths` | System Owner only. Requires identifier, specification, positive integer `priceAmount`, `priceUnit = 'toman'`; optional status, location and active flag. |
| `PATCH /admin/exhibitions/:exhibitionId/booths/:boothId` | System Owner only. Partial update with the same validation rules; changing the price appends a price version. |

The company read exposes no owner-only fields and does not expose inactive
inventory. The remaining six operational roles may read the same public
catalogue definition, per the permission matrix.

## Deliberate omissions

- No reservation, application, attendance, receipt, cancellation or refund
  records; later tasks own those.
- No interactive floor plan, ancillary service pricing or online gateway.
- No automatic expiry or timed release.
- No rial storage or conversion path because the approved catalogue price is
  fixed in toman.
