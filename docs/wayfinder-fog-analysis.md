# Wayfinder map — Back-end system design (fog analysis)

> Written map only — not charted to a tracker. Source: Linear docs (v1.2, 2026-08-16) + product-definition docs `site-and-system.md`, `services-needed.md`, `contract.md`.
>
> **Revised 2026-10-12.** Two client changes landed after this map was drawn; both are marked inline below.
> 1. **Registration is a company signup** — the Company is the account holder, and there are exactly two kinds of user (`company`, `internal`). Decided, with its own open tickets: `.scratch/company-identity/map.md` (git-ignored local map).
> 2. **The dynamic message-flow design is dropped** — the CMS-defined, per-service step sequence is no longer the intended routing model and no replacement is decided. Every routing claim below is tagged *under revision*, and the fog it reopens is listed under **Not yet specified**.
>
> Domain glossary in `CONTEXT.md`.

## Destination

Decide the concrete path from Phase 1 (Docker Compose on a single VPS) to the target architecture, so implementation can start — grounded in what dacho actually is. Domain glossary in `CONTEXT.md`.

## Notes

- Domain: self-hosted, no vendor lock-in (user preference: self-hosted over SaaS).
- Issue tracker default is GitHub; Linear only on explicit instruction. Do not chart yet.
- The source doc is aspirational and intentionally "overkill" — treat it as target state, not the route.
- Product-definition source of truth: `docs/linear/site-and-system.md`, `docs/linear/services-needed.md`, `docs/linear/contract.md`.
- Skills for later sessions: `grilling`, `domain-modeling`, `payload` (Payload CMS), `wayfinder`.

## Decisions so far

**Product:**
- **What dacho is:** website + request-management system for the Bushehr oil/gas/petrochemical Innovation Factory, run by the Bushehr Research & Technology Fund. Companies register themselves, take part in events, and apply for five services (financing, events, exhibitions, knowledge-based, commercialization); requests reach the roles that act on them. *(Routing model under revision — see below.)*
- **Company is the account holder** *(2026-10-12)* — a `companies` collection in `cms-core` keyed by national id; `users.company` replaces the flattened `company*` columns; two kinds of user, `company` (self-registered on `/register`) and `internal` (seeded, no app UI). Detail and open tickets: `.scratch/company-identity/map.md`.
- **Workflow engine** — ~~the core backend domain~~ *(under revision)*. Role-gated state machines exist in the code (`apps/backend/src/dashboard/workflow-engine.ts`), but they serve the dynamic message-flow design the client has dropped, and no replacement is decided.
- **Forms are CMS-defined at runtime** — a Service carries a dynamic field schema (rich text + typed fields); editors change fields without code. *(Unchanged by either change.)*
- **Workflows are CMS-defined too** *(under revision)* — a Service carries its own role list + step sequence today; this is the design that was dropped.
- **Step model** *(under revision)* — linear role-gated steps with `forward` / `return-to-company` / `return-to-previous` / `reject` transitions exist in code; whether they survive the replacement routing model is undecided.
- **Roles:** a dynamic CMS `Role` collection, many-to-many with users. The collection stands; its consumer (step gating) is under revision with the step model.

**Architecture:**
- **Definition/instance split:** CMS owns definitions (service/form/role — and the routing definition, itself under revision) in `cms.*`; backend owns instances (requests, letters, activities, support tickets) in the **`dashboard.*`** schema, fetching definitions via Payload's REST API with a service-account key. *(Revised 2026-10-12: this map previously claimed `public.*`; that split was never implemented.)*
- **Dynamic form answers stored as JSONB** on the request, validated against the CMS form schema at submission.
- **cms-core collections:** content (Pages, Media, News, Posts, Categories, Events, Exhibitions, Services, FAQ, Reviews, Sponsors, Sliders, NewsletterSubscribers) + definitional (**Companies**, **Roles**, Users) + form-builder (Forms, FormSubmissions).
- **2-service split + shared package:** fused Front-end + CMS (Next.js + Payload), Node.js backend, React-free `cms-core` package.
- **Monorepo:** pnpm workspaces + Turborepo — `apps/frontend`, `apps/backend`, `packages/cms-core`. *(implemented)*
- **`cms-core` is React-free** — no Next.js, no React. *(implemented)*
- **Fused frontend serves admin + API + site** via a thin `payload.config.ts` wrapper. *(implemented)*
- **Backend framework: Express** (matches original doc).
- **Auth:** one shared `users` identity store — the application path is Payload username (= phone) or email + password, the backend's OTP + ES256 JWT stack is built but reached by no screen, and Payload keeps email + password for editors. *(Revised 2026-10-12: this map previously claimed the backend owns app auth, OTP-first.)* The credential question for company users is an open ticket (`07-company-auth-mode`).
- **Database:** single PostgreSQL on the VPS, two schemas (**`cms.*`** + **`dashboard.*`**), self-hosted Docker Compose service. *(Revised: previously `public.*`.)*
- **API gateway:** Higress (Envoy-based) — TLS, JWT, rate limiting, canary routing *(aspirational)*
- Cache: Redis (3-node cluster) *(aspirational)*
- Object storage: Garage (S3-compatible, 3-node) *(aspirational)*
- CD: GitHub Actions → Argo CD → canary via Argo Rollouts *(aspirational)*

**Operations:**
- **Domain names:** working subdomain convention (`dacho.example.com`, `panel.dacho.example.com`) until the client provides the real domain (contract: client provides domain+server).
- **Email:** deferred — v1 uses in-app notifications only; wire SMTP later.
- **Observability:** structured JSON logs only in Phase 1; Prometheus/Grafana/Loki/Jaeger deferred to Phase 2.
- **Phase 1 → Phase 2 trigger:** after contract delivery + support period ends (fixed milestone).

## Not yet specified

- **The routing model that replaces the dropped dynamic message flow** — whether any per-service step sequence survives, what moves a request, and who acts at each point. Undecided and unticketed, and it invalidates the step/transition vocabulary the product decisions above assumed.
- **Company identity re-model** — decided and in flight; its open tickets live in `.scratch/company-identity/map.md` (company records, membership, ownership, event participation, auth mode, verification gate, sequencing).
- **Staff acting-surface for driving approvals** — `POST /requests/:id/transition` exists, but only forward and reject are reachable from the UI; the staff-facing surface has no decided shape under the new routing model.

## Out of scope

- Full K8s/Argo/Higress canary machinery — target, not route (Phase 2, post-contract).
- Image signing / SBOM / Cosign / Syft — aspirational hardening, not Phase 1.
- Transactional email — deferred until after v1.
