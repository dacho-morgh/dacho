# Authorization

How the system decides **what** a caller may do. For **who** they are, see
[authentication.md](./authentication.md).

## Implemented

Four access-control functions in `packages/cms-core/src/access/`:

| Function | Rule |
|---|---|
| `anyone` | always `true` |
| `authenticated` | `Boolean(req.user)` — any logged-in user |
| `authenticatedOrPublished` | logged-in user, or `_status === 'published'` |
| `hasCmsRole` | `Boolean(req.user?.cmsRole)` — users with a CMS role (`admin`/`editor`) |

Per collection: `users` is `authenticated` for read/update/delete and **public**
(`create: () => true`) for self-registration; content (`posts`, `pages`, …) is
`authenticatedOrPublished` for read and `authenticated` for create/update/delete.
Drafts (`versions.drafts`) make `_status` the public/private boundary. Author
names surface through a sanitized `populatedAuthors` array (id + name), not the
raw user doc.

### Roles (v1 — two orthogonal fields)

The `users` collection carries **two role fields** that separate the two systems
they gate:

| Field | Values | Meaning |
|---|---|---|
| `role` | `applicant` \| `staff` | dashboard side: a company applying for services vs the دبیرخانه / operations team |
| `cmsRole` | `admin` \| `editor` \| null | CMS side: who may reach `/admin` |

- `Users.access.admin` is `hasCmsRole`, so only `cmsRole` holders reach the
  Payload admin panel.
- `role`/`cmsRole` are `saveToJWT: true`.
- **Escalation is blocked three ways:** field-level access on `role`/`cmsRole`
  (`create`/`update` admin-only), `defaultValue: 'applicant'` on `role`, and a
  `beforeChange` hook that forces `role: 'applicant'` + `cmsRole: null` whenever
  the requesting user is not a CMS admin. A self-registering visitor can only
  ever become `applicant`.

## Planned (not implemented)

### Dynamic `Role` collection (future RBAC refinement)

- The v1 two-field model is deliberately flat. If permissions grow beyond the
  four roles, graduate to a **dynamic `Role` collection**, many-to-many with
  users, where roles grant capabilities (e.g. "reviewers read all pending
  requests", "company users see only their own company's requests").
- A user's effective permissions would be the union of their roles, evaluated
  by the backend on each request. **One RBAC model** — no separate permission
  mechanism.

### Workflow gating

- Workflow **steps reference roles**: each step is assigned to a Role, and the
  backend queries a user's role membership to decide whether they may act on
  that step (approve, return, reject).

### Role-specific panels

- Company panel, reviewer panel, admin panel, secretariat — each panel is scoped
  to one or more roles. (The staff/دبیرخانه dashboard is a separate, deferred
  effort.)

## Open questions (implementation detail)

- [x] Where role membership is enforced — v1 enforces in Payload access
      functions (`hasCmsRole`, field-level access, the `beforeChange` hook).
      Backend-side enforcement of `role`/`cmsRole` arrives with the staff
      dashboard, which is deferred.
- [ ] Company-level scoping: how "a company user sees only their company's data"
      is expressed. The flattened `company*` fields on `users` are v1; a
      dedicated `company` relationship + `where` clause is the likely next step.
