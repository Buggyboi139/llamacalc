# LlamaCalc Static Command Builder Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild LlamaCalc as an efficient cosmic-styled static workbench with a current JSON flag registry, one global search, and reliable Linux, macOS, PowerShell, and Command Prompt output while preserving benchmark behavior.

**Architecture:** A single `flags.json` file owns every current `llama-cli` and `llama-server` definition. Small UMD-style JavaScript modules load and validate that registry, manage state, search metadata, build a shell-neutral argument list, serialize it for the selected target, render the workbench, and preserve benchmark parsing and exports; `app.js` only coordinates those modules.

**Tech Stack:** Static semantic HTML, CSS custom properties, plain browser JavaScript, JSON, Node.js built-in test runner, local static-server browser verification.

## Global Constraints

- Cover only current supported `llama-cli` and `llama-server` options; exclude rows marked removed and options absent from current official help.
- Preserve model-source precedence, empty-field omission, raw passthrough, multiline output, builder/log storage keys, secret filtering, timing parsing, log CRUD, and Markdown/CSV exports.
- Add only one global flag search and Linux/macOS/Windows command targets; show PowerShell/Command Prompt only under Windows.
- Keep all application flag definitions and two-to-three-sentence descriptions in `flags.json`; do not duplicate flag metadata or tooltip copy in HTML or JavaScript.
- Keep the application entirely client-side with no backend, accounts, tracking, analytics, runtime service, framework, bundler, or CDN runtime dependency.
- Docker output, guided setup, profiles, estimators, and non-CLI/server llama.cpp tools remain out of scope.
- Apply the requested cosmic design system and its accessibility, focus, reduced-motion, and responsive requirements.
- Use `llamacmd_state_v1` and `llamacmd_logs_v1` unchanged.
- Follow red-green-refactor: every production behavior is preceded by a test observed failing for the intended reason.

---

## File Structure

### Runtime files

- `index.html`: semantic static shell, mode/platform controls, search, workbench mounts, command panel, and preserved benchmark form.
- `style.css`: complete cosmic design tokens, layout, components, accessibility states, and responsive rules.
- `flags.json`: categories, audit metadata, executable metadata, and every current flag definition.
- `lib/registry.js`: JSON validation, lookup maps, mode/category selectors, and registry loading.
- `lib/search.js`: normalized multi-field search and deterministic ranking.
- `lib/state.js`: default state, old flat-state migration, secret filtering, and localStorage I/O.
- `lib/validation.js`: value validation, conflicts, dependencies, and warnings.
- `lib/command-builder.js`: model-source precedence and shell-neutral argument construction.
- `lib/serializers.js`: POSIX, PowerShell, and Command Prompt quoting and multiline rendering.
- `lib/benchmarks.js`: timing parsing, benchmark persistence, Markdown export, and CSV export.
- `lib/render.js`: safe DOM rendering for categories, flag controls, help, search results, warnings, command output, and log rows.
- `app.js`: registry load and event orchestration.

### Developer and test files

- `scripts/audit-flags.js`: compare registry aliases and modes with current generated upstream README option tables.
- `test/registry.test.js`: schema, descriptions, aliases, current coverage, and stale-option exclusions.
- `test/search.test.js`: search fields, normalization, ranking, and mode filtering.
- `test/state.test.js`: migration, stable keys, secret filtering, and stale-key removal.
- `test/validation.test.js`: value errors, conflicts, and warnings.
- `test/command-builder.test.js`: Linux compatibility and structured arguments.
- `test/serializers.test.js`: POSIX, PowerShell, and Command Prompt adversarial quoting.
- `test/benchmarks.test.js`: timing parser, storage, and export contracts.
- `test/render-contract.test.js`: semantic shell, one search input, toggle groups, descriptions, and script order.

### Files removed after integration

- `command-rules.js`: obsolete DFlash-only rule.
- `script.js`: split into focused modules.
- `starter-fields.js`: metadata and starter behavior move into registry/render modules.
- `starter-fields.css`: styling folds into `style.css`.
- `test/dflash.test.js`: obsolete unsupported DFlash contract.

---

### Task 1: Current JSON registry and upstream audit

**Files:**
- Create: `flags.json`
- Create: `lib/registry.js`
- Create: `scripts/audit-flags.js`
- Create: `test/registry.test.js`
- Reference: `/home/dsmason321/llama.cpp/tools/cli/README.md`
- Reference: `/home/dsmason321/llama.cpp/tools/server/README.md`
- Reference: `/home/dsmason321/llama.cpp/common/arg.cpp`

**Interfaces:**
- Produces: `LlamaCalcRegistry.validateRegistry(data) -> string[]`
- Produces: `LlamaCalcRegistry.createRegistry(data) -> Registry`
- Produces: `LlamaCalcRegistry.loadRegistry(url, fetchImpl) -> Promise<Registry>`
- Produces: `Registry.executables`, `Registry.flags`, `Registry.categories`, `Registry.byId`, `Registry.forMode(mode)`, and `Registry.forCategory(categoryId, mode)`
- Consumes: current generated CLI/server Markdown tables only for developer-time audit, never at application runtime.

- [ ] **Step 1: Write the failing registry contract tests**

Create `test/registry.test.js` with tests that load `flags.json`, require `lib/registry.js`, and assert the exact application contract:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateRegistry, createRegistry } = require('../lib/registry.js');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'flags.json'), 'utf8'));

test('registry has unique IDs and complete searchable metadata', () => {
  assert.deepEqual(validateRegistry(data), []);
  assert.equal(new Set(data.flags.map(flag => flag.id)).size, data.flags.length);
  for (const flag of data.flags) {
    assert.ok(flag.canonical.startsWith('-'));
    assert.ok(['cli', 'server'].some(mode => flag.modes.includes(mode)));
    assert.ok(data.categories.some(category => category.id === flag.category));
    assert.ok(['boolean', 'choice', 'integer', 'number', 'string', 'textarea', 'action'].includes(flag.value.type));
    const sentences = flag.description.trim().split(/(?<=[.!?])\s+/);
    assert.ok(sentences.length >= 2 && sentences.length <= 3, `${flag.id}: ${flag.description}`);
  }
});

