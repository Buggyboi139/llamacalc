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

test('warns about model source priority in its current order', () => {
    const result = validateState(registry, stateWith({
        modelPath: '/models/local.gguf',
        hfRepo: 'org/repo',
        modelUrl: 'https://example.test/model.gguf'
    }));

    assert.match(result.warnings.find(warning => warning.id === 'source-conflict').message,
        /local path, HF repo, model URL, Docker repo/);
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
