# Command Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mode-aware preset dropdown that applies selective JSON recipes and turns Essentials into a focused preset view without replacing search, categories, command generation, or benchmarks.

**Architecture:** `flags.json` owns preset metadata, `lib/registry.js` validates and indexes it, and a new pure `lib/presets.js` owns recipe transitions and focused-field resolution. State persists `activePreset`; rendering consumes preset fields only for Essentials while every other category and the existing command builder remain unchanged.

**Tech Stack:** Static HTML/CSS/JavaScript using the repository's UMD modules, JSON metadata, Node's built-in test runner, and headless Chrome through the existing no-npm CDP harness.

## Global Constraints

- Keep the app fully static with no npm or runtime dependency.
- Support only `llama-cli` and `llama-server` across Linux, macOS, Windows PowerShell, and Windows Command Prompt.
- Preserve benchmark logging, global search, categories, validation, and structured command serialization.
- Keep preset definitions in `flags.json`; never inject command strings.
- Apply semantic requirements only and preserve values not owned by the previous or next recipe.

---

### Task 1: Preset registry and pure recipe engine

**Files:**
- Modify: `flags.json`
- Modify: `lib/registry.js`
- Create: `lib/presets.js`
- Create: `test/presets.test.js`
- Modify: `test/registry.test.js`

**Interfaces:**
- Produces registry properties `presets`, `presetById`, and `allById`.
- Produces `presetsForMode(registry, mode)`, `presetById(registry, id)`, `fieldsForPreset(registry, presetId, mode)`, `applyPreset(registry, state, presetId)`, and `ensurePresetForMode(registry, state)`.

- [ ] **Step 1: Write failing catalogue and transition tests**

```js
const PRESET_IDS = ['plain', 'multiGpu', 'defaultSpeculative', 'mtp', 'dflash', 'draftModel', 'eagle3', 'ngram', 'chatApi', 'embeddings', 'reranking'];
assert.deepEqual(registry.presets.map(preset => preset.id), PRESET_IDS);
assert.deepEqual(presetsForMode(registry, 'cli').map(preset => preset.id), PRESET_IDS.slice(0, 8));
assert.equal(fieldsForPreset(registry, 'multiGpu', 'server').some(field => field.id === 'tensorSplit'), true);

const state = defaultState(registry);
state.values.ctxSize = '8192';
applyPreset(registry, state, 'dflash');
state.values.dflashModel = '/models/dflash.gguf';
applyPreset(registry, state, 'mtp');
assert.equal(state.values.ctxSize, '8192');
assert.equal(state.values.dflashModel, '');
assert.equal(state.values.specType, 'draft-mtp');
```

- [ ] **Step 2: Run tests and verify RED**

```bash
node test/presets.test.js
node test/registry.test.js
```

Expected: missing preset metadata/module failures.

- [ ] **Step 3: Add all eleven JSON recipes**

Each record contains `id`, `label`, `group`, two-sentence `description`, `modes`, ordered `fieldIds`, `ownedFieldIds`, and `values`. Use these exact semantic values:

```js
{
  plain: {}, multiGpu: {}, defaultSpeculative: { specDefault: true },
  mtp: { specType: 'draft-mtp' }, dflash: {},
  draftModel: { specType: 'draft-simple' }, eagle3: { specType: 'draft-eagle3' },
  ngram: { specType: 'ngram-simple' },
  chatApi: { embedding: false, rerank: false, pooling: '' },
  embeddings: { embedding: true, rerank: false, pooling: '' },
  reranking: { embedding: true, rerank: true, pooling: 'rank' }
}
```

All speculative recipes own `specDefault`, `specType`, `dflashModel`, `specDraftModel`, `specDraftHf`, `specDraftNMax`, `specDraftNMin`, `specDraftPSplit`, `specDraftPMin`, the three n-gram-mod fields, and the three n-gram-simple fields. Server workload recipes own `embedding`, `rerank`, and `pooling`; Plain and Multi-GPU own nothing.

- [ ] **Step 4: Validate and index metadata**

