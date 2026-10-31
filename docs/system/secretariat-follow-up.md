# Secretariat follow-up and result publication (T33 / #51)

What the Secretariat does after an [investment memo (T32)](investment-memo.md) arrives: ask the company for more documents, open them to the investment person, and publish a separate text to the company. Human acceptance (UAT25, UAT26) has not been run. The investment person's screen (FE20) is not built, so delivered files are reachable there through the API only.

## The flow

1. The queue shows every case with a sent memo, those without a published result first.
2. If more documents are needed, the Secretariat sends a request. The company receives a case-linked letter and sees the request on its case page.
3. The company uploads files as correspondence attachments on the case.
4. The Secretariat delivers chosen files to the investment person holding the case, who can then write another memo.
5. The Secretariat saves a company-facing text, reviews the preview and publishes it. The company gets an in-app notice and reads the text on its case page.

## Rules

- **Nothing publishes itself.** The company-facing text is typed separately and the memo never prefills it. Sending a memo, requesting documents and saving a draft leave the company's result empty.
- Every save of the text adds a version. No version's text changes afterwards.
- Only the latest version can be published. A repeated publish returns the version already published and sends no second notice.
- A correction is a new version that must be published again. The company keeps reading the earlier text until then, and earlier versions stay in the history.
- A publication records its publisher and time, and the server records the latest sent memo as its internal source. That reference never reaches the company.
- Publication changes neither the case's status nor its stage.
- All four commands run under the request row lock, require a submitted package and a case at the advanced stage, and write a history row. Requesting documents and saving or publishing the text also require a sent memo.
- Sending the latest request text again returns that request, so a double submit writes one letter.

## API

| Route | Who | Behaviour |
| --- | --- | --- |
| `GET /investment/follow-ups` | Secretariat, owner | `{ items, total, page, totalPages }`, one row per case with a sent memo. Every other role gets `403`. |
| `GET /requests/:id/follow-up` | Secretariat, owner | `{ stageOpen, canAct, memos, supplementaryRequests, files, results, published }`. `canAct` is true for the Secretariat only. The memo rule from T32 applies: the Secretariat receives sent versions and the owner also sees drafts. Every other role gets `403`. |
| `POST /requests/:id/supplementary-requests` | Secretariat | Body `{ body }`, trimmed, at most 5,000 characters. `201` for a new request, `200` for a repeat. `400 invalid_supplementary_request`. |
| `GET /requests/:id/supplementary-requests` | Owning company, Secretariat, owner | `{ items }`, each with `id`, `body` and `createdAt`. Another company gets `404`; assigned staff get `403`. |
| `POST /requests/:id/supplementary-files` | Secretariat | Body `{ documentId }`, a `correspondenceAttachment` of this case. `201` when delivered, `200` when already delivered. `400 invalid_document_id`; `404` for any other file. |
| `POST /requests/:id/result` | Secretariat | Body `{ body }`, trimmed, at most 20,000 characters. `201` for a new version, `200` for a retry of the latest unpublished text. `400 invalid_result`. |
| `POST /requests/:id/result/publish` | Secretariat | Body `{ version }`. `200 { result }`. `400 invalid_result_version`; `404` for an unknown version; `409 result_version_stale` for a replaced version. |
| `GET /requests/:id/result` | Anyone who can read the case | `{ result: { body, publishedAt } \| null }`: the latest published text and nothing else. |
| `GET /investment/cases/:id` | Investment person holding the case | The [T31 dossier](investment-handoff.md) now includes `supplementaryFiles`: delivered files with download routes. |

The four commands answer `403` to every other role, including the owner. They answer `404` for an unknown case and `409 investment_stage_closed` outside the stage. All but delivery answer `409 memo_not_sent` without a sent memo, and publishing checks that only for a version that can still be published.

## Confidentiality

| Reader | Published text | Result drafts | Memo | Delivered files | Files not delivered |
| --- | --- | --- | --- | --- | --- |
| Owner, Secretariat | Yes | Yes | [T32 rule](investment-memo.md) | Yes | Yes |
| Owning company | Yes | No | No | Its own uploads | Its own uploads |
| Investment person holding the case | Yes | No | [T32 rule](investment-memo.md) | Yes | No |
| Chief, reviewer, employer assigned to the case | Yes | No | No | No | No |
| Another company or investment person | No | No | No | No | No |

History rows hold no text. `result_save` is visible to the owner and Secretariat only. `supplementary_request` is hidden from the chief, reviewers and employer, and `supplementary_delivery` is also hidden from the company. `result_publish` is visible to everyone who can read the case.

Delivery does not outlast access: revoking the assignment, deactivating the account or changing its role ends the investment person's read on the next request. A person who later holds the case reads the files already delivered. A later advancement closes them until the company resubmits its package, as with the other financial files.

## Screens

- `/dashboard/follow-ups`: the queue, for the Secretariat and the owner.
- The internal case page has a follow-up section. It renders nothing for roles the server denies, and is read-only for the owner.
- The company's case page shows the published result and, once a request exists, the request text and an upload field.

No Figma design exists for these screens. They use the existing dashboard components and await design review under FE13 and FE21.

## Migration

`1780511400034_secretariat_follow_up` creates `dashboard.supplementary_requests`, `dashboard.supplementary_deliveries` and `dashboard.published_results`. It rewrites no existing rows. Its rollback drops the three tables, so requests, deliveries and published texts are lost.

## Assumptions to confirm

- **Publishing does not close the case.** No approved rule says what status or stage follows publication, so the case stays `in_review` at `advanced` and the company's status label does not change.
- **A published result can be corrected by publishing a new version.** The rules require recording the publisher, time and text; they do not say whether a publication is final.
- **The owner reads and does not publish.** The matrix mentions a recorded administrative override for the owner, but no such command was described.
- **Supplementary files are correspondence attachments.** They already have the financial audience from T35, and the plan's correspondence path uses them. The `supplementaryCaseFiles` category stays denied and unused.
- **The Secretariat delivers each file explicitly.** The rules say it makes files available to the investment person; a company upload alone opens nothing.
- **Assigned chiefs, reviewers and employers read the published text.** The matrix allows this for reviewers "if needed", and the text is already company-visible.
- **The company's upload is not tied to an open request on the server.** T35 already allows correspondence files on its own case at any stage. The screen offers the field only once a request exists.
- **5,000 and 20,000 characters** are technical limits, not approved rules.

## Verification

- `apps/backend/tests/int/secretariat-follow-up.int.spec.ts` runs on real Postgres: the full flow, no publication before the explicit command, retries, stale and racing publishes, corrections, the notice, file delivery and its revocation, denial for each role outside the audience, history visibility, invalid input and the closed stage.
- `apps/backend/tests/access-policy.spec.ts` covers the file rule.
- `apps/frontend/tests/int/secretariat-follow-up-panel.int.spec.ts` covers the panel's denied, error and read-only states, the empty text box, preview before publish and a stale publish against a stubbed API. It is not evidence of the real integration.

## Not in this slice

The investment person's screen (FE20), a notification to the Secretariat when a memo or company file arrives, counts on the dashboard overview (T38), and [letters between the investment person and the Secretariat (T34)](authorization.md#role-scoped-correspondence--t34).
