const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRegistry } = require('../lib/registry.js');
const { defaultState } = require('../lib/state.js');
const {
    presetsForMode,
    presetById,
    fieldsForPreset,
    applyPreset,
    ensurePresetForMode
} = require('../lib/presets.js');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'flags.json'), 'utf8'));
const registry = createRegistry(data);
const PRESET_IDS = [
    'plain', 'multiGpu', 'defaultSpeculative', 'mtp', 'dflash',
    'draftModel', 'eagle3', 'ngram', 'chatApi', 'embeddings', 'reranking'
];

test('catalogue exposes grouped presets filtered by tool mode', () => {
    assert.deepEqual(registry.presets.map(preset => preset.id), PRESET_IDS);
    assert.deepEqual(presetsForMode(registry, 'cli').map(preset => preset.id), PRESET_IDS.slice(0, 8));
    assert.deepEqual(presetsForMode(registry, 'server').map(preset => preset.id), PRESET_IDS);
    assert.equal(presetById(registry, 'dflash').group, 'Speculative');
});

test('focused fields preserve JSON order and filter by mode', () => {
    const serverFields = fieldsForPreset(registry, 'multiGpu', 'server');
    const cliFields = fieldsForPreset(registry, 'multiGpu', 'cli');

    assert.equal(serverFields.some(field => field.id === 'tensorSplit'), true);
    assert.equal(serverFields.some(field => field.id === 'serverPath'), true);
    assert.equal(serverFields.some(field => field.id === 'cliPath'), false);
    assert.equal(cliFields.some(field => field.id === 'cliPath'), true);
    assert.equal(cliFields.some(field => field.id === 'serverPath'), false);
    assert.deepEqual(
        fieldsForPreset(registry, 'mtp', 'server').slice(-3).map(field => field.id),
        ['specType', 'specDraftNMax', 'specDraftNMin']
    );
});

test('switching recipes clears owned values and preserves unrelated tuning', () => {
    const state = defaultState(registry);
    state.values.ctxSize = '8192';
    state.values.tensorSplit = '1,1';

    applyPreset(registry, state, 'dflash');
    state.values.dflashModel = '/models/dflash.gguf';
    state.values.specDraftNMax = '15';
    applyPreset(registry, state, 'mtp');

    assert.equal(state.values.ctxSize, '8192');
    assert.equal(state.values.tensorSplit, '1,1');
    assert.equal(state.values.dflashModel, '');
    assert.equal(state.values.specDraftNMax, '');
    assert.equal(state.values.specType, 'draft-mtp');
    assert.equal(state.activePreset, 'mtp');
    assert.equal(state.activeCategory, 'essentials');
});

test('semantic fixed values match each recipe', () => {
    for (const [presetId, fieldId, expected] of [
        ['defaultSpeculative', 'specDefault', true],
        ['draftModel', 'specType', 'draft-simple'],
        ['eagle3', 'specType', 'draft-eagle3'],
        ['ngram', 'specType', 'ngram-simple'],
        ['embeddings', 'embedding', true],
        ['reranking', 'pooling', 'rank']
    ]) {
        const state = defaultState(registry);
        applyPreset(registry, state, presetId);
        assert.equal(state.values[fieldId], expected, presetId);
    }
});

test('tool changes retain compatible presets and fall back from server-only recipes', () => {
    const compatible = defaultState(registry);
    applyPreset(registry, compatible, 'multiGpu');
    compatible.mode = 'cli';
    assert.equal(ensurePresetForMode(registry, compatible).id, 'multiGpu');

    const incompatible = defaultState(registry);
    applyPreset(registry, incompatible, 'reranking');
    incompatible.mode = 'cli';
    const fallback = ensurePresetForMode(registry, incompatible);
    assert.equal(fallback.id, 'plain');
    assert.equal(incompatible.activePreset, 'plain');
    assert.equal(incompatible.values.embedding, false);
    assert.equal(incompatible.values.rerank, false);
    assert.equal(incompatible.values.pooling, '');
});

test('invalid or unavailable preset selection fails explicitly', () => {
    const state = defaultState(registry);
    state.mode = 'cli';
    assert.throws(() => applyPreset(registry, state, 'reranking'), /unavailable in cli mode/);
    assert.throws(() => fieldsForPreset(registry, 'missing', 'server'), /Unknown preset/);
});
