const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRegistry } = require('../lib/registry.js');
const { defaultState } = require('../lib/state.js');
const { validateState } = require('../lib/validation.js');
const { buildArguments } = require('../lib/command-builder.js');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'flags.json'), 'utf8'));
const registry = createRegistry(data);

function makeState(values = {}, ui = {}) {
    const state = defaultState(registry);
    Object.assign(state, ui);
    Object.assign(state.values, values);
    return state;
}

function values(model) {
    return model.segments.map(segment => segment.value);
}

test('local model wins source conflicts and empty fields are omitted', () => {
    const state = makeState({
        modelPath: '/models/Model One.gguf',
        hfRepo: 'org/repo',
        ctxSize: '4096',
        temp: ''
    });
    const model = buildArguments(registry, state, validateState(registry, state));

    assert.deepEqual(values(model), ['-m', '/models/Model One.gguf', '-c', '4096']);
    assert.match(model.warnings.find(warning => warning.id === 'source-conflict').message, /Priority is local path/);
});

test('HF file and token emit only with the selected HF source', () => {
    const state = makeState({ hfRepo: 'org/repo', hfFile: 'q4.gguf', hfToken: 'token' });
    const model = buildArguments(registry, state, validateState(registry, state));

    assert.deepEqual(values(model), ['-hf', 'org/repo', '-hff', 'q4.gguf', '-hft', 'token']);

    const localState = makeState({ modelPath: '/local.gguf', hfFile: 'ignored.gguf', hfToken: 'ignored' });
    assert.deepEqual(values(buildArguments(registry, localState, validateState(registry, localState))), ['-m', '/local.gguf']);
});

test('boolean, mapped, and pair serialization metadata become argument segments', () => {
    const state = makeState({ mlock: true, mmap: 'off', flashAttn: 'auto' });
    const model = buildArguments(registry, state, validateState(registry, state));

    assert.deepEqual(values(model), ['-fa', 'auto', '--mlock', '--no-mmap']);
    assert.ok(model.segments.every(segment => segment.kind === 'argument'));
});

test('raw passthrough keeps each non-empty line verbatim and last', () => {
    const state = makeState({
        ctxSize: '2048',
        extraFlags: '--foo value\n\n --bar="two words" '
    });
    const model = buildArguments(registry, state, validateState(registry, state));

    assert.deepEqual(model.segments.slice(-2), [
        { kind: 'raw', value: '--foo value' },
        { kind: 'raw', value: '--bar="two words"' }
    ]);
});

test('invalid registered values remain in state but are omitted from arguments', () => {
    const state = makeState({ port: '70000', ctxSize: '4096' });
    const validation = validateState(registry, state);
    const model = buildArguments(registry, state, validation);

    assert.equal(state.values.port, '70000');
    assert.equal(values(model).includes('--port'), false);
    assert.deepEqual(values(model), ['-c', '4096']);
});

test('mode filters flags and platform chooses executable defaults', () => {
    const state = makeState({ prompt: 'hello', host: '127.0.0.1' }, { mode: 'cli', platform: 'windows' });
    const model = buildArguments(registry, state, validateState(registry, state));

    assert.equal(model.executable, '.\\llama.cpp\\build\\bin\\Release\\llama-cli.exe');
    assert.deepEqual(values(model), ['-p', 'hello']);
});

test('explicit executable paths override platform defaults', () => {
    const state = makeState({ serverPath: '/opt/llama server' }, { mode: 'server', platform: 'macos' });
    assert.equal(buildArguments(registry, state, validateState(registry, state)).executable, '/opt/llama server');
});
