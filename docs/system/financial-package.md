# Financial package submission (T30 / #46)

Backend slice that completes the company's financial package after the [invitation (T29)](financial-invitation.md). The company submits the files once; a complete package freezes them. Human acceptance (UAT22) has not been run, and the financial screens (FE19) are not built. Submitting the package does not advance the case; it [hands the case to the investment person (T31)](investment-handoff.md).

## API

| Route | Who | Behaviour |
| --- | --- | --- |
| `POST /requests/:id/financial-package` | Owning company | `201 { package }` on the first complete submit. `200 { package }` with the stored package on a repeat. `422 financial_package_incomplete` with `missingCategories` and `missingStatementYears`, storing nothing. `409 financial_stage_not_open` before advancement. `422 establishment_date_unavailable` when the founding date has no readable year. Another company gets `404`; chief, reviewer, employer, investment and Secretariat get `403`. |
| `GET /requests/:id/financial-package` | Owning company, Secretariat, owner | `{ package }`, the latest stored package. `404` when none exists. Chief, reviewer, employer and investment person get `403`; the investment person reads the package through the [T31 dossier](investment-handoff.md). |
| `POST /documents` with `category=financialStatements` | Owning company | Accepts an optional `statementYear` (four-digit Gregorian year). A malformed year gets `422 invalid_statement_year`. A statement without a year is stored but counts toward nothing. |

`package` holds `id`, `requestId`, `invitationId`, `packageVersion` (1 for now), `checklistVersion`, `statementYears`, `documents` (the frozen file ids, names, sizes, logical versions and statement years), `submittedBy` and `submittedAt`.

## Completeness

A package is complete when both hold:

- Each of the six checklist categories from [T29](financial-invitation.md) has at least one file on the case.
- Each statement year the company's founding date requires has a `financialStatements` file for that year.

Expected years come from the company's `establishmentDate` (free text). The first four-digit group is the founding year. A Persian year (1200–1450) is converted by adding 621. Only completed years count:

- An established company needs the last three completed years.
- A younger company (founded after the first of those years) needs every completed year since its founding year. A company founded in the current year needs none.

Absence of a category or a year is not a waiver. The product has not approved any absence rule, so a missing item always blocks submission.

## Freeze

Submission runs under the lock on the request row, the same lock an upload or delete takes. A file therefore cannot land between the check and the snapshot. After a package exists for the case's latest invitation (a package of an earlier invitation does not freeze a later stage):

- Financial uploads return `404`, as for any denied upload.
- Financial deletes return `403`.
- The request advertises `submitFinancialPackage` and the upload and delete actions only before submission.
- Proposal files and correspondence keep their existing rules.

## Data

`1780511400031_financial_packages` adds:

- `dashboard.private_documents.statement_year` (nullable, 1900–2200).
- `dashboard.financial_packages`, one row per submitted package. It holds the invitation, `package_version`, the checklist version, the statement years and the `documents` snapshot. `UNIQUE (invitation_id, package_version)`.

Submitting also writes an activity row with action `financial_package_submit`.

## Assumptions to confirm

These are open product inputs. The code takes the reading below and keeps each one in one place (`apps/backend/src/dashboard/financial-package.ts`):

- **Fiscal year = calendar year.** Product has not decided how fiscal years map to dates.
- **"Last three years" = the three completed calendar years before the current year.**
- **Younger company = founded after the first of those three years.**
- **Persian founding years convert by adding 621.** This is exact after 20 March and one year early before it.
- **No absence path.** Which categories may use formal absence is still undecided.

## Verification

- `tests/financial-package.spec.ts` covers the founding-year reading, the year plan, the gaps and the statement-year parsing.
- `tests/access-policy.spec.ts` covers the freeze and the advertised actions.
- `tests/int/financial-package.int.spec.ts` runs on real Postgres: the stage gate, the complete gap report with no stored rows, the year rule, a single submit that freezes the files, a retried and a concurrent submit that store one package, and the role and company boundaries.

## Not in this slice

The [investment memo (T32)](investment-memo.md), supplementary documents, covered by [follow-up and publication (T33)](secretariat-follow-up.md), and the financial screens (FE19). A second package version is not created by any route yet.
