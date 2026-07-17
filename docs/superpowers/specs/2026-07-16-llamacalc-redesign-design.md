# LlamaCalc Static Command Builder Redesign

## Goal

Redesign LlamaCalc as a faster, clearer static command-building workbench without changing the behavior that already makes it dependable. Refresh the catalogue against current `llama-cli` and `llama-server` help, add a single global flag search, and add command output for Linux, macOS, and Windows.

This patch is an interface and maintainability redesign, not a new workflow. Guided setup, profiles, runtime estimates, Docker output, accounts, analytics, and every llama.cpp executable other than `llama-cli` and `llama-server` are out of scope.

## Preservation boundary

The redesign must preserve:

- model-source precedence and conflict warnings;
- omission of empty fields;
- raw flag passthrough behavior;
- multiline and single-line command output;
- the existing builder and benchmark `localStorage` keys;
- exclusion of secret fields from persisted state;
- timing-text and timing-JSON parsing;
- benchmark logging, deletion, command capture, Markdown export, and CSV export;
- entirely client-side operation with no accounts, tracking, backend, or runtime service.

Existing saved values will be migrated by stable field ID where the upstream option is still supported. Saved keys for options that are absent from current upstream help are ignored and removed on the next state save; they are never emitted or retained as compatibility metadata.

## Upstream reconciliation

