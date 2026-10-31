# Financial package invitation (T29 / #45)

Backend slice with one small change to the company's request page. Human acceptance (UAT21) has not been run and the invitation screens (FE18, FE19) are not built. It builds on the [chief decision (T28)](chief-decision.md). Versioned package submission and completeness stay in T30.

The chief's `advance` opens the financial stage. In the same transaction it records an invitation and queues the company's in-app letter, so a case cannot advance without one. A return or a rejection records nothing.

## API

| Route | Who | Behaviour |
| --- | --- | --- |
| `GET /requests/:id/financial-invitation` | Owning company, Secretariat, owner | `{ invitation }`: `id`, `requestId`, `trackingCode`, `requestRevision`, `proposalRevision`, `checklistVersion`, `checklist`, `invitedAt`. Before advancement `409 financial_stage_not_open`. Another company gets `404`. Chief, reviewer, employer and investment person get `403`. |

The response names neither the chief nor the round.

## Link to the case

Each invitation belongs to one review round (`review_round_id` is unique). It pins two revisions:

- `requestRevision`: the case revision the advancement created.
- `proposalRevision`: the proposal revision that round reviewed. For a corrected case, this is the corrected proposal.

## Checklist

`checklist` is a stored copy, so a later version cannot change what an earlier invitation asked for. `financial-package-2026-v1` has one item per financial document category:

| Category | Title |
| --- | --- |
| `financialStatements` | صورت‌های مالی |
| `debtFacilityEvidence` | بدهی‌ها و تسهیلات |
| `taxInsuranceRecords` | اظهارنامه مالیاتی و بیمه |
| `contractsOrdersMousCommitments` | قراردادها و تعهدات |
| `projectEstimateUseOfFunds` | برآورد و مصرف منابع |
| `guaranteeCollateral` | تضامین و وثایق |

The list follows stage 4 of the [product requirements](product-requirements.md) and uses the implemented upload categories, not the proposed keys in [fixed form contracts](fixed-form-contracts.md). Supplementary documents are left out because they are requested later, through Secretariat. The [T28](chief-decision.md) letter title and body now carry the invitation and every title.

Two inputs are still open, so the checklist decides neither of them:

- Which categories allow a formal absence, and with what evidence.
- How statement years are counted. The item states the rule (the last three years, or since establishment for a younger company) and calculates no years for the company.

## File access

| Company action | Before advancement | After advancement |
| --- | --- | --- |
| Upload a financial file | Denied, including on a draft | Allowed |
| Delete a financial file | Allowed on a draft only, for files uploaded before this change | Allowed |
| Upload or delete a proposal file | As before | Denied |

- A representative's case now advertises `uploadDocument` and `deleteDocument` in this stage. The company's request page applies them per category, because these actions do not name one.
- Nothing freezes the files yet. T30 must close uploads and deletes when it adds submission.
- The owner and Secretariat keep their existing upload rights at every stage. The gate covers the company only.
- Read access does not change. The investment person still has no access until a persisted handoff exists.

## Migration

`1780511400030_financial_invitations` creates `dashboard.financial_invitations`. Cases already advanced under T28 get an invitation with their decision's actor and time, but no second letter, so those companies see the list only through the route. Rollback drops the table and leaves the cases `advanced`.

## Verification

`tests/int/financial-invitation.int.spec.ts` runs these rules through HTTP on real Postgres, including rollback when the invitation cannot be written. `tests/access-policy.spec.ts` and `tests/document-access-matrix.spec.ts` cover the file rules. The test of simultaneous advances depends on timing, so it can miss a regression in a given run.

## Not in this slice

Versioned package submission, completeness and the since-establishment rule (T30), the investment handoff, and the invitation screens (FE18, FE19).
