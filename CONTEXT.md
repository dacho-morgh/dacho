# dacho

The website and request-management system for the specialized Innovation Factory of oil, gas, and petrochemicals in Bushehr province, operated by the Bushehr Province Non-Governmental Research & Technology Fund. Companies register themselves, take part in events, and apply for the factory's services through CMS-defined forms; requests reach the roles that act on them.

## Language

**Innovation Factory** (کارخانه نوآوری):
The factory whose services the system manages.
_Avoid_: factory, the company

**Fund** (صندوق پژوهش و فناوری):
The client/owner — the provincial research & technology fund that operates the factory.
_Avoid_: client, customer, owner

**Company** (شرکت):
The organization that registers on the site, takes part in events, and applies for the factory's services. A first-class record — the `companies` collection in `cms-core` — and the **account holder**: the requests, letters and support tickets belong to it, and people act for it.
_Avoid_: applicant, applicant organization, organization, business, account, principal

**Company user** (مدیر شرکت / نماینده شرکت):
A person who signs in on behalf of a company and acts for it, through the `users.company` relation.
_Avoid_: applicant, applicant user, customer, end user, principal

**Internal user** (کاربر داخلی):
A member of the Fund's own team, created by seeding rather than by self-registration.
_Avoid_: staff, admin, employee, operator

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
A company's formal application for a specific service, carrying documents and answers.
_Avoid_: application, ticket, form submission

**Service** (خدمت):
One of the factory's offerings (financing, events, exhibitions, knowledge-based, commercialization). Defined in the CMS: a dynamic form schema **and** — under revision, see **Workflow** — a routing definition.
_Avoid_: product, offering

**Form** (فرم):
The CMS-defined field schema a company fills to apply for a service — dynamic (rich text + typed fields), editable without code.
_Avoid_: questionnaire, template

**Workflow** (فرآیند) and **Step** (گام):
*Under revision (2026-10-12).* The client has dropped the dynamic message-flow design: the CMS-defined, per-service ordered step sequence is no longer the intended routing model, and no replacement is decided yet. Nothing in this context may assume a per-service step array or engine-ordered steps. Kept here until the routing model is redefined.
_Avoid_: pipeline, flow, process, stage, phase, node

**Role** (نقش):
A named operational responsibility in the factory (دبیرخانه، داور، واحد حسابداری، مدیر ارشد). A dynamic CMS collection, many-to-many with users. Its consumer — workflow-step gating — is under revision with **Workflow**; the collection and the access model around it stand.
_Avoid_: permission, group, team

**Panel** (پنل):
A role-specific dashboard — company panel, reviewer panel, admin panel, secretariat.
_Avoid_: dashboard, console

## Architectural boundaries (resolved)

- **CMS owns definitions** (service, form schema, roles — and the routing definition, itself under revision) in `cms.*`.
- **Backend owns instances** (requests, letters, activities, support tickets) in the `dashboard.*` schema; it reads definitions through Payload's REST API with a service-account key. The `public.*` split in earlier prose was never implemented — do not move tables on its account.
- **Dynamic form answers are stored as JSONB** on the request, validated against the CMS form schema at submission.
- **Identity** (built 2026-10-17; supersedes the 2026-10-12 plan in `.scratch/company-identity/map.md`, a git-ignored local map): the **Company is the account holder** — a first-class `companies` collection in `cms-core`, keyed by a unique national id. A company holds exactly one `representative` (نماینده), a required relation to `users`; the flattened `company*` columns are gone. **Users stay the central identity store** — a company owns no credentials and cannot sign in.
- **Roles** (decided 2026-10-17; `editor` added 2026-10-18): authorization is a **single axis** — `users.roles`, a multi-valued select of **`admin`** (administers everything), **`editor`** («تحریر» — the Fund's content desk: publishes posts, news, categories, media, FAQ and the `mag` page), **`representative`** (acts for their company) and **`referee`** (reviews; granted but not yet consumed). A user may hold any number of them at once; Payload stores them in the `users_roles` join table. This replaces the retired `role: applicant | staff`, `cmsRole: admin | editor` and the dynamic `roles` m2m — the latter and `services.workflow` were deleted with the dropped message-flow design.
- **Registration** (decided 2026-10-17): `/self-signup` is **one atomic act** — the person and the company they represent are created in a single transaction, so a rejected company never leaves a locked-out person behind. **One company, one representative**: a national id that already belongs to a company is rejected with `409 duplicate_national_id`; there is no create-or-claim path, and adding a second person to a company is not supported.
- **Authentication** (→ `docs/linear/authentication.md`): one central `users` collection is the identity store, shared with the CMS. The live application path is Payload **username (= phone) or email + password** via `/api/users/login`; the backend's OTP + ES256 JWT stack is implemented but reached by no screen. Credentials are progressive — `phone` required, `email`/`username`/`password` optional. Payload keeps email + password auth for editors.
- **Authorization** (→ `docs/linear/authorization.md`): one axis — `users.roles` (see **Roles** above). The former three-axis model is retired.
- **Backend framework: Express.**
- **Database:** single PostgreSQL, two schemas (`cms.*` for Payload, `dashboard.*` for backend tables), self-hosted.
- **Domain names:** working subdomains until the client provides real ones.
- **Email:** deferred — v1 uses in-app notifications only.
- **Observability:** structured JSON logs in Phase 1; full stack deferred.

## cms-core collections

Content: Pages, Media, News, Posts, Categories, Events, Exhibitions, Services, FAQ, Reviews, Sponsors, Sliders, NewsletterSubscribers.
Definitional: Companies, Users.
Form-builder forms (the `forms` collection) back the per-service request forms and the `/connect` + `/cooperation` pages.
