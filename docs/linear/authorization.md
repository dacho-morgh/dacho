# Authorization

How the system decides **what** a caller may do. For **who** they are, see
[authentication.md](./authentication.md).

## Implemented

Three access-control functions in `packages/cms-core/src/access/`:

| Function | Rule |
|---|---|
| `anyone` | always `true` |
| `authenticated` | `Boolean(req.user)` — any logged-in user |
| `authenticatedOrPublished` | logged-in user, or `_status === 'published'` |

Per collection: `users` is `authenticated` for every operation; content
(`posts`, `pages`, …) is `authenticatedOrPublished` for read and `authenticated`
for create/update/delete. Drafts (`versions.drafts`) make `_status` the
public/private boundary. Author names surface through a sanitized
`populatedAuthors` array (id + name), not the raw user doc.

There is **no role model yet** — `authenticated` is binary (logged in or not).
No `roles` field and no `Role` collection exist.

## Planned (not implemented)

### Roles — the permission unit (RBAC)

- A **dynamic `Role` collection**, many-to-many with users. Roles are the
  **general permission unit**: they grant capabilities (e.g. "reviewers read all
  pending requests", "company users see only their own company's requests").
- A user's effective permissions are the union of their roles, evaluated by the
  backend on each request. **One RBAC model** — there is no separate permission
  mechanism.

### Workflow gating

- Workflow **steps reference roles**: each step is assigned to a Role, and the
  backend queries a user's role membership to decide whether they may act on
  that step (approve, return, reject). The same roles drive both general
  permissions and step gates.

### Role-specific panels

- Company panel, reviewer panel, admin panel, secretariat — each panel is scoped
  to one or more roles.

## Open questions (implementation detail)

- [ ] Where role membership is enforced: backend API only, or also Payload
      access functions?
- [ ] Company-level scoping: how "a company user sees only their company's data"
      is expressed (a `company` relationship on the user + a `where` clause).
