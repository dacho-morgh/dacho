# Frontend delivery plan

Updated 2026-10-23. 32 frontend work packages refining the original 55 system tasks. This is a specification, not completed implementation. UI language remains Persian.

## Delivery order

1. Agree shared DTOs/capabilities/errors and private file policy; ship FE01–FE07 and enable login/signup/profile human gates as slices become usable.
2. Ship owner configuration and event intake (FE08–FE14), then assignments/reviews/chief decision (FE15–FE18).
3. Ship financial package, investment memo, publication and scoped correspondence (FE19–FE23).
4. Ship independent booth/attendance/receipt/cancellation flow (FE24–FE28).
5. Apply FE29–FE30 throughout; finish real-backed FE31–FE32 and human full-journey gates.

The sequence is a dependency plan, not a promised calendar. Frontend shells/fixtures can proceed before endpoints, but real integration and a deployable test slice are required for acceptance.

## Traceability

`Txx` denotes an original system issue. Some original issues already include frontend work; these FE packages split out the browser deliverable and must be coordinated rather than implemented twice. Backend dependencies are ordinary issue links, not an assertion that all linked issues are backend-only or GitHub-native blocking relationships.

| Package | Frontend deliverable | Original task / backend contracts | Frontend prerequisites | Human gates |
| --- | --- | --- | --- | --- |
| [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70) | Seven-role dashboard shell and protected navigation | [T08 — #22](https://github.com/dacho-morgh/dacho/issues/22), [T09 — #23](https://github.com/dacho-morgh/dacho/issues/23), [T38 — #52](https://github.com/dacho-morgh/dacho/issues/52), [T39 — #53](https://github.com/dacho-morgh/dacho/issues/53) | — | [UAT03](https://github.com/dacho-morgh/dacho/issues/104), [UAT15](https://github.com/dacho-morgh/dacho/issues/116), [UAT29](https://github.com/dacho-morgh/dacho/issues/130) |
| [FE02 — #72](https://github.com/dacho-morgh/dacho/issues/72) | Password login, logout and session return journeys | [T11 — #25](https://github.com/dacho-morgh/dacho/issues/25) | [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70) | [UAT01](https://github.com/dacho-morgh/dacho/issues/102) |
| [FE03 — #80](https://github.com/dacho-morgh/dacho/issues/80) | Initial company signup and duplicate recovery | [T11 — #25](https://github.com/dacho-morgh/dacho/issues/25) | [FE02 — #72](https://github.com/dacho-morgh/dacho/issues/72) | [UAT02](https://github.com/dacho-morgh/dacho/issues/103) |
| [FE04 — #82](https://github.com/dacho-morgh/dacho/issues/82) | Complete company profile, resume and verification submission | [T05 — #19](https://github.com/dacho-morgh/dacho/issues/19), [T10 — #24](https://github.com/dacho-morgh/dacho/issues/24), [T13 — #27](https://github.com/dacho-morgh/dacho/issues/27), [T14 — #33](https://github.com/dacho-morgh/dacho/issues/33) | [FE03 — #80](https://github.com/dacho-morgh/dacho/issues/80), [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71) | [UAT04](https://github.com/dacho-morgh/dacho/issues/105), [UAT05](https://github.com/dacho-morgh/dacho/issues/106), [UAT06](https://github.com/dacho-morgh/dacho/issues/107) |
| [FE05 — #84](https://github.com/dacho-morgh/dacho/issues/84) | Secretariat company verification workbench | [T14 — #33](https://github.com/dacho-morgh/dacho/issues/33), [T15 — #34](https://github.com/dacho-morgh/dacho/issues/34) | [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70), [FE04 — #82](https://github.com/dacho-morgh/dacho/issues/82) | [UAT06](https://github.com/dacho-morgh/dacho/issues/107), [UAT07](https://github.com/dacho-morgh/dacho/issues/108) |
| [FE06 — #85](https://github.com/dacho-morgh/dacho/issues/85) | Participation eligibility and return-to-registration flow | [T15 — #34](https://github.com/dacho-morgh/dacho/issues/34), [T19 — #35](https://github.com/dacho-morgh/dacho/issues/35), [T55 — #63](https://github.com/dacho-morgh/dacho/issues/63) | [FE04 — #82](https://github.com/dacho-morgh/dacho/issues/82), [FE05 — #84](https://github.com/dacho-morgh/dacho/issues/84), [FE11 — #74](https://github.com/dacho-morgh/dacho/issues/74) | [UAT07](https://github.com/dacho-morgh/dacho/issues/108), [UAT10](https://github.com/dacho-morgh/dacho/issues/111), [UAT33](https://github.com/dacho-morgh/dacho/issues/134) |
| [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71) | Private file upload and authorized download components | [T06 — #20](https://github.com/dacho-morgh/dacho/issues/20), [T10 — #24](https://github.com/dacho-morgh/dacho/issues/24), [T18 — #30](https://github.com/dacho-morgh/dacho/issues/30), [T30 — #46](https://github.com/dacho-morgh/dacho/issues/46), [T35 — #50](https://github.com/dacho-morgh/dacho/issues/50), [T50 — #65](https://github.com/dacho-morgh/dacho/issues/65) | — | [UAT05](https://github.com/dacho-morgh/dacho/issues/106), [UAT09](https://github.com/dacho-morgh/dacho/issues/110), [UAT11](https://github.com/dacho-morgh/dacho/issues/112), [UAT22](https://github.com/dacho-morgh/dacho/issues/123), [UAT25](https://github.com/dacho-morgh/dacho/issues/126), [UAT35](https://github.com/dacho-morgh/dacho/issues/136) |
| [FE08 — #73](https://github.com/dacho-morgh/dacho/issues/73) | Owner personnel creation and event-role assignment UI | [T08 — #22](https://github.com/dacho-morgh/dacho/issues/22), [T09 — #23](https://github.com/dacho-morgh/dacho/issues/23), [T16 — #28](https://github.com/dacho-morgh/dacho/issues/28) | [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70) | [UAT03](https://github.com/dacho-morgh/dacho/issues/104), [UAT08](https://github.com/dacho-morgh/dacho/issues/109) |
| [FE09 — #81](https://github.com/dacho-morgh/dacho/issues/81) | Owner event configuration and responsible teams | [T16 — #28](https://github.com/dacho-morgh/dacho/issues/28) | [FE08 — #73](https://github.com/dacho-morgh/dacho/issues/73) | [UAT08](https://github.com/dacho-morgh/dacho/issues/109) |
| [FE10 — #83](https://github.com/dacho-morgh/dacho/issues/83) | Category, subtopic, employer and RFP administration | [T17 — #29](https://github.com/dacho-morgh/dacho/issues/29), [T18 — #30](https://github.com/dacho-morgh/dacho/issues/30) | [FE09 — #81](https://github.com/dacho-morgh/dacho/issues/81), [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71) | [UAT09](https://github.com/dacho-morgh/dacho/issues/110) |
| [FE11 — #74](https://github.com/dacho-morgh/dacho/issues/74) | Event discovery, subtopic selection and RFP reading | [T16 — #28](https://github.com/dacho-morgh/dacho/issues/28), [T17 — #29](https://github.com/dacho-morgh/dacho/issues/29), [T18 — #30](https://github.com/dacho-morgh/dacho/issues/30) | [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70), [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71) | [UAT08](https://github.com/dacho-morgh/dacho/issues/109), [UAT09](https://github.com/dacho-morgh/dacho/issues/110), [UAT10](https://github.com/dacho-morgh/dacho/issues/111) |
| [FE12 — #86](https://github.com/dacho-morgh/dacho/issues/86) | Independent event application drafts and proposal submission | [T03 — #17](https://github.com/dacho-morgh/dacho/issues/17), [T12 — #26](https://github.com/dacho-morgh/dacho/issues/26), [T19 — #35](https://github.com/dacho-morgh/dacho/issues/35), [T20 — #36](https://github.com/dacho-morgh/dacho/issues/36) | [FE06 — #85](https://github.com/dacho-morgh/dacho/issues/85), [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71), [FE11 — #74](https://github.com/dacho-morgh/dacho/issues/74) | [UAT10](https://github.com/dacho-morgh/dacho/issues/111), [UAT11](https://github.com/dacho-morgh/dacho/issues/112) |
| [FE13 — #88](https://github.com/dacho-morgh/dacho/issues/88) | Company request tracking, correction and published result | [T19 — #35](https://github.com/dacho-morgh/dacho/issues/35), [T21 — #37](https://github.com/dacho-morgh/dacho/issues/37), [T28 — #44](https://github.com/dacho-morgh/dacho/issues/44), [T33 — #51](https://github.com/dacho-morgh/dacho/issues/51), [T39 — #53](https://github.com/dacho-morgh/dacho/issues/53) | [FE12 — #86](https://github.com/dacho-morgh/dacho/issues/86) | [UAT10](https://github.com/dacho-morgh/dacho/issues/111), [UAT12](https://github.com/dacho-morgh/dacho/issues/113), [UAT13](https://github.com/dacho-morgh/dacho/issues/114), [UAT20](https://github.com/dacho-morgh/dacho/issues/121), [UAT26](https://github.com/dacho-morgh/dacho/issues/127) |
| [FE14 — #90](https://github.com/dacho-morgh/dacho/issues/90) | Chief triage and owner reopen actions | [T21 — #37](https://github.com/dacho-morgh/dacho/issues/37), [T28 — #44](https://github.com/dacho-morgh/dacho/issues/44) | [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70), [FE13 — #88](https://github.com/dacho-morgh/dacho/issues/88) | [UAT12](https://github.com/dacho-morgh/dacho/issues/113), [UAT13](https://github.com/dacho-morgh/dacho/issues/114), [UAT20](https://github.com/dacho-morgh/dacho/issues/121) |
| [FE15 — #92](https://github.com/dacho-morgh/dacho/issues/92) | Four-reviewer assignment and controlled replacement | [T22 — #38](https://github.com/dacho-morgh/dacho/issues/38), [T26 — #42](https://github.com/dacho-morgh/dacho/issues/42), [T27 — #43](https://github.com/dacho-morgh/dacho/issues/43) | [FE14 — #90](https://github.com/dacho-morgh/dacho/issues/90), [FE08 — #73](https://github.com/dacho-morgh/dacho/issues/73) | [UAT14](https://github.com/dacho-morgh/dacho/issues/115), [UAT18](https://github.com/dacho-morgh/dacho/issues/119), [UAT19](https://github.com/dacho-morgh/dacho/issues/120) |
| [FE16 — #94](https://github.com/dacho-morgh/dacho/issues/94) | Assigned reviewer and employer queue and dossier | [T09 — #23](https://github.com/dacho-morgh/dacho/issues/23), [T23 — #39](https://github.com/dacho-morgh/dacho/issues/39), [T27 — #43](https://github.com/dacho-morgh/dacho/issues/43) | [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70), [FE15 — #92](https://github.com/dacho-morgh/dacho/issues/92) | [UAT15](https://github.com/dacho-morgh/dacho/issues/116), [UAT19](https://github.com/dacho-morgh/dacho/issues/120) |
| [FE17 — #96](https://github.com/dacho-morgh/dacho/issues/96) | Fixed review forms, draft saving and finalization | [T24 — #40](https://github.com/dacho-morgh/dacho/issues/40), [T25 — #41](https://github.com/dacho-morgh/dacho/issues/41) | [FE16 — #94](https://github.com/dacho-morgh/dacho/issues/94) | [UAT16](https://github.com/dacho-morgh/dacho/issues/117), [UAT17](https://github.com/dacho-morgh/dacho/issues/118) |
| [FE18 — #97](https://github.com/dacho-morgh/dacho/issues/97) | Chief four-review summary and explicit next-stage decision | [T27 — #43](https://github.com/dacho-morgh/dacho/issues/43), [T28 — #44](https://github.com/dacho-morgh/dacho/issues/44), [T29 — #45](https://github.com/dacho-morgh/dacho/issues/45) | [FE15 — #92](https://github.com/dacho-morgh/dacho/issues/92), [FE17 — #96](https://github.com/dacho-morgh/dacho/issues/96) | [UAT19](https://github.com/dacho-morgh/dacho/issues/120), [UAT20](https://github.com/dacho-morgh/dacho/issues/121), [UAT21](https://github.com/dacho-morgh/dacho/issues/122) |
| [FE19 — #98](https://github.com/dacho-morgh/dacho/issues/98) | Company financial package and supplementary documents | [T29 — #45](https://github.com/dacho-morgh/dacho/issues/45), [T30 — #46](https://github.com/dacho-morgh/dacho/issues/46), [T31 — #47](https://github.com/dacho-morgh/dacho/issues/47), [T35 — #50](https://github.com/dacho-morgh/dacho/issues/50) | [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71), [FE13 — #88](https://github.com/dacho-morgh/dacho/issues/88), [FE18 — #97](https://github.com/dacho-morgh/dacho/issues/97) | [UAT21](https://github.com/dacho-morgh/dacho/issues/122), [UAT22](https://github.com/dacho-morgh/dacho/issues/123), [UAT23](https://github.com/dacho-morgh/dacho/issues/124), [UAT25](https://github.com/dacho-morgh/dacho/issues/126) |
| [FE20 — #99](https://github.com/dacho-morgh/dacho/issues/99) | Single investment reviewer dossier and memo submission | [T31 — #47](https://github.com/dacho-morgh/dacho/issues/47), [T32 — #48](https://github.com/dacho-morgh/dacho/issues/48) | [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70), [FE19 — #98](https://github.com/dacho-morgh/dacho/issues/98) | [UAT23](https://github.com/dacho-morgh/dacho/issues/124), [UAT24](https://github.com/dacho-morgh/dacho/issues/125) |
| [FE21 — #100](https://github.com/dacho-morgh/dacho/issues/100) | Secretariat financial follow-up and result publication | [T33 — #51](https://github.com/dacho-morgh/dacho/issues/51), [T35 — #50](https://github.com/dacho-morgh/dacho/issues/50) | [FE20 — #99](https://github.com/dacho-morgh/dacho/issues/99), [FE22 — #75](https://github.com/dacho-morgh/dacho/issues/75) | [UAT25](https://github.com/dacho-morgh/dacho/issues/126), [UAT26](https://github.com/dacho-morgh/dacho/issues/127) |
| [FE22 — #75](https://github.com/dacho-morgh/dacho/issues/75) | Role-scoped correspondence, support and private attachments | [T34 — #49](https://github.com/dacho-morgh/dacho/issues/49), [T35 — #50](https://github.com/dacho-morgh/dacho/issues/50) | [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70), [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71) | [UAT25](https://github.com/dacho-morgh/dacho/issues/126), [UAT27](https://github.com/dacho-morgh/dacho/issues/128) |
| [FE23 — #76](https://github.com/dacho-morgh/dacho/issues/76) | Scoped queues, filters, history and actionable notifications | [T36 — #31](https://github.com/dacho-morgh/dacho/issues/31), [T37 — #32](https://github.com/dacho-morgh/dacho/issues/32), [T38 — #52](https://github.com/dacho-morgh/dacho/issues/52), [T39 — #53](https://github.com/dacho-morgh/dacho/issues/53) | [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70) | [UAT28](https://github.com/dacho-morgh/dacho/issues/129), [UAT29](https://github.com/dacho-morgh/dacho/issues/130) |
| [FE24 — #77](https://github.com/dacho-morgh/dacho/issues/77) | Owner exhibition and booth catalogue administration | [T47 — #61](https://github.com/dacho-morgh/dacho/issues/61) | [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70), [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71) | [UAT31](https://github.com/dacho-morgh/dacho/issues/132) |
| [FE25 — #87](https://github.com/dacho-morgh/dacho/issues/87) | Company booth selection and independent reservations | [T48 — #62](https://github.com/dacho-morgh/dacho/issues/62), [T49 — #64](https://github.com/dacho-morgh/dacho/issues/64), [T53 — #68](https://github.com/dacho-morgh/dacho/issues/68) | [FE06 — #85](https://github.com/dacho-morgh/dacho/issues/85), [FE24 — #77](https://github.com/dacho-morgh/dacho/issues/77) | [UAT32](https://github.com/dacho-morgh/dacho/issues/133), [UAT34](https://github.com/dacho-morgh/dacho/issues/135) |
| [FE26 — #89](https://github.com/dacho-morgh/dacho/issues/89) | Secretariat attendance approval before payment | [T55 — #63](https://github.com/dacho-morgh/dacho/issues/63), [T53 — #68](https://github.com/dacho-morgh/dacho/issues/68) | [FE25 — #87](https://github.com/dacho-morgh/dacho/issues/87) | [UAT33](https://github.com/dacho-morgh/dacho/issues/134) |
| [FE27 — #91](https://github.com/dacho-morgh/dacho/issues/91) | Independent payment receipt submission and verification | [T50 — #65](https://github.com/dacho-morgh/dacho/issues/65), [T51 — #66](https://github.com/dacho-morgh/dacho/issues/66), [T49 — #64](https://github.com/dacho-morgh/dacho/issues/64) | [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71), [FE26 — #89](https://github.com/dacho-morgh/dacho/issues/89) | [UAT34](https://github.com/dacho-morgh/dacho/issues/135), [UAT35](https://github.com/dacho-morgh/dacho/issues/136), [UAT36](https://github.com/dacho-morgh/dacho/issues/137) |
| [FE28 — #93](https://github.com/dacho-morgh/dacho/issues/93) | Booth cancellation, manual release and refund visibility | [T52 — #67](https://github.com/dacho-morgh/dacho/issues/67), [T53 — #68](https://github.com/dacho-morgh/dacho/issues/68) | [FE27 — #91](https://github.com/dacho-morgh/dacho/issues/91) | [UAT37](https://github.com/dacho-morgh/dacho/issues/138) |
| [FE29 — #78](https://github.com/dacho-morgh/dacho/issues/78) | Shared Persian RTL, responsive and failure states | [T40 — #54](https://github.com/dacho-morgh/dacho/issues/54) | [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70), [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71) | [UAT30](https://github.com/dacho-morgh/dacho/issues/131) |
| [FE30 — #79](https://github.com/dacho-morgh/dacho/issues/79) | Frontend API contracts and permission regression coverage | [T02 — #16](https://github.com/dacho-morgh/dacho/issues/16), [T04 — #18](https://github.com/dacho-morgh/dacho/issues/18), [T42 — #56](https://github.com/dacho-morgh/dacho/issues/56), [T43 — #57](https://github.com/dacho-morgh/dacho/issues/57), [T44 — #58](https://github.com/dacho-morgh/dacho/issues/58) | [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70), [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71) | [UAT15](https://github.com/dacho-morgh/dacho/issues/116), [UAT23](https://github.com/dacho-morgh/dacho/issues/124), [UAT38](https://github.com/dacho-morgh/dacho/issues/139), [UAT42](https://github.com/dacho-morgh/dacho/issues/143) |
| [FE31 — #101](https://github.com/dacho-morgh/dacho/issues/101) | Full event journey frontend E2E and human handoff | [T45 — #59](https://github.com/dacho-morgh/dacho/issues/59), [T46 — #60](https://github.com/dacho-morgh/dacho/issues/60) | [FE03 — #80](https://github.com/dacho-morgh/dacho/issues/80), [FE05 — #84](https://github.com/dacho-morgh/dacho/issues/84), [FE12 — #86](https://github.com/dacho-morgh/dacho/issues/86), [FE18 — #97](https://github.com/dacho-morgh/dacho/issues/97), [FE19 — #98](https://github.com/dacho-morgh/dacho/issues/98), [FE20 — #99](https://github.com/dacho-morgh/dacho/issues/99), [FE21 — #100](https://github.com/dacho-morgh/dacho/issues/100), [FE22 — #75](https://github.com/dacho-morgh/dacho/issues/75), [FE23 — #76](https://github.com/dacho-morgh/dacho/issues/76), [FE29 — #78](https://github.com/dacho-morgh/dacho/issues/78), [FE30 — #79](https://github.com/dacho-morgh/dacho/issues/79) | [UAT39](https://github.com/dacho-morgh/dacho/issues/140) |
| [FE32 — #95](https://github.com/dacho-morgh/dacho/issues/95) | Full exhibition frontend E2E and human handoff | [T53 — #68](https://github.com/dacho-morgh/dacho/issues/68), [T54 — #69](https://github.com/dacho-morgh/dacho/issues/69), [T46 — #60](https://github.com/dacho-morgh/dacho/issues/60) | [FE24 — #77](https://github.com/dacho-morgh/dacho/issues/77), [FE25 — #87](https://github.com/dacho-morgh/dacho/issues/87), [FE26 — #89](https://github.com/dacho-morgh/dacho/issues/89), [FE27 — #91](https://github.com/dacho-morgh/dacho/issues/91), [FE28 — #93](https://github.com/dacho-morgh/dacho/issues/93), [FE29 — #78](https://github.com/dacho-morgh/dacho/issues/78), [FE30 — #79](https://github.com/dacho-morgh/dacho/issues/79) | [UAT40](https://github.com/dacho-morgh/dacho/issues/141) |

## Detailed work packages


## FE01 — Seven-role dashboard shell and protected navigation

Frontend implementation work package **FE01**: Seven-role dashboard shell and protected navigation.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T08 — #22](https://github.com/dacho-morgh/dacho/issues/22)
- [T09 — #23](https://github.com/dacho-morgh/dacho/issues/23)
- [T38 — #52](https://github.com/dacho-morgh/dacho/issues/52)
- [T39 — #53](https://github.com/dacho-morgh/dacho/issues/53)

## Frontend sequence
- Shared primitives can begin independently.

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 31411:7579;30510:13146;5:5018.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: app-sidebar.tsx; sidebar-shell.tsx; dashboard/layout.tsx.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Replace admin-versus-company branching with the seven approved single operational roles.
- [ ] Use server-authorized capabilities and event responsibility for destinations and actions; never trust hidden menu items as authorization.
- [ ] Direct navigation, expired session, denied access and empty queues have distinct usable states.
- [ ] Retain Persian RTL and keyboard/mobile navigation; no role switcher granting extra roles.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT03, UAT15, UAT29. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE01 -->


## FE02 — Password login, logout and session return journeys

Frontend implementation work package **FE02**: Password login, logout and session return journeys.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T11 — #25](https://github.com/dacho-morgh/dacho/issues/25)

## Frontend sequence
- [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 242:11653.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: auth/login-page.tsx; utilities/auth-return-url.ts.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Keep mobile/email plus password login and safe internal return URLs.
- [ ] After login and logout refresh server-visible session and land at a role-appropriate operational page.
- [ ] Display incorrect credentials, network failure and expired session without discarding safe input or looping redirects.
- [ ] Do not represent placeholder password recovery as a working feature; agree recovery scope separately.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT01. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE02 -->


## FE03 — Initial company signup and duplicate recovery

Frontend implementation work package **FE03**: Initial company signup and duplicate recovery.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T11 — #25](https://github.com/dacho-morgh/dacho/issues/25)

## Frontend sequence
- [FE02 — #72](https://github.com/dacho-morgh/dacho/issues/72)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 242:12192.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: auth/register-page.tsx.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Collect legal company name, national ID, activity, representative name/position/phone, email and password with clear validation.
- [ ] Handle duplicate national ID/contact and partial/network failures without claiming a second company was created.
- [ ] Successful signup grants dashboard access but no verified participation rights.
- [ ] Keep field-level Persian errors, loading lock and login link usable on mobile.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT02. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE03 -->


## FE04 — Complete company profile, resume and verification submission

Frontend implementation work package **FE04**: Complete company profile, resume and verification submission.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T05 — #19](https://github.com/dacho-morgh/dacho/issues/19)
- [T10 — #24](https://github.com/dacho-morgh/dacho/issues/24)
- [T13 — #27](https://github.com/dacho-morgh/dacho/issues/27)
- [T14 — #33](https://github.com/dacho-morgh/dacho/issues/33)

## Frontend sequence
- [FE03 — #80](https://github.com/dacho-morgh/dacho/issues/80)
- [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 30510:12186;30537:19416.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: profile/company-profile-view.tsx; profile/resume-profile-view.tsx; utilities/dashboard-api.ts.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Implement all approved second-stage fields, repeatable key members/projects and private registration/catalogue/certificate uploads.
- [ ] Separate legal entity type, company classification and research-center residency; provide does-not-have for legitimately optional items.
- [ ] Persist edits, addresses, arrays and documents across refresh; show missing requirements before verification submission.
- [ ] Show pending, returned with reason and resubmission on the same company profile; keep approved historical snapshot distinct from current edits.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT04, UAT05, UAT06. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE04 -->


## FE05 — Secretariat company verification workbench

Frontend implementation work package **FE05**: Secretariat company verification workbench.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T14 — #33](https://github.com/dacho-morgh/dacho/issues/33)
- [T15 — #34](https://github.com/dacho-morgh/dacho/issues/34)

## Frontend sequence
- [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70)
- [FE04 — #82](https://github.com/dacho-morgh/dacho/issues/82)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 30535:17763;30537:19416; new verification states.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: company-list.tsx; company-detail.tsx.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Provide pending/returned/approved queues and exact submitted company revision with authorized document downloads.
- [ ] Secretariat approves or returns/rejects with a required reason; no self-approval or automatic account suspension.
- [ ] Protect unsaved decision text and handle a stale company revision by refreshing before another decision.
- [ ] Show identity edits awaiting re-verification while old submitted cases retain their approved snapshots.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT06, UAT07. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE05 -->


## FE06 — Participation eligibility and return-to-registration flow

Frontend implementation work package **FE06**: Participation eligibility and return-to-registration flow.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T15 — #34](https://github.com/dacho-morgh/dacho/issues/34)
- [T19 — #35](https://github.com/dacho-morgh/dacho/issues/35)
- [T55 — #63](https://github.com/dacho-morgh/dacho/issues/63)

## Frontend sequence
- [FE04 — #82](https://github.com/dacho-morgh/dacho/issues/82)
- [FE05 — #84](https://github.com/dacho-morgh/dacho/issues/84)
- [FE11 — #74](https://github.com/dacho-morgh/dacho/issues/74)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 30599:21935.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: events-view.tsx; new-request-form.tsx.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Explain incomplete, pending, returned and approved verification states at event/exhibition entry.
- [ ] Link to the precise missing profile sections and preserve intended event/subtopic or booth destination.
- [ ] Re-check eligibility at final submit and handle server denial when verification changes mid-form.
- [ ] Distinguish company verification from exhibition attendance approval and payment permission.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT07, UAT10, UAT33. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE06 -->


## FE07 — Private file upload and authorized download components

Frontend implementation work package **FE07**: Private file upload and authorized download components.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T06 — #20](https://github.com/dacho-morgh/dacho/issues/20)
- [T10 — #24](https://github.com/dacho-morgh/dacho/issues/24)
- [T18 — #30](https://github.com/dacho-morgh/dacho/issues/30)
- [T30 — #46](https://github.com/dacho-morgh/dacho/issues/46)
- [T35 — #50](https://github.com/dacho-morgh/dacho/issues/50)
- [T50 — #65](https://github.com/dacho-morgh/dacho/issues/65)

## Frontend sequence
- Shared primitives can begin independently.

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 30599:21935;53:12475; new financial/receipt variants.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: new-letter-form.tsx; utilities/dashboard-api.ts.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Share accessible upload/download controls for RFP, proposal, company, finance, correspondence and receipt categories.
- [ ] Show category-specific allowed formats/size/count from approved policy; Q39 is unresolved, never hard-code universal 12 MB.
- [ ] Handle upload progress, invalid type/size, failed retry, replacement and pending upload before form submit.
- [ ] Use authorized document IDs/URLs; denied downloads and expired sessions must not fall back to public media links.
- [ ] Do not claim resumable upload unless the backend contract supports it.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT05, UAT09, UAT11, UAT22, UAT25, UAT35. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE07 -->


## FE08 — Owner personnel creation and event-role assignment UI

Frontend implementation work package **FE08**: Owner personnel creation and event-role assignment UI.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T08 — #22](https://github.com/dacho-morgh/dacho/issues/22)
- [T09 — #23](https://github.com/dacho-morgh/dacho/issues/23)
- [T16 — #28](https://github.com/dacho-morgh/dacho/issues/28)

## Frontend sequence
- [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 30722:2394;31070:14855;31934:59524.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: employee-list.tsx; admin-list-view.tsx; profile/staff-profile-view.tsx.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Enable owner personnel create/edit with exactly one operational role per person.
- [ ] Show event-specific chief and single investment-person assignments with eligible account selectors.
- [ ] Keep employer a person with a reviewer account; no employer organization or multi-role selector.
- [ ] Unauthorized roles see no management controls and direct requests remain server-denied.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT03, UAT08. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE08 -->


## FE09 — Owner event configuration and responsible teams

Frontend implementation work package **FE09**: Owner event configuration and responsible teams.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T16 — #28](https://github.com/dacho-morgh/dacho/issues/28)

## Frontend sequence
- [FE08 — #73](https://github.com/dacho-morgh/dacho/issues/73)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 56:14018; administration extension required.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: events-view.tsx; event CMS integration.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Provide usable event create/edit or documented authorized CMS entry for title, description, dates and registration window.
- [ ] Select responsible chief and one investment person for each event; distinguish E1 and E2.
- [ ] Validate dates/required fields and present server errors, unpublished/closed states and saved state.
- [ ] Use fixed system forms; do not add per-event form builder controls.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT08. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE09 -->


## FE10 — Category, subtopic, employer and RFP administration

Frontend implementation work package **FE10**: Category, subtopic, employer and RFP administration.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T17 — #29](https://github.com/dacho-morgh/dacho/issues/29)
- [T18 — #30](https://github.com/dacho-morgh/dacho/issues/30)

## Frontend sequence
- [FE09 — #81](https://github.com/dacho-morgh/dacho/issues/81)
- [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 49:7968;30599:21935; authoring extension required.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: events-view.tsx; owner event administration.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Owner creates categories and nested subtopics within the correct event.
- [ ] Assign exactly one eligible employer person and the subtopic RFP file; edit/download correct versions.
- [ ] Prevent invalid parent/event combinations and show server validation without losing edits.
- [ ] Warn that edits apply according to backend version rules and cannot silently rewrite submitted cases.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT09. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE10 -->


## FE11 — Event discovery, subtopic selection and RFP reading

Frontend implementation work package **FE11**: Event discovery, subtopic selection and RFP reading.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T16 — #28](https://github.com/dacho-morgh/dacho/issues/28)
- [T17 — #29](https://github.com/dacho-morgh/dacho/issues/29)
- [T18 — #30](https://github.com/dacho-morgh/dacho/issues/30)

## Frontend sequence
- [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70)
- [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 56:14018;49:7968.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: events-view.tsx; dashboard/events/page.tsx.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Render real published events and registration states with category/subtopic hierarchy.
- [ ] Download each selected subtopic RFP and show employer identity where authorized.
- [ ] Allow selection of several subtopics while clearly stating each becomes a separate application.
- [ ] Use actual IDs and server state; URL title/event text must not become authoritative application data.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT08, UAT09, UAT10. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE11 -->


## FE12 — Independent event application drafts and proposal submission

Frontend implementation work package **FE12**: Independent event application drafts and proposal submission.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T03 — #17](https://github.com/dacho-morgh/dacho/issues/17)
- [T12 — #26](https://github.com/dacho-morgh/dacho/issues/26)
- [T19 — #35](https://github.com/dacho-morgh/dacho/issues/35)
- [T20 — #36](https://github.com/dacho-morgh/dacho/issues/36)

## Frontend sequence
- [FE06 — #85](https://github.com/dacho-morgh/dacho/issues/85)
- [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71)
- [FE11 — #74](https://github.com/dacho-morgh/dacho/issues/74)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 30599:21935.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: new-request-form.tsx; dashboard/new-request/page.tsx.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Use the fixed approved registration fields, key team, non-compete/rules acknowledgements and proposal upload.
- [ ] Create/save/resume one independent draft per subtopic and show independent tracking IDs/results after submission.
- [ ] Record correct agreement/RFP/form/proposal versions through the API; final agreement text and Q39 remain product inputs.
- [ ] Preserve input on validation/network failure and recover after draft-create succeeds but final submit fails without creating a duplicate.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT10, UAT11. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE12 -->


## FE13 — Company request tracking, correction and published result

Frontend implementation work package **FE13**: Company request tracking, correction and published result.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T19 — #35](https://github.com/dacho-morgh/dacho/issues/35)
- [T21 — #37](https://github.com/dacho-morgh/dacho/issues/37)
- [T28 — #44](https://github.com/dacho-morgh/dacho/issues/44)
- [T33 — #51](https://github.com/dacho-morgh/dacho/issues/51)
- [T39 — #53](https://github.com/dacho-morgh/dacho/issues/53)

## Frontend sequence
- [FE12 — #86](https://github.com/dacho-morgh/dacho/issues/86)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 50:9221;49:7968.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: requests/; admin-request-detail.tsx.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Show own independent requests, accurate stage, required next action and submitted revision.
- [ ] Correction edits the same case and resubmits a new proposal revision; explain new review round when applicable.
- [ ] Final rejection blocks only that event/subtopic and shows reason/reopen state returned by server.
- [ ] Render only released result text; never raw internal memo, other companies, scores or hidden financial data.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT10, UAT12, UAT13, UAT20, UAT26. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE13 -->


## FE14 — Chief triage and owner reopen actions

Frontend implementation work package **FE14**: Chief triage and owner reopen actions.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T21 — #37](https://github.com/dacho-morgh/dacho/issues/37)
- [T28 — #44](https://github.com/dacho-morgh/dacho/issues/44)

## Frontend sequence
- [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70)
- [FE13 — #88](https://github.com/dacho-morgh/dacho/issues/88)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 31885:6566;31885:6681.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: admin-request-list.tsx; admin-request-detail.tsx; admin-request-evaluation.tsx.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Chief sees responsible-event intake and submitted profile/proposal snapshots.
- [ ] Provide return-for-correction and final rejection with distinct consequences and required reasons.
- [ ] Only owner gets audited reopen action; do not reuse a generic approve endpoint for all transitions.
- [ ] Display pending/stale/failed decisions accurately and refresh queue/detail after success.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT12, UAT13, UAT20. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE14 -->


## FE15 — Four-reviewer assignment and controlled replacement

Frontend implementation work package **FE15**: Four-reviewer assignment and controlled replacement.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T22 — #38](https://github.com/dacho-morgh/dacho/issues/38)
- [T26 — #42](https://github.com/dacho-morgh/dacho/issues/42)
- [T27 — #43](https://github.com/dacho-morgh/dacho/issues/43)

## Frontend sequence
- [FE14 — #90](https://github.com/dacho-morgh/dacho/issues/90)
- [FE08 — #73](https://github.com/dacho-morgh/dacho/issues/73)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 31885:20781;31885:6681.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: new chief assignment dialog.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Show the fixed employer plus three distinct ordinary reviewer selectors for the active round.
- [ ] Reject duplicates and ineligible accounts; display exact proposal revision and assignment status.
- [ ] Chief can replace unfinished ordinary reviewer only; employer replacement is owner-only with reason.
- [ ] Retain replacement history and refresh revoked assignment state; show 0/4 through 4/4 based on finalized evaluations.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT14, UAT18, UAT19. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE15 -->


## FE16 — Assigned reviewer and employer queue and dossier

Frontend implementation work package **FE16**: Assigned reviewer and employer queue and dossier.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T09 — #23](https://github.com/dacho-morgh/dacho/issues/23)
- [T23 — #39](https://github.com/dacho-morgh/dacho/issues/39)
- [T27 — #43](https://github.com/dacho-morgh/dacho/issues/43)

## Frontend sequence
- [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70)
- [FE15 — #92](https://github.com/dacho-morgh/dacho/issues/92)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 31422:20716;31881:36043.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: requests/; new reviewer dossier.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Show only cases assigned to the authenticated reviewer/employer and necessary company snapshot/proposal/RFP.
- [ ] Each reviewer sees only their own evaluation and required documents, never other scores or financial files.
- [ ] Handle reassignment/revoked access while a page is open; do not keep exposing cached sensitive data.
- [ ] Unassigned, cross-event and direct-URL paths have clear denied states backed by server enforcement.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT15, UAT19. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE16 -->


## FE17 — Fixed review forms, draft saving and finalization

Frontend implementation work package **FE17**: Fixed review forms, draft saving and finalization.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T24 — #40](https://github.com/dacho-morgh/dacho/issues/40)
- [T25 — #41](https://github.com/dacho-morgh/dacho/issues/41)

## Frontend sequence
- [FE16 — #94](https://github.com/dacho-morgh/dacho/issues/94)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 31881:33737;31881:34265.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: new review form components.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Render the supplied fixed ordinary/employer question sets and common weighted score out of 55.05 from docs/system/review-rubric.md; keep remaining interpretation questions explicit.
- [ ] Save and reopen drafts for the active round; show server field errors and persisted state.
- [ ] Require explicit final confirmation and lock finalized evaluations against normal editing.
- [ ] Show authoritative server score and applicable rubric version using the user-supplied 45/40/15 formula; do not normalize to 100, invent cross-review aggregation or trigger automatic advancement.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT16, UAT17. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE17 -->


## FE18 — Chief four-review summary and explicit next-stage decision

Frontend implementation work package **FE18**: Chief four-review summary and explicit next-stage decision.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T27 — #43](https://github.com/dacho-morgh/dacho/issues/43)
- [T28 — #44](https://github.com/dacho-morgh/dacho/issues/44)
- [T29 — #45](https://github.com/dacho-morgh/dacho/issues/45)

## Frontend sequence
- [FE15 — #92](https://github.com/dacho-morgh/dacho/issues/92)
- [FE17 — #96](https://github.com/dacho-morgh/dacho/issues/96)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 31885:6783;31937:64489.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: new chief result summary.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Show four finalized current-round evaluations with authorized summaries and separate historical rounds.
- [ ] Keep next-stage advancement unavailable until 4/4 and require explicit chief action even at high scores.
- [ ] Return-for-correction explains that previous scores stay historical and a new round is required.
- [ ] Handle a simultaneous fourth review/stale decision by refreshing authoritative state without duplicate transition.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT19, UAT20, UAT21. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE18 -->


## FE19 — Company financial package and supplementary documents

Frontend implementation work package **FE19**: Company financial package and supplementary documents.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T29 — #45](https://github.com/dacho-morgh/dacho/issues/45)
- [T30 — #46](https://github.com/dacho-morgh/dacho/issues/46)
- [T31 — #47](https://github.com/dacho-morgh/dacho/issues/47)
- [T35 — #50](https://github.com/dacho-morgh/dacho/issues/50)

## Frontend sequence
- [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71)
- [FE13 — #88](https://github.com/dacho-morgh/dacho/issues/88)
- [FE18 — #97](https://github.com/dacho-morgh/dacho/issues/97)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: new financial package screens required.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: new company investment package components.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Open financial upload only after chief invitation and show all seven approved document categories.
- [ ] Support financials since establishment for younger companies and multi-file categories where policy permits.
- [ ] Save draft, show incomplete requirements and submit a versioned complete package with retry-safe behavior.
- [ ] Supplementary financial documents travel through Secretariat case correspondence and retain the same restricted visibility.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT21, UAT22, UAT23, UAT25. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE19 -->


## FE20 — Single investment reviewer dossier and memo submission

Frontend implementation work package **FE20**: Single investment reviewer dossier and memo submission.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T31 — #47](https://github.com/dacho-morgh/dacho/issues/47)
- [T32 — #48](https://github.com/dacho-morgh/dacho/issues/48)

## Frontend sequence
- [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70)
- [FE19 — #98](https://github.com/dacho-morgh/dacho/issues/98)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 31964:72696 sidebar only; dossier design required.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: new investment workspace.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Assigned investment person sees only assigned case profiles, authorized evaluations and private financial package.
- [ ] Provide memo draft/save/send to Secretariat with clear submitted/failed states and history.
- [ ] Do not add committee voting, independent approval, rejection or return actions.
- [ ] Supplementary needs are written in memo for Secretariat follow-up; a sent memo does not publish a company result.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT23, UAT24. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE20 -->


## FE21 — Secretariat financial follow-up and result publication

Frontend implementation work package **FE21**: Secretariat financial follow-up and result publication.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T33 — #51](https://github.com/dacho-morgh/dacho/issues/51)
- [T35 — #50](https://github.com/dacho-morgh/dacho/issues/50)

## Frontend sequence
- [FE20 — #99](https://github.com/dacho-morgh/dacho/issues/99)
- [FE22 — #75](https://github.com/dacho-morgh/dacho/issues/75)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 30851:15780; publication design extension required.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: new publication/follow-up components.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Secretariat sees incoming investment memo and can request supplementary documents in case-linked correspondence.
- [ ] Provide a separate company-facing result text editor and explicit publish action.
- [ ] Preview exactly what company will see and keep internal memo/reviewer scores/private files out of published content.
- [ ] Show unpublished/published history and protect duplicate/stale publish submissions.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT25, UAT26. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE21 -->


## FE22 — Role-scoped correspondence, support and private attachments

Frontend implementation work package **FE22**: Role-scoped correspondence, support and private attachments.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T34 — #49](https://github.com/dacho-morgh/dacho/issues/49)
- [T35 — #50](https://github.com/dacho-morgh/dacho/issues/50)

## Frontend sequence
- [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70)
- [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 53:12475;56:13200;30851:15785;31881:42165.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: new-letter-form.tsx; mail-detail-view.tsx; support views; utilities/dashboard-api.ts.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Use authorized recipient lists: company to Secretariat, reviewer/employer to event chief, investment to assigned-case participants, owner/chief general messaging.
- [ ] Keep case scope and attachment classification when composing/replying; render real attachments instead of dropping them in mapping.
- [ ] Provide sent/inbox/thread/read states and send retry without accidental duplication.
- [ ] Deleting an inbox item cannot erase case history; message permission does not grant new dossier or financial access.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT25, UAT27. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE22 -->


## FE23 — Scoped queues, filters, history and actionable notifications

Frontend implementation work package **FE23**: Scoped queues, filters, history and actionable notifications.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T36 — #31](https://github.com/dacho-morgh/dacho/issues/31)
- [T37 — #32](https://github.com/dacho-morgh/dacho/issues/32)
- [T38 — #52](https://github.com/dacho-morgh/dacho/issues/52)
- [T39 — #53](https://github.com/dacho-morgh/dacho/issues/53)

## Frontend sequence
- [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: 50:9221;30812:3389;31422:20716.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: stat-cards.tsx; recent-activities.tsx; request and inbox tables.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Display live counts matching authorized lists, event/stage filters, search and pagination.
- [ ] Preserve filters on back navigation and distinguish empty results from unavailable API.
- [ ] Show actor/time/action/reason/revision and permitted document links from real workflow history.
- [ ] Notifications link to a permitted next action and tolerate delayed/retried delivery without pretending the business transition failed.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT28, UAT29. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE23 -->


## FE24 — Owner exhibition and booth catalogue administration

Frontend implementation work package **FE24**: Owner exhibition and booth catalogue administration.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T47 — #61](https://github.com/dacho-morgh/dacho/issues/61)

## Frontend sequence
- [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70)
- [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: new exhibition administration designs required.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: new exhibition/booth management components.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Create/edit exhibition, guide map, numbered booths/specifications and fixed final price in explicit toman.
- [ ] Set per-company booth cap and show availability/reserved/confirmed states from server.
- [ ] Separate event and exhibition configuration; no interactive map, extra services or gateway controls required.
- [ ] Show saved/server conflict states and do not silently overwrite price already captured by an application.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT31. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE24 -->


## FE25 — Company booth selection and independent reservations

Frontend implementation work package **FE25**: Company booth selection and independent reservations.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T48 — #62](https://github.com/dacho-morgh/dacho/issues/62)
- [T49 — #64](https://github.com/dacho-morgh/dacho/issues/64)
- [T53 — #68](https://github.com/dacho-morgh/dacho/issues/68)

## Frontend sequence
- [FE06 — #85](https://github.com/dacho-morgh/dacho/issues/85)
- [FE24 — #77](https://github.com/dacho-morgh/dacho/issues/77)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: new booth list and reservation designs required.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: new company exhibition catalogue.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] List available specific booths with guide map, dimensions/status and final toman price.
- [ ] Selecting several booths creates independent applications with independent tracking, amount and subsequent receipts.
- [ ] Show company cap and resolve one booth lost to concurrent reservation without claiming successful reservation.
- [ ] State that reservations persist until manual decision; no invented expiry countdown or shared invoice.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT32, UAT34. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE25 -->


## FE26 — Secretariat attendance approval before payment

Frontend implementation work package **FE26**: Secretariat attendance approval before payment.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T55 — #63](https://github.com/dacho-morgh/dacho/issues/63)
- [T53 — #68](https://github.com/dacho-morgh/dacho/issues/68)

## Frontend sequence
- [FE25 — #87](https://github.com/dacho-morgh/dacho/issues/87)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: new attendance workbench required.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: new Secretariat exhibition queue.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Review each reserved-booth application independently and approve/reject attendance with recorded reason.
- [ ] Payment upload is unavailable until attendance approval even for an already verified company.
- [ ] Show pending attendance distinctly from pending receipt or confirmed payment.
- [ ] Rejected attendance refreshes the correct booth availability and preserves unrelated booth applications.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT33. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE26 -->


## FE27 — Independent payment receipt submission and verification

Frontend implementation work package **FE27**: Independent payment receipt submission and verification.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T50 — #65](https://github.com/dacho-morgh/dacho/issues/65)
- [T51 — #66](https://github.com/dacho-morgh/dacho/issues/66)
- [T49 — #64](https://github.com/dacho-morgh/dacho/issues/64)

## Frontend sequence
- [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71)
- [FE26 — #89](https://github.com/dacho-morgh/dacho/issues/89)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: new receipt submission/review designs required.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: new company/Secretariat receipt components.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Show one application/one amount/one receipt version history for the selected booth.
- [ ] Company uploads only after attendance approval; Secretariat confirms or returns receipt with reason.
- [ ] Returned receipt preserves reservation and enables replacement upload on the same application.
- [ ] Handle duplicate receipt/submit/confirmation responses without representing the same receipt as payment for multiple booths; display explicit toman unit.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT34, UAT35, UAT36. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE27 -->


## FE28 — Booth cancellation, manual release and refund visibility

Frontend implementation work package **FE28**: Booth cancellation, manual release and refund visibility.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T52 — #67](https://github.com/dacho-morgh/dacho/issues/67)
- [T53 — #68](https://github.com/dacho-morgh/dacho/issues/68)

## Frontend sequence
- [FE27 — #91](https://github.com/dacho-morgh/dacho/issues/91)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: new cancellation states required.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: new exhibition cancellation dialog/history.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Company can cancel directly only before receipt upload; after receipt/payment submit a cancellation request to Secretariat.
- [ ] Show reason, request pending state, manual resolution and relevant recorded refund status.
- [ ] Release only the affected booth after authorized decision; other independent booth applications stay intact.
- [ ] No automatic expiry or online refund promise; preserve receipt/payment/cancellation history.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT37. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE28 -->


## FE29 — Shared Persian RTL, responsive and failure states

Frontend implementation work package **FE29**: Shared Persian RTL, responsive and failure states.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T40 — #54](https://github.com/dacho-morgh/dacho/issues/54)

## Frontend sequence
- [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70)
- [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: loading/empty variants across all three design pages.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: dashboard shared components and route error/loading boundaries.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Define and apply loading, empty, validation, saved, network error, denied, expired and stale states across the new journeys.
- [ ] Use existing Typography/Button, Tailwind utilities, theme tokens and generated icons under frontend AGENTS.md.
- [ ] Verify phone-width primary journeys, long Persian names, keyboard/focus, modal return focus and readable upload errors.
- [ ] Distinguish service failure from no records; do not claim error-free visual parity for frames without approved design.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT30. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE29 -->


## FE30 — Frontend API contracts and permission regression coverage

Frontend implementation work package **FE30**: Frontend API contracts and permission regression coverage.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T02 — #16](https://github.com/dacho-morgh/dacho/issues/16)
- [T04 — #18](https://github.com/dacho-morgh/dacho/issues/18)
- [T42 — #56](https://github.com/dacho-morgh/dacho/issues/56)
- [T43 — #57](https://github.com/dacho-morgh/dacho/issues/57)
- [T44 — #58](https://github.com/dacho-morgh/dacho/issues/58)

## Frontend sequence
- [FE01 — #70](https://github.com/dacho-morgh/dacho/issues/70)
- [FE07 — #71](https://github.com/dacho-morgh/dacho/issues/71)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: cross-cutting engineering coverage.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: utilities/dashboard-api.ts; utilities/dashboard-server.ts; tests/int.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Add meaningful contract tests for typed stages/actions, denied vs empty responses, document mapping and permission-aware rendering.
- [ ] Exercise seven-role direct navigation, financial redaction, revoked assignment, stale mutation and create-success/submit-failure recovery.
- [ ] Use isolated fixtures; browser hiding tests do not replace server/CMS/proxy authorization checks.
- [ ] Record supported DTOs and errors in frontend-design.md; mocks are labelled and never accepted as release evidence.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT15, UAT23, UAT38, UAT42. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE30 -->


## FE31 — Full event journey frontend E2E and human handoff

Frontend implementation work package **FE31**: Full event journey frontend E2E and human handoff.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T45 — #59](https://github.com/dacho-morgh/dacho/issues/59)
- [T46 — #60](https://github.com/dacho-morgh/dacho/issues/60)

## Frontend sequence
- [FE03 — #80](https://github.com/dacho-morgh/dacho/issues/80)
- [FE05 — #84](https://github.com/dacho-morgh/dacho/issues/84)
- [FE12 — #86](https://github.com/dacho-morgh/dacho/issues/86)
- [FE18 — #97](https://github.com/dacho-morgh/dacho/issues/97)
- [FE19 — #98](https://github.com/dacho-morgh/dacho/issues/98)
- [FE20 — #99](https://github.com/dacho-morgh/dacho/issues/99)
- [FE21 — #100](https://github.com/dacho-morgh/dacho/issues/100)
- [FE22 — #75](https://github.com/dacho-morgh/dacho/issues/75)
- [FE23 — #76](https://github.com/dacho-morgh/dacho/issues/76)
- [FE29 — #78](https://github.com/dacho-morgh/dacho/issues/78)
- [FE30 — #79](https://github.com/dacho-morgh/dacho/issues/79)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: all approved event reference screens plus extensions.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: tests/e2e; docs/system/manual-acceptance-tests.md.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Run isolated real-backed multi-account signup, verification, subtopic submission, four reviews, explicit chief advance, finance, memo and publication.
- [ ] Include correction/new round, rejection/reopen and restricted visibility branches using separate role sessions.
- [ ] Record build, fixtures and failures and make independent slices available to human testing as soon as usable.
- [ ] UAT39 is performed by a human; automated success alone cannot close it.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT39. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE31 -->


## FE32 — Full exhibition frontend E2E and human handoff

Frontend implementation work package **FE32**: Full exhibition frontend E2E and human handoff.

This refines the existing system backlog; the linked original tasks retain ownership of their backend/CMS or cross-layer contracts. Do not implement duplicate workflow rules in the browser. Product decisions through Q38 override conflicting Figma copy.

## Backend / original implementation links
- [T53 — #68](https://github.com/dacho-morgh/dacho/issues/68)
- [T54 — #69](https://github.com/dacho-morgh/dacho/issues/69)
- [T46 — #60](https://github.com/dacho-morgh/dacho/issues/60)

## Frontend sequence
- [FE24 — #77](https://github.com/dacho-morgh/dacho/issues/77)
- [FE25 — #87](https://github.com/dacho-morgh/dacho/issues/87)
- [FE26 — #89](https://github.com/dacho-morgh/dacho/issues/89)
- [FE27 — #91](https://github.com/dacho-morgh/dacho/issues/91)
- [FE28 — #93](https://github.com/dacho-morgh/dacho/issues/93)
- [FE29 — #78](https://github.com/dacho-morgh/dacho/issues/78)
- [FE30 — #79](https://github.com/dacho-morgh/dacho/issues/79)

## Design and current code
Figma file: https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard
Nodes/coverage: new exhibition screen family.
Source entry points under `apps/frontend/src/components/dashboard/` unless a different path is stated: tests/e2e; docs/system/manual-acceptance-tests.md.
Source review is not a runtime pass. Missing screen families require design completion against the approved workflow.

## Deliverable and acceptance
- [ ] Run real-backed independent booth reservations, cap/conflict, attendance approval, receipt correction/confirmation and cancellation.
- [ ] Prove no combined application/receipt, no automatic expiry and no payment before attendance approval.
- [ ] Record independent amounts/statuses and provide reconciliation evidence to Secretariat.
- [ ] UAT40 requires recorded human execution on the deployed test build.
- [ ] Integrate real authorized API responses, including loading/empty/denied/error and stale submission handling. No mocked completion evidence.
- [ ] Use Persian UI copy and existing shared components/style conventions. UI visibility supplements server authorization.

## Verification and handoff
Human gates: UAT40. Run each gate when its slice is deployed; record build, tester, steps and evidence. Gates start **Not run**. Add focused automated coverage appropriate to the changed behavior and link defects. Reviewer forms and per-review scoring were supplied on 2026-10-23 (docs/system/review-rubric.md); remaining interpretation questions, category-specific file limits and approved agreement text are still open where applicable.

<!-- dacho-frontend-plan:FE32 -->