test('aliases resolve to exactly one option', () => {
  const registry = createRegistry(data);
  for (const flag of data.flags) {
    for (const alias of [flag.canonical, ...flag.aliases]) {
      assert.equal(registry.byAlias.get(alias).id, flag.id);
    }
  }
});

test('removed and stale options are absent', () => {
  const aliases = new Set(data.flags.flatMap(flag => [flag.canonical, ...flag.aliases]));
  for (const stale of ['--prompt-cache', '--rpc', '-fitp', '-gan', '-gaw', '--interactive-first', '--in-prefix', '--in-suffix']) {
    assert.equal(aliases.has(stale), false, stale);
  }
  assert.equal(data.flags.some(flag => flag.id === 'dflashModel'), false);
});

test('current newly audited families are present', () => {
  const registry = createRegistry(data);
  for (const alias of ['--offline', '--log-colors', '--log-prompts-dir', '--video', '--model-vocoder', '--ui-mcp-proxy', '--agent', '--sse-ping-interval', '--slot-prompt-similarity']) {
    assert.ok(registry.byAlias.has(alias), alias);
  }
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test test/registry.test.js`

Expected: FAIL because `flags.json` and `lib/registry.js` do not exist.

- [ ] **Step 3: Implement registry validation and lookup construction**

Create `lib/registry.js` as a UMD module usable by both browser globals and Node tests. Implement these exact validation rules:

```js
function validateRegistry(data) {
  const errors = [];
  const ids = new Set();
  const aliases = new Map();
  const categories = new Set((data.categories || []).map(category => category.id));
  for (const flag of data.flags || []) {
    if (!flag.id || ids.has(flag.id)) errors.push(`Duplicate or missing id: ${flag.id || '<empty>'}`);
    ids.add(flag.id);
    if (!categories.has(flag.category)) errors.push(`${flag.id}: unknown category ${flag.category}`);
    if (!Array.isArray(flag.modes) || !flag.modes.length) errors.push(`${flag.id}: missing modes`);
    if (!flag.value || !flag.value.type) errors.push(`${flag.id}: missing value type`);
    const sentences = String(flag.description || '').trim().split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length < 2 || sentences.length > 3) errors.push(`${flag.id}: description must contain 2-3 sentences`);
    for (const alias of [flag.canonical, ...(flag.aliases || [])]) {
      if (!alias || !alias.startsWith('-')) errors.push(`${flag.id}: invalid alias ${alias}`);
      if (aliases.has(alias)) errors.push(`${flag.id}: duplicate alias ${alias}`);
      aliases.set(alias, flag.id);
    }
  }
  return errors;
}

function createRegistry(data) {
  const errors = validateRegistry(data);
  if (errors.length) throw new Error(`Invalid flag registry:\n${errors.join('\n')}`);
  const byId = new Map(data.flags.map(flag => [flag.id, Object.freeze(flag)]));
  const byAlias = new Map();
  for (const flag of byId.values()) for (const alias of [flag.canonical, ...flag.aliases]) byAlias.set(alias, flag);
  return Object.freeze({
    meta: Object.freeze(data.meta),
    executables: Object.freeze(data.executables),
    categories: Object.freeze(data.categories),
    flags: Object.freeze([...byId.values()]),
    byId,
    byAlias,
    forMode: mode => [...byId.values()].filter(flag => flag.modes.includes(mode)),
    forCategory: (categoryId, mode) => [...byId.values()].filter(flag => flag.category === categoryId && flag.modes.includes(mode))
  });
}
```

`loadRegistry(url, fetchImpl)` must fetch, reject non-OK responses with `Unable to load flag registry (STATUS)`, parse JSON, and pass it to `createRegistry`.

- [ ] **Step 4: Author the single current `flags.json` catalogue**

Use this exact top-level shape and category order:

```json
{
  "meta": {
    "schemaVersion": 1,
    "auditedAt": "2026-07-16",
    "sources": {
      "cli": "https://github.com/ggml-org/llama.cpp/blob/master/tools/cli/README.md",
      "server": "https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md"
    }
  },
  "executables": {
    "linux": { "cli": "./llama.cpp/build/bin/llama-cli", "server": "./llama.cpp/build/bin/llama-server" },
    "macos": { "cli": "./llama.cpp/build/bin/llama-cli", "server": "./llama.cpp/build/bin/llama-server" },
    "windows": { "cli": ".\\llama.cpp\\build\\bin\\Release\\llama-cli.exe", "server": ".\\llama.cpp\\build\\bin\\Release\\llama-server.exe" }
  },
  "categories": [
    { "id": "model", "label": "Model source" },
    { "id": "runtime", "label": "Runtime & context" },
    { "id": "hardware", "label": "Hardware & offload" },
    { "id": "memory", "label": "Memory & cache" },
    { "id": "sampling", "label": "Sampling" },
    { "id": "prompt", "label": "Prompt & chat" },
    { "id": "multimodal", "label": "Multimodal & audio" },
    { "id": "server", "label": "Server & API" },
    { "id": "speculative", "label": "Speculative decoding" },
    { "id": "adapters", "label": "Adapters" },
    { "id": "logging", "label": "Logging & diagnostics" },
    { "id": "presets", "label": "Presets & actions" },
    { "id": "advanced", "label": "Advanced" }
  ],
  "flags": []
}
```

For every supported option row in both generated tables, create one flag record containing `id`, `label`, `category`, `modes`, `canonical`, `aliases`, `value`, `description`, and `serialization`. Add `featured`, `secret`, `deprecated`, `experimental`, `validation`, `conflicts`, or `requires` only when applicable. Prefer the existing short spelling in `serialization.preferredAlias` to preserve Linux output where it is current; use the canonical long spelling otherwise.

Paired enable/disable rows use one choice record rather than two controls:

```json
{
  "id": "mmap",
  "label": "Memory mapping",
  "category": "memory",
  "modes": ["cli", "server"],
  "canonical": "--mmap",
  "aliases": ["--no-mmap"],
  "value": { "type": "choice", "options": [{ "value": "", "label": "Unset" }, { "value": "on", "label": "On" }, { "value": "off", "label": "Off" }] },
  "description": "Controls whether llama.cpp memory-maps the model file. Leave it enabled for normal fast loading, or disable it when paging behavior makes explicit reads preferable.",
  "serialization": { "emit": "mapped", "map": { "on": "--mmap", "off": "--no-mmap" } }
}
```

Do not add rows whose upstream explanation says the argument has been removed. Keep upstream-deprecated-but-accepted rows only when they still parse, set `deprecated: true`, and name the replacement in the description.

- [ ] **Step 5: Add a deterministic developer-time audit script**

Create `scripts/audit-flags.js` that accepts `--cli PATH --server PATH`, parses only Markdown rows beginning with `| \``, ignores rows whose explanation contains `argument has been removed`, groups aliases from the first code span, and reports:

```text
Missing supported rows:
  [cli] -x, --example
Unknown registry aliases:
  --stale-example
Mode mismatches:
  --server-only is missing server
```

Exit `0` only when all three lists are empty. Treat a row as represented when any alias resolves to a registry record and verify that every alias in that row resolves to that same record.

- [ ] **Step 6: Run registry tests and the upstream audit; verify GREEN**

Run:

```bash
node --test test/registry.test.js
node scripts/audit-flags.js --cli /home/dsmason321/llama.cpp/tools/cli/README.md --server /home/dsmason321/llama.cpp/tools/server/README.md
```

Expected: all tests PASS; audit exits `0` with `Registry matches current CLI and server help.`

- [ ] **Step 7: Commit the registry slice**

```bash
git add flags.json lib/registry.js scripts/audit-flags.js test/registry.test.js
git commit -m "Add current llama.cpp flag registry"
```

---

### Task 2: Search, state migration, and validation

**Files:**
- Create: `lib/search.js`
- Create: `lib/state.js`
- Create: `lib/validation.js`
- Create: `test/search.test.js`
- Create: `test/state.test.js`
- Create: `test/validation.test.js`
- Read: `flags.json`

**Interfaces:**
- Consumes: `Registry` from Task 1.
- Produces: `LlamaCalcSearch.searchFlags(registry, query, mode) -> SearchResult[]`
- Produces: `LlamaCalcState.defaultState(registry) -> BuilderState`
- Produces: `LlamaCalcState.loadState(storage, registry) -> BuilderState`
- Produces: `LlamaCalcState.saveState(storage, state, registry) -> void`
- Produces: `LlamaCalcValidation.validateState(registry, state) -> { errorsById: Map, warnings: Warning[] }`

- [ ] **Step 1: Write failing search tests**

Use a three-record in-memory registry and assert canonical, alias, label, category, description, and mode matches. Include exact ranking and punctuation normalization:

```js
test('exact alias outranks description and category matches', () => {
  const results = searchFlags(registry, '--ctx-size', 'server');
  assert.equal(results[0].flag.id, 'ctxSize');
  assert.equal(results[0].matchedBy, 'alias');
});

test('normalizes leading dashes, case, and punctuation', () => {
  assert.equal(searchFlags(registry, 'CTX SIZE', 'server')[0].flag.id, 'ctxSize');
});

test('does not return CLI-only options in server mode', () => {
  assert.deepEqual(searchFlags(registry, 'multiline input', 'server'), []);
});
```

- [ ] **Step 2: Run search tests and verify RED**

Run: `node --test test/search.test.js`

Expected: FAIL because `lib/search.js` does not exist.

- [ ] **Step 3: Implement deterministic search**

Normalize with lowercase Unicode NFKD, remove diacritics, convert `_` and `-` to spaces, collapse whitespace, and preserve a second compact form without spaces. Score exact canonical/alias `100`, canonical/alias prefix `80`, label exact/prefix `70`, token-complete metadata matches `50`, and substring matches `20`. Sort by descending score, then registry order. Return `{ flag, score, matchedBy }` without HTML fragments.

- [ ] **Step 4: Run search tests and verify GREEN**

Run: `node --test test/search.test.js`

Expected: all search tests PASS.

- [ ] **Step 5: Write failing state and validation tests**

Cover the flat legacy shape and exact storage keys:

```js
test('loads legacy values, supplies platform defaults, and drops stale keys', () => {
  const storage = memoryStorage({
    llamacmd_state_v1: JSON.stringify({ mode: 'cli', ctxSize: '8192', dflashModel: '/old.gguf', multiline: false })
  });
  const state = loadState(storage, registry);
  assert.equal(state.mode, 'cli');
  assert.equal(state.platform, 'linux');
  assert.equal(state.windowsShell, 'powershell');
  assert.equal(state.values.ctxSize, '8192');
  assert.equal('dflashModel' in state.values, false);
});

test('never persists registry-marked secrets', () => {
  saveState(storage, { ...defaultState(registry), values: { apiKey: 'secret', ctxSize: '4096' } }, registry);
  const saved = JSON.parse(storage.getItem('llamacmd_state_v1'));
  assert.equal(saved.apiKey, undefined);
  assert.equal(saved.ctxSize, '4096');
});

test('reports invalid ports without destroying the value', () => {
  const result = validateState(registry, { mode: 'server', values: { port: '70000' } });
  assert.match(result.errorsById.get('port'), /between 1 and 65535/);
});
```

- [ ] **Step 6: Run state and validation tests; verify RED**

Run: `node --test test/state.test.js test/validation.test.js`

Expected: FAIL because the modules do not exist.

- [ ] **Step 7: Implement state and validation**

`defaultState(registry)` returns:

```js
{
  mode: 'server',
  platform: 'linux',
  windowsShell: 'powershell',
  multiline: true,
  activeCategory: 'essentials',
  values: Object.fromEntries(registry.flags.map(flag => [flag.id, flag.value.default ?? (flag.value.type === 'boolean' ? false : '')]))
}
```

`loadState` accepts the old flat object, reads only current registry IDs, and leaves secret fields at defaults. `saveState` writes the existing flat format plus `platform`, `windowsShell`, and `activeCategory`; it excludes unknown keys and `secret: true` flags.

`validateState` applies integer/number/min/max/pattern metadata, source conflict warnings, the current `0.0.0.0` without API-key warning, tensor-split format warning, secret persistence warning, deprecated warnings, and registry `requires`/`conflicts`. Preserve invalid text in state and return errors by ID.

- [ ] **Step 8: Run all Task 2 tests and verify GREEN**

Run: `node --test test/search.test.js test/state.test.js test/validation.test.js`

Expected: all tests PASS.

- [ ] **Step 9: Commit the state/search slice**

```bash
git add lib/search.js lib/state.js lib/validation.js test/search.test.js test/state.test.js test/validation.test.js
git commit -m "Add flag search and builder state core"
```

---

### Task 3: Shell-neutral command builder and POSIX compatibility

**Files:**
- Create: `lib/command-builder.js`
- Create: `lib/serializers.js`
- Create: `test/command-builder.test.js`
- Create: `test/serializers.test.js`
- Read: `script.js:69-75`

**Interfaces:**
- Consumes: current `Registry`, `BuilderState`, and validation output.
- Produces: `LlamaCalcCommand.buildArguments(registry, state) -> { executable, segments, warnings }`
- Produces: `LlamaCalcSerializers.serializeCommand(model, target) -> string`
- Segment type: `{ kind: 'argument', value: string } | { kind: 'raw', value: string }`
- Target type: `{ platform: 'linux'|'macos'|'windows', windowsShell: 'powershell'|'cmd', multiline: boolean }`

- [ ] **Step 1: Write failing command-builder regression tests**

Test exact current Linux behaviors:

```js
test('local model wins source conflicts and empty fields are omitted', () => {
  const state = makeState({ modelPath: '/models/Model One.gguf', hfRepo: 'org/repo', ctxSize: '4096', temp: '' });
  const model = buildArguments(registry, state);
  assert.deepEqual(model.segments.map(segment => segment.value), ['-m', '/models/Model One.gguf', '-c', '4096']);
  assert.match(model.warnings[0].message, /Priority is local path/);
});

test('HF file and token emit only with the selected HF source', () => {
  const model = buildArguments(registry, makeState({ hfRepo: 'org/repo', hfFile: 'q4.gguf', hfToken: 'token' }));
  assert.deepEqual(model.segments.map(segment => segment.value), ['-hf', 'org/repo', '-hff', 'q4.gguf', '-hft', 'token']);
});

test('raw passthrough keeps each non-empty line verbatim', () => {
  const model = buildArguments(registry, makeState({ extraFlags: '--foo value\n\n--bar="two words"' }));
  assert.deepEqual(model.segments.slice(-2), [
    { kind: 'raw', value: '--foo value' },
    { kind: 'raw', value: '--bar="two words"' }
  ]);
});
```

- [ ] **Step 2: Run command-builder tests and verify RED**

Run: `node --test test/command-builder.test.js`

Expected: FAIL because `lib/command-builder.js` does not exist.

- [ ] **Step 3: Implement structured command construction**

Resolve the executable from a current explicit path value or `registry.executables[state.platform][state.mode]`. Emit model sources in the exact priority `modelPath`, `hfRepo`, `modelUrl`, `dockerRepo`; only append HF file/token for `hfRepo`. Iterate registry order, skip wrong-mode, empty, invalid, source-special, and executable fields, and interpret serialization as:

```js
switch (flag.serialization.emit) {
  case 'boolean': if (value) push(flag.serialization.preferredAlias || flag.canonical); break;
  case 'mapped': if (flag.serialization.map[value]) push(flag.serialization.map[value]); break;
  case 'pair': if (filled(value)) { push(flag.serialization.preferredAlias || flag.canonical); push(String(value).trim()); } break;
  case 'raw-lines': appendRawLines(value); break;
}
```

Return warning objects as `{ id, fieldId, severity: 'warning', message }` so rendering can link them.

- [ ] **Step 4: Run command-builder tests and verify GREEN**

Run: `node --test test/command-builder.test.js`

Expected: all command-builder tests PASS.

- [ ] **Step 5: Write failing POSIX serializer tests**

```js
test('POSIX serializer safely quotes spaces and apostrophes', () => {
  const model = {
    executable: './llama server',
    segments: [
      { kind: 'argument', value: '-m' },
      { kind: 'argument', value: "/models/O'Brien.gguf" }
    ]
  };
  assert.equal(serializeCommand(model, { platform: 'linux', multiline: false }),
    `'./llama server' -m '/models/O'\\''Brien.gguf'`);
});

