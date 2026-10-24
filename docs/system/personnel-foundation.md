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

`seed:landing` now seeds content only. It never grants owner access or resets a person's password. Backend service provisioning requires explicit `SERVICE_ACCOUNT_API_KEY` and the existing `seed:service-account` command. Its server-only `backendService` capability grants identity reads and the reviewed company adapter operations; it does not grant owner, editorial, personnel, or dashboard authority. Generic user PATCH is denied to the service. The `/api/users/backend-profile/:id` command whitelists name/phone/email/position, preventing password or role changes through the service credential. Service accounts cannot sign in through password/OTP or act through the dashboard proxy.

## Validation and remaining gates

Automated coverage exercises seven-role owner creation, second-role rejection, self-service/public privilege injection, independent editorial access, service profile restrictions, deactivation/login denial, retained attribution, forged/stale proxy roles, current-account revocation and synthetic migration of admin/editor/representative/conflicting accounts. Run integration only through the guarded Phase 0 wrapper.

[UAT03 / #104](https://github.com/dacho-morgh/dacho/issues/104) remains **Not run**. Dedicated dashboard personnel UI, event-role assignments and actual human acceptance remain separate deliverables. No staging deployment or production credential/data change is claimed.
