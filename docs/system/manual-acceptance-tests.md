# Human acceptance test catalogue

Updated 2026-10-23. **42 manual gates; none executed by writing this catalogue.** All 55 implementation tasks are covered by one or more gates. Technical foundations use an operator/review gate where a browser-only test would be misleading.

## Execution process

1. Product Owner and QA review scope and open inputs (UAT42). Operator confirms an isolated staging URL, database and document area. Never use real company documents or real bank transfers.
2. Engineering deploys a coherent slice and records build/commit. A login gate can run as soon as T11 is ready; it does not wait for the entire event system.
3. A human tester uses the stated role accounts and performs each Action. Compare actual behavior with each Expected result; do not infer results from code or issue status.
4. Record Pass, Fail or Blocked with evidence. Missing build, final rubric, approved agreement text, file policy or fixture is Blocked, never Pass.
5. Keep failed/blocked test issues open, link defects, fix and rerun against a recorded build. Close a gate only after all expected results pass. Independent slice gates do not replace the full event/exhibition walkthrough.

## Shared synthetic fixture pack

- Separate browser sessions: System Owner, Central Secretariat, Chiefs E1/E2, employer reviewer, ordinary reviewers R1/R2/R3 plus a replacement/unassigned reviewer, investment people E1/E2, Companies A/B.
- Companies: incomplete, pending, returned and approved; include a recently established company. Use unused synthetic national IDs and test-only credentials.
- Events E1/E2 with separate responsible teams; at least two subtopics in E1 with distinct RFP files and different employers where needed.
- Exhibition X1 with at least three distinguishable booths/prices and configurable company limit (use two for cap tests).
- Distinguishable valid company/proposal/financial/receipt files and controlled invalid fixtures, prepared only after approved category policies are supplied.
- Known expected list counts, application revisions and review rounds. Final rubric includes independently calculated expected values once product-approved.
- Operator-assisted notification failure and disposable migration/restore fixtures. Human concurrency smoke requires two testers/sessions and companion automated evidence.

## Evidence template

| Field | Record |
| --- | --- |
| Gate / related implementation | UAT ID and linked issues |
| Build / environment | Commit/build and staging URL |
| Tester / date | Named human and execution date |
| Roles / fixtures | Account roles, synthetic company/event/case/booth IDs; never passwords |
| Per-step result | Actual outcome against every expected result |
| Evidence | Screenshot/recording, relevant IDs, visible state and time |
| Outcome | Not run / In progress / Pass / Fail / Blocked |
| Defects or missing input | Linked issue IDs and reason |
| Rerun | Fix/build/date and rerun result; retain earlier failures |

## Gate index

| Gate | Human acceptance slice | Engineering prerequisites |
| --- | --- | --- |