```js
const allById = new Map([...(data.fields || []).map(field => [field.id, field]), ...flags.map(flag => [flag.id, flag])]);
for (const preset of data.presets || []) {
    for (const id of [...preset.fieldIds, ...preset.ownedFieldIds, ...Object.keys(preset.values || {})]) {
        if (!allById.has(id)) errors.push(`${preset.id}: unknown preset field ${id}`);
    }
}
```

Also reject duplicate IDs, missing groups/modes/descriptions, and fixed values outside registered choice options.

- [ ] **Step 5: Implement the pure transaction**

```js
function applyPreset(registry, state, presetId) {
    const next = presetById(registry, presetId);
    if (!next || !next.modes.includes(state.mode)) throw new Error(`Preset ${presetId} is unavailable in ${state.mode} mode.`);
    const previous = presetById(registry, state.activePreset);
    const clearIds = new Set([...(previous?.ownedFieldIds || []), ...next.ownedFieldIds]);
    for (const id of clearIds) state.values[id] = emptyValue(registry.allById.get(id));
    Object.assign(state.values, next.values || {});
    state.activePreset = next.id;
    state.activeCategory = 'essentials';
    return next;
}
```

`ensurePresetForMode` retains compatible recipes and applies Plain otherwise.

- [ ] **Step 6: Run focused tests and verify GREEN**

```bash
node test/presets.test.js
node test/registry.test.js
```

- [ ] **Step 7: Commit**

```bash
git add flags.json lib/registry.js lib/presets.js test/presets.test.js test/registry.test.js
git commit -m "Add JSON command preset engine"
```

---

### Task 2: Preset persistence and generated-command regression coverage

**Files:**
- Modify: `lib/state.js`
- Modify: `test/state.test.js`
- Modify: `test/command-builder.test.js`

**Interfaces:**
- Persists `activePreset: string` with a `plain` default.
- Proves recipes flow through unchanged `buildArguments(registry, state, validation)`.

- [ ] **Step 1: Write failing persistence and recipe-command tests**

```js
assert.equal(defaultState(registry).activePreset, 'plain');
applyPreset(registry, mtpState, 'mtp');
assert.deepEqual(argumentValues(buildArguments(registry, mtpState, validateState(registry, mtpState))), ['--spec-type', 'draft-mtp']);
applyPreset(registry, rerankState, 'reranking');
assert.deepEqual(argumentValues(buildArguments(registry, rerankState, validateState(registry, rerankState))), ['--pooling', 'rank', '--embedding', '--rerank']);
```

Add the exact fixed-value assertions before building each command:

```js
for (const [presetId, fieldId, expected] of [
    ['defaultSpeculative', 'specDefault', true],
    ['draftModel', 'specType', 'draft-simple'],
    ['eagle3', 'specType', 'draft-eagle3'],
    ['ngram', 'specType', 'ngram-simple']
]) {
    const state = defaultState(registry);
    applyPreset(registry, state, presetId);
    assert.equal(state.values[fieldId], expected);
}
const dflashState = defaultState(registry);
applyPreset(registry, dflashState, 'dflash');
dflashState.values.dflashModel = '/models/dflash.gguf';
assert.deepEqual(argumentValues(buildArguments(registry, dflashState, validateState(registry, dflashState))), [
    '-md', '/models/dflash.gguf', '--spec-type', 'draft-dflash'
]);
```

- [ ] **Step 2: Run tests and verify RED**

```bash
node test/state.test.js
node test/command-builder.test.js
```

- [ ] **Step 3: Add backward-compatible state persistence**

```js
// default
activePreset: 'plain',
// load
if (typeof saved.activePreset === 'string' && saved.activePreset) state.activePreset = saved.activePreset;
// save
activePreset: state.activePreset || 'plain'
```

Registry-aware mode compatibility remains in `ensurePresetForMode`, not storage.

- [ ] **Step 4: Run focused tests and verify GREEN**

```bash
node test/state.test.js
node test/command-builder.test.js
```

- [ ] **Step 5: Commit**

```bash
git add lib/state.js test/state.test.js test/command-builder.test.js
git commit -m "Persist preset selection and verify recipes"
```

---

### Task 3: Preset-aware Essentials and control-deck UI

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `lib/render.js`
- Modify: `style.css`
- Modify: `test/render-contract.test.js`

