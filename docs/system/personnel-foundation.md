# Personnel foundation (T08 / #22)

The authoritative person role is `users.operationalRole`, a scalar select with exactly seven options: `system-owner`, `central-secretariat`, `chief-reviewer`, `reviewer`, `employer-reviewer`, `investment-reviewer`, and `representative`. New people always receive one value. `contentEditor` independently preserves the existing editorial desk; it never grants workflow or personnel authority. `isActive` revokes private access without removing identity/history.

## Management and compatibility

The System Owner manages users through the existing Payload `/admin/collections/users` interface: create a named account with phone/email/password, choose one operational role, optionally grant editorial privilege, and deactivate with the active checkbox. Other users cannot list personnel or grant protected fields. Personnel deletion is denied through REST/GraphQL and access-enforced Local API. Each role, activation, editorial, and service-capability change appends actor/source/time and before/after state to server-maintained `personnelHistory`.

The old `roles` array remains a hidden derived compatibility projection for existing dashboard consumers. Active owner maps to `admin`, active representative to `representative`, active ordinary reviewer to `referee`, and explicit editorial privilege to `editor`. It cannot be written as authority. Other internal roles do not acquire a legacy global-admin alias. CMS authorization reads current scalar fields; the backend reloads the current account on every proxy request and replaces forwarded role claims. Dedicated seven-role dashboard navigation and event/case assignment scope remain FE01/T09/FE08 work.

Public create/self-signup always forces representative, active, no editorial/service privilege, even inside an owner session. The owner session does not turn the public signup endpoint into personnel provisioning. Local trusted provisioning requires an explicit server-only context and no acting user.

## Migration and operator procedure

Migration `20261024_200000_single_operational_role` retains all old role values in `legacyRoles` and preserves identity credentials and existing company links. Unambiguous representatives/reviewers map to their matching scalar role. Existing `editor` membership is copied independently; editorial-only accounts retain their content access with no inferred operational role. Legacy admins, conflicting operational roles, and roleless accounts are inactive pending explicit review. No account automatically becomes System Owner, and no email address identifies a privileged service.

Before any real rollout, complete the account inventory and backup/restore rehearsal in [migration inventory](migration-inventory.md). Each old admin needs an explicitly reviewed mapping. This PR runs only synthetic disposable rehearsal; it does not authorize production migration or select a real owner.

After approved migration in the intended environment, an operator can explicitly bootstrap a named owner with `pnpm --filter @dacho/frontend create:admin --email=<approved email> --phone=<approved phone> --password=<initial password>`. Email and phone have no defaults; an existing password is retained unless explicitly supplied. Map an existing reviewed account without changing credentials with `pnpm --filter @dacho/frontend exec tsx scripts/map-personnel.ts --id=<reviewed user ID> --role=<one approved operational role>`. The mapping preserves editorial privilege and legacy evidence. Each command is an explicit operator action and must use the intended environment configuration. Neither command has been run against real accounts.

`seed:landing` now seeds content only. It never grants owner access or resets a person's password. Backend service provisioning requires explicit `SERVICE_ACCOUNT_API_KEY` and the existing `seed:service-account` command. Its server-only `backendService` capability requires current active API-key authentication; provisioning revokes retained local sessions. The capability grants identity reads and the reviewed company adapter operations; it does not grant owner, editorial, personnel, or dashboard authority. Generic user PATCH is denied to the service. The `/api/users/backend-profile/:id` command whitelists name/phone/email/position for active representatives without editorial/service privilege. Staff, owner, editor and inactive target identities are denied, preventing contact-based recovery/OTP escalation as well as direct password or role changes through the service credential. Service accounts cannot sign in through password/OTP or act through the dashboard proxy.

## Validation and remaining gates

Automated coverage exercises seven-role owner creation, second-role rejection, self-service/public privilege injection, independent editorial access, service profile restrictions, deactivation/login denial, retained attribution, forged/stale proxy roles, current-account revocation and synthetic migration of admin/editor/representative/conflicting accounts. Run integration only through the guarded Phase 0 wrapper.

T09 now consumes this scalar role in the [shared authorization](authorization.md) policy and no longer relies on the compatibility `roles` projection for dashboard decisions. Event-team assignment, dedicated dashboard personnel UI and actual human acceptance remain separate deliverables.

[UAT03 / #104](https://github.com/dacho-morgh/dacho/issues/104) remains **Not run**. No staging deployment or production credential/data change is claimed.

## Delivery record

PR [#150](https://github.com/dacho-morgh/dacho/pull/150) (reviewed head `0dd9b5d`) was squash-merged into `staging` as `5f015bbe4b6ee84cf602c4e82b0d14581553b76a` on 2026-10-24. Its reviewed merge head `279d172b6a29dd86914084c6b29dd907c0c381dc` was produced by merging `origin/staging` (`f29b229`) into `codex/t08-personnel`; that merge preserves the P1 service-credential/contact-escalation fixes from `8658456` and the P2 identity-reload fix from `0dd9b5d`.

All required PR checks passed on `279d172` ([CI run 40113036156](https://github.com/dacho-morgh/dacho/actions/runs/40113036156)): staging base policy, lint/typecheck/unit tests, database-free build, Postgres integration and E2E. Staging CI on `5f015bb` ([run 40114463944](https://github.com/dacho-morgh/dacho/actions/runs/40114463944)) passed the same five checks, and its automatic publish job built and pushed both staging images (`staging` and `staging-sha-5f015bb`). The preceding #149 staging run ([run 40112972154](https://github.com/dacho-morgh/dacho/actions/runs/40112972154)) also passed and published its `staging-sha-f29b229` images. Issue #22 is closed, and the project card moved to Done through the board's built-in closed-item automation.

Remaining limitations: UAT03 [#104](https://github.com/dacho-morgh/dacho/issues/104) is still **Not run**; dedicated dashboard personnel/event-assignment UI remains FE01/T09/FE08; and no real account inventory/mapping, production migration, staging runtime deployment or production credential/data change was performed.
