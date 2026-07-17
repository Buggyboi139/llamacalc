# Readable Font Design

## Scope

Replace LlamaCalc's Audiowide interface typography with the user-selected Space Grotesk direction. Do not change spacing, sizing, colors, borders, component structure, navigation, command behavior, validation, or benchmark logging.

## Typography

Bundle the official Space Grotesk variable TrueType asset and load it with `font-display: swap`. Use Space Grotesk for interface text with a system sans-serif fallback so the static site never makes a runtime font request.

Use a native monospace stack for generated commands and flag aliases. This matches the approved comparison, improves character distinction in paths and arguments, and remains a typography-only change.

## Static hosting and privacy

The font and its license live under `assets/fonts/`. GitHub Pages serves the asset alongside the existing static files; there is no CDN, backend, package manager, or runtime service.

## Box compatibility

Keep every existing box dimension and responsive rule unchanged. Verify representative Plain, MTP, DFlash, and Multi-GPU views at desktop, tablet, and narrow mobile widths in headless Chrome.

The browser check must confirm that the page does not gain horizontal overflow, labels and buttons do not clip their text, command output remains contained, and the control deck's intentional narrow-screen scrolling stays within its own container.

## Automated coverage

Update the static render contract to require the local Space Grotesk face, system fallback, native monospace stack, and absence of Audiowide CSS references. Run the full test suite, current flag audit, whitespace check, responsive browser assertions, and visual screenshots before committing and pushing to `main`.
