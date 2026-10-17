# Authorization

How the system decides **what** a caller may do. For **who** they are, see
[authentication.md](./authentication.md).

## Implemented

Access-control functions in `packages/cms-core/src/access/`:

| Function | Rule |
|---|---|
| `anyone` | always `true` |
| `authenticatedOrPublished` | logged-in user, or `_status === 'published'` — reads of drafts |
| `hasCmsRole` | holds `admin` or `editor` — may reach `/admin` |
| `hasContentRole` | holds `admin` or `editor` — may write editorial content |
| `adminOnly` | holds `admin` — everything outside the content desk |

Every write gate in the config is one of the last two. That invariant is
asserted by `apps/frontend/tests/int/cms-write-gates.int.spec.ts`, which walks
the sanitized config and fails if any collection or global write is gated on
anything else — the point being that no gate can be *absent*, because Payload's
implicit default for a config with no `update` is `Boolean(req.user)`.

Reads are a separate question and are usually public: only writes are
restricted. The three collections whose writes are deliberately open are
`users` (self-signup), `companies` (a company creates itself at signup and its
own representative edits it) and `form-submissions` (the site's contact forms
are how a company reaches the Secretariat; only reading and deleting them are
gated).

Drafts (`versions.drafts`) make `_status` the public/private boundary. Author
names surface through a sanitized `populatedAuthors` array (id + name), not the
raw user doc.

### Roles (v2 — one axis)

The `users` collection carries **one** multi-valued `roles` field, and every
capability in the system is derived from it. (This supersedes the retired
`role: applicant|staff` + `cmsRole: admin|editor` pair and the dynamic `roles`
collection.)

| Value | Label in the panel | Means |
|---|---|---|
| `admin` | مدیر سامانه | Administers everything: users, companies, services, config. |
| `editor` | تحریر | The Fund's content desk. Publishes posts, news, categories, media and FAQ, and shapes the `mag` page. |
| `representative` | نماینده شرکت | Acts for a company in the dashboard panel. |
| `referee` | داور | Reviews plans. Granted, not yet consumed. |

- `Users.access.admin` is `hasCmsRole`, so `admin` and `editor` reach the
  Payload panel. `roles` is `saveToJWT: true`.
- **`editor`'s write scope is declared once**, in
  `access/editorContent.ts` (`EDITOR_CONTENT_SLUGS`, `EDITOR_CONTENT_GLOBALS`),
  and wired per collection to `hasContentRole`.
  `apps/frontend/tests/int/editor-scope.int.spec.ts` asserts the declaration and
  the wiring have not drifted apart, in both directions.
- **Escalation is blocked four ways:** field-level access on `roles`
  (`create`/`update` admin-only), `defaultValue: ['representative']`, a
  `beforeChange` hook that forces `roles: ['representative']` on any non-admin
  create, and the self-signup endpoint's own context. A self-registering
  visitor can only ever become a `representative`.
- **Values live in a Postgres enum** (`enum_users_role`, read by the
  `users_roles` join table), inherited from the original single-valued `role`
  field. Adding a role is therefore a migration, not only a config change —
  see `20261018_090000_add_editor_role`.

## Planned (not implemented)

### Role-specific panels

- Company panel, reviewer panel, admin panel, secretariat — each panel is scoped
  to one or more roles. (The staff/دبیرخانه dashboard is a separate, deferred
  effort.)

## Open questions (implementation detail)

- [x] Where role membership is enforced — in Payload access functions
      (`hasCmsRole`, `hasContentRole`, field-level access, the `beforeChange`
      hook). The backend consumes the same `roles` values, forwarded by the
      Next.js proxy as `x-user-roles`; it does not verify tokens on dashboard
      routes.
- [x] Content-write scope: `editor` covers posts, news, categories, media, FAQ
      and `mag`. Everything else — `pages`, `events`, `exhibitions`, `reviews`,
      `services`, `sponsors`, `sliders`, `newsletter-subscribers`, `redirects`,
      `forms`, and the site-chrome globals — is `adminOnly`. (Decided
      2026-10-18; before that every one of these was on a bare `authenticated`
      gate, so a self-registered representative could rewrite the site.)
- [ ] `referee` is still stored and never consumed, as `editor` was before it.
- [x] Company-level scoping: how "a company user sees only their company's data"
      is expressed. **Decided 2026-10-12** — the Company becomes a first-class
      `companies` record, and the instances (requests, letters, support tickets)
      become company-owned with the acting user recorded; the flattened
      `company*` fields on `users` are retired. Implementation slices:
      `.scratch/company-identity/map.md`.