test('macOS uses the same POSIX quoting and backslash continuation', () => {
  assert.equal(serializeCommand(simpleModel, { platform: 'macos', multiline: true }),
    "./llama-cli \\\n+  -m \\\n+  'model one.gguf'");
});
```

- [ ] **Step 6: Run POSIX serializer tests and verify RED**

Run: `node --test test/serializers.test.js`

Expected: FAIL because `serializeCommand` is missing.

- [ ] **Step 7: Implement POSIX serialization**

Leave `/^[A-Za-z0-9_@%+=:,./\\-]+$/` tokens unquoted; otherwise single-quote and replace each apostrophe with `'\\''`. Keep raw segments verbatim. Use one space in single-line mode and ` \\\n  ` between segments in multiline mode.

- [ ] **Step 8: Run Tasks 1-3 tests and verify GREEN**

Run: `node --test test/registry.test.js test/search.test.js test/state.test.js test/validation.test.js test/command-builder.test.js test/serializers.test.js`

Expected: all tests PASS.

- [ ] **Step 9: Commit the command core**

```bash
git add lib/command-builder.js lib/serializers.js test/command-builder.test.js test/serializers.test.js
git commit -m "Preserve command building with structured arguments"
```

---

### Task 4: PowerShell and Command Prompt serializers

