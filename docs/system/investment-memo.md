# Investment memo (T32 / #48)

Backend slice that lets the person holding a [handed-off case (T31)](investment-handoff.md) write a memo and send it to the Secretariat. Human acceptance (UAT24) has not been run, and the screen (FE20) is not built. What the Secretariat does with a memo is [follow-up and publication (T33)](secretariat-follow-up.md).

## The memo

- Every save adds a version. No version's text changes afterwards, and no route deletes one.
- Saving the holder's latest unsent text again returns that version and writes nothing.
- Only the holder's own latest version can be sent. A repeated send returns the version already sent.
- A correction after sending is a new version that must be sent again. The earlier sent version stays as it was.
- A memo carries no decision. Saving and sending leave the request's status, stage and revision unchanged, and there is no approve, reject, return or voting command.

Save and send run under the request row lock and check the holder inside that transaction, so a revocation that committed first closes the write.

## API

| Route | Who | Behaviour |
| --- | --- | --- |
| `POST /investment/cases/:id/memo` | Investment person holding the case | Body `{ body }`, trimmed, at most 20,000 characters. `201 { memo }` for a new version, `200 { memo }` for a retry. `400 invalid_memo`; `404` without the case; `409 investment_stage_closed`. Every other role gets `403`. |
| `POST /investment/cases/:id/memo/send` | Investment person holding the case | Body `{ version }`. `200 { memo }`. `400 invalid_memo_version`; `404` for a version they did not write; `409 memo_version_stale` for a replaced version; `409 investment_stage_closed`. Every other role gets `403`. |
| `GET /investment/cases/:id` | Investment person holding the case | The [T31 dossier](investment-handoff.md) now includes `memos`: their own versions and every sent version, newest first. |
| `GET /investment/memos` | Secretariat, owner | `{ items, total, page, totalPages }`: every sent memo with its case, author and time, newest first. Every other role gets `403`. |
| `GET /requests/:id/investment-memos` | Secretariat, owner | `{ items }`, newest first: sent versions for the Secretariat, every version for the owner. Every other role gets `403`. |

A memo holds `id`, `requestId`, `packageId`, `version`, `body`, `authorId`, `createdAt` and `sentAt`. The two Secretariat routes add `authorName`.

## Confidentiality

| Reader | Sent versions | Drafts | `investment_memo_save` / `investment_memo_send` history |
| --- | --- | --- | --- |
| Owner | Yes | Yes | Yes |
| Secretariat | Yes | No | Yes |
| Investment person holding the case | Yes | Their own | Yes |
| Owning company, chief, reviewer, employer, another investment person | No | No | No |

The history rows hold no memo text. A new holder does not read the previous holder's draft and cannot send it.

## Migration

`1780511400033_investment_memos` creates `dashboard.investment_memos`. It rewrites no existing rows. Its rollback drops the table, so any memo is lost.

## Assumptions to confirm

- **A sent memo can be corrected by sending a new version.** The rules ask for one person, one memo and a preserved history; they do not say whether a sent memo is final. The plan's "internal memo versions" and the note that a memo may lead to another review cycle point this way.
- **Writing is open only while the case is at the advanced stage.** Reading stays open to the holder.
- **20,000 characters** is a technical limit, not an approved rule.

## Verification

`tests/int/investment-memo.int.spec.ts` runs on real Postgres: versions, retries, a stale send, a repeated send, the inbox with author and time, no change to the case, no decision routes, denial for each role outside the audience, the handoff gate, invalid input, reassignment, the closed stage and two racing saves.

## Not in this slice

The screen (FE20), a notification to the Secretariat when a memo arrives, and everything after receipt, which is [follow-up and publication (T33)](secretariat-follow-up.md).
