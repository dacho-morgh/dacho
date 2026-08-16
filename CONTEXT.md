# dacho

The website and request-management system for the specialized Innovation Factory of oil, gas, and petrochemicals in Bushehr province, operated by the Bushehr Province Non-Governmental Research & Technology Fund. Companies apply for factory services via CMS-defined forms; requests circulate through CMS-defined, role-gated approval workflows enforced by the backend.

## Language

**Innovation Factory** (کارخانه نوآوری):
The factory whose services the system manages.
_Avoid_: factory, the company

**Fund** (صندوق پژوهش و فناوری):
The client/owner — the provincial research & technology fund that operates the factory.
_Avoid_: client, customer, owner

**Company** (شرکت):
An applicant organization that registers, submits requests, and applies for services.
_Avoid_: applicant, user, organization

**Reviewer** (داور):
A domain expert who scores plans submitted to events and financing.
_Avoid_: judge, evaluator, referee

**Secretariat** (دبیرخانه):
The central office that receives requests and routes them to the right unit.
_Avoid_: front office, reception

**Plan** (طرح):
A proposal submitted by a company for review (e.g. financing, events).
_Avoid_: proposal, project, submission

**Request** (درخواست):
A company's formal application for a specific service, carrying documents and answers, that moves through the service's workflow.
_Avoid_: application, ticket, form submission

**Service** (خدمت):
One of the factory's offerings (financing, events, exhibitions, knowledge-based, commercialization). Defined in the CMS: a dynamic form schema **and** a workflow.
_Avoid_: product, offering

**Form** (فرم):
The CMS-defined field schema a company fills to apply for a service — dynamic (rich text + typed fields), editable without code.
_Avoid_: questionnaire, template

**Workflow** (فرآیند):
An ordered list of role-gated steps a request traverses. Transitions: forward, return-to-company, return-to-previous, reject-terminal.
_Avoid_: pipeline, flow, process

**Step** (گام):
A single position in a workflow, assigned to a Role.
_Avoid_: stage, phase, node

**Role** (نقش):
A dynamic CMS collection. A step points at a Role; a User relates to many Roles; the backend queries role membership to gate each step.
_Avoid_: permission, group, team

**Panel** (پنل):
A role-specific dashboard — company panel, reviewer panel, admin panel, secretariat.
_Avoid_: dashboard, console

## Architectural boundaries (resolved)

- **CMS owns definitions** (service, form schema, workflow steps, roles) in `cms.*`.
- **Backend owns instances** (requests, step history, assignments) in `public.*`; it fetches definitions via Payload's API.
- **Dynamic form answers are stored as JSONB** on the request, validated against the CMS form schema at submission.
- **Workflow engine is the backend's core domain** — it interprets the CMS-defined workflow and enforces role-gated transitions.
- **Backend framework: Express.**
- **Authentication** (→ `docs/linear/authentication.md`): one central `users` collection is the identity store; **users are the principals**, belonging to a separate `companies` collection. App auth is backend-owned and OTP-first (request-otp → verify-otp → complete-profile → optional username/password); the backend issues **asymmetric JWTs** (ES256). Payload keeps email+password auth for editors. Credentials are progressive — `phone` required, `email`/`username`/`password` optional.
- **Authorization** (→ `docs/linear/authorization.md`): **roles are the permission unit (RBAC)** — a dynamic `Role` collection (many-to-many with users) grants general permissions, and workflow steps reference roles for gating. One model, no separate permission mechanism.
- **Database:** single PostgreSQL, two schemas (`cms.*` + `public.*`), self-hosted.
- **Domain names:** working subdomains until the client provides real ones.
- **Email:** deferred — v1 uses in-app notifications only.
- **Observability:** structured JSON logs in Phase 1; full stack deferred.

## cms-core collections

Content: Pages, Media, News, Events, Services, FAQ, Reviews, Sponsors/Partners.
Definitional: Service (form + workflow), Role, User.
