# Dashboard Consolidation Progress

## Goal
Consolidate `/dashboard` and `/dashboard/admin` into a single `/dashboard` route hierarchy with one unified layout, one sidebar, and role-based access where administrators / managers with the role "مدیر ارشد" see admin routes and views.

## Status Tracker

- [x] Step 1: Create plan and progress tracker file
- [x] Step 2: Implement senior manager / admin role detection helper in `dashboard-server.ts`
- [x] Step 3: Unify sidebar (`app-sidebar.tsx` & `sidebar-shell.tsx`) and remove `admin-sidebar.tsx`
- [x] Step 4: Remove redundant admin layout and unlock `dashboard/layout.tsx` for admin users
- [x] Step 5: Migrate and consolidate routes under `/dashboard`:
  - [x] `/dashboard/companies` and `/dashboard/companies/[id]`
  - [x] `/dashboard/employees`
  - [x] `/dashboard/requests`, `/dashboard/requests/[id]`, and `/dashboard/requests/[id]/evaluation`
  - [x] `/dashboard/letters` and `/dashboard/letters/[id]` (integrated with support tickets for both applicant and admin staff)
  - [x] Remove `/dashboard/support` route and consolidate support tickets into `/dashboard/letters`
  - [x] Remove `apps/frontend/src/app/(frontend)/dashboard/admin` directory
  - [x] Add redirects in `redirects.ts` for `/dashboard/admin/*` -> `/dashboard/*` and `/dashboard/support` -> `/dashboard/letters?tab=support`
- [x] Step 6: Update internal navigation links across admin components
- [x] Step 7: Fix unit and integration tests (23/23 test files passed, 85/85 tests passed)
- [x] Step 8: Verify build, lint, and typecheck (TypeScript 0 errors, ESLint 0 errors, Next.js build succeeded)
- [x] Step 9: Commit verified changes