**Files:**
- Modify: `lib/serializers.js`
- Modify: `test/serializers.test.js`
- Modify: `test/command-builder.test.js`

**Interfaces:**
- Extends: `serializeCommand(model, target)` for `{ platform: 'windows', windowsShell: 'powershell'|'cmd' }`.
- Preserves: structured segment model from Task 3.

- [ ] **Step 1: Write failing PowerShell tests**

```js
test('PowerShell quotes literal paths, apostrophes, dollars, and ampersands', () => {
  const model = windowsModel('.\\llama server.exe', ['-p', "It's $5 & safe"]);
  assert.equal(
    serializeCommand(model, { platform: 'windows', windowsShell: 'powershell', multiline: false }),
    "'.\\llama server.exe' -p 'It''s $5 & safe'"
  );
});

test('PowerShell multiline uses a backtick continuation', () => {
  assert.equal(
    serializeCommand(windowsModel('llama-cli.exe', ['-m', 'model.gguf']), { platform: 'windows', windowsShell: 'powershell', multiline: true }),
    'llama-cli.exe `\n  -m `\n  model.gguf'
  );
});
```

- [ ] **Step 2: Run PowerShell tests and verify RED**

Run: `node --test --test-name-pattern=PowerShell test/serializers.test.js`

Expected: FAIL with unsupported Windows serializer.

