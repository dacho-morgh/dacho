# Design check against Figma — agent setup

Every slice that changes a screen must pass a design check before its PR is marked ready. The check uses the `design-check-figma` skill at [`.agents/skills/design-check-figma/SKILL.md`](../../.agents/skills/design-check-figma/SKILL.md).

## Install

**Claude Code.** It loads project skills from `.claude/skills/`. Copy the skill there once per checkout:

```bash
mkdir -p .claude/skills && cp -r .agents/skills/design-check-figma .claude/skills/
```

Or install it for every project: `cp -r .agents/skills/design-check-figma ~/.claude/skills/`.

**Codex and other agents** that read `.agents/skills/` find it there as is. Agents without skill support: read `SKILL.md` and follow it as a checklist.

Requirements: the Figma MCP server (read access to the file below) and a browser tool that can open the running app.

## dacho specifics

- Figma file: [Dashboard](https://www.figma.com/design/qVz7LsJUPwiXI3OMoW9kAj/Dashboard), file key `qVz7LsJUPwiXI3OMoW9kAj`. The page *Workflow — Missing Screens* (`31650:2`) holds the per-role workflow screens 01–25. Each slice issue lists its node IDs.
- App: `pnpm dev`, then the dashboard at `http://localhost:3000/dashboard` (or whichever port the frontend prints). Log in with the seeded users (`pnpm --filter @dacho/frontend seed:all`).
- Viewports: desktop 1440 × 1024 (the Figma frame size) and mobile 375 × 812.
- The UI is Persian and RTL. The skill's *RTL first* section applies to every screen.
- Product rules in `docs/system/` and `CONTEXT.md` override Figma copy where they conflict (see `docs/system/frontend-audit.md`). Report the conflict instead of "fixing" it toward Figma.

## Where the report goes

Paste the report (summary line, findings table, *Same pattern elsewhere*, *Not checked*) into the slice PR as a comment. Fix findings on the slice branch. Findings in screens that belong to another slice become `bug` issues labelled with that slice.
