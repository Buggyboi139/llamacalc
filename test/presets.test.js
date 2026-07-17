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

    assert.deepEqual(serverFields.map(field => field.id), ['modelPath', 'device', 'splitMode', 'tensorSplit']);
    assert.deepEqual(cliFields.map(field => field.id), ['modelPath', 'device', 'splitMode', 'tensorSplit']);
    assert.deepEqual(fieldsForPreset(registry, 'plain', 'server').map(field => field.id), ['modelPath']);
    assert.deepEqual(fieldsForPreset(registry, 'mtp', 'server').map(field => field.id), ['modelPath', 'specDraftModel']);
    assert.deepEqual(fieldsForPreset(registry, 'dflash', 'server').map(field => field.id), ['modelPath', 'dflashModel']);
    assert.deepEqual(fieldsForPreset(registry, 'eagle3', 'server').map(field => field.id), ['modelPath', 'specDraftModel']);
});

test('preset-only field presentation identifies beginner-required target and draft paths', () => {
    const mtpFields = fieldsForPreset(registry, 'mtp', 'server');
    const target = mtpFields.find(field => field.id === 'modelPath');
    const draft = mtpFields.find(field => field.id === 'specDraftModel');

    assert.equal(target.label, 'Target model path');
    assert.equal(target.essentialRole, 'target');
    assert.equal(target.essentialRequired, true);
    assert.equal(draft.label, 'MTP model path');
    assert.equal(draft.essentialRole, 'draft');
    assert.equal(draft.essentialRequired, true);

    assert.equal(registry.byId.get('specDraftModel').label, 'Draft model path');
});

test('switching recipes clears conflicting sources and preserves target path and unrelated tuning', () => {
    const state = defaultState(registry);
    state.values.modelPath = '/models/target.gguf';
    state.values.hfRepo = 'org/target';
    state.values.hfFile = 'target.gguf';
    state.values.hfToken = 'secret';
    state.values.modelUrl = 'https://example.test/target.gguf';
    state.values.dockerRepo = 'org/target:Q4';
    state.values.specDraftHf = 'org/draft';
    state.values.ctxSize = '8192';
    state.values.tensorSplit = '1,1';
    state.values.specDraftNMax = '15';

    applyPreset(registry, state, 'dflash');
    state.values.dflashModel = '/models/dflash.gguf';
    applyPreset(registry, state, 'mtp');

    assert.equal(state.values.modelPath, '/models/target.gguf');
    for (const id of ['hfRepo', 'hfFile', 'hfToken', 'modelUrl', 'dockerRepo', 'specDraftHf']) {
        assert.equal(state.values[id], '', id);
    }
    assert.equal(state.values.ctxSize, '8192');
    assert.equal(state.values.tensorSplit, '1,1');
    assert.equal(state.values.specDraftNMax, '15');
    assert.equal(state.values.dflashModel, '');
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
