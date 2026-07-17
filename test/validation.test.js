const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRegistry } = require('../lib/registry.js');
const { defaultState } = require('../lib/state.js');
const { validateState } = require('../lib/validation.js');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'flags.json'), 'utf8'));
const registry = createRegistry(data);

function stateWith(values, ui = {}) {
    const state = defaultState(registry);
    Object.assign(state, ui);
    Object.assign(state.values, values);
    return state;
}

test('reports invalid ports without destroying the value', () => {
    const state = stateWith({ port: '70000' });
    const result = validateState(registry, state);

    assert.match(result.errorsById.get('port'), /between 1 and 65535/);
    assert.equal(state.values.port, '70000');
});

test('reports numeric format errors from registry metadata', () => {
    const result = validateState(registry, stateWith({ temp: 'warm' }));
    assert.match(result.errorsById.get('temp'), /number/);
});

test('rejects values outside a dropdown current option set', () => {
    const result = validateState(registry, stateWith({ cacheTypeK: 'q2_0' }));
    assert.match(result.errorsById.get('cacheTypeK'), /current option/);
});

test('warns about model source priority in its current order', () => {
    const result = validateState(registry, stateWith({
        modelPath: '/models/local.gguf',
        hfRepo: 'org/repo',
        modelUrl: 'https://example.test/model.gguf'
    }));

    assert.match(result.warnings.find(warning => warning.id === 'source-conflict').message,
        /local path, HF repo, model URL, Docker repo/);
});

test('competing-source warnings focus the first field that is actually filled', () => {
    const target = validateState(registry, stateWith({ hfRepo: 'org/model', modelUrl: 'https://example.test/model.gguf' }));
    const draft = validateState(registry, stateWith({ specDraftModel: 'draft.gguf', specDraftHf: 'org/draft' }));

    assert.equal(target.warnings.find(item => item.id === 'source-conflict').fieldId, 'hfRepo');
    assert.equal(draft.warnings.find(item => item.id === 'draft-source-conflict').fieldId, 'specDraftModel');
});

test('evaluates hard compatibility rules from registry metadata without changing values', () => {
    const cases = [
        [{ flashAttn: 'off', cacheTypeV: 'q4_0' }, 'flash-off-quantized-main-v'],
        [{ flashAttn: 'off', specDraftTypeV: 'q8_0' }, 'flash-off-quantized-draft-v'],
        [{ splitMode: 'tensor', flashAttn: 'off' }, 'tensor-requires-flash'],
        [{ splitMode: 'tensor', cacheTypeK: 'q4_1' }, 'tensor-quantized-cache'],
        [{ splitMode: 'tensor', fit: 'on' }, 'tensor-fit-conflict']
    ];

    for (const [values, warningId] of cases) {
        const state = stateWith(values);
        const before = JSON.stringify(state.values);
        const result = validateState(registry, state);
        const match = result.warnings.find(item => item.id === warningId);
        assert.ok(match, warningId);
        assert.equal(match.severity, 'danger', warningId);
        assert.equal(JSON.stringify(state.values), before, warningId);
    }
});

test('warns about competing manual sources and overrides without clearing them', () => {
    const values = {
        dflashModel: '/models/dflash.gguf',
        specDraftModel: '/models/draft.gguf',
        specDraftHf: 'org/draft',
        specType: 'draft-mtp',
        specDefault: true,
        grammar: 'root ::= object',
        jsonSchemaFile: 'schema.json',
        prompt: 'Hello',
        promptFile: 'prompt.txt',
        chatTemplate: '{{ messages }}',
        chatTemplateFile: 'template.jinja'
    };
    const state = stateWith(values, { mode: 'cli' });
    const result = validateState(registry, state);
    const ids = new Set(result.warnings.map(item => item.id));

    for (const id of [
        'draft-source-conflict',
        'dflash-type-override',
        'spec-default-precedence',
        'output-constraint-conflict',
        'prompt-source-conflict',
        'chat-template-conflict'
    ]) {
        assert.ok(ids.has(id), id);
    }
    assert.deepEqual(Object.fromEntries(Object.keys(values).map(id => [id, state.values[id]])), values);
});

test('warns when reranking is paired with non-rank pooling', () => {
    const result = validateState(registry, stateWith({ rerank: true, pooling: 'mean' }));
    assert.ok(result.warnings.some(item => item.id === 'rerank-pooling-conflict'));
});

test('warns about ignored companion and multi-GPU settings', () => {
    const result = validateState(registry, stateWith({
        hfFile: 'model.gguf',
        splitMode: 'none',
        tensorSplit: '1,1',
        mainGpu: '1',
        fit: 'off',
        fitTarget: '1024',
        fitCtx: '4096'
    }));
    const ids = new Set(result.warnings.map(item => item.id));

    for (const id of ['hf-file-ignored', 'tensor-split-ignored', 'fit-settings-ignored']) {
        assert.ok(ids.has(id), id);
    }
    assert.equal(ids.has('main-gpu-ignored'), false);

    const layer = validateState(registry, stateWith({ splitMode: 'layer', mainGpu: '1' }));
    assert.ok(layer.warnings.some(item => item.id === 'main-gpu-ignored'));
});

test('does not mislabel supported cache and repository combinations', () => {
    const supported = validateState(registry, stateWith({
        flashAttn: 'off',
        cacheTypeK: 'q4_0',
        hfRepo: 'org/model',
        hfFile: 'model.gguf'
    }));
    const ids = new Set(supported.warnings.map(item => item.id));

    assert.equal(ids.has('flash-off-quantized-main-v'), false);
    assert.equal(ids.has('hf-file-ignored'), false);
});

test('warns about exposed unauthenticated servers', () => {
    const result = validateState(registry, stateWith({ host: '0.0.0.0' }));
    assert.match(result.warnings.find(warning => warning.id === 'public-server').message, /without an API key/);
});

test('warns when raw flags cross shell families', () => {
    const result = validateState(registry, stateWith(
        { extraFlags: '--custom "$HOME"' },
        { platform: 'windows', windowsShell: 'powershell' }
    ));

    assert.match(result.warnings.find(warning => warning.id === 'raw-flags').message, /verbatim/);
    assert.match(result.warnings.find(warning => warning.id === 'raw-cross-shell').message, /shell syntax/);
});

test('warns that secret fields are not saved', () => {
    const result = validateState(registry, stateWith({ apiKey: 'secret' }));
    assert.match(result.warnings.find(warning => warning.id === 'secret-values').message, /not saved/);
});

test('warns when Command Prompt will expand a percent-delimited value', () => {
    const result = validateState(registry, stateWith(
        { prompt: 'Show %PATH% literally' },
        { mode: 'cli', platform: 'windows', windowsShell: 'cmd' }
    ));

    assert.match(result.warnings.find(warning => warning.id === 'cmd-percent-expansion').message, /environment variable/);
});
