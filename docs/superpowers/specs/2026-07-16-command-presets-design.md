# Command Presets Design

## Goal

Add a preset dropdown that focuses LlamaCalc's existing Essentials view on the fields needed for a common `llama-cli` or `llama-server` command. Presets compose current registered flags through the existing state, validation, command-builder, and shell-serialization paths; they never inject raw command templates or hide the other category tabs.

## Interface

The control deck places a violet-accented **Preset** select between **Tool** and **Operating system**. The visual separation, label, border treatment, hover state, focus ring, and disabled state follow the existing cosmic control language while distinguishing the select from the cyan segmented operating-system selector.

The select uses native semantic `<select>` behavior with labeled `<optgroup>` sections. It remains keyboard accessible without custom listbox logic and wraps with the existing control deck on narrower screens.

Preset options are filtered by the selected tool:

- **General:** Plain and Multi-GPU, available in CLI and Server modes.
- **Speculative:** Default Speculative, MTP, DFlash, Draft Model, EAGLE-3, and N-gram, available in CLI and Server modes.
- **Server workloads:** Chat/API, Embeddings, and Reranking, available only in Server mode.

Switching tools retains the active preset when it supports the new mode. An incompatible preset falls back to Plain and removes only the incompatible recipe-owned values.

## Essentials and navigation behavior

Selecting a preset returns the workspace to **Essentials**, clears the global search query, and renders the preset's focused field list. The active preset changes what Essentials contains rather than creating a new navigation mode.

Every existing category remains visible and usable. Opening a category shows its complete current flag list; returning to Essentials restores the active preset's focused list. Global search continues to temporarily replace the workspace contents, and clearing search returns to the selected category and preset-aware Essentials behavior.

Configured counts include preset-focused fields using the same meaningful-value rules as the existing categories. The workspace eyebrow identifies the active preset so users can distinguish a focused recipe from the unfiltered flag categories.

## Preset application semantics

Each preset defines:

- `id`, `label`, `group`, `description`, and supported `modes`;
- ordered `fieldIds` to render in Essentials;
- `ownedFieldIds` containing specialized values that must be cleared when entering or leaving the recipe;
- `values` containing semantic fixed settings applied on selection.

Applying a preset is one state transaction:

1. Clear values owned by the previous preset.
2. Clear values owned by the new preset so manually configured conflicting strategies cannot leak into it.
3. Apply the new preset's fixed values.
4. Preserve every value not owned by either recipe.
5. Store the new preset ID, activate Essentials, and clear search.

Presets do not guess hardware- or workload-dependent values such as context length, GPU layers, batch sizes, tensor split ratios, cache quantization, temperature, host, or port. They apply only semantic requirements and expose the remaining focused fields for the user to fill in.

## Initial recipes

### Plain

Applies no fixed flags. Essentials shows executable/model sources, context, prediction length, threads, GPU layers, Flash Attention, K/V cache types, and mode-specific prompt or server-listener fields.

### Multi-GPU

Applies no fixed split policy because `layer`, `row`, and `tensor` are hardware- and model-dependent. Essentials adds device selection, split mode, tensor split, main GPU, fit controls, batch sizing, and GPU layers; these general hardware values remain available when another compatible recipe is selected.

### Default Speculative

Sets the current `--spec-default` action and clears explicit speculative type/draft-model conflicts. Essentials shows the main model, general runtime/offload fields, the configured default action, and n-gram-mod tuning fields.

### MTP

Sets `specType` to `draft-mtp` and clears draft-model, DFlash, default-speculative, and n-gram-specific conflicts. Essentials shows the main model, general runtime/offload fields, speculative type, draft token bounds, and Flash Attention. It does not request a separate draft model because MTP uses heads in the main model.

### DFlash

Uses the existing `dflashModel` shortcut, which emits `-md PATH --spec-type draft-dflash` only after a DFlash GGUF is supplied. Essentials shows the main model, DFlash model path, draft token bounds, draft GPU/cache controls, Flash Attention, and Jinja without inventing performance defaults.