- [ ] **Step 3: Implement PowerShell quoting**

Leave only `/^[A-Za-z0-9_./\\:-]+$/` unquoted. Wrap every other argument in single quotes and replace `'` with `''`. Keep raw segments verbatim. Join with ` ` or `` `\n  ``.

- [ ] **Step 4: Run PowerShell tests and verify GREEN**

Run: `node --test --test-name-pattern=PowerShell test/serializers.test.js`

Expected: all PowerShell tests PASS.

- [ ] **Step 5: Write failing Command Prompt adversarial tests**

Cover spaces, quotes, trailing backslashes, percent expansion, ampersands, pipes, carets, parentheses, and multiline output:

```js
test('Command Prompt protects expansion and command metacharacters', () => {
  const model = windowsModel('llama-server.exe', ['-p', '100% ready & echo nope | more']);
  assert.equal(
    serializeCommand(model, { platform: 'windows', windowsShell: 'cmd', multiline: false }),
    'llama-server.exe -p "100%% ready ^& echo nope ^| more"'
  );
});

test('Command Prompt doubles trailing backslashes before a closing quote', () => {
  const model = windowsModel('llama-cli.exe', ['-m', 'C:\\Model Folder\\']);
  assert.equal(
    serializeCommand(model, { platform: 'windows', windowsShell: 'cmd', multiline: false }),
    'llama-cli.exe -m "C:\\Model Folder\\\\"'
  );
});

test('Command Prompt multiline uses caret continuation', () => {
  assert.equal(
    serializeCommand(windowsModel('llama-cli.exe', ['-m', 'model.gguf']), { platform: 'windows', windowsShell: 'cmd', multiline: true }),
    'llama-cli.exe ^\n  -m ^\n  model.gguf'
  );
});
```

- [ ] **Step 6: Run Command Prompt tests and verify RED**

Run: `node --test --test-name-pattern='Command Prompt' test/serializers.test.js`

Expected: FAIL with unsupported or incorrectly quoted Command Prompt output.

- [ ] **Step 7: Implement Command Prompt quoting**

Implement the Windows CRT backslash-before-quote algorithm inside a quoted argument: double runs of backslashes before `"`, double trailing backslashes before the closing quote, and backslash-escape embedded quotes. Before quoting, double `%` to prevent environment expansion and caret-escape `^`, `&`, `|`, `<`, `>`, `(`, and `)` in the emitted command context. Keep raw segments verbatim and surface the existing cross-shell raw warning through validation.

- [ ] **Step 8: Test platform switching without state loss**

Add a command-builder test that reuses one `values` object under Linux, macOS, PowerShell, and Command Prompt, then asserts identical flag/value segment arrays and target-specific executable defaults.

Run: `node --test test/command-builder.test.js test/serializers.test.js`

Expected: all tests PASS.

- [ ] **Step 9: Commit Windows support**

```bash
git add lib/serializers.js test/serializers.test.js test/command-builder.test.js
git commit -m "Add macOS and Windows command serialization"
```

---

### Task 5: Preserve benchmark behavior in a focused module

**Files:**
- Create: `lib/benchmarks.js`
- Create: `test/benchmarks.test.js`
- Read: `script.js:76-89`

**Interfaces:**
- Produces: `parseTiming(text) -> TimingResult`
- Produces: `loadLogs(storage) -> BenchmarkEntry[]`
- Produces: `saveLogs(storage, logs) -> void`
- Produces: `createLogEntry(input) -> BenchmarkEntry`
- Produces: `logsMarkdown(logs) -> string`
- Produces: `logsCsv(logs) -> string`
- Uses storage key: `llamacmd_logs_v1`.

