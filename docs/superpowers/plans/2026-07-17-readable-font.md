# Readable Font Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Audiowide with locally bundled Space Grotesk while proving that existing desktop, tablet, and mobile boxes remain compatible.

**Architecture:** CSS owns the interface and code font stacks, while a bundled variable TrueType font keeps GitHub Pages fully static and private. Existing render-contract tests enforce typography metadata; a temporary no-npm Chrome harness verifies real layout geometry without becoming a runtime dependency.

**Tech Stack:** Static CSS, a local variable TrueType asset, Node's built-in test runner, Python's temporary static server, and system Google Chrome in headless mode.

## Global Constraints

- Change typography only; do not modify spacing, sizing, colors, borders, component structure, behavior, or serialization.
- Use Space Grotesk for interface text and a native monospace stack for commands and aliases.
- Bundle all font files locally with their license; make no runtime third-party requests.
- Test desktop, tablet, and narrow mobile widths before pushing directly to `main`.

---

### Task 1: Typography contract and bundled asset

**Files:**
- Create: `assets/fonts/SpaceGrotesk-Variable.ttf`
- Create: `assets/fonts/SpaceGrotesk-OFL.txt`
- Modify: `test/render-contract.test.js`

**Interfaces:**
- Consumes: the existing static stylesheet and font asset directory.
- Produces: local font assets and an automated contract for the selected font stacks.

- [ ] **Step 1: Write the failing typography contract**

Add assertions that `style.css` declares Space Grotesk from `assets/fonts/SpaceGrotesk-Variable.ttf`, applies it to `body`, uses `ui-monospace` for code surfaces, and contains no `Audiowide` reference. Assert both new asset files exist.

- [ ] **Step 2: Run the focused test to verify RED**

Run: `node test/render-contract.test.js`

Expected: FAIL because Space Grotesk is not bundled or referenced and Audiowide is still active.

- [ ] **Step 3: Download the official font and license**

Fetch `https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf` and `https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/OFL.txt` into the two exact asset paths. Do not add a package or external runtime URL.

- [ ] **Step 4: Confirm asset provenance and format**

Run: `file assets/fonts/SpaceGrotesk-Variable.ttf && sed -n '1,12p' assets/fonts/SpaceGrotesk-OFL.txt`

Expected: TrueType variable font data and the SIL Open Font License header.

### Task 2: CSS-only font replacement

**Files:**
- Modify: `style.css`
- Modify: `README.md`

**Interfaces:**
- Consumes: `assets/fonts/SpaceGrotesk-Variable.ttf`.
- Produces: Space Grotesk interface text with native monospace commands and aliases.

- [ ] **Step 1: Replace only font declarations**

Change the existing `@font-face` to `font-family: "Space Grotesk"`, TrueType source format, weight range `300 700`, normal style, and `font-display: swap`. Change the `body` stack to `"Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.

Change only the existing `.flag-aliases` and `#commandOutput` declarations to `ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace`. Do not touch any other CSS property.

- [ ] **Step 2: Update the privacy note**

Change the README's bundled-font sentence from Audiowide to Space Grotesk and note that code surfaces use the native monospace stack.

- [ ] **Step 3: Run the focused test to verify GREEN**

Run: `node test/render-contract.test.js`

Expected: all render-contract tests pass.

### Task 3: Responsive box verification and publication

**Files:**
- Temporary only: `browser-font-check.html` (remove before commit)

**Interfaces:**
- Consumes: the completed static application.
- Produces: verified layout evidence at `1440x1000`, `800x1000`, and `375x812`.

- [ ] **Step 1: Create a temporary browser harness**

Load `index.html` in a same-origin iframe, switch among Plain, MTP, DFlash, and Multi-GPU, and report failures when page-level horizontal overflow appears or visible labels, buttons, cards, command panels, and selectors clip their text or leave their containing viewport.

- [ ] **Step 2: Run the browser matrix without npm**

Serve the repository with `python3 -m http.server` and run system Google Chrome headlessly at all three viewport sizes. Expected: every harness result reports `ok: true` and screenshots show intact controls and cards.

- [ ] **Step 3: Remove the temporary harness**

Delete `browser-font-check.html` before staging. Confirm `git status --short` lists only intended source, asset, test, documentation, spec, and plan changes.

- [ ] **Step 4: Run final verification**

Run: `node --test test/*.test.js`

Run: `node scripts/audit-flags.js --cli /home/dsmason321/llama.cpp/tools/cli/README.md --server /home/dsmason321/llama.cpp/tools/server/README.md`

Run: `git diff --check`

Expected: nine passing suites, a current registry match, and no whitespace errors.

- [ ] **Step 5: Commit and push**

Stage only the intended files, commit with `Use readable Space Grotesk typography`, and push `main` to `origin/main`.