The source of truth is the official, generated option tables for [`llama-cli`](https://github.com/ggml-org/llama.cpp/blob/master/tools/cli/README.md) and [`llama-server`](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md), cross-checked against `common/arg.cpp` or fresh `--help` output when the tables are ambiguous. The registry records the upstream revision and audit date used for the refresh.

The initial audit found three kinds of drift:

1. Current options with no existing control, including newer offline/logging controls, vocoder and multimodal options, server agent/MCP controls, SSE and slot controls, current presets, and some speculative-decoding options.
2. Supported aliases missing from the catalogue and therefore unavailable to search. The new registry stores every documented short and long alias with one canonical option record.
3. Existing options absent from current help, including older prompt-cache, interactive-prefix, grouped-attention, fit-print, RPC, and related CLI spellings. These are classified before removal rather than carried forward accidentally.

Registry status rules are:

- **Supported:** rendered normally and serialized.
- **Deprecated but accepted:** rendered with a visible deprecated badge and replacement guidance when upstream provides it.
- **Removed:** not represented, rendered, migrated, or serialized.

Removed upstream aliases that merely print an error are not treated as supported flags. The existing DFlash shortcut is removed because `draft-dflash` is not a current supported speculative type in the official CLI or server help. Informational actions such as help, version, cache listing, and completion remain valid builder options when current help exposes them.

## Information architecture

Use the approved structured-workbench layout.

### Header

A compact sticky header contains:

- the LlamaCalc identity;
- the existing Server/CLI segmented toggle;
- a new Linux/macOS/Windows segmented toggle styled as a peer control;
- a PowerShell/Command Prompt segmented toggle that appears only for Windows;
- one global search field;
- reset and benchmark-log actions.

Changing mode, operating system, or Windows shell never discards configured flags. It immediately re-renders visibility, validation, and the generated command so users can compare targets.

### Workbench

Desktop and wide-tablet layouts use three functional regions:

1. A sticky category rail with categories, configured counts, and an Essentials entry for the current top controls.
2. A central flag workspace with compact, directly editable rows.
3. A sticky command panel with the generated command, warnings, multiline choice, and copy action.

The Essentials view is metadata-driven and preserves the current high-frequency controls. Category views organize the complete catalogue without duplicating field state. The current large introductory hero is replaced by the compact workbench header so useful controls appear earlier.

On narrow screens, the category rail becomes a horizontally scrollable category control, flag rows become single-column, and the command panel becomes an in-flow card with an optional sticky collapsed summary. No horizontal scrolling is required for form controls or benchmark tables.

### Flag rows

Each option is shown once per view as a compact row containing:

- its plain-language label;
- canonical flag and aliases;
- the appropriate input, select, checkbox, or paired enable/disable control;
- configured, deprecated, experimental, secret, or mode-only status when applicable;
- a keyboard-focusable help trigger.

Every supported option has an authored two-to-three-sentence explanation in the JSON registry. The first sentence explains what the option controls; the remaining sentence or sentences explain when to use it, an important default, or a consequential interaction. The same content is available on pointer hover and keyboard focus and is not hidden from assistive technology.

## Global search

There is exactly one flag search field. It searches a normalized index containing:

- canonical flag name;
- every short and long alias;
- label;
- category title;
- description;
- mode tags such as CLI or server.

Search results replace the category view temporarily but reuse the same field renderer and state. Matching is case-insensitive and punctuation-tolerant, ranks exact flag and alias matches first, and visibly highlights the matching metadata without injecting untrusted HTML.

The search has a persistent label, result count, empty state, clear action, and live-region announcement. `/` focuses search when focus is not already inside an editable control, and Escape clears it. Tab order follows the visual result order; search never traps focus.

## Visual direction

Apply the requested cosmic design system as a restrained technical workbench rather than a decorative landing page.

- Deep navy-to-black surfaces, a subtle grid texture, and low-opacity glass panels establish the cosmic setting.
- Cyan is the primary operational signal, violet is secondary, and amber/red are reserved for warnings and destructive actions.
- Audiowide is the design-system typeface. Sizes, line heights, and letter spacing remain conservative in dense flag rows so labels and descriptions stay readable.
- Chamfered controls, thin luminous borders, and glow are concentrated on active, hover, and focus states. Inactive controls remain quiet to protect information hierarchy.
- The memorable interaction is the operating-system switch: the command panel's restrained edge glow and platform label transition together while field state remains fixed.
- Motion is brief, optional, and disabled under `prefers-reduced-motion`. Grid and glow effects never reduce text contrast.

All interactive elements have visible hover, focus, active, and disabled states. Color never carries meaning alone.

## Static registry and modules

All flag definitions live in one static `flags.json` file. Category metadata may also live there, but no flag definition or tooltip copy may be duplicated in HTML or JavaScript.

Each flag record contains the metadata needed by the independent layers:

```json
{
  "id": "ctxSize",
  "label": "Context size",
  "category": "runtime",
  "modes": ["cli", "server"],
  "canonical": "--ctx-size",
  "aliases": ["-c"],
  "value": {
    "type": "integer",
    "placeholder": "65536"
  },
  "description": "Sets the maximum context window in tokens. Use zero to defer to model metadata, or set an explicit value when memory use and prompt capacity need to be controlled.",
  "serialization": {
    "emit": "pair",
    "preferredAlias": "-c"
  },
  "validation": {
    "integer": true,
    "min": 0
  }
}
```

The client is split into focused static modules:

- `registry.js`: loads and structurally validates `flags.json`, exposes mode/category queries, and builds the search document.
- `state.js`: reads, migrates, filters secrets from, and saves builder state.
- `render.js`: renders navigation, fields, search results, help, warnings, and responsive workbench state.
- `validation.js`: validates values and evaluates dependencies and conflicts.
- `command-builder.js`: converts active fields into an ordered, shell-neutral argument model and applies current source-precedence rules.
- `serializers.js`: turns the argument model into Linux, macOS, PowerShell, or Command Prompt text.
- `benchmarks.js`: contains the preserved timing parser, log storage, table rendering, and exports.
- `app.js`: coordinates mode/platform/search events without owning flag metadata or serialization rules.

The app remains plain static HTML, CSS, JSON, and JavaScript. Loading failures show a clear in-page error; no fallback catalogue is duplicated in JavaScript.

## Command serialization

The command builder first produces structured executable and argument tokens. It does not embed shell quoting while evaluating flag behavior. This keeps precedence and validation independent from the target shell.

### Linux and macOS

Linux and macOS use POSIX-shell quoting. Safe tokens remain unquoted; other values use single quotes with embedded apostrophes escaped correctly. Multiline commands use a trailing backslash. The executable-path field remains editable, and platform selection supplies an appropriate suggestion rather than overwriting the user's value.

### Windows PowerShell

PowerShell uses Windows executable defaults, single-quoted literal arguments, doubled embedded apostrophes, and backticks for multiline continuation. Paths and values containing spaces or PowerShell metacharacters remain one literal argument.

### Windows Command Prompt

Command Prompt uses Windows executable defaults and Windows command-line quoting, including correct treatment of spaces, double quotes, trailing backslashes, percent expansion, and command metacharacters. Multiline output uses caret continuation. Serializer tests use adversarial paths and prompt values rather than only simple examples.

Raw passthrough fields remain verbatim on every target because changing them would violate current behavior. The UI explains that users are responsible for shell-correct raw syntax and warns when a saved raw segment is carried between unlike shell families.

## Validation and warnings

Validation is non-destructive. An invalid value remains editable, is announced accessibly, and is omitted from command output only when emitting it would create a malformed command.

Warnings cover existing source conflicts plus registry-declared conflicts, dependencies, deprecated-but-supported options, and cross-shell raw passthrough. Warnings link or move focus to the relevant control when possible.

Secret values are never persisted. Search terms and UI navigation state are not persisted unless testing shows a clear usability need; the selected mode, platform, Windows shell, multiline preference, and flag values are persisted.

## Benchmark workspace

Benchmark logging stays visually separate below the builder and preserves its current data model and storage key. It receives the cosmic card/table styling and responsive improvements but no new benchmark features.

The timing parser remains behavior-compatible. Existing stored rows render without migration, and newly logged rows continue capturing the exact currently generated command, including the selected operating system and shell in the command text.

## Accessibility

- Semantic landmarks, headings, fieldsets, legends, labels, and buttons replace clickable generic elements.
- Server/CLI, operating-system, and Windows-shell choices are real radio groups with arrow-key behavior.
- Every control has a visible `:focus-visible` state with at least WCAG AA contrast.
- Tooltips are supplemental descriptions connected with `aria-describedby`; focus does not move into a tooltip.
- Search result counts, copy confirmations, validation changes, and registry-load errors use appropriately scoped live regions.
- Touch targets are at least 44 by 44 CSS pixels where controls are discrete.
- Reduced motion and high-contrast/forced-colors modes remain usable.
- The command output and benchmark table can be reached and operated entirely by keyboard.

## Testing

Implementation follows test-driven development. Tests are written and observed failing before each behavior is implemented.

### Registry tests

- JSON schema and unique stable IDs;
- every option has canonical name, complete aliases, category, mode coverage, input metadata, and a two-to-three-sentence description;
- every current supported `llama-cli` and `llama-server` option row is represented;
- removed upstream options are not emitted;
- aliases resolve to a single option record;
- secrets and deprecated-but-supported options are correctly classified;
- options absent from current help and rows explicitly marked removed are absent from the registry.

### Search tests

- matches canonical names, aliases, labels, categories, descriptions, and modes;
- exact-name ranking, punctuation normalization, clearing, and empty results;
- results reuse the same state and do not duplicate controls.

### Command tests

- Linux output remains compatible with current expected commands;
- model-source precedence, empty-field omission, and raw passthrough;
- Linux and macOS POSIX quoting;
- PowerShell quoting and multiline continuation;
- Command Prompt quoting, metacharacters, percent signs, quotes, and trailing backslashes;
- switching platform or shell changes only serialization and executable suggestions, not configured flags;
- mode-specific flags appear only in the correct binary.

### Benchmark tests

- existing text and JSON timing fixtures;
- log persistence and exact command capture;
- Markdown and CSV escaping;
- compatibility with existing stored records.

### Browser verification

- keyboard-only traversal and tooltip access;
- global search behavior;
- responsive layouts at phone, tablet, laptop, and wide desktop widths;
- visible focus, reduced motion, and forced colors;
- copy actions and storage reload;
- no console errors, missing assets, backend requests, analytics, or tracking.

## Acceptance criteria

The redesign is complete when:

1. Existing Linux command and benchmark behavior passes regression coverage.
2. Every current supported `llama-cli` and `llama-server` option and alias is represented in `flags.json` with an intelligible two-to-three-sentence description.
3. One global search finds and edits any visible flag through all required metadata fields.
4. Linux, macOS, PowerShell, and Command Prompt output handles ordinary and adversarial values correctly.
5. Server/CLI and Linux/macOS/Windows are clean peer toggle groups, with the Windows shell choice conditional on Windows.
6. The interface follows the cosmic design system while remaining efficient, responsive, accessible, and keyboard operable.
7. Benchmark storage and exports remain compatible with existing data.
8. The deployed application consists only of static client files and makes no tracking or application-service requests.
