const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRegistry } = require('../lib/registry.js');
const { STATE_KEY, defaultState, loadState, saveState } = require('../lib/state.js');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'flags.json'), 'utf8'));
const registry = createRegistry(data);

function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key)
    };
}

test('default state contains UI defaults and every current field', () => {
    const state = defaultState(registry);

    assert.equal(state.mode, 'server');
    assert.equal(state.platform, 'linux');
    assert.equal(state.windowsShell, 'powershell');
    assert.equal(state.multiline, true);
    assert.equal(state.activeCategory, 'essentials');
    assert.equal(state.values.ctxSize, '');
    assert.equal(state.values.serverPath, '');
    assert.equal(state.values.extraFlags, '');
});

test('loads legacy values, supplies platform defaults, and drops stale keys', () => {
    const storage = memoryStorage({
        [STATE_KEY]: JSON.stringify({
            mode: 'cli',
            ctxSize: '8192',
            dflashModel: '/old.gguf',
            multiline: false
        })
    });

    const state = loadState(storage, registry);

    assert.equal(state.mode, 'cli');
    assert.equal(state.platform, 'linux');
    assert.equal(state.windowsShell, 'powershell');
    assert.equal(state.multiline, false);
    assert.equal(state.values.ctxSize, '8192');
    assert.equal('dflashModel' in state.values, false);
});

test('never loads or persists registry-marked secrets', () => {
    const storage = memoryStorage({
        [STATE_KEY]: JSON.stringify({ apiKey: 'loaded-secret', hfToken: 'loaded-token' })
    });
    const state = loadState(storage, registry);
    assert.equal(state.values.apiKey, '');
    assert.equal(state.values.hfToken, '');

    state.values.apiKey = 'saved-secret';
    state.values.hfToken = 'saved-token';
    state.values.ctxSize = '4096';
    saveState(storage, state, registry);

    const saved = JSON.parse(storage.getItem(STATE_KEY));
    assert.equal(saved.apiKey, undefined);
    assert.equal(saved.hfToken, undefined);
    assert.equal(saved.ctxSize, '4096');
});

test('persists the existing flat shape with platform controls', () => {
    const storage = memoryStorage();
    const state = defaultState(registry);
    state.platform = 'windows';
    state.windowsShell = 'cmd';
    state.values.modelPath = 'C:\\Models\\one.gguf';

    saveState(storage, state, registry);
    const saved = JSON.parse(storage.getItem(STATE_KEY));

    assert.equal(saved.platform, 'windows');
    assert.equal(saved.windowsShell, 'cmd');
    assert.equal(saved.modelPath, 'C:\\Models\\one.gguf');
    assert.equal(saved.values, undefined);
});

test('invalid saved JSON falls back to defaults', () => {
    const state = loadState(memoryStorage({ [STATE_KEY]: '{broken' }), registry);
    assert.deepEqual(state, defaultState(registry));
});

module.exports = { memoryStorage };
