# Preset Essentials and Compatibility Warnings

## Scope

Refine only the preset-focused Essentials view and cross-field warnings. Full category tabs, global search, benchmark logging, state persistence, command construction, and Linux/macOS/Windows serialization keep their existing behavior.

## Beginner Essentials

Presets are path-first starting points rather than complete tuning forms:

- Plain, Default Speculative, N-gram, Chat/API, Embeddings, and Reranking show the target model path.
- Multi-GPU shows the target model path plus Device, Split mode, and Tensor split.
- MTP, DFlash, Draft Model, and EAGLE-3 show the target model path plus the relevant draft model path.

GPU layers, Jinja, cache controls, Hugging Face fields, listener fields, and performance knobs remain in their complete category tabs. Preset-only field metadata relabels the shared draft field for MTP and EAGLE-3 without changing its normal category label.

Required target fields use cyan emphasis; required draft fields use violet emphasis. Both receive a visible role badge and `aria-required`, and Multi-GPU controls receive a separate setup heading. A read-only summary tells the user which fixed semantic arguments the selected preset applies.

## Preset application

Selecting a preset is the only automatic cleanup operation. It clears hidden alternative target sources, the draft HF source, and semantic values owned by the previous and next recipes before applying the new fixed values.

The local target model path and unrelated tuning persist across preset changes. Editing any field through search or a full category tab never clears another field; incompatible manual combinations remain visible and produce warnings.

## Compatibility catalogue

Rules are stored in `flags.json` and evaluated generically by `lib/validation.js`:

- **Cannot run:** Flash Attention off with quantized main or draft V cache; tensor split with Flash Attention off, any quantized main/draft KV cache, or Fit explicitly on.
- **Conflict:** multiple target sources; multiple draft sources; DFlash with another explicit speculative type; default speculative decoding with an explicit draft configuration; multiple output constraints, prompt sources, or chat-template sources; reranking with non-rank pooling.
- **Ignored:** HF file without HF repo; Tensor split with split mode none; Main GPU with layer or tensor mode; Fit target/context with Fit off.

Quantized K cache without tensor mode is intentionally allowed when Flash Attention is off. HF repo plus HF file is valid, and draft HF repo plus draft filename receives cautious conflict wording because it can be an intentional repo-and-file pair.

## Metadata and validation architecture

`flags.json` owns:

- `validationSets` for shared value families such as quantized cache types;
- `compatibilityRules` for conditions, severity, focus field, mode filtering, and messages;
- `presetDefaults` for global preset cleanup and shared presentation;
- per-preset ordered fields, fixed values, presentation overrides, and applied-argument summaries.

`lib/registry.js` validates every referenced field, condition operator, validation set, severity, and preset presentation override. `lib/validation.js` evaluates nested all/any conditions and filled-field counts without mutating state. `lib/presets.js` owns preset transactions, `lib/render.js` owns presentation, and `lib/command-builder.js` remains responsible only for deterministic argument selection and serialization input.

## Verification

Automated coverage proves registry failures for unknown rule fields, each warning family, supported exceptions, state preservation, exact preset field lists, preset-only labels, accessible required roles, and full-category reachability. The browser pass exercises MTP and DFlash paths, per-character focus retention, conflict warnings, and Linux/macOS/Windows output activation.
