# Owner event and exhibition admin (S5 / #243)

Status: implemented 2026-11-03 on `codex/s5-owner-event-exhibition-admin`. Absorbs FE40 #231, FE41 #232 and T60 #222. Human gates: UAT08 #109, UAT09 #110, UAT31 #132; UAT39 #140 and UAT40 #141 keep every owner step.

## What the owner does

The System Owner manages events and exhibitions from one menu entry, `/dashboard/events` («رویدادها و نمایشگاه‌ها»), and one list. Events and exhibitions keep separate data and rules; only the entry point, the list and the create button are shared. No owner path for events or exhibitions goes through the Payload CMS admin.

| Screen | Path | Who |
| --- | --- | --- |
| Events and exhibitions list (type filter, search, ⋮ menu) | `/dashboard/events` | System Owner. Companies keep event discovery at the same path. |
| Create (type dialog → full-page form) | `/dashboard/events/new?type=event\|exhibition` | System Owner |
| Edit an event and its public page | `/dashboard/events/:id/edit` | System Owner |
| Categories, subtopics, employer and RFP (FE10) | `/dashboard/events/:id/subtopics` | System Owner |
| Edit an exhibition, its public page and booth settings | `/dashboard/exhibitions/:id/edit` | System Owner |
| Booth catalogue (FE24/T47) | `/dashboard/exhibitions/:id` | System Owner; Secretariat and companies see their S7 booth pages here |
| Old exhibitions entry | `/dashboard/exhibitions` | Redirects the owner to `/dashboard/events?type=exhibition`; unchanged for the Secretariat and companies |

The pages check the role on the server and send every other role to `/dashboard?access=denied`; `GET /access` returns `allowed: false` for the create, edit and subtopics paths for every role but the owner. The owner's capabilities list `/dashboard/events` once and no longer list `/dashboard/exhibitions`.

## Records

| Record | Store | Owns |
| --- | --- | --- |
| Public event page | CMS `events` | title, description (rich text), location, start/end date, site status (`upcoming`/`ongoing`/`past`), image and the long-form page tabs |
| Operational event | `dashboard.events` | title, description, registration window, responsible chief and investment person, revision, audit; `public_event_id` → the CMS page (unique) |
| Public exhibition page | CMS `exhibitions` | title, description, location, start/end date, site status, image |
| Exhibition operations | `dashboard.exhibition_catalogue_settings` (keyed by the CMS id) | company booth limit, guide map reference, `revision`; booths and price versions as in [exhibition booth catalogue](exhibition-booth-catalogue.md) |

The dashboard form writes the public title and description from the event's own; it sends the description as plain text and stores it as paragraphs. Editing in the dashboard replaces rich formatting made in the CMS editor with plain paragraphs. The image and the long-form page tabs are not in the dashboard form and stay editorial content.

## API

| Endpoint | Rule |
| --- | --- |
| `GET /admin/events` | Internal roles as before. The owner's response adds `public` per event (`null`: no page yet) and `unlinkedPublicEvents`: CMS events no dashboard event owns. If the CMS cannot be read, the owner still gets the events, with `publicPagesUnavailable: true`. `no-store`. |
| `GET /admin/events/:id` | As before; the owner's response adds `public`. |
| `POST /admin/events` | System Owner only (403 otherwise). Requires the operational fields and `location`, `startDate`, `endDate` (end after start), `status`. Optional `publicEventId` takes over an unlinked CMS event (404 if absent, 409 `public_event_linked` if taken). Creates or updates the public page and the operational row together. |
| `PATCH /admin/events/:id` | System Owner only. `revision` and `reason` as before (409 `stale_event`). Public fields are optional when the event has a page (filled from it) and required when it has none: the save then creates the page. |
| `GET /events` | System Owner, Secretariat, or a representative with a company: `{ id, publicEventId, title, registrationOpenAt, registrationCloseAt }` for each event with a public page. Others 404. `no-store`. |
| `GET /admin/exhibitions` | System Owner only: every CMS exhibition with `companyBoothLimit`, `guideMapReference`, `revision` (0: no settings yet) and `boothCount`. 503 if the CMS cannot be read. `no-store`. |
| `GET /admin/exhibitions/:id` | System Owner only; 404 for an unknown or malformed id. `no-store`. |
| `POST /admin/exhibitions` | System Owner only. Public fields plus `companyBoothLimit` (positive integer) and optional `guideMapReference`. Creates the CMS page and the settings together. |
| `PATCH /admin/exhibitions/:id` | System Owner only. `revision` (0 for an exhibition without settings) → 409 `stale_exhibition` with the current revision. Omitted fields keep their values. |

Validation errors are 400 with `invalid_public_content` and `fields`, `invalid_public_dates`, `invalid_event` / `invalid_registration_window` (events) or the catalogue codes (exhibitions). A CMS failure before anything is committed is 502 `public_record_failed`.

## One step, all or nothing

The backend writes the CMS records through its existing Payload service account (`PAYLOAD_URL`, `PAYLOAD_API_KEY`), the same client that checks exhibitions exist. CMS `events` and `exhibitions` accept create, update and delete from an `admin` or that API-key service account (`adminOrBackendService`); owner-only access is enforced by the backend routes.

- **Event create:** insert the operational row in a transaction → create (or take over) the CMS page → set `public_event_id` → commit. A CMS failure rolls the row back. A failure after the CMS write deletes the new page, or restores the taken-over one, and returns the error.
- **Event edit:** lock the row, check the revision, update it and its audit entry → update (or create) the CMS page → commit; a later failure restores the page's previous content.
- **Exhibition create:** create the CMS page → insert the settings (revision 1). If the settings cannot be written (an error, or settings already stored under that id: 409 `exhibition_settings_conflict`), the new page is deleted.
- **Exhibition edit:** lock the settings, check the revision, write them → update the CMS page → commit; a CMS failure rolls the settings back, a later failure restores the page.

An undo is retried three times. If it still fails, the backend logs the collection and id for manual cleanup and returns the original error: the two stores cannot share one database transaction without a second CMS write path, which the slice rules forbid.

## Records made before S5 (T60)

- **Dashboard event without a public page:** listed with «بدون صفحه عمومی»; its next save from the edit form creates the page (the form says so).
- **CMS event without a dashboard event:** listed with «بدون ثبت‌نام و مسئول» and the action «تکمیل رویداد», which opens the create form prefilled from the page and links it (`publicEventId`) instead of making a second page. Until then companies see the page but cannot apply to it.
- **CMS exhibition without booth settings:** listed with «بدون تنظیمات غرفه»; its first save adds the settings (`revision: 0` → 1).

## Companies

The company events page and the event detail page still list CMS pages, and apply to the operational event behind each page (`GET /events`). Before S5 they sent the CMS id to the operational category API, which needs the operational id. Links that carry either id keep selecting the right event.

## Not in this slice

Booth requests, attendance and receipts stay as S7 built them. The sidebar is unchanged: its `/dashboard/events` entry already reads «رویدادها و نمایشگاه‌ها». Event images and the long-form public page tabs are not editable from the dashboard. Deleting an event or exhibition is not offered.
