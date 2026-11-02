---
name: design-check-figma
description: Visually check an implemented UI against its Figma design and report mismatches. Use when an implementation is incomplete or needs a visual check, or when the user gives a Figma link and asks to verify, compare, or review the build.
---

# Design check (Figma vs implementation)

Implementations are often incomplete. Compare what is built to the Figma design, find mismatches, and hand back a short report. Do not fix anything unless asked.

## Model

Run visual checks with a **Haiku** subagent (`model: "haiku"`) by default. Use a stronger model only if the user asks, or if Haiku cannot tell what it is looking at.

## Steps

1. Get the design: `get_screenshot` and `get_design_context` for each Figma node. Note the tokens (`get_variable_defs`).
2. Get the implementation: open the running app in the browser and screenshot the same screen at the same viewport. Check mobile and desktop if the design has both.
3. Compare side by side: layout, spacing, sizes, colors, typography, icons, states (hover, empty, error, loading), and anything missing.
4. Skip nothing that is absent. A missing element is a finding.

## RTL first

RTL is the most common problem. Check it on every screen:

- Text alignment, reading order, and flex/grid direction.
- Icons that must mirror (arrows, chevrons) and icons that must not.
- Padding, margin, and position written as left/right instead of logical properties (`start`/`end`).
- Double styles: two rules, wrappers, or utility classes setting direction, alignment, or float on the same element can make it revert to LTR in some cases. Look for a stray `dir="ltr"`, an overriding `direction`, `text-align: left`, or a nested component resetting direction.
- Mixed content: numbers, Latin text, and punctuation inside RTL text.

## Check similar cases

For every bug found, search for the same pattern elsewhere. Look at **both** the other Figma screens and the code (grep for the same class, property, or component). Report each additional instance, or say that none was found.

## Report (handoff)

Hand the report to the calling agent. Keep it clean and informative:

- One line summary: screens checked, number of issues.
- A table or list of findings, one per row: **screen / element, expected (Figma), actual, severity, likely cause or file if known.**
- A separate "Same pattern elsewhere" section for the similar-case search.
- A short "Not checked" line for anything you could not verify.
- No long prose, no repeated screenshots. Link or name the node IDs and screenshots instead.