### Draft Model

Sets `specType` to `draft-simple`. Essentials shows the main and draft model sources, draft token/probability controls, draft device/GPU/cache fields, and common runtime fields.

### EAGLE-3

Sets `specType` to `draft-eagle3`. It uses the same focused draft-model controls as Draft Model while retaining its distinct current speculative type.

### N-gram

Sets `specType` to `ngram-simple` and clears draft-model/default-speculative conflicts. Essentials shows the main model, speculative type, n-gram size N/M, minimum hits, and common runtime fields.

### Chat/API

Available only in Server mode. It clears embedding/reranking workload flags and focuses model source, context/offload, host, port, alias, API authentication, parallel slots, Jinja, reasoning, chat-template, and built-in-tool fields without enabling experimental tools automatically.

### Embeddings

Available only in Server mode. It enables the current embedding-only flag, disables the reranking flag in state, and focuses model source, pooling, embedding normalization, batches, parallel slots, listener, alias, and authentication fields. Pooling remains unset so llama.cpp can use the model default.

### Reranking

Available only in Server mode. It enables embedding and reranking and sets pooling to `rank`, matching current server requirements. Essentials exposes the same server/model/batch fields as Embeddings.

## Registry and module boundaries

`flags.json` remains the single static metadata source and gains a top-level `presets` array. `lib/registry.js` validates unique preset IDs, groups, supported modes, field references, owned-field references, fixed-value references, and fixed choice values.

A new `lib/presets.js` owns pure preset behavior:

- `presetsForMode(registry, mode)` returns compatible recipes in registry order;
- `presetById(registry, id)` resolves a recipe;
- `fieldsForPreset(registry, presetId, mode)` returns ordered, mode-compatible fields;
- `applyPreset(registry, state, presetId)` mutates the supplied state transaction and returns the selected preset;
- `ensurePresetForMode(registry, state)` mutates incompatible state to Plain and returns the active preset.

`lib/render.js` renders the select and asks the preset module for Essentials fields. `app.js` handles the select event, clears search, and delegates state changes. Command construction remains unaware of presets and continues serializing only current field values.

`lib/state.js` adds a persisted `activePreset` key with a `plain` default. Loading an unknown or mode-incompatible saved preset safely falls back to Plain after the registry is available.

## Validation and conflicts

Invalid preset metadata fails registry loading with an intelligible error. Preset application never sets an unregistered field or a value outside a registered choice list.

Recipe transitions eliminate known semantic conflicts before command generation. Existing cross-field validation, source precedence, DFlash override handling, public-server warnings, secret handling, and raw-extra-flag warnings remain unchanged.

## Accessibility and responsive behavior

The preset select has a persistent visible label and an accessible description explaining that it changes Essentials and may replace recipe-specific values. Native select and optgroup keyboard behavior is preserved. Focus remains on the selector after a change, while the workspace update is announced through the existing live region.

At desktop widths the selector sits on the command-target line between Tool and Operating system. At narrow widths it participates in the current wrapping/scrolling control deck without causing horizontal page overflow. Reduced-motion and forced-colors behavior uses the existing global rules.

## Testing

Automated tests cover:

- registry validation and the complete initial preset catalogue;
- mode-filtered preset availability and Server-only recipes;
- ordered focused fields for every recipe;
- selective clearing, fixed-value application, and preservation of unrelated tuning;
- tool switches retaining compatible presets and falling back from incompatible presets;
- persisted `activePreset` compatibility;
- preset-aware Essentials rendering while other categories and global search remain intact;
- command output for MTP, DFlash, Draft Model, EAGLE-3, Default Speculative, N-gram, Embeddings, and Reranking;
- semantic label/select/optgroup structure, keyboard focus, responsive overflow, and forced-colors behavior;
- unchanged benchmark logging and cross-platform serializers through the full existing suite.

A real-browser regression pass selects representative presets, fills their required paths, navigates to another category and back to Essentials, searches globally, switches tools, and verifies Linux/macOS/PowerShell/Command Prompt output without external requests or console errors.
