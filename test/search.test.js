const test = require('node:test');
const assert = require('node:assert/strict');
const { createRegistry } = require('../lib/registry.js');
const { normalizeSearchText, searchFlags } = require('../lib/search.js');

const registry = createRegistry({
    meta: {},
    executables: {},
    categories: [
        { id: 'runtime', label: 'Runtime & context' },
        { id: 'prompt', label: 'Prompt & chat' },
        { id: 'speculative', label: 'Speculative decoding' }
    ],
    fields: [
        {
            id: 'dflashModel',
            label: 'DFlash model path',
            category: 'speculative',
            modes: ['cli', 'server'],
            aliases: ['DFlash', 'draft-dflash'],
            value: { type: 'string' },
            description: 'Selects a DFlash draft model. It automatically enables the draft-dflash speculative type.'
        }
    ],
    flags: [
        {
            id: 'ctxSize',
            label: 'Context size',
            category: 'runtime',
            modes: ['cli', 'server'],
            canonical: '--ctx-size',
            aliases: ['-c'],
            value: { type: 'integer' },
            description: 'Sets the context window in tokens. Use it to control prompt capacity and cache memory.',
            serialization: { emit: 'pair' }
        },
        {
            id: 'cacheRam',
            label: 'Model cache memory',
            category: 'runtime',
            modes: ['cli', 'server'],
            canonical: '--cache-ram',
            aliases: ['-cram'],
            value: { type: 'integer' },
            description: 'Limits model cache storage in memory. Use it when downloaded models need a fixed cache budget.',
            serialization: { emit: 'pair' }
        },
        {
            id: 'multilineInput',
            label: 'Multiline input',
            category: 'prompt',
            modes: ['cli'],
            canonical: '--multiline-input',
            aliases: ['-mli'],
            value: { type: 'boolean' },
            description: 'Allows prompts to span multiple terminal lines. Use it for direct CLI sessions with longer input.',
            serialization: { emit: 'boolean' }
        }
    ]
});

test('exact alias outranks description and category matches', () => {
    const results = searchFlags(registry, '--ctx-size', 'server');

    assert.equal(results[0].flag.id, 'ctxSize');
    assert.equal(results[0].matchedBy, 'alias');
    assert.ok(results[0].score > results.slice(1).reduce((score, result) => Math.max(score, result.score), 0));
});

test('normalizes leading dashes, case, underscores, and punctuation', () => {
    assert.equal(normalizeSearchText('--CTX_size'), 'ctx size');
    assert.equal(searchFlags(registry, 'CTX SIZE', 'server')[0].flag.id, 'ctxSize');
});

test('matches aliases, labels, categories, and descriptions', () => {
    assert.equal(searchFlags(registry, '-cram', 'server')[0].matchedBy, 'alias');
    assert.equal(searchFlags(registry, 'model cache memory', 'server')[0].matchedBy, 'label');
    assert.ok(searchFlags(registry, 'runtime', 'server').length >= 2);
    assert.equal(searchFlags(registry, 'downloaded models', 'server')[0].flag.id, 'cacheRam');
});

test('does not return CLI-only options in server mode', () => {
    assert.deepEqual(searchFlags(registry, 'multiline input', 'server'), []);
    assert.equal(searchFlags(registry, 'multiline input', 'cli')[0].flag.id, 'multilineInput');
});

test('empty search returns no results', () => {
    assert.deepEqual(searchFlags(registry, '  ', 'server'), []);
});

test('search includes JSON-defined DFlash builder shortcuts', () => {
    assert.equal(searchFlags(registry, 'dflash', 'server')[0].flag.id, 'dflashModel');
    assert.equal(searchFlags(registry, 'speculative decoding', 'cli').some(result => result.flag.id === 'dflashModel'), true);
});
