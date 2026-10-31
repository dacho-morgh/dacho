# Access and file matrix tests (T42 / #56)

Automated evidence for the [permission matrix](permission-matrix.md). Human acceptance has not been run. The expected audiences are written out in the specs from that document, not derived from the production policy.

## What is covered

Seven roles against three relations: their own case or company, another team's, and one they hold nothing on. The owner and Secretariat are Fund-wide, so all three stay open to them.

| Surface | Spec | Checks |
| --- | --- | --- |
| API | `apps/backend/tests/int/access-matrix.int.spec.ts` | 23 read routes on a case carried to a published result. A refusal is identical to the answer for an id that does not exist |
| Files | Same | Metadata and bytes for proposal, financial, company dossier, delivered and undelivered correspondence. The list holds exactly the permitted files, and no response holds a storage key |
| Counts | Same | `/requests`, `/admin/requests`, `/stats`, `/stats/overview`, `/activities` and both queues stay in the detail's scope. Query parameters do not widen it |
| Confidentiality | Same | Marked financial, dossier, memo and evaluation text never appears in a response outside its audience. A letter cannot carry a file to someone outside its audience |
| Skipping the screens | Same | One case walks every stage, and at the stage where each command would succeed, everyone else is refused and the case does not move. A person who cannot read the case gets the same answer as for an unknown id. Also forged owners, forged role headers, missing proxy proof, and revocation, role change and deactivation |
| CMS | `apps/frontend/tests/int/access-matrix.int.spec.ts` | Company records through REST, GraphQL and the Local API, company writes, identity fields, self-promotion, credentials in populated relations |
| Proxy | Same | The real route with real Payload authentication and a stubbed backend: only the session's identity is forwarded, forged headers are dropped, anonymous, deactivated and service accounts stop at the proxy, refusals and download headers pass through unchanged |

The earlier `apps/backend/tests/document-access-matrix.spec.ts` still covers the policy function across every category and context.

## Corrected

A refusal could confirm that a case exists, because a real case answered `403` and an unknown id `404`. This affected `GET /requests/:id/evaluation`, `GET /requests/:id/review-round/candidates`, triage, the chief decision, starting a round, replacing a reviewer, saving and finalizing an evaluation, and deleting a file. Someone who cannot read the case or file now gets the same `404` as an unknown id, as [shared authorization](authorization.md) requires. Someone who can read it but may not act still gets `403`.

## Known gaps

- **CMS GraphQL does not work.** Payload cannot build the schema, because the Persian options of the company `type` field are not valid enum names. The endpoint serves nobody, so it leaks nothing, and the spec's checks still hold if it is repaired. Only the failure in the test process was observed, not on a running server.
- **The proxy and backend are tested apart.** The frontend spec stubs the backend, and the backend spec sends the proxy's headers itself. A browser journey across both belongs to T45.
- Exhibition booths and receipts are not in this matrix. T54 covers that path.

## Checking the tests themselves

Each of these temporary changes made the specs fail, and each was reverted:

| Change | Failed tests |
| --- | --- |
| Chief, reviewer and employer may read any file on their case | 4 |
| Investment person reads financial files without assignment or handoff | 3 |
| `/activities` ignores the assigned person | 8 |
| Proxy forwards the browser's `x-user-id` | 7 |
| Proxy admits deactivated and service accounts | 3 |
| CMS company read open to everyone | 25 |
