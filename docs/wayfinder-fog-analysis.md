# Wayfinder map — Back-end system design (fog analysis)

> Written map only — not charted to a tracker. Source: Linear docs (v1.2, 2026-08-16) + product-definition docs `site-and-system.md`, `services-needed.md`, `contract.md`.

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
- **What dacho is:** website + request-management system for the Bushehr oil/gas/petrochemical Innovation Factory, run by the Bushehr Research & Technology Fund. Companies apply for five services (financing, events, exhibitions, knowledge-based, commercialization); requests flow through multi-department approval workflows.
- **Workflow engine is the core backend domain** — role-gated state machines (submit → review → approve/return/reject).
- **Forms are CMS-defined at runtime** — a Service carries a dynamic field schema (rich text + typed fields); editors change fields without code.
- **Workflows are CMS-defined too** — a Service carries its own role list + step sequence; a new service ships fully formed with zero code.
- **Step model:** linear role-gated steps. Transitions: forward, return-to-company, return-to-previous, reject-terminal.
- **Roles:** dynamic CMS `Role` collection; a step points at a Role; Users relate many-to-many; backend queries role membership to gate each step.

**Architecture:**
- **Definition/instance split:** CMS owns definitions (service/form/workflow/role) in `cms.*`; backend owns instances (requests, history, assignments) in `public.*`, fetching definitions via Payload's API.
- **Dynamic form answers stored as JSONB** on the request, validated against the CMS form schema at submission.
- **cms-core collections:** content (Pages, Media, News, Events, Services, FAQ, Reviews, Sponsors/Partners) + definitional (Service with form+workflow, Role, User).
- **2-service split + shared package:** fused Front-end + CMS (Next.js + Payload), Node.js backend, React-free `cms-core` package.
- **Monorepo:** pnpm workspaces + Turborepo — `apps/frontend`, `apps/backend`, `packages/cms-core`. *(implemented)*
- **`cms-core` is React-free** — no Next.js, no React. *(implemented)*
- **Fused frontend serves admin + API + site** via a thin `payload.config.ts` wrapper. *(implemented)*
- **Backend framework: Express** (matches original doc).
- **Backend owns auth:** backend issues JWT for company/reviewer/staff; Payload admin uses its own users auth for editors; both share the users collection.
- **Database:** single PostgreSQL on the VPS, two schemas (`cms.*` + `public.*`), self-hosted Docker Compose service.
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

*(none — the fog is cleared. Implementation-ready.)*

## Out of scope

- Full K8s/Argo/Higress canary machinery — target, not route (Phase 2, post-contract).
- Image signing / SBOM / Cosign / Syft — aspirational hardening, not Phase 1.
- Transactional email — deferred until after v1.