- [ ] **Step 1: Write failing timing and export regression tests**

Include the exact existing formats:

```js
test('parses llama.cpp text timings', () => {
  const result = parseTiming(`
llama_perf_context_print: prompt eval time = 100.00 ms / 20 tokens (200.00 tokens per second)
llama_perf_context_print: eval time = 500.00 ms / 10 runs (20.00 tokens per second)
llama_perf_context_print: total time = 600.00 ms
  `);
  assert.deepEqual(result, { promptTokens: '20', promptTps: '200.00', genTokens: '10', genTps: '20.00', totalMs: '600.00' });
});

test('parses nested server timing JSON', () => {
  const result = parseTiming(JSON.stringify({ response: { timings: { prompt_n: 12, predicted_n: 4, prompt_per_second: 88.888, predicted_per_second: 22.222, prompt_ms: 100, predicted_ms: 200 } } }));
  assert.deepEqual(result, { promptTps: '88.89', genTps: '22.22', promptTokens: 12, genTokens: 4, totalMs: '300' });
});

test('Markdown and CSV escape pipes, newlines, quotes, and commands', () => {
  const log = fixtureLog({ notes: 'a|b\nsecond', command: 'llama-cli -p "hi"' });
  assert.match(logsMarkdown([log]), /a\\\|b<br>second/);
  assert.match(logsCsv([log]), /"llama-cli -p ""hi"""/);
});
```

- [ ] **Step 2: Run benchmark tests and verify RED**

Run: `node --test test/benchmarks.test.js`

Expected: FAIL because `lib/benchmarks.js` does not exist.

- [ ] **Step 3: Extract behavior without changing formats**

Move the parser, recursive `findTiming`, rounding, storage, Markdown, CSV, and log-entry creation into the UMD module. Keep field names, rounding, table columns, storage key, and export headers byte-compatible with the old implementation.

- [ ] **Step 4: Run benchmark tests and verify GREEN**

Run: `node --test test/benchmarks.test.js`

Expected: all benchmark tests PASS.

- [ ] **Step 5: Commit benchmark extraction**

```bash
git add lib/benchmarks.js test/benchmarks.test.js
git commit -m "Preserve benchmark parsing and exports"
```

---

### Task 6: Semantic workbench renderer and app integration

**Files:**
- Rewrite: `index.html`
- Create: `lib/render.js`
- Create: `app.js`
- Create: `test/render-contract.test.js`
- Read: all runtime modules from Tasks 1-5.

**Interfaces:**
- Consumes: registry, state, search, validation, command builder, serializers, and benchmarks modules.
- Produces: `LlamaCalcRender.createRenderer(document, callbacks) -> Renderer`
- Produces renderer methods: `renderNavigation`, `renderFlags`, `renderSearchResults`, `renderCommand`, `renderWarnings`, `renderLogs`, and `announce`.
- `app.js` owns one mutable `BuilderState` and always re-renders from that state.

- [ ] **Step 1: Write failing static shell contract tests**

Read `index.html` as text and assert:

```js
test('shell has exactly one global flag search', () => {
  const html = readIndex();
  assert.equal((html.match(/type="search"/g) || []).length, 1);
  assert.match(html, /id="flagSearch"/);
  assert.match(html, /aria-controls="flagWorkspace"/);
});

test('mode and operating system are peer radio groups', () => {
  const html = readIndex();
  assert.match(html, /<fieldset[^>]*id="modeSelector"/);
  assert.match(html, /<fieldset[^>]*id="platformSelector"/);
  for (const value of ['server', 'cli', 'linux', 'macos', 'windows']) assert.match(html, new RegExp(`value="${value}"`));
});

test('shell contains workbench and preserved benchmark landmarks', () => {
  const html = readIndex();
  for (const id of ['categoryNav', 'flagWorkspace', 'commandOutput', 'warningList', 'benchmarkLog', 'logTable']) assert.match(html, new RegExp(`id="${id}"`));
});
```

- [ ] **Step 2: Run shell tests and verify RED**

Run: `node --test test/render-contract.test.js`

Expected: FAIL because the current shell lacks the platform/search/workbench contract.

- [ ] **Step 3: Rewrite `index.html` as the semantic static shell**

Use a sticky `<header>`, labeled `<fieldset>` radio groups for mode/platform/shell, one labeled `type="search"`, `<nav aria-label="Flag categories">`, `<main>`, `<section aria-labelledby="commandHeading">`, `<pre tabindex="0">`, and `<section id="benchmarkLog">`. Keep every existing benchmark input ID so stored workflows and renderer bindings remain stable. Load scripts in dependency order and finish with `app.js` using `defer`:

```html
<script src="lib/registry.js" defer></script>
<script src="lib/search.js" defer></script>
<script src="lib/state.js" defer></script>
<script src="lib/validation.js" defer></script>
<script src="lib/command-builder.js" defer></script>
<script src="lib/serializers.js" defer></script>
<script src="lib/benchmarks.js" defer></script>
<script src="lib/render.js" defer></script>
<script src="app.js" defer></script>
```

- [ ] **Step 4: Run shell tests and verify GREEN**

Run: `node --test test/render-contract.test.js`

Expected: all shell contract tests PASS.

- [ ] **Step 5: Write failing renderer safety and description tests**

Test renderer helper exports without a third-party DOM by using focused fake elements. Assert text is assigned through `textContent`, tooltip triggers have `aria-describedby`, configured counts include only nonempty values, and search result rendering reuses `data-flag-id` rather than creating alternate state keys.

Run: `node --test --test-name-pattern=renderer test/render-contract.test.js`

Expected: FAIL because `lib/render.js` does not exist.

- [ ] **Step 6: Implement renderer and app orchestration**