**Interfaces:**
- Adds `#presetSelector` and `#presetDescription`.
- Uses `fieldsForPreset` for Essentials only; other categories and search retain existing behavior.

- [ ] **Step 1: Write failing semantic and renderer tests**

```js
assert.match(html, /<label[^>]*for="presetSelector"[^>]*>Preset<\/label>/);
assert.match(html, /<select[^>]*id="presetSelector"[^>]*aria-describedby="presetDescription"/);
assert.ok(html.indexOf('lib/presets.js') < html.indexOf('lib/render.js'));
```

Add tests proving MTP Essentials includes `specType` but not `topP`, Sampling still includes `topP`, and CLI omits the Server workloads optgroup.

- [ ] **Step 2: Run and verify RED**

```bash
node test/render-contract.test.js
```

- [ ] **Step 3: Add the semantic control and script**

```html
<div class="preset-control">
  <label for="presetSelector">Preset</label>
  <select id="presetSelector" aria-describedby="presetDescription"></select>
  <span id="presetDescription" class="visually-hidden">Changes Essentials and replaces values owned by the selected recipe.</span>
</div>
<script src="lib/presets.js"></script>
```

Place the control between Tool and Operating system and the script before `lib/render.js`.

- [ ] **Step 4: Render options and preset fields**

Group `presetsForMode(registry, state.mode)` by `group` into native `<optgroup>` elements. For Essentials use:

```js
const essentials = LlamaCalcPresets.fieldsForPreset(registry, state.activePreset, state.mode);
```

Use the same ordered array for cards and configured counts, and label the workspace eyebrow `${preset.label} preset`.

- [ ] **Step 5: Wire selection and tool fallback**

```js
presetSelector.addEventListener('change', event => {
    const preset = LlamaCalcPresets.applyPreset(registry, state, event.currentTarget.value);
    searchQuery = '';
    searchInput.value = '';
    update();
    renderer.announce(`${preset.label} preset applied. Essentials updated.`);
});
```

Call `ensurePresetForMode` after loading state and after changing Tool, before rendering.

- [ ] **Step 6: Add differentiated cosmic styling**

```css
.preset-control { display: grid; min-width: 13rem; gap: .35rem; padding-left: var(--space-2); border-left: 1px solid var(--signal-violet); }
.preset-control label { color: var(--signal-violet); }
.preset-control select:focus-visible { border-color: var(--signal-violet); box-shadow: 0 0 0 4px rgba(167,139,250,.2), var(--glow-violet); }
```

Keep the control flex-safe below 800px and preserve existing forced-colors/reduced-motion rules.

- [ ] **Step 7: Run and verify GREEN**

```bash
node test/render-contract.test.js
```

- [ ] **Step 8: Commit**

```bash
git add index.html app.js lib/render.js style.css test/render-contract.test.js
git commit -m "Add preset-focused Essentials UI"
```

---

### Task 4: Documentation and complete verification

**Files:**
- Modify: `README.md`
- Modify temporarily: `/tmp/llamacalc-cdp-check.py`

- [ ] **Step 1: Document the catalogue and selective replacement rule**

Explain that LlamaCalc presets are focused builder recipes, distinct from llama.cpp router `.ini` presets and action flags such as `--spec-default`.

- [ ] **Step 2: Run full tests, audit, and whitespace checks**

```bash
node --test test/*.test.js
node scripts/audit-flags.js --cli /home/dsmason321/llama.cpp/tools/cli/README.md --server /home/dsmason321/llama.cpp/tools/server/README.md
git diff --check
```

- [ ] **Step 3: Run real-browser regression**

Verify representative DFlash, MTP, Multi-GPU, and Reranking flows; category navigation back to preset Essentials; global search; tool filtering/fallback; Linux/macOS/PowerShell/CMD commands; typing focus; category scrolling; responsive widths; accessibility media; no external requests; and no console errors.

- [ ] **Step 4: Commit and push verified main**

```bash
git add README.md
git commit -m "Document command presets"
git push origin main
```

Expected: `origin/main` matches the verified local commit and `git status --short` is empty.
