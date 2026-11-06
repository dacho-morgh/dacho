# Project memory

Standing preferences for how work is done in this repository: things the human
has already said once, corrections already given, and environment facts that are
not visible in the code. `AGENTS.md` points here, so an entry written here applies
to every later task without being repeated in chat.

This file does not hold product rules, domain decisions or delivery policy. Those
live in [docs/system/](docs/system/) and [AGENTS.md](AGENTS.md); if an entry here
ever disagrees with them, they win and the entry is wrong.

## How to add an entry

Append one line under the matching heading, dated, describing the behaviour to
follow rather than the incident that produced it:

`- (YYYY-MM-DD) <imperative rule>.` — add a reason only when it is not obvious.

One idea per line. Delete an entry when it stops being true. Never restate
something another file already enforces: when a rule becomes permanent process,
move it into `AGENTS.md` and remove it here.

## Working agreements

- (2026-10-24) A question about how the agent is configured is a documentation task: answer it, write the durable rule down, and do not start implementation work.
- (2026-10-24) Write a rule that must always apply into `AGENTS.md` or this file instead of repeating it in chat.
- (2026-10-28) Continue work with the current Terra model; do not delegate work to Luna. UI work follows inspected Figma instead of invented styles.

## Corrections already given

- (2026-10-24) Do not begin an implementation batch when the human is asking about memory, rules or setup.

## Environment facts

- (2026-10-24) GitHub CLI is installed at `C:\Program Files\GitHub CLI\gh.exe` but is not on `PATH`; it is authenticated as `sajjaddg` with `repo`, `read:org` and `read:project` scopes, so project-board writes need a wider token.
- (2026-10-24) Integration suites run only through `scripts/phase0-test.ps1` against the isolated Compose project on port 55439; Docker and Node child processes need approval escalation outside the sandbox.
- (2026-10-24) `.dsh-tmp/` is untracked scratch space; never include it in a commit.
