# LlamaCalc

LlamaCalc is a fully static command workbench for current `llama-cli` and `llama-server` options. It generates commands in the browser and keeps the existing benchmark logger focused on real llama.cpp timing output.

## Current scope

- `llama-cli` and `llama-server` only
- Linux and macOS Bash/Zsh output
- Windows PowerShell and Windows Command Prompt output
- One global search across flag names, aliases, labels, categories, and descriptions
- Focused command presets for plain, multi-GPU, speculative, and server workloads
- A DFlash shortcut that emits the current `-md` and `--spec-type draft-dflash` arguments
- Dropdowns for every finite single-choice parameter documented by current llama.cpp help
- A single JSON registry with current option metadata, focused help text, presets, and compatibility rules
- Browser-local builder state and benchmark logs
- No backend, accounts, cookies, tracking, analytics, or runtime service
- No Docker command output target

The current llama.cpp `--docker-repo` model-source option remains available because it is an active CLI/server flag. LlamaCalc does not generate `docker run` commands or expose Docker as an operating-system target.

## Run locally

The app uses `fetch()` to load `flags.json`, so serve the repository instead of opening `index.html` directly:

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173`.

## Storage and privacy

Everything runs client-side. Builder state is stored under `llamacmd_state_v1`, benchmark entries under `llamacmd_logs_v1`, and fields marked as secrets are never persisted.

The bundled Audiowide font prevents third-party font requests. The app makes no application requests after its static files and `flags.json` load.

## Project structure

- `flags.json` — the application’s single flag-metadata registry
- `index.html` — semantic application and benchmark shell
- `style.css` — responsive cosmic workbench design and accessibility modes
- `app.js` — state orchestration and UI event bindings
- `lib/registry.js` — registry loading and schema validation
- `lib/search.js` — global flag search and ranking
- `lib/state.js` — defaults and local-storage compatibility
- `lib/validation.js` — field and cross-field validation
- `lib/command-builder.js` — structured command arguments
- `lib/serializers.js` — POSIX, PowerShell, and Command Prompt output
- `lib/benchmarks.js` — timing parsing, log persistence, and exports
- `lib/presets.js` — focused field lists and selective preset transitions
- `lib/render.js` — JSON-driven, accessible DOM rendering
- `scripts/` — flag-registry maintenance and upstream audit tools
- `test/` — unit and static contract tests

Flag metadata, rendering, validation, and shell serialization are deliberately separate so upstream changes do not require editing the interface or command engine together.

## Command presets

The Preset selector focuses **Essentials** on the bare paths and setup controls needed to start a common command while leaving every full category available. General presets include Plain and Multi-GPU; speculative presets include Default Speculative, MTP, DFlash, Draft Model, EAGLE-3, and N-gram; llama-server additionally offers Chat/API, Embeddings, and Reranking.

Presets apply only semantic requirements such as `--spec-type draft-mtp`, `--embedding`, or reranking's `--pooling rank`. They do not guess GPU layers, Jinja, cache types, or performance values. Selecting a preset clears hidden alternative model sources and recipe-owned conflicts, preserves the local target path and unrelated tuning, and never changes what is available under the full category tabs.

These builder recipes are distinct from llama.cpp router `.ini` presets and from individual action flags such as `--spec-default`. Their metadata and ordered Essentials field lists live beside the flags in `flags.json`; generated commands still pass through the same validation, command builder, and platform serializers as manually configured fields.

## Compatibility warnings

Cross-field rules also live in `flags.json`. They identify launch-breaking combinations, competing model or prompt sources, and settings that llama.cpp will ignore; manual edits are never cleared or rewritten. The UI distinguishes **Cannot run**, **Conflict**, and **Ignored** messages while continuing to generate the deterministic command so the user can inspect and correct it.

Quantized V cache requires Flash Attention, while quantized K cache alone does not. Tensor split mode additionally requires Flash Attention and currently conflicts with any quantized KV cache or explicitly enabled automatic Fit.

## Tests

Run the complete suite with Node.js:

```bash
node --test test/*.test.js
```

Audit the registry against a current llama.cpp checkout:

```bash
node scripts/audit-flags.js \
  --cli /path/to/llama.cpp/tools/cli/README.md \
  --server /path/to/llama.cpp/tools/server/README.md
```

The audit fails when documented option rows are missing from `flags.json` or registry aliases no longer appear in the selected CLI/server help. DFlash support is additionally checked against `docs/speculative.md`, where `draft-dflash` is documented as a current speculative type rather than a standalone flag.

## Updating llama.cpp flags

1. Update the local llama.cpp checkout and inspect the current generated `tools/cli/README.md` and `tools/server/README.md` option tables.
2. Update `flags.json`, keeping one entry per option group with all aliases, applicable modes, value metadata, serialization rules, and a concise two-to-three-sentence description. Update preset field references, validation sets, and compatibility-rule field references when a renamed or replaced flag affects them.
3. Remove entries whose option rows explicitly say they were removed. Retain deprecated options only while current help still accepts and documents them.
4. Run `scripts/audit-flags.js` against both current README files.
5. Run `node --test test/*.test.js` and verify representative commands in each supported shell.

`scripts/rebuild-registry.js` can refresh the registry from the current upstream option tables while preserving curated metadata, but its output must still pass the audit and full test suite before it is committed.

## Benchmark log

The benchmark logger accepts standard llama.cpp text timing lines and nested server timing JSON. Saved rows preserve their exact generated command and can be copied individually or exported as Markdown or CSV.
