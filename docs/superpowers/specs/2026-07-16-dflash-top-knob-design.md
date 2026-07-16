# DFlash Top Knob Design

## Goal

Make DFlash easy to configure from Llama Command Bench's Main Controls without requiring users to know or manually enter the matching speculative-decoding mode.

## User interface

Add a dedicated **DFlash model path** text field to the speculative-decoding catalogue and place it in the Main Controls list near the existing speculative controls. Leave the field empty by default and show a DFlash GGUF path as its placeholder.

The existing generic **Draft model path** and **Spec type** controls remain available for other speculative-decoding methods.

## Command generation

When **DFlash model path** is empty, it emits no flags and does not change existing behavior.

When **DFlash model path** contains a value, command generation emits:

```text
-md '<dflash model path>' --spec-type draft-dflash
```

The path uses the command builder's existing shell quoting. The automatic mode uses llama.cpp's merged upstream spelling, `--spec-type draft-dflash`.

## Precedence and conflicts

A filled DFlash path takes precedence over the generic **Draft model path** and **Spec type** values. The generated command contains only one `-md` value and one `--spec-type` value for this configuration.

If the DFlash path is filled while either generic field is also filled, show a warning explaining that the DFlash path overrides the generic draft model and speculative type. Do not silently emit duplicate or contradictory flags.

## Persistence and mode support

The DFlash path participates in the existing browser-state persistence through its field ID. It is available in both server and CLI modes, matching the existing speculative controls.

## Testing

Add automated regression coverage for:

- the DFlash field being included in the top Main Controls list;
- an empty DFlash path preserving existing command generation;
- a filled DFlash path emitting the quoted `-md` path and `--spec-type draft-dflash`;
- DFlash precedence preventing duplicate generic speculative flags;
- a conflict warning appearing when DFlash and generic speculative fields are both filled.

Verification will also include the repository's available static checks and a browser smoke test of the rendered control and generated command.
