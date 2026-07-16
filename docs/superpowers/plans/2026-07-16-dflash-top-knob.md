# DFlash Top Knob Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a top-level DFlash model-path control that automatically generates llama.cpp's DFlash draft-model and speculative-type flags.

**Architecture:** Keep the field catalogue and UI placement in the existing static app, while extracting the DFlash precedence rule into a small pure JavaScript module that can be tested with Node's built-in test runner. The command builder will apply that rule before its generic field loop and skip overridden generic speculative fields.

**Tech Stack:** Static HTML, browser JavaScript, Node.js built-in `node:test`, CSS already present in the repository.

## Global Constraints

- Emit llama.cpp's exact merged interface: `-md '<path>' --spec-type draft-dflash`.
- A filled DFlash path overrides generic **Draft model path** and **Spec type** values.
- Do not emit duplicate or contradictory `-md` or `--spec-type` flags.
- Preserve both server and CLI support and existing localStorage persistence.

---

### Task 1: Test and implement DFlash command precedence

**Files:**
- Create: `command-rules.js`
- Create: `test/dflash.test.js`
- Modify: `script.js:48,69-74`
- Modify: `index.html:10-12,197,255`
- Modify: `starter-fields.js:261-263`

**Interfaces:**
- Consumes: command state properties `dflashModel`, `specDraftModel`, and `specType`.
- Produces: `LlamaCalcRules.applyDflash(parts, state, pair, filled, warnings) -> Set<string>`, containing field IDs skipped by generic command generation.

- [ ] **Step 1: Write the failing tests**

Create `test/dflash.test.js` with Node tests asserting that an empty DFlash path leaves the command untouched, a filled path appends `-md` and `--spec-type draft-dflash`, conflicts return overridden IDs and one warning, and `index.html` promotes `dflashModel` in `mainIds`.

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { applyDflash } = require('../command-rules.js');

const filled = value => value != null && String(value).trim() !== '';
const pair = (parts, flag, value) => parts.push(`${flag} '${String(value).trim()}'`);

test('empty DFlash path preserves generic speculative fields', () => {
  const parts = [], warnings = [];
  assert.deepEqual([...applyDflash(parts, { dflashModel: '' }, pair, filled, warnings)], []);
  assert.deepEqual(parts, []);
  assert.deepEqual(warnings, []);
});

test('DFlash path emits draft model and draft-dflash type', () => {
  const parts = [], warnings = [];
  const skipped = applyDflash(parts, { dflashModel: '/models/DFlash model.gguf' }, pair, filled, warnings);
  assert.deepEqual(parts, ["-md '/models/DFlash model.gguf'", '--spec-type draft-dflash']);
  assert.deepEqual([...skipped], ['dflashModel', 'specDraftModel', 'specType']);
});

test('DFlash path overrides conflicting generic speculative values with a warning', () => {
  const parts = [], warnings = [];
  applyDflash(parts, { dflashModel: '/dflash.gguf', specDraftModel: '/other.gguf', specType: 'draft-mtp' }, pair, filled, warnings);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /overrides/i);
});

test('DFlash model path is promoted to Main Controls', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const mainIds = html.match(/const mainIds = \[(.*?)\];/s)?.[1] || '';
  assert.match(mainIds, /'dflashModel'/);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `node --test test/dflash.test.js`

Expected: FAIL because `command-rules.js` does not exist.

- [ ] **Step 3: Add the minimal pure DFlash rule**

Create `command-rules.js` as a browser/CommonJS module. `applyDflash` returns an empty set for an empty path. Otherwise it adds the quoted `-md` pair, adds raw `--spec-type draft-dflash`, warns if either generic value is filled, and returns `new Set(['dflashModel', 'specDraftModel', 'specType'])`.

```js
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.LlamaCalcRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function applyDflash(parts, state, pair, filled, warnings) {
        if (!filled(state.dflashModel)) return new Set();
        pair(parts, '-md', state.dflashModel);
        parts.push('--spec-type draft-dflash');
        if (filled(state.specDraftModel) || filled(state.specType)) {
            warnings.push('DFlash model path overrides the generic draft model path and speculative type.');
        }
        return new Set(['dflashModel', 'specDraftModel', 'specType']);
    }
    return { applyDflash };
});
```

- [ ] **Step 4: Wire the field and rule into the app**

Add `dflashModel` to the speculative field catalogue with label `DFlash model path`, no direct flag, and placeholder `/models/model-DFlash.gguf`. Load `command-rules.js` before `script.js`. In `build()`, call `LlamaCalcRules.applyDflash(...)` and skip IDs in its returned set during the generic field loop. Add `dflashModel` to `mainIds` before the generic speculative controls and add the tooltip `Sets a DFlash draft model and automatically enables draft-dflash speculative decoding.` to both tooltip maps.

- [ ] **Step 5: Run focused tests to verify GREEN**

Run: `node --test test/dflash.test.js`

Expected: four tests pass with zero failures.

- [ ] **Step 6: Run static and browser verification**

Run: `node --check command-rules.js && node --check script.js && node --check starter-fields.js && git diff --check`

Expected: all commands exit 0 with no output.

Open the static app in a local browser, fill **DFlash model path** with `/models/DFlash model.gguf`, and confirm Main Controls shows the field and the generated command includes exactly one `-md '/models/DFlash model.gguf'` and one `--spec-type draft-dflash`.

- [ ] **Step 7: Commit the implementation**

```bash
git add command-rules.js test/dflash.test.js script.js index.html starter-fields.js
git commit -m "Add DFlash top knob"
```

### Task 2: Final verification and publication

**Files:**
- Verify only: all tracked files and Git history.

**Interfaces:**
- Consumes: committed implementation from Task 1.
- Produces: updated `main` branch on `origin`.

- [ ] **Step 1: Run the complete verification suite**

Run: `node --test && node --check command-rules.js && node --check script.js && node --check starter-fields.js && git diff --check`

Expected: all tests pass and all checks exit 0.

- [ ] **Step 2: Review scope and repository state**

Run: `git status --short --branch && git log -3 --oneline --decorate`

Expected: clean `main` branch ahead of `origin/main` by the design and implementation commits.

- [ ] **Step 3: Push**

Run: `git push origin main`

Expected: GitHub accepts the two commits and updates `origin/main`.