Renderer requirements:

- category buttons include configured counts and `aria-current`;
- Essentials selects `featured: true` flags from the active mode;
- field controls derive only from `flag.value` metadata;
- help buttons reference persistent visually-hidden descriptions via `aria-describedby` and also drive a pointer/focus popover;
- result labels, aliases, and descriptions use `textContent`, never metadata-derived `innerHTML`;
- warnings are buttons or links that focus the associated field;
- Windows-shell fieldset is hidden and disabled unless Windows is selected;
- command copy and log copy actions announce success in `#liveRegion`.

App requirements:

```js
document.addEventListener('DOMContentLoaded', async () => {
  const registry = await LlamaCalcRegistry.loadRegistry('flags.json');
  let state = LlamaCalcState.loadState(localStorage, registry);
  const renderer = LlamaCalcRender.createRenderer(document, { onFieldChange, onCategoryChange, onWarningFocus });
  function update() {
    const validation = LlamaCalcValidation.validateState(registry, state);
    const model = LlamaCalcCommand.buildArguments(registry, state, validation);
    const command = LlamaCalcSerializers.serializeCommand(model, state);
    renderer.render({ registry, state, validation, model, command });
    LlamaCalcState.saveState(localStorage, state, registry);
  }
  update();
});
```

Catch registry load failures, show the message in an alert card, and leave benchmark logs readable. Implement `/` search focus only when `event.target` is not an input, textarea, select, button, or contenteditable element; Escape clears search without trapping focus.

- [ ] **Step 7: Integrate preserved benchmark controls**

Use `LlamaCalcBenchmarks` for parsing, logging, saving, deleting, copying, and exports. Preserve confirmation dialogs for reset and clear logs. Newly created log entries capture the exact serialized command; existing entries render unchanged.

- [ ] **Step 8: Run all unit and contract tests**

Run: `node --test test/*.test.js`

Expected: all tests PASS with no warnings or unhandled rejections.

- [ ] **Step 9: Commit the functional workbench**

```bash
git add index.html app.js lib/render.js test/render-contract.test.js
git commit -m "Build searchable static command workbench"
```

---

### Task 7: Cosmic design system and responsive accessibility

**Files:**
- Rewrite: `style.css`
- Modify: `index.html`
- Modify: `lib/render.js`
- Modify: `test/render-contract.test.js`

**Interfaces:**
- Consumes: semantic class names and state attributes from Task 6.
- Produces: cosmic responsive workbench with visible interaction states and no behavior changes.

- [ ] **Step 1: Load the required cosmic skill modules before CSS work**

Read these files completely:

```text
/home/dsmason321/.codex/skills/cosmic-design-system/references/layout.md
/home/dsmason321/.codex/skills/cosmic-design-system/references/typography.md
/home/dsmason321/.codex/skills/cosmic-design-system/references/colors.md
/home/dsmason321/.codex/skills/cosmic-design-system/references/buttons.md
/home/dsmason321/.codex/skills/cosmic-design-system/references/cards.md
/home/dsmason321/.codex/skills/cosmic-design-system/references/shadows.md
/home/dsmason321/.codex/skills/cosmic-design-system/references/radius.md
/home/dsmason321/.codex/skills/cosmic-design-system/references/borders.md
/home/dsmason321/.codex/skills/cosmic-design-system/references/inputs.md
/home/dsmason321/.codex/skills/cosmic-design-system/references/sidebars.md
/home/dsmason321/.codex/skills/cosmic-design-system/references/radios-checkboxes-toggle.md
/home/dsmason321/.codex/skills/cosmic-design-system/references/tooltips-popovers.md
/home/dsmason321/.codex/skills/cosmic-design-system/references/tables.md
```

Map the module tokens to local CSS custom properties; do not invent a second visual system.

- [ ] **Step 2: Write failing style contract tests**

Extend `test/render-contract.test.js` to assert that `style.css` contains:

```js
for (const token of ['--neutral-primary-soft', '--signal-cyan', '--signal-violet', '--focus-ring']) assert.match(css, new RegExp(token));
assert.match(css, /font-family:\s*["']?Audiowide/i);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /forced-colors/);
assert.match(css, /:focus-visible/);
assert.match(css, /@media\s*\(max-width:\s*720px\)/);
```

- [ ] **Step 3: Run style tests and verify RED**

Run: `node --test test/render-contract.test.js`

Expected: FAIL because the current CSS does not implement the required tokens and accessibility modes.

- [ ] **Step 4: Implement the cosmic workbench CSS**

Define deep navy/black `neutral-primary-soft` backgrounds, cyan operational signal, violet secondary signal, amber/red warnings, Audiowide typography, subtle fixed grid texture, glass panels, thin luminous borders, and wrapper-based chamfered controls. Concentrate glow on active, hover, and `:focus-visible` states.

Desktop layout uses:

```css
.workbench {
  display: grid;
  grid-template-columns: minmax(11rem, 15rem) minmax(24rem, 1fr) minmax(18rem, 28rem);
  gap: var(--space-5);
  align-items: start;
}
.category-rail,
.command-panel { position: sticky; top: var(--sticky-offset); }
```

At `max-width: 1100px`, place the command panel across the full grid width. At `max-width: 720px`, use one column, turn categories into a horizontal scroll-snap row, keep controls at least 44px tall, remove decorative glow orbs that compete with text, and make the benchmark table render as labeled stacked rows without losing any fields.

The OS-switch differentiator changes only `data-platform` edge glow and the visible platform label. Use a 160-220ms transition and disable it under reduced motion.

- [ ] **Step 5: Implement tooltip, forced-colors, and reduced-motion states**

Tooltips appear on help-button hover and focus, remain in the viewport, never receive focus, and leave the persistent visually-hidden description available. Under forced colors, remove translucent backgrounds and glows, use system borders, and preserve native control outlines. Under reduced motion, set animation and transition durations to near-zero and disable decorative movement.

