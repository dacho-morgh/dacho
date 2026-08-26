<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Frontend implementation rules

Apply these rules to every new or modified frontend component:

1. Build all styling and responsive behavior with Tailwind CSS utilities.
2. Implement animations with GSAP (`gsap` and `@gsap/react`).
3. Render user-facing text with the shared `src/components/ui/typography.tsx` component and its variants. When the required typography style is missing, add a reusable variant there before using it.
4. Use only Tailwind color utilities backed by the theme variables in `src/app/(frontend)/globals.css`. When the required color is missing, add its CSS variable and Tailwind theme mapping there before using it. Do not use ad hoc color literals in components.
5. Build buttons with the shared `src/components/ui/button.tsx` component. When the required button style is missing, add a reusable variant there before using it.
6. Implement every SVG icon as a TSX component in `src/components/icons/generated/`, then export it from `src/components/icons/generated/index.ts` and import it through that barrel.
7. Render icons as TSX components. Do not render icons with `img`, `next/image`, or external SVG file URLs.
