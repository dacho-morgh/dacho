# Company profile persistence and privacy — T05/T06

Date: 2026-10-24. Issues: [#19](https://github.com/dacho-morgh/dacho/issues/19), [#20](https://github.com/dacho-morgh/dacho/issues/20). Branch: `codex/company-profile-persistence-privacy`, base `staging`.

## Delivered behavior

The backend Payload company adapter now writes addresses and executives on creation and partial update. Omitted arrays remain untouched; explicit empty arrays clear them. Address row IDs survive reload/edit/delete. Only declared nested fields are forwarded. Numeric representative IDs are serialized as numbers for Payload's Postgres relationship validation.

The `companies` collection is private: current `admin` accounts can read/edit all companies; a current `representative` can read/edit only the company linked to that person. Anonymous visitors, content-only editors and unassigned reviewers cannot read the private collection. List/search/count and Local API calls with `overrideAccess: false` use the same scope. Representative relationships have `maxDepth: 0`, so REST dossier reads do not hydrate authentication records.

Public presentation uses `GET /api/companies/directory`, with an explicit response of `id`, `name`, `type`, `province`, `city` and pagination metadata. Only positive integer `page` is accepted as input; arbitrary private filters, sorting, selection and population are ignored. The endpoint intentionally reads through collection access internally and explicitly projects only those public fields. Existing consumers of unrestricted `/api/companies` must use this endpoint for public directory data.

Representatives cannot reassign the company's national ID or representative link. The dashboard renders national ID read-only and rejects a changed ID before applying any accompanying edits. Administrators retain correction authority. Normal company description/profile edits remain available. Identity re-verification and immutable approved snapshots belong to T14/T15; this change does not introduce verification status or claim to complete those workflows.

The privileged backend adapter now reloads current actor roles for profile and administrator company routes and resolves ownership from the stored representative relationship. Browser-supplied target-company/representative IDs cannot choose a different profile. Missing company records produce an error before acknowledging a write. The former user-store exception based only on `backend@dacho.local` email is removed; the seeded service account already holds `admin` authority.

## Validation and boundaries

`company-profile.int.spec.ts` dispatches requests through Payload's actual REST/auth/access/serialization handlers against the guarded disposable Postgres database. It exercises nested creation, updates, independent adapter reloads, row-ID preservation, clearing, private lists/search/counts/details, unauthorized writes, Local API scope, admin corrections, role/representative revocation and the fixed public projection. Backend route tests cover target-ID injection, stale/forged role headers, protected identity edits and missing-company writes. The existing profile component test checks that national ID stays read-only while other fields are editable.

An attempted GraphQL test exposed an existing schema construction failure: the Persian string values in `Companies.type` are invalid GraphQL enum names. No GraphQL request can currently complete through that schema. This batch does not change stored enum values or claim GraphQL end-to-end validation; collection access rules also govern GraphQL once the schema is repaired. Legal-type/knowledge-based classification restructuring remains T13 scope.

The seven-role migration, Secretariat/event assignment access and generalized authorization revocation remain T08/T09. This batch uses the existing role model without mapping every legacy admin to a new System Owner role. Private documents remain T10. No schema migration, production release or manual acceptance execution is included. UAT04/UAT05 and other human gates remain open until their complete prerequisites and human evidence exist.

Local validation passed: all three workspace typechecks; lint (zero errors, 11 existing warnings); 9 backend unit files / 46 tests; 6 backend integration files / 35 tests; 45 frontend integration files / 180 tests, with the existing 1 skipped file/test; the 5-test CI isolation regression; and `git diff --check`. Both integration suites used `scripts/phase0-test.ps1` and its database/file markers. Build and E2E results are supplied separately by the PR's shared GitHub Actions checks.