- [ ] **Step 6: Run tests and inspect static contrast tokens**

Run: `node --test test/*.test.js`

Expected: all tests PASS.

Check text/background and focus/background pairs with the browser contrast inspector during Task 8; do not approve any normal text below 4.5:1 or large text below 3:1.

- [ ] **Step 7: Commit the visual redesign**

```bash
git add style.css index.html lib/render.js test/render-contract.test.js
git commit -m "Apply cosmic responsive workbench design"
```

---

### Task 8: Remove stale implementation, update documentation, and verify in browser

**Files:**
- Delete: `command-rules.js`
- Delete: `script.js`
- Delete: `starter-fields.js`
- Delete: `starter-fields.css`
- Delete: `test/dflash.test.js`
- Modify: `README.md`
- Modify: `index.html`
- Modify: any runtime or test file required by browser findings.

**Interfaces:**
- Consumes: the complete static app and all tests.
- Produces: deployable, dependency-free static files with no stale code paths.

- [ ] **Step 1: Write the failing stale-file and README contract test**

Add to `test/render-contract.test.js`:

```js
test('legacy split catalogue and unsupported DFlash code are removed', () => {
  for (const file of ['command-rules.js', 'script.js', 'starter-fields.js', 'starter-fields.css', 'test/dflash.test.js']) {
    assert.equal(fs.existsSync(path.join(root, file)), false, file);
  }
  const allRuntime = ['index.html', 'app.js', ...fs.readdirSync(path.join(root, 'lib')).map(file => `lib/${file}`)]
    .map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  assert.doesNotMatch(allRuntime, /DFlash|draft-dflash|dflashModel/);
});
```

- [ ] **Step 2: Run the stale-file test and verify RED**

Run: `node --test --test-name-pattern='legacy split catalogue' test/render-contract.test.js`

Expected: FAIL because legacy files still exist.

- [ ] **Step 3: Remove obsolete files and references**

Delete the five listed files and remove every script/link reference to them. Confirm only `flags.json` contains application flag definitions and only runtime modules contain builder behavior.

- [ ] **Step 4: Update README with exact current scope and update workflow**

Document:

- static `llama-cli`/`llama-server` only scope;
- Linux, macOS, Windows PowerShell, and Windows Command Prompt output;
- single global search;
- benchmark preservation and storage keys;
- no backend/accounts/tracking/Docker output;
- how to serve locally (`python3 -m http.server 4173`);
- how to run tests (`node --test test/*.test.js`);
- how to refresh flags: update `flags.json`, run `scripts/audit-flags.js` against current generated upstream README files, then run the full tests.

- [ ] **Step 5: Run all automated verification**

Run:

```bash
node --test test/*.test.js
node scripts/audit-flags.js --cli /home/dsmason321/llama.cpp/tools/cli/README.md --server /home/dsmason321/llama.cpp/tools/server/README.md
git diff --check
```

Expected: all tests PASS, audit reports an exact match, and `git diff --check` prints nothing.

- [ ] **Step 6: Start a local static server and run browser verification**

Run: `python3 -m http.server 4173`

Use the Playwright skill and browser tooling to verify:

1. Page loads with no console errors and only local static requests.
2. Existing stored builder values and benchmark rows survive reload.
3. Server/CLI and Linux/macOS/Windows toggles are keyboard-operable radio groups.
4. Windows reveals PowerShell/CMD and other platforms hide/disable it.
5. Search matches a canonical flag, short alias, category, and description; Escape clears; `/` focuses outside an editor.
6. Editing a search result updates the category view and command without duplicate state.
7. Linux legacy commands remain correct; macOS, PowerShell, and CMD quoting match unit fixtures.
8. Hover and keyboard focus expose every tested help description.
9. Command and benchmark copy actions work; parsing/logging/deleting/exporting remain functional.
10. Layout works at 375x812, 768x1024, 1440x900, and 1920x1080 without clipped controls or page-level horizontal overflow.
11. Reduced motion, forced colors, visible focus, and contrast meet the design spec.

- [ ] **Step 7: Fix browser findings test-first**

For every defect, add the narrowest failing unit/contract test, observe it fail, patch the relevant runtime file, and rerun the focused test plus `node --test test/*.test.js`. Do not make untested behavioral fixes.

- [ ] **Step 8: Run final verification and inspect the diff**

Run:

```bash
node --test test/*.test.js
node scripts/audit-flags.js --cli /home/dsmason321/llama.cpp/tools/cli/README.md --server /home/dsmason321/llama.cpp/tools/server/README.md
git diff --check
git status --short
git diff --stat HEAD~1
```

Expected: tests and audit PASS, no whitespace errors, only intended files are changed, and all legacy files are removed.

- [ ] **Step 9: Commit the completed static rebuild**

```bash
git add README.md index.html style.css flags.json app.js lib scripts test
git add -u command-rules.js script.js starter-fields.js starter-fields.css test/dflash.test.js
git commit -m "Rebuild LlamaCalc static command workbench"
```

---

## Plan Self-Review

- Spec coverage: registry, current upstream audit, stale removal, search, three operating systems/two Windows shells, preservation boundary, benchmark module, cosmic design system, accessibility, responsive behavior, static-only delivery, and update workflow each map to an explicit task.
- Placeholder scan: no `TBD`, `TODO`, “implement later,” generic error-handling instruction, or undefined follow-up task remains.
- Type consistency: `Registry`, `BuilderState`, structured segments, validation result, serializer target, renderer methods, and benchmark entry interfaces keep the same names and shapes across tasks.
- Scope check: every task contributes directly to the single static command-builder rebuild; guided mode, Docker output, profiles, estimates, and other llama.cpp binaries remain excluded.