| [UAT01](https://github.com/dacho-morgh/dacho/issues/102) | Password login, logout and session access | [T11](https://github.com/dacho-morgh/dacho/issues/25); frontend: [FE02](https://github.com/dacho-morgh/dacho/issues/72) |
| [UAT02](https://github.com/dacho-morgh/dacho/issues/103) | Atomic signup and duplicate company protection | [T11](https://github.com/dacho-morgh/dacho/issues/25); frontend: [FE03](https://github.com/dacho-morgh/dacho/issues/80) |
| [UAT03](https://github.com/dacho-morgh/dacho/issues/104) | Personnel creation and single operational role | [T08](https://github.com/dacho-morgh/dacho/issues/22); frontend: [FE01](https://github.com/dacho-morgh/dacho/issues/70), [FE08](https://github.com/dacho-morgh/dacho/issues/73) |
| [UAT04](https://github.com/dacho-morgh/dacho/issues/105) | Company dossier, addresses and executives persist | [T05](https://github.com/dacho-morgh/dacho/issues/19), [T13](https://github.com/dacho-morgh/dacho/issues/27); frontend: [FE04](https://github.com/dacho-morgh/dacho/issues/82) |
| [UAT05](https://github.com/dacho-morgh/dacho/issues/106) | Private company documents and direct download isolation | [T06](https://github.com/dacho-morgh/dacho/issues/20), [T10](https://github.com/dacho-morgh/dacho/issues/24); frontend: [FE04](https://github.com/dacho-morgh/dacho/issues/82), [FE07](https://github.com/dacho-morgh/dacho/issues/71) |
| [UAT06](https://github.com/dacho-morgh/dacho/issues/107) | Verification return, correction, resubmission and approval | [T14](https://github.com/dacho-morgh/dacho/issues/33); frontend: [FE04](https://github.com/dacho-morgh/dacho/issues/82), [FE05](https://github.com/dacho-morgh/dacho/issues/84) |
| [UAT07](https://github.com/dacho-morgh/dacho/issues/108) | Eligibility gate and identity re-verification | [T15](https://github.com/dacho-morgh/dacho/issues/34); frontend: [FE05](https://github.com/dacho-morgh/dacho/issues/84), [FE06](https://github.com/dacho-morgh/dacho/issues/85) |
| [UAT08](https://github.com/dacho-morgh/dacho/issues/109) | Event creation, registration window and event teams | [T16](https://github.com/dacho-morgh/dacho/issues/28); frontend: [FE08](https://github.com/dacho-morgh/dacho/issues/73), [FE09](https://github.com/dacho-morgh/dacho/issues/81), [FE11](https://github.com/dacho-morgh/dacho/issues/74) |
| [UAT09](https://github.com/dacho-morgh/dacho/issues/110) | Categories, subtopics, employer and correct RFP | [T17](https://github.com/dacho-morgh/dacho/issues/29), [T18](https://github.com/dacho-morgh/dacho/issues/30); frontend: [FE07](https://github.com/dacho-morgh/dacho/issues/71), [FE10](https://github.com/dacho-morgh/dacho/issues/83), [FE11](https://github.com/dacho-morgh/dacho/issues/74) |
| [UAT10](https://github.com/dacho-morgh/dacho/issues/111) | Independent subtopic applications and company ownership | [T12](https://github.com/dacho-morgh/dacho/issues/26), [T19](https://github.com/dacho-morgh/dacho/issues/35); frontend: [FE06](https://github.com/dacho-morgh/dacho/issues/85), [FE11](https://github.com/dacho-morgh/dacho/issues/74), [FE12](https://github.com/dacho-morgh/dacho/issues/86), [FE13](https://github.com/dacho-morgh/dacho/issues/88) |
| [UAT11](https://github.com/dacho-morgh/dacho/issues/112) | Proposal draft, fixed form and versioned consent | [T03](https://github.com/dacho-morgh/dacho/issues/17), [T20](https://github.com/dacho-morgh/dacho/issues/36); frontend: [FE07](https://github.com/dacho-morgh/dacho/issues/71), [FE12](https://github.com/dacho-morgh/dacho/issues/86) |
| [UAT12](https://github.com/dacho-morgh/dacho/issues/113) | Chief return and same-case correction | [T21](https://github.com/dacho-morgh/dacho/issues/37); frontend: [FE13](https://github.com/dacho-morgh/dacho/issues/88), [FE14](https://github.com/dacho-morgh/dacho/issues/90) |
| [UAT13](https://github.com/dacho-morgh/dacho/issues/114) | Terminal rejection scope and owner reopen | [T21](https://github.com/dacho-morgh/dacho/issues/37); frontend: [FE13](https://github.com/dacho-morgh/dacho/issues/88), [FE14](https://github.com/dacho-morgh/dacho/issues/90) |
| [UAT14](https://github.com/dacho-morgh/dacho/issues/115) | Assign fixed employer and three distinct reviewers | [T22](https://github.com/dacho-morgh/dacho/issues/38); frontend: [FE15](https://github.com/dacho-morgh/dacho/issues/92) |
| [UAT15](https://github.com/dacho-morgh/dacho/issues/116) | Assigned-only reviewer dossier and own-evaluation privacy | [T23](https://github.com/dacho-morgh/dacho/issues/39), [T09](https://github.com/dacho-morgh/dacho/issues/23); frontend: [FE01](https://github.com/dacho-morgh/dacho/issues/70), [FE16](https://github.com/dacho-morgh/dacho/issues/94), [FE30](https://github.com/dacho-morgh/dacho/issues/79) |
| [UAT16](https://github.com/dacho-morgh/dacho/issues/117) | Review rubric validation and score computation | [T24](https://github.com/dacho-morgh/dacho/issues/40); frontend: [FE17](https://github.com/dacho-morgh/dacho/issues/96) |
| [UAT17](https://github.com/dacho-morgh/dacho/issues/118) | Evaluation draft, final submission and lock | [T25](https://github.com/dacho-morgh/dacho/issues/41); frontend: [FE17](https://github.com/dacho-morgh/dacho/issues/96) |
| [UAT18](https://github.com/dacho-morgh/dacho/issues/119) | Reviewer replacement and employer exception | [T26](https://github.com/dacho-morgh/dacho/issues/42); frontend: [FE15](https://github.com/dacho-morgh/dacho/issues/92) |
| [UAT19](https://github.com/dacho-morgh/dacho/issues/120) | Four-of-four readiness without automatic advancement | [T27](https://github.com/dacho-morgh/dacho/issues/43); frontend: [FE15](https://github.com/dacho-morgh/dacho/issues/92), [FE16](https://github.com/dacho-morgh/dacho/issues/94), [FE18](https://github.com/dacho-morgh/dacho/issues/97) |
| [UAT20](https://github.com/dacho-morgh/dacho/issues/121) | Chief decision and corrected-proposal review round | [T28](https://github.com/dacho-morgh/dacho/issues/44); frontend: [FE13](https://github.com/dacho-morgh/dacho/issues/88), [FE14](https://github.com/dacho-morgh/dacho/issues/90), [FE18](https://github.com/dacho-morgh/dacho/issues/97) |
| [UAT21](https://github.com/dacho-morgh/dacho/issues/122) | Financial-stage invitation and timing | [T29](https://github.com/dacho-morgh/dacho/issues/45); frontend: [FE18](https://github.com/dacho-morgh/dacho/issues/97), [FE19](https://github.com/dacho-morgh/dacho/issues/98) |
| [UAT22](https://github.com/dacho-morgh/dacho/issues/123) | Financial package completion, versions and younger company | [T30](https://github.com/dacho-morgh/dacho/issues/46); frontend: [FE07](https://github.com/dacho-morgh/dacho/issues/71), [FE19](https://github.com/dacho-morgh/dacho/issues/98) |
| [UAT23](https://github.com/dacho-morgh/dacho/issues/124) | Investment assignment and financial confidentiality | [T31](https://github.com/dacho-morgh/dacho/issues/47); frontend: [FE19](https://github.com/dacho-morgh/dacho/issues/98), [FE20](https://github.com/dacho-morgh/dacho/issues/99), [FE30](https://github.com/dacho-morgh/dacho/issues/79) |
| [UAT24](https://github.com/dacho-morgh/dacho/issues/125) | Investment memo handoff without decision controls | [T32](https://github.com/dacho-morgh/dacho/issues/48); frontend: [FE20](https://github.com/dacho-morgh/dacho/issues/99) |
| [UAT25](https://github.com/dacho-morgh/dacho/issues/126) | Supplementary financial documents through Secretariat | [T33](https://github.com/dacho-morgh/dacho/issues/51), [T35](https://github.com/dacho-morgh/dacho/issues/50); frontend: [FE07](https://github.com/dacho-morgh/dacho/issues/71), [FE19](https://github.com/dacho-morgh/dacho/issues/98), [FE21](https://github.com/dacho-morgh/dacho/issues/100), [FE22](https://github.com/dacho-morgh/dacho/issues/75) |
| [UAT26](https://github.com/dacho-morgh/dacho/issues/127) | Secretariat publication and company-visible outcome | [T33](https://github.com/dacho-morgh/dacho/issues/51); frontend: [FE13](https://github.com/dacho-morgh/dacho/issues/88), [FE21](https://github.com/dacho-morgh/dacho/issues/100) |
| [UAT27](https://github.com/dacho-morgh/dacho/issues/128) | Role-specific messaging and attachment permissions | [T34](https://github.com/dacho-morgh/dacho/issues/49), [T35](https://github.com/dacho-morgh/dacho/issues/50); frontend: [FE22](https://github.com/dacho-morgh/dacho/issues/75) |
| [UAT28](https://github.com/dacho-morgh/dacho/issues/129) | History, notifications and retry visibility | [T36](https://github.com/dacho-morgh/dacho/issues/31), [T37](https://github.com/dacho-morgh/dacho/issues/32); frontend: [FE23](https://github.com/dacho-morgh/dacho/issues/76) |
| [UAT29](https://github.com/dacho-morgh/dacho/issues/130) | Queues, counts and shared dossier actions | [T38](https://github.com/dacho-morgh/dacho/issues/52), [T39](https://github.com/dacho-morgh/dacho/issues/53); frontend: [FE01](https://github.com/dacho-morgh/dacho/issues/70), [FE23](https://github.com/dacho-morgh/dacho/issues/76) |
| [UAT30](https://github.com/dacho-morgh/dacho/issues/131) | RTL, mobile, keyboard and error states | [T40](https://github.com/dacho-morgh/dacho/issues/54); frontend: [FE29](https://github.com/dacho-morgh/dacho/issues/78) |
| [UAT31](https://github.com/dacho-morgh/dacho/issues/132) | Booth catalogue, prices, guide map and company limit | [T47](https://github.com/dacho-morgh/dacho/issues/61); frontend: [FE24](https://github.com/dacho-morgh/dacho/issues/77) |
| [UAT32](https://github.com/dacho-morgh/dacho/issues/133) | Independent booth requests, reservations and company cap | [T48](https://github.com/dacho-morgh/dacho/issues/62); frontend: [FE25](https://github.com/dacho-morgh/dacho/issues/87) |
| [UAT33](https://github.com/dacho-morgh/dacho/issues/134) | Separate attendance approval before payment | [T55](https://github.com/dacho-morgh/dacho/issues/63); frontend: [FE06](https://github.com/dacho-morgh/dacho/issues/85), [FE26](https://github.com/dacho-morgh/dacho/issues/89) |
| [UAT34](https://github.com/dacho-morgh/dacho/issues/135) | Independent booth price snapshot and currency | [T49](https://github.com/dacho-morgh/dacho/issues/64); frontend: [FE25](https://github.com/dacho-morgh/dacho/issues/87), [FE27](https://github.com/dacho-morgh/dacho/issues/91) |
| [UAT35](https://github.com/dacho-morgh/dacho/issues/136) | Independent receipt submission and duplicate protection | [T50](https://github.com/dacho-morgh/dacho/issues/65); frontend: [FE07](https://github.com/dacho-morgh/dacho/issues/71), [FE27](https://github.com/dacho-morgh/dacho/issues/91) |
| [UAT36](https://github.com/dacho-morgh/dacho/issues/137) | Receipt correction preserves reservation; confirmation is idempotent | [T51](https://github.com/dacho-morgh/dacho/issues/66); frontend: [FE27](https://github.com/dacho-morgh/dacho/issues/91) |
| [UAT37](https://github.com/dacho-morgh/dacho/issues/138) | Cancellation before/after receipt and manual refund record | [T52](https://github.com/dacho-morgh/dacho/issues/67); frontend: [FE28](https://github.com/dacho-morgh/dacho/issues/93) |
| [UAT38](https://github.com/dacho-morgh/dacho/issues/139) | Two-session concurrency smoke test | [T07](https://github.com/dacho-morgh/dacho/issues/21), [T27](https://github.com/dacho-morgh/dacho/issues/43), [T44](https://github.com/dacho-morgh/dacho/issues/58), [T48](https://github.com/dacho-morgh/dacho/issues/62); frontend: [FE30](https://github.com/dacho-morgh/dacho/issues/79) |
| [UAT39](https://github.com/dacho-morgh/dacho/issues/140) | Full event human acceptance walkthrough | [T42](https://github.com/dacho-morgh/dacho/issues/56), [T43](https://github.com/dacho-morgh/dacho/issues/57), [T45](https://github.com/dacho-morgh/dacho/issues/59), [T46](https://github.com/dacho-morgh/dacho/issues/60); frontend: [FE31](https://github.com/dacho-morgh/dacho/issues/101) |
| [UAT40](https://github.com/dacho-morgh/dacho/issues/141) | Full exhibition human acceptance walkthrough | [T53](https://github.com/dacho-morgh/dacho/issues/68), [T54](https://github.com/dacho-morgh/dacho/issues/69); frontend: [FE32](https://github.com/dacho-morgh/dacho/issues/95) |
| [UAT41](https://github.com/dacho-morgh/dacho/issues/142) | Operator migration and backup/restore rehearsal | [T41](https://github.com/dacho-morgh/dacho/issues/55), [T46](https://github.com/dacho-morgh/dacho/issues/60) |
| [UAT42](https://github.com/dacho-morgh/dacho/issues/143) | Human readiness review: scope, permissions and safe test fixtures | [T01](https://github.com/dacho-morgh/dacho/issues/15), [T02](https://github.com/dacho-morgh/dacho/issues/16), [T03](https://github.com/dacho-morgh/dacho/issues/17), [T04](https://github.com/dacho-morgh/dacho/issues/18); frontend: [FE30](https://github.com/dacho-morgh/dacho/issues/79) |

<a id="uat01"></a>

## UAT01 — Password login, logout and session access

Human acceptance gate for **Password login, logout and session access**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T11 — #25](https://github.com/dacho-morgh/dacho/issues/25)

Frontend implementation slices:
- [FE02 — #72](https://github.com/dacho-morgh/dacho/issues/72)

**Actors:** Company A representative.

**Fixture/precondition:** A registered company account with known test password.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Sign in with phone and password, then repeat in a fresh session with email
   **Expected:** Both identify the same company and open its panel.
2. **Action:** Try an incorrect password and an unknown account
   **Expected:** No authenticated panel or account data is disclosed; a usable error appears.
3. **Action:** Log out and open the saved private panel URL in a fresh tab
   **Expected:** Authentication is required again; browser navigation does not restore private access.
4. **Action:** Sign back in
   **Expected:** The same company profile and prior data load, without duplicate accounts.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT01 -->


<a id="uat02"></a>

## UAT02 — Atomic signup and duplicate company protection

Human acceptance gate for **Atomic signup and duplicate company protection**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T11 — #25](https://github.com/dacho-morgh/dacho/issues/25)

Frontend implementation slices:
- [FE03 — #80](https://github.com/dacho-morgh/dacho/issues/80)

**Actors:** New company representative.

**Fixture/precondition:** Unused synthetic company national ID; separate administrator browser session.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Register full company name, national ID, activity, representative name/position/phone/email and password
   **Expected:** One person and one company are created; panel access works.
2. **Action:** Observe participation before verification
   **Expected:** Panel/profile completion is available, formal event/booth application is blocked.
3. **Action:** Repeat signup with the same company national ID
   **Expected:** Clear duplicate error; no second company or stranded user is created.
4. **Action:** Repeat public signup while an administrator session exists in another browser
   **Expected:** New account remains a company representative and receives no internal privileges.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT02 -->


<a id="uat03"></a>

## UAT03 — Personnel creation and single operational role

Human acceptance gate for **Personnel creation and single operational role**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T08 — #22](https://github.com/dacho-morgh/dacho/issues/22)

Frontend implementation slices:
- [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70)
- [FE08 — #73](https://github.com/dacho-morgh/dacho/issues/73)

**Actors:** System Owner; newly created reviewer.

**Fixture/precondition:** Owner account and synthetic staff identity.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Create an internal user and assign Reviewer
   **Expected:** User can sign in with only the assigned operational role.
2. **Action:** Attempt to grant a second operational role
   **Expected:** The system prevents multiple operational roles and explains the constraint.
3. **Action:** Use the reviewer account to open personnel administration
   **Expected:** Access is denied; the owner can still manage personnel.
4. **Action:** Deactivate the reviewer and retry its private URLs in a fresh session
   **Expected:** Active access is removed while historical attribution is retained.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT03 -->


<a id="uat04"></a>

## UAT04 — Company dossier, addresses and executives persist

Human acceptance gate for **Company dossier, addresses and executives persist**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T05 — #19](https://github.com/dacho-morgh/dacho/issues/19)
- [T13 — #27](https://github.com/dacho-morgh/dacho/issues/27)

Frontend implementation slices:
- [FE04 — #82](https://github.com/dacho-morgh/dacho/issues/82)

**Actors:** Company A representative.

**Fixture/precondition:** Company account and approved synthetic document fixtures.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Complete company classification, legal type, location, needs, founding year, key members, projects/customers, insured employee count and available documents
   **Expected:** Required missing items are identified; legal type and knowledge-based status remain separate.
2. **Action:** Add and edit multiple addresses and executives; mark absent website/certificates/residency as Does not have
   **Expected:** Explicit absence is accepted where permitted and data saves.
3. **Action:** Sign out, sign back in and open profile/resume
   **Expected:** Saved addresses, people and document references survive real storage/reload.
4. **Action:** Open the company from an authorized Secretariat account
   **Expected:** The same submitted data appears without missing arrays or placeholder-only resume content.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT04 -->


<a id="uat05"></a>

## UAT05 — Private company documents and direct download isolation

Human acceptance gate for **Private company documents and direct download isolation**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T06 — #20](https://github.com/dacho-morgh/dacho/issues/20)
- [T10 — #24](https://github.com/dacho-morgh/dacho/issues/24)

Frontend implementation slices:
- [FE04 — #82](https://github.com/dacho-morgh/dacho/issues/82)
- [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71)

**Actors:** Companies A and B; authorized Secretariat.

**Fixture/precondition:** A and B have separate accounts and synthetic private documents.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Upload a policy-valid company document as A and download it
   **Expected:** Correct contents and ownership are preserved.
2. **Action:** Copy the document and private profile URLs into B and a logged-out browser
   **Expected:** Both private reads are denied; no sensitive metadata is exposed.
3. **Action:** Inspect public company-directory presentation
   **Expected:** Only intentionally public fields appear; registration/verification dossier is absent.
4. **Action:** Try an invalid upload and retry an interrupted upload
   **Expected:** A clear error appears; no phantom completed document or workflow advancement occurs.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT05 -->


<a id="uat06"></a>

## UAT06 — Verification return, correction, resubmission and approval

Human acceptance gate for **Verification return, correction, resubmission and approval**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T14 — #33](https://github.com/dacho-morgh/dacho/issues/33)

Frontend implementation slices:
- [FE04 — #82](https://github.com/dacho-morgh/dacho/issues/82)
- [FE05 — #84](https://github.com/dacho-morgh/dacho/issues/84)

**Actors:** Company A; Secretariat.

**Fixture/precondition:** A completed synthetic company dossier awaiting verification.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Submit the profile for verification
   **Expected:** Secretariat receives the submitted revision; company sees pending status.
2. **Action:** Return or reject documents with a reason
   **Expected:** Company sees that reason and can edit the same company profile.
3. **Action:** Correct and resubmit
   **Expected:** Same company identity is used; previous submission/decision remains in history.
4. **Action:** Approve as Secretariat and inspect the company account
   **Expected:** Approval actor/time and eligibility are visible; company cannot approve itself.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT06 -->


<a id="uat07"></a>

## UAT07 — Eligibility gate and identity re-verification

Human acceptance gate for **Eligibility gate and identity re-verification**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T15 — #34](https://github.com/dacho-morgh/dacho/issues/34)

Frontend implementation slices:
- [FE05 — #84](https://github.com/dacho-morgh/dacho/issues/84)
- [FE06 — #85](https://github.com/dacho-morgh/dacho/issues/85)

**Actors:** Company A; Secretariat.

**Fixture/precondition:** One incomplete company and one approved company with an existing application.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Attempt formal event application and booth reservation as incomplete/pending company
   **Expected:** Both are refused with a route to profile completion.
2. **Action:** Approve the complete company and repeat valid participation
   **Expected:** Event/booth actions become available within their other rules.
3. **Action:** Change approved identity or registration documents
   **Expected:** Renewed verification is required for new participation.
4. **Action:** Open an application submitted before the edit
   **Expected:** It retains the approved company snapshot from its original submission.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT07 -->


<a id="uat08"></a>

## UAT08 — Event creation, registration window and event teams

Human acceptance gate for **Event creation, registration window and event teams**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T16 — #28](https://github.com/dacho-morgh/dacho/issues/28)

Frontend implementation slices:
- [FE08 — #73](https://github.com/dacho-morgh/dacho/issues/73)
- [FE09 — #81](https://github.com/dacho-morgh/dacho/issues/81)
- [FE11 — #74](https://github.com/dacho-morgh/dacho/issues/74)

**Actors:** Owner; Chiefs E1 and E2.

**Fixture/precondition:** Two synthetic events and separate chief/investment accounts.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Create E1 and E2 with registration windows and separate responsible teams
   **Expected:** Correct definitions persist and appear in the panel.
2. **Action:** Open E1 work as its responsible chief, then as the E2 chief
   **Expected:** Only authorized event work is available.
3. **Action:** Attempt application outside the configured registration window
   **Expected:** Formal submission is blocked with a clear message.
4. **Action:** Reload event configuration
   **Expected:** Responsible people, dates and event identity remain correct.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT08 -->


<a id="uat09"></a>

## UAT09 — Categories, subtopics, employer and correct RFP

Human acceptance gate for **Categories, subtopics, employer and correct RFP**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T17 — #29](https://github.com/dacho-morgh/dacho/issues/29)
- [T18 — #30](https://github.com/dacho-morgh/dacho/issues/30)

Frontend implementation slices:
- [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71)
- [FE10 — #83](https://github.com/dacho-morgh/dacho/issues/83)
- [FE11 — #74](https://github.com/dacho-morgh/dacho/issues/74)

**Actors:** Owner; Company A.

**Fixture/precondition:** E1 with two technology categories and distinguishable RFP fixture files.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Create subtopics and assign one employer reviewer plus the correct RFP per subtopic
   **Expected:** Relationships persist and company sees the matching names/files.
2. **Action:** Switch company selection between subtopics and download each RFP
   **Expected:** Each download contains the correct distinguishable fixture.
3. **Action:** Attempt an invalid cross-event category/subtopic or ineligible employer assignment
   **Expected:** Configuration is rejected rather than silently mismatched.
4. **Action:** Change the current RFP after an application was submitted
   **Expected:** Earlier application still references its submitted RFP version.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT09 -->


<a id="uat10"></a>

## UAT10 — Independent subtopic applications and company ownership

Human acceptance gate for **Independent subtopic applications and company ownership**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T12 — #26](https://github.com/dacho-morgh/dacho/issues/26)
- [T19 — #35](https://github.com/dacho-morgh/dacho/issues/35)

Frontend implementation slices:
- [FE06 — #85](https://github.com/dacho-morgh/dacho/issues/85)
- [FE11 — #74](https://github.com/dacho-morgh/dacho/issues/74)
- [FE12 — #86](https://github.com/dacho-morgh/dacho/issues/86)
- [FE13 — #88](https://github.com/dacho-morgh/dacho/issues/88)

**Actors:** Company A; Company B.

**Fixture/precondition:** Approved A/B; two E1 subtopics and one E2 subtopic.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Apply as A to two E1 subtopics
   **Expected:** Two separate application IDs/tracking codes, statuses and dossiers appear.
2. **Action:** Change or reject one application
   **Expected:** The other application remains independent.
3. **Action:** Attempt another active duplicate or a mismatched event/subtopic request
   **Expected:** Duplicate/invalid selection is rejected.
4. **Action:** Open A application URL as B and inspect B counts
   **Expected:** No case data or counts from A are disclosed.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT10 -->


<a id="uat11"></a>

## UAT11 — Proposal draft, fixed form and versioned consent

Human acceptance gate for **Proposal draft, fixed form and versioned consent**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T03 — #17](https://github.com/dacho-morgh/dacho/issues/17)
- [T20 — #36](https://github.com/dacho-morgh/dacho/issues/36)

Frontend implementation slices:
- [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71)
- [FE12 — #86](https://github.com/dacho-morgh/dacho/issues/86)

**Actors:** Company A.

**Fixture/precondition:** Approved company, valid subtopic/RFP, approved form and agreement text.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Enter application answers, key members and proposal, save draft and reload
   **Expected:** Saved draft is recoverable and not yet a submitted review case.
2. **Action:** Try final submit without required answer/file or agreement acceptance
   **Expected:** Submission is blocked and missing items are identified.
3. **Action:** Accept non-compete/rules and submit a policy-valid proposal
   **Expected:** One submitted revision records actor/time and text/form/RFP versions.
4. **Action:** Double-click submit or refresh the result
   **Expected:** No duplicate application, tracking code or effective submission is created.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT11 -->


<a id="uat12"></a>

## UAT12 — Chief return and same-case correction

Human acceptance gate for **Chief return and same-case correction**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T21 — #37](https://github.com/dacho-morgh/dacho/issues/37)

Frontend implementation slices:
- [FE13 — #88](https://github.com/dacho-morgh/dacho/issues/88)
- [FE14 — #90](https://github.com/dacho-morgh/dacho/issues/90)

**Actors:** Responsible chief; Company A.

**Fixture/precondition:** A submitted application in initial chief triage.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Open the application as responsible chief and return it with specific corrections
   **Expected:** Company sees correction-required status and reason.
2. **Action:** Open as company, correct permitted answers/proposal and resubmit
   **Expected:** Same application/tracking identity receives a new revision.
3. **Action:** Inspect both versions and transition history
   **Expected:** Prior contents and actors remain traceable.
4. **Action:** Try editing a submitted case without an authorized correction state
   **Expected:** Ordinary company edits are refused.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT12 -->


<a id="uat13"></a>

## UAT13 — Terminal rejection scope and owner reopen

Human acceptance gate for **Terminal rejection scope and owner reopen**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T21 — #37](https://github.com/dacho-morgh/dacho/issues/37)

Frontend implementation slices:
- [FE13 — #88](https://github.com/dacho-morgh/dacho/issues/88)
- [FE14 — #90](https://github.com/dacho-morgh/dacho/issues/90)

**Actors:** Chief; Company A; Owner.

**Fixture/precondition:** Two independent applications by A to different E1 subtopics.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Reject one application with reason
   **Expected:** It is terminal for that company/event/subtopic and the reason is visible.
2. **Action:** Try applying again to that rejected subtopic, then use the other subtopic
   **Expected:** Reapplication is blocked only in the rejected scope; the other remains usable.
3. **Action:** Try reopen as company or ordinary reviewer
   **Expected:** Reopen is denied.
4. **Action:** Reopen as Owner with reason
   **Expected:** The same case/history reopens and owner action is recorded.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT13 -->


<a id="uat14"></a>

## UAT14 — Assign fixed employer and three distinct reviewers

Human acceptance gate for **Assign fixed employer and three distinct reviewers**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T22 — #38](https://github.com/dacho-morgh/dacho/issues/38)

Frontend implementation slices:
- [FE15 — #92](https://github.com/dacho-morgh/dacho/issues/92)

**Actors:** Responsible chief; employer; Reviewers R1–R3.

**Fixture/precondition:** A triaged application and eligible reviewer accounts.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Start the review round
   **Expected:** Subtopic employer automatically occupies the fixed employer slot.
2. **Action:** Select three distinct ordinary reviewers and submit
   **Expected:** Four distinct active assignments are created for the proposal revision.
3. **Action:** Try duplicate people, fewer than three ordinary reviewers or replacing the fixed employer as chief
   **Expected:** Invalid assignment is refused.
4. **Action:** Open each assigned reviewer account
   **Expected:** The correct case appears once in each queue.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT14 -->


<a id="uat15"></a>

## UAT15 — Assigned-only reviewer dossier and own-evaluation privacy

Human acceptance gate for **Assigned-only reviewer dossier and own-evaluation privacy**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T23 — #39](https://github.com/dacho-morgh/dacho/issues/39)
- [T09 — #23](https://github.com/dacho-morgh/dacho/issues/23)

Frontend implementation slices:
- [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70)
- [FE16 — #94](https://github.com/dacho-morgh/dacho/issues/94)
- [FE30 — #79](https://github.com/dacho-morgh/dacho/issues/79)

**Actors:** Reviewer R1; unassigned reviewer; Company B.

**Fixture/precondition:** One active assignment for R1 and another case not assigned to R1.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Open R1 assigned application and necessary company profile
   **Expected:** Correct proposal/RFP and permitted profile data are readable.
2. **Action:** Open unassigned case/company URLs as R1
   **Expected:** Access is denied even with copied URLs.
3. **Action:** Open another reviewer evaluation or financial-stage document
   **Expected:** R1 cannot see others scores, memo or financial files.
4. **Action:** Compare reviewer queue and counts
   **Expected:** They include assigned authorized cases only.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT15 -->


<a id="uat16"></a>

## UAT16 — Review rubric validation and score computation

Human acceptance gate for **Review rubric validation and score computation**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T24 — #40](https://github.com/dacho-morgh/dacho/issues/40)

Frontend implementation slices:
- [FE17 — #96](https://github.com/dacho-morgh/dacho/issues/96)

**Actors:** Assigned reviewer; QA.

**Fixture/precondition:** Final product-approved rubric, ceilings and formula. Blocked until supplied.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Enter a known valid answer set with independently calculated expected score
   **Expected:** Displayed/server-returned totals match the approved formula.
2. **Action:** Try missing required answers and values below/above approved ranges
   **Expected:** Final submission is refused with field-level guidance.
3. **Action:** Change a displayed total/client value while keeping answers unchanged using a QA-provided controlled test method
   **Expected:** Server does not trust the tampered total.
4. **Action:** Inspect completion before chief action
   **Expected:** Even a high final score does not automatically advance the application.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT16 -->


<a id="uat17"></a>

## UAT17 — Evaluation draft, final submission and lock

Human acceptance gate for **Evaluation draft, final submission and lock**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T25 — #41](https://github.com/dacho-morgh/dacho/issues/41)

Frontend implementation slices:
- [FE17 — #96](https://github.com/dacho-morgh/dacho/issues/96)

**Actors:** Assigned reviewer; Chief.

**Fixture/precondition:** Approved rubric and an assigned application.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Fill part of evaluation, save draft and reload
   **Expected:** Own draft persists and completion count does not increase.
2. **Action:** Try finalizing an incomplete required form set
   **Expected:** Validation blocks finalization.
3. **Action:** Complete all required forms and finalize
   **Expected:** One finalized evaluation is recorded and count increases once.
4. **Action:** Retry finalization and attempt ordinary editing
   **Expected:** No duplicate count; finalized content is locked.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT17 -->


<a id="uat18"></a>

## UAT18 — Reviewer replacement and employer exception

Human acceptance gate for **Reviewer replacement and employer exception**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T26 — #42](https://github.com/dacho-morgh/dacho/issues/42)

Frontend implementation slices:
- [FE15 — #92](https://github.com/dacho-morgh/dacho/issues/92)

**Actors:** Chief; Owner; old/new reviewers.

**Fixture/precondition:** Incomplete ordinary assignment and an employer assignment.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Replace an unfinished ordinary reviewer as chief
   **Expected:** Replacement receives the case and old assignment is retained as history.
2. **Action:** Open saved case/file URLs as the replaced reviewer
   **Expected:** Current access is denied.
3. **Action:** Try changing employer as chief
   **Expected:** Action is denied.
4. **Action:** Replace employer as Owner with a reason
   **Expected:** New fixed assignee is recorded with actor/reason/history, without erasing earlier attribution.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT18 -->


<a id="uat19"></a>

## UAT19 — Four-of-four readiness without automatic advancement

Human acceptance gate for **Four-of-four readiness without automatic advancement**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T27 — #43](https://github.com/dacho-morgh/dacho/issues/43)

Frontend implementation slices:
- [FE15 — #92](https://github.com/dacho-morgh/dacho/issues/92)
- [FE16 — #94](https://github.com/dacho-morgh/dacho/issues/94)
- [FE18 — #97](https://github.com/dacho-morgh/dacho/issues/97)

**Actors:** Four assigned reviewers; Chief.

**Fixture/precondition:** Approved rubric and active current-round assignments.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Finalize one, then two, then three evaluations
   **Expected:** Progress reads 1/4, 2/4 and 3/4 and advancement remains unavailable.
2. **Action:** Inspect each reviewer account
   **Expected:** Each sees only own evaluation, even when the chief sees aggregate progress.
3. **Action:** Finalize the fourth valid evaluation
   **Expected:** Current round becomes ready exactly once.
4. **Action:** Open company and chief panels before chief approval
   **Expected:** Company has not advanced to financial intake automatically; chief must explicitly decide.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT19 -->


<a id="uat20"></a>

## UAT20 — Chief decision and corrected-proposal review round

Human acceptance gate for **Chief decision and corrected-proposal review round**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T28 — #44](https://github.com/dacho-morgh/dacho/issues/44)

Frontend implementation slices:
- [FE13 — #88](https://github.com/dacho-morgh/dacho/issues/88)
- [FE14 — #90](https://github.com/dacho-morgh/dacho/issues/90)
- [FE18 — #97](https://github.com/dacho-morgh/dacho/issues/97)

**Actors:** Chief; Company A; reviewers.

**Fixture/precondition:** One 4/4 case and one case requiring a proposal correction.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Approve advancement as responsible chief on complete case
   **Expected:** Financial stage opens only after this explicit action.
2. **Action:** Return another reviewed case for proposal correction and resubmit as company
   **Expected:** Same application gets new proposal revision and new review round.
3. **Action:** Inspect history and progress
   **Expected:** Old evaluations remain readable to authorized staff but do not count in the new round.
4. **Action:** Try using an old reviewer page/action on the superseded round
   **Expected:** It cannot alter current-round completion.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT20 -->


<a id="uat21"></a>

## UAT21 — Financial-stage invitation and timing

Human acceptance gate for **Financial-stage invitation and timing**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T29 — #45](https://github.com/dacho-morgh/dacho/issues/45)

Frontend implementation slices:
- [FE18 — #97](https://github.com/dacho-morgh/dacho/issues/97)
- [FE19 — #98](https://github.com/dacho-morgh/dacho/issues/98)

**Actors:** Company A; Chief.

**Fixture/precondition:** One case before chief advancement and another advanced case.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Try opening/submitting financial stage before chief approval
   **Expected:** Action is unavailable/denied.
2. **Action:** Approve advancement as chief
   **Expected:** Owning company receives an in-app invitation linked to the correct case.
3. **Action:** Open the invitation as company
   **Expected:** Required financial categories and next action are clear.
4. **Action:** Open the same invitation/case as another company
   **Expected:** Financial intake is denied.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT21 -->


<a id="uat22"></a>

## UAT22 — Financial package completion, versions and younger company

Human acceptance gate for **Financial package completion, versions and younger company**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T30 — #46](https://github.com/dacho-morgh/dacho/issues/46)

Frontend implementation slices:
- [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71)
- [FE19 — #98](https://github.com/dacho-morgh/dacho/issues/98)

**Actors:** Company A; assigned investment person.

**Fixture/precondition:** Advanced case; synthetic financial files; younger-company fixture.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Upload financial statements, debts/facilities, tax/insurance records, contracts/orders/commitments, estimate/use of funds and available guarantees
   **Expected:** Correct categories persist.
2. **Action:** Omit a required category or use an invalid file
   **Expected:** Final package submission is blocked without handing an incomplete package to investment review.
3. **Action:** Submit a complete package, including since-establishment records for the younger-company fixture
   **Expected:** Authorized investment queue receives the correct version.
4. **Action:** Reload and inspect documents
   **Expected:** Submitted package and file versions remain consistent.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT22 -->


<a id="uat23"></a>

## UAT23 — Investment assignment and financial confidentiality

Human acceptance gate for **Investment assignment and financial confidentiality**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T31 — #47](https://github.com/dacho-morgh/dacho/issues/47)

Frontend implementation slices:
- [FE19 — #98](https://github.com/dacho-morgh/dacho/issues/98)
- [FE20 — #99](https://github.com/dacho-morgh/dacho/issues/99)
- [FE30 — #79](https://github.com/dacho-morgh/dacho/issues/79)

**Actors:** Assigned/unassigned investment people; Chief; reviewer; Company A; Secretariat; Owner.

**Fixture/precondition:** A submitted financial package and separate event responsibilities.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Open as assigned investment person
   **Expected:** Case, permitted four reviews and financial files are available.
2. **Action:** Open same financial file/URL as chief, employer reviewer, ordinary reviewer or unassigned investment person
   **Expected:** File, sensitive metadata and case access beyond scope are denied.
3. **Action:** Open as owning company, Secretariat and Owner
   **Expected:** Authorized financial records are available.
4. **Action:** Inspect another event queue and copied URLs
   **Expected:** Investment access remains case-assignment scoped.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT23 -->


<a id="uat24"></a>

## UAT24 — Investment memo handoff without decision controls

Human acceptance gate for **Investment memo handoff without decision controls**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T32 — #48](https://github.com/dacho-morgh/dacho/issues/48)

Frontend implementation slices:
- [FE20 — #99](https://github.com/dacho-morgh/dacho/issues/99)

**Actors:** Assigned investment person; Secretariat; Company A.

**Fixture/precondition:** A complete assigned financial dossier.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Write and send an internal investment memo
   **Expected:** Secretariat receives the case-linked memo with author/time.
2. **Action:** Inspect investment actions
   **Expected:** There are no separate investment approve/reject/return or multi-member voting actions.
3. **Action:** Open the company account before publication
   **Expected:** Private memo is not visible and no final outcome auto-publishes.
4. **Action:** Reload the internal dossier/history
   **Expected:** Memo and handoff remain attributable and persistent.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT24 -->


<a id="uat25"></a>

## UAT25 — Supplementary financial documents through Secretariat

Human acceptance gate for **Supplementary financial documents through Secretariat**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T33 — #51](https://github.com/dacho-morgh/dacho/issues/51)
- [T35 — #50](https://github.com/dacho-morgh/dacho/issues/50)

Frontend implementation slices:
- [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71)
- [FE19 — #98](https://github.com/dacho-morgh/dacho/issues/98)
- [FE21 — #100](https://github.com/dacho-morgh/dacho/issues/100)
- [FE22 — #75](https://github.com/dacho-morgh/dacho/issues/75)

**Actors:** Investment person; Secretariat; Company A; reviewer.

**Fixture/precondition:** An internal memo requesting extra evidence.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** As Secretariat send a case-linked request for supplementary documents
   **Expected:** Company receives an actionable support message, not a published final outcome.
2. **Action:** Reply as company with authorized private attachments
   **Expected:** Files remain linked to the case and financial category.
3. **Action:** Open as assigned investment person
   **Expected:** Supplementary files can be reviewed and another memo can be provided.
4. **Action:** Try the supplementary-file URL as ordinary reviewer/chief/another company
   **Expected:** Financial confidentiality remains enforced.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT25 -->


<a id="uat26"></a>

## UAT26 — Secretariat publication and company-visible outcome

Human acceptance gate for **Secretariat publication and company-visible outcome**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T33 — #51](https://github.com/dacho-morgh/dacho/issues/51)

Frontend implementation slices:
- [FE13 — #88](https://github.com/dacho-morgh/dacho/issues/88)
- [FE21 — #100](https://github.com/dacho-morgh/dacho/issues/100)

**Actors:** Secretariat; Company A; investment person.

**Fixture/precondition:** Internal memo ready for disclosure.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Inspect company view before publication
   **Expected:** Only permitted status/correspondence is visible, without memo or private scores.
2. **Action:** Publish a separate company-visible result text as Secretariat
   **Expected:** Publication actor/time and disclosed text are recorded.
3. **Action:** Open the company case and notification
   **Expected:** Correct published result appears for that company only.
4. **Action:** Inspect internal dossier
   **Expected:** Private memo, prior versions and review evidence remain distinct from published text.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT26 -->


<a id="uat27"></a>

## UAT27 — Role-specific messaging and attachment permissions

Human acceptance gate for **Role-specific messaging and attachment permissions**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T34 — #49](https://github.com/dacho-morgh/dacho/issues/49)
- [T35 — #50](https://github.com/dacho-morgh/dacho/issues/50)

Frontend implementation slices:
- [FE22 — #75](https://github.com/dacho-morgh/dacho/issues/75)

**Actors:** All seven roles across two events/companies.

**Fixture/precondition:** Scoped cases and synthetic attachments.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Send as company, ordinary reviewer and employer
   **Expected:** Company can contact Secretariat support; reviewers only the responsible chief.
2. **Action:** Try unrelated recipients as investment person
   **Expected:** Only authorized participants in assigned case are selectable/accepted.
3. **Action:** Send as owner/chief and inspect unrelated case visibility
   **Expected:** General sending does not grant access to unrelated dossiers.
4. **Action:** Send/download an authorized attachment then copy its URL to an unauthorized account
   **Expected:** Delivery works for intended audience and download is denied elsewhere.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT27 -->


<a id="uat28"></a>

## UAT28 — History, notifications and retry visibility

Human acceptance gate for **History, notifications and retry visibility**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T36 — #31](https://github.com/dacho-morgh/dacho/issues/31)
- [T37 — #32](https://github.com/dacho-morgh/dacho/issues/32)

Frontend implementation slices:
- [FE23 — #76](https://github.com/dacho-morgh/dacho/issues/76)

**Actors:** Company; Secretariat; Chief; QA.

**Fixture/precondition:** A staging build with controlled notification-failure fixture or operator support.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Perform verification, return/resubmit and assignment actions
   **Expected:** History includes actor/time/reason/revision/old-new state; recipients receive case-linked in-app work.
2. **Action:** Delete a displayed letter
   **Expected:** Workflow history remains intact.
3. **Action:** Use the controlled notification failure and operator retry
   **Expected:** Business state remains committed and notification arrives without repeated business transition.
4. **Action:** Reload each authorized account
   **Expected:** State/history/counts agree; unauthorized accounts cannot read the history.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT28 -->


<a id="uat29"></a>

## UAT29 — Queues, counts and shared dossier actions

Human acceptance gate for **Queues, counts and shared dossier actions**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T38 — #52](https://github.com/dacho-morgh/dacho/issues/52)
- [T39 — #53](https://github.com/dacho-morgh/dacho/issues/53)

Frontend implementation slices:
- [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70)
- [FE23 — #76](https://github.com/dacho-morgh/dacho/issues/76)

**Actors:** All roles with own and unrelated cases.

**Fixture/precondition:** Known fixture counts for two companies and two events.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Compare each role overview count with its filtered list
   **Expected:** Counts equal authorized list items.
2. **Action:** Search/filter by event, stage and title, then open cases
   **Expected:** No unrelated case leaks through count, search or populated company fields.
3. **Action:** Open each permitted shared dossier
   **Expected:** Correct revision/files/history/actions appear and no removed-route button remains.
4. **Action:** Change responsibility/assignment and refresh
   **Expected:** Lists, counters, detail actions and old URLs reflect revoked/new access.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT29 -->


<a id="uat30"></a>

## UAT30 — RTL, mobile, keyboard and error states

Human acceptance gate for **RTL, mobile, keyboard and error states**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T40 — #54](https://github.com/dacho-morgh/dacho/issues/54)

Frontend implementation slices:
- [FE29 — #78](https://github.com/dacho-morgh/dacho/issues/78)

**Actors:** Company; reviewer; Secretariat.

**Fixture/precondition:** Supported test browsers and phone-size viewport/device; empty/loading/error fixtures.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Use login, profile, request, evaluation, letters and receipt screens by keyboard
   **Expected:** Focus, labels and submit/error guidance are usable.
2. **Action:** Repeat core forms at phone width with Persian names, long text and mixed numbers
   **Expected:** RTL layout remains readable with reachable controls and no lost input.
3. **Action:** Exercise loading, empty, validation, denied and network-error states
   **Expected:** Each has a clear recoverable outcome.
4. **Action:** Open a stale form while another actor changes the case
   **Expected:** Conflict/refresh guidance prevents silent overwrite.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT30 -->


<a id="uat31"></a>

## UAT31 — Booth catalogue, prices, guide map and company limit

Human acceptance gate for **Booth catalogue, prices, guide map and company limit**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T47 — #61](https://github.com/dacho-morgh/dacho/issues/61)

Frontend implementation slices:
- [FE24 — #77](https://github.com/dacho-morgh/dacho/issues/77)

**Actors:** Owner; Company A.

**Fixture/precondition:** A synthetic exhibition with identifiable booths.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Configure booth IDs/specifications/availability/final prices in toman and company limit
   **Expected:** Definitions persist and appear correctly.
2. **Action:** Open booth list and guide map as company
   **Expected:** Correct numbers, sizes, prices and availability are understandable; clickable floor map is not required.
3. **Action:** Edit a current booth price
   **Expected:** New selection uses the new price while previous recorded application price remains unchanged.
4. **Action:** Inspect available features
   **Expected:** No required gateway, ancillary-service pricing or automatic-expiry controls are introduced.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT31 -->


<a id="uat32"></a>

## UAT32 — Independent booth requests, reservations and company cap

Human acceptance gate for **Independent booth requests, reservations and company cap**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T48 — #62](https://github.com/dacho-morgh/dacho/issues/62)

Frontend implementation slices:
- [FE25 — #87](https://github.com/dacho-morgh/dacho/issues/87)

**Actors:** Approved Companies A and B.

**Fixture/precondition:** Exhibition limit two for A; at least three free booths.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Apply as A for two specific booths
   **Expected:** Two independent requests/tracking identities and exclusive reservations appear.
2. **Action:** Try a third active booth request
   **Expected:** Company limit blocks it, including repeated tabs.
3. **Action:** Try selecting an A-reserved booth as B
   **Expected:** B cannot reserve the same booth.
4. **Action:** Reload after time passes without a decision
   **Expected:** Reservations persist; changing one request does not alter the other.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT32 -->


<a id="uat33"></a>

## UAT33 — Separate attendance approval before payment

Human acceptance gate for **Separate attendance approval before payment**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T55 — #63](https://github.com/dacho-morgh/dacho/issues/63)

Frontend implementation slices:
- [FE06 — #85](https://github.com/dacho-morgh/dacho/issues/85)
- [FE26 — #89](https://github.com/dacho-morgh/dacho/issues/89)

**Actors:** Company A; Secretariat.

**Fixture/precondition:** A reserved booth application with attendance pending.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Try submitting receipt as the verified company before attendance approval
   **Expected:** Receipt action/API is denied; company verification alone is insufficient.
2. **Action:** Approve attendance as Secretariat
   **Expected:** Payment/receipt becomes available for that application only.
3. **Action:** Reject attendance on a separate application with reason
   **Expected:** That booth releases with history; unrelated application is unchanged.
4. **Action:** Reload the company view
   **Expected:** Attendance state, reason and next step are clear and distinct from paid/confirmed state.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT33 -->


<a id="uat34"></a>

## UAT34 — Independent booth price snapshot and currency

Human acceptance gate for **Independent booth price snapshot and currency**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T49 — #64](https://github.com/dacho-morgh/dacho/issues/64)

Frontend implementation slices:
- [FE25 — #87](https://github.com/dacho-morgh/dacho/issues/87)
- [FE27 — #91](https://github.com/dacho-morgh/dacho/issues/91)

**Actors:** Owner; Company A; Secretariat.

**Fixture/precondition:** Two booth applications with different fixed toman prices.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Inspect each approved application price
   **Expected:** Each shows only its own booth amount and explicit currency/unit.
2. **Action:** Change catalogue price as Owner
   **Expected:** Existing recorded application amount/version does not silently change.
3. **Action:** Compare UI amount to the test operator financial record
   **Expected:** No toman/rial or rounding conversion error exists.
4. **Action:** Inspect payment requirements for both requests
   **Expected:** No combined invoice/receipt substitutes for independent booth payments.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT34 -->


<a id="uat35"></a>

## UAT35 — Independent receipt submission and duplicate protection

Human acceptance gate for **Independent receipt submission and duplicate protection**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T50 — #65](https://github.com/dacho-morgh/dacho/issues/65)

Frontend implementation slices:
- [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71)
- [FE27 — #91](https://github.com/dacho-morgh/dacho/issues/91)

**Actors:** Company A; Secretariat.

**Fixture/precondition:** Two attendance-approved booth applications and synthetic receipt fixtures.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Upload a policy-valid receipt to the first request
   **Expected:** Pending-verification status appears; booth is not confirmed merely by upload.
2. **Action:** Open the second request
   **Expected:** It still needs its own independent receipt.
3. **Action:** Attempt to count the same payment receipt as a second independent payment
   **Expected:** Duplicate/misassociated payment is prevented or flagged for refusal before confirmation.
4. **Action:** Reload and inspect file/transaction details
   **Expected:** Correct request association and receipt history persist with private access.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT35 -->


<a id="uat36"></a>

## UAT36 — Receipt correction preserves reservation; confirmation is idempotent

Human acceptance gate for **Receipt correction preserves reservation; confirmation is idempotent**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T51 — #66](https://github.com/dacho-morgh/dacho/issues/66)

Frontend implementation slices:
- [FE27 — #91](https://github.com/dacho-morgh/dacho/issues/91)

**Actors:** Company A; Secretariat; Company B.

**Fixture/precondition:** One submitted booth receipt awaiting verification.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Return receipt with reason as Secretariat
   **Expected:** Company sees correction action; booth remains reserved against Company B.
2. **Action:** Submit corrected receipt as company
   **Expected:** Same request receives a new receipt version and old version remains in history.
3. **Action:** Verify/confirm payment as Secretariat
   **Expected:** Exactly that booth becomes confirmed once.
4. **Action:** Retry confirmation or refresh/reopen another tab
   **Expected:** No duplicate financial effect or changed unrelated booth appears.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT36 -->


<a id="uat37"></a>

## UAT37 — Cancellation before/after receipt and manual refund record

Human acceptance gate for **Cancellation before/after receipt and manual refund record**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T52 — #67](https://github.com/dacho-morgh/dacho/issues/67)

Frontend implementation slices:
- [FE28 — #93](https://github.com/dacho-morgh/dacho/issues/93)

**Actors:** Company A; Secretariat.

**Fixture/precondition:** One reserved request without receipt and another with submitted/confirmed receipt.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Cancel the no-receipt request as company
   **Expected:** Only its booth releases and company active count updates.
2. **Action:** Request cancellation after receipt/payment
   **Expected:** Request goes to Secretariat; company cannot directly release the booth.
3. **Action:** Process authorized cancellation and any synthetic manual refund record as Secretariat
   **Expected:** Actor/reason/reference/amount are retained and inventory releases consistently.
4. **Action:** Inspect other booth request and prior payment history
   **Expected:** Other request is unchanged; financial/history records are not physically erased.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT37 -->


<a id="uat38"></a>

## UAT38 — Two-session concurrency smoke test

Human acceptance gate for **Two-session concurrency smoke test**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T07 — #21](https://github.com/dacho-morgh/dacho/issues/21)
- [T27 — #43](https://github.com/dacho-morgh/dacho/issues/43)
- [T44 — #58](https://github.com/dacho-morgh/dacho/issues/58)
- [T48 — #62](https://github.com/dacho-morgh/dacho/issues/62)

Frontend implementation slices:
- [FE30 — #79](https://github.com/dacho-morgh/dacho/issues/79)

**Actors:** Two human testers; company/reviewer/Secretariat fixtures.

**Fixture/precondition:** Disposable staging data; synchronized browser sessions; supporting automated concurrency results.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** From two company sessions submit for the same free booth at the same time
   **Expected:** At most one active reservation is confirmed; the losing user receives a clear conflict.
2. **Action:** Submit concurrent requests near the company booth cap and double-submit a draft
   **Expected:** Cap remains respected; one effective submission/tracking identity per request.
3. **Action:** Synchronize final evaluation submissions on a current round
   **Expected:** Progress reaches valid 4/4 once without automatic chief advancement.
4. **Action:** Record observed states and compare operator audit/automated results
   **Expected:** No duplicate effect is visible; human smoke evidence is not substituted for DB isolation tests.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT38 -->


<a id="uat39"></a>

## UAT39 — Full event human acceptance walkthrough

Human acceptance gate for **Full event human acceptance walkthrough**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T42 — #56](https://github.com/dacho-morgh/dacho/issues/56)
- [T43 — #57](https://github.com/dacho-morgh/dacho/issues/57)
- [T45 — #59](https://github.com/dacho-morgh/dacho/issues/59)
- [T46 — #60](https://github.com/dacho-morgh/dacho/issues/60)

Frontend implementation slices:
- [FE31 — #101](https://github.com/dacho-morgh/dacho/issues/101)

**Actors:** Owner; Secretariat; Chief; employer; three reviewers; investment person; Company A.

**Fixture/precondition:** All corresponding individual event gates passed; final forms/policies/text supplied.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Create the event/team/subtopic/RFP and register/verify company
   **Expected:** Owner and Secretariat actions establish a usable eligible company.
2. **Action:** Submit proposal, return/correct once, assign employer plus three reviewers and finalize all four
   **Expected:** Same case/history and correct 4/4 are retained; chief explicitly advances.
3. **Action:** Submit financial package, send memo and obtain one supplementary document through Secretariat
   **Expected:** Scoped privacy and authorized handoffs work across separate accounts.
4. **Action:** Publish result as Secretariat and inspect company plus unrelated accounts
   **Expected:** Company sees correct result; scores/memo/financial files remain protected; release evidence is complete.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT39 -->


<a id="uat40"></a>

## UAT40 — Full exhibition human acceptance walkthrough

Human acceptance gate for **Full exhibition human acceptance walkthrough**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T53 — #68](https://github.com/dacho-morgh/dacho/issues/68)
- [T54 — #69](https://github.com/dacho-morgh/dacho/issues/69)

Frontend implementation slices:
- [FE32 — #95](https://github.com/dacho-morgh/dacho/issues/95)

**Actors:** Owner; Secretariat; Companies A and B.

**Fixture/precondition:** Individual exhibition gates passed; catalogue limit/prices and valid synthetic receipts.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Configure exhibition and apply for several specific booths
   **Expected:** Independent requests/reservations respect exclusivity and company cap.
2. **Action:** Approve attendance then submit separate receipts
   **Expected:** No preapproval payment or combined payment path is used.
3. **Action:** Return one receipt, correct it and confirm payment; cancel another through the appropriate pre/post-receipt path
   **Expected:** Reservations, states and inventory remain independent and consistent.
4. **Action:** Reconcile booth list, company counts and payment records
   **Expected:** Confirmed/released inventory matches evidence; nothing expires automatically.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT40 -->


<a id="uat41"></a>

## UAT41 — Operator migration and backup/restore rehearsal

Human acceptance gate for **Operator migration and backup/restore rehearsal**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T41 — #55](https://github.com/dacho-morgh/dacho/issues/55)
- [T46 — #60](https://github.com/dacho-morgh/dacho/issues/60)

**Actors:** Test operator; Owner; QA witness.

**Fixture/precondition:** Disposable database/files snapshot and reviewed migration/recovery runbook; no live system.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Inventory fixture users/roles/companies/applications/documents before migration
   **Expected:** Expected identities and counts are recorded.
2. **Action:** Run the reviewed migration on the disposable copy
   **Expected:** Mapping preserves records and editorial privileges without assuming empty data.
3. **Action:** Restore database and private files from the test backup
   **Expected:** The same documented application/file relationships and permitted downloads work.
4. **Action:** Run login/ownership/document smoke checks with QA witness
   **Expected:** Evidence records build/runbook versions, recovery result and defects; production was untouched.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT41 -->


<a id="uat42"></a>

## UAT42 — Human readiness review: scope, permissions and safe test fixtures

Human acceptance gate for **Human readiness review: scope, permissions and safe test fixtures**. This issue specifies a test; it has not been executed.

## When to run
Run after the linked implementation slice is deployed to an isolated test environment. Do not wait for the entire system if this slice is independently usable. Keep open until actual human acceptance is recorded.

## Prerequisites
- [T01 — #15](https://github.com/dacho-morgh/dacho/issues/15)
- [T02 — #16](https://github.com/dacho-morgh/dacho/issues/16)
- [T03 — #17](https://github.com/dacho-morgh/dacho/issues/17)
- [T04 — #18](https://github.com/dacho-morgh/dacho/issues/18)

Frontend implementation slices:
- [FE30 — #79](https://github.com/dacho-morgh/dacho/issues/79)

**Actors:** Product Owner; QA lead; technical operator.

**Fixture/precondition:** English requirements, role matrix, staging build details and synthetic fixture manifest.

Use separate authenticated browser profiles for different roles. Use synthetic company IDs/documents/payment receipts only. Do not execute against live companies, production migrations or real financial transactions. If policy/rubric/text needed by a step is not supplied, record Blocked; do not invent it.

## Procedure and expected results
1. **Action:** Review seven roles and event/booth flow with product owner
   **Expected:** Approved decisions and current open inputs are explicit; no invented scoring/file limits.
2. **Action:** Review test environment URL/database/file location with operator
   **Expected:** It is isolated and safe for fixture creation/deletion and receipt simulations.
3. **Action:** Provision separate role accounts, two companies/events and distinguishable synthetic files
   **Expected:** Tester can identify actor, ownership and expected visibility.
4. **Action:** Record which slices are ready and which tests are blocked
   **Expected:** Tests remain Not run or Blocked until executed; implementation completion is not a claimed UAT pass.

## Evidence and exit criteria
- [ ] Record build/commit, test URL, date, tester and account roles (no passwords).
- [ ] Record fixture/application/tracking IDs and relevant revision/round.
- [ ] Attach screenshots or screen recording of outcomes; include denied/negative-path evidence.
- [ ] Verify persistence after refresh or a fresh session where relevant.
- [ ] Every expected result passed. Otherwise leave this gate open and link defect issues or missing inputs.
- [ ] Rerun affected steps after a fix; record the new build and result.

Execution record: **Not run**. Tester: —. Build: —. Date: —. Result: —. Evidence/defects: —.

Closing the implementation issue or passing automated tests does not pass this gate. This gate supplements, not replaces, automated access, integration and concurrency testing.

<!-- dacho-human-acceptance:UAT42 -->

